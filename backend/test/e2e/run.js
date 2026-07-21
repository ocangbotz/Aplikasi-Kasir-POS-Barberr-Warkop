'use strict';
/**
 * E2E test Fase 2: menjalankan devServer.js sungguhan + browser Chromium
 * sungguhan (Playwright) untuk memverifikasi alur nyata di frontend --
 * bukan sekadar unit test logika. Mandiri (self-contained): server & data
 * di-setup ulang setiap run, tidak perlu langkah manual.
 *
 * Jalankan: npm run test:e2e
 */
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || 8799;
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
  console.log('Fase 2 E2E: frontend + dev-server + Chromium\n');

  const server = spawn(process.execPath, [DEV_SERVER], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });

  try {
    await waitForServer(`${BASE}/api?action=ping`);
    const credRes = await fetch(`${BASE}/__dev/owner-credentials`);
    const cred = await credRes.json();
    if (!cred.password) throw new Error('Tidak bisa mengambil kredensial owner dari dev-server');

    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

    await page.goto(BASE + '/');
    await page.waitForSelector('#login-form', { timeout: 5000 });
    ok('Halaman login tampil untuk pengguna belum login');

    if ((await page.locator('#splash').count()) === 0) ok('Splash screen dihapus setelah boot');
    else bad('Splash screen masih ada');

    await page.fill('#username', 'owner');
    await page.fill('#password', 'password-salah-sengaja');
    await page.click('#login-submit');
    await page.waitForSelector('#login-error:not(.hidden)', { timeout: 5000 });
    const errText = (await page.locator('#login-error').textContent()) || '';
    if (/salah/i.test(errText)) ok('Login gagal menampilkan pesan error yang sesuai');
    else bad('Pesan error login tidak sesuai: ' + errText);

    await page.fill('#password', cred.password);
    await page.click('#login-submit');
    await page.waitForSelector('#page-content', { timeout: 5000 });
    ok('Login sukses -> shell aplikasi tampil');

    const headerText = await page.locator('header').innerText();
    if (headerText.includes('Owner')) ok('Topbar menampilkan nama user yang login');
    else bad('Topbar tidak menampilkan nama user');

    const session = await page.evaluate(() => localStorage.getItem('kbw_session'));
    if (session && JSON.parse(session).token) ok('Sesi tersimpan di localStorage');
    else bad('Sesi tidak tersimpan di localStorage');

    await page.reload();
    await page.waitForSelector('#page-content', { timeout: 5000 });
    ok('Setelah reload, sesi tetap valid');

    const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.click('#theme-toggle');
    await page.waitForTimeout(150);
    const darkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (darkBefore !== darkAfter) ok('Dark mode toggle mengubah tampilan');
    else bad('Dark mode toggle tidak berefek');

    await page.reload();
    await page.waitForSelector('#page-content', { timeout: 5000 });
    const darkAfterReload = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    if (darkAfterReload === darkAfter) ok('Preferensi tema konsisten setelah reload');
    else bad('Preferensi tema tidak persisten setelah reload');

    await page.evaluate(() => { location.hash = '#/profil'; });
    await page.waitForSelector('#change-password-form', { timeout: 5000 });
    ok('Navigasi ke halaman Profil menampilkan form ganti password');

    await page.fill('input[name="oldPassword"]', 'password-salah-lagi');
    await page.fill('input[name="newPassword"]', 'passwordBaru123');
    await page.click('#change-password-submit');
    await page.waitForSelector('#toast-container div', { timeout: 5000 });
    let toastText = await page.locator('#toast-container div').first().innerText();
    if (/tidak sesuai|salah/i.test(toastText)) ok('Ganti password ditolak jika password lama salah');
    else bad('Ganti password seharusnya ditolak: ' + toastText);

    await page.fill('input[name="oldPassword"]', cred.password);
    await page.fill('input[name="newPassword"]', 'passwordBaru123');
    await page.click('#change-password-submit');
    await page.waitForTimeout(400);
    toastText = await page.locator('#toast-container div').last().innerText();
    if (/berhasil/i.test(toastText)) ok('Ganti password berhasil dengan password lama yang benar');
    else bad('Ganti password seharusnya berhasil: ' + toastText);

    await page.click('#user-menu-btn');
    await page.click('#logout-btn');
    await page.waitForSelector('#login-form', { timeout: 5000 });
    ok('Logout kembali ke halaman login');

    const sessionAfterLogout = await page.evaluate(() => localStorage.getItem('kbw_session'));
    if (!sessionAfterLogout) ok('Sesi dihapus dari localStorage setelah logout');
    else bad('Sesi masih tersimpan setelah logout');

    await page.fill('#username', 'owner');
    await page.fill('#password', 'passwordBaru123');
    await page.click('#login-submit');
    await page.waitForSelector('#page-content', { timeout: 5000 });
    ok('Login ulang dengan password baru berhasil (perubahan persisten di backend)');

    await page.setViewportSize({ width: 375, height: 700 });
    await page.click('#sidebar-toggle');
    await page.waitForTimeout(200);
    if (await page.locator('#sidebar-overlay').isVisible()) ok('Mobile: sidebar terbuka lewat tombol hamburger');
    else bad('Mobile: overlay sidebar tidak muncul');

    if (consoleErrors.length === 0) ok('Tidak ada console error sepanjang skenario');
    else bad('Console error terdeteksi: ' + JSON.stringify(consoleErrors));

    await browser.close();
  } catch (err) {
    bad('Exception saat E2E: ' + err.message);
    console.error(err);
    console.error('\n--- server log ---\n' + serverLog);
  } finally {
    server.kill();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
