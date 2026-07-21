'use strict';
/**
 * E2E Fase 3: alur penuh Modul Barber di Chromium sungguhan --
 * kelola layanan & capster, buat transaksi (POS), cetak struk, dan riwayat.
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:barber
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8798;
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

async function login(page, username, password) {
  await page.goto(BASE + '/');
  await page.waitForSelector('#login-form', { timeout: 5000 });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#page-content', { timeout: 5000 });
}

async function main() {
  console.log('Fase 3 E2E: Modul Barber\n');

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

    // --- Kelola Layanan ---
    await page.evaluate(() => { location.hash = '#/barber/layanan'; });
    await page.waitForSelector('#layanan-form', { timeout: 5000 });
    await page.fill('#layanan-nama', 'Potong Rambut Dewasa');
    await page.fill('#layanan-harga', '30000');
    await page.fill('#layanan-durasi', '30');
    await page.click('#layanan-submit');
    await page.waitForSelector('#layanan-body tr', { timeout: 5000 });
    let rowText = await page.locator('#layanan-body').innerText();
    if (rowText.includes('Potong Rambut Dewasa') && rowText.includes('Rp30.000')) ok('Layanan baru berhasil dibuat & tampil di tabel');
    else bad('Layanan baru tidak muncul di tabel: ' + rowText);

    await page.fill('#layanan-nama', 'Cukur Jenggot');
    await page.fill('#layanan-harga', '15000');
    await page.click('#layanan-submit');
    await page.waitForTimeout(300);

    // --- Kelola Capster ---
    await page.evaluate(() => { location.hash = '#/barber/capster'; });
    await page.waitForSelector('#capster-form', { timeout: 5000 });
    await page.fill('#capster-nama', 'Rizky');
    await page.fill('#capster-nohp', '081298765432');
    await page.fill('#capster-persentase', '50');
    await page.click('#capster-submit');
    await page.waitForSelector('#capster-body tr', { timeout: 5000 });
    rowText = await page.locator('#capster-body').innerText();
    if (rowText.includes('Rizky') && rowText.includes('50%')) ok('Capster baru berhasil dibuat & tampil di tabel');
    else bad('Capster baru tidak muncul di tabel: ' + rowText);

    // --- Transaksi POS ---
    await page.evaluate(() => { location.hash = '#/barber/transaksi'; });
    await page.waitForSelector('#layanan-grid .layanan-card', { timeout: 5000 });

    const cards = page.locator('#layanan-grid .layanan-card');
    const cardCount = await cards.count();
    if (cardCount >= 2) ok('Grid layanan menampilkan layanan yang baru dibuat (' + cardCount + ' item)');
    else bad('Grid layanan tidak menampilkan cukup item: ' + cardCount);

    await cards.filter({ hasText: 'Potong Rambut Dewasa' }).click();
    await cards.filter({ hasText: 'Cukur Jenggot' }).click();

    const cartText = await page.locator('#cart-list').innerText();
    if (cartText.includes('Potong Rambut Dewasa') && cartText.includes('Cukur Jenggot')) ok('Kedua layanan masuk ke keranjang');
    else bad('Keranjang tidak sesuai: ' + cartText);

    const subtotalText = await page.locator('#subtotal-text').innerText();
    if (subtotalText === 'Rp45.000') ok('Subtotal keranjang dihitung benar: ' + subtotalText);
    else bad('Subtotal salah: ' + subtotalText);

    await page.fill('#diskon', '5000');
    await page.waitForTimeout(100);
    const totalText = await page.locator('#total-text').innerText();
    if (totalText === 'Rp40.000') ok('Total setelah diskon dihitung benar: ' + totalText);
    else bad('Total setelah diskon salah: ' + totalText);

    await page.fill('#namaPelanggan', 'Doni Pratama');
    await page.fill('#noHp', '081211223344');
    await page.selectOption('#capsterId', { label: 'Rizky' });
    await page.click('button[data-metode="Cash"]');
    const cashClass = await page.locator('button[data-metode="Cash"]').getAttribute('class');
    const qrisClass = await page.locator('button[data-metode="QRIS"]').getAttribute('class');
    if (cashClass.includes('selected') && !qrisClass.includes('selected')) {
      ok('Tombol metode pembayaran menandai Cash sebagai terpilih (QRIS tidak)');
    } else {
      bad('State terpilih tombol metode pembayaran salah: cash="' + cashClass + '" qris="' + qrisClass + '"');
    }

    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    const strukText = await page.locator('#struk-print-area').innerText();
    if (strukText.includes('Doni Pratama') && strukText.includes('Rizky') && strukText.includes('Rp40.000')) {
      ok('Struk tampil dengan data transaksi yang benar (pelanggan, capster, total)');
    } else {
      bad('Isi struk tidak sesuai: ' + strukText);
    }
    if (/BRB-\d{8}-0001/.test(strukText)) ok('Nomor transaksi mengikuti format BRB-YYYYMMDD-0001');
    else bad('Format nomor transaksi tidak sesuai: ' + strukText);

    await page.click('#struk-close');
    await page.waitForSelector('#struk-print-area', { state: 'detached', timeout: 5000 });
    ok('Modal struk bisa ditutup');

    // Keranjang & form harus ter-reset setelah transaksi sukses
    const cartAfter = await page.locator('#cart-list').innerText();
    const namaAfter = await page.inputValue('#namaPelanggan');
    if (cartAfter.includes('Belum ada layanan') && namaAfter === '') ok('Form & keranjang ter-reset otomatis setelah transaksi sukses');
    else bad('Form/keranjang tidak ter-reset: cart="' + cartAfter + '" nama="' + namaAfter + '"');

    // --- Validasi: transaksi tanpa metode pembayaran ditolak di UI ---
    await cards.first().click();
    await page.fill('#namaPelanggan', 'Tanpa Bayar');
    await page.click('#submit-btn');
    await page.waitForSelector('#toast-container div', { timeout: 5000 });
    const toastText = await page.locator('#toast-container div').last().innerText();
    if (/metode pembayaran/i.test(toastText)) ok('Submit tanpa metode pembayaran ditolak dengan pesan yang jelas');
    else bad('Validasi metode pembayaran tidak sesuai: ' + toastText);

    // --- Riwayat & cetak ulang ---
    await page.evaluate(() => { location.hash = '#/barber/riwayat'; });
    await page.waitForSelector('#riwayat-body tr', { timeout: 5000 });
    const riwayatText = await page.locator('#riwayat-body').innerText();
    if (riwayatText.includes('Doni Pratama') && riwayatText.includes('Rp40.000')) ok('Transaksi yang baru dibuat muncul di Riwayat');
    else bad('Riwayat tidak menampilkan transaksi terbaru: ' + riwayatText);

    await page.click('.print-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    ok('Cetak ulang struk dari halaman Riwayat berhasil membuka modal struk');
    await page.click('#struk-close');

    // --- Permission: Kasir tidak melihat menu Layanan/Capster di sidebar ---
    await page.click('#user-menu-btn');
    await page.click('#logout-btn');
    await page.waitForSelector('#login-form', { timeout: 5000 });

    // Buat akun kasir lewat Owner belum ada UI kelola user (Fase 7) -- pakai endpoint dev untuk seed cepat tidak tersedia,
    // jadi kita uji permission langsung lewat route guard: akses manual ke /barber/layanan tanpa login harus lempar ke /login (sudah diuji di Fase 2).
    // Di sini cukup pastikan sidebar Owner menampilkan seluruh menu Barber (karena Owner all:true).
    await login(page, 'owner', cred.password);
    const navText = await page.locator('#nav-list').innerText();
    if (['Transaksi', 'Riwayat', 'Layanan', 'Capster'].every((label) => navText.includes(label))) {
      ok('Sidebar Owner menampilkan seluruh menu Barber (Transaksi/Riwayat/Layanan/Capster)');
    } else {
      bad('Sidebar Owner tidak lengkap: ' + navText);
    }

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
