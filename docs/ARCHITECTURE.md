# Arsitektur Aplikasi Kasir POS Barber & Warkop

Status: **Fase 1 (Backend & Database) dan Fase 2 (Frontend Shell & PWA)
selesai.** Dokumen ini menjelaskan keputusan arsitektur yang dipakai di
seluruh proyek, supaya konsisten saat fase-fase berikutnya (Dashboard, Modul
Barber/Warkop, dst.) dibangun.

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

## 8. Frontend (Fase 2)

### Struktur
```
frontend/js/core/     api.js, auth.js, router.js, state.js, ui.js, db-cache.js, config.js, format.js
frontend/js/modules/  connection-setup, auth (login), shell (layout), home,
                       settings, users, auditlog, backup — 1 folder per modul,
                       masing-masing mengekspor 1 fungsi render(container, params)
frontend/css/         input.css (source Tailwind) -> app.css (build, DI-COMMIT
                       supaya frontend jalan tanpa build step di hosting statis)
```

Halaman JS dirender lewat template string (`innerHTML`) + `addEventListener`,
bukan file `.html` partial terpisah — lebih sederhana untuk PWA (tidak perlu
fetch tambahan per halaman) dan tetap modular karena 1 file = 1 modul.

### Routing & RBAC di sisi client
`core/router.js` adalah hash-router kecil (`compileRoutePath`/`matchPath`
murni & diuji lewat Node) dengan dukungan param dinamis (`/transaksi/:id`,
dipakai mulai Fase 4). Setiap route punya `roles: string[] | null`; `app.js`
menyediakan fungsi `guard` yang menolak akses kalau (a) `apiBaseUrl` belum
diisi, (b) belum login, atau (c) role user tidak termasuk `roles` route
tsb — best-effort UX saja, **RBAC yang sesungguhnya tetap di-enforce backend**
(`Validation.js`), karena kode client selalu bisa dilewati oleh pengguna yang
punya akses DevTools.

Menu sidebar (`shell/layout.js`) hanya menampilkan tautan ke modul yang
role user berhak akses DAN yang fitur-nya sudah benar-benar ada — supaya
tidak ada link ke halaman kosong/dummy di fase manapun.

### Koneksi ke backend
URL Web App (beda per instalasi) disimpan di `localStorage`, diisi lewat
layar "Pengaturan Koneksi" yang muncul otomatis kalau kosong. `core/api.js`
selalu POST dengan `Content-Type: text/plain` (lihat §2) dan melempar
`ApiError` (punya `.code` sama seperti error backend) supaya halaman bisa
menampilkan pesan yang konsisten.

### Offline & PWA
- `core/db-cache.js`: wrapper IndexedDB — antrean aksi offline
  (`enqueueAction`/`getQueuedActions`), cache ber-TTL, & draft autosave.
  Infrastrukturnya sudah lengkap di Fase 2; modul transaksi Fase 4/5 tinggal
  memakai `apiCall(action, payload, { queueOnOffline: true })`.
- `service-worker.js`: cache-first-dengan-revalidate untuk asset same-origin
  saja (GET). Request ke backend Apps Script (POST, cross-origin) sengaja
  tidak pernah disentuh service worker — data transaksi harus selalu fresh.
- `manifest.webmanifest` + ikon (`assets/icons/`, di-generate dari
  `icon-source.svg`/`maskable-source.svg` lewat `sharp`) untuk instalasi
  Android/Desktop/iOS. Lihat `docs/PWA_INSTALL.md`.

### Dark mode & desain
Tailwind `darkMode: 'class'`, class `dark` di `<html>` di-toggle & disimpan
di `localStorage` (`core/ui.js`), diterapkan lewat inline script kecil di
`<head>` SEBELUM render pertama (mencegah flash tema salah). Warna brand
(`barber`/`warkop`/`gabungan`) & efek glassmorphism (`.glass-card`,
`backdrop-blur`) didefinisikan sebagai komponen Tailwind di `input.css`.

