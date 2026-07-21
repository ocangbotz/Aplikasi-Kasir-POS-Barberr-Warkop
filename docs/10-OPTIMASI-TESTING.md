# Fase 10 — Optimasi Performa, Testing Menyeluruh, Deployment

Fase terakhir: audit performa nyata (bukan asumsi), regresi penuh seluruh
fase, dan konsolidasi panduan deploy produksi.

## 1. Optimasi: Code-Splitting (Lazy Loading Halaman)

`frontend/assets/js/app.js` sebelumnya meng-import STATIS ~30 modul halaman
sekaligus saat aplikasi boot -- setiap kunjungan mengunduh & mengeksekusi
seluruh kode Barber, Warkop, Inventory, Laporan, Owner Panel, dst, padahal
user biasanya hanya memakai segelintir halaman per sesi. Diganti dengan
`import()` dinamis per rute (`lazy()` helper di `app.js`):

```js
registerRoute('/laporan', { permission: 'laporan', title: 'Laporan',
  render: lazy(() => import('./pages/laporan/index.js'), 'renderLaporan') });
```

Router (`core/router.js`) sudah `await route.render(appRoot)` sejak Fase 7,
jadi `render` boleh berupa fungsi yang mengembalikan Promise -- tidak perlu
perubahan lain di router. Hanya `login.js` & `layout.js` (shell) yang tetap
di-import statis karena wajib ada untuk cat pertama. Service Worker (Fase 9)
tetap men-precache semua chunk ini, jadi setelah kunjungan pertama pun tetap
instan & offline-ready -- lazy loading murni mempercepat **kunjungan
pertama** (sebelum Service Worker terpasang).

## 2. Optimasi: Paginasi (Skala 100rb+ Transaksi)

Sebagian besar daftar (Riwayat Barber/Warkop, Kelola Transaksi Owner, Data
Pelanggan) sudah dipaginasi sejak fase masing-masing dibangun. Fase 10
melengkapi DUA yang tadinya belum:

- **Laporan** (`laporanTransaksi_`): tabel di layar kini dipaginasi
  (`page`/`pageSize`, default 20/halaman, maksimum 500/request) -- sebelumnya
  mengembalikan SELURUH baris periode sekaligus, yang untuk periode besar
  akan membuat DOM tabel berat & lambat di render. **Ringkasan (Pendapatan/
  Laba Bersih/dll) tetap dihitung dari SELURUH baris periode, bukan cuma
  halaman yang diminta** -- dijamin lewat test `laporanTransaksi_ memaginasi
  tabel tapi ringkasan tetap dihitung dari SELURUH baris periode`. Ekspor
  (PDF/Excel/CSV/Print) mengambil beberapa halaman berurutan (500/request,
  maksimum 20 halaman = 10.000 baris per klik ekspor) supaya tetap mencakup
  seluruh periode tanpa membuat satu request raksasa atau macet di browser;
  jika periode melebihi batas itu, user diberi tahu lewat toast untuk
  mempersempit filter.
- **Audit Log** (`auditLogList_`): sebelumnya `limit` tetap (200-300, tanpa
  navigasi), sekarang `page`/`pageSize` (default 50/halaman) dengan tombol
  Sebelumnya/Selanjutnya, konsisten dengan pola Riwayat.

### Bukti Nyata: Uji Skala 100.000 Transaksi

`backend/test/perf-scale.js` (`npm run test:perf`) men-seed 60.000 transaksi
Barber + 40.000 transaksi Warkop **langsung ke mock sheet** (bukan lewat
`barberCreateTransaksi_` satu-satu -- itu O(n²) karena tiap `appendRowObject_`
membaca ulang seluruh sheet, tidak masuk akal untuk seed 100rb baris), lalu
mengukur waktu operasi BACA yang sesungguhnya dipakai user:

