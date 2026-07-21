'use strict';
/**
 * E2E Fase 8: Laporan (filter usaha + tabel + ekspor PDF/Excel/CSV/Print).
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:laporan
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
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

async function main() {
  console.log('Fase 8 E2E: Laporan + Ekspor PDF/Excel/CSV/Print\n');

  const server = spawn(process.execPath, [DEV_SERVER], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  let browser;
  const downloadedFiles = [];
  try {
    await waitForServer(`${BASE}/api?action=ping`);
    const credRes = await fetch(`${BASE}/__dev/owner-credentials`);
    const cred = await credRes.json();

    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    await page.goto(BASE + '/');
    await page.waitForSelector('#login-form', { timeout: 5000 });
    await page.fill('#username', 'owner');
    await page.fill('#password', cred.password);
    await page.click('#login-submit');
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });

    // --- Seed: 1 transaksi Barber Rp30.000 Cash ---
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

    await page.evaluate(() => { location.hash = '#/barber/transaksi'; });
    await page.waitForSelector('#layanan-grid .layanan-card', { timeout: 5000 });
    await page.click('#layanan-grid .layanan-card');
    await page.fill('#namaPelanggan', 'Budi Laporan Test');
    await page.selectOption('#capsterId', { label: 'Rizky' });
    await page.click('button[data-metode="Cash"]');
    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    await page.click('#struk-close');

    // --- Seed: 1 transaksi Warkop Rp8.000 Cash ---
    await page.evaluate(() => { location.hash = '#/warkop/produk'; });
    await page.waitForSelector('#produk-form', { timeout: 5000 });
    await page.fill('#produk-nama', 'Kopi Hitam');
    await page.fill('#produk-kategori', 'Minuman');
    await page.fill('#produk-modal', '3000');
    await page.fill('#produk-harga', '8000');
    await page.fill('#produk-stok', '10');
    await page.click('#produk-submit');
    await page.waitForSelector('#produk-body tr', { timeout: 5000 });

    await page.evaluate(() => { location.hash = '#/warkop/pesanan'; });
    await page.waitForSelector('#produk-grid .produk-card', { timeout: 5000 });
    await page.locator('.produk-card', { hasText: 'Kopi Hitam' }).click();
    await page.click('button[data-metode="Cash"]');
    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    await page.click('#struk-close');

    // --- Seed: pengeluaran Barber Rp10.000 ---
    await page.evaluate(() => { location.hash = '#/pengeluaran/barber'; });
    await page.waitForSelector('#pengeluaran-form', { timeout: 5000 });
    await page.fill('#pengeluaran-nominal', '10000');
    await page.selectOption('#pengeluaran-kategori', 'Operasional');
    await page.click('#pengeluaran-submit');
    await page.waitForTimeout(300);

    // --- Laporan: Gabungan ---
    await page.evaluate(() => { location.hash = '#/laporan'; });
    await page.waitForSelector('#laporan-rows', { timeout: 5000 });
    await page.waitForTimeout(300);

    const rowCountGabungan = await page.locator('#laporan-rows tr').count();
    if (rowCountGabungan === 2) ok('Laporan Gabungan menampilkan 2 transaksi (Barber + Warkop)');
    else bad('Jumlah baris Gabungan tidak sesuai: ' + rowCountGabungan);

    const rowCountLabel = await page.locator('#row-count').innerText();
    if (rowCountLabel.includes('2')) ok('Label jumlah transaksi menunjukkan "2 transaksi"');
    else bad('Label jumlah transaksi tidak sesuai: ' + rowCountLabel);

    const pendapatanCard = page.locator('#cards-periode .glass-card', { hasText: 'Pendapatan' });
    const pendapatanText = await pendapatanCard.locator('p.text-xl').innerText();
    const pendapatanNum = Number(pendapatanText.replace(/[^0-9-]/g, ''));
    if (pendapatanNum === 38000) ok('Ringkasan Pendapatan Gabungan = Rp38.000 (30.000 + 8.000)');
    else bad('Pendapatan Gabungan tidak sesuai: ' + pendapatanNum);

    // --- Laporan: filter usaha Barber ---
    await page.click('.usaha-tab[data-usaha="Barber"]');
    await page.waitForTimeout(300);
    const rowCountBarber = await page.locator('#laporan-rows tr').count();
    if (rowCountBarber === 1) ok('Filter usaha "Barber" hanya menampilkan 1 transaksi Barber');
    else bad('Jumlah baris Barber tidak sesuai: ' + rowCountBarber);
    const barberRowText = await page.locator('#laporan-rows').innerText();
    if (barberRowText.includes('Budi Laporan Test') && barberRowText.includes('Rizky')) {
      ok('Baris Barber menampilkan deskripsi pelanggan & capster dengan benar');
    } else bad('Deskripsi baris Barber tidak sesuai: ' + barberRowText);

    // --- Laporan: filter usaha Warkop ---
    await page.click('.usaha-tab[data-usaha="Warkop"]');
    await page.waitForTimeout(300);
    const rowCountWarkop = await page.locator('#laporan-rows tr').count();
    if (rowCountWarkop === 1) ok('Filter usaha "Warkop" hanya menampilkan 1 transaksi Warkop');
    else bad('Jumlah baris Warkop tidak sesuai: ' + rowCountWarkop);
    const warkopRowText = await page.locator('#laporan-rows').innerText();
    if (warkopRowText.includes('Kopi Hitam')) ok('Baris Warkop menampilkan deskripsi item dengan benar');
    else bad('Deskripsi baris Warkop tidak sesuai: ' + warkopRowText);

    // --- Kembali ke Gabungan untuk uji ekspor ---
    await page.click('.usaha-tab[data-usaha="Gabungan"]');
    await page.waitForTimeout(300);

    // --- Ekspor CSV ---
    {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#export-csv')
      ]);
      const fileName = download.suggestedFilename();
      const filePath = path.join('/tmp', fileName);
      await download.saveAs(filePath);
      downloadedFiles.push(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      if (fileName.endsWith('.csv') && content.includes('Budi Laporan Test') && content.includes('Kopi Hitam')) {
        ok('Ekspor CSV berhasil, berisi baris Barber & Warkop: ' + fileName);
      } else bad('Ekspor CSV tidak sesuai isi/nama file: ' + fileName);
    }

    // --- Ekspor Excel ---
    {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#export-excel')
      ]);
      const fileName = download.suggestedFilename();
      const filePath = path.join('/tmp', fileName);
      await download.saveAs(filePath);
      downloadedFiles.push(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      if (fileName.endsWith('.xls') && content.includes('<table') && content.includes('Kopi Hitam')) {
        ok('Ekspor Excel (.xls) berhasil, berisi tabel HTML dengan data transaksi: ' + fileName);
      } else bad('Ekspor Excel tidak sesuai isi/nama file: ' + fileName);
    }

    // --- Ekspor PDF ---
    {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#export-pdf')
      ]);
      const fileName = download.suggestedFilename();
      const filePath = path.join('/tmp', fileName);
      await download.saveAs(filePath);
      downloadedFiles.push(filePath);
      const stat = fs.statSync(filePath);
      const header = fs.readFileSync(filePath).subarray(0, 5).toString('utf8');
      if (fileName.endsWith('.pdf') && header === '%PDF-' && stat.size > 1000) {
        ok('Ekspor PDF berhasil, file valid (header %PDF-, ukuran ' + stat.size + ' bytes): ' + fileName);
      } else bad('Ekspor PDF tidak valid: ' + fileName + ' header=' + header + ' size=' + stat.size);
    }

    // --- Cetak (Print) ---
    await page.click('#export-print');
    await page.waitForTimeout(300);
    ok('Tombol Cetak diklik tanpa error (window.print dipanggil)');

    if (consoleErrors.length === 0) ok('Tidak ada console error sepanjang skenario Laporan');
    else bad('Console error terdeteksi: ' + JSON.stringify(consoleErrors));
  } catch (err) {
    bad('Exception saat E2E: ' + err.message);
    console.error(err);
    console.error('\n--- server log ---\n' + serverLog);
  } finally {
    if (browser) await browser.close();
    server.kill();
    downloadedFiles.forEach((f) => { try { fs.unlinkSync(f); } catch (e) { /* ignore */ } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