**Catatan gotcha CSS yang ditemukan & diperbaiki saat testing browser
sungguhan:** teks di dalam elemen `<a>` yang sudah pernah dikunjungi
(`:visited`) TIDAK mewarisi `color` dari parent seperti elemen biasa —
browser memaksakan warna `:visited` miliknya sendiri (proteksi privasi
anti-history-sniffing), dan `getComputedStyle` bahkan berbohong soal warna
aktualnya (selalu melaporkan warna seolah belum dikunjungi) sehingga tidak
bisa dipakai untuk mendeteksi bug ini — hanya screenshot piksel asli yang
menunjukkan warna redup sesungguhnya. Efeknya: judul kartu/link yang sudah
pernah diklik tampak pudar di dark mode. **Solusi:** setiap `<a>` yang
warnanya penting harus eksplisit set `visited:text-*` (dan varian
`dark:visited:text-*`), tidak cukup mengandalkan `text-*`/inherit biasa —
lihat `.nav-link` di `input.css` dan kartu modul di `modules/home/index.js`
sebagai contoh pola yang benar. Berlaku untuk SEMUA `<a>` baru di fase-fase
berikutnya.

### Testing frontend
Logika murni (tanpa DOM): `core/format.js`, `core/router.js`
(`compileRoutePath`/`matchPath`), `core/auth.js` (`hasRole`), `core/db-cache.js`
(`isCacheEntryExpired`) — diuji lewat Node (`tests/frontend/*.test.js`,
folder `frontend/` punya `package.json` sendiri berisi `{"type":"module"}`
supaya file ESM-nya bisa di-`import()` dari test Node tanpa mengubah
konvensi module root project yang CommonJS).

UI & integrasi end-to-end diverifikasi manual dengan Playwright
(`playwright-core`, memakai Chromium yang sudah tersedia di environment)
menjalankan static server lokal dan **mem-mock response backend persis
sesuai kontrak JSON Fase 1** lewat `page.route()` — teknik testing standar
di sisi frontend, BUKAN mock server yang di-ship sebagai bagian aplikasi.
Skenario yang diverifikasi: redirect Pengaturan Koneksi → Login → Beranda,
RBAC nav per role (Owner vs Kasir), akses langsung URL yang tidak diizinkan,
dark mode toggle, CRUD user, backup, logout, dan tidak ada error console.
Skrip verifikasi ini disimpan di luar repo (scratchpad sesi), sesuai
keputusan untuk tidak menyimpan mock backend sebagai deliverable.

## 9. Modul Barber (Fase 3)

### Sinkronisasi Users -> Kasir/Capster
Sheet `Kasir`/`Capster` (wajib dari spesifikasi) diisi **otomatis** setiap
kali akun ber-role Kasir/Capster dibuat/diubah lewat Manajemen User
(`Users.js` → `Kasir.js`/`Capster.js`). Owner cukup satu kali input di
Manajemen User — tidak ada form input profil Kasir/Capster yang terpisah,
supaya tidak ada duplikasi data (nama bisa beda antara sheet Users vs
Kasir/Capster kalau diinput manual dua kali). Field yang HANYA ada di
sheet Capster (mis. `PersentaseBagiHasil`) diberi default (40%) saat
sinkronisasi pertama, dan bisa diubah lewat halaman **Capster**
(`capster.manage`, Owner/Admin).

### Kalkulasi transaksi (Calc.js)
`backend/gas/Calc.js` (murni, diuji lewat Node) = satu-satunya sumber
kebenaran untuk subtotal/diskon/split pembayaran/poin loyalti — dipakai
`Barber.js` sekarang dan `Warkop.js` di Fase 4 supaya rumus tidak pernah
berbeda antara dua jenis usaha. `frontend/js/core/calc.js` adalah **cermin**
fungsi yang sama persis untuk preview instan di form (live subtotal/kembalian
sebelum submit) — backend TETAP validasi ulang semuanya saat submit
(client-side calc hanya UX, bukan sumber kebenaran).

Aturan pembayaran (`computePaymentBreakdown`): Cash butuh `cashAmount >=
grandTotal` (sisanya kembalian), QRIS butuh `qrisAmount === grandTotal`
persis, Split butuh `cashAmount + qrisAmount === grandTotal` persis — kalau
tidak sesuai, transaksi ditolak `VALIDATION_ERROR` sebelum tersimpan.

### Nomor transaksi & pelanggan
Nomor transaksi (`generateTransactionNumber`) urut per-hari per-jenis-usaha,
dihitung dari `dbCountByField` (full-scan sheet transaksi hari itu — cukup
untuk skala sekarang, lihat §6 soal optimasi lanjutan). Pelanggan
di-dedup berdasarkan **NoHP** (`findOrCreatePelanggan`): transaksi baru
dengan NoHP yang sudah ada memakai baris Pelanggan yang sama (kunjungan &
poin loyalti terakumulasi), bukan membuat baris pelanggan baru.

