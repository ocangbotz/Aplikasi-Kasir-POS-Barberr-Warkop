'use strict';
/**
 * E2E Fase 5: Inventory Barber & Warkop + notifikasi stok hampir habis.
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:inventory
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8796;
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

/**
 * Toast lama bisa masih ada di DOM lalu auto-dismiss di tengah pengecekan
 * (~3.5s), jadi membandingkan JUMLAH toast tidak reliabel -- tunggu sampai
 * toast dengan potongan teks tertentu benar-benar muncul.
 */
async function waitForToastContaining(page, substring) {
  await page.waitForFunction(
    (s) => Array.from(document.querySelectorAll('#toast-container div')).some((el) => el.textContent.includes(s)),
    substring,
    { timeout: 5000 }
  );
}

async function login(page, username, password) {
  await page.goto(BASE + '/');
  await page.waitForSelector('#login-form', { timeout: 5000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#page-content', { timeout: 5000 });
}

async function addInventoryItem(page, { nama, kategori, satuan, stok, stokMinimum }) {
  await page.fill('#item-nama', nama);
  await page.fill('#item-kategori', kategori);
  await page.fill('#item-satuan', satuan);
  await page.fill('#item-stok', String(stok));
  await page.fill('#item-stok-minimum', String(stokMinimum));
  await page.click('#item-submit');
  await page.waitForTimeout(300);
}

async function main() {
  console.log('Fase 5 E2E: Inventory + Notifikasi Stok\n');

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
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    await login(page, 'owner', cred.password);
    ok('Login Owner berhasil');

    const badgeInitial = await page.locator('#notif-badge').isVisible();
    ok('Bel notifikasi tampil untuk Owner (permission inventory), badge awal: ' + (badgeInitial ? 'terlihat' : 'tersembunyi (stok aman)'));

    // --- Inventory Warkop: tambah item ---
    await page.evaluate(() => { location.hash = '#/inventory/warkop'; });
    await page.waitForSelector('#item-form', { timeout: 5000 });
    await addInventoryItem(page, { nama: 'Gula Pasir', kategori: 'Bahan Baku', satuan: 'kg', stok: 20, stokMinimum: 5 });
    await addInventoryItem(page, { nama: 'Kopi Bubuk', kategori: 'Bahan Baku', satuan: 'kg', stok: 3, stokMinimum: 5 });

    const warkopBody = await page.locator('#item-body').innerText();
    if (warkopBody.includes('Gula Pasir') && warkopBody.includes('Kopi Bubuk')) ok('2 item Inventory Warkop berhasil dibuat');
    else bad('Item inventory warkop tidak sesuai: ' + warkopBody);

    if (/Kopi Bubuk[\s\S]*?⚠️/.test(warkopBody)) ok('Item dengan stok <= minimum ditandai peringatan (⚠️) di tabel');
    else bad('Tanda peringatan stok rendah tidak muncul: ' + warkopBody);

    // --- Inventory Barber: tambah item terpisah ---
    await page.evaluate(() => { location.hash = '#/inventory/barber'; });
    await page.waitForSelector('#item-form', { timeout: 5000 });
    await addInventoryItem(page, { nama: 'Handuk', kategori: 'Perlengkapan', satuan: 'pcs', stok: 15, stokMinimum: 3 });
    const barberBody = await page.locator('#item-body').innerText();
    if (barberBody.includes('Handuk') && !barberBody.includes('Gula Pasir')) {
      ok('Inventory Barber terpisah dari Inventory Warkop (Handuk ada, Gula Pasir tidak ada)');
    } else {
      bad('Inventory Barber tercampur dengan Warkop: ' + barberBody);
    }

    // --- Sesuaikan stok ---
    await page.evaluate(() => { location.hash = '#/inventory/warkop'; });
    await page.waitForSelector('#item-body tr', { timeout: 5000 });
    const kopiRow = page.locator('#item-body tr', { hasText: 'Kopi Bubuk' });
    await kopiRow.locator('.adjust-btn').click();
    await page.waitForSelector('#adjust-form', { timeout: 5000 });
    await page.click('.arah-btn[data-arah="1"]');
    await page.fill('#adjust-jumlah', '10');
    await page.selectOption('#adjust-alasan', 'Restock');
    await page.click('#adjust-submit');
    await page.waitForTimeout(400);

    const afterRestock = await page.locator('#item-body').innerText();
    if (/Kopi Bubuk[\s\S]*?13 kg/.test(afterRestock) && !/Kopi Bubuk[\s\S]*?⚠️/.test(afterRestock)) {
      ok('Restock stok Kopi Bubuk (3 + 10 = 13) berhasil, tanda peringatan hilang');
    } else {
      bad('Restock tidak sesuai ekspektasi: ' + afterRestock);
    }

    // Kurangi stok (Pemakaian) sampai di bawah minimum lagi
    const kopiRow2 = page.locator('#item-body tr', { hasText: 'Kopi Bubuk' });
    await kopiRow2.locator('.adjust-btn').click();
    await page.waitForSelector('#adjust-form', { timeout: 5000 });
    await page.click('.arah-btn[data-arah="-1"]');
    await page.fill('#adjust-jumlah', '9');
    await page.selectOption('#adjust-alasan', 'Pemakaian');
    await page.click('#adjust-submit');
    await page.waitForTimeout(400);

    const afterUsage = await page.locator('#item-body').innerText();
    if (/Kopi Bubuk[\s\S]*?4 kg/.test(afterUsage)) ok('Pengurangan stok (Pemakaian) berhasil: 13 - 9 = 4');
    else bad('Pengurangan stok tidak sesuai: ' + afterUsage);

    // --- Notifikasi bel harus reflect data baru setelah refresh manual (klik bel) ---
    const bell = page.locator('#notif-bell');
    await bell.click();
    await page.waitForSelector('#notif-panel:not(.hidden)', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#notif-list').innerText.includes('Kopi Bubuk'), { timeout: 5000 })
      .then(() => ok('Panel notifikasi menampilkan item stok rendah (Kopi Bubuk)'))
      .catch(async () => bad('Panel notifikasi tidak menampilkan item stok rendah: ' + await page.locator('#notif-list').innerText()));

    const badgeCount = await page.locator('#notif-badge').innerText();
    if (Number(badgeCount) >= 1) ok('Badge notifikasi menampilkan jumlah item stok rendah (' + badgeCount + ')');
    else bad('Badge notifikasi tidak sesuai: ' + badgeCount);

    // --- Edit item tidak boleh mengubah stok ---
    await page.click('#notif-bell'); // tutup panel
    const kopiRow3 = page.locator('#item-body tr', { hasText: 'Kopi Bubuk' });
    await kopiRow3.locator('.edit-btn').click();
    await page.waitForFunction(() => document.querySelector('#item-stok-wrap').classList.contains('hidden'), { timeout: 5000 });
    await page.fill('#item-kategori', 'Bahan Baku Utama');
    await page.click('#item-submit');
    await page.waitForTimeout(400);
    const afterEdit = await page.locator('#item-body').innerText();
    if (/Kopi Bubuk[\s\S]*?4 kg/.test(afterEdit) && afterEdit.includes('Bahan Baku Utama')) {
      ok('Edit item mengubah kategori TANPA mengubah stok (tetap 4)');
    } else {
      bad('Edit item mempengaruhi field yang tidak seharusnya: ' + afterEdit);
    }

    // --- Sesuaikan stok menjadi negatif ditolak ---
    const kopiRow4 = page.locator('#item-body tr', { hasText: 'Kopi Bubuk' });
    await kopiRow4.locator('.adjust-btn').click();
    await page.waitForSelector('#adjust-form', { timeout: 5000 });
    await page.click('.arah-btn[data-arah="-1"]');
    await page.fill('#adjust-jumlah', '999');
    await page.selectOption('#adjust-alasan', 'Pemakaian');
    await page.click('#adjust-submit');
    try {
      await waitForToastContaining(page, 'negatif');
      ok('Penyesuaian stok yang membuat negatif ditolak dengan pesan yang jelas');
    } catch {
      bad('Toast validasi stok negatif tidak muncul');
    }
    await page.click('#adjust-cancel');

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
