/**
 * theme.js
 * Dark/Light mode dengan 3 opsi: 'light', 'dark', 'system'. Tersimpan di
 * localStorage dan diterapkan lewat class `.dark` di <html> (lihat
 * @custom-variant di frontend/src/css/input.css).
 */
import { storage } from './storage.js';
import { createStore } from './state.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolveIsDark(mode) {
  return mode === 'system' ? media.matches : mode === 'dark';
}

function apply(mode) {
  document.documentElement.classList.toggle('dark', resolveIsDark(mode));
}

export const themeStore = createStore(storage.get('theme', 'system'));

export function initTheme() {
  apply(themeStore.get());
  themeStore.subscribe((mode) => {
    storage.set('theme', mode);
    apply(mode);
  });
  media.addEventListener('change', () => {
    if (themeStore.get() === 'system') apply('system');
  });
}

export function setTheme(mode) {
  themeStore.set(mode);
}

export function toggleTheme() {
  const current = themeStore.get();
  const isDarkNow = resolveIsDark(current);
  setTheme(isDarkNow ? 'light' : 'dark');
}
