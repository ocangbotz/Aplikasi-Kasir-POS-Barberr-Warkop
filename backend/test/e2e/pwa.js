'use strict';
/**
 * E2E Fase 9: PWA -- manifest, Service Worker (precache app-shell), ikon,
 * dan ketahanan navigasi saat offline.
 * Mandiri: menjalankan devServer.js sendiri di port terpisah.
 *
 * Jalankan: npm run test:e2e:pwa
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

async function main() {
  console.log('Fase 9 E2E: PWA (manifest, Service Worker, offline app-shell)\n');

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
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    // --- Manifest ---
    await page.goto(BASE + '/');
    const manifestHref = await page.evaluate(() => document.querySelector('link[rel="manifest"]')?.getAttribute('href'));
    if (manifestHref === './manifest.webmanifest') ok('Tag <link rel="manifest"> ada di index.html');
    else bad('Tag manifest tidak ditemukan/salah: ' + manifestHref);

    const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
    if (manifest.name === 'Kasir Barber & Warkop' && manifest.display === 'standalone') {
      ok('manifest.webmanifest valid: name & display=standalone sesuai');
    } else bad('Isi manifest tidak sesuai: ' + JSON.stringify(manifest));

    const iconSizes = (manifest.icons || []).map((i) => `${i.sizes}/${i.purpose}`).sort();
    const expected = ['192x192/any', '192x192/maskable', '512x512/any', '512x512/maskable'].sort();
    if (JSON.stringify(iconSizes) === JSON.stringify(expected)) {
      ok('Manifest berisi ikon 192/512 untuk purpose "any" dan "maskable"');
    } else bad('Daftar ikon manifest tidak sesuai: ' + JSON.stringify(iconSizes));

    // --- Semua file ikon benar-benar bisa diakses (bukan referensi rusak) ---
    const iconChecks = await page.evaluate(async (icons) => {
      const results = [];
      for (const icon of icons) {
        const res = await fetch(icon.src);
        results.push({ src: icon.src, ok: res.ok, contentType: res.headers.get('content-type') });
      }
      return results;
    }, manifest.icons);
    const brokenIcons = iconChecks.filter((r) => !r.ok || !(r.contentType || '').includes('image/png'));
    if (brokenIcons.length === 0) ok(`Semua ${iconChecks.length} file ikon PWA dapat diakses (image/png, 200 OK)`);
    else bad('Ikon rusak/tidak dapat diakses: ' + JSON.stringify(brokenIcons));

    const appleTouchIcon = await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'));
    const appleRes = await page.evaluate(async (href) => { const r = await fetch(href); return r.ok; }, appleTouchIcon);
    if (appleRes) ok('apple-touch-icon.png dapat diakses');
    else bad('apple-touch-icon.png tidak dapat diakses');

    // --- Service Worker terdaftar & aktif ---
    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      const reg = await navigator.serviceWorker.ready;
      return { supported: true, scope: reg.scope, hasActive: !!reg.active };
    });
    if (swReady.supported && swReady.hasActive) ok('Service Worker terdaftar & aktif, scope: ' + swReady.scope);
    else bad('Service Worker tidak aktif: ' + JSON.stringify(swReady));

    const cacheHasShell = await page.evaluate(async () => {
      const keys = await caches.keys();
      if (keys.length === 0) return { hasCacheKey: false };
      const cache = await caches.open(keys[0]);
      const match = await cache.match('./index.html');
      return { hasCacheKey: true, cacheName: keys[0], indexCached: !!match };
    });
    if (cacheHasShell.hasCacheKey && cacheHasShell.indexCached) {
      ok('Cache Storage berisi index.html ter-precache (cache: ' + cacheHasShell.cacheName + ')');
    } else bad('index.html tidak ditemukan di Cache Storage: ' + JSON.stringify(cacheHasShell));

    // --- Tombol Install App wired (tersembunyi sampai beforeinstallprompt) ---
    await page.fill('#username', 'owner');
    await page.fill('#password', cred.password);
    await page.click('#login-submit');
    await page.waitForSelector('#page-content', { timeout: 5000 });

    const installBtnHidden = await page.evaluate(() => document.getElementById('install-app-btn')?.classList.contains('hidden'));
    if (installBtnHidden === true) ok('Tombol "Install App" ada di topbar, tersembunyi sampai browser menawarkan prompt install');
    else bad('Tombol Install App tidak sesuai kondisi awal: hidden=' + installBtnHidden);

    // --- Navigasi tetap berfungsi saat OFFLINE (app-shell dari cache) ---
    await page.evaluate(() => { location.hash = '#/barber/transaksi'; });
    await page.waitForSelector('#layanan-grid', { timeout: 5000 });

    await context.setOffline(true);
    await page.reload();
    try {
      await page.waitForSelector('#sidebar', { timeout: 5000 });
      ok('Setelah reload dalam kondisi OFFLINE, shell aplikasi (sidebar) tetap tampil dari cache Service Worker');
    } catch {
      bad('Shell aplikasi TIDAK tampil saat offline (Service Worker gagal menyajikan app-shell dari cache)');
    }

    const headerTextOffline = await page.locator('header').innerText().catch(() => '');
    if (headerTextOffline.includes('Owner')) ok('Sesi login tetap dikenali offline (dari localStorage, tanpa perlu network)');
    else bad('Topbar tidak menampilkan user saat offline: ' + headerTextOffline);

    await page.evaluate(() => { location.hash = '#/laporan'; });
    await page.waitForTimeout(400);
    const laporanShellVisible = await page.locator('#laporan-rows, #cards-periode').count();
    if (laporanShellVisible > 0) ok('Navigasi hash-router ke halaman lain (Laporan) tetap berfungsi offline (asset ter-precache)');
    else bad('Navigasi offline ke halaman Laporan gagal menampilkan shell halaman');

    await context.setOffline(false);

    // ERR_INTERNET_DISCONNECTED muncul di console SAAT sengaja offline (percobaan
    // fetch /api yang memang ditolak browser) -- itu bukti fitur offline bekerja
    // sebagaimana mestinya, bukan bug. Hanya error DI LUAR pola itu yang dianggap gagal.
    const unexpectedErrors = consoleErrors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'));
    if (unexpectedErrors.length === 0) ok('Tidak ada console error tak terduga sepanjang skenario PWA (termasuk saat offline)');
    else bad('Console error tak terduga terdeteksi: ' + JSON.stringify(unexpectedErrors));
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
