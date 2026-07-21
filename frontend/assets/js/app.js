/**
 * app.js
 * Entry point aplikasi. Mendaftarkan tema, rute, dan menu, lalu boot.
 *
 * Optimasi performa (Fase 10): hanya login.js & layout.js (shell) yang
 * di-import statis -- wajib ada untuk cat pertama. Semua modul halaman
 * lain dimuat lewat import() dinamis SAAT rute-nya benar-benar dibuka
 * (code-splitting), supaya beban parse/eksekusi JS awal tidak mencakup
 * puluhan halaman yang belum tentu dikunjungi user di sesi itu. Service
 * Worker (Fase 9) tetap men-precache semua chunk ini, jadi setelah
 * kunjungan pertama pun tetap instan & offline-ready.
 */
import { initTheme } from './core/theme.js';
import { initPWA } from './core/pwa.js';
import { authStore, isAuthenticated, verifySession } from './core/auth.js';
import { initRouter, registerRoute } from './core/router.js';
import { registerNavItem } from './core/nav.js';
import { renderLogin } from './pages/login.js';
import { renderLayout } from './pages/layout.js';

/** Bungkus import() dinamis + nama export jadi fungsi render yang dipanggil router. */
function lazy(importFn, exportName) {
  return (root) => importFn().then((m) => m[exportName](root));
}

registerRoute('/login', { public: true, title: 'Masuk', render: renderLogin });
registerRoute('/', { permission: 'dashboard', title: 'Dashboard Gabungan', render: lazy(() => import('./pages/dashboard/gabungan.js'), 'renderDashboardGabungan') });
registerRoute('/dashboard/barber', { permission: 'dashboard', title: 'Dashboard Barber', render: lazy(() => import('./pages/dashboard/barber.js'), 'renderDashboardBarber') });
registerRoute('/dashboard/warkop', { permission: 'dashboard', title: 'Dashboard Warkop', render: lazy(() => import('./pages/dashboard/warkop.js'), 'renderDashboardWarkop') });
registerRoute('/profil', { title: 'Profil Saya', render: lazy(() => import('./pages/home.js'), 'renderHome') });

registerRoute('/barber/transaksi', { permission: 'transaksiBarber', title: 'Transaksi Barber', render: lazy(() => import('./pages/barber/transaksi.js'), 'renderBarberTransaksi') });
registerRoute('/barber/riwayat', { permission: 'transaksiBarber', title: 'Riwayat Barber', render: lazy(() => import('./pages/barber/riwayat.js'), 'renderBarberRiwayat') });
registerRoute('/barber/layanan', { permission: 'kelolaLayananProduk', title: 'Layanan Barber', render: lazy(() => import('./pages/barber/layanan.js'), 'renderBarberLayanan') });
registerRoute('/barber/capster', { permission: 'kelolaCapster', title: 'Data Capster', render: lazy(() => import('./pages/barber/capster.js'), 'renderBarberCapster') });

registerRoute('/warkop/pesanan', { permission: 'transaksiWarkop', title: 'Pesanan Warkop', render: lazy(() => import('./pages/warkop/pesanan.js'), 'renderWarkopPesanan') });
registerRoute('/warkop/riwayat', { permission: 'transaksiWarkop', title: 'Riwayat Warkop', render: lazy(() => import('./pages/warkop/riwayat.js'), 'renderWarkopRiwayat') });
registerRoute('/warkop/produk', { permission: 'kelolaLayananProduk', title: 'Menu Warkop', render: lazy(() => import('./pages/warkop/produk.js'), 'renderWarkopProduk') });

registerRoute('/inventory/barber', { permission: 'inventory', title: 'Inventory Barber', render: lazy(() => import('./pages/inventory/barber.js'), 'renderInventoryBarber') });
registerRoute('/inventory/warkop', { permission: 'inventory', title: 'Inventory Warkop', render: lazy(() => import('./pages/inventory/warkop.js'), 'renderInventoryWarkop') });

registerRoute('/pengeluaran/barber', { permission: 'pengeluaran', title: 'Pengeluaran Barber', render: lazy(() => import('./pages/pengeluaran/barber.js'), 'renderPengeluaranBarber') });
registerRoute('/pengeluaran/warkop', { permission: 'pengeluaran', title: 'Pengeluaran Warkop', render: lazy(() => import('./pages/pengeluaran/warkop.js'), 'renderPengeluaranWarkop') });

registerRoute('/laporan', { permission: 'laporan', title: 'Laporan', render: lazy(() => import('./pages/laporan/index.js'), 'renderLaporan') });
registerRoute('/shift', { permission: 'closingShift', title: 'Closing Shift', render: lazy(() => import('./pages/shift/index.js'), 'renderShift') });
registerRoute('/gaji-capster', { permission: 'gajiCapster', title: 'Gaji Capster', render: lazy(() => import('./pages/gaji-capster/index.js'), 'renderGajiCapster') });
registerRoute('/pelanggan', { permission: 'pelanggan', title: 'Data Pelanggan', render: lazy(() => import('./pages/pelanggan/index.js'), 'renderPelanggan') });

