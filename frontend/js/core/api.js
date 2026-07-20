/**
 * api.js — satu-satunya tempat frontend bicara ke backend Apps Script.
 *
 * Selalu POST dengan Content-Type "text/plain;charset=utf-8" (BUKAN
 * application/json) supaya browser menganggapnya "simple request" dan tidak
 * mengirim CORS preflight (OPTIONS) — Apps Script Web App tidak bisa
 * merespons preflight. Body tetap JSON biasa; backend (Code.js) yang
 * JSON.parse isinya secara manual. Lihat docs/ARCHITECTURE.md §2.
 */

import { getApiBaseUrl, STORAGE_KEYS } from './config.js';
import { enqueueAction } from './db-cache.js';

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.TOKEN) || null;
}

/**
 * Panggil satu action ke backend.
 * options.queueOnOffline: true -> kalau browser offline / network gagal,
 * simpan aksi ke antrean IndexedDB (dikirim ulang otomatis saat online, lihat
 * app.js) alih-alih melempar error ke pemanggil. Cocok untuk aksi mutasi yang
 * boleh ditunda (mis. transaksi), TIDAK cocok untuk aksi baca (settings.view dst).
 */
export async function apiCall(action, payload, options) {
  const opts = options || {};
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError('NO_API_BASE_URL', 'URL Web App backend belum diatur.');
  }

  const body = JSON.stringify({ action, token: getToken(), payload: payload || {} });

  if (opts.queueOnOffline && typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueAction(action, payload || {});
    return { queued: true };
  }

  let response;
  try {
    response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
  } catch (networkErr) {
    if (opts.queueOnOffline) {
      await enqueueAction(action, payload || {});
      return { queued: true };
    }
    throw new ApiError('NETWORK_ERROR', 'Tidak bisa menghubungi server. Periksa koneksi internet Anda.');
  }

  let json;
  try {
    json = await response.json();
  } catch (parseErr) {
    throw new ApiError('BAD_RESPONSE', 'Respons server tidak valid.');
  }

  if (!json.ok) {
    throw new ApiError(json.error?.code || 'UNKNOWN_ERROR', json.error?.message || 'Terjadi kesalahan.');
  }
  return json.data;
}

/** Panggil doGet (dipakai untuk health-check koneksi tanpa perlu token). */
export async function apiHealthCheck() {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new ApiError('NO_API_BASE_URL', 'URL Web App backend belum diatur.');
  let response;
  try {
    response = await fetch(baseUrl, { method: 'GET' });
  } catch (e) {
    throw new ApiError('NETWORK_ERROR', 'Tidak bisa menghubungi server. Periksa URL & koneksi internet Anda.');
  }
  const json = await response.json();
  if (!json.ok) throw new ApiError('BAD_RESPONSE', 'Respons server tidak valid.');
  return json.data;
}
