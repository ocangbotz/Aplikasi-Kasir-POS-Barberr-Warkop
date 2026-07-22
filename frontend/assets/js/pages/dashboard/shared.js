/**
 * pages/dashboard/shared.js
 * Komponen & helper bersama untuk 3 dashboard (Gabungan/Barber/Warkop):
 * filter bar (Hari Ini/Kemarin/Minggu/Bulan/Tahun/Custom) dan kartu metrik.
 * Filter mengontrol "Periode Terpilih" + seluruh grafik/leaderboard, sementara
 * kartu Hari Ini & Bulan Ini selalu tetap -- lihat catatan desain di
 * backend/src/Dashboard.gs.
 */
import { formatRupiah, todayISODate } from '../../core/format.js';
import { getCurrentUser } from '../../core/auth.js';

const FILTERS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Custom' }
];

/**
 * Kasir hanya butuh lihat data "Hari Ini" (permintaan pemilik usaha, supaya
 * tampilan Dashboard/Laporan tidak membingungkan kasir) -- Owner tetap bisa
 * pilih periode apapun.
 */
function availableFilters() {
  const user = getCurrentUser();
  if (user && user.role !== 'Owner') return FILTERS.filter((f) => f.value === 'today');
  return FILTERS;
}

export function filterBarHtml() {
  return `
    <div class="glass-card flex flex-wrap items-end gap-2 p-3">
      <div id="filter-chips" class="flex flex-wrap gap-1.5"></div>
      <div id="custom-range" class="hidden flex flex-wrap items-end gap-2">
        <div>
          <label class="mb-1 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Dari</label>
          <input id="custom-start" type="date" class="input-field !py-1.5" />
        </div>
        <div>
          <label class="mb-1 block text-[10px] font-semibold text-slate-500 dark:text-slate-400">Sampai</label>
          <input id="custom-end" type="date" class="input-field !py-1.5" />
        </div>
        <button id="custom-apply" type="button" class="btn-ghost border border-slate-200 !py-1.5 text-xs dark:border-white/10">Terapkan</button>
      </div>
      <span id="periode-label" class="ml-auto text-xs text-slate-400"></span>
    </div>`;
}

/**
 * @param {HTMLElement} root
 * @param {(state: {filter: string, startDate?: string, endDate?: string}) => void} onChange
 * @param {string} accentClass - class Tailwind untuk chip aktif, mis. 'bg-barber-600 text-white'
 */
export function wireFilterBar(root, onChange, accentClass) {
  let state = { filter: 'today' };
  const chips = root.querySelector('#filter-chips');
  const customRange = root.querySelector('#custom-range');
  const customStart = root.querySelector('#custom-start');
  const customEnd = root.querySelector('#custom-end');

  customStart.value = todayISODate();
  customEnd.value = todayISODate();

  function renderChips() {
    chips.innerHTML = availableFilters().map((f) => `
      <button type="button" data-filter="${f.value}" class="filter-chip rounded-full border px-3 py-1 text-xs font-medium transition
        ${f.value === state.filter ? accentClass + ' border-transparent' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'}">
        ${f.label}
      </button>`).join('');
    chips.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        state = { filter: btn.dataset.filter };
        customRange.classList.toggle('hidden', btn.dataset.filter !== 'custom');
        renderChips();
        if (btn.dataset.filter !== 'custom') onChange(state);
      });
    });
  }
  renderChips();

  root.querySelector('#custom-apply').addEventListener('click', () => {
    if (customStart.value > customEnd.value) return;
    state = { filter: 'custom', startDate: customStart.value, endDate: customEnd.value };
    onChange(state);
  });

  return state;
}

export function setPeriodeLabel(root, periode) {
  const el = root.querySelector('#periode-label');
  if (el) el.textContent = periode.startDate === periode.endDate ? periode.startDate : `${periode.startDate} — ${periode.endDate}`;
}

export function statCard({ label, value, sub, accent }) {
  return `
    <div class="glass-card p-4">
      <p class="text-xs font-medium text-slate-500 dark:text-slate-400">${label}</p>
      <p class="mt-1 text-xl font-bold ${accent || 'text-slate-900 dark:text-white'}">${value}</p>
      ${sub ? `<p class="mt-0.5 text-[11px] text-slate-400">${sub}</p>` : ''}
    </div>`;
}

export function metricCardsHtml(metrics, extraCards) {
  const cards = [
    statCard({ label: 'Pendapatan', value: formatRupiah(metrics.pendapatan), accent: 'text-gabungan-600 dark:text-gabungan-400' }),
    statCard({ label: 'Transaksi', value: metrics.transaksi }),
    statCard({ label: 'Cash', value: formatRupiah(metrics.cash) }),
    statCard({ label: 'QRIS', value: formatRupiah(metrics.qris) }),
    statCard({ label: 'Pengeluaran', value: formatRupiah(metrics.pengeluaran), accent: 'text-red-500' }),
    statCard({ label: 'Laba Bersih', value: formatRupiah(metrics.labaBersih), accent: metrics.labaBersih >= 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-red-500' })
  ];
  if (extraCards) cards.push(...extraCards);
  return cards.join('');
}

export function leaderboardHtml(title, rows, renderRow, emptyText) {
  return `
    <div class="glass-card p-4">
      <h3 class="mb-2 text-sm font-bold text-slate-900 dark:text-white">${title}</h3>
      ${rows.length === 0
        ? `<p class="py-4 text-center text-xs text-slate-400">${emptyText || 'Belum ada data pada periode ini.'}</p>`
        : `<div class="space-y-1 text-sm">${rows.map(renderRow).join('')}</div>`}
    </div>`;
}

export function leaderboardRow(rank, name, value) {
  return `
    <div class="flex items-center justify-between rounded-lg px-2 py-1.5 ${rank === 0 ? 'bg-amber-50 dark:bg-amber-500/10' : ''}">
      <span class="flex items-center gap-2">
        <span class="w-5 text-center text-xs text-slate-400">${rank + 1}</span>
        <span class="font-medium text-slate-800 dark:text-slate-100">${name}</span>
      </span>
      <span class="font-semibold text-slate-600 dark:text-slate-300">${value}</span>
    </div>`;
}
