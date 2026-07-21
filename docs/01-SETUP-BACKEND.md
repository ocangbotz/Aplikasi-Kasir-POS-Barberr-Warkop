# Fase 1 — Setup Backend & Database (Google Apps Script + Google Sheets)

Fase ini menyiapkan otak dari aplikasi: Google Apps Script sebagai backend API,
dan Google Spreadsheet sebagai database. Frontend (fase berikutnya) akan
memanggil Web App URL yang dihasilkan di sini.

## 1. Prasyarat

- Akun Google (gratis, cukup Gmail biasa).
- Browser (Chrome/Edge/Firefox).
- Tidak perlu install apa pun untuk deploy manual (opsi `clasp` untuk yang mau CLI ada di bagian bawah).

## 2. Membuat Project Apps Script

1. Buka https://script.google.com
2. Klik **New Project**.
3. Ganti nama project (klik "Untitled project" di kiri atas) menjadi `Kasir Barber Warkop - Backend`.
4. Hapus isi default `Code.gs` yang kosong.
5. Untuk setiap file di folder `backend/src/` pada repo ini, buat file baru di Apps Script dengan **nama yang sama** (tanpa ekstensi `.gs`, Apps Script otomatis menambahkannya):
   - `Config`
   - `Utils`
   - `Auth`
   - `AuditLog`
   - `Code`
   - `SetupDatabase`
6. Copy-paste isi masing-masing file dari repo ke file Apps Script yang sesuai.
7. Buka **Project Settings** (ikon gerigi) → centang **"Show appsscript.json manifest file in editor"**.
8. Buka file `appsscript.json` yang muncul di editor, ganti isinya dengan isi `backend/appsscript.json` dari repo ini.

> Alternatif lebih cepat: gunakan [`clasp`](https://github.com/google/clasp) (lihat bagian 6).

## 3. Menjalankan Setup Database

1. Di editor Apps Script, pilih file `SetupDatabase`.
2. Di dropdown pemilih fungsi (sebelah tombol Run/Debug), pilih fungsi **`setupDatabase`**.
3. Klik **Run**.
4. Saat pertama kali run, Google akan minta otorisasi:
   - Klik **Review permissions** → pilih akun Google Anda.
   - Akan muncul peringatan "Google hasn't verified this app" (wajar, karena ini script pribadi Anda) → klik **Advanced** → **Go to Kasir Barber Warkop - Backend (unsafe)** → **Allow**.
5. Setelah selesai, buka tab **Execution log** (Ctrl+Enter atau menu View → Logs). Anda akan melihat output JSON berisi:
   - `spreadsheetUrl` — link ke Google Spreadsheet database yang baru dibuat.
   - `ownerAccountCreated.username` = `owner`
   - `ownerAccountCreated.password` = password acak 8 karakter — **catat ini sekarang**, tidak akan ditampilkan lagi setelah sheet Kasir terisi.
6. Buka `spreadsheetUrl` tersebut untuk memverifikasi 15 sheet berikut sudah dibuat dengan header:
   `Dashboard, Transaksi Barber, Transaksi Warkop, Pengeluaran Barber, Pengeluaran Warkop, Capster, Kasir, Pelanggan, Produk Warkop, Layanan Barber, Inventory Barber, Inventory Warkop, Closing Shift, Audit Log, Settings`

Fungsi `setupDatabase()` aman dijalankan berulang kali — sheet yang sudah punya
header tidak akan ditimpa, dan akun Owner tidak akan dibuat dobel.

## 4. Deploy sebagai Web App

1. Klik tombol **Deploy** (kanan atas) → **New deployment**.
2. Klik ikon gerigi di samping "Select type" → pilih **Web app**.
3. Isi:
   - Description: `v1`
   - Execute as: **Me (email Anda)**
   - Who has access: **Anyone**
4. Klik **Deploy**.
5. Salin **Web app URL** yang muncul (formatnya `https://script.google.com/macros/s/XXXXXXXX/exec`). URL ini akan dipakai frontend sebagai `API_BASE_URL` (lihat fase 2).

Setiap kali Anda mengubah kode backend, buat **New deployment** baru (atau
gunakan **Manage deployments → Edit → New version** pada deployment yang sama
agar URL tetap sama).

## 5. Uji Coba Cepat (tanpa frontend)

Setelah deploy, tes endpoint `ping` langsung dari browser (method GET):

```
https://script.google.com/macros/s/XXXXXXXX/exec?action=ping
```

Harus mengembalikan:
```json
{"ok":true,"data":{"pong":true,"time":"...","version":"1.0.0"}}
```

Untuk tes login (harus pakai POST, jadi gunakan `curl`):
```bash
curl -X POST "https://script.google.com/macros/s/XXXXXXXX/exec" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"action":"login","username":"owner","password":"PASSWORD_DARI_LOG"}'
```
Harus mengembalikan `ok:true` beserta `token` dan data `user`.

> **Penting:** body dikirim sebagai `text/plain`, bukan `application/json`.
> Ini disengaja — Google Apps Script Web App tidak bisa merespons CORS
> preflight (`OPTIONS`) dengan benar, jadi frontend mengirim body sebagai
> plain text agar browser tidak melakukan preflight request.

## 6. (Opsional) Deploy via `clasp` CLI

Jika Anda familiar dengan Node.js:

```bash
npm install -g @google/clasp
clasp login
cd backend
clasp create --type webapp --title "Kasir Barber Warkop - Backend"
clasp push
clasp deploy
```

`.clasp.json` hasil `clasp create` sengaja di-gitignore karena berisi Script ID
yang unik per akun Google.

## 7. Keamanan Awal — Wajib Dilakukan

- **Ganti password Owner** setelah login pertama kali di frontend (fase 2) — fitur ganti password ada di menu Profil.
- Jangan bagikan Web App URL secara publik di tempat umum; meski aksesnya "Anyone", semua endpoint tervalidasi lewat token sesi kecuali `login`.
- Simpan `DATABASE_SPREADSHEET_ID` (tersimpan otomatis di Script Properties) — bisa dicek di **Project Settings → Script Properties**.

## Status Pengujian Fase 1

Karena eksekusi nyata Google Apps Script hanya bisa diuji setelah deploy ke
akun Google (di luar jangkauan sandbox development), logika backend diuji
dengan **mock runtime GAS di Node.js** (`backend/test/`) yang mensimulasikan
`SpreadsheetApp`, `PropertiesService`, `Utilities`, dan `ContentService`.

Jalankan:
```bash
npm run test:backend
```

Cakupan pengujian saat ini (18 test, semua lulus):
- Pembuatan 15 sheet dengan header yang benar, dan idempotensi `setupDatabase()`.
- Seed Settings default & akun Owner (password acak, ter-hash, bukan plaintext).
- Login sukses/gagal, validasi token, permission matrix per role.
- Router `doPost` end-to-end (`ping`, `login`, `getMe`, action tidak dikenal).
- Helper: `generateId_`, `sanitizeString_` (anti-XSS), `requireFields_`, mapping sheet↔object.

Setelah Anda deploy manual ke Google (langkah 2-4 di atas), lakukan juga uji
manual di langkah 5 untuk memastikan environment Google Apps Script yang
sesungguhnya berperilaku sama dengan mock.
