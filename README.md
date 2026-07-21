# Aplikasi Kasir POS — Barber & Warkop

Aplikasi kasir modern untuk usaha yang mengelola **Barber** dan **Warkop**
dalam satu sistem: transaksi terpisah per usaha, 4 role login (Owner, Admin,
Kasir, Capster), dashboard gabungan + per-usaha, inventory, pengeluaran,
closing shift, gaji capster, laporan, dan PWA (bisa di-install Android &
Desktop, mendukung mode offline).

**Stack:** HTML5 · TailwindCSS · Vanilla JavaScript (ES6) · Google Apps
Script · Google Spreadsheet (database) · Chart.js · PWA.

## Status Proyek

Dikerjakan bertahap per fase (analisis → rencana → implementasi → testing →
commit di tiap fase, lihat `docs/ARCHITECTURE.md` untuk detail):

- [x] **Fase 1 — Backend & Database**: router Apps Script, autentikasi &
      sesi (token HMAC), RBAC 4 role, akses generik ke Sheet, audit log,
      setup otomatis 18 sheet, backup/restore. 45 unit test lulus.
- [x] **Fase 2 — Frontend Shell & PWA dasar**: routing + RBAC sisi client,
      dark/light mode + glassmorphism, login, manajemen user, pengaturan,
      audit log, backup/restore (fungsional, terhubung ke Fase 1), PWA
      (manifest, service worker, ikon), antrean offline. 50 unit test lulus
      + verifikasi end-to-end di browser sungguhan (Playwright).
- [x] **Fase 3 — Modul Barber**: transaksi (multi-layanan, diskon,
      Cash/QRIS/Split + kembalian), layanan (CRUD Owner), capster (bagi
      hasil, disinkron otomatis dari Manajemen User), data pelanggan
      (dedup by No HP, riwayat haircut, member, poin loyalti), pengeluaran
      Barber + foto nota, struk siap cetak. 63 unit test lulus + simulasi
      backend end-to-end + verifikasi browser Playwright penuh (isi form
      sungguhan, live preview kalkulasi, cetak struk).
- [ ] Fase 4 — Modul Warkop (menu, pesanan, split bill, struk)
- [ ] Fase 5 — Inventory Barber & Warkop
- [ ] Fase 6 — Dashboard (Gabungan/Barber/Warkop) + filter + Chart.js
- [ ] Fase 7 — Closing Shift + Gaji Capster
- [ ] Fase 8 — Laporan + Owner Panel
- [ ] Fase 9 — PWA lanjutan + fitur bonus premium
- [ ] Fase 10 — Optimasi & Testing menyeluruh

## Struktur Folder

```
backend/gas/     Kode Google Apps Script (siap tempel/clasp push)
frontend/        Kode PWA (HTML/CSS/JS) — core (api/auth/router/ui/dsb) + modules per fitur
tests/backend/   Unit test Node untuk logika murni backend
tests/frontend/  Unit test Node untuk logika murni frontend
docs/            Dokumentasi arsitektur & panduan instalasi
```

## Menjalankan Test

```bash
npm install            # sekali saja (devDependencies: Tailwind, Playwright)
npm test               # semua test
npm run test:backend   # hanya backend
npm run test:frontend  # hanya frontend
```

## Menjalankan Frontend Secara Lokal

```bash
npm run build:css                     # build Tailwind (hanya perlu jika input.css berubah)
cd frontend && python3 -m http.server 8080
```

Buka `http://localhost:8080` — lihat `docs/INSTALLATION.md` untuk cara
menghubungkan ke backend & `docs/PWA_INSTALL.md` untuk cara install sebagai
aplikasi.

## Dokumentasi

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — keputusan arsitektur,
  kontrak API, autentikasi, RBAC, skema database, struktur frontend, strategi
  performa & testing.
- [`docs/SPREADSHEET_SETUP.md`](docs/SPREADSHEET_SETUP.md) — cara membuat
  Spreadsheet, menghubungkan ke Apps Script, setup database awal, deploy
  sebagai Web App, dan checklist smoke-test.
- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — menjalankan & menghubungkan
  frontend ke backend.
- [`docs/PWA_INSTALL.md`](docs/PWA_INSTALL.md) — cara install sebagai aplikasi
  di Android/Desktop/iOS.
