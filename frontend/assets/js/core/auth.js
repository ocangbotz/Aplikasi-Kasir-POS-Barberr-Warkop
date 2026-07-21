/**
 * auth.js
 * Login/logout, penyimpanan sesi, dan pengecekan hak akses di sisi UI.
 *
 * PENTING: pengecekan permission di sini HANYA untuk menyembunyikan/menampilkan
 * elemen UI. Otorisasi yang sesungguhnya selalu divalidasi ulang di backend
 * (backend/src/Auth.gs requirePermission_) -- jangan pernah percaya klien.
 */
import { apiCall, ApiError } from './api.js';
import { storage } from './storage.js';
import { createStore } from './state.js';

// Salinan ringan dari backend/src/Config.gs PERMISSIONS, dipakai untuk UI gating saja.
const PERMISSIONS = {
  Owner: { all: true },
  Admin: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: true,
    inventory: true, pelanggan: true, pengeluaran: true, closingShift: true,
    gajiCapster: true, laporan: true, kelolaLayananProduk: true,
    auditLog: true, kelolaUser: false, backupRestore: false,
    editTransaksi: true, hapusTransaksi: false, reopenShift: true
  },
  Kasir: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: true,
    inventory: false, pelanggan: true, pengeluaran: true, closingShift: true,
    gajiCapster: false, laporan: true, kelolaLayananProduk: false,
    auditLog: false, kelolaUser: false, backupRestore: false,
    editTransaksi: false, hapusTransaksi: false, reopenShift: false
  },
  Capster: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: false,
    inventory: false, pelanggan: true, pengeluaran: false, closingShift: false,
    gajiCapster: false, laporan: false, kelolaLayananProduk: false,
    auditLog: false, kelolaUser: false, backupRestore: false,
    editTransaksi: false, hapusTransaksi: false, reopenShift: false
  }
};

const initialSession = storage.get('session', null);
export const authStore = createStore({
  user: initialSession ? initialSession.user : null,
  token: initialSession ? initialSession.token : null
});

export function isAuthenticated() {
  return !!authStore.get().token;
}

export function getCurrentUser() {
  return authStore.get().user;
}

export function hasPermission(permission) {
  const user = getCurrentUser();
  if (!user) return false;
  const perms = PERMISSIONS[user.role];
  if (!perms) return false;
  return !!(perms.all || perms[permission]);
}

export async function login(username, password) {
  const data = await apiCall('login', { username, password });
  storage.set('session', data);
  authStore.set({ user: data.user, token: data.token });
  return data.user;
}

export async function logout() {
  try {
    await apiCall('logout', {});
  } catch {
    // Tetap logout secara lokal walau request gagal (mis. offline).
  }
  storage.remove('session');
  authStore.set({ user: null, token: null });
}

/**
 * Validasi ulang token ke server saat aplikasi dibuka (token bisa saja
 * sudah expired di server walau masih tersimpan di localStorage).
 */
export async function verifySession() {
  if (!isAuthenticated()) return false;
  try {
    const data = await apiCall('getMe', {});
    const session = storage.get('session');
    authStore.set({ user: data.user, token: session.token });
    return true;
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'AUTH_REQUIRED' || err.code === 'AUTH_DISABLED')) {
      storage.remove('session');
      authStore.set({ user: null, token: null });
      return false;
    }
    // Kegagalan jaringan: jangan paksa logout, biarkan user coba lagi saat online.
    return isAuthenticated();
  }
}

export async function changePassword(oldPassword, newPassword) {
  return apiCall('changePassword', { oldPassword, newPassword });
}
