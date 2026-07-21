/**
 * pages/layout.js
 * Shell aplikasi setelah login: topbar + sidebar + area konten (<main>).
 * Dirender SEKALI per sesi login (lihat assets/js/app.js) -- router hanya
 * mengganti isi <main>, sehingga navigasi antar halaman tidak flicker.
 */
import { getCurrentUser, logout } from '../core/auth.js';
import { getNavItems } from '../core/nav.js';
import { currentPath, navigate } from '../core/router.js';
import { themeStore, toggleTheme } from '../core/theme.js';
import { APP_CONFIG } from '../core/config.js';

function navLinkHtml(item) {
  return `
    <a href="#${item.path}" data-nav-link data-path="${item.path}" class="nav-link">
      <span class="text-base leading-none">${item.icon}</span>
      <span>${item.label}</span>
    </a>`;
}

function themeIcon(mode) {
  if (mode === 'dark') return '🌙';
  if (mode === 'light') return '☀️';
  return '🖥️';
}

export function renderLayout(root) {
  const user = getCurrentUser();
  const items = getNavItems();

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
          ${items.map(navLinkHtml).join('')}
        </nav>
      </aside>

      <div class="flex min-h-screen flex-1 flex-col">
        <header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
          <button id="sidebar-toggle" type="button" class="btn-ghost !px-2.5 lg:hidden" aria-label="Buka menu">
            <span class="text-lg">☰</span>
          </button>

          <div class="flex-1"></div>

          <button id="theme-toggle" type="button" class="btn-ghost !px-2.5" title="Ganti tema">
            <span id="theme-icon" class="text-base">${themeIcon(themeStore.get())}</span>
          </button>

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
              <a href="#/" data-nav-link data-path="/" class="nav-link !justify-start">👤 Profil Saya</a>
              <button id="logout-btn" type="button" class="nav-link w-full !justify-start text-red-600 dark:text-red-400">🚪 Keluar</button>
            </div>
          </div>
        </header>

        <main id="page-content" class="flex-1 p-4 lg:p-6"></main>
      </div>
    </div>
  `;

  wireInteractions(root);
  return root.querySelector('#page-content');
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
}
