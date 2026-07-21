/**
 * laporan — Laporan Penjualan & Pengeluaran per jenis usaha, rentang tanggal
 * bebas (termasuk Custom Date), dengan export Cetak/PDF (print browser),
 * CSV, dan Excel (.xls berbasis HTML table — dibuka asli oleh
 * Excel/Sheets/LibreOffice tanpa perlu vendor library xlsx biner).
 */

import { apiCall } from '../../core/api.js';
import { escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateID } from '../../core/format.js';
import { getSettings } from '../../core/settings-cache.js';
import { exportCsv, exportExcel } from '../../core/export.js';
import { renderFilterBar, statTile, statSection } from '../dashboard/shared.js';

const JENIS_USAHA_OPTIONS = [
  { value: 'Gabungan', label: 'Gabungan' },
  { value: 'Barber', label: 'Barber' },
  { value: 'Warkop', label: 'Warkop' }
];

function metodeBadge(m) {
  if (m === 'QRIS') return '<span class="badge-neutral">QRIS</span>';
  if (m === 'Split') return '<span class="badge-neutral">Split</span>';
  return '<span class="badge-neutral">Cash</span>';
}

function transaksiColumns(jenisUsaha) {
  const cols = [{ key: 'NomorTransaksi', label: 'No. Transaksi' }];
  if (jenisUsaha === 'Gabungan') cols.push({ key: 'JenisUsaha', label: 'Jenis' });
  cols.push({ key: 'waktu', label: 'Waktu' }, { key: 'NamaPelanggan', label: 'Pelanggan' });
  if (jenisUsaha === 'Barber') cols.push({ key: 'NamaCapster', label: 'Capster' });
  cols.push({ key: 'GrandTotal', label: 'Total' }, { key: 'MetodeBayar', label: 'Metode' });
  return cols;
}

function transaksiRowValue(t, key) {
  if (key === 'waktu') return `${t.Tanggal} ${t.Jam}`;
  if (key === 'GrandTotal') return formatRupiah(t.GrandTotal);
  return t[key] || '-';
}

