/**
 * router.js
 * Router hash-based (#/path) tanpa dependency. Modul lain mendaftarkan rute
 * lewat registerRoute() -- router inti tidak perlu tahu apa saja halaman
 * yang ada, supaya modul baru (Barber, Warkop, dst di fase berikutnya)
 * tinggal plug-in tanpa mengubah file ini.
 */
import { isAuthenticated, hasPermission } from './auth.js';

const routes = new Map();
let appRoot = null;
let currentCleanup = null;

/**
 * @param {string} path - contoh: '/', '/login', '/barber/transaksi'
 * @param {{permission?: string, render: (root: HTMLElement) => (Function|void|Promise), title?: string, public?: boolean}} config
 */
export function registerRoute(path, config) {
  routes.set(path, config);
}

export function currentPath() {
  return location.hash.slice(1) || '/';
}

export function navigate(path) {
  if (currentPath() === path) {
    handleRouteChange();
  } else {
    location.hash = path;
  }
}

async function handleRouteChange() {
  const path = currentPath();
  let route = routes.get(path);

  if (!route) {
    route = routes.get('/404');
  } else if (!route.public && !isAuthenticated()) {
    return navigate('/login');
  } else if (route.public && path === '/login' && isAuthenticated()) {
    return navigate('/');
  } else if (route.permission && !hasPermission(route.permission)) {
    route = routes.get('/403');
  }

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch { /* cleanup best-effort */ }
  }
  currentCleanup = null;
  appRoot.innerHTML = '';

  document.title = route.title ? `${route.title} · Kasir Barber & Warkop` : 'Kasir Barber & Warkop';
  const result = await route.render(appRoot);
  if (typeof result === 'function') currentCleanup = result;
}

let listenerAttached = false;

/**
 * Bisa dipanggil ulang saat root berpindah (mis. login/logout mengganti
 * antara shell "tamu" dan shell "aplikasi") -- listener hashchange hanya
 * dipasang sekali agar tidak menumpuk.
 */
export function initRouter(root) {
  appRoot = root;
  if (!listenerAttached) {
    window.addEventListener('hashchange', handleRouteChange);
    listenerAttached = true;
  }
  handleRouteChange();
}
