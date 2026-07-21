/**
 * config.js — konfigurasi aplikasi sisi client.
 *
 * `apiBaseUrl` (Web App URL hasil deploy Apps Script, lihat
 * docs/SPREADSHEET_SETUP.md) BERBEDA untuk setiap instalasi/usaha, jadi tidak
 * di-hardcode di sini — disimpan di localStorage lewat layar "Pengaturan
 * Koneksi" yang tampil otomatis sebelum layar login kalau belum pernah diisi.
 */

const STORAGE_KEYS = {
  API_BASE_URL: 'pos.apiBaseUrl',
  TOKEN: 'pos.token',
  USER: 'pos.user',
  THEME: 'pos.theme' // 'light' | 'dark'
};

export const APP_META = {
  name: 'POS Barber & Warkop',
  shortName: 'POS BW',
  version: '1.0.0'
};

export function getApiBaseUrl() {
  return localStorage.getItem(STORAGE_KEYS.API_BASE_URL) || '';
}

export function setApiBaseUrl(url) {
  localStorage.setItem(STORAGE_KEYS.API_BASE_URL, url.trim());
}

export function clearApiBaseUrl() {
  localStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
}

export { STORAGE_KEYS };
