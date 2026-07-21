# Fase 2 — Frontend Foundation

Fase ini membangun kerangka aplikasi: build CSS, shell HTML, autentikasi,
routing SPA, dark/light mode, dan layout responsif. Modul bisnis (Barber,
Warkop, dashboard, dst.) akan ditambahkan di fase-fase berikutnya di atas
kerangka ini.

## Struktur

```
frontend/
  index.html              Shell HTML satu-satunya (SPA)
  src/css/input.css        Sumber Tailwind (edit di sini)
  assets/css/app.css       Hasil build Tailwind (JANGAN diedit manual)
  assets/js/
    core/
      config.js            API_BASE_URL -- EDIT INI saat deploy ke produksi
      api.js                Wrapper fetch ke backend (kontrak text/plain + JSON)
      auth.js               Login/logout/sesi/permission (UI-side)
      state.js              Store reaktif minimal (pub/sub)
      router.js             Hash router (#/path), modular lewat registerRoute()
      nav.js                Registry menu sidebar, modular lewat registerNavItem()
      theme.js              Dark/Light/System mode
      storage.js            localStorage helper (namespaced + JSON)
      toast.js              Notifikasi ringan
    pages/
      login.js, layout.js, home.js
    app.js                  Entry point -- mendaftarkan rute & menu, lalu boot
backend/test/
  devServer.js              Server lokal untuk development & testing (BUKAN produksi)
  e2e/run.js                Test end-to-end (Chromium asli via Playwright)
```

## Menjalankan Secara Lokal (development)

```bash
npm install
npm run build:css      # build sekali, atau:
npm run watch:css      # build otomatis saat file CSS berubah
npm run dev:server      # jalankan backend tiruan di http://localhost:8787
```

Buka `http://localhost:8787` di browser. Saat pertama kali start,
`dev:server` akan mencetak kredensial Owner acak ke terminal, contoh:

```
[dev-server] Login pertama -> username: owner / password: 707b81ad
```

> `devServer.js` menjalankan **logika backend asli** (`backend/src/*.gs`)
> lewat mock runtime GAS di Node -- ini murni alat development/testing agar
> frontend bisa dites di browser sungguhan tanpa perlu deploy ke Google
> lebih dulu. Data hilang setiap server di-restart. **Produksi selalu
> memakai Google Apps Script + Google Sheets sungguhan** (lihat
> `docs/01-SETUP-BACKEND.md`).

## Menghubungkan ke Backend Produksi (Apps Script sungguhan)

Setelah backend di-deploy (Fase 1, langkah 4), edit satu baris di
`frontend/assets/js/core/config.js`:

```js
API_BASE_URL: isLocalDev
  ? '/api'
  : 'https://script.google.com/macros/s/DEPLOYMENT_ID_ANDA/exec',
```

Lalu build ulang CSS (`npm run build:css`) dan upload folder `frontend/`
(termasuk `assets/`) ke hosting statis pilihan Anda (GitHub Pages, Netlify,
Cloudflare Pages, atau server web biasa). Tidak perlu Node.js di server
produksi -- semua file di `frontend/` adalah HTML/CSS/JS statis.

## Kenapa Kontrak `text/plain` + Token di Body?

Google Apps Script Web App tidak bisa merespons **CORS preflight**
(`OPTIONS`) dengan header yang benar. Browser hanya melewati permintaan
`POST` tanpa preflight jika `Content-Type`-nya termasuk salah satu dari
`text/plain`, `application/x-www-form-urlencoded`, atau
`multipart/form-data`, dan tidak ada header custom (seperti
`Authorization`). Karena itu:
- Body dikirim sebagai **string JSON** dengan header `Content-Type: text/plain`.
- Token sesi disisipkan **di dalam body JSON** (`{ action, token, ... }`), bukan di header.

Lihat implementasinya di `frontend/assets/js/core/api.js` dan
`backend/src/Code.gs`.

## Arsitektur Modular

- **Routing**: modul baru cukup memanggil `registerRoute('/path', { permission, title, render })` dari `app.js` -- `router.js` sendiri tidak perlu diubah.
- **Menu sidebar**: modul baru memanggil `registerNavItem({ path, label, icon })` -- otomatis muncul di sidebar (terfilter oleh permission lewat `route.permission`, dicek `router.js`).
- **Permission**: satu sumber kebenaran ada di backend (`backend/src/Config.gs PERMISSIONS`). Salinan di `frontend/assets/js/core/auth.js` HANYA untuk UI gating (sembunyikan tombol/menu) -- backend selalu validasi ulang.

## Pengujian

Dua lapis pengujian dipakai (tidak ada yang saling menggantikan):

1. **Unit backend** (logika murni, cepat):
   ```bash
   npm run test:backend
   ```
2. **End-to-end** (browser Chromium asli, memverifikasi UI + integrasi penuh):
   ```bash
   npm run test:e2e
   ```
   Script ini men-spawn `devServer.js` di port terpisah (8799), mengambil
   kredensial Owner otomatis, lalu menjalankan skenario nyata di Chromium:
   login gagal/sukses, ketahanan sesi setelah reload, dark mode + persistensi,
   ganti password (tolak/terima), logout, login ulang dengan password baru,
   dan tampilan mobile (sidebar hamburger). Semua 16 skenario harus lulus.

## Checklist Fase 2 (selesai & teruji)

- [x] Build pipeline Tailwind CSS v4 -> file statis (`assets/css/app.css`)
- [x] Shell SPA (`index.html`) dengan anti-FOUC untuk dark mode
- [x] Login (glassmorphism), validasi, pesan error dari backend
- [x] Sesi tersimpan & divalidasi ulang ke server saat app dibuka (`verifySession`)
- [x] Ganti password (end-to-end ke backend, teruji)
- [x] Layout responsif: sidebar collapsible di mobile, topbar, dropdown user
- [x] Dark/Light/System mode, persisten di localStorage
- [x] Router modular berbasis hash + permission gating
- [x] Warna brand 🟦 Barber / 🟧 Warkop / 🟩 Gabungan didefinisikan di theme Tailwind
