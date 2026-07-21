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
| 1 | Project scaffold, backend Apps Script, skema 15-sheet database | ✅ Selesai |
| 2 | Frontend foundation (shell, auth, routing, dark mode) | ✅ Selesai |
| 3 | Modul Barber (transaksi, layanan, capster, struk) | ⏳ |
| 4 | Modul Warkop (menu, pesanan, split bill, struk) | ⏳ |
| 5 | Inventory Barber & Warkop + notifikasi stok | ⏳ |
| 6 | Dashboard Gabungan/Barber/Warkop + grafik + filter | ⏳ |
| 7 | Pengeluaran, Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel | ⏳ |
| 8 | Laporan + export (PDF/Excel/CSV/Print) | ⏳ |
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
3. Fase-fase berikutnya akan menambah `docs/0N-....md` masing-masing.

## Menjalankan Test

```bash
npm install
npm run test:backend   # unit test logika backend (mock GAS runtime)
npm run build:css      # build Tailwind sebelum test:e2e
npm run test:e2e       # end-to-end di Chromium sungguhan (Playwright)
```
