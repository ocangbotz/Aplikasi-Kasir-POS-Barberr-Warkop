'use strict';
/**
 * E2E Fase 7: Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel
 * (kelola user, kelola transaksi, backup/restore). Mandiri: menjalankan
 * devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:owner-panel
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8794;
const BASE = `http://localhost:${PORT}`;
const DEV_SERVER = path.join(__dirname, '..', 'devServer.js');

let passed = 0;
let failed = 0;
function ok(msg) { console.log('  ✓ ' + msg); passed++; }
function bad(msg) { console.error('  ✗ ' + msg); failed++; }

function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(url).then((r) => { if (r.ok) resolve(); else retry(); }).catch(retry);
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Timeout menunggu dev server siap'));
      setTimeout(tryOnce, 150);
    };
    tryOnce();
  });
}

async function waitForToastContaining(page, substring) {
  await page.waitForFunction(
    (s) => Array.from(document.querySelectorAll('#toast-container div')).some((el) => el.textContent.includes(s)),
    substring,
    { timeout: 5000 }
  );
}

async function main() {
  console.log('Fase 7 E2E: Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel\n');

  const server = spawn(process.execPath, [DEV_SERVER], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  let browser;
  try {
    await waitForServer(`${BASE}/api?action=ping`);
    const credRes = await fetch(`${BASE}/__dev/owner-credentials`);
    const cred = await credRes.json();

    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage();
    page.on('dialog', (dialog) => dialog.accept());
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    await page.goto(BASE + '/');
    await page.waitForSelector('#login-form', { timeout: 5000 });
    await page.fill('#username', 'owner');
    await page.fill('#password', cred.password);
    await page.click('#login-submit');
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });

    // --- Seed: layanan + capster ---
    await page.evaluate(() => { location.hash = '#/barber/layanan'; });
    await page.waitForSelector('#layanan-form', { timeout: 5000 });
    await page.fill('#layanan-nama', 'Potong Rambut');
    await page.fill('#layanan-harga', '30000');
    await page.click('#layanan-submit');
    await page.waitForTimeout(200);

    await page.evaluate(() => { location.hash = '#/barber/capster'; });
    await page.waitForSelector('#capster-form', { timeout: 5000 });
    await page.fill('#capster-nama', 'Rizky');
    await page.fill('#capster-persentase', '50');
    await page.click('#capster-submit');
    await page.waitForTimeout(200);

    // --- Closing Shift: buka ---
    await page.evaluate(() => { location.hash = '#/shift'; });
    await page.waitForSelector('#open-form', { timeout: 5000 });
    await page.fill('#saldo-awal', '100000');
    await page.click('#open-form button[type="submit"]');
    await page.waitForSelector('#close-form', { timeout: 5000 });
    ok('Shift berhasil dibuka dengan saldo awal Rp100.000');

    // --- Transaksi selama shift terbuka ---
    await page.evaluate(() => { location.hash = '#/barber/transaksi'; });
    await page.waitForSelector('#layanan-grid .layanan-card', { timeout: 5000 });
    await page.click('#layanan-grid .layanan-card');
    await page.fill('#namaPelanggan', 'Pelanggan Shift');
    await page.fill('#noHp', '081255566677');
    await page.selectOption('#capsterId', { label: 'Rizky' });
    await page.click('button[data-metode="Cash"]');
    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    await page.click('#struk-close');

    // --- Tutup shift: uang fisik = 100000 + 30000 = 130000 (pas) ---
    await page.evaluate(() => { location.hash = '#/shift'; });
    await page.waitForSelector('#close-form', { timeout: 5000 });
    await page.fill('#uang-kas-fisik', '130000');
    await page.fill('#catatan-kasir', 'Pas, tidak ada selisih');
    await page.click('#close-form button[type="submit"]');
    await waitForToastContaining(page, 'Selisih kas: Rp0');
    ok('Shift ditutup dengan selisih kas Rp0 (Cash Rp30.000 dari transaksi dihitung otomatis)');

    await page.waitForSelector('#open-form', { timeout: 5000 });
    ok('Setelah ditutup, form "Buka Shift" tampil kembali (tidak ada shift aktif)');

    const shiftRowText = await page.locator('#shift-body tr').first().innerText();
    if (shiftRowText.includes('Ditutup') && shiftRowText.includes('Rp130.000')) ok('Riwayat shift menampilkan data shift yang baru ditutup');
    else bad('Riwayat shift tidak sesuai: ' + shiftRowText);

    // --- Reopen shift (Owner) ---
    await page.click('.reopen-btn');
    await waitForToastContaining(page, 'dibuka kembali');
    ok('Owner berhasil membuka kembali shift yang sudah ditutup');
    await page.waitForSelector('#close-form', { timeout: 5000 });
    await page.fill('#uang-kas-fisik', '130000');
    await page.click('#close-form button[type="submit"]');
    await page.waitForSelector('#open-form', { timeout: 5000 });

    // --- Gaji Capster ---
    await page.evaluate(() => { location.hash = '#/gaji-capster'; });
    await page.waitForSelector('#capster-select', { timeout: 5000 });
    await page.selectOption('#capster-select', { label: 'Rizky' });
    await page.waitForSelector('#preview-area:not(.hidden)', { timeout: 5000 });
    const previewKepala = await page.locator('#preview-kepala').innerText();
    if (Number(previewKepala) >= 1) ok('Pratinjau Gaji Capster menghitung Total Kepala otomatis: ' + previewKepala);
    else bad('Total Kepala pratinjau tidak sesuai: ' + previewKepala);

    await page.fill('#bonus', '20000');
    await page.click('#gaji-submit');
    await waitForToastContaining(page, 'berhasil disimpan');
    await page.waitForFunction(() => document.querySelector('#gaji-body').innerText.includes('Rizky'), { timeout: 5000 });
    ok('Gaji Capster tersimpan dan tampil di riwayat');

    // --- Pelanggan ---
    await page.evaluate(() => { location.hash = '#/pelanggan'; });
    await page.waitForSelector('#search-input', { timeout: 5000 });
    await page.fill('#search-input', 'Pelanggan Shift');
    await page.waitForTimeout(400);
    const pelangganRow = await page.locator('#pelanggan-body tr').first().innerText();
    if (pelangganRow.includes('Pelanggan Shift')) ok('Pencarian pelanggan menemukan pelanggan dari transaksi shift tadi');
    else bad('Pencarian pelanggan tidak sesuai: ' + pelangganRow);

    await page.click('.detail-btn');
    await page.waitForSelector('#member-toggle', { timeout: 5000 });
    const riwayatText = await page.locator('.glass-card.w-full.max-w-lg').innerText();
    if (riwayatText.includes('Potong Rambut')) ok('Detail pelanggan menampilkan riwayat haircut');
    else bad('Riwayat haircut tidak tampil di detail pelanggan');

    await page.click('#member-toggle');
    await waitForToastContaining(page, 'Status member diperbarui');
    ok('Toggle status Member berhasil');
    await page.click('#detail-close');

    // --- Audit Log ---
    await page.evaluate(() => { location.hash = '#/owner/audit-log'; });
    await page.waitForSelector('#log-body tr', { timeout: 5000 });
    const logCount = await page.locator('#log-body tr').count();
    if (logCount > 5) ok('Audit Log menampilkan banyak entri aktivitas (' + logCount + ' baris termasuk detail tersembunyi)');
    else bad('Audit Log tampak kosong: ' + logCount + ' baris');
    await page.click('.toggle-detail-btn');
    await page.waitForTimeout(150);
    const detailVisible = await page.locator('[id^="detail-row-"]').first().isVisible();
    if (detailVisible) ok('Tombol Detail audit log berhasil menampilkan data sebelum/sesudah');
    else bad('Detail audit log tidak muncul saat diklik');

    // --- Owner Panel: Kelola User ---
    await page.evaluate(() => { location.hash = '#/owner/users'; });
    await page.waitForSelector('#user-form', { timeout: 5000 });
    await page.fill('#user-nama', 'Kasir Baru E2E');
    await page.fill('#user-username', 'kasirbaru');
    await page.selectOption('#user-role', 'Kasir');
    await page.fill('#user-password', 'password123');
    await page.click('#user-submit');
    await waitForToastContaining(page, 'berhasil disimpan');
    const userBody = await page.locator('#user-body').innerText();
    if (userBody.includes('kasirbaru')) ok('Owner berhasil membuat akun Kasir baru lewat Kelola User');
    else bad('Akun baru tidak muncul di daftar user: ' + userBody);

    // --- Owner Panel: Kelola Transaksi (edit + delete + restore) ---
    await page.evaluate(() => { location.hash = '#/owner/transaksi'; });
    await page.waitForSelector('#trx-body tr', { timeout: 5000 });
    await page.click('.edit-btn >> nth=0');
    await page.waitForSelector('#edit-form', { timeout: 5000 });
    await page.fill('#edit-diskon', '5000');
    await page.click('#edit-form button[type="submit"]');
    await waitForToastContaining(page, 'berhasil diperbarui');
    ok('Owner Panel berhasil mengedit diskon transaksi');

    await page.click('.delete-btn >> nth=0');
    await waitForToastContaining(page, 'dihapus');
    const afterDeleteText = await page.locator('#trx-body').innerText();
    if (afterDeleteText.includes('Ya')) ok('Transaksi berhasil dihapus (soft-delete, ditandai "Ya" pada kolom Dihapus)');
    else bad('Transaksi seharusnya tertanda terhapus: ' + afterDeleteText);

    await page.click('.restore-btn >> nth=0');
    await waitForToastContaining(page, 'dipulihkan');
    ok('Transaksi berhasil dipulihkan (restore)');

    // --- Owner Panel: Backup & Restore ---
    await page.evaluate(() => { location.hash = '#/owner/backup'; });
    await page.waitForSelector('#backup-btn', { timeout: 5000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#backup-btn')
    ]);
    const downloadPath = path.join(os.tmpdir(), 'e2e-backup-test.json');
    await download.saveAs(downloadPath);
    const backupContent = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
    if (backupContent.sheets && backupContent.sheets['Transaksi Barber'] && backupContent.sheets['Transaksi Barber'].length > 0) {
      ok('File backup terunduh berisi data transaksi yang valid');
    } else {
      bad('File backup tidak berisi data yang diharapkan');
    }
    if (backupContent.sheets['Kasir'].every((u) => !u.PasswordHash)) ok('File backup TIDAK menyertakan PasswordHash akun manapun');
    else bad('File backup seharusnya tidak menyertakan kredensial password');

    await page.setInputFiles('#restore-file', downloadPath);
    await page.waitForSelector('#restore-btn:not([disabled])', { timeout: 5000 });
    await page.click('#restore-btn');
    await waitForToastContaining(page, 'Restore berhasil');
    ok('Restore dari file backup yang baru diunduh berhasil (round-trip aman)');

    fs.unlinkSync(downloadPath);

    // Pastikan Owner masih bisa login setelah restore (Kasir tidak ikut ditimpa).
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });
    ok('Setelah restore, dashboard tetap bisa diakses (akun Owner tidak terdampak)');

    if (consoleErrors.length === 0) ok('Tidak ada console error sepanjang skenario');
    else bad('Console error terdeteksi: ' + JSON.stringify(consoleErrors));
  } catch (err) {
    bad('Exception saat E2E: ' + err.message);
    console.error(err);
    console.error('\n--- server log ---\n' + serverLog);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
