# Fase 4 — Modul Warkop

Modul transaksi untuk usaha Warkop: kelola menu, pesanan dengan kuantitas,
split bill, dan cetak struk. Stok menu berkurang otomatis setiap transaksi.

## Yang Dibangun

**Backend** (`backend/src/Warkop.gs`):
- `warkopListProduk` / `warkopSaveProduk` — CRUD menu (Owner/Admin, permission
  `kelolaLayananProduk` yang sama dipakai untuk Layanan Barber). Margin
  dihitung otomatis (`HargaJual - Modal`), tidak diinput manual. Stok awal
  hanya diisi saat membuat menu baru; edit selanjutnya tidak menimpa stok
  (mencegah admin tidak sengaja me-reset stok saat hanya mengubah harga).
- `warkopCreateTransaksi` — validasi tiap item (menu aktif, stok cukup),
  hitung subtotal/diskon/grand total, **kurangi stok tiap produk yang
  terjual**, generate nomor transaksi (`WRK-YYYYMMDD-0001`), dan mendukung
  **split bill**: array pembayaran `[{metode, jumlah}, ...]` yang jumlahnya
  harus sama persis dengan grand total (divalidasi di backend, bukan cuma UI).
- `warkopListTransaksi` / `warkopGetTransaksi` — riwayat dengan filter tanggal
  & pagination, sama pola dengan modul Barber.
- Pelanggan (nama/HP) bersifat **opsional** di Warkop (beda dari Barber yang
  mewajibkan nama) -- transaksi warkop sering anonim/tidak butuh data
  pelanggan, tapi kalau nomor HP diisi, statistik pelanggan (kunjungan, total
  belanja, poin loyalti) tetap terhubung lewat fungsi bersama `Pelanggan.gs`.

**Frontend** (`frontend/assets/js/pages/warkop/`):
- `pesanan.js` — layar kasir (POS): filter kategori (chip), grid menu dengan
  info stok real-time, keranjang dengan stepper qty (+/-) yang dibatasi stok
  tersedia, toggle Split Bill (baris pembayaran dinamis + indikator sisa yang
  harus dibagi, auto-update saat diskon/qty berubah).
- `produk.js` — kelola menu (nama, kategori, modal, harga jual, stok
  awal/minimum, aktif/nonaktif).
- `riwayat.js` — filter tanggal + pagination + cetak ulang.
- `struk.js` — struk Warkop menampilkan tiap item x qty, dan jika split bill,
  merinci tiap metode pembayaran secara terpisah di struk.

## Keputusan Desain

- **"Split" sebagai MetodePembayaran**: transaksi split-bill disimpan dengan
  `MetodePembayaran = "Split"` dan rincian sesungguhnya (Cash/QRIS +
  nominal masing-masing) di kolom `SplitBill` (JSON). Dashboard/laporan
  (Fase 6/8) akan menjumlahkan isi `SplitBill` ke total Cash vs QRIS,
  bukan memperlakukan "Split" sebagai kategori pembayaran tersendiri.
- **Validasi stok di backend, bukan cuma UI**: meski UI membatasi qty tombol
  `+` sesuai stok, backend tetap re-validasi stok saat submit (mencegah race
  condition dua kasir memesan menu yang sama nyaris bersamaan).
- **Stok Produk Warkop vs Inventory Warkop (Fase 5)**: keduanya sengaja
  dipisah. Stok di sini adalah stok barang jadi yang langsung dijual
  (mis. minuman botolan, snack kemasan) dan berkurang otomatis per
  transaksi. Inventory Warkop (fase berikutnya) melacak bahan baku/consumable
  secara umum (gula, kopi bubuk, gas) yang disesuaikan manual saat belanja
  stok -- spesifikasi tidak mendefinisikan resep/BOM yang menghubungkan
  keduanya, jadi tidak dibuat mapping otomatis di antara keduanya.

## Testing

```bash
npm run test:backend       # 47 unit test (+18 baru untuk Warkop)
npm run build:css
npm run test:e2e:warkop    # 14 skenario end-to-end Chromium
```

Skenario e2e mencakup: kelola menu + margin otomatis, tambah qty via klik
berulang, kurangi qty, qty dibatasi stok tersedia, split bill (validasi sisa
+ rincian di struk), stok berkurang setelah transaksi, validasi keranjang
kosong, dan riwayat + cetak ulang.

## Checklist Fase 4 (selesai & teruji)

- [x] Owner/Admin kelola menu (CRUD + margin otomatis + nonaktifkan)
- [x] POS pesanan: multi-item dengan qty, filter kategori, diskon
- [x] Stok otomatis berkurang saat transaksi, transaksi ditolak jika stok kurang
- [x] Split Bill (Cash + QRIS sekaligus), tervalidasi backend
- [x] Cetak struk (termasuk rincian split bill)
- [x] Riwayat transaksi dengan filter tanggal + pagination + cetak ulang
- [x] Pelanggan opsional tetap terhubung ke statistik kunjungan/poin loyalti
