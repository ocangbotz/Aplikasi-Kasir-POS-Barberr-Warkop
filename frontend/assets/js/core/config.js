/**
 * config.js
 * Satu-satunya tempat yang perlu diedit saat memindahkan aplikasi ini ke
 * usaha/akun Google lain: ganti API_BASE_URL dengan Web App URL hasil deploy
 * Apps Script (lihat docs/01-SETUP-BACKEND.md langkah 4).
 */

const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);

export const APP_CONFIG = {
  APP_NAME: 'Kasir Barber & Warkop',
  STORAGE_PREFIX: 'kbw_',

  // Saat dibuka dari localhost (mis. `npm run dev`), otomatis memakai
  // dev-server lokal (backend/test/devServer.js) supaya bisa ditest tanpa
  // deploy ke Google. Di produksi, ganti baris di bawah `REPLACE_...`.
  API_BASE_URL: isLocalDev
    ? '/api'
    : 'https://script.google.com/macros/s/AKfycbxwpFq6yoxj6PT-3-hN4_RoKzdCcX7ZC0F9sNwrr0LBLhd7FxHpnwrpk2Krx4ErUW7Y/exec',

  SESSION_TTL_HOURS: 12
};
