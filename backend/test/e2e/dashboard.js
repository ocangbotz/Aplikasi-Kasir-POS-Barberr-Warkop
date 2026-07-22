'use strict';
/**
 * E2E Fase 6: Dashboard Gabungan/Barber/Warkop + filter + Chart.js.
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:dashboard
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8795;
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

function rupiahToNumber(text) {
  return Number(text.replace(/[^0-9-]/g, ''));
}

async function cardValue(page, sectionId, label) {
  const card = page.locator(`#${sectionId} .glass-card`, { hasText: label });
  const text = await card.locator('p.text-xl').innerText();
  return rupiahToNumber(text);
}

async function main() {
  console.log('Fase 6 E2E: Dashboard + Chart.js + Filter\n');

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

    await page.goto(BASE + '/');
    await page.waitForSelector('#login-form', { timeout: 5000 });
    await page.fill('#username', 'owner');
    await page.fill('#password', cred.password);
    await page.click('#login-submit');
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });
    ok('Login mengarahkan langsung ke Dashboard Gabungan (rute "/")');

    // Regresi: login() sempat memicu DUA render rute '/' yang bersamaan
    // (authStore subscription + navigate('/') eksplisit di login.js), membuat
    // Chart.js gagal ("Canvas is already in use") dan menampilkan toast error
    // yang tidak diuji oleh skenario manapun. Pastikan tidak ada toast error
    // muncul tak lama setelah landing di dashboard.
    await page.waitForTimeout(500);
    const strayToastTexts = await page.locator('#toast-container div').allInnerTexts();
    if (strayToastTexts.length === 0) ok('Tidak ada toast error tak terduga segera setelah login mendarat di dashboard');
    else bad('Toast tak terduga muncul setelah login: ' + JSON.stringify(strayToastTexts));

    const chartCanvasCount = await page.locator('#chart-pendapatan').count();
    if (chartCanvasCount === 1) ok('Hanya ada satu instance canvas grafik pendapatan (tidak ada render rute ganda)');
    else bad('Jumlah canvas #chart-pendapatan tidak sesuai: ' + chartCanvasCount);

    // --- Seed: layanan + capster + 1 transaksi barber Rp30.000 Cash ---
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
    await page.fill('#namaPelanggan', 'Budi Dashboard Test');
    await page.selectOption('#capsterId', { label: 'Rizky' });
    await page.click('button[data-metode="Cash"]');
    await page.fill('#uangDiterima', '30000');
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

    // --- Dashboard Barber: verifikasi angka & Laba Bersih ---
    await page.evaluate(() => { location.hash = '#/dashboard/barber'; });
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });
    await page.waitForTimeout(300);

    const pendapatan = await cardValue(page, 'cards-hari-ini', 'Pendapatan');
    const pengeluaran = await cardValue(page, 'cards-hari-ini', 'Pengeluaran');
    const labaBersih = await cardValue(page, 'cards-hari-ini', 'Laba Bersih');
    if (pendapatan === 30000) ok('Kartu Pendapatan Hari Ini = Rp30.000 sesuai transaksi yang dibuat');
    else bad('Pendapatan Hari Ini tidak sesuai: ' + pendapatan);
    if (pengeluaran === 10000) ok('Kartu Pengeluaran Hari Ini = Rp10.000 sesuai input pengeluaran');
    else bad('Pengeluaran Hari Ini tidak sesuai: ' + pengeluaran);
    if (labaBersih === pendapatan - pengeluaran) ok('Laba Bersih = Pendapatan - Pengeluaran (Rp20.000)');
    else bad('Laba Bersih tidak sesuai perhitungan: ' + labaBersih);

    const totalKepalaCard = page.locator('#cards-hari-ini .glass-card', { hasText: 'Total Kepala' });
    const totalKepalaText = await totalKepalaCard.locator('p.text-xl').innerText();
    if (totalKepalaText.trim() === '1') ok('Total Kepala Hari Ini = 1 (1 transaksi = 1 pelanggan dilayani)');
    else bad('Total Kepala tidak sesuai: ' + totalKepalaText);

    const capsterLeaderboard = await page.locator('#leaderboard-capster').innerText();
    if (capsterLeaderboard.includes('Rizky')) ok('Capster Terlaris menampilkan Rizky');
    else bad('Capster Terlaris tidak sesuai: ' + capsterLeaderboard);

    const layananLeaderboard = await page.locator('#leaderboard-layanan').innerText();
    if (layananLeaderboard.includes('Potong Rambut')) ok('Layanan Terlaris menampilkan Potong Rambut');
    else bad('Layanan Terlaris tidak sesuai: ' + layananLeaderboard);

    // --- Dashboard Gabungan: harus sama dengan Barber (belum ada data Warkop) ---
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });
    await page.waitForTimeout(300);
    const gabunganPendapatan = await cardValue(page, 'cards-hari-ini', 'Pendapatan');
    if (gabunganPendapatan === 30000) ok('Dashboard Gabungan mencerminkan data Barber (belum ada transaksi Warkop)');
    else bad('Pendapatan Gabungan tidak sesuai: ' + gabunganPendapatan);

    // --- Filter: Kemarin harus menunjukkan Rp0 (tidak ada data historis) ---
    await page.click('.filter-chip[data-filter="yesterday"]');
    await page.waitForTimeout(400);
    const periodeLabel = await page.locator('#periode-label').innerText();
    ok('Filter "Kemarin" diterapkan, label periode: ' + periodeLabel);
    const kemarinPendapatan = await cardValue(page, 'cards-periode', 'Pendapatan');
    if (kemarinPendapatan === 0) ok('Kartu Periode Terpilih menunjukkan Rp0 untuk filter Kemarin (tidak ada transaksi kemarin)');
    else bad('Periode Kemarin seharusnya Rp0: ' + kemarinPendapatan);

    const hariIniPendapatanSetelahFilter = await cardValue(page, 'cards-hari-ini', 'Pendapatan');
    if (hariIniPendapatanSetelahFilter === 30000) ok('Kartu "Hari Ini" tidak berubah walau filter diganti ke Kemarin (sesuai desain)');
    else bad('Kartu Hari Ini seharusnya tetap tidak berubah oleh filter');

    // --- Filter custom ---
    await page.click('.filter-chip[data-filter="custom"]');
    await page.waitForSelector('#custom-range:not(.hidden)', { timeout: 5000 });
    await page.click('#custom-apply');
    await page.waitForTimeout(400);
    const customPendapatan = await cardValue(page, 'cards-periode', 'Pendapatan');
    if (customPendapatan === 30000) ok('Filter Custom (default hari ini-hari ini) menampilkan transaksi hari ini dengan benar');
    else bad('Filter custom tidak sesuai: ' + customPendapatan);

    // --- Dashboard Warkop: masih kosong ---
    await page.evaluate(() => { location.hash = '#/dashboard/warkop'; });
    await page.waitForSelector('#chart-pendapatan', { timeout: 5000 });
    await page.waitForTimeout(300);
    const warkopPendapatan = await cardValue(page, 'cards-hari-ini', 'Pendapatan');
    if (warkopPendapatan === 0) ok('Dashboard Warkop menunjukkan Rp0 (belum ada transaksi Warkop dibuat)');
    else bad('Dashboard Warkop seharusnya Rp0: ' + warkopPendapatan);

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