### Upload foto nota
Frontend membaca file lewat `FileReader.readAsDataURL`, mengirim base64
(tanpa prefix `data:...;base64,`) + mime type sebagai bagian payload
`pengeluaran.create`. Backend (`Pengeluaran.js`) decode via
`Utilities.base64Decode`, simpan sebagai file Drive di folder
`POS Barber Warkop - Nota Pengeluaran/<JenisUsaha>/` (dibuat otomatis kalau
belum ada), share `ANYONE_WITH_LINK` (VIEW), URL-nya disimpan di kolom
`FotoNotaUrl`.

### Struk (cetak)
`frontend/js/modules/receipt/receipt.js` — modal generik dipakai Barber
(Fase 3) & Warkop (Fase 4). Cetak pakai `window.print()` + teknik CSS
"sembunyikan semua kecuali `#receipt-print-area`" (`input.css`, blok
`@media print`) supaya hasil cetak hanya berisi struk (ukuran ~80mm),
bukan seluruh halaman aplikasi.

### Testing Fase 3
Logika murni diuji lewat Node: `Calc.js` (subtotal/diskon/split/poin —
`tests/backend/calc.test.js`), `Barber.js` validasi payload
(`tests/backend/barber.test.js`), `frontend/js/core/calc.js` (cermin
client-side — `tests/frontend/calc.test.js`). Verifikasi end-to-end:
simulasi backend gabungan (skenario setup → user → layanan → transaksi
dengan diskon persen & kembalian → pencarian/dedup pelanggan → riwayat →
pengeluaran+foto nota → RBAC) DAN verifikasi browser Playwright penuh
(isi form transaksi sungguhan, live preview subtotal/diskon/kembalian,
struk yang muncul benar, cetak ulang dari riwayat, toggle member pelanggan,
upload foto nota, RBAC sidebar per role) — keduanya lulus sebelum commit.

## 10. Modul Warkop (Fase 4)

### Stok Produk Warkop
Berbeda dari Barber (yang tidak punya konsep stok per layanan), transaksi
Warkop **memvalidasi & memotong stok Produk Warkop otomatis** saat
`transaksi.create`: tiap item dicek `Stok >= qty` sebelum transaksi
disimpan (transaksi ditolak `VALIDATION_ERROR` kalau kurang, stok TIDAK
ikut berkurang untuk transaksi yang gagal), lalu dipotong setelah baris
transaksi berhasil ditulis. ` Produk.js` juga menyediakan `restockProdukWarkop`
(tambah stok manual, terpisah dari pengurangan otomatis) dipakai halaman
Menu. Ini murni stok "menu jadi" 1:1 — bukan resep/BOM bahan baku (lihat
asumsi desain di §5); stok bahan baku ada di sheet `Inventory Warkop`
(Fase 5).

### Split Bill
Berbeda dari "Split" pada Barber (yang hanya berarti 1 tagihan dibayar
sebagian Cash + sebagian QRIS oleh 1 pembayar), Warkop mendukung **split
bill sungguhan**: tagihan dibagi ke beberapa pembayar (`splitBillPayers:
[{nama, metode, jumlah}]`), masing-masing dengan metode Cash/QRIS sendiri.
Backend (`Warkop.js`) menjumlahkan seluruh `jumlah` per metode menjadi
`cashAmount`/`qrisAmount` agregat, lalu tetap divalidasi lewat
`Calc.computePaymentBreakdown('Split', ...)` yang sama (total harus persis
sama dengan grand total) — jadi tidak ada jalur validasi terpisah, hanya
cara menyusun input yang berbeda. Detail per-pembayar disimpan di kolom
`SplitBillJSON` dan ditampilkan di struk. Frontend (`warkop/transaksi.js`)
punya tombol **"Bagi Rata"** yang otomatis membagi grand total rata ke
semua pembayar yang sudah ditambahkan (sisa pembulatan masuk ke pembayar
terakhir supaya totalnya selalu tepat).

### Margin menu
`Produk.js` menghitung `Margin = HargaJual - Modal` otomatis setiap kali
salah satu dari keduanya diubah (create maupun update) — bukan field yang
diinput manual, supaya tidak pernah tidak-sinkron.

