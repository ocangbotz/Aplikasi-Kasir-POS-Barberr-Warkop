# Fase 7 — Closing Shift, Gaji Capster, Pelanggan, Audit Log, Owner Panel

Fase ini melengkapi sisi operasional & administratif: tutup kas per shift,
perhitungan gaji capster otomatis, manajemen data pelanggan, jejak audit,
dan panel khusus Owner (kelola user, kelola transaksi, backup/restore).

## Perubahan Skema: 16 Sheet

Menambah sheet **Gaji Capster** (`ID, Periode, CapsterID, NamaCapster,
PersentaseBagiHasil, TotalKepala, Pendapatan, BagiHasilAmount, Bonus,
Potongan, Keterlambatan, TotalGaji, Catatan, DibuatOlehID, DibuatOleh,
CreatedAt, UpdatedAt`) -- dibutuhkan karena spesifikasi meminta Bonus/
Potongan/Keterlambatan sebagai *input* yang tersimpan per periode, bukan
sekadar angka sekali hitung. Jalankan ulang `setupDatabase()` di project
Apps Script Anda (aman, idempotent) untuk menambahkan sheet baru ini kalau
database sudah dibuat sebelum fase ini.

## Yang Dibangun

### Closing Shift (`backend/src/Shift.gs`)
- Kasir **membuka shift** dengan input Saldo Awal saja.
- Selama shift terbuka, semua transaksi Barber/Warkop dan pengeluaran yang
  dibuat kasir tersebut **otomatis ditandai** dengan ShiftID (lewat
  `currentOpenShiftId_()`, dipanggil dari `Barber.gs`/`Warkop.gs`/`Pengeluaran.gs`).
- Saat **tutup kas**, kasir hanya input Uang Kas Fisik + Catatan. Cash
  Barber/Warkop, QRIS Barber/Warkop, dan Pengeluaran Barber/Warkop dihitung
  **otomatis** dari data yang sudah tersimpan selama shift (bukan diketik
  ulang) -- Total Seharusnya = Saldo Awal + Cash - Pengeluaran, Selisih Kas =
  Uang Fisik - Total Seharusnya.
- Shift yang sudah ditutup **terkunci** (tidak ada aksi edit); hanya
  Owner/Admin (`reopenShift`) yang bisa membukanya kembali. Semua aksi
  (buka/tutup/reopen) tercatat di Audit Log.

### Gaji Capster (`backend/src/GajiCapster.gs`)
- Total Kepala & Pendapatan dihitung **otomatis** dari Transaksi Barber
  capster tersebut dalam periode (bulan) yang dipilih -- bukan input manual.
- Owner/Admin mengisi Bonus, Potongan, Keterlambatan → Total Gaji = (Pendapatan
  × Persentase Bagi Hasil) + Bonus - Potongan - Keterlambatan.
- Satu capster hanya punya satu baris per periode (upsert) -- menghitung
  ulang & menyimpan lagi akan memperbarui baris yang sama, bukan duplikat.

### Data Pelanggan (perluasan `Pelanggan.gs`)
- Halaman daftar + pencarian, detail per pelanggan menampilkan **riwayat
  haircut** (Barber) dan **riwayat pembelian** (Warkop), serta toggle status
  **Member**.

### Audit Log
- Halaman untuk Owner/Admin melihat seluruh jejak aktivitas (siapa,
  kapan, aksi apa, data sebelum/sesudah) yang sudah dicatat sejak Fase 1.

### Owner Panel
- **Kelola User** (`Users.gs`): buat/edit akun, ubah role & status, reset
  password. Password (hash & salt) **tidak pernah** dikirim ke klien.
- **Kelola Transaksi** (`OwnerPanel.gs`): lihat semua transaksi Barber/Warkop
  termasuk yang terhapus, edit diskon/catatan/status (GrandTotal dihitung
  ulang), hapus (soft-delete lewat `IsDeleted`), dan restore.
- **Backup & Restore**: unduh seluruh database sebagai satu file JSON
  (tanpa kredensial login), dan restore (timpa) dari file backup dengan
  konfirmasi berlapis. **Sheet Kasir/kredensial login tidak pernah ikut
  ditimpa** oleh restore -- mencegah Owner terkunci dari akunnya sendiri
  akibat memulihkan backup lama.

## Bug Nyata yang Ditemukan & Diperbaiki

Review visual manual (bukan test otomatis) menemukan toast **"Gagal memuat
data dashboard"** muncul sesaat setelah login -- padahal dashboard tetap
tampil dan terlihat baik-baik saja secara sekilas.

**Akar masalah:** `login.js` memanggil `navigate('/')` secara eksplisit
setelah `login()` berhasil. Namun `login()` sendiri sudah memicu
`authStore.set()`, yang lewat subscription memicu `mountShell()` →
render ulang rute saat ini secara otomatis. Ini membuat **dua** render rute
`'/'` (Dashboard Gabungan) berjalan hampir bersamaan; keduanya membuat
instance Chart.js baru pada `<canvas>` yang sama, dan yang kedua gagal
dengan error "Canvas is already in use" -- caught oleh try/catch sehingga
hanya tampil sebagai toast generik, tidak meng-crash aplikasi maupun
tercatat sebagai console error (sehingga lolos dari semua test otomatis
sebelumnya yang hanya memeriksa `consoleErrors.length === 0`).

**Perbaikan:**
1. Menghapus `navigate('/')` yang redundan di `login.js` -- router sudah
   menangani ini otomatis lewat reaksi terhadap perubahan `authStore`.
2. Mengeraskan `router.js` dengan **token generasi render**: kalau ada
   `handleRouteChange()` lain yang mulai sebelum render sebelumnya selesai,
   render yang lebih lama akan membuang hasilnya sendiri (memanggil fungsi
   cleanup yang baru saja dikembalikan) alih-alih menimpa bookkeeping milik
   render yang lebih baru -- mencegah kelas bug serupa di navigasi cepat lainnya.
3. Menambah regresi test e2e yang memeriksa tidak ada toast tak terduga
   dan hanya ada satu instance `<canvas>` grafik tepat setelah login.

Pelajaran: cakupan test otomatis sebelumnya (cek `consoleErrors.length===0`)
tidak menangkap bug ini karena errornya di-*catch* dan hanya muncul sebagai
toast. Verifikasi visual manual tetap penting sebagai lapisan terakhir.

## Testing

```bash
npm run test:backend          # 91 unit test (+22 baru: Shift, Gaji Capster, Pelanggan, Users, Owner Panel)
npm run build:css
npm run test:e2e:owner-panel  # 21 skenario end-to-end Chromium
npm run test:e2e:dashboard    # regresi bug Chart.js ganda (16 skenario)
```

## Checklist Fase 7 (selesai & teruji)

- [x] Closing Shift: buka/tutup dengan perhitungan otomatis, kunci setelah ditutup, reopen khusus Owner/Admin
- [x] Transaksi & pengeluaran otomatis tertaut ke shift yang sedang berjalan
- [x] Gaji Capster: Total Kepala & Pendapatan otomatis, Bonus/Potongan/Keterlambatan manual, upsert per periode
- [x] Data Pelanggan: cari, riwayat haircut & pembelian, toggle Member
- [x] Audit Log: halaman lihat seluruh jejak aktivitas dengan detail sebelum/sesudah
- [x] Owner Panel: kelola user (tanpa bocor kredensial), kelola transaksi (edit/hapus/restore), backup & restore database (kredensial login terlindungi)
- [x] Bug render ganda Chart.js ditemukan & diperbaiki + regresi test ditambahkan
