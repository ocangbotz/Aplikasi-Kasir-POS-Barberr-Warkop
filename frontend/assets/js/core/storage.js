/**
 * storage.js
 * Wrapper localStorage dengan prefix & JSON otomatis. Dipakai untuk state
 * yang harus bertahan lintas reload (sesi login, preferensi tema, dsb).
 */
import { APP_CONFIG } from './config.js';

const key = (k) => APP_CONFIG.STORAGE_PREFIX + k;

export const storage = {
  get(k, fallback = null) {
    try {
      const raw = localStorage.getItem(key(k));
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(k, value) {
    localStorage.setItem(key(k), JSON.stringify(value));
  },
  remove(k) {
    localStorage.removeItem(key(k));
  }
};
