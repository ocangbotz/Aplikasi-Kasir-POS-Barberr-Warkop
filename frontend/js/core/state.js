/**
 * state.js — pub/sub store minimal untuk state yang dipakai lintas komponen
 * (user login, tema, status online). Tidak pakai framework — cukup untuk
 * kebutuhan aplikasi vanilla JS ini.
 */

const state = {
  currentUser: null, // { uid, username, role, name } | null
  theme: 'light', // 'light' | 'dark'
  online: typeof navigator !== 'undefined' ? navigator.onLine : true
};

const listeners = new Map();

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
  const set = listeners.get(key);
  if (set) set.forEach((cb) => cb(value));
}

/** Kembalikan fungsi unsubscribe. */
export function subscribe(key, callback) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(callback);
  return () => listeners.get(key)?.delete(callback);
}
