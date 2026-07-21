# Setup Spreadsheet & Deploy Backend (Fase 1)

Panduan ini untuk menyiapkan database (Google Spreadsheet) dan backend
(Google Apps Script) dari awal. Frontend akan disambungkan ke Web App URL
yang dihasilkan di langkah terakhir (Fase 2 dan seterusnya).

## Langkah 1 — Buat Spreadsheet baru

1. Buka [sheets.google.com](https://sheets.google.com) dengan akun Google
   yang akan dipakai untuk mengelola usaha.
2. Buat spreadsheet baru, beri nama misalnya **"Database POS Barber Warkop"**.

## Langkah 2 — Buka Apps Script Editor

1. Di spreadsheet tsb: menu **Extensions/Ekstensi → Apps Script**.
2. Akan terbuka editor Apps Script yang otomatis terhubung (bound) ke
   spreadsheet ini — inilah cara "menghubungkan Spreadsheet" ke backend.

## Langkah 3 — Salin seluruh kode backend

Salin isi setiap file di folder `backend/gas/` ke project Apps Script:

1. Hapus isi file default `Code.gs` yang kosong.
2. Untuk setiap file di `backend/gas/*.js` (kecuali `appsscript.json`), buat
   file script baru di editor Apps Script dengan **nama yang sama** (tanpa
   ekstensi `.js` — Apps Script otomatis memberi ekstensi `.gs`), lalu tempel
   isinya. Urutan pembuatan file tidak masalah (semua digabung dalam satu
   scope global oleh Apps Script).
3. Untuk `appsscript.json`: di editor Apps Script, klik ikon gear ⚙️
   ("Project Settings") → centang **"Show appsscript.json manifest file in
   editor"**. File manifest akan muncul di daftar file — timpa isinya dengan
   isi `backend/gas/appsscript.json`.

> Alternatif lebih cepat untuk developer: pakai [`clasp`](https://github.com/google/clasp)
> (`npm i -g @google/clasp`), `clasp login`, `clasp create --type sheets --title "POS Barber Warkop"`,
> lalu `clasp push` dari folder `backend/gas/`. File `.clasp.json` yang
> dihasilkan **jangan di-commit** (sudah ada di `.gitignore`, berisi Script ID
> milik akun masing-masing).

## Langkah 4 — Jalankan Setup Database

**Cara A (disarankan — lewat menu):**
1. Kembali ke tab Spreadsheet, **reload halaman** (F5).
2. Akan muncul menu baru **"POS Admin"** di sebelah menu Help.
3. Klik **POS Admin → Jalankan Setup Awal Database**.
4. Ikuti 3 dialog: username Owner, password Owner (boleh dikosongkan supaya
   digenerate otomatis), nama lengkap Owner.
5. Saat pertama kali menjalankan skrip apa pun di project ini, Google akan
   meminta **izin otorisasi** (akses ke Spreadsheet, Drive untuk backup, dst.)
   — klik **Lanjutkan/Advanced → Buka (nama project) (tidak aman)** ini normal
   untuk script pribadi yang belum diverifikasi Google, lalu **Allow**.
6. Setelah selesai, akan muncul dialog berisi **username & password Owner** —
   catat baik-baik, lalu **segera ganti password** setelah login pertama kali
   (lewat fitur ganti password di menu Owner, tersedia mulai Fase 8).

**Cara B (headless, lewat editor Apps Script):**
1. Di editor Apps Script, pilih fungsi `setupDatabase` dari dropdown fungsi
   di toolbar, lalu klik **Run**.
2. Ini akan membuat semua sheet dengan Owner default (`username: owner`,
   password digenerate acak). Untuk melihat passwordnya, buka **Executions**
   (ikon jam di sidebar kiri) → klik eksekusi terakhir → lihat nilai
   kembalian (`return value`) yang berisi `owner.password`.

Setelah setup, spreadsheet akan berisi 18 sheet: `Settings, Users, Kasir,
Capster, Pelanggan, Layanan Barber, Produk Warkop, Inventory Barber,
Inventory Warkop, Transaksi Barber, Transaksi Warkop, Pengeluaran Barber,
Pengeluaran Warkop, Closing Shift, Gaji Capster, Promo Voucher, Audit Log,
Dashboard` — masing-masing dengan header kolom yang sudah terisi & di-freeze.

## Langkah 5 — Deploy sebagai Web App

1. Di editor Apps Script: tombol **Deploy → New deployment**.
2. Klik ikon gear di samping "Select type" → pilih **Web app**.
3. Isi:
   - **Description**: `POS Barber Warkop API v1`
   - **Execute as**: `Me (email Anda)` — supaya script berjalan dengan izin
     Anda meski frontend diakses publik.
   - **Who has access**: `Anyone` — supaya frontend statis (dihosting di mana
     pun) bisa memanggil API ini. Keamanan tetap terjaga karena **otorisasi
     dilakukan di level aplikasi** lewat token login (lihat `docs/ARCHITECTURE.md`
     bagian Autentikasi), bukan lewat pembatasan akses Apps Script.
4. Klik **Deploy**. Salin **Web app URL** yang muncul (formatnya
   `https://script.google.com/macros/s/XXXXXXXX/exec`) — inilah `API_BASE_URL`
   yang akan dipakai frontend (dikonfigurasi di Fase 2).
5. **Setiap kali kode backend diubah**, Anda harus membuat **New deployment**
   lagi (atau **Manage deployments → Edit → New version**) supaya perubahan
   ter-publish — Apps Script tidak otomatis mem-publish ulang draft yang
   disimpan.

## Langkah 6 — Smoke test manual (checklist Fase 1)

Karena sesi pembuatan kode ini tidak memiliki akun Google untuk deploy
sungguhan, jalankan checklist berikut **setelah Anda deploy sendiri**, buka
Web App URL di browser / lewat `curl`, untuk memverifikasi Fase 1 benar-benar
bekerja di lingkungan nyata:

- [ ] Buka `<Web App URL>` langsung di browser (GET tanpa parameter) → harus
      muncul JSON `{"ok":true,"data":{"status":"ok", ...}}`.
- [ ] Login dengan akun Owner yang dibuat di Langkah 4 (lihat contoh `curl`
      di bawah) → harus mendapat `token` dan `data.user.role === "Owner"`.
- [ ] Login dengan password salah → harus dapat `{"ok":false,"error":{"code":"UNAUTHORIZED", ...}}`.
- [ ] Panggil `settings.view` dengan token Owner → harus mengembalikan seluruh
      key di `DEFAULT_SETTINGS` (lihat `Config.js`).
- [ ] Panggil `users.create` untuk membuat 1 akun tiap role (Admin, Kasir,
      Capster) dengan token Owner → sukses, lalu cek baris baru muncul di
      sheet **Users** dengan `PasswordHash`/`PasswordSalt` terisi (bukan
      plaintext).
- [ ] Login sebagai akun Kasir yang baru dibuat, lalu coba panggil
      `backup.create` → harus ditolak `{"code":"FORBIDDEN"}` (Kasir bukan Owner).
- [ ] Login sebagai Owner, panggil `backup.create` → sebuah file baru bernama
      `Backup - ... - <tanggal jam>` muncul di Google Drive.
- [ ] Buka sheet **Audit Log** → baris untuk `auth.login`, `users.create`,
      `backup.create` sudah tercatat dengan `Timestamp`, `NamaUser`, `Role`.
- [ ] Panggil `auditlog.list` dengan token Owner → data terbaru muncul di
      urutan paling atas.

### Contoh `curl` untuk login

```bash
curl -X POST "<Web App URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"auth.login","payload":{"username":"owner","password":"PASSWORD_ANDA"}}'
```

Contoh memanggil action yang butuh token:

```bash
curl -X POST "<Web App URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"settings.view","token":"TOKEN_HASIL_LOGIN","payload":{}}'
```

Jika seluruh checklist di atas lulus, Fase 1 dinyatakan bekerja dan aman
untuk lanjut ke Fase 2 (Frontend Shell & PWA).
