/**
 * app.js
 * Entry point aplikasi. Mendaftarkan tema, rute, dan menu, lalu boot.
 * File modul fase berikutnya (Barber, Warkop, dst.) akan diimpor & didaftarkan
 * di sini juga -- app.js sengaja tetap tipis, logika sesungguhnya ada di
 * masing-masing modul.
 */
import { initTheme } from './core/theme.js';
import { authStore, isAuthenticated, verifySession } from './core/auth.js';
import { initRouter, registerRoute } from './core/router.js';
import { registerNavItem } from './core/nav.js';
import { renderLogin } from './pages/login.js';
import { renderLayout } from './pages/layout.js';
import { renderHome } from './pages/home.js';
import { renderBarberTransaksi } from './pages/barber/transaksi.js';
import { renderBarberRiwayat } from './pages/barber/riwayat.js';
import { renderBarberLayanan } from './pages/barber/layanan.js';
import { renderBarberCapster } from './pages/barber/capster.js';
import { renderWarkopPesanan } from './pages/warkop/pesanan.js';
import { renderWarkopRiwayat } from './pages/warkop/riwayat.js';
import { renderWarkopProduk } from './pages/warkop/produk.js';
import { renderInventoryBarber } from './pages/inventory/barber.js';
import { renderInventoryWarkop } from './pages/inventory/warkop.js';
import { renderPengeluaranBarber } from './pages/pengeluaran/barber.js';
import { renderPengeluaranWarkop } from './pages/pengeluaran/warkop.js';
import { renderDashboardGabungan } from './pages/dashboard/gabungan.js';
import { renderDashboardBarber } from './pages/dashboard/barber.js';
import { renderDashboardWarkop } from './pages/dashboard/warkop.js';
import { renderLaporan } from './pages/laporan/index.js';
import { renderShift } from './pages/shift/index.js';
import { renderGajiCapster } from './pages/gaji-capster/index.js';
import { renderPelanggan } from './pages/pelanggan/index.js';
import { renderAuditLog } from './pages/audit-log/index.js';
import { renderOwnerUsers } from './pages/owner/users.js';
import { renderOwnerTransaksi } from './pages/owner/transaksi.js';
import { renderOwnerBackup } from './pages/owner/backup.js';

registerRoute('/login', { public: true, title: 'Masuk', render: renderLogin });
registerRoute('/', { permission: 'dashboard', title: 'Dashboard Gabungan', render: renderDashboardGabungan });
registerRoute('/dashboard/barber', { permission: 'dashboard', title: 'Dashboard Barber', render: renderDashboardBarber });
registerRoute('/dashboard/warkop', { permission: 'dashboard', title: 'Dashboard Warkop', render: renderDashboardWarkop });
registerRoute('/profil', { title: 'Profil Saya', render: renderHome });

registerRoute('/barber/transaksi', { permission: 'transaksiBarber', title: 'Transaksi Barber', render: renderBarberTransaksi });
registerRoute('/barber/riwayat', { permission: 'transaksiBarber', title: 'Riwayat Barber', render: renderBarberRiwayat });
registerRoute('/barber/layanan', { permission: 'kelolaLayananProduk', title: 'Layanan Barber', render: renderBarberLayanan });
registerRoute('/barber/capster', { permission: 'kelolaCapster', title: 'Data Capster', render: renderBarberCapster });

registerRoute('/warkop/pesanan', { permission: 'transaksiWarkop', title: 'Pesanan Warkop', render: renderWarkopPesanan });
registerRoute('/warkop/riwayat', { permission: 'transaksiWarkop', title: 'Riwayat Warkop', render: renderWarkopRiwayat });
registerRoute('/warkop/produk', { permission: 'kelolaLayananProduk', title: 'Menu Warkop', render: renderWarkopProduk });

registerRoute('/inventory/barber', { permission: 'inventory', title: 'Inventory Barber', render: renderInventoryBarber });
registerRoute('/inventory/warkop', { permission: 'inventory', title: 'Inventory Warkop', render: renderInventoryWarkop });

registerRoute('/pengeluaran/barber', { permission: 'pengeluaran', title: 'Pengeluaran Barber', render: renderPengeluaranBarber });
registerRoute('/pengeluaran/warkop', { permission: 'pengeluaran', title: 'Pengeluaran Warkop', render: renderPengeluaranWarkop });

registerRoute('/laporan', { permission: 'laporan', title: 'Laporan', render: renderLaporan });
registerRoute('/shift', { permission: 'closingShift', title: 'Closing Shift', render: renderShift });
registerRoute('/gaji-capster', { permission: 'gajiCapster', title: 'Gaji Capster', render: renderGajiCapster });
registerRoute('/pelanggan', { permission: 'pelanggan', title: 'Data Pelanggan', render: renderPelanggan });

registerRoute('/owner/users', { permission: 'kelolaUser', title: 'Kelola User', render: renderOwnerUsers });
registerRoute('/owner/transaksi', { permission: 'editTransaksi', title: 'Kelola Transaksi', render: renderOwnerTransaksi });
registerRoute('/owner/audit-log', { permission: 'auditLog', title: 'Audit Log', render: renderAuditLog });
registerRoute('/owner/backup', { permission: 'backupRestore', title: 'Backup & Restore', render: renderOwnerBackup });
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
  document.getElementById('splash')?.remove();
  await verifySession();
  mountShell();
  authStore.subscribe(mountShell);
}

bootstrap();