### Reuse dari Fase 3
Modul Warkop TIDAK menduplikasi kode: kalkulasi (`Calc.js`), struk
(`receipt.js`), dan pengeluaran (`Pengeluaran.js`/`expenses/index.js`)
adalah kode yang SAMA dipakai Barber, hanya dibedakan lewat parameter
`jenisUsaha`. Halaman Warkop tidak butuh pelanggan/loyalti (spesifikasi
tidak memintanya untuk Warkop) — field `namaPelanggan` di Warkop hanya
teks bebas (mis. nomor meja), bukan entitas Pelanggan seperti di Barber.

### Testing Fase 4
Unit test murni: `validateTransaksiWarkopPayload_`
(`tests/backend/warkop.test.js`). Simulasi backend end-to-end menambahkan
skenario: buat menu (margin otomatis), RBAC produk.manage vs produk.list,
transaksi dgn potong stok otomatis, transaksi ditolak+stok tidak berubah
saat stok kurang, split bill (agregasi & validasi total match), split
bill yang totalnya salah ditolak, diskon, serta transaksi/pengeluaran
Warkop terbukti terpisah dari Barber (sheet berbeda). Verifikasi browser
Playwright penuh: buat menu, pesanan dgn QRIS pas, stok berkurang di
tabel Menu, split bill 2 pembayar pakai tombol "Bagi Rata", struk
menampilkan rincian tiap pembayar, riwayat menampilkan badge "Split Bill
(2 org)", pengeluaran Warkop — semua lulus, nol error console.

## 11. Inventory Barber & Warkop (Fase 5)

### Cakupan & batas dengan Produk Warkop
`Inventory.js` mengelola **bahan baku/consumable** (Nama, Kategori, Stok,
Satuan, Stok Minimum, Harga Beli Terakhir, Supplier) di 2 sheet terpisah
(`Inventory Barber`/`Inventory Warkop`), dikelola **manual** (restock via
`delta` positif, pemakaian via `delta` negatif) — BUKAN dipotong otomatis
oleh transaksi, karena tidak ada resep/BOM yang menghubungkan 1 transaksi
ke pemakaian bahan baku spesifik (lihat asumsi desain §5). Ini berbeda
dari stok **Produk Warkop** (menu jadi) yang memang otomatis berkurang
1:1 saat laku terjual — itu sudah dibangun di `Produk.js`/`Warkop.js`
(Fase 4). `adjustInventoryStok` menolak penyesuaian yang membuat stok
akhir negatif, dan bisa sekaligus mencatat `HargaBeliTerakhir` saat
restock (untuk referensi harga beli terbaru).

### Notifikasi stok hampir habis
`getLowStockSummary()` menggabungkan item dengan `Stok <= StokMinimum`
dari **3 sumber sekaligus**: Inventory Barber, Inventory Warkop, dan
Produk Warkop (supaya Owner/Admin/Kasir dapat satu titik notifikasi utuh,
bukan harus mengecek 3 halaman terpisah). Frontend menampilkannya sebagai
lonceng 🔔 di topbar (`shell/layout.js`) dengan badge angka & dropdown
detail per item (nama, jenis usaha, sisa stok) yang link langsung ke
halaman inventory terkait — dipanggil setiap render shell (tiap navigasi
antar halaman), bukan di-cache, supaya datanya selalu segar.

### Testing Fase 5
Unit test murni: `isLowStock_` (`tests/backend/inventory.test.js`).
Simulasi backend end-to-end: buat item per jenis usaha (terbukti
terpisah), RBAC (Kasir hanya `inventory.view`, tidak `inventory.manage`),
restock + catat harga beli, pemakaian yang bikin stok negatif ditolak,
ringkasan stok rendah gabungan 3-sumber teruji akurat (item yang stoknya
cukup TIDAK ikut muncul). Verifikasi browser Playwright penuh: tambah item
stok rendah → badge notifikasi muncul dgn angka benar → dropdown
menampilkan detail yang benar → restock via UI mengembalikan stok ke
aman → Kasir terbukti hanya bisa lihat (tombol kelola tersembunyi) — nol
error console.

## 12. Dashboard Gabungan/Barber/Warkop (Fase 6)

