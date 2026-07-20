/**
 * app.js — bootstrap aplikasi: tema, sesi, routing, service worker, & antrean
 * offline. Satu-satunya file yang mendaftarkan seluruh route yang ada.
 */

import { initTheme, showToast } from './core/ui.js';
import { restoreSessionFromStorage, getCurrentUser, hasRole } from './core/auth.js';
import { getApiBaseUrl } from './core/config.js';
import { registerRoute, initRouter, navigate } from './core/router.js';
import { getQueuedActions, removeQueuedAction } from './core/db-cache.js';
import { apiCall } from './core/api.js';

import { renderConnectionSetup } from './modules/connection-setup/index.js';
import { renderLogin } from './modules/auth/login.js';
import { withShell } from './modules/shell/layout.js';
import { renderHome } from './modules/home/index.js';
import { renderSettings } from './modules/settings/index.js';
import { renderUsers } from './modules/users/index.js';
import { renderAuditLog } from './modules/auditlog/index.js';
import { renderBackup } from './modules/backup/index.js';

const ALL_ROLES = ['Owner', 'Admin', 'Kasir', 'Capster'];

function registerRoutes() {
  registerRoute('/setup-koneksi', { render: renderConnectionSetup, roles: null, title: 'Pengaturan Koneksi' });

  registerRoute('/login', {
    render: async (container) => {
      if (getCurrentUser()) return navigate('/');
      return renderLogin(container);
    },
    roles: null,
    title: 'Masuk'
  });

  registerRoute('/', { render: withShell(renderHome), roles: ALL_ROLES, title: 'Beranda' });
  registerRoute('/settings', { render: withShell(renderSettings), roles: ALL_ROLES, title: 'Pengaturan' });
  registerRoute('/users', { render: withShell(renderUsers), roles: ['Owner'], title: 'Manajemen User' });
  registerRoute('/audit-log', { render: withShell(renderAuditLog), roles: ['Owner', 'Admin'], title: 'Audit Log' });
  registerRoute('/backup', { render: withShell(renderBackup), roles: ['Owner'], title: 'Backup & Restore' });
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <div class="mb-2 text-4xl">🔍</div>
        <p class="text-lg font-semibold">Halaman tidak ditemukan</p>
        <a href="#/" class="btn-primary mt-4 inline-flex">Kembali ke Beranda</a>
      </div>
    </div>`;
}

function handleUnauthorized() {
  if (!getApiBaseUrl()) return navigate('/setup-koneksi');
  if (!getCurrentUser()) return navigate('/login');
  showToast('Anda tidak memiliki akses ke halaman ini', 'error');
  navigate('/');
}

/** Kirim ulang aksi yang tersimpan di antrean offline (mis. transaksi yang dibuat saat offline). */
async function flushOfflineQueue() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const queued = await getQueuedActions();
  for (const item of queued) {
    try {
      await apiCall(item.action, item.payload);
      await removeQueuedAction(item.id);
    } catch (err) {
      break; // biarkan sisanya di antrean, coba lagi saat 'online' berikutnya
    }
  }
}

function boot() {
  initTheme();
  restoreSessionFromStorage();
  registerRoutes();

  initRouter({
    container: document.getElementById('app'),
    guard: (routeRoles) => {
      if (!getApiBaseUrl()) return false;
      return hasRole(getCurrentUser(), routeRoles);
    },
    unauthorized: handleUnauthorized,
    notFound: renderNotFound
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Offline/PWA install tetap opsional — kegagalan register SW tidak boleh menghentikan app.
    });
  }

  window.addEventListener('online', flushOfflineQueue);
  flushOfflineQueue();
}

boot();
