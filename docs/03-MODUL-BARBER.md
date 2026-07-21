# Fase 3 — Modul Barber

Modul transaksi untuk usaha Barber: kelola layanan & capster, input transaksi
(POS), cetak struk, dan riwayat transaksi.

## Yang Dibangun

**Backend** (`backend/src/Barber.gs`, `Pelanggan.gs`, `Settings.gs`):
- `barberListLayanan` / `barberSaveLayanan` — CRUD layanan (Owner/Admin). Layanan
  yang dinonaktifkan tetap tersimpan (tidak hilang dari histori transaksi lama).
- `barberListCapster` / `barberSaveCapster` — CRUD data capster (Owner/Admin).
- `barberCreateTransaksi` — buat transaksi: validasi layanan & metode bayar,
  hitung subtotal/diskon/grand total, generate nomor transaksi
  (`BRB-YYYYMMDD-0001`, urut per tanggal), cari-atau-buat profil pelanggan
  otomatis dari nomor HP, update statistik pelanggan (kunjungan, total belanja,
  poin loyalti — 1 poin per Rp10.000).
- `barberListTransaksi` / `barberGetTransaksi` — riwayat dengan filter tanggal
  & pagination.
- `searchPelanggan` — autocomplete pelanggan (nama/HP), dipakai bersama oleh
  modul Warkop nanti.
- `getSettings` / `updateSettings` — data usaha (nama, alamat, kontak, logo,
  QRIS) dipakai di struk.

**Frontend** (`frontend/assets/js/pages/barber/`):
- `transaksi.js` — layar kasir (POS): grid pilih layanan, keranjang real-time,
  autocomplete pelanggan, pilih capster, toggle Cash/QRIS, submit → struk.
- `riwayat.js` — filter tanggal + pagination + cetak ulang.
- `layanan.js`, `capster.js` — halaman kelola master data.
- `struk.js` — render & cetak struk (modal + `window.print()`, CSS `@media print`
  menyembunyikan seluruh UI kecuali area struk).

## Keputusan Desain

- **Status transaksi** disederhanakan jadi `Selesai` / `Dibatalkan` (sesuai
  `STATUS_TRANSAKSI` di Config.gs) — bukan status antrian (Menunggu/Proses),
  karena pembayaran Cash/QRIS di form transaksi berarti transaksi sudah
  final saat itu juga.
- **Nomor transaksi** dihitung dari jumlah baris di sheet Transaksi Barber
  pada tanggal yang sama. Ini cukup untuk skala saat ini; dioptimasi lebih
  lanjut di Fase 10 saat volume data besar (>100rb baris) jadi perhatian.
- **Poin loyalti**: 1 poin per kelipatan Rp10.000 belanja (`APP_CONFIG.LOYALTY_RUPIAH_PER_POINT`),
  bisa diubah lewat konstanta backend.
- **Permission baru**: `kelolaCapster` (Owner/Admin) dan `kelolaSettings`
  (Owner saja) ditambahkan ke matrix permission.

## Bug yang Ditemukan & Diperbaiki Saat Testing

Review visual (screenshot) sempat menunjukkan tombol metode pembayaran
terlihat pucat, bukan biru solid, setelah dipilih. Investigasi menemukan dua
hal terpisah:
1. Kelas utility Tailwind dengan prefix `!` (mis. `!bg-barber-600`) yang
   ditambahkan lewat `classList.add()` secara dinamis tidak konsisten
   diterapkan Chromium -- diganti dengan class semantik `.option-btn.selected`
   yang didefinisikan langsung di CSS (lebih idiomatis untuk state yang
   di-toggle lewat JS).
2. Pengukuran otomatis awal (`getComputedStyle` tepat setelah klik) ternyata
   menangkap CSS transition warna yang belum selesai (150ms) -- bukan bug
   sungguhan. Test e2e diperbaiki untuk memeriksa nama class (stabil) alih-alih
   warna piksel (rentan waktu transisi).

## Testing

```bash
npm run test:backend       # 37 unit test (termasuk 19 dari fase 1-2)
npm run build:css
npm run test:e2e:barber    # 17 skenario end-to-end Chromium
```

Skenario e2e mencakup: kelola layanan & capster, pilih layanan di POS,
hitung subtotal/diskon/total real-time, buat transaksi, validasi (tanpa
layanan/metode bayar ditolak), struk tampil dengan data benar, cetak ulang
dari riwayat, dan permission sidebar.

## Checklist Fase 3 (selesai & teruji)

- [x] Owner/Admin kelola layanan (CRUD + nonaktifkan)
- [x] Owner/Admin kelola capster (CRUD)
- [x] POS transaksi: multi-layanan, diskon, Cash/QRIS, capster, catatan
- [x] Nomor transaksi otomatis per tanggal
- [x] Pelanggan otomatis dibuat/diupdate (kunjungan, total belanja, poin loyalti)
- [x] Cetak struk (modal + print), data lengkap sesuai spesifikasi
- [x] Riwayat transaksi dengan filter tanggal + pagination + cetak ulang
- [x] Permission per role ditegakkan di backend & disembunyikan di sidebar
