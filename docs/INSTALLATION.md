# Instalasi & Menjalankan Frontend (Fase 2)

Panduan ini melanjutkan `docs/SPREADSHEET_SETUP.md` (backend sudah di-deploy
dan Web App URL sudah didapat). Di sini kita menjalankan frontend PWA-nya.

## 1. Persiapan lokal (opsional, hanya untuk development)

Frontend murni HTML/CSS/JS statis — **tidak butuh build step untuk
dijalankan** karena `frontend/css/app.css` (hasil build Tailwind) sudah
di-commit ke repo. Build step hanya diperlukan kalau Anda **mengubah**
`frontend/css/input.css` atau class Tailwind di file JS.

```bash
npm install          # sekali saja, untuk devDependencies (Tailwind, Playwright)
npm run build:css    # build ulang frontend/css/app.css setelah mengubah styling
npm run watch:css    # mode watch selama development
```

## 2. Menjalankan secara lokal

Karena frontend pakai ES Modules (`<script type="module">`), harus dibuka
lewat server HTTP, **bukan** langsung `file://`. Pilih salah satu:

```bash
# Opsi A — Python (biasanya sudah terpasang)
cd frontend && python3 -m http.server 8080

# Opsi B — Node
npx http-server frontend -p 8080
```

Buka `http://localhost:8080` di browser.

## 3. Menghubungkan ke backend

Saat pertama kali dibuka, aplikasi akan menampilkan layar **"Pengaturan
Koneksi"** karena belum tahu URL backend Apps Script Anda:

1. Tempel Web App URL hasil deploy (`docs/SPREADSHEET_SETUP.md` §5),
   formatnya `https://script.google.com/macros/s/xxxx/exec`.
2. Klik **Simpan & Uji Koneksi** — aplikasi akan memanggil health-check
   (`doGet` tanpa parameter) untuk memastikan URL benar & backend aktif.
3. Setelah "Terhubung!", otomatis diarahkan ke halaman **Login** — masuk
   dengan akun Owner yang dibuat saat `setupDatabase()` (lihat
   `docs/SPREADSHEET_SETUP.md` §4).

URL ini disimpan di `localStorage` browser (per perangkat/browser), bisa
diubah lagi kapan saja lewat tombol **"Ubah URL koneksi backend"** di
halaman Login.

## 4. Deploy ke hosting statis (produksi)

Frontend bisa di-hosting di layanan statis apa pun (GitHub Pages, Netlify,
Vercel, Firebase Hosting, dll) — cukup upload isi folder `frontend/` apa
adanya. Tidak perlu server-side rendering atau rewrite rule khusus karena
routing memakai hash (`#/...`).

**Wajib HTTPS** (kecuali `localhost`) supaya PWA (service worker, install
prompt) berfungsi — semua hosting di atas sudah HTTPS secara default.

## 5. Menjalankan test

```bash
npm test              # semua test (backend + frontend)
npm run test:backend  # logika murni backend Apps Script
npm run test:frontend # logika murni frontend (format, router, auth, cache)
```

## 6. Modul yang sudah bisa dipakai di Fase 2

Login lalu jelajahi menu sesuai role:

| Role | Menu yang terlihat |
|---|---|
| Owner | Beranda, Pengaturan, Manajemen User, Audit Log, Backup & Restore |
| Admin | Beranda, Pengaturan, Audit Log |
| Kasir | Beranda, Pengaturan |
| Capster | Beranda, Pengaturan |

Modul Dashboard, Barber, Warkop, Inventory, Laporan menyusul di Fase 3-9 —
lihat status terkini di `README.md`.
