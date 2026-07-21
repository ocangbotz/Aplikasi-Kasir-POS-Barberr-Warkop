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
import { apiCall } from '../../core/api.js';

// Struktur nav: item lepas (tanpa group) tampil langsung; item dgn `group`
// dikelompokkan di bawah judul berwarna (biru=Barber, oranye=Warkop,
// hijau=Gabungan) sesuai konvensi warna di spesifikasi. Grup yang SEMUA
// item-nya tidak boleh diakses role saat ini otomatis tidak ditampilkan.
const NAV_ITEMS = [
  { path: '/', label: 'Beranda', icon: '🏠', roles: null },
  {
    group: 'Dashboard', color: 'gabungan',
    items: [
      { path: '/dashboard/gabungan', label: 'Dashboard Gabungan', icon: '📊', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/dashboard/barber', label: 'Dashboard Barber', icon: '📊', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/dashboard/warkop', label: 'Dashboard Warkop', icon: '📊', roles: ['Owner', 'Admin', 'Kasir'] }
    ]
  },
  {
    group: 'Barber', color: 'barber',
    items: [
      { path: '/barber/transaksi', label: 'Transaksi Baru', icon: '🧾', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/riwayat', label: 'Riwayat Transaksi', icon: '📋', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/pelanggan', label: 'Data Pelanggan', icon: '🙍', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/layanan', label: 'Layanan', icon: '💈', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/capster', label: 'Capster', icon: '✂️', roles: ['Owner', 'Admin'] },
      { path: '/barber/inventory', label: 'Inventory Barber', icon: '📦', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/barber/pengeluaran', label: 'Pengeluaran Barber', icon: '💸', roles: ['Owner', 'Admin', 'Kasir'] }
    ]
  },
  {
    group: 'Warkop', color: 'warkop',
    items: [
      { path: '/warkop/transaksi', label: 'Pesanan Baru', icon: '🧾', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/warkop/riwayat', label: 'Riwayat Transaksi', icon: '📋', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/warkop/menu', label: 'Menu', icon: '☕', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/warkop/inventory', label: 'Inventory Warkop', icon: '📦', roles: ['Owner', 'Admin', 'Kasir'] },
      { path: '/warkop/pengeluaran', label: 'Pengeluaran Warkop', icon: '💸', roles: ['Owner', 'Admin', 'Kasir'] }
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
            ${hasRole(user, ['Owner', 'Admin', 'Kasir']) ? `
            <div class="relative">
              <button id="btn-low-stock" type="button" class="btn-outline relative !px-2.5 !py-2" aria-label="Notifikasi stok rendah">
                🔔<span id="low-stock-badge" class="absolute -right-1 -top-1 hidden min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white"></span>
              </button>
              <div id="low-stock-dropdown" class="absolute right-0 z-30 mt-2 hidden w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"></div>
            </div>` : ''}
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

  initLowStockBell(rootEl);

  return rootEl.querySelector('#page-content');
}

async function initLowStockBell(rootEl) {
  const btn = rootEl.querySelector('#btn-low-stock');
  if (!btn) return;
  const badge = rootEl.querySelector('#low-stock-badge');
  const dropdown = rootEl.querySelector('#low-stock-dropdown');

  let items = [];
  try {
    items = await apiCall('inventory.view', { summary: true });
  } catch (err) {
    return; // notifikasi bersifat non-kritis, diamkan kalau gagal
  }

  if (items.length > 0) {
    badge.textContent = String(items.length);
    badge.classList.remove('hidden');
  }

  dropdown.innerHTML = items.length
    ? items
        .map(
          (i) => `
      <a href="#/${i.jenisUsaha.toLowerCase()}/inventory" class="block border-b border-slate-100 px-3 py-2 text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800" data-nav-link>
        <div class="font-medium">${escapeHtml(i.nama)} <span class="badge-neutral">${escapeHtml(i.jenisUsaha)}</span></div>
        <div class="text-xs text-red-600 dark:text-red-400">Sisa ${escapeHtml(i.stok)} ${escapeHtml(i.satuan)} (min. ${escapeHtml(i.stokMinimum)})</div>
      </a>`
        )
        .join('')
    : '<p class="p-3 text-center text-sm text-slate-400">Semua stok aman.</p>';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => dropdown.classList.add('hidden'));
}

/** Bungkus render function halaman supaya otomatis dipasangi shell. */
export function withShell(pageRenderFn) {
  return async (rootEl, params) => {
    const contentEl = renderShellInto(rootEl);
    await pageRenderFn(contentEl, params);
  };
}
