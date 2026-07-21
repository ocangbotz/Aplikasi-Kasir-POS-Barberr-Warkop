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
- [x] **Fase 4 — Modul Warkop**: menu (harga/modal/margin otomatis/stok),
      pesanan multi-menu dengan potong stok otomatis + validasi stok
      cukup, diskon, Cash/QRIS/Split, **split bill** sungguhan (bagi
      tagihan ke beberapa pembayar dgn tombol "Bagi Rata"), pengeluaran
      Warkop, struk (termasuk rincian split bill). 68 unit test lulus +
      simulasi backend end-to-end + verifikasi browser Playwright penuh.
- [x] **Fase 5 — Inventory Barber & Warkop**: stok bahan baku/consumable
      terpisah per usaha (restock/pemakaian manual, tidak bisa negatif),
      notifikasi stok hampir habis (lonceng + badge di topbar, gabungan
      Inventory Barber+Warkop+Menu Warkop). 70 unit test lulus + simulasi
      backend end-to-end + verifikasi browser Playwright penuh.
- [x] **Fase 6 — Dashboard (Gabungan/Barber/Warkop)**: kartu Hari Ini/Bulan
      Ini (tetap) + Periode Terpilih (mengikuti filter Hari Ini/Kemarin/
      Minggu/Bulan/Tahun/Custom Date), grafik Chart.js (tren harian/
      bulanan/tahunan, jumlah kepala/produk terjual, metode pembayaran),
      Capster/Layanan Terlaris & Menu/Kategori Terlaris. 83 unit test
      lulus + simulasi backend end-to-end + verifikasi browser Playwright
      penuh (termasuk Chart.js ter-lazy-load & ter-render).
- [x] **Fase 7 — Closing Shift + Gaji Capster**: buka/tutup kas per kasir
      (transaksi & pengeluaran otomatis ter-tag ke shift aktif), preview
      estimasi kas real-time sebelum tutup, rekonsiliasi kas fisik vs
      sistem (Selisih Pas/Lebih/Kurang), kunci shift setelah ditutup +
      buka-kembali khusus Owner/Admin (tercatat di Audit Log), gaji
      capster otomatis (bagi hasil % + bonus - potongan - keterlambatan)
      dgn upsert per periode (generate ulang tidak duplikat), Capster
      hanya melihat slip miliknya sendiri (read-only). 93 unit test lulus
      + simulasi backend end-to-end + verifikasi browser Playwright penuh.
- [x] **Fase 8 — Laporan + Owner Panel**: laporan penjualan & pengeluaran
      per jenis usaha (Gabungan/Barber/Warkop) dgn rentang tanggal bebas
      (termasuk Custom Date), export CSV & Excel (.xls, dibuka asli oleh
      Excel/Sheets/LibreOffice tanpa library biner) + Cetak/Simpan PDF
      lewat print browser, tiap export tercatat Audit Log; Owner Panel:
      edit transaksi (nama/HP/capster/catatan, nominal/item TERKUNCI
      demi integritas rekonsiliasi), hapus (soft-delete + alasan wajib,
      stok Warkop otomatis dikembalikan) & pulihkan (stok dipotong lagi,
      ditolak all-or-nothing kalau stok tak cukup), khusus Owner/Admin.
      102 unit test lulus + simulasi backend end-to-end + verifikasi
      browser Playwright penuh.
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
