# Fase 9 — PWA (Manifest, Service Worker, Ikon, Offline, Install)

Aplikasi bisa di-install ke Android/Desktop (dan Add to Home Screen di iOS)
dan tetap menampilkan app-shell (shell navigasi + halaman yang pernah
dikunjungi) walau koneksi internet terputus.

## Yang Dibangun

- `frontend/manifest.webmanifest` — nama, warna tema, `display: standalone`,
  dan 4 ikon (192/512, purpose `any` & `maskable`).
- `frontend/assets/icons/*.png` — ikon nyata (bukan placeholder) dirender
  dari desain gunting gradien biru→oranye yang sama dengan favicon SVG yang
  sudah ada sejak Fase 2, memakai Chromium (Playwright) untuk merender SVG
  ke PNG pada tiap ukuran. Ikon `maskable` sengaja memakai ukuran glyph
  lebih kecil & tanpa sudut membulat pra-render (latar penuh satu warna
  sampai tepi) supaya tetap aman saat di-crop OS ke bentuk lingkaran/squircle.
- `scripts/gen-sw.js` — generator `frontend/sw.js`. Memindai file runtime
  frontend yang sesungguhnya (`index.html`, `manifest.webmanifest`,
  `assets/css`, `assets/js`, `assets/icons` — sengaja TIDAK termasuk
  `frontend/src/css/input.css` karena itu source Tailwind sebelum build,
  tidak pernah diakses browser), lalu menuliskan daftar precache + versi
  cache dari hash konten file-file itu ke `frontend/sw.js`. Jalankan
  `npm run build:sw` setiap kali ada perubahan di `frontend/assets/` supaya
  cache versi baru otomatis menggantikan cache lama (bukan angka versi yang
  dinaikkan manual dan gampang lupa).
- `frontend/sw.js` (dihasilkan, jangan edit manual) — strategi cache-first
  untuk semua asset ter-precache (instan & offline-ready begitu terinstall),
  network dengan cache-opportunistik untuk request lain, dan fallback ke
  `index.html` saat navigasi gagal offline (SPA shell). Request ke `/api`
  sengaja **tidak** disentuh Service Worker (network-only) -- data kasir
  harus selalu fresh; kegagalan jaringan tetap ditangani `core/api.js`
  (`ApiError` kode `NETWORK_ERROR`) seperti sebelumnya.
- `core/pwa.js` — registrasi Service Worker, penangkap event
  `beforeinstallprompt` untuk tombol "Install App" custom di topbar
  (`pages/layout.js`), dan bar notifikasi "Versi baru tersedia" saat
  Service Worker baru selesai ter-install (klik "Muat Ulang" mengirim
  `SKIP_WAITING` lalu reload).

## Bug yang Ditemukan & Diperbaiki: Reload Tak Terduga Saat Install Pertama

Percobaan pertama memakai pola umum "dengarkan `controllerchange` ->
`window.location.reload()`" untuk mengaktifkan Service Worker baru. Saat
diuji end-to-end, ini menyebabkan **reload tak terduga bahkan pada
pemuatan PERTAMA** (bukan cuma saat update) -- `clients.claim()` di handler
`activate` Service Worker memicu event `controllerchange` juga pada
halaman yang sebelumnya *belum pernah* dikontrol Service Worker manapun,
bukan cuma pada pergantian versi. Diperbaiki dengan flag `updateRequested`
yang hanya di-set `true` saat user sendiri mengklik tombol "Muat Ulang" di
bar notifikasi update -- `controllerchange` di luar itu (termasuk klaim
pertama) diabaikan.

## Testing

```bash
npm run build:css
npm run build:sw    # generate ulang sw.js setelah build:css (urutan penting: app.css harus final dulu)
npm run test:backend
npm run test:e2e:pwa   # 12 skenario end-to-end Chromium
```

E2E `pwa.js` memverifikasi:
- Tag `<link rel="manifest">` & isi `manifest.webmanifest` (nama, `display`,
  4 ikon dengan `sizes`/`purpose` yang benar).
- Semua file ikon (termasuk `apple-touch-icon.png`) benar-benar bisa
  diakses (`200 OK`, `Content-Type: image/png`) -- bukan referensi rusak.
- Service Worker benar-benar aktif (`navigator.serviceWorker.ready`) dan
  `index.html` benar-benar ada di Cache Storage.
- Tombol "Install App" ada di topbar, tersembunyi sampai browser
  menawarkan prompt install.
- **Skenario offline sungguhan**: `browserContext.setOffline(true)`, lalu
  reload halaman -- shell aplikasi (sidebar + topbar dengan nama user dari
  localStorage) tetap tampil dari cache Service Worker, dan navigasi
  hash-router ke halaman lain (Laporan) tetap berfungsi karena modul JS
  halaman tersebut sudah ter-precache. Console error `ERR_INTERNET_DISCONNECTED`
  yang muncul akibat percobaan fetch `/api` saat sengaja offline dianggap
  **bukti fitur bekerja** (bukan kegagalan) dan sengaja dikecualikan dari
  assertion "tidak ada console error".

Regresi penuh (96 unit test backend + seluruh suite e2e Fase 2–9, ~121
skenario) dijalankan ulang setelah penambahan modul ini; semuanya tetap
hijau.

## Checklist Fase 9 (selesai & teruji)

- [x] `manifest.webmanifest` valid: nama, warna tema, `display: standalone`, ikon any + maskable
- [x] Ikon PWA nyata (192/512 + maskable + apple-touch-icon), bukan placeholder
- [x] Service Worker: precache app-shell (HTML/CSS/JS/vendor/ikon) dengan versi cache otomatis dari hash konten
- [x] Offline: shell aplikasi + halaman yang pernah dikunjungi tetap tampil tanpa koneksi
- [x] API tetap network-only (data kasir tidak pernah disajikan dari cache basi)
- [x] Tombol "Install App" custom di topbar (event `beforeinstallprompt`)
- [x] Notifikasi "Versi baru tersedia" + reload terkendali (hanya saat diminta user, bug reload tak terduga ditemukan & diperbaiki)
