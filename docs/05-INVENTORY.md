# Fase 5 — Inventory Barber & Warkop + Notifikasi Stok

Modul untuk melacak bahan baku/consumable per usaha, dengan penyesuaian stok
manual (bukan otomatis dari transaksi -- lihat "Kenapa Bukan Otomatis?" di
bawah) dan notifikasi saat stok mencapai titik minimum.

## Yang Dibangun

**Backend** (`backend/src/Inventory.gs`), permission `inventory` (Owner/Admin):
- `inventoryList` — daftar item per usaha (`Barber` atau `Warkop`, sheet terpisah).
- `inventorySaveItem` — buat/edit item (nama, kategori, satuan, stok minimum,
  harga beli, supplier). **Stok TIDAK bisa diubah lewat form edit** -- hanya
  bisa diisi saat membuat item baru, atau lewat `inventoryAdjustStock`.
  Ini mencegah admin tidak sengaja mereset stok saat hanya mengubah harga/kategori.
- `inventoryAdjustStock` — penyesuaian stok manual dengan `delta` (+/-) dan
  `alasan` wajib salah satu dari: `Restock`, `Pemakaian`, `Rusak/Hilang`,
  `Koreksi Stok Opname`. Menolak jika hasil akhir jadi negatif. Setiap
  penyesuaian tercatat di Audit Log (stok sebelum/sesudah, alasan, catatan).
- `inventoryLowStockSummary` — menggabungkan item Inventory Barber, Inventory
  Warkop, DAN Produk Warkop yang stoknya `<= StokMinimum`, dipakai oleh bel
  notifikasi di topbar.

**Frontend**:
- `pages/inventory/shared.js` — implementasi bersama form + tabel + modal
  penyesuaian stok (dipakai oleh `barber.js` dan `warkop.js`, hanya beda
  parameter `usaha` dan warna aksen -- menghindari duplikasi kode).
- Bel notifikasi (🔔) di topbar (`layout.js`), hanya tampil untuk role dengan
  permission `inventory`. Badge menampilkan jumlah total item stok rendah,
  dropdown merinci per kategori (Inventory Barber / Inventory Warkop / Menu
  Warkop). Auto-refresh tiap 60 detik selama sesi aktif, dan refresh ulang
  setiap kali dropdown dibuka (supaya tidak menampilkan data basi setelah
  baru saja menyesuaikan stok).

## Kenapa Bukan Otomatis dari Transaksi?

Seperti dicatat di `docs/04-MODUL-WARKOP.md`, spesifikasi tidak mendefinisikan
resep/BOM (mis. "1 Kopi Hitam terjual = pakai 15g Kopi Bubuk + 10g Gula").
Tanpa mapping itu, auto-decrement Inventory dari penjualan Produk Warkop akan
jadi tebakan/fitur dummy. Jadi Inventory di sini murni untuk pencatatan
manual (restock saat belanja, pemakaian saat dipakai/dibuang) -- yang tetap
memberi nilai nyata: histori pergerakan stok di Audit Log dan notifikasi
dini saat stok menipis.

## Bug yang Ditemukan Saat Testing E2E

1. **Panel notifikasi menampilkan data basi**: awalnya bel hanya fetch data
   sekali saat topbar pertama dirender + tiap 60 detik -- kalau admin baru
   saja menyesuaikan stok lalu langsung buka dropdown, datanya belum
   ter-update. Diperbaiki: dropdown selalu refresh saat dibuka.
2. **Kebocoran timer setelah logout**: interval refresh notifikasi tidak
   pernah dibersihkan saat topbar di-unmount (logout/login ulang), berpotensi
   menumpuk timer dan memanggil elemen DOM yang sudah tidak ada.
   `renderLayout()` sekarang mengembalikan fungsi `cleanup()` yang dipanggil
   `app.js` sebelum membangun ulang shell.
3. (Bug di test, bukan di app) Pengecekan e2e awal membandingkan **jumlah**
   toast sebelum/sesudah aksi -- tidak reliabel karena toast lama bisa
   auto-dismiss (~3.5 detik) di tengah pengecekan. Diperbaiki dengan menunggu
   toast berisi teks tertentu, bukan menghitung jumlah elemen.

## Testing

```bash
npm run test:backend        # 55 unit test (+8 baru untuk Inventory)
npm run build:css
npm run test:e2e:inventory  # 12 skenario end-to-end Chromium
```

Skenario e2e mencakup: CRUD item per usaha (terpisah Barber/Warkop), tanda
peringatan stok rendah di tabel, penyesuaian stok (tambah/kurangi) dengan
alasan, validasi stok tidak boleh negatif, edit item tidak mengubah stok,
dan bel notifikasi (badge + dropdown) yang selalu menampilkan data terbaru.

## Checklist Fase 5 (selesai & teruji)

- [x] Inventory Barber & Inventory Warkop terpisah (sheet & UI)
- [x] CRUD item + penyesuaian stok manual dengan alasan & audit log
- [x] Validasi stok tidak boleh negatif
- [x] Notifikasi stok hampir habis (bel + badge + dropdown), mencakup
      Inventory Barber/Warkop dan Menu Warkop
- [x] Permission `inventory` ditegakkan di backend (Owner/Admin saja)
