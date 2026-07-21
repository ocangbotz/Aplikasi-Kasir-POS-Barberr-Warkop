/**
 * dashboard/barber — Dashboard Barber: kartu Hari Ini/Bulan Ini tetap +
 * Periode Terpilih (filter) + Capster/Layanan Terlaris + grafik Pendapatan,
 * Jumlah Kepala, Metode Pembayaran (semua mengikuti filter).
 */

import { apiCall } from '../../core/api.js';
import { escapeHtml } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';
import { renderFilterBar, statTile, statSection, renderLineChart, renderBarChart, renderDoughnutChart } from './shared.js';

function terlarisCard(title, item, qtyLabel) {
  if (!item) {
    return `<div class="glass-card p-4"><div class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(title)}</div><div class="mt-2 text-sm text-slate-400">Belum ada data bulan ini.</div></div>`;
  }
  return `
    <div class="glass-card p-4">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(title)}</div>
      <div class="mt-1 text-lg font-bold text-barber-600 dark:text-barber-400">${escapeHtml(item.nama)}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">${item.totalKepala !== undefined ? item.totalKepala + ' kepala' : item.totalQty + ' ' + qtyLabel} · ${formatRupiah(item.totalPendapatan)}</div>
    </div>
  `;
}

export async function renderDashboardBarber(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-5xl">
      <h1 class="mb-4 text-xl font-bold">Dashboard Barber</h1>
      <div id="dash-filter-bar"></div>
      <div id="dash-fixed-cards"></div>
      <div id="dash-periode-cards"></div>
      <div class="mb-6 grid gap-4 sm:grid-cols-2" id="dash-terlaris"></div>
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="glass-card p-4 lg:col-span-2">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Pendapatan (periode terpilih)</h3>
          <canvas id="chart-pendapatan" height="200"></canvas>
        </div>
        <div class="glass-card p-4">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Metode Pembayaran</h3>
          <canvas id="chart-metode" height="200"></canvas>
        </div>
        <div class="glass-card p-4 lg:col-span-3">
          <h3 class="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">Jumlah Kepala per Hari</h3>
          <canvas id="chart-kepala" height="160"></canvas>
        </div>
      </div>
    </div>
  `;

  const fixedCardsEl = container.querySelector('#dash-fixed-cards');
  const periodeCardsEl = container.querySelector('#dash-periode-cards');
  const terlarisEl = container.querySelector('#dash-terlaris');

  function renderFixedCards(data) {
    const hi = data.hariIni;
    const bi = data.bulanIni;
    fixedCardsEl.innerHTML =
      statSection('Hari Ini', [
        statTile('Pendapatan', hi.totalPendapatan, { tone: 'barber' }),
        statTile('Transaksi', hi.totalTransaksi, { isRaw: true }),
        statTile('Cash', hi.totalCash),
        statTile('QRIS', hi.totalQris),
        statTile('Pengeluaran', hi.totalPengeluaran, { tone: 'danger' }),
        statTile('Laba Bersih', hi.labaBersih, { tone: 'barber' }),
        statTile('Total Kepala', hi.totalKepala, { isRaw: true })
      ], 'barber') +
      statSection('Bulan Ini', [
        statTile('Pendapatan', bi.totalPendapatan, { tone: 'barber' }),
        statTile('Transaksi', bi.totalTransaksi, { isRaw: true }),
        statTile('Cash', bi.totalCash),
        statTile('QRIS', bi.totalQris),
        statTile('Pengeluaran', bi.totalPengeluaran, { tone: 'danger' }),
        statTile('Laba Bersih', bi.labaBersih, { tone: 'barber' }),
        statTile('Total Kepala', bi.totalKepala, { isRaw: true })
      ], 'barber');
  }

  function renderPeriodeCards(data) {
    const p = data.periodeTerpilih;
    periodeCardsEl.innerHTML = statSection('Periode Terpilih', [
      statTile('Pendapatan', p.totalPendapatan, { tone: 'barber' }),
      statTile('Transaksi', p.totalTransaksi, { isRaw: true }),
      statTile('Cash', p.totalCash),
      statTile('QRIS', p.totalQris),
      statTile('Pengeluaran', p.totalPengeluaran, { tone: 'danger' }),
      statTile('Laba Bersih', p.labaBersih, { tone: 'barber' })
    ], 'barber');
  }

  async function loadAndRender(filterState) {
    let data;
    try {
      data = await apiCall('dashboard.view', { dashboard: 'barber', ...filterState });
    } catch (err) {
      fixedCardsEl.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat dashboard: ${escapeHtml(err.message)}</div>`;
      return;
    }
    renderFixedCards(data);
    renderPeriodeCards(data);
    terlarisEl.innerHTML = terlarisCard('Capster Terlaris (bulan ini)', data.capsterTerlaris[0], 'kepala') + terlarisCard('Layanan Terlaris (bulan ini)', data.layananTerlaris[0], 'kali');

    await renderLineChart(container.querySelector('#chart-pendapatan'), data.chartPendapatan, { granularity: 'day', color: 'barber', label: 'Pendapatan' });
    await renderBarChart(container.querySelector('#chart-kepala'), data.chartJumlahKepala, { granularity: 'day', color: 'barber', label: 'Kepala' });
    await renderDoughnutChart(container.querySelector('#chart-metode'), data.chartMetodePembayaran);
  }

  const getFilterState = renderFilterBar(container.querySelector('#dash-filter-bar'), loadAndRender);
  await loadAndRender(getFilterState());
}
