# Fase 6 — Dashboard Gabungan/Barber/Warkop + Chart.js + Filter

Tiga dashboard (Gabungan/Barber/Warkop) dengan kartu metrik, grafik tren
(Chart.js, di-vendor lokal untuk PWA offline), leaderboard, dan filter
periode yang mengontrol semuanya sekaligus.

## Penyesuaian Urutan Fase: Pengeluaran Ditarik Maju dari Fase 7

Dashboard butuh data pengeluaran nyata untuk menghitung **Laba Bersih =
Pendapatan - Pengeluaran** secara benar dan bisa diuji. Daripada menampilkan
Pengeluaran yang selalu Rp0 (secara teknis jujur karena sheet-nya memang
kosong, tapi membuat Laba Bersih selalu sama dengan Pendapatan -- fitur yang
terasa rusak), modul Pengeluaran inti (input + riwayat + upload foto nota ke
Google Drive) dibangun sekarang. Fase 7 nanti menambah Closing Shift (yang
merangkum Pengeluaran per shift), Gaji Capster, halaman kelola Pelanggan,
Audit Log, dan Owner Panel.

## Yang Dibangun

**Backend**:
- `backend/src/Pengeluaran.gs` — `pengeluaranCreate`, `pengeluaranList`,
  upload foto nota (base64 dari browser → `DriveApp`, URL dikembalikan ke
  `FotoNotaURL`), permission `pengeluaran`.
- `backend/src/Dashboard.gs` — `dashboardData` (satu action untuk ketiga
  dashboard, dibedakan parameter `usaha`). Lihat komentar desain di file itu
  untuk penjelasan filter vs kartu Hari Ini/Bulan Ini.

**Frontend**:
- `core/charts.js` — wrapper Chart.js (vendor lokal di `assets/js/vendor/`,
  bukan CDN, supaya dashboard tetap jalan offline sebagai PWA). Chart
  otomatis di-render ulang saat dark/light mode berganti (grid & warna teks
  chart tidak reaktif terhadap CSS).
- `pages/dashboard/shared.js` — filter bar (chip Hari Ini/Kemarin/Minggu
  Ini/Bulan Ini/Tahun Ini/Custom) dan kartu metrik, dipakai bersama 3 dashboard.
- `pages/dashboard/gabungan.js`, `barber.js`, `warkop.js`.
- `pages/pengeluaran/shared.js` + `barber.js`/`warkop.js` — form input
  (dengan preview upload foto via `FileReader`) + riwayat + filter tanggal.

## Keputusan Desain: Filter vs Kartu "Hari Ini"/"Bulan Ini"

Spesifikasi meminta kartu tetap `Hari Ini`/`Bulan Ini` DAN "semua grafik dan
kartu berubah otomatis" mengikuti filter -- dua hal yang sekilas kontradiktif.
Solusinya:
- Kartu **Hari Ini** & **Bulan Ini** selalu tetap menampilkan data hari
  ini/bulan berjalan, terlepas dari filter yang dipilih (patokan cepat khas
  dashboard POS).
- Kartu **Periode Terpilih** (baru) + seluruh grafik + leaderboard mengikuti
  filter yang aktif. Jadi mengganti filter tetap membuat "kartu dan grafik
  berubah otomatis" -- hanya bukan kartu Hari Ini/Bulan Ini yang memang
  didefinisikan tetap oleh spesifikasi.

## Keputusan Desain: Total Kepala = Total Transaksi (Barber)

Setiap transaksi Barber pada skema data ini merepresentasikan satu pelanggan
yang dilayani (satu transaksi bisa berisi beberapa layanan, tapi tetap satu
orang). Jadi `Total Kepala` dihitung sama dengan jumlah transaksi -- bukan
duplikasi tanpa arti, hanya istilah bisnis yang berbeda untuk angka yang sama.

## Keputusan Desain: Granularitas Grafik Otomatis

Alih-alih 3 grafik terpisah persis sesuai judul spesifikasi ("Pendapatan
Harian/Bulanan/Tahunan"), dipakai **satu grafik tren yang granularitasnya
otomatis menyesuaikan rentang filter**:
- Rentang 1 hari (Hari Ini/Kemarin) → per jam.
- Rentang ≤31 hari (Minggu Ini/Bulan Ini/Custom pendek) → per hari.
- Rentang lebih panjang (Tahun Ini/Custom panjang) → per bulan.

Ini menghindari 3 grafik statis yang sebagian besar kosong (mis. grafik
"Tahunan" hanya berguna kalau filter=Tahun Ini) dan tetap memenuhi maksud
spesifikasi: grafik pendapatan yang relevan dengan periode yang dipilih.

## Testing

```bash
npm run test:backend        # 69 unit test (+14 baru: Pengeluaran + Dashboard)
npm run build:css
npm run test:e2e:dashboard  # 14 skenario end-to-end Chromium
```

Unit test backend memakai pendekatan **delta** (bandingkan sebelum/sesudah
aksi) supaya tidak rapuh terhadap data dari test lain yang berjalan di sheet
mock yang sama, plus test khusus untuk: agregasi Cash/QRIS (termasuk rincian
Split Bill Warkop), Laba Bersih selalu konsisten dengan Pendapatan-Pengeluaran
di ketiga dashboard, filter kemarin/custom, dan granularitas grafik otomatis.

E2E memverifikasi angka yang **benar-benar tampil di layar** (dibaca dari
DOM) cocok dengan transaksi yang baru dibuat lewat UI, termasuk saat filter
diganti.

## Checklist Fase 6 (selesai & teruji)

- [x] Dashboard Gabungan: kartu Hari Ini/Bulan Ini/Periode Terpilih + grafik Barber vs Warkop
- [x] Dashboard Barber: + Total Kepala, Capster Terlaris, Layanan Terlaris, grafik Kepala & Metode Pembayaran
- [x] Dashboard Warkop: + Menu Terlaris, Kategori Terlaris, grafik Produk Terjual & Metode Pembayaran
- [x] Filter Hari Ini/Kemarin/Minggu Ini/Bulan Ini/Tahun Ini/Custom Date, memengaruhi kartu Periode + grafik + leaderboard
- [x] Laba Bersih = Pendapatan - Pengeluaran, konsisten di ketiga dashboard
- [x] Chart.js di-vendor lokal (bukan CDN) untuk kesiapan PWA offline (Fase 9)
- [x] Chart re-render otomatis saat dark/light mode berganti
- [x] Modul Pengeluaran (input + riwayat + upload foto nota) ditarik maju dari Fase 7
- [x] Dashboard kini jadi halaman utama ("/") setelah login; Profil dipindah ke "/profil"
