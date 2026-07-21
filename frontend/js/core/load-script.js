/**
 * load-script.js — lazy-load script non-module (UMD) sekali saja, dipakai
 * untuk memuat Chart.js hanya saat halaman Dashboard benar-benar dibuka
 * (bukan di semua halaman) supaya beban awal aplikasi tetap ringan.
 */

const loadedUrls = new Set();

export function loadScriptOnce(src) {
  if (loadedUrls.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      loadedUrls.add(src);
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      loadedUrls.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadChartJs() {
  return loadScriptOnce('./js/vendor/chart.umd.min.js');
}
