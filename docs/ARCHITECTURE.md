# Arsitektur Aplikasi Kasir POS Barber & Warkop

Status: **Fase 1 (Backend & Database) selesai.** Dokumen ini menjelaskan keputusan
arsitektur yang dipakai di seluruh proyek, supaya konsisten saat fase-fase
berikutnya (Frontend, Dashboard, Modul Barber/Warkop, dst.) dibangun.

## 1. Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | HTML5 + TailwindCSS + Vanilla JS (ES6 modules) | Ringan, tanpa framework build-heavy, cocok untuk PWA offline-first |
| Grafik | Chart.js (di-vendor lokal) | Ringan, cukup untuk kebutuhan dashboard, bekerja offline |
| Backend | Google Apps Script (Web App) | Sesuai requirement, gratis, terintegrasi langsung dengan Google Sheets |
| Database | Google Spreadsheet | Sesuai requirement, 1 sheet = 1 "tabel" |
| PWA | Web App Manifest + Service Worker + IndexedDB | Install Android/Desktop, offline cache |

## 2. Kontrak API (RPC tunggal lewat doGet/doPost)

Semua request ke backend berbentuk:

```json
{
  "action": "auth.login",
  "token": "<token atau null untuk action publik>",
  "payload": { "...": "..." }
}
```

Response sukses:
```json
{ "ok": true, "data": { "...": "..." } }
```

