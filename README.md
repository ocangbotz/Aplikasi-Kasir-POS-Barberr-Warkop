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
      setup otomatis 18 sheet, backup/restore. 44 unit test lulus.
- [ ] Fase 2 — Frontend Shell & PWA dasar
- [ ] Fase 3 — Dashboard (Gabungan/Barber/Warkop) + filter + Chart.js
- [ ] Fase 4 — Modul Barber (transaksi, layanan, pelanggan, struk)
- [ ] Fase 5 — Modul Warkop (menu, pesanan, split bill, struk)
- [ ] Fase 6 — Inventory Barber & Warkop
- [ ] Fase 7 — Pengeluaran, Closing Shift, Gaji Capster
- [ ] Fase 8 — Laporan + Owner Panel
- [ ] Fase 9 — PWA lanjutan + fitur bonus premium
- [ ] Fase 10 — Optimasi & Testing menyeluruh

## Struktur Folder

```
backend/gas/    Kode Google Apps Script (siap tempel/clasp push)
frontend/       Kode PWA (HTML/CSS/JS) — dibangun mulai Fase 2
tests/backend/  Unit test Node untuk logika murni backend
docs/           Dokumentasi arsitektur & panduan instalasi
```

## Menjalankan Test

```bash
npm test              # semua test
npm run test:backend  # hanya backend
```

## Dokumentasi

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — keputusan arsitektur,
  kontrak API, autentikasi, RBAC, skema database, strategi performa & testing.
- [`docs/SPREADSHEET_SETUP.md`](docs/SPREADSHEET_SETUP.md) — cara membuat
  Spreadsheet, menghubungkan ke Apps Script, setup database awal, deploy
  sebagai Web App, dan checklist smoke-test.

Panduan instalasi frontend/PWA akan ditambahkan mulai Fase 2.