```
dashboardData_(usaha=Gabungan, filter=year):                    ~570ms
laporanTransaksi_(usaha=Gabungan, filter=year, page=1, size=50): ~1.7s
barberListTransaksi_(1 tahun, page=1, pageSize=20):              ~285ms
```

Dan yang lebih penting dari kecepatan mentah: **paginasi benar-benar
membatasi payload**, dibuktikan lewat assertion, bukan diasumsikan --
`laporanTransaksi_` mengembalikan TEPAT 50 baris walau `.total` = 100.000.

> **Catatan jujur**: angka di atas mengukur kecepatan ALGORITMA (filter/
> sort/paginasi JS) berjalan di Node lokal terhadap mock sheet in-memory,
> BUKAN kecepatan sungguhan Google Sheets API di produksi -- pembacaan
> range besar dari Google Sheets punya latensi jaringan & infrastruktur
> Google sendiri yang tidak bisa disimulasikan di sini. Yang bisa
> dijamin dari test ini: kompleksitas logika tidak kuadratik terhadap
> jumlah baris, dan UI tidak pernah memuat lebih dari `pageSize` baris ke
> DOM sekaligus berapa pun besar datanya -- dua hal yang sepenuhnya ada
> dalam kendali kode ini.

## 3. Bug Ditemukan & Diperbaiki Selama Testing Menyeluruh

Testing Fase 10 (termasuk skenario race-condition yang sengaja dibuat untuk
menguji ketahanan navigasi) menemukan dua bug nyata:

### 3a. Toast error keliru saat pindah halaman sebelum data awal selesai dimuat

**Reproduksi**: pindah rute (mis. klik menu sidebar) SAAT halaman yang baru
saja dibuka (mis. Dashboard) masih menunggu `apiCall(...)` pertamanya
selesai. Root cause: banyak halaman memakai pola `async function load() {
await apiCall(...); root.querySelector('#id').innerHTML = ...; }` yang
dipanggil dari dalam `render(root)`. Router lama membersihkan `appRoot`
dengan `appRoot.innerHTML = ''` DI TEMPAT sebelum merender rute berikutnya
-- begitu `load()` milik rute LAMA akhirnya selesai (setelah rute baru
sudah dirender), `root.querySelector(...)`-nya memulangkan `null` (elemen
sudah tergantikan konten rute baru), lalu `.innerHTML = ...` pada `null`
melempar error yang tertangkap `catch` halaman itu sendiri dan tampil
sebagai toast keliru seperti *"Gagal memuat data dashboard"* -- padahal
user sudah pindah ke halaman lain dan tidak ada kaitannya.

**Fix** (`core/router.js`): setiap render sekarang mendapat **elemen
container baru** (`document.createElement('div')` + `appRoot.replaceChildren(container)`)
alih-alih membersihkan elemen yang sama di tempat. Render lama yang telat
selesai tetap memutasi subtree LAMA yang sudah terlepas dari DOM -- aman &
senyap, bukan meledak di halaman yang sekarang aktif. Tidak perlu mengubah
satu pun modul halaman.

### 3b. Race antara toast sukses & refresh tabel (fire-and-forget)

**Reproduksi**: di ~11 halaman (Kelola User, Closing Shift, Gaji Capster,
Menu Warkop, Layanan/Capster Barber, Kelola Transaksi Owner, Inventory,
Pelanggan, Pengeluaran), pola submit form-nya adalah:
```js
await apiCall('simpanSesuatu', payload);
toastSuccess('Berhasil disimpan.');
load();   // <- TIDAK di-await, "fire and forget"
```
Toast sukses muncul lebih dulu (sinkron), sementara `load()` (refresh
tabel) masih berjalan di belakang layar. Pada koneksi lambat/device
rendah -- justru target utama aplikasi ini -- user (atau automated test)
yang melihat toast lalu langsung mengecek tabel bisa menemukan data yang
BELUM ter-refresh. Ditemukan lewat kegagalan intermiten `test:e2e:owner-panel`
di bawah beban sistem tinggi.

