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

registerRoute('/login', { public: true, title: 'Masuk', render: renderLogin });
registerRoute('/', { title: 'Beranda', render: renderHome });

registerRoute('/barber/transaksi', { permission: 'transaksiBarber', title: 'Transaksi Barber', render: renderBarberTransaksi });
registerRoute('/barber/riwayat', { permission: 'transaksiBarber', title: 'Riwayat Barber', render: renderBarberRiwayat });
registerRoute('/barber/layanan', { permission: 'kelolaLayananProduk', title: 'Layanan Barber', render: renderBarberLayanan });
registerRoute('/barber/capster', { permission: 'kelolaCapster', title: 'Data Capster', render: renderBarberCapster });
registerRoute('/404', {
  public: true,
  title: 'Halaman Tidak Ditemukan',
  render: (root) => {
    root.innerHTML = `<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p class="text-5xl">🔍</p>
      <p class="mt-3 text-lg font-bold text-slate-900 dark:text-white">Halaman tidak ditemukan</p>
      <a href="#/" class="btn-primary mt-4">Kembali ke Beranda</a>
    </div>`;
  }
});
registerRoute('/403', {
  title: 'Akses Ditolak',
  render: (root) => {
    root.innerHTML = `<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p class="text-5xl">🚫</p>
      <p class="mt-3 text-lg font-bold text-slate-900 dark:text-white">Anda tidak memiliki akses ke halaman ini</p>
      <a href="#/" class="btn-primary mt-4">Kembali ke Beranda</a>
    </div>`;
  }
});

registerNavItem({ path: '/', label: 'Beranda', icon: '🏠' });
registerNavItem({ path: '/barber/transaksi', label: 'Transaksi', icon: '💈', permission: 'transaksiBarber', group: 'Barber' });
registerNavItem({ path: '/barber/riwayat', label: 'Riwayat', icon: '🧾', permission: 'transaksiBarber', group: 'Barber' });
registerNavItem({ path: '/barber/layanan', label: 'Layanan', icon: '✂️', permission: 'kelolaLayananProduk', group: 'Barber' });
registerNavItem({ path: '/barber/capster', label: 'Capster', icon: '🧑‍🔧', permission: 'kelolaCapster', group: 'Barber' });

const appEl = document.getElementById('app');
let currentShellMode = null; // 'guest' | 'app'

function mountShell() {
  const nextMode = isAuthenticated() ? 'app' : 'guest';
  if (nextMode === currentShellMode) return;
  currentShellMode = nextMode;
  appEl.innerHTML = '';

  if (nextMode === 'app') {
    const pageRoot = renderLayout(appEl);
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