### Kartu "Hari Ini"/"Bulan Ini" tetap vs filter — resolusi ambiguitas spek
Spesifikasi mendaftar kartu dashboard secara literal berpasangan "Hari
Ini"/"Bulan Ini" (mis. "Total Pendapatan Hari Ini, Total Pendapatan Bulan
Ini, ..."), TAPI juga bilang "Semua dashboard memiliki filter ... Semua
grafik dan kartu berubah otomatis". Kedua kalimat ini kontradiktif kalau
ditafsirkan literal sekaligus (kartu yang namanya eksplisit "Hari Ini"
tidak mungkin ikut berubah jadi bukan hari ini). Keputusan desain:
- Kartu **Hari Ini** & **Bulan Ini** SELALU dihitung dari tanggal
  sekarang sungguhan (tidak terpengaruh filter) — referensi tetap yang
  selalu bermakna sesuai namanya, persis daftar field di spesifikasi.
- Filter mengontrol blok **"Periode Terpilih"** (kartu tambahan berisi
  metrik inti yang sama) + SELURUH chart — supaya filter (termasuk Custom
  Date) tetap punya efek nyata sesuai permintaan "semua kartu & grafik
  berubah", tanpa membuat kartu "Hari Ini" berbohong soal isinya.
Diuji eksplisit di simulasi backend: filter custom ke rentang tanpa data
membuat `periodeTerpilih` = 0, sementara `hariIni` tetap utuh.

### 3 chart Dashboard Gabungan = 3 granularitas tetap, bukan 1 filter
"Pendapatan Harian/Bulanan/Tahunan" pada Dashboard Gabungan sengaja
independen dari filter (masing-masing chart tren punya cakupan waktu
tetap: 14 hari terakhir, 12 bulan tahun berjalan, 5 tahun terakhir) —
filter cocoknya mengubah SATU rentang, sedangkan 3 chart ini memang
representasi 3 skala waktu berbeda yang ingin dilihat bersamaan.
Sebaliknya, Dashboard Barber/Warkop chart "Pendapatan"/"Jumlah Kepala"/
"Produk Terjual" MENGIKUTI filter aktif (karena di situ cuma ada 1 chart
tren, bukan 3 granularitas berbeda).

### Agregasi murni & teruji (Aggregate.js)
Seluruh matematika dashboard (jumlah, group-by-tanggal/bulan/tahun,
breakdown metode bayar, ranking "terlaris") ada di `Aggregate.js` — murni,
menerima array transaksi/pengeluaran yang SUDAH difetch (bukan
SpreadsheetApp langsung), sehingga diuji lengkap lewat Node
(`tests/backend/aggregate.test.js`, 12 test). `Dashboard.js` (GAS-only)
hanya bertugas fetch data mentah per rentang tanggal lalu memanggil
fungsi-fungsi ini. "Total Kepala" (Barber) = jumlah transaksi (1
transaksi = 1 pelanggan dilayani, walau bisa berisi beberapa layanan
sekaligus) — bukan jumlah unit layanan terjual.

### Chart.js di-vendor, dimuat lazy
`chart.js` ada di `dependencies` (bukan devDependencies, dipakai runtime
browser), file UMD-nya disalin ke `frontend/js/vendor/chart.umd.min.js`
lewat `npm run vendor:chartjs` (jalankan ulang setelah upgrade versi) —
supaya PWA tetap bisa dimuat offline tanpa CDN. Untuk menjaga beban awal
aplikasi tetap ringan, script ini TIDAK dimuat di semua halaman — hanya
di-inject sekali secara lazy (`core/load-script.js`) saat salah satu dari
3 halaman Dashboard pertama kali dibuka.

### Testing Fase 6
Unit test murni: seluruh `Aggregate.js` (12 test) + `core/chart-labels.js`
(format label sumbu chart). Simulasi backend end-to-end: pendapatan/
transaksi/pengeluaran/laba-bersih gabungan & per-usaha dihitung akurat
dari transaksi sungguhan yang dibuat di fase-fase sebelumnya, chart
harian/bulanan/tahunan punya jumlah titik data yang benar (14/12/5),
capster & layanan terlaris (Barber) serta menu & kategori terlaris
(Warkop) terverifikasi sesuai data, filter custom ke rentang kosong tidak
error, RBAC Capster ditolak total. Verifikasi browser Playwright penuh
untuk ketiga dashboard: kartu menampilkan angka yang benar, Chart.js
ter-lazy-load & ter-render (canvas + `window.Chart` tersedia), filter
Custom Date memunculkan input tanggal, dan Capster terbukti tidak melihat
menu Dashboard sama sekali di sidebar — nol error console.

