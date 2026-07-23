/**
 * pages/dashboard/warkop.js
 * Dashboard khusus usaha Warkop.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError } from '../../core/toast.js';
import { renderLineChart, renderBarChart, renderDoughnutChart, CHART_COLORS } from '../../core/charts.js';
import { formatRupiah } from '../../core/format.js';
import { filterBarHtml, wireFilterBar, setPeriodeLabel, metricCardsHtml, leaderboardHtml, leaderboardRow, isOwnerRole } from './shared.js';

export async function renderDashboardWarkop(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-lg font-bold text-slate-900 dark:text-white">🟧 Dashboard Warkop</h1>

      ${filterBarHtml()}

      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Hari Ini</h2>
        <div id="cards-hari-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>
      ${isOwnerRole() ? `
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Bulan Ini</h2>
        <div id="cards-bulan-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>` : ''}
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Periode Terpilih</h2>
        <div id="cards-periode" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div class="glass-card p-4 lg:col-span-2">
          <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">Pendapatan</h3>
          <div class="h-56"><canvas id="chart-pendapatan"></canvas></div>
        </div>
        <div class="glass-card p-4">
          <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">Metode Pembayaran</h3>
          <div class="h-56"><canvas id="chart-metode"></canvas></div>
        </div>
        <div class="glass-card p-4 lg:col-span-2">
          <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">Produk Terjual</h3>
          <div class="h-56"><canvas id="chart-produk"></canvas></div>
        </div>
        <div id="leaderboard-menu"></div>
        <div id="leaderboard-kategori" class="lg:col-span-3"></div>
      </div>
    </div>
  `;

  const cleanups = [];
  function clearCharts() { cleanups.forEach((fn) => fn()); cleanups.length = 0; }

  async function load(state) {
    try {
      const data = await apiCall('dashboardData', { usaha: 'Warkop', ...state });
      root.querySelector('#cards-hari-ini').innerHTML = metricCardsHtml(data.hariIni);
      const bulanIniEl = root.querySelector('#cards-bulan-ini');
      if (bulanIniEl) bulanIniEl.innerHTML = metricCardsHtml(data.bulanIni);
      root.querySelector('#cards-periode').innerHTML = metricCardsHtml(data.periodeMetrics);
      setPeriodeLabel(root, data.periode);

      clearCharts();
      cleanups.push(renderLineChart(root.querySelector('#chart-pendapatan'), {
        labels: data.chartPendapatan.labels,
        datasets: [{ label: 'Pendapatan', data: data.chartPendapatan.values, color: CHART_COLORS.warkop }]
      }));
      cleanups.push(renderBarChart(root.querySelector('#chart-produk'), {
        labels: data.chartProdukTerjual.labels, data: data.chartProdukTerjual.values, color: CHART_COLORS.warkop, label: 'Unit Terjual'
      }));
      cleanups.push(renderDoughnutChart(root.querySelector('#chart-metode'), {
        labels: ['Cash', 'QRIS'],
        data: [data.metodePembayaran.cash, data.metodePembayaran.qris],
        colors: [CHART_COLORS.cash, CHART_COLORS.qris]
      }));

      root.querySelector('#leaderboard-menu').innerHTML = leaderboardHtml(
        '☕ Menu Terlaris', data.menuTerlaris,
        (m, i) => leaderboardRow(i, m.nama, m.qty + 'x')
      );
      root.querySelector('#leaderboard-kategori').innerHTML = leaderboardHtml(
        '📋 Kategori Terlaris', data.kategoriTerlaris,
        (k, i) => leaderboardRow(i, k.kategori, formatRupiah(k.pendapatan))
      );
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data dashboard.');
    }
  }

  const initialState = wireFilterBar(root, load, 'bg-warkop-600 text-white');
  await load(initialState);

  return clearCharts;
}
