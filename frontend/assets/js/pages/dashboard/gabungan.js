/**
 * pages/dashboard/gabungan.js
 * Dashboard Gabungan: Barber + Warkop dalam satu pandangan.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError } from '../../core/toast.js';
import { renderLineChart } from '../../core/charts.js';
import { CHART_COLORS } from '../../core/charts.js';
import { filterBarHtml, wireFilterBar, setPeriodeLabel, metricCardsHtml } from './shared.js';

export async function renderDashboardGabungan(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">🟩 Dashboard Gabungan</h1>
      </div>

      ${filterBarHtml()}

      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Hari Ini</h2>
        <div id="cards-hari-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Bulan Ini</h2>
        <div id="cards-bulan-ini" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>
      <div>
        <h2 class="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Periode Terpilih</h2>
        <div id="cards-periode" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>
      </div>

      <div class="glass-card p-4">
        <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">Pendapatan: Barber vs Warkop</h3>
        <div class="h-64"><canvas id="chart-pendapatan"></canvas></div>
      </div>
    </div>
  `;

  let chartCleanup = null;

  async function load(state) {
    try {
      const data = await apiCall('dashboardData', { usaha: 'Gabungan', ...state });
      root.querySelector('#cards-hari-ini').innerHTML = metricCardsHtml(data.hariIni);
      root.querySelector('#cards-bulan-ini').innerHTML = metricCardsHtml(data.bulanIni);
      root.querySelector('#cards-periode').innerHTML = metricCardsHtml(data.periodeMetrics);
      setPeriodeLabel(root, data.periode);

      if (chartCleanup) chartCleanup();
      chartCleanup = renderLineChart(root.querySelector('#chart-pendapatan'), {
        labels: data.chartPendapatanBarber.labels,
        datasets: [
          { label: 'Barber', data: data.chartPendapatanBarber.values, color: CHART_COLORS.barber },
          { label: 'Warkop', data: data.chartPendapatanWarkop.values, color: CHART_COLORS.warkop }
        ]
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data dashboard.');
    }
  }

  const initialState = wireFilterBar(root, load, 'bg-gabungan-600 text-white');
  await load(initialState);

  return () => { if (chartCleanup) chartCleanup(); };
}
