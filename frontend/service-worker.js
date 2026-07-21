/**
 * service-worker.js — cache app shell untuk offline & install PWA.
 *
 * Strategi: precache file shell inti saat install, lalu untuk request GET
 * same-origin berikutnya pakai "cache lalu revalidate" (tampilkan versi cache
 * kalau ada supaya cepat & bisa offline, sekaligus perbarui cache di
 * background dari network). Request ke backend Apps Script (POST, cross-origin)
 * SENGAJA tidak pernah disentuh service worker ini — data transaksi harus
 * selalu fresh, bukan dari cache.
 *
 * Naikkan CACHE_VERSION setiap kali struktur file shell berubah signifikan
 * supaya client lama mengambil ulang cache yang benar.
 */

const CACHE_VERSION = 'pos-bw-v1';

const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // aksi mutasi (POST ke backend) tidak pernah lewat cache

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // biarkan request ke Apps Script/domain lain apa adanya

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || networkFetch;
    })
  );
});
