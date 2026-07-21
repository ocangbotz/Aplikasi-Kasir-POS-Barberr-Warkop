/**
 * dashboard/gabungan — Dashboard Gabungan: kartu Hari Ini & Bulan Ini yang
 * SELALU tetap (lihat docs/ARCHITECTURE.md §12) + kartu Periode Terpilih
 * yang mengikuti filter + 3 grafik tren (harian/bulanan/tahunan, granularitas
 * tetap, tidak mengikuti filter).
 */

import { apiCall } from '../../core/api.js';
import { escapeHtml } from '../../core/ui.js';
import { renderFilterBar, statTile, statSection, renderLineChart } from './shared.js';

export async function renderDashboardGabungan(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-5xl">
      <h1 class="mb-4 text-xl font-bold">Dashboard Gabungan</h1>
      <div id="dash-filter-bar"></div>
      <div id="dash-fixed-cards"></div>
      <div id="dash-periode-cards"></div>
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="glass-card p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Pendapatan Harian (14 hari)</h3>
          <canvas id="chart-harian" height="220"></canvas>
        </div>
        <div class="glass-card p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Pendapatan Bulanan (tahun ini)</h3>
          <canvas id="chart-bulanan" height="220"></canvas>
        </div>
        <div class="glass-card p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Pendapatan Tahunan (5 tahun)</h3>
          <canvas id="chart-tahunan" height="220"></canvas>
        </div>
      </div>
    </div>
  `;

  const fixedCardsEl = container.querySelector('#dash-fixed-cards');
  const periodeCardsEl = container.querySelector('#dash-periode-cards');

  function renderFixedCards(data) {
    const hi = data.hariIni;
    const bi = data.bulanIni;
    fixedCardsEl.innerHTML =
      statSection('Hari Ini', [
        statTile('Pendapatan', hi.totalPendapatan, { tone: 'gabungan' }),
        statTile('Transaksi', hi.totalTransaksi, { isRaw: true }),
        statTile('Cash', hi.totalCash),
        statTile('QRIS', hi.totalQris),
        statTile('Pengeluaran', hi.totalPengeluaran, { tone: 'danger' }),
        statTile('Laba Bersih', hi.labaBersih, { tone: 'gabungan' })
      ]) +
      statSection('Bulan Ini', [
        statTile('Pendapatan', bi.totalPendapatan, { tone: 'gabungan' }),
        statTile('Transaksi', bi.totalTransaksi, { isRaw: true }),
        statTile('Pengeluaran', bi.totalPengeluaran, { tone: 'danger' }),
        statTile('Laba Bersih', bi.labaBersih, { tone: 'gabungan' })
      ]);
  }

  function renderPeriodeCards(data) {
    const p = data.periodeTerpilih;
    periodeCardsEl.innerHTML = statSection('Periode Terpilih', [
      statTile('Pendapatan', p.totalPendapatan, { tone: 'gabungan' }),
      statTile('Transaksi', p.totalTransaksi, { isRaw: true }),
      statTile('Cash', p.totalCash),
      statTile('QRIS', p.totalQris),
      statTile('Pengeluaran', p.totalPengeluaran, { tone: 'danger' }),
      statTile('Laba Bersih', p.labaBersih, { tone: 'gabungan' })
    ]);
  }

  async function loadAndRender(filterState) {
    let data;
    try {
      data = await apiCall('dashboard.view', { dashboard: 'gabungan', ...filterState });
    } catch (err) {
      fixedCardsEl.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat dashboard: ${escapeHtml(err.message)}</div>`;
      return;
    }
    renderFixedCards(data);
    renderPeriodeCards(data);
    await renderLineChart(container.querySelector('#chart-harian'), data.chartPendapatanHarian, { granularity: 'day', color: 'gabungan', label: 'Pendapatan' });
    await renderLineChart(container.querySelector('#chart-bulanan'), data.chartPendapatanBulanan, { granularity: 'month', color: 'gabungan', label: 'Pendapatan' });
    await renderLineChart(container.querySelector('#chart-tahunan'), data.chartPendapatanTahunan, { granularity: 'year', color: 'gabungan', label: 'Pendapatan' });
  }

  const getFilterState = renderFilterBar(container.querySelector('#dash-filter-bar'), loadAndRender);
  await loadAndRender(getFilterState());
}
