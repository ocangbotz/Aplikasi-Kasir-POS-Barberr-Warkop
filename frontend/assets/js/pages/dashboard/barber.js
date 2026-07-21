/**
 * pages/dashboard/barber.js
 * Dashboard khusus usaha Barber.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError } from '../../core/toast.js';
import { renderLineChart, renderBarChart, renderDoughnutChart, CHART_COLORS } from '../../core/charts.js';
import { formatRupiah } from '../../core/format.js';
import { filterBarHtml, wireFilterBar, setPeriodeLabel, metricCardsHtml, statCard, leaderboardHtml, leaderboardRow } from './shared.js';

export async function renderDashboardBarber(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-lg font-bold text-slate-900 dark:text-white">🟦 Dashboard Barber</h1>

      ${filterBarHtml()}

      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Hari Ini</h2>
        <div id="cards-hari-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"></div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Bulan Ini</h2>
        <div id="cards-bulan-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"></div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Periode Terpilih</h2>
        <div id="cards-periode" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7"></div>
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
          <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">Jumlah Kepala</h3>
          <div class="h-56"><canvas id="chart-kepala"></canvas></div>
        </div>
        <div id="leaderboard-capster"></div>
        <div id="leaderboard-layanan" class="lg:col-span-3"></div>
      </div>
    </div>
  `;

  const cleanups = [];
  function clearCharts() { cleanups.forEach((fn) => fn()); cleanups.length = 0; }

  function extraCards(metrics) {
    return [statCard({ label: 'Total Kepala', value: metrics.totalKepala })];
  }

  async function load(state) {
    try {
      const data = await apiCall('dashboardData', { usaha: 'Barber', ...state });
      root.querySelector('#cards-hari-ini').innerHTML = metricCardsHtml(data.hariIni, extraCards(data.hariIni));
      root.querySelector('#cards-bulan-ini').innerHTML = metricCardsHtml(data.bulanIni, extraCards(data.bulanIni));
      root.querySelector('#cards-periode').innerHTML = metricCardsHtml(data.periodeMetrics, extraCards(data.periodeMetrics));
      setPeriodeLabel(root, data.periode);

      clearCharts();
      cleanups.push(renderLineChart(root.querySelector('#chart-pendapatan'), {
        labels: data.chartPendapatan.labels,
        datasets: [{ label: 'Pendapatan', data: data.chartPendapatan.values, color: CHART_COLORS.barber }]
      }));
      cleanups.push(renderBarChart(root.querySelector('#chart-kepala'), {
        labels: data.chartKepala.labels, data: data.chartKepala.values, color: CHART_COLORS.barber, label: 'Kepala'
      }));
      cleanups.push(renderDoughnutChart(root.querySelector('#chart-metode'), {
        labels: ['Cash', 'QRIS'],
        data: [data.metodePembayaran.cash, data.metodePembayaran.qris],
        colors: [CHART_COLORS.cash, CHART_COLORS.qris]
      }));

      root.querySelector('#leaderboard-capster').innerHTML = leaderboardHtml(
        '💈 Capster Terlaris', data.capsterTerlaris,
        (c, i) => leaderboardRow(i, c.nama, formatRupiah(c.pendapatan))
      );
      root.querySelector('#leaderboard-layanan').innerHTML = leaderboardHtml(
        '✂️ Layanan Terlaris', data.layananTerlaris,
        (l, i) => leaderboardRow(i, l.nama, l.jumlah + 'x')
      );
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data dashboard.');
    }
  }

  const initialState = wireFilterBar(root, load, 'bg-barber-600 text-white');
  await load(initialState);

  return clearCharts;
}