## 13. Closing Shift & Gaji Capster (Fase 7)

### Penandaan transaksi/pengeluaran ke shift aktif
Setiap kali Kasir membuat transaksi (Barber/Warkop) atau mencatat
pengeluaran, `ShiftID`-nya otomatis diisi lewat helper
`activeShiftId_(actor)` (`ClosingShift.js`) yang mencari shift berstatus
`Open` milik kasir tsb — bukan sekadar mencocokkan rentang tanggal. Ini
memastikan Tutup Kas menghitung PERSIS transaksi yang terjadi selama
shift itu berjalan, termasuk kalau kasir shift malam menutup lewat tengah
malam (rentang tanggal kalender akan salah, tapi ShiftID tetap benar).
Kasir hanya boleh punya 1 shift `Open` di satu waktu — `openShift`
menolak permintaan buka shift baru selama masih ada yang belum ditutup.

### Formula rekonsiliasi kas fisik
```
TotalSistem = SaldoAwal + CashBarber + CashWarkop - PengeluaranBarber - PengeluaranWarkop
Selisih     = UangFisik - TotalSistem
```
QRIS sengaja TIDAK masuk formula karena tidak menyentuh kas fisik di
laci — dipisah sebagai info (`QrisBarber`/`QrisWarkop`) untuk verifikasi
silang, bukan komponen penghitungan selisih. `computeShiftReconciliation_`
murni dan diuji lewat Node (`tests/backend/closing-shift.test.js`).
Frontend menampilkan estimasi (`shift.view` dgn `preview: true`, memanggil
`previewOpenShift`) SEBELUM kasir mengisi Uang Fisik, supaya kasir bisa
menghitung laci lalu membandingkan — bukan menebak buta.

### Kunci & buka-kembali shift
Shift berstatus `Closed` terkunci: `closeShift` menolak penutupan ganda,
dan hanya Owner/Admin yang boleh `reopenShift` (dicatat `ReopenedBy`/
`ReopenedAt`/`ReopenReason` + Audit Log) — Kasir sendiri tidak bisa
membuka kembali shift yang sudah ditutup, sesuai RBAC matrix di §1.
Frontend menyembunyikan tombol "Buka Kembali" sepenuhnya dari Kasir
(bukan cuma disabled) di halaman Closing Shift.

### Gaji Capster: upsert per (Capster, Periode), bukan insert selalu
`generateGajiCapster` meng-upsert baris berdasarkan `capsterId` +
label periode (`periodeStart s/d periodeEnd`) — generate ulang periode
yang sama (mis. setelah koreksi bonus/potongan) memperbarui baris yang
sudah ada, bukan menambah duplikat. Formula:
```
BagiHasilAmount = TotalPendapatan * PersentaseBagiHasil / 100
TotalGaji       = BagiHasilAmount + Bonus - Potongan - Keterlambatan
```
`TotalPendapatan`/`TotalKepala` dihitung otomatis dari Transaksi Barber
milik capster tsb dalam rentang periode (Kasir/Admin tidak perlu input
manual) — `Bonus`/`Potongan`/`Keterlambatan` adalah satu-satunya input
manual, diisi Owner/Admin saat generate. `computeGajiTotal_` murni dan
diuji lewat Node (`tests/backend/payroll.test.js`).

### RBAC tampilan: Capster read-only, hanya slip miliknya
`PAYROLL_VIEW_ALL` (Owner/Admin, lihat semua slip + form generate) dan
`PAYROLL_VIEW_SELF` (Capster, hanya slip miliknya, tanpa form) adalah dua
action terpisah yang keduanya di-route ke `listGajiCapster` — pembeda ada
di `dispatchAction_` (`Code.js`) yang otomatis memfilter `capsterId`
berdasarkan `Username` aktor saat rolenya Capster. Frontend
(`modules/payroll/index.js`) memilih action mana yang dipanggil
berdasarkan role via `hasRole`, dan menyembunyikan form generate
sepenuhnya untuk Capster.

