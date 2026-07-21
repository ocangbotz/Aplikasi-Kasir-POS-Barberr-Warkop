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
import { renderTransaksiBarber } from './modules/barber/transaksi.js';
import { renderRiwayatBarber } from './modules/barber/riwayat.js';
import { renderPelangganBarber } from './modules/barber/pelanggan.js';
import { renderLayananBarber } from './modules/barber/layanan.js';
import { renderCapster } from './modules/barber/capster.js';
import { renderPengeluaran } from './modules/expenses/index.js';
import { renderTransaksiWarkop } from './modules/warkop/transaksi.js';
import { renderRiwayatWarkop } from './modules/warkop/riwayat.js';
import { renderMenuWarkop } from './modules/warkop/menu.js';
import { renderInventory } from './modules/inventory/index.js';

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

  const BARBER_ROLES = ['Owner', 'Admin', 'Kasir'];
  registerRoute('/barber/transaksi', { render: withShell(renderTransaksiBarber), roles: BARBER_ROLES, title: 'Transaksi Baru - Barber' });
  registerRoute('/barber/riwayat', { render: withShell(renderRiwayatBarber), roles: BARBER_ROLES, title: 'Riwayat Transaksi - Barber' });
  registerRoute('/barber/pelanggan', { render: withShell(renderPelangganBarber), roles: BARBER_ROLES, title: 'Data Pelanggan - Barber' });
  registerRoute('/barber/layanan', { render: withShell(renderLayananBarber), roles: BARBER_ROLES, title: 'Layanan Barber' });
  registerRoute('/barber/capster', { render: withShell(renderCapster), roles: ['Owner', 'Admin'], title: 'Capster' });
  registerRoute('/barber/inventory', { render: withShell((el) => renderInventory(el, 'Barber')), roles: BARBER_ROLES, title: 'Inventory Barber' });
  registerRoute('/barber/pengeluaran', { render: withShell((el) => renderPengeluaran(el, 'Barber')), roles: BARBER_ROLES, title: 'Pengeluaran Barber' });

  const WARKOP_ROLES = ['Owner', 'Admin', 'Kasir'];
  registerRoute('/warkop/transaksi', { render: withShell(renderTransaksiWarkop), roles: WARKOP_ROLES, title: 'Pesanan Baru - Warkop' });
  registerRoute('/warkop/riwayat', { render: withShell(renderRiwayatWarkop), roles: WARKOP_ROLES, title: 'Riwayat Transaksi - Warkop' });
  registerRoute('/warkop/menu', { render: withShell(renderMenuWarkop), roles: WARKOP_ROLES, title: 'Menu Warkop' });
  registerRoute('/warkop/inventory', { render: withShell((el) => renderInventory(el, 'Warkop')), roles: WARKOP_ROLES, title: 'Inventory Warkop' });
  registerRoute('/warkop/pengeluaran', { render: withShell((el) => renderPengeluaran(el, 'Warkop')), roles: WARKOP_ROLES, title: 'Pengeluaran Warkop' });
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
