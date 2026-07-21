/**
 * core/pwa.js
 * Registrasi Service Worker (offline + app-shell), penanganan event
 * "beforeinstallprompt" (tombol Install App custom), dan notifikasi saat
 * versi baru ter-deploy (Service Worker baru "menunggu" -> reload untuk
 * mengaktifkannya). sw.js sendiri dihasilkan otomatis oleh
 * scripts/gen-sw.js dari daftar file frontend/assets yang sesungguhnya.
 */
import { toastInfo } from './toast.js';

let deferredInstallPrompt = null;
let installListeners = [];

function notifyInstallListeners() {
  installListeners.forEach((fn) => fn(!!deferredInstallPrompt));
}

/**
 * Berlangganan perubahan ketersediaan prompt install (mis. untuk
 * menampilkan/menyembunyikan tombol "Install App" di topbar).
 * @param {(available: boolean) => void} fn
 * @returns {() => void} unsubscribe
 */
export function onInstallAvailabilityChange(fn) {
  installListeners.push(fn);
  fn(!!deferredInstallPrompt);
  return () => { installListeners = installListeners.filter((f) => f !== fn); };
}

/** Tampilkan prompt install native browser. @returns {Promise<boolean>} true jika user menerima */
export async function promptInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  notifyInstallListeners();
  return outcome === 'accepted';
}

export function isRunningStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Hanya reload otomatis saat controllerchange jika dipicu tombol "Muat Ulang"
// user sendiri -- clients.claim() di sw.js JUGA memicu controllerchange pada
// pemuatan PERTAMA (halaman yang belum pernah dikontrol SW manapun), yang
// tanpa flag ini akan menyebabkan reload tak terduga tepat setelah install.
let updateRequested = false;

function showUpdateBar(registration) {
  if (document.getElementById('pwa-update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'pwa-update-bar';
  bar.className = 'fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 border-t border-slate-200/70 bg-white/95 px-4 py-3 text-sm shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95';
  bar.innerHTML = `
    <span class="font-medium text-slate-700 dark:text-slate-200">🔄 Versi baru tersedia.</span>
    <button type="button" id="pwa-update-btn" class="btn-primary !py-1.5 !px-3 text-xs">Muat Ulang</button>`;
  document.body.appendChild(bar);
  bar.querySelector('#pwa-update-btn').addEventListener('click', () => {
    updateRequested = true;
    if (registration.waiting) registration.waiting.postMessage('SKIP_WAITING');
  });
}

export function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    notifyInstallListeners();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notifyInstallListeners();
    toastInfo('Aplikasi berhasil di-install.');
  });

  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').then((registration) => {
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateBar(registration);

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(registration);
      });
    });
  }).catch(() => { /* Registrasi SW gagal (mis. dibuka lewat file://) -- aplikasi tetap jalan mode online biasa */ });

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !updateRequested) return;
    reloading = true;
    window.location.reload();
  });
}
