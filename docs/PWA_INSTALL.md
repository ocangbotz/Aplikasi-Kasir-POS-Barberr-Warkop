# Install sebagai Aplikasi (PWA)

Setelah frontend di-hosting di HTTPS (lihat `docs/INSTALLATION.md` §4), aplikasi
bisa di-install seperti aplikasi native di Android, iOS, dan Desktop.

## Android (Chrome)

1. Buka URL aplikasi di Chrome.
2. Ketuk menu (⋮) di kanan atas → **"Install app"** / **"Tambahkan ke Layar
   Utama"**. Chrome juga bisa menampilkan banner install otomatis setelah
   beberapa kali kunjungan.
3. Ikon aplikasi akan muncul di home screen, terbuka dalam mode `standalone`
   (tanpa address bar browser).

## Desktop (Chrome / Edge)

1. Buka URL aplikasi.
2. Klik ikon **install** (⊕ / monitor kecil) di ujung kanan address bar.
3. Atau: menu (⋮) → **"Install POS Barber & Warkop..."**.
4. Aplikasi akan tersedia sebagai jendela terpisah & muncul di daftar
   aplikasi OS (Start Menu/Launcher).

## iPhone/iPad (Safari)

Safari belum mendukung install-prompt otomatis seperti Chrome, jadi manual:

1. Buka URL aplikasi di Safari.
2. Ketuk tombol **Share** (kotak dengan panah ke atas).
3. Pilih **"Add to Home Screen"**.
4. Ikon aplikasi (`apple-touch-icon.png`) akan muncul di home screen.

## Mode Offline

Setelah pertama kali dibuka online, `service-worker.js` meng-cache seluruh
file shell aplikasi (HTML/CSS/JS/ikon). Membuka aplikasi kembali tanpa
koneksi internet akan tetap menampilkan antarmuka (login, dsb) — namun
memerlukan koneksi ke backend Apps Script untuk operasi data apa pun (login,
lihat/ubah data). Antrean offline untuk aksi transaksi (dikirim otomatis saat
online kembali) mulai dipakai di Fase 4/5 saat modul transaksi Barber/Warkop
dibangun.

## Update Aplikasi

Karena service worker meng-cache file shell, setelah Anda men-deploy versi
frontend yang baru, pengguna mungkin masih melihat versi lama sampai service
worker memperbarui cache di background (biasanya di kunjungan berikutnya).
Untuk memaksa update lebih cepat: naikkan `CACHE_VERSION` di
`frontend/service-worker.js` setiap kali melakukan perubahan besar pada file
shell (index.html/css/js inti) sebelum deploy ulang.
