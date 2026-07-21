/**
 * pages/layout.js
 * Shell aplikasi setelah login: topbar + sidebar + area konten (<main>).
 * Dirender SEKALI per sesi login (lihat assets/js/app.js) -- router hanya
 * mengganti isi <main>, sehingga navigasi antar halaman tidak flicker.
 */
import { getCurrentUser, hasPermission, logout } from '../core/auth.js';
import { getNavItems } from '../core/nav.js';
import { currentPath, navigate } from '../core/router.js';
import { themeStore, toggleTheme } from '../core/theme.js';
import { APP_CONFIG } from '../core/config.js';
import { apiCall } from '../core/api.js';
import { onInstallAvailabilityChange, promptInstall, isRunningStandalone } from '../core/pwa.js';

const NOTIF_REFRESH_MS = 60000;

function navLinkHtml(item) {
  return `
    <a href="#${item.path}" data-nav-link data-path="${item.path}" class="nav-link">
      <span class="text-base leading-none">${item.icon}</span>
      <span>${item.label}</span>
    </a>`;
}

/** Render nav-list dengan judul grup (mis. "Barber") jika item.group berbeda dari item sebelumnya. */
function navListHtml(items) {
  let lastGroup;
  let html = '';
  items.forEach((item) => {
    if (item.group && item.group !== lastGroup) {
      html += `<p class="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:mt-0">${item.group}</p>`;
    }
    html += navLinkHtml(item);
    lastGroup = item.group;
  });
  return html;
}

function themeIcon(mode) {
  if (mode === 'dark') return '🌙';
  if (mode === 'light') return '☀️';
  return '🖥️';
}

export function renderLayout(root) {
  const user = getCurrentUser();
  const items = getNavItems().filter((item) => !item.permission || hasPermission(item.permission));

  root.innerHTML = `
    <div class="min-h-screen lg:flex">
      <div id="sidebar-overlay" class="fixed inset-0 z-30 hidden bg-slate-900/40 lg:hidden"></div>

      <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 w-64 -translate-x-full transform border-r border-slate-200/70 bg-white/90 p-4 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 lg:border-slate-200 dark:border-white/10 dark:bg-slate-900/90 lg:dark:bg-slate-950">
        <div class="mb-6 flex items-center gap-2 px-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-barber-500 to-warkop-500 text-white shadow">✂</div>
          <div>
            <p class="text-sm font-bold leading-tight text-slate-900 dark:text-white">${APP_CONFIG.APP_NAME}</p>
          </div>
        </div>
        <nav id="nav-list" class="space-y-1">
          ${navListHtml(items)}
        </nav>
      </aside>

      <div class="flex min-h-screen flex-1 flex-col">
        <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
          <button id="sidebar-toggle" type="button" class="btn-ghost !px-2.5 lg:hidden" aria-label="Buka menu">
            <span class="text-lg">☰</span>
          </button>

          <div class="flex-1"></div>

          <button id="install-app-btn" type="button" class="btn-ghost hidden items-center gap-1.5 border border-slate-200 !py-1.5 text-xs dark:border-white/10" title="Install aplikasi ke perangkat">
            <span>📲</span><span class="hidden md:inline">Install App</span>
          </button>

          <button id="theme-toggle" type="button" class="btn-ghost !px-2.5" title="Ganti tema">
            <span id="theme-icon" class="text-base">${themeIcon(themeStore.get())}</span>
          </button>

          ${hasPermission('inventory') ? `
          <div class="relative">
            <button id="notif-bell" type="button" class="btn-ghost relative !px-2.5" title="Notifikasi stok">
              <span class="text-base">🔔</span>
              <span id="notif-badge" class="absolute -top-0.5 -right-0.5 hidden min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">0</span>
            </button>
            <div id="notif-panel" class="glass-card absolute right-0 z-30 mt-2 hidden w-72 overflow-hidden">
              <p class="border-b border-slate-200/70 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-400 dark:border-white/10">Stok Hampir Habis</p>
              <div id="notif-list" class="max-h-72 overflow-y-auto p-1.5 text-sm"></div>
            </div>
          </div>` : ''}

          <div class="relative">
            <button id="user-menu-btn" type="button" class="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-900/5 dark:hover:bg-white/10">
              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                ${(user?.nama || '?').charAt(0).toUpperCase()}
              </div>
              <div class="hidden text-left sm:block">
                <p class="text-sm font-semibold leading-tight text-slate-900 dark:text-white">${user?.nama || ''}</p>
                <p class="text-xs leading-tight text-slate-500 dark:text-slate-400">${user?.role || ''}</p>
              </div>
            </button>
            <div id="user-menu" class="glass-card absolute right-0 z-30 mt-2 hidden w-44 overflow-hidden p-1.5">
              <a href="#/profil" data-nav-link data-path="/profil" class="nav-link !justify-start">👤 Profil Saya</a>
              <button id="logout-btn" type="button" class="nav-link w-full !justify-start text-red-600 dark:text-red-400">🚪 Keluar</button>
            </div>
          </div>
        </header>

        <main id="page-content" class="flex-1 p-4 lg:p-6"></main>
      </div>
    </div>
  `;

  const cleanup = wireInteractions(root);
  return { pageRoot: root.querySelector('#page-content'), cleanup };
}

