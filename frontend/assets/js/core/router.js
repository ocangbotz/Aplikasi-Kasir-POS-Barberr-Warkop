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
let renderToken = 0;

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

  // Token generasi render: kalau ada handleRouteChange() lain yang mulai
  // SEBELUM route.render() di bawah selesai (mis. dua navigasi ke rute yang
  // sama nyaris bersamaan), panggilan yang lebih lama harus membuang hasilnya
  // sendiri alih-alih menimpa bookkeeping (currentCleanup) milik panggilan
  // yang lebih baru -- mencegah dua instance komponen (mis. Chart.js) aktif
  // berebut DOM/canvas yang sama.
  const myToken = ++renderToken;

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch { /* cleanup best-effort */ }
  }
  currentCleanup = null;

  // Container BARU per-render (bukan appRoot.innerHTML='' di tempat). Banyak
  // halaman punya load() async internal (fetch data lalu root.querySelector(...)
  // untuk update DOM) yang baru selesai SETELAH navigasi berikutnya sudah
  // membersihkan appRoot -- kalau root lama & baru adalah elemen YANG SAMA,
  // querySelector itu pulang null dan menyebabkan error (mis. toast keliru
  // "Gagal memuat data dashboard" padahal user sudah pindah halaman). Dengan
  // container baru, render lama yang telat itu tetap memutasi subtree LAMA
  // yang sudah terlepas dari DOM -- aman & senyap, bukan meledak di halaman
  // yang sekarang aktif.
  const container = document.createElement('div');
  appRoot.replaceChildren(container);

  document.title = route.title ? `${route.title} · Kasir Barber & Warkop` : 'Kasir Barber & Warkop';
  const result = await route.render(container);

  if (myToken !== renderToken) {
    if (typeof result === 'function') {
      try { result(); } catch { /* cleanup best-effort */ }
    }
    return;
  }
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