export async function renderLaporan(container) {
  const settings = await getSettings();

  container.innerHTML = `
    <div class="mx-auto max-w-5xl space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 class="text-xl font-bold">Laporan</h1>
        <div class="flex gap-2">
          <button id="btn-export-print" type="button" class="btn-outline">Cetak / Simpan PDF</button>
          <button id="btn-export-csv" type="button" class="btn-outline">Export CSV</button>
          <button id="btn-export-excel" type="button" class="btn-outline">Export Excel</button>
        </div>
      </div>

      <div class="glass-card flex flex-wrap items-end gap-3 p-4 print:hidden">
        <div>
          <label class="label-field" for="laporan-jenis-usaha">Jenis Usaha</label>
          <select id="laporan-jenis-usaha" class="input-field !w-auto">
            ${JENIS_USAHA_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="laporan-filter-bar" class="print:hidden"></div>

      <div id="laporan-print-area">
        <div class="mb-4 hidden print:block">
          <div class="text-lg font-bold">${escapeHtml(settings.businessName)}</div>
          <div id="laporan-print-period" class="text-sm text-slate-600"></div>
        </div>
        <div id="laporan-ringkasan"></div>
        <div class="glass-card mt-6 overflow-x-auto p-4">
          <h2 class="mb-3 px-2 font-semibold">Transaksi</h2>
          <div id="laporan-transaksi-wrap"></div>
        </div>
        <div class="glass-card mt-6 overflow-x-auto p-4">
          <h2 class="mb-3 px-2 font-semibold">Pengeluaran</h2>
          <div id="laporan-pengeluaran-wrap"></div>
        </div>
      </div>
    </div>
  `;

  const jenisUsahaSelect = container.querySelector('#laporan-jenis-usaha');
  const ringkasanEl = container.querySelector('#laporan-ringkasan');
  const transaksiWrap = container.querySelector('#laporan-transaksi-wrap');
  const pengeluaranWrap = container.querySelector('#laporan-pengeluaran-wrap');
  const printPeriodEl = container.querySelector('#laporan-print-period');

  let lastReport = null;

  function renderRingkasan(r) {
    ringkasanEl.innerHTML = statSection(`Ringkasan (${r.jenisUsaha})`, [
      statTile('Pendapatan', r.ringkasan.totalPendapatan, { tone: 'gabungan' }),
      statTile('Transaksi', r.ringkasan.totalTransaksi, { isRaw: true }),
      statTile('Cash', r.ringkasan.totalCash),
      statTile('QRIS', r.ringkasan.totalQris),
      statTile('Pengeluaran', r.ringkasan.totalPengeluaran, { tone: 'danger' }),
      statTile('Laba Bersih', r.ringkasan.labaBersih, { tone: 'gabungan' })
    ]);
  }

  function renderTransaksiTable(r) {
    const cols = transaksiColumns(r.jenisUsaha);
    if (r.transaksiList.length === 0) {
      transaksiWrap.innerHTML = '<p class="p-4 text-center text-sm text-slate-400">Tidak ada transaksi pada rentang ini.</p>';
      return;
    }
    transaksiWrap.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            ${cols.map((c) => `<th class="py-2 pr-3">${escapeHtml(c.label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${r.transaksiList
            .map(
              (t) => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60">
              ${cols
                .map((c) => {
                  const val = transaksiRowValue(t, c.key);
                  return c.key === 'MetodeBayar' ? `<td class="py-2 pr-3">${metodeBadge(t.MetodeBayar)}</td>` : `<td class="py-2 pr-3">${escapeHtml(val)}</td>`;
                })
                .join('')}
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderPengeluaranTable(r) {
    if (r.pengeluaranList.length === 0) {
      pengeluaranWrap.innerHTML = '<p class="p-4 text-center text-sm text-slate-400">Tidak ada pengeluaran pada rentang ini.</p>';
      return;
    }
    const showJenis = r.jenisUsaha === 'Gabungan';
    pengeluaranWrap.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            ${showJenis ? '<th class="py-2 pr-3">Jenis</th>' : ''}
            <th class="py-2 pr-3">Tanggal</th><th class="py-2 pr-3">Kategori</th>
            <th class="py-2 pr-3">Keterangan</th><th class="py-2 pr-3">Nominal</th><th class="py-2 pr-3">Input Oleh</th>
          </tr>
        </thead>
        <tbody>
          ${r.pengeluaranList
            .map(
              (p) => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60">
              ${showJenis ? `<td class="py-2 pr-3">${escapeHtml(p.JenisUsaha)}</td>` : ''}
              <td class="py-2 pr-3">${escapeHtml(p.Tanggal)}</td>
              <td class="py-2 pr-3">${escapeHtml(p.Kategori)}</td>
              <td class="py-2 pr-3">${escapeHtml(p.Keterangan)}</td>
              <td class="py-2 pr-3">${formatRupiah(p.Nominal)}</td>
              <td class="py-2 pr-3">${escapeHtml(p.InputOleh)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  async function loadAndRender(filterState) {
    let r;
    try {
      r = await apiCall('reports.view', { jenisUsaha: jenisUsahaSelect.value, ...filterState });
    } catch (err) {
      ringkasanEl.innerHTML = `<div class="glass-card p-6 text-red-600 dark:text-red-400">Gagal memuat laporan: ${escapeHtml(err.message)}</div>`;
      transaksiWrap.innerHTML = '';
      pengeluaranWrap.innerHTML = '';
      return;
    }
    lastReport = r;
    printPeriodEl.textContent = `Periode: ${formatDateID(r.range.start)} — ${formatDateID(r.range.end)}`;
    renderRingkasan(r);
    renderTransaksiTable(r);
    renderPengeluaranTable(r);
  }

  const getFilterState = renderFilterBar(container.querySelector('#laporan-filter-bar'), (state) => loadAndRender(state));
  container.querySelector('#laporan-filter-bar #dash-filter-type').value = 'month';
  jenisUsahaSelect.addEventListener('change', () => loadAndRender(getFilterState()));

  function logExport(format) {
    if (!lastReport) return;
    apiCall('reports.export', { format, jenisUsaha: lastReport.jenisUsaha, filterType: lastReport.filterType, range: lastReport.range }).catch(() => {
      // Pencatatan audit bersifat sekunder — kegagalannya tidak boleh membatalkan export yang sudah terjadi di browser.
    });
  }

  container.querySelector('#btn-export-print').addEventListener('click', () => {
    logExport('PDF/Cetak');
    window.print();
  });

  container.querySelector('#btn-export-csv').addEventListener('click', () => {
    if (!lastReport) return;
    const cols = transaksiColumns(lastReport.jenisUsaha);
    const headers = cols.map((c) => c.label);
    const rows = lastReport.transaksiList.map((t) => cols.map((c) => transaksiRowValue(t, c.key)));
    exportCsv(`laporan-${lastReport.jenisUsaha.toLowerCase()}-${lastReport.range.start}_${lastReport.range.end}.csv`, headers, rows);
    logExport('CSV');
  });

  container.querySelector('#btn-export-excel').addEventListener('click', () => {
    if (!lastReport) return;
    const cols = transaksiColumns(lastReport.jenisUsaha);
    const headers = cols.map((c) => c.label);
    const rows = lastReport.transaksiList.map((t) => cols.map((c) => transaksiRowValue(t, c.key)));
    exportExcel(
      `laporan-${lastReport.jenisUsaha.toLowerCase()}-${lastReport.range.start}_${lastReport.range.end}.xls`,
      `Laporan ${lastReport.jenisUsaha}`,
      headers,
      rows
    );
    logExport('Excel');
  });

  await loadAndRender(getFilterState());
}
