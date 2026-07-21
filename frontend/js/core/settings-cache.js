/**
 * settings-cache.js — cache in-memory sederhana untuk Settings (dipakai
 * berulang kali oleh struk, dashboard, dsb supaya tidak fetch ulang tiap
 * render). Di-invalidate manual setelah settings.update berhasil.
 */

import { apiCall } from './api.js';

let cached = null;
let inFlight = null;

export async function getSettings() {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = apiCall('settings.view', {}).then((data) => {
      cached = data;
      inFlight = null;
      return data;
    });
  }
  return inFlight;
}

export function invalidateSettingsCache() {
  cached = null;
}
