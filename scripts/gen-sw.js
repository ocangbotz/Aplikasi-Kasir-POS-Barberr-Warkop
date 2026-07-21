'use strict';
/**
 * scripts/gen-sw.js
 * Menghasilkan frontend/sw.js (service worker) dari daftar file runtime
 * frontend yang sesungguhnya, plus versi cache dari hash konten file
 * tersebut -- supaya setiap perubahan pada frontend otomatis membuat cache
 * lama basi (dan dibuang saat activate) tanpa perlu menaikkan nomor versi
 * secara manual.
 *
 * Hanya file yang benar-benar dipakai saat runtime yang di-precache
 * (index.html, manifest, assets/css, assets/js, assets/icons) --
 * frontend/src/css/input.css (source Tailwind sebelum build) sengaja
 * dilewati.
 *
 * Jalankan: npm run build:sw (setelah build:css, sebelum deploy/test PWA)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FRONTEND = path.join(__dirname, '..', 'frontend');
const CACHE_EXTENSIONS = new Set(['.html', '.css', '.js', '.png', '.svg', '.webmanifest', '.ico']);
const RUNTIME_ROOTS = ['index.html', 'manifest.webmanifest', 'assets/css', 'assets/js', 'assets/icons'];

function walk(fullPath, relPath, files) {
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    fs.readdirSync(fullPath).forEach((name) => {
      walk(path.join(fullPath, name), relPath ? `${relPath}/${name}` : name, files);
    });
    return;
  }
  if (CACHE_EXTENSIONS.has(path.extname(fullPath))) files.push(relPath);
}

const files = [];
RUNTIME_ROOTS.forEach((rootRel) => {
  const fullPath = path.join(FRONTEND, rootRel);
  if (fs.existsSync(fullPath)) walk(fullPath, rootRel, files);
});
files.sort();

const hash = crypto.createHash('sha1');
files.forEach((rel) => hash.update(rel).update(fs.readFileSync(path.join(FRONTEND, rel))));
const version = hash.digest('hex').slice(0, 10);

const precacheUrls = ['./'].concat(files.map((f) => './' + f));

const template = `/**
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
const CACHE_NAME = 'kbw-cache-${version}';
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

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
`;

fs.writeFileSync(path.join(FRONTEND, 'sw.js'), template);
console.log(`[gen-sw] frontend/sw.js dibuat -- versi cache: ${version} (${files.length} file di-precache)`);
