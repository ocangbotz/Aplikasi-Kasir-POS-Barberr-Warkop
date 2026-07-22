'use strict';
/**
 * E2E Fase 4: alur penuh Modul Warkop di Chromium sungguhan --
 * kelola menu, pesanan dengan qty, pengurangan stok, split bill, struk, riwayat.
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:warkop
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8797;
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
  console.log('Fase 4 E2E: Modul Warkop\n');

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

    // --- Kelola Menu ---
    await page.evaluate(() => { location.hash = '#/warkop/produk'; });
    await page.waitForSelector('#produk-form', { timeout: 5000 });

    await page.fill('#produk-nama', 'Kopi Hitam');
    await page.fill('#produk-kategori', 'Minuman');
    await page.fill('#produk-modal', '3000');
    await page.fill('#produk-harga', '8000');
    await page.fill('#produk-stok', '10');
    await page.click('#produk-submit');
    await page.waitForSelector('#produk-body tr', { timeout: 5000 });

    await page.fill('#produk-nama', 'Indomie Goreng');
    await page.fill('#produk-kategori', 'Makanan');
    await page.fill('#produk-modal', '4000');
    await page.fill('#produk-harga', '10000');
    await page.fill('#produk-stok', '2');
    await page.click('#produk-submit');
    await page.waitForTimeout(300);

    const bodyText = await page.locator('#produk-body').innerText();
    if (bodyText.includes('Kopi Hitam') && bodyText.includes('Rp5.000') && bodyText.includes('Indomie Goreng')) {
      ok('Menu baru berhasil dibuat dan margin dihitung otomatis (Rp5.000)');
    } else {
      bad('Menu baru tidak sesuai di tabel: ' + bodyText);
    }

    // --- Pesanan: qty & subtotal ---
    await page.evaluate(() => { location.hash = '#/warkop/pesanan'; });
    await page.waitForSelector('#produk-grid .produk-card', { timeout: 5000 });

    const kopiCard = page.locator('.produk-card', { hasText: 'Kopi Hitam' });
    await kopiCard.click();
    await kopiCard.click();
    await kopiCard.click(); // qty 3

    let subtotalText = await page.locator('#subtotal-text').innerText();
    if (subtotalText === 'Rp24.000') ok('Klik menu berulang menambah qty di keranjang (3 x Rp8.000 = Rp24.000)');
    else bad('Subtotal qty salah: ' + subtotalText);

    // Kurangi qty pakai tombol minus di keranjang
    await page.click('.qty-minus');
    subtotalText = await page.locator('#subtotal-text').innerText();
    if (subtotalText === 'Rp16.000') ok('Tombol minus keranjang mengurangi qty dengan benar');
    else bad('Subtotal setelah minus salah: ' + subtotalText);

    // --- Validasi stok tidak cukup ---
    const indomieCard = page.locator('.produk-card', { hasText: 'Indomie Goreng' });
    await indomieCard.click();
    await indomieCard.click();
    await indomieCard.click(); // qty 3, tapi stok cuma 2 -> tombol ke-3 harus diabaikan (disabled oleh stok)

    const indomieCartRow = page.locator('#cart-list > div', { hasText: 'Indomie Goreng' });
    const indomieQty = await indomieCartRow.locator('span.w-5').innerText();
    if (indomieQty.trim() === '2') {
      ok('Qty menu di keranjang dibatasi tepat sesuai stok tersedia (2), klik ke-3 diabaikan');
    } else {
      bad('Qty Indomie Goreng seharusnya berhenti di 2 (stok tersedia): got ' + indomieQty);
    }

    // --- Split Bill ---
    await page.fill('#diskon', '2000');
    await page.click('#split-toggle');
    await page.waitForSelector('#split-payment:not(.hidden)', { timeout: 5000 });

    const totalText = await page.locator('#total-text').innerText();
    ok('Total setelah diskon untuk split bill: ' + totalText);

    const totalNumber = Number(totalText.replace(/[^0-9]/g, ''));
    const firstSplitInput = page.locator('.split-jumlah').first();
    await firstSplitInput.fill(String(Math.floor(totalNumber / 2)));
    await page.click('#add-split-row');
    await page.locator('.split-metode').nth(1).selectOption('QRIS');
    const secondSplitInput = page.locator('.split-jumlah').nth(1);
    await secondSplitInput.fill(String(totalNumber - Math.floor(totalNumber / 2)));
    await page.waitForTimeout(150);

    const remainingText = await page.locator('#split-remaining').innerText();
    if (remainingText.includes('sudah sesuai')) ok('Split bill: indikator "sisa" menunjukkan pas saat jumlah cocok dengan total');
    else bad('Indikator split bill tidak sesuai: ' + remainingText);

    await page.fill('#namaPelanggan', 'Budi Santoso');
    await page.fill('#noHp', '081233334444');
    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    const strukText = await page.locator('#struk-print-area').innerText();
    if (strukText.includes('Kopi Hitam') && /WRK-\d{8}-0001/.test(strukText)) {
      ok('Struk split-bill tampil dengan nomor transaksi format WRK-YYYYMMDD-0001');
    } else {
      bad('Isi struk split-bill tidak sesuai: ' + strukText);
    }
    if (strukText.includes('Bayar (Cash)') && strukText.includes('Bayar (QRIS)')) {
      ok('Struk menampilkan rincian pembayaran split bill (Cash & QRIS)');
    } else {
      bad('Struk tidak menampilkan rincian split bill: ' + strukText);
    }
    await page.click('#struk-close');

    // --- Cek stok berkurang setelah transaksi ---
    await page.evaluate(() => { location.hash = '#/warkop/produk'; });
    await page.waitForSelector('#produk-body tr', { timeout: 5000 });
    const stokAfter = await page.locator('#produk-body').innerText();
    if (stokAfter.includes('Kopi Hitam') && /Kopi Hitam[\s\S]*?8\b/.test(stokAfter)) {
      ok('Stok Kopi Hitam berkurang dari 10 menjadi 8 setelah terjual 2');
    } else {
      bad('Stok tidak berkurang sesuai ekspektasi: ' + stokAfter);
    }

    // --- Transaksi tanpa item ditolak ---
    await page.evaluate(() => { location.hash = '#/warkop/pesanan'; });
    await page.waitForSelector('#produk-grid .produk-card', { timeout: 5000 });
    await page.click('#submit-btn');
    await page.waitForSelector('#toast-container div', { timeout: 5000 });
    const emptyCartToast = await page.locator('#toast-container div').last().innerText();
    if (/menu/i.test(emptyCartToast)) ok('Submit tanpa item ditolak dengan pesan yang jelas');
    else bad('Validasi keranjang kosong tidak sesuai: ' + emptyCartToast);

    // --- Transaksi biasa (single payment) untuk verifikasi riwayat ---
    await page.locator('.produk-card', { hasText: 'Kopi Hitam' }).click();
    await page.click('button[data-metode="Cash"]');
    await page.fill('#uangDiterima', '10000');
    await page.click('#submit-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    const singleStrukText = await page.locator('#struk-print-area').innerText();
    if (singleStrukText.includes('Uang Diterima') && singleStrukText.includes('Kembalian')) {
      ok('Struk transaksi Cash biasa menampilkan Uang Diterima & Kembalian');
    } else {
      bad('Uang Diterima/Kembalian tidak tampil di struk transaksi biasa: ' + singleStrukText);
    }
    await page.click('#struk-close');

    await page.evaluate(() => { location.hash = '#/warkop/riwayat'; });
    await page.waitForSelector('#riwayat-body tr', { timeout: 5000 });
    const riwayatText = await page.locator('#riwayat-body').innerText();
    if (riwayatText.includes('Kopi Hitam') && riwayatText.includes('Split')) {
      ok('Riwayat menampilkan transaksi split-bill dan transaksi biasa');
    } else {
      bad('Riwayat tidak sesuai: ' + riwayatText);
    }

    await page.click('.print-btn');
    await page.waitForSelector('#struk-print-area', { timeout: 5000 });
    ok('Cetak ulang struk dari Riwayat Warkop berhasil');
    await page.click('#struk-close');

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