### Testing Fase 7
Unit test murni: `computeShiftReconciliation_` (5 test — pas/lebih/
kurang/saldo awal nol/pengeluaran melebihi kas masuk) dan
`computeGajiTotal_` (5 test — bagi hasil dasar, bonus, potongan,
keterlambatan, kombinasi negatif). Simulasi backend end-to-end (skenario
tambahan di harness Fase 1-6): buka shift → transaksi & pengeluaran
otomatis ter-tag ShiftID → tutup kas dgn selisih tepat ke rupiah → tutup
ganda ditolak → Kasir dilarang reopen, Owner boleh → payroll generate
dgn matematika benar → generate ulang periode sama meng-upsert (bukan
duplikat) → Kasir/Capster dilarang generate payroll → Capster hanya
lihat slip miliknya. Verifikasi browser Playwright penuh: alur buka
shift → lihat estimasi kas real-time → tutup kas dgn dialog konfirmasi →
badge "Pas" tampil → riwayat shift → Owner reopen → generate & regenerate
payroll (upsert terverifikasi lewat jumlah baris tabel tetap 1) → Kasir
melihat menu Closing Shift tapi tidak Gaji Capster (dan sebaliknya untuk
Capster) — nol error console.

## 14. Laporan & Owner Panel (Fase 8)

### Laporan menggunakan rentang tanggal bebas, bukan kartu tetap
Berbeda dari Dashboard (§12, kartu Hari Ini/Bulan Ini tetap + Periode
Terpilih), Laporan HANYA punya satu rentang aktif (default filter
`month`) yang bisa diarahkan ke tanggal berapa pun termasuk Custom Date —
sesuai maksud modul Laporan sebagai alat audit/rekap historis, bukan
ringkasan real-time. `getLaporan` (`Reports.js`, GAS-only) hanya fetch +
gabung + label `JenisUsaha` per baris, seluruh matematikanya dipakai
ulang dari `Aggregate.js` (`computeRevenueStats`, `computePaymentMethodBreakdown`)
dan helper fetch* yang sama dengan `Dashboard.js` (Fase 6) — tidak ada
logika agregasi baru yang perlu diuji ulang, cukup diverifikasi lewat
simulasi backend bahwa Laporan Barber + Laporan Warkop = Laporan
Gabungan, dan totalnya konsisten dengan Dashboard untuk rentang yang
sama.

### Export PDF/Excel/CSV — pilihan implementasi yang jujur, bukan pura-pura
Spesifikasi minta export PDF/Excel/CSV/print. Keputusan desain:
- **CSV**: dibentuk murni di browser (`core/export.js#toCsv`, diuji
  lewat Node) lalu di-download sebagai Blob — nyata, tidak butuh
  pemrosesan server.