**Fix**: `await load();` sebelum `toastSuccess(...)` (bukan sesudahnya) di
semua ~11 lokasi -- toast sukses sekarang benar-benar berarti "tampilan
sudah mencerminkan perubahan", bukan cuma "request sudah terkirim".

## 4. Regresi Penuh

```bash
npm run test:backend       # 97 unit test
npm run build:css && npm run build:sw
npm run test:e2e           # 17 -- shell, auth, tema
npm run test:e2e:barber    # 17
npm run test:e2e:warkop    # 14
npm run test:e2e:inventory # 12
npm run test:e2e:dashboard # 16
npm run test:e2e:owner-panel # 21 -- termasuk regresi fix 3b
npm run test:e2e:laporan   # 12
npm run test:e2e:pwa       # 12
npm run test:perf          # 7 assertion skala 100rb baris
```

**Total: 97 unit test + 121 skenario e2e Chromium + 7 assertion skala,
seluruhnya hijau**, dijalankan ulang berkali-kali (termasuk beberapa run
berturut-turut untuk suite yang sempat flaky) untuk memastikan bukan
kebetulan.

## 5. Checklist Deploy Produksi

1. **Backend**: ikuti `docs/01-SETUP-BACKEND.md` -- setup Google Sheets +
   Apps Script, jalankan `setupDatabase()`, deploy sebagai Web App, catat
   URL deployment.
2. **Frontend**:
   ```bash
   npm install
   # edit frontend/assets/js/core/config.js -> API_BASE_URL ke URL Web App di atas
   npm run build:css
   npm run build:sw      # WAJIB setelah build:css -- sw.js meng-hash konten app.css
   ```
   Upload folder `frontend/` (statis, tidak perlu Node.js di server) ke
   hosting pilihan (GitHub Pages, Netlify, Cloudflare Pages, Firebase
   Hosting, dsb).

   **GitHub Pages**: `.github/workflows/deploy-pages.yml` sudah disediakan --
   otomatis menjalankan `build:css` + `build:sw` lalu publish `frontend/`
   setiap push ke `main`. Aktifkan sekali di **Settings → Pages → Build and
   deployment → Source: GitHub Actions**. Semua path aset di `index.html`
   sudah relatif (`./assets/...`) sehingga aman dideploy di subpath repo
   (`https://<user>.github.io/<repo>/`), tidak perlu di root domain.
3. **HTTPS wajib**: Service Worker (install PWA, akses offline) hanya aktif
   di secure context (`https://` atau `localhost`). Semua hosting statis di
   atas menyediakan HTTPS otomatis secara default.
4. Login pertama kali dengan akun Owner yang dicetak `setupDatabase()`,
   segera ganti password lewat halaman Profil.
5. Uji instalasi PWA (tombol "Install App" di topbar / prompt browser) dan
   akses offline (matikan jaringan lalu reload) di perangkat sungguhan.

## Checklist Fase 10 (selesai & teruji)

- [x] Code-splitting: hanya shell (login+layout) di-import statis, ~30 halaman lain lazy-loaded
- [x] Paginasi Laporan (tabel di layar dibatasi, ringkasan tetap dari seluruh periode, ekspor multi-halaman dengan batas aman)
- [x] Paginasi Audit Log (page/pageSize + navigasi, konsisten dengan pola Riwayat)
- [x] Uji skala 100.000 transaksi nyata (bukan diklaim) dengan bukti payload tetap dibatasi pageSize
- [x] Bug race-condition navigasi (toast keliru) ditemukan & diperbaiki secara terpusat di router.js
- [x] Bug race-condition toast-vs-refresh ditemukan & diperbaiki di ~11 halaman
- [x] Regresi penuh 97 unit test + 121 e2e + 7 assertion skala, seluruhnya hijau
- [x] Checklist deploy produksi terkonsolidasi (backend + frontend + HTTPS + verifikasi PWA)
