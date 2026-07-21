/**
 * charts.js
 * Wrapper tipis di atas Chart.js (di-vendor secara lokal di assets/js/vendor/
 * -- lihat index.html -- supaya berfungsi offline sebagai PWA, tidak
 * bergantung pada CDN). Menstandarkan warna brand & styling dark/light mode.
 */
import { themeStore } from './theme.js';

export const CHART_COLORS = {
  barber: '#3b82f6',
  warkop: '#f97316',
  gabungan: '#10b981',
  cash: '#10b981',
  qris: '#6366f1',
  palette: ['#3b82f6', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#ef4444']
};

function isDarkMode() {
  return document.documentElement.classList.contains('dark');
}

function axisColor() {
  return isDarkMode() ? '#94a3b8' : '#64748b';
}

function gridColor() {
  return isDarkMode() ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,43,0.06)';
}

function baseOptions(extra) {
  return Object.assign({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: axisColor(), boxWidth: 12, padding: 12 } },
      tooltip: { titleColor: '#fff', bodyColor: '#fff' }
    },
    scales: {
      x: { ticks: { color: axisColor() }, grid: { color: gridColor() } },
      y: { ticks: { color: axisColor() }, grid: { color: gridColor() }, beginAtZero: true }
    }
  }, extra);
}

/**
 * Membuat chart & otomatis mendaftar ulang saat tema berganti (grid/teks
 * chart tidak reaktif terhadap CSS, jadi harus di-render ulang manual).
 * @return {Function} cleanup -- panggil saat halaman di-unmount.
 */
function mountReactiveChart(canvas, buildConfig) {
  let chart = new Chart(canvas, buildConfig());
  const unsubscribe = themeStore.subscribe(() => {
    chart.destroy();
    chart = new Chart(canvas, buildConfig());
  });
  return () => { unsubscribe(); chart.destroy(); };
}

export function renderLineChart(canvas, { labels, datasets }) {
  return mountReactiveChart(canvas, () => ({
    type: 'line',
    data: {
      labels,
      datasets: datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: ds.color + '22',
        fill: true,
        tension: 0.3,
        pointRadius: 2
      }))
    },
    options: baseOptions({ scales: { x: { ticks: { color: axisColor() }, grid: { display: false } }, y: { ticks: { color: axisColor() }, grid: { color: gridColor() }, beginAtZero: true } } })
  }));
}

export function renderBarChart(canvas, { labels, data, color, label }) {
  return mountReactiveChart(canvas, () => ({
    type: 'bar',
    data: { labels, datasets: [{ label: label || '', data, backgroundColor: color, borderRadius: 6, maxBarThickness: 36 }] },
    options: baseOptions({ plugins: { legend: { display: false } } })
  }));
}

export function renderDoughnutChart(canvas, { labels, data, colors }) {
  return mountReactiveChart(canvas, () => ({
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { color: axisColor(), boxWidth: 12, padding: 12 } } }
    }
  }));
}
