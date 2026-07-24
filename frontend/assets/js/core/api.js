/**
 * api.js
 * Satu-satunya jalur komunikasi ke backend Apps Script. Semua request
 * dikirim sebagai POST dengan Content-Type "text/plain" (BUKAN
 * application/json) supaya browser tidak melakukan CORS preflight (OPTIONS)
 * -- Google Apps Script Web App tidak bisa merespons preflight dengan benar.
 * Token sesi dikirim di dalam body JSON, bukan header, dengan alasan yang sama.
 */
import { APP_CONFIG } from './config.js';
import { storage } from './storage.js';

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function currentToken() {
  const session = storage.get('session');
  return session ? session.token : '';
}

// Indikator "sedang memuat" global (garis tipis di atas layar, lihat
// #global-loading-bar di index.html/input.css) -- ditampilkan otomatis
// selama ADA MINIMAL SATU apiCall() yang belum selesai, supaya latensi
// backend Apps Script (biasanya 1-3 detik/request) terlihat sebagai
// "sedang memuat", bukan seperti macet.
let pendingRequests = 0;
function setLoadingBarActive(active) {
  const bar = document.getElementById('global-loading-bar');
  if (bar) bar.classList.toggle('active', active);
}

/**
 * Panggil satu action backend.
 * @param {string} action - nama action sesuai ROUTES di backend/src/Code.gs
 * @param {object} payload - data tambahan (token disisipkan otomatis)
 */
export async function apiCall(action, payload = {}) {
  if (!APP_CONFIG.API_BASE_URL || APP_CONFIG.API_BASE_URL.startsWith('REPLACE_')) {
    throw new ApiError(
      'CONFIG_ERROR',
      'Backend belum dikonfigurasi. Edit API_BASE_URL di assets/js/core/config.js dengan Web App URL Apps Script Anda.'
    );
  }

  pendingRequests++;
  setLoadingBarActive(true);
  try {
    const body = JSON.stringify({ action, token: currentToken(), ...payload });

    let response;
    try {
      response = await fetch(APP_CONFIG.API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body
      });
    } catch (networkErr) {
      throw new ApiError('NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new ApiError('BAD_RESPONSE', 'Respon server tidak valid.');
    }

    if (!json.ok) {
      const err = json.error || {};
      throw new ApiError(err.code || 'UNKNOWN_ERROR', err.message || 'Terjadi kesalahan.');
    }

    return json.data;
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    if (pendingRequests === 0) setLoadingBarActive(false);
  }
}
