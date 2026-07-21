/**
 * ui.js — helper UI lintas halaman: tema dark/light, toast, dialog konfirmasi.
 */

import { STORAGE_KEYS } from './config.js';
import { setState } from './state.js';

/** Escape HTML dasar — dipakai sebelum menyisipkan string apa pun (termasuk data user) ke innerHTML. */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  setState('theme', theme);
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[90vw] sm:max-w-sm';
    document.body.appendChild(container);
  }
  return container;
}

const TOAST_STYLES = {
  info: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
  success: 'bg-gabungan-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white'
};

export function showToast(message, type, durationMs) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `glass-card px-4 py-3 text-sm shadow-lg transition-opacity duration-300 ${TOAST_STYLES[type] || TOAST_STYLES.info}`;
  toast.textContent = message; // textContent -> aman dari injeksi HTML
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, durationMs || 3500);
}

/** Modal konfirmasi sebelum aksi berbahaya (hapus, restore, dsb) — resolve(true/false). */
export function confirmDialog(message, options) {
  const opts = options || {};
  const title = opts.title || 'Konfirmasi';
  const confirmText = opts.confirmText || 'Ya, Lanjutkan';
  const cancelText = opts.cancelText || 'Batal';
  const danger = !!opts.danger;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4';
    overlay.innerHTML = `
      <div class="glass-card w-full max-w-sm bg-white/95 dark:bg-slate-900/95 p-6">
        <h3 class="text-lg font-semibold mb-2">${escapeHtml(title)}</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-6">${escapeHtml(message)}</p>
        <div class="flex justify-end gap-2">
          <button type="button" data-action="cancel" class="btn-outline">${escapeHtml(cancelText)}</button>
          <button type="button" data-action="confirm" class="${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) return cleanup(false);
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'confirm') cleanup(true);
      else if (action === 'cancel') cleanup(false);
    });

    document.body.appendChild(overlay);
  });
}
