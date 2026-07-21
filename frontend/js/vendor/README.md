# Vendor

File pihak ketiga yang di-vendor (disalin ke repo) supaya PWA tetap bisa
dimuat offline tanpa bergantung pada CDN eksternal.

- `chart.umd.min.js` — [Chart.js](https://www.chartjs.org/) v4 (lisensi MIT).
  Disalin dari `node_modules/chart.js/dist/chart.umd.min.js` lewat
  `npm run vendor:chartjs`. Jalankan ulang script ini setelah meng-upgrade
  versi `chart.js` di `package.json`.
