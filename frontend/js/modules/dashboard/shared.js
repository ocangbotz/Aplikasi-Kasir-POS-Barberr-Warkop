/**
 * dashboard/shared.js — komponen bersama ke-3 halaman Dashboard: filter
 * tanggal, kartu statistik, dan pembungkus Chart.js.
 */

import { escapeHtml } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';
import { formatDayLabel, formatMonthLabel, formatYearLabel } from '../../core/chart-labels.js';
import { loadChartJs } from '../../core/load-script.js';

export const FILTER_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Custom Date' }
];

/** Render filter bar ke dalam container, panggil onChange({filterType, customStart, customEnd}) tiap berubah. */
export function renderFilterBar(container, onChange) {
  container.innerHTML = `
    <div class="glass-card mb-6 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label class="label-field" for="dash-filter-type">Filter Periode</label>
        <select id="dash-filter-type" class="input-field !w-auto">
          ${FILTER_OPTIONS.map((f) => `<option value="${f.value}" ${f.value === 'today' ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
      </div>
      <div id="dash-custom-range" class="hidden flex-wrap items-end gap-3">
        <div>
          <label class="label-field" for="dash-custom-start">Dari</label>
          <input id="dash-custom-start" type="date" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="dash-custom-end">Sampai</label>
          <input id="dash-custom-end" type="date" class="input-field" />
        </div>
        <button id="dash-custom-apply" type="button" class="btn-outline">Terapkan</button>
      </div>
    </div>
  `;

  const select = container.querySelector('#dash-filter-type');
  const customRange = container.querySelector('#dash-custom-range');
  const customStart = container.querySelector('#dash-custom-start');
  const customEnd = container.querySelector('#dash-custom-end');

  function currentState() {
    return { filterType: select.value, customStart: customStart.value, customEnd: customEnd.value };
  }

  select.addEventListener('change', () => {
    if (select.value === 'custom') {
      customRange.classList.remove('hidden');
      customRange.classList.add('flex');
      if (customStart.value && customEnd.value) onChange(currentState());
    } else {
      customRange.classList.add('hidden');
      customRange.classList.remove('flex');
      onChange(currentState());
    }
  });

  container.querySelector('#dash-custom-apply').addEventListener('click', () => {
    if (!customStart.value || !customEnd.value) return;
    onChange(currentState());
  });

  return currentState;
}

function tileColorClass(tone) {
  return (
    {
      barber: 'text-barber-600 dark:text-barber-400',
      warkop: 'text-warkop-600 dark:text-warkop-400',
      gabungan: 'text-gabungan-600 dark:text-gabungan-400',
      danger: 'text-red-600 dark:text-red-400',
      neutral: 'text-slate-800 dark:text-slate-100'
    }[tone] || 'text-slate-800 dark:text-slate-100'
  );
}

/** 1 kartu statistik. value boleh angka (diformat Rupiah) atau string siap-pakai (pass isRaw:true). */
export function statTile(label, value, options) {
  const opts = options || {};
  const displayValue = opts.isRaw ? value : formatRupiah(value);
  return `
    <div class="stat-tile">
      <div class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">${escapeHtml(label)}</div>
      <div class="text-xl font-bold ${tileColorClass(opts.tone)}">${opts.isRaw ? displayValue : escapeHtml(displayValue)}</div>
    </div>
  `;
}

/** Bungkus beberapa statTile dalam 1 seksi berjudul. */
export function statSection(title, tilesHtml, color) {
  return `
    <div class="mb-6">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide ${tileColorClass(color)}">${escapeHtml(title)}</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">${tilesHtml.join('')}</div>
    </div>
  `;
}

const chartInstances = new WeakMap();

function renderChart(canvasEl, config) {
  const existing = chartInstances.get(canvasEl);
  if (existing) existing.destroy();
  // `Chart` adalah global dari frontend/js/vendor/chart.umd.min.js (loadChartJs()).
  const chart = new window.Chart(canvasEl, config);
  chartInstances.set(canvasEl, chart);
  return chart;
}

const CHART_COLORS = { barber: '#2563eb', warkop: '#ea580c', gabungan: '#16a34a', cash: '#16a34a', qris: '#2563eb' };

export async function renderLineChart(canvasEl, points, options) {
  await loadChartJs();
  const opts = options || {};
  const labelFn = opts.granularity === 'month' ? formatMonthLabel : opts.granularity === 'year' ? formatYearLabel : formatDayLabel;
  const color = CHART_COLORS[opts.color] || CHART_COLORS.gabungan;
  return renderChart(canvasEl, {
    type: 'line',
    data: {
      labels: points.map((p) => labelFn(p.periode)),
      datasets: [
        {
          label: opts.label || 'Pendapatan',
          data: points.map((p) => p.total),
          borderColor: color,
          backgroundColor: color + '33',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatRupiahShort(v) } } }
    }
  });
}

export async function renderBarChart(canvasEl, points, options) {
  await loadChartJs();
  const opts = options || {};
  const labelFn = opts.granularity === 'month' ? formatMonthLabel : opts.granularity === 'year' ? formatYearLabel : formatDayLabel;
  const color = CHART_COLORS[opts.color] || CHART_COLORS.gabungan;
  return renderChart(canvasEl, {
    type: 'bar',
    data: {
      labels: points.map((p) => labelFn(p.periode)),
      datasets: [{ label: opts.label || 'Jumlah', data: points.map((p) => p.total), backgroundColor: color }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

export async function renderDoughnutChart(canvasEl, breakdown, options) {
  await loadChartJs();
  const opts = options || {};
  return renderChart(canvasEl, {
    type: 'doughnut',
    data: {
      labels: ['Cash', 'QRIS'],
      datasets: [{ data: [breakdown.cash, breakdown.qris], backgroundColor: [CHART_COLORS.cash, CHART_COLORS.qris] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function formatRupiahShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'jt';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'rb';
  return String(n);
}