Response gagal:
```json
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

**Kenapa satu endpoint (bukan REST banyak path)?** Apps Script Web App hanya
mengekspos `doGet`/`doPost` — tidak ada routing path asli. RPC-style dengan
field `action` adalah pendekatan standar untuk Apps Script Web App.

**Kenapa `doPost` harus dikirim dengan `Content-Type: text/plain;charset=utf-8`
dari client (bukan `application/json`)?** Supaya browser menganggapnya
"simple request" dan tidak mengirim CORS preflight (`OPTIONS`) — Apps Script
Web App tidak bisa merespons preflight OPTIONS. Body tetap JSON biasa, hanya
header Content-Type yang berbeda; `doPost` di `Code.js` tetap `JSON.parse` isi
body secara manual. Implementasi client ada di `frontend/js/core/api.js`
(dibangun Fase 2).

Daftar seluruh action ada di `backend/gas/Validation.js` (`ACTIONS`). Fase 1
mengimplementasikan handler untuk: `auth.*`, `settings.*`, `users.*`,
`backup.*`, `auditlog.list`. Action lain (`transaksi.*`, `dashboard.*`,
`shift.*`, `payroll.*`, dst.) sudah terdaftar di matriks RBAC tapi handler-nya
menyusul di Fase 4-9 — cukup tambah `case` baru di `dispatchAction_()`
(`Code.js`), tidak perlu mengubah routing/RBAC yang sudah ada.

## 3. Autentikasi & Sesi

Token **stateless mirip-JWT**: `payloadB64.signatureB64`, HMAC-SHA256, secret
disimpan di Script Properties (dibuat otomatis sekali saat pertama dipakai).

Kenapa tidak pakai `CacheService` untuk sesi? `CacheService` di Apps Script
punya batas masa berlaku maksimum 6 jam — terlalu pendek untuk shift kerja
kasir yang bisa 8-12 jam. Token stateless bisa punya masa berlaku custom
(default 12 jam, diatur lewat Settings `sessionTokenTtlHours`) tanpa perlu
menyimpan state sesi di server.

Logout tetap didukung meski token stateless: signature token dicatat ke
`CacheService` ("revoked list") sampai token itu sendiri kedaluwarsa — bukan
menyimpan seluruh sesi aktif, hanya token yang sudah di-logout.

Password di-hash SHA-256 + salt unik per user (`Utilities.computeDigest`).
Pesan error login sengaja generik ("Username atau password salah") untuk
mencegah user enumeration.

## 4. RBAC (Role-Based Access Control)

Matriks lengkap ada di `backend/gas/Validation.js` (`getRolePermissions()`).
Ringkasan:

| Aksi | Owner | Admin | Kasir | Capster |
|---|---|---|---|---|
| Transaksi (buat) | ✓ | ✓ | ✓ | ✗ |
| Edit/Hapus/Restore transaksi | ✓ | ✓ | ✗ | ✗ |
| Tutup Kas (shift miliknya) | ✓ | ✓ | ✓ | ✗ |
| Buka kembali shift tertutup | ✓ | ✓ | ✗ | ✗ |
| Kelola user & hak akses | ✓ | ✗ | ✗ | ✗ |
| Backup/Restore Database | ✓ | ✗ | ✗ | ✗ |
| Lihat Audit Log | ✓ | ✓ | ✗ | ✗ |
| Dashboard Gabungan/Barber/Warkop | ✓ | ✓ | ✓ (view) | ✗ |
| Lihat performa & gaji sendiri | ✓ | ✓ | ✗ | ✓ |

Setiap request yang butuh otorisasi memanggil `requirePermission(token, action)`
(`Auth.js`) yang: (1) memverifikasi token, (2) mengecek `hasPermission(role, action)`.
Default-nya **fail-closed**: action yang tidak terdaftar di peta RBAC otomatis
ditolak untuk semua role.

## 5. Skema Spreadsheet (18 sheet)

Dibuat otomatis oleh `setupDatabase()` (`backend/gas/Setup.js`). Definisi
kolom lengkap ada di `backend/gas/Config.js` (`COLUMNS`). Lihat juga
`docs/SPREADSHEET_SETUP.md` untuk penjelasan tiap sheet.

15 sheet wajib dari spesifikasi: `Settings, Kasir, Capster, Pelanggan, Layanan
Barber, Produk Warkop, Inventory Barber, Inventory Warkop, Transaksi Barber,
Transaksi Warkop, Pengeluaran Barber, Pengeluaran Warkop, Closing Shift, Audit
Log, Dashboard`.

3 sheet tambahan (fungsional, bukan fitur dummy):
- **Users** — kredensial login seluruh role (Owner/Admin/Kasir/Capster),
  dipisah dari data profil operasional supaya Kasir/Capster non-login (mis.
  capster yang tidak pernah akses aplikasi) tetap bisa didata tanpa akun.
- **Gaji Capster** — penyimpanan hasil perhitungan gaji per periode (modul
  Gaji Capster di Fase 7 butuh persistensi, bukan hanya kalkulasi sesaat).
- **Promo Voucher** — untuk fitur bonus Promo/Voucher/Cashback (Fase 9).

### Asumsi desain (didokumentasikan karena tidak dirinci di spesifikasi awal)

- **Stok Produk Warkop** berkurang otomatis 1:1 saat menu terjual (bukan
  resep/BOM multi-bahan — spesifikasi tidak meminta manajemen resep).
  **Inventory Warkop/Barber** adalah stok bahan baku/consumable yang dikelola
  manual oleh Admin/Owner (pembelian, pemakaian) dengan alert stok rendah
  sendiri, sesuai permintaan "Pisahkan menjadi Inventory Barber/Warkop".
- Bahasa UI: Indonesia. Mata uang: Rupiah. Tidak ada pajak/PPN (tidak diminta).
- Role **Capster** login = akses read-only ke performa & slip gaji miliknya
  sendiri (spesifikasi tidak memberi Capster hak transaksi).
- Transaksi & Pengeluaran memakai **soft delete** (`Deleted`, `DeletedAt`,
  `DeletedBy`) supaya Owner bisa "Restore transaksi" sesuai requirement Owner
  Panel — baris tidak pernah dihapus fisik dari sheet.

## 6. Performa (target: tetap cepat walau >100.000 transaksi)

- Baca/tulis sheet selalu **batch** (`getValues`/`setValues`), tidak pernah
  cell-by-cell.
- `dbGetPage(sheetName, offset, limit)` untuk pagination (dipakai modul
  Laporan/Transaksi di Fase 8) — tidak membaca seluruh sheet ke memori.
- `getAuditLogPage()` membaca dari baris paling bawah (data terbaru) tanpa
  perlu membalik seluruh isi sheet.
- Sheet **Dashboard** dipakai sebagai cache agregat (diisi & di-invalidate oleh
  modul Dashboard di Fase 3) supaya kartu/grafik tidak menghitung ulang dari
  nol setiap dibuka.
- **Catatan jujur**: Google Sheets bukan database sungguhan — pada skala
  100.000+ baris, operasi read-all (mis. laporan tahunan tanpa filter) akan
  tetap lebih lambat dibanding RDBMS asli. Mitigasi yang diterapkan: filter
  tanggal di awal (bukan setelah baca semua data), cache agregat, dan
  rekomendasi arsip tahunan (pindahkan data lama ke spreadsheet arsip terpisah)
  didokumentasikan sebagai opsi lanjutan, bukan diklaim otomatis.

## 7. Strategi Testing

Karena sesi ini tidak punya akun Google untuk membuat Spreadsheet/Apps Script
project sungguhan, seluruh **logika bisnis murni** (tanpa dependency
`SpreadsheetApp`/`CacheService`/`PropertiesService`) dipisah ke fungsi-fungsi
yang bisa di-`require()` langsung oleh Node lewat guard:

```js
if (typeof module !== 'undefined') { module.exports = { ... }; }
```

Guard ini tidak pernah aktif di runtime Apps Script (global `module` memang
tidak ada di sana), jadi tidak mempengaruhi produksi sama sekali.

File yang **murni & diuji** (`tests/backend/*.test.js`): `Config.js`,
`Utils.js`, `Validation.js` (termasuk seluruh matriks RBAC), `TokenUtils.js`
(termasuk sign/verify HMAC sungguhan lewat Node `crypto`, deteksi tampering,
deteksi kedaluwarsa), `Db.js` (transformasi row↔object), `AuditLog.js`
(pembentukan row log).

File yang **hanya bisa diverifikasi setelah deploy** (memanggil
`SpreadsheetApp`/`Utilities`/`PropertiesService`/`CacheService`/`DriveApp`
langsung): `Auth.js`, `Setup.js`, `Backup.js`, `Settings.js`, `Users.js`,
`Code.js`. File-file ini ditulis setipis mungkin (murni orkestrasi memanggil
fungsi murni di atas) dan direview manual baris-per-baris. Checklist
smoke-test manual pasca-deploy ada di `docs/SPREADSHEET_SETUP.md`.

Jalankan test: `npm test` (semua) atau `npm run test:backend`.
