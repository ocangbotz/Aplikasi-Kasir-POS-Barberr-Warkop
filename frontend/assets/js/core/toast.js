/**
 * toast.js
 * Notifikasi ringan (sukses/error/info) tanpa dependency eksternal.
 */
let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none';
  document.body.appendChild(container);
  return container;
}

const VARIANT_CLASS = {
  success: 'border-gabungan-500/40 text-gabungan-700 dark:text-gabungan-300',
  error: 'border-red-500/40 text-red-700 dark:text-red-300',
  info: 'border-barber-500/40 text-barber-700 dark:text-barber-300'
};

export function toast(message, variant = 'info', durationMs = 3500) {
  const root = ensureContainer();
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `glass-card pointer-events-auto w-full max-w-sm border px-4 py-3 text-sm font-medium shadow-xl transition
    -translate-y-2 opacity-0 ${VARIANT_CLASS[variant] || VARIANT_CLASS.info}`;
  el.textContent = message;
  root.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    el.classList.add('opacity-0');
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}

export const toastSuccess = (msg) => toast(msg, 'success');
export const toastError = (msg) => toast(msg, 'error');
export const toastInfo = (msg) => toast(msg, 'info');