- **Excel**: dibentuk sebagai tabel HTML bermimetype `.xls`
  (`toExcelHtml`) — teknik standar yang benar-benar dibuka Excel/Google
  Sheets/LibreOffice sebagai spreadsheet asli, TANPA perlu vendor
  library biner xlsx yang berat (konsisten dengan prinsip "vendor lokal
  hanya kalau perlu" yang sudah dipakai untuk Chart.js).
- **PDF/Cetak**: satu tombol "Cetak / Simpan PDF" yang memicu
  `window.print()` ke `#laporan-print-area` (CSS `@media print` yang
  sama dipakai struk, digeneralisasi untuk 2 area cetak sekaligus) —
  hampir semua browser modern punya tujuan cetak "Simpan sebagai PDF"
  bawaan, jadi ini export PDF yang sungguhan berfungsi tanpa perlu
  vendor library PDF terpisah.

Setiap export (format apa pun) memanggil `reports.export` (fire-and-forget,
kegagalannya tidak membatalkan file yang sudah ter-download) yang murni
mencatat ke Audit Log siapa mengekspor laporan apa kapan — akuntabilitas
nyata untuk Owner Panel, bukan sekadar tombol dekoratif.

### Owner Panel: edit transaksi dibatasi field non-finansial, sengaja
`buildTransaksiBarberEditPatch_`/`buildTransaksiWarkopEditPatch_`
(`Barber.js`/`Warkop.js`, murni & diuji lewat Node) HANYA mengizinkan
Catatan, NamaPelanggan, NoHP, dan (khusus Barber) koreksi Capster —
field lain di payload (grandTotal, items, metodeBayar, dst.) diam-diam
DIABAIKAN walau dikirim. Ini bukan keterbatasan teknis melainkan
keputusan integritas data: nominal transaksi sudah ikut dihitung di
rekonsiliasi Closing Shift (§13, kalau shift-nya sudah ditutup) dan
agregat Dashboard/Laporan yang sudah "dilihat" pengguna sebelumnya —
mengizinkan edit nominal retroaktif bisa diam-diam merusak angka yang
sudah terkunci di masa lalu tanpa jejak yang jelas. Koreksi nominal/item
dilakukan lewat Hapus + transaksi baru (jejaknya eksplisit di Audit Log
& `DeletedReason`), bukan edit di tempat. Koreksi Capster dikecualikan
dari pembatasan ini karena tidak mengubah nominal apa pun — hanya
atribusi siapa yang mengerjakan (penting karena Gaji Capster dihitung
dari atribusi ini).

### Hapus transaksi = soft-delete + alasan wajib + reversibel
`deleteTransaksiBarber`/`deleteTransaksiWarkop` menolak permintaan tanpa
`reason` (disimpan ke kolom baru `DeletedReason`), dan hanya mengubah flag
`Deleted`/`DeletedAt`/`DeletedBy` (pola soft-delete yang sudah ada sejak
Fase 1) — baris fisik tidak pernah hilang. Karena `dbGetAll` secara
default mengecualikan baris `Deleted`, penghapusan otomatis "menghilang"
dari Dashboard/Laporan/rekonsiliasi shift yang BELUM ditutup tanpa kode
tambahan; shift yang SUDAH ditutup tetap mempertahankan angka historisnya
(lihat §13) sampai Owner sengaja membuka kembali. `transaksi.list` hanya
mengembalikan baris terhapus kalau diminta eksplisit (`includeDeleted`)
DAN pemintanya Owner/Admin — kalau Kasir mengirim `includeDeleted: true`,
`Code.js` diam-diam memaksanya `false` (fail-closed di server, tidak
mengandalkan frontend menyembunyikan checkbox saja).

### Hapus/pulihkan transaksi Warkop ikut mengoreksi stok, all-or-nothing
Karena Produk Warkop otomatis berkurang saat transaksi dibuat (Fase 4),
menghapus (void) transaksi Warkop yang salah SENGAJA mengembalikan stok
tiap item (`incrementStokProduk_`, `Produk.js`) — kalau tidak, stok akan
diam-diam "hilang" untuk barang yang sebenarnya tidak jadi terjual.
Memulihkan transaksi memotong stok LAGI, tapi divalidasi all-or-nothing
DULU untuk semua item sebelum memotong satu pun — kalau salah satu menu
sudah kehabisan stok sejak dihapus (terjual ke transaksi lain), seluruh
restore ditolak dengan pesan jelas, bukan memotong sebagian item lalu
gagal di tengah jalan meninggalkan data setengah-konsisten.

### Testing Fase 8
Unit test murni: `buildTransaksiBarberEditPatch_`/
`buildTransaksiWarkopEditPatch_` (memverifikasi field finansial diam-diam
diabaikan meski dikirim), `core/export.js#toCsv`/`toExcelHtml` (escaping
koma/kutip/baris baru CSV, escaping HTML). Simulasi backend end-to-end:
Laporan Gabungan = Laporan Barber + Laporan Warkop, konsisten dengan
Dashboard untuk rentang sama, RBAC Kasir dilarang akses Laporan, export
tercatat Audit Log, Kasir dilarang edit/hapus transaksi, edit
mengoreksi nama/HP/capster TANPA mengubah GrandTotal/Items walau
dipaksa lewat payload, hapus tanpa alasan ditolak, transaksi terhapus
hilang dari listing biasa & Laporan tapi muncul dgn `includeDeleted`
(Owner/Admin saja, Kasir dipaksa `false`), hapus Warkop mengembalikan
stok tepat per item, restore memotong stok lagi, restore ditolak
all-or-nothing kalau stok tidak cukup. Verifikasi browser Playwright
penuh: Laporan menampilkan ringkasan & tabel yang benar per jenis usaha,
tombol Export CSV/Excel benar-benar memicu download file dgn ekstensi
yang sesuai, modal Edit Owner Panel mengubah data, Hapus lewat dialog
alasan + konfirmasi menyembunyikan baris, checkbox "Termasuk yang
dihapus" memunculkannya kembali dgn badge, Pulihkan mengembalikan baris
ke normal, hapus transaksi Warkop lewat UI benar-benar mengembalikan
stok, dan Kasir terbukti tidak melihat menu Laporan maupun tombol
Edit/Hapus/checkbox Owner Panel di Riwayat — nol error console.