function wireInteractions(root) {
  const sidebar = root.querySelector('#sidebar');
  const overlay = root.querySelector('#sidebar-overlay');
  const sidebarToggle = root.querySelector('#sidebar-toggle');

  const openSidebar = () => {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  };
  const closeSidebar = () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  };
  sidebarToggle.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  root.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      closeUserMenu();
      navigate(link.dataset.path);
    });
  });

  const themeToggle = root.querySelector('#theme-toggle');
  const themeIconEl = root.querySelector('#theme-icon');
  themeToggle.addEventListener('click', () => {
    toggleTheme();
    themeIconEl.textContent = themeIcon(themeStore.get());
  });

  const userMenuBtn = root.querySelector('#user-menu-btn');
  const userMenu = root.querySelector('#user-menu');
  const closeUserMenu = () => userMenu.classList.add('hidden');
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', closeUserMenu);

  root.querySelector('#logout-btn').addEventListener('click', async () => {
    await logout();
  });

  const updateActiveLink = () => {
    const path = currentPath();
    root.querySelectorAll('[data-nav-link]').forEach((link) => {
      link.classList.toggle('active', link.dataset.path === path);
    });
  };
  updateActiveLink();
  window.addEventListener('hashchange', updateActiveLink);

  const notifTimer = wireNotificationBell(root);
  const unsubscribeInstall = wireInstallButton(root);
  return () => {
    if (notifTimer) clearInterval(notifTimer);
    unsubscribeInstall();
  };
}

/** Tombol "Install App" hanya tampil saat browser menawarkan prompt install (beforeinstallprompt) dan belum berjalan sebagai app terinstall. */
function wireInstallButton(root) {
  const btn = root.querySelector('#install-app-btn');
  if (!btn || isRunningStandalone()) return () => {};

  btn.addEventListener('click', () => promptInstall());
  return onInstallAvailabilityChange((available) => {
    btn.classList.toggle('hidden', !available);
    btn.classList.toggle('flex', available);
  });
}

function notifRowHtml(label, items) {
  if (items.length === 0) return '';
  return `
    <p class="mt-2 px-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 first:mt-0">${label}</p>
    ${items.map((i) => `
      <div class="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-900/5 dark:hover:bg-white/10">
        <span class="truncate">${i.NamaItem || i.Nama}</span>
        <span class="text-xs font-semibold text-red-500">${i.Stok} ${i.Satuan || ''}</span>
      </div>`).join('')}`;
}

/** Notifikasi stok hampir habis (Inventory Barber/Warkop + Produk Warkop). Hanya untuk role dengan izin 'inventory'. */
function wireNotificationBell(root) {
  const bell = root.querySelector('#notif-bell');
  if (!bell) return null;

  const badge = root.querySelector('#notif-badge');
  const panel = root.querySelector('#notif-panel');
  const list = root.querySelector('#notif-list');

  async function refresh() {
    try {
      const summary = await apiCall('inventoryLowStockSummary', {});
      badge.textContent = String(summary.total);
      badge.classList.toggle('hidden', summary.total === 0);
      list.innerHTML = [
        notifRowHtml('Inventory Barber', summary.inventoryBarber),
        notifRowHtml('Inventory Warkop', summary.inventoryWarkop),
        notifRowHtml('Menu Warkop', summary.produkWarkop)
      ].join('') || '<p class="p-3 text-center text-xs text-slate-400">Semua stok aman.</p>';
    } catch {
      // Diam-diam gagal (mis. offline) -- badge tetap menampilkan nilai terakhir yang diketahui.
    }
  }

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (opening) refresh(); // data bisa berubah sejak refresh terakhir (mis. baru saja menyesuaikan stok)
  });
  document.addEventListener('click', () => panel.classList.add('hidden'));

  refresh();
  return setInterval(refresh, NOTIF_REFRESH_MS);
}
