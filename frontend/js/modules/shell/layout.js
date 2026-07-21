/**
 * shell/layout.js — kerangka aplikasi (sidebar + topbar) untuk halaman yang
 * butuh login. Hanya menu yang fitur-nya BENAR-BENAR ada yang ditampilkan —
 * modul Dashboard/Barber/Warkop/dst. baru muncul di sini saat fasenya selesai
 * dibangun (Fase 3 dst.), supaya tidak ada link ke halaman kosong/dummy.
 */

import { getCurrentUser, logout, hasRole } from '../../core/auth.js';
import { navigate } from '../../core/router.js';
import { toggleTheme, escapeHtml } from '../../core/ui.js';
import { APP_META } from '../../core/config.js';

// Struktur nav: item lepas (tanpa group) tampil langsung; item dgn `group`
// dikelompokkan di bawah judul berwarna (biru=Barber, oranye=Warkop,
// hijau=Gabungan) sesuai konvensi warna di spesifikasi. Grup yang SEMUA
// item-nya tidak boleh diakses role saat ini otomatis tidak ditampilkan.
const NAV_ITEMS = [
  { path: '/', label: 'Beranda', icon: '🏠', roles: null },
  {
    group: 'Barber', color: 'barber',
    items: [
      { path: '/barber/transaksi', label: 'Transaksi Baru', icon: '🧾', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/riwayat', label: 'Riwayat Transaksi', icon: '📋', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/pelanggan', label: 'Data Pelanggan', icon: '🙍', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/layanan', label: 'Layanan', icon: '💈', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/capster', label: 'Capster', icon: '✂️', roles: ['Owner', 'Admin'] },
      { path: '/barber/pengeluaran', label: 'Pengeluaran Barber', icon: '💸', roles: ['Owner', 'Admin', 'Kasir'] }
    ]
  },
  { path: '/settings', label: 'Pengaturan', icon: '⚙️', roles: null },
  { path: '/users', label: 'Manajemen User', icon: '👥', roles: ['Owner'] },
  { path: '/audit-log', label: 'Audit Log', icon: '📜', roles: ['Owner', 'Admin'] },
  { path: '/backup', label: 'Backup & Restore', icon: '💾', roles: ['Owner'] }
];

function currentPath() {
  return window.location.hash.slice(1) || '/';
}

function navLinkHtml(item) {
  const active = currentPath() === item.path ? 'active' : '';
  return `<a href="#${item.path}" class="nav-link ${active}" data-nav-link>
    <span class="text-lg">${item.icon}</span><span>${item.label}</span>
  </a>`;
}

// Kelas warna per grup HARUS ditulis literal lengkap (bukan dirakit lewat
// template string seperti `text-${color}-600`) karena Tailwind men-scan kode
// sumber sebagai teks biasa untuk memutuskan utility mana yang di-generate —
// kelas yang hanya ada dalam bentuk ekspresi runtime tidak akan pernah masuk
// ke app.css hasil build.
const GROUP_COLOR_CLASSES = {
  barber: 'text-barber-600 dark:text-barber-400',
  warkop: 'text-warkop-600 dark:text-warkop-400',
  gabungan: 'text-gabungan-600 dark:text-gabungan-400'
};

function navHtml(user) {
  return NAV_ITEMS.map((entry) => {
    if (!entry.group) {
      if (entry.roles && !hasRole(user, entry.roles)) return '';
      return navLinkHtml(entry);
    }
    const visibleItems = entry.items.filter((item) => !item.roles || hasRole(user, item.roles));
    if (visibleItems.length === 0) return '';
    return `
      <div class="mt-3 px-3 text-xs font-semibold uppercase tracking-wide ${GROUP_COLOR_CLASSES[entry.color] || ''}">${entry.group}</div>
      ${visibleItems.map(navLinkHtml).join('')}
    `;
  }).join('');
}

/**
 * Render shell (dipanggil sekali per navigasi ke halaman ber-shell) lalu
 * kembalikan elemen kontainer kosong tempat halaman spesifik merender isinya.
 */
export function renderShellInto(rootEl) {
  const user = getCurrentUser();

  rootEl.innerHTML = `
    <div class="flex min-h-screen">
      <aside id="app-sidebar" class="fixed inset-y-0 left-0 z-40 w-64 -translate-x-full transform border-r border-white/40 bg-white/70 p-4 backdrop-blur-glass transition-transform dark:border-white/10 dark:bg-slate-900/70 lg:static lg:translate-x-0">
        <div class="mb-6 flex items-center gap-2 px-2">
          <span class="text-2xl">💈☕</span>
          <span class="text-base font-bold">${APP_META.shortName}</span>
        </div>
        <nav class="flex flex-col gap-1">${navHtml(user)}</nav>
      </aside>

      <div id="sidebar-overlay" class="fixed inset-0 z-30 hidden bg-slate-950/40 lg:hidden"></div>

      <div class="flex min-h-screen flex-1 flex-col lg:pl-0">
        <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/40 bg-white/60 px-4 py-3 backdrop-blur-glass dark:border-white/10 dark:bg-slate-950/60">
          <button id="btn-open-sidebar" type="button" class="btn-outline !px-2.5 !py-2 lg:hidden" aria-label="Buka menu">☰</button>
          <div class="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">${APP_META.name}</div>
          <div class="flex items-center gap-2">
            <button id="btn-toggle-theme" type="button" class="btn-outline !px-2.5 !py-2" aria-label="Ganti tema">🌓</button>
            <div class="hidden text-right text-sm sm:block">
              <div class="font-medium">${user ? escapeHtml(user.name) : ''}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">${user ? escapeHtml(user.role) : ''}</div>
            </div>
            <button id="btn-logout" type="button" class="btn-outline">Keluar</button>
          </div>
        </header>

        <main id="page-content" class="flex-1 p-4 sm:p-6"></main>
      </div>
    </div>
  `;

  const sidebar = rootEl.querySelector('#app-sidebar');
  const overlay = rootEl.querySelector('#sidebar-overlay');
  rootEl.querySelector('#btn-open-sidebar').addEventListener('click', () => {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });
  rootEl.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    });
  });

  rootEl.querySelector('#btn-toggle-theme').addEventListener('click', toggleTheme);
  rootEl.querySelector('#btn-logout').addEventListener('click', async () => {
    await logout();
    navigate('/login');
  });

  return rootEl.querySelector('#page-content');
}

/** Bungkus render function halaman supaya otomatis dipasangi shell. */
export function withShell(pageRenderFn) {
  return async (rootEl, params) => {
    const contentEl = renderShellInto(rootEl);
    await pageRenderFn(contentEl, params);
  };
}
