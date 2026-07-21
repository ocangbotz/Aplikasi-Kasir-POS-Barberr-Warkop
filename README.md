# Kasir Barber & Warkop

Aplikasi kasir (POS) modern untuk usaha yang mengelola **Barber** dan
**Warkop** dalam satu sistem — transaksi terpisah per usaha, dashboard
gabungan, inventory, payroll capster, closing shift, dan laporan lengkap.

**Stack:** HTML5 + TailwindCSS + Vanilla JavaScript (ES6) + Google Apps Script
+ Google Sheets sebagai database + Chart.js + PWA (installable, offline-ready).

## Status Pengembangan

Proyek dibangun bertahap per fase, setiap fase diuji sebelum lanjut ke fase
berikutnya (lihat `docs/`).

| Fase | Cakupan | Status |
|---|---|---|
| 1 | Project scaffold, backend Apps Script, skema 16-sheet database | ✅ Selesai |
| 2 | Frontend foundation (shell, auth, routing, dark mode) | ✅ Selesai |
| 3 | Modul Barber (transaksi, layanan, capster, struk) | ✅ Selesai |
| 4 | Modul Warkop (menu, pesanan, split bill, struk) | ✅ Selesai |
| 5 | Inventory Barber & Warkop + notifikasi stok | ✅ Selesai |
| 6 | Dashboard Gabungan/Barber/Warkop + grafik + filter (+ Pengeluaran) | ✅ Selesai |
| 7 | Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel | ✅ Selesai |
| 8 | Laporan + export (PDF/Excel/CSV/Print) | ✅ Selesai |
| 9 | PWA (manifest, service worker, offline, install) | ⏳ |
| 10 | Optimasi performa & testing menyeluruh | ⏳ |

## Struktur Folder

```
backend/          Google Apps Script (backend + API + akses database)
  src/            Source .gs — copy ke project Apps Script
  test/           Test logika backend via mock GAS runtime (Node.js)
  appsscript.json Manifest deployment
frontend/         (fase 2+) HTML/CSS/JS aplikasi kasir
docs/             Panduan instalasi & deployment per fase
```

## Mulai dari Mana?

1. **Backend & Database** → ikuti [`docs/01-SETUP-BACKEND.md`](docs/01-SETUP-BACKEND.md)
2. **Frontend** → ikuti [`docs/02-FRONTEND.md`](docs/02-FRONTEND.md)
3. **Modul Barber** → lihat [`docs/03-MODUL-BARBER.md`](docs/03-MODUL-BARBER.md)
4. **Modul Warkop** → lihat [`docs/04-MODUL-WARKOP.md`](docs/04-MODUL-WARKOP.md)
5. **Inventory** → lihat [`docs/05-INVENTORY.md`](docs/05-INVENTORY.md)
6. **Dashboard & Pengeluaran** → lihat [`docs/06-DASHBOARD.md`](docs/06-DASHBOARD.md)
7. **Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel** → lihat [`docs/07-CLOSING-SHIFT-GAJI-PELANGGAN-OWNER.md`](docs/07-CLOSING-SHIFT-GAJI-PELANGGAN-OWNER.md)
8. **Laporan + Export PDF/Excel/CSV/Print** → lihat [`docs/08-LAPORAN.md`](docs/08-LAPORAN.md)
9. Fase-fase berikutnya akan menambah `docs/0N-....md` masing-masing.

## Menjalankan Test

```bash
npm install
npm run test:backend         # unit test logika backend (mock GAS runtime)
npm run build:css            # build Tailwind sebelum test:e2e
npm run test:e2e             # e2e shell aplikasi (auth, tema, dll) di Chromium
npm run test:e2e:barber      # e2e Modul Barber (POS, layanan, capster, struk)
npm run test:e2e:warkop      # e2e Modul Warkop (POS, menu, split bill, struk)
npm run test:e2e:inventory   # e2e Inventory + notifikasi stok
npm run test:e2e:dashboard   # e2e Dashboard + filter + Chart.js
npm run test:e2e:owner-panel # e2e Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel
npm run test:e2e:laporan     # e2e Laporan + export PDF/Excel/CSV/Print
```