registerRoute('/owner/users', { permission: 'kelolaUser', title: 'Kelola User', render: lazy(() => import('./pages/owner/users.js'), 'renderOwnerUsers') });
registerRoute('/owner/transaksi', { permission: 'editTransaksi', title: 'Kelola Transaksi', render: lazy(() => import('./pages/owner/transaksi.js'), 'renderOwnerTransaksi') });
registerRoute('/owner/audit-log', { permission: 'auditLog', title: 'Audit Log', render: lazy(() => import('./pages/audit-log/index.js'), 'renderAuditLog') });
registerRoute('/owner/backup', { permission: 'backupRestore', title: 'Backup & Restore', render: lazy(() => import('./pages/owner/backup.js'), 'renderOwnerBackup') });
registerRoute('/404', {
  public: true,
  title: 'Halaman Tidak Ditemukan',
  render: (root) => {
    root.innerHTML = `<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p class="text-5xl">🔍</p>
      <p class="mt-3 text-lg font-bold text-slate-900 dark:text-white">Halaman tidak ditemukan</p>
      <a href="#/" class="btn-primary mt-4">Kembali ke Dashboard</a>
    </div>`;
  }
});
registerRoute('/403', {
  title: 'Akses Ditolak',
  render: (root) => {
    root.innerHTML = `<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p class="text-5xl">🚫</p>
      <p class="mt-3 text-lg font-bold text-slate-900 dark:text-white">Anda tidak memiliki akses ke halaman ini</p>
      <a href="#/" class="btn-primary mt-4">Kembali ke Dashboard</a>
    </div>`;
  }
});

registerNavItem({ path: '/', label: 'Gabungan', icon: '🟩', permission: 'dashboard', group: 'Dashboard' });
registerNavItem({ path: '/dashboard/barber', label: 'Barber', icon: '🟦', permission: 'dashboard', group: 'Dashboard' });
registerNavItem({ path: '/dashboard/warkop', label: 'Warkop', icon: '🟧', permission: 'dashboard', group: 'Dashboard' });
registerNavItem({ path: '/barber/transaksi', label: 'Transaksi', icon: '💈', permission: 'transaksiBarber', group: 'Barber' });
registerNavItem({ path: '/barber/riwayat', label: 'Riwayat', icon: '🧾', permission: 'transaksiBarber', group: 'Barber' });
registerNavItem({ path: '/barber/layanan', label: 'Layanan', icon: '✂️', permission: 'kelolaLayananProduk', group: 'Barber' });
registerNavItem({ path: '/barber/capster', label: 'Capster', icon: '🧑‍🔧', permission: 'kelolaCapster', group: 'Barber' });
registerNavItem({ path: '/pengeluaran/barber', label: 'Pengeluaran', icon: '💸', permission: 'pengeluaran', group: 'Barber' });
registerNavItem({ path: '/warkop/pesanan', label: 'Pesanan', icon: '☕', permission: 'transaksiWarkop', group: 'Warkop' });
registerNavItem({ path: '/warkop/riwayat', label: 'Riwayat', icon: '🧾', permission: 'transaksiWarkop', group: 'Warkop' });
registerNavItem({ path: '/warkop/produk', label: 'Menu', icon: '📋', permission: 'kelolaLayananProduk', group: 'Warkop' });
registerNavItem({ path: '/pengeluaran/warkop', label: 'Pengeluaran', icon: '💸', permission: 'pengeluaran', group: 'Warkop' });
registerNavItem({ path: '/inventory/barber', label: 'Inventory Barber', icon: '📦', permission: 'inventory', group: 'Inventory' });
registerNavItem({ path: '/inventory/warkop', label: 'Inventory Warkop', icon: '📦', permission: 'inventory', group: 'Inventory' });
registerNavItem({ path: '/laporan', label: 'Laporan', icon: '📊', permission: 'laporan', group: 'Operasional' });
registerNavItem({ path: '/shift', label: 'Closing Shift', icon: '🧮', permission: 'closingShift', group: 'Operasional' });
registerNavItem({ path: '/gaji-capster', label: 'Gaji Capster', icon: '💰', permission: 'gajiCapster', group: 'Operasional' });
registerNavItem({ path: '/pelanggan', label: 'Pelanggan', icon: '👥', permission: 'pelanggan', group: 'Operasional' });
registerNavItem({ path: '/owner/users', label: 'Kelola User', icon: '🔑', permission: 'kelolaUser', group: 'Owner Panel' });
registerNavItem({ path: '/owner/transaksi', label: 'Kelola Transaksi', icon: '🗂️', permission: 'editTransaksi', group: 'Owner Panel' });
registerNavItem({ path: '/owner/audit-log', label: 'Audit Log', icon: '📜', permission: 'auditLog', group: 'Owner Panel' });
registerNavItem({ path: '/owner/backup', label: 'Backup & Restore', icon: '🗄️', permission: 'backupRestore', group: 'Owner Panel' });

const appEl = document.getElementById('app');
let currentShellMode = null; // 'guest' | 'app'
let layoutCleanup = null;

function mountShell() {
  const nextMode = isAuthenticated() ? 'app' : 'guest';
  if (nextMode === currentShellMode) return;
  currentShellMode = nextMode;

  if (typeof layoutCleanup === 'function') layoutCleanup();
  layoutCleanup = null;
  appEl.innerHTML = '';

  if (nextMode === 'app') {
    const { pageRoot, cleanup } = renderLayout(appEl);
    layoutCleanup = cleanup;
    initRouter(pageRoot);
  } else {
    initRouter(appEl);
  }
}

async function bootstrap() {
  initTheme();
  initPWA();
  document.getElementById('splash')?.remove();
  await verifySession();
  mountShell();
  authStore.subscribe(mountShell);
}

bootstrap();
