/**
 * sw.js (DIHASILKAN OTOMATIS oleh scripts/gen-sw.js -- jangan edit manual)
 * Service Worker: precache app-shell untuk instalasi PWA + akses offline.
 * Strategi: cache-first untuk semua asset ter-precache (instan & offline-ready
 * begitu terinstall), fallback network + cache-opportunistik untuk request
 * lain, dan fallback ke index.html untuk navigasi saat offline (SPA shell).
 *
 * Request ke /api SENGAJA dilewati (network-only) supaya data kasir selalu
 * fresh -- kegagalan jaringan ditangani apiCall() (lihat core/api.js,
 * ApiError kode NETWORK_ERROR), bukan oleh Service Worker.
 */
const CACHE_NAME = 'kbw-cache-593099deb9';
const PRECACHE_URLS = [
  "./",
  "./assets/css/app.css",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/js/app.js",
  "./assets/js/core/api.js",
  "./assets/js/core/auth.js",
  "./assets/js/core/charts.js",
  "./assets/js/core/config.js",
  "./assets/js/core/export.js",
  "./assets/js/core/format.js",
  "./assets/js/core/nav.js",
  "./assets/js/core/pwa.js",
  "./assets/js/core/router.js",
  "./assets/js/core/state.js",
  "./assets/js/core/storage.js",
  "./assets/js/core/theme.js",
  "./assets/js/core/toast.js",
  "./assets/js/pages/audit-log/index.js",
  "./assets/js/pages/barber/capster.js",
  "./assets/js/pages/barber/layanan.js",
  "./assets/js/pages/barber/riwayat.js",
  "./assets/js/pages/barber/struk.js",
  "./assets/js/pages/barber/transaksi.js",
  "./assets/js/pages/dashboard/barber.js",
  "./assets/js/pages/dashboard/gabungan.js",
  "./assets/js/pages/dashboard/shared.js",
  "./assets/js/pages/dashboard/warkop.js",
  "./assets/js/pages/gaji-capster/index.js",
  "./assets/js/pages/home.js",
  "./assets/js/pages/inventory/barber.js",
  "./assets/js/pages/inventory/shared.js",
  "./assets/js/pages/inventory/warkop.js",
  "./assets/js/pages/laporan/index.js",
  "./assets/js/pages/layout.js",
  "./assets/js/pages/login.js",
  "./assets/js/pages/owner/backup.js",
  "./assets/js/pages/owner/transaksi.js",
  "./assets/js/pages/owner/users.js",
  "./assets/js/pages/pelanggan/index.js",
  "./assets/js/pages/pengeluaran/barber.js",
  "./assets/js/pages/pengeluaran/shared.js",
  "./assets/js/pages/pengeluaran/warkop.js",
  "./assets/js/pages/shift/index.js",
  "./assets/js/pages/warkop/pesanan.js",
  "./assets/js/pages/warkop/produk.js",
  "./assets/js/pages/warkop/riwayat.js",
  "./assets/js/pages/warkop/struk.js",
  "./assets/js/vendor/chart.umd.min.js",
  "./assets/js/vendor/jspdf.plugin.autotable.min.js",
  "./assets/js/vendor/jspdf.umd.min.js",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
