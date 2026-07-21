# Fase 8 — Laporan (Filter + Ekspor PDF/Excel/CSV/Print)

Satu halaman Laporan yang menggabungkan transaksi Barber + Warkop siap
ekspor, dengan filter periode (Hari Ini/Kemarin/Minggu Ini/Bulan Ini/Tahun
Ini/Custom) dan filter usaha (Gabungan/Barber/Warkop) yang sama persis
dengan Dashboard -- supaya angka ringkasan (Pendapatan, Pengeluaran, Laba
Bersih, dst.) yang tampil di Laporan selalu identik dengan yang tampil di
Dashboard untuk periode yang sama.

## Yang Dibangun

**Backend**:
- `backend/src/Laporan.gs` — `laporanTransaksi_` (gabungan transaksi Barber
  + Warkop, di-flatten ke bentuk seragam siap tabel/ekspor, plus ringkasan
  periode) dan `laporanPengeluaran_`. Keduanya memakai ulang
  `resolveDateRange_`, `loadBarberSelesai_`, `loadWarkopSelesai_`,
  `inDateRange_`, dan fungsi `*Metrics_` dari `Dashboard.gs` -- bukan
  menghitung ulang dengan logika terpisah -- supaya konsistensi angka dengan
  Dashboard terjamin secara struktural, bukan cuma kebetulan cocok saat ditest.
- Permission `laporan` (sudah ada di `Config.gs` sejak awal: Owner/Admin/Kasir
  `true`, Capster `false`) dipakai apa adanya, tidak perlu permission baru.

**Frontend**:
- `core/export.js` — 4 fungsi ekspor generik (headers + rows) dipakai oleh
  halaman Laporan:
  - `exportCSV` — Blob `text/csv` + BOM UTF-8 (supaya Excel Indonesia tidak
    salah baca karakter), download langsung lewat elemen `<a download>`.
  - `exportExcel` — **tanpa library eksternal.** Lihat catatan keamanan di
    bawah.
  - `exportPDF` — `jsPDF` + plugin `autoTable`, di-vendor lokal (lihat
    `index.html`), orientasi landscape supaya kolom tabel muat.
  - `printReport` — buka dialog print browser (`window.print()`) dengan area
    cetak khusus (`#laporan-print-area`, CSS di `input.css`) yang berbeda
    dari area cetak struk 80mm yang sudah ada sejak Fase 3.
- `pages/laporan/index.js` — halaman Laporan: tab usaha, filter bar (reuse
  `pages/dashboard/shared.js`), kartu ringkasan (reuse `metricCardsHtml`),
  tabel transaksi, 4 tombol ekspor.
- Route `/laporan` (permission `laporan`), nav item di grup "Operasional".

## Keputusan Keamanan: Tidak Memakai Library `xlsx` (SheetJS)

Rencana awal memakai `xlsx` (SheetJS) untuk ekspor Excel yang genuine (bukan
CSV berlabel `.xlsx`). Setelah `npm install xlsx` dan menjalankan
`npm audit`, ditemukan dua kerentanan **severity tinggi tanpa fix tersedia**:

- **Prototype Pollution** (GHSA-4r6h-8v6p-xvw6)
- **ReDoS / Regular Expression Denial of Service** (GHSA-5pgg-2g8v-p4x9)

Karena spesifikasi aplikasi ini sendiri secara eksplisit meminta aplikasi
bebas dari kerentanan keamanan umum (OWASP Top 10, termasuk kelas-kelas
serupa ini), `xlsx` **di-uninstall** (`npm uninstall xlsx`, dikonfirmasi
`npm audit` kembali menunjukkan 0 kerentanan) dan diganti dengan teknik
**tabel HTML bertipe MIME `application/vnd.ms-excel`** — nol dependency,
nol kerentanan, dan tetap dibuka dengan benar oleh Microsoft Excel maupun
Google Sheets sebagai file `.xls` (format lama tapi genuine, bukan CSV yang
diganti nama ekstensinya).

`jsPDF` + `jspdf-autotable` tetap dipakai untuk ekspor PDF karena
`npm audit` tidak menemukan kerentanan pada keduanya.

## Keputusan Desain: Ringkasan Laporan = Ringkasan Dashboard

Alih-alih menghitung ulang Pendapatan/Pengeluaran/Laba Bersih dengan logika
terpisah di `Laporan.gs`, fungsi `barberMetrics_`/`warkopMetrics_`/
`gabunganMetrics_` dari `Dashboard.gs` dipanggil langsung. Ini artinya kalau
Dashboard menunjukkan Laba Bersih Rp20.000 untuk "Hari Ini", Laporan dengan
filter periode yang sama **dijamin** menunjukkan angka yang sama persis --
diverifikasi lewat unit test `laporanTransaksi_ menggabungkan Barber+Warkop
... dan ringkasan cocok dengan dashboard`.

## Testing

```bash
npm run test:backend       # 96 unit test (+5 baru: Laporan.gs)
npm run build:css
npm run test:e2e:laporan   # 12 skenario end-to-end Chromium
```

E2E `laporan.js` membuat 1 transaksi Barber (Rp30.000) + 1 transaksi Warkop
(Rp8.000) + 1 pengeluaran Barber (Rp10.000) lewat UI sungguhan, lalu
memverifikasi:
- Filter usaha Gabungan/Barber/Warkop menyaring baris tabel dengan benar.
- Kartu ringkasan Gabungan = Rp38.000 (30.000 + 8.000).
- **Isi file hasil unduhan diperiksa langsung** (bukan cuma diklik lalu
  diasumsikan benar): CSV & Excel diperiksa berisi teks transaksi yang
  benar, PDF diperiksa header biner `%PDF-` valid dan ukuran file wajar.
- Tombol Cetak berhasil dipanggil tanpa error konsol.

Regresi penuh (96 backend + seluruh suite e2e Fase 2–8) dijalankan ulang
setelah penambahan modul ini; semuanya tetap hijau.

## Checklist Fase 8 (selesai & teruji)

- [x] Laporan gabungan transaksi Barber + Warkop, urut terbaru dulu
- [x] Filter usaha (Gabungan/Barber/Warkop) dan periode (sama seperti Dashboard)
- [x] Ringkasan periode (Pendapatan/Cash/QRIS/Pengeluaran/Laba Bersih) konsisten dengan Dashboard
- [x] Ekspor PDF (jsPDF + autoTable, vendor lokal)
- [x] Ekspor Excel (.xls, teknik tabel HTML, tanpa dependency berkerentanan)
- [x] Ekspor CSV (UTF-8 + BOM)
- [x] Cetak langsung (print dialog browser, area cetak terpisah dari struk)
- [x] Keputusan keamanan: `xlsx` (SheetJS) ditolak karena kerentanan tanpa fix, diganti solusi zero-dependency
