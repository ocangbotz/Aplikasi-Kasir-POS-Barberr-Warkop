/**
 * pages/laporan/index.js
 * Laporan: tabel transaksi siap ekspor (PDF/Excel/CSV/Print) dengan filter
 * periode & usaha yang sama dengan Dashboard (lihat backend/src/Laporan.gs
 * dan pages/dashboard/shared.js) supaya angka ringkasan selalu konsisten.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastInfo } from '../../core/toast.js';
import { formatRupiah, formatDateID } from '../../core/format.js';
import { exportCSV, exportExcel, exportPDF, printReport } from '../../core/export.js';
import { filterBarHtml, wireFilterBar, setPeriodeLabel, metricCardsHtml } from '../dashboard/shared.js';

const USAHA_TABS = [
  { value: 'Gabungan', label: '🟩 Gabungan', accent: 'bg-gabungan-600 text-white' },
  { value: 'Barber', label: '🟦 Barber', accent: 'bg-barber-600 text-white' },
  { value: 'Warkop', label: '🟧 Warkop', accent: 'bg-warkop-600 text-white' }
];

const TABLE_HEADERS = ['Tanggal', 'Jam', 'Usaha', 'No. Transaksi', 'Deskripsi', 'Kasir', 'Subtotal', 'Diskon', 'Total', 'Metode', 'Status'];
const PAGE_SIZE = 20;
// Ekspor mengambil beberapa halaman berurutan (bukan satu request tak terbatas)
// supaya payload per-request tetap wajar; EXPORT_MAX_PAGES membatasi total baris
// yang diekspor sekali klik (20 x 500 = 10.000 baris) supaya PDF/print di browser
// tidak macet untuk periode yang sangat besar -- user diberi tahu & diarahkan
// mempersempit filter periode jika datanya terpotong.
const EXPORT_PAGE_SIZE = 500;
const EXPORT_MAX_PAGES = 20;

function toExportRows(transaksi) {
  return transaksi.map((t) => [
    formatDateID(t.tanggal), t.jam, t.usaha, t.nomorTransaksi, t.deskripsi, t.namaKasir,
    formatRupiah(t.subtotal), formatRupiah(t.diskon), formatRupiah(t.grandTotal), t.metodePembayaran, t.status
  ]);
}

function tableRowHtml(t) {
  return `
    <tr class="border-b border-slate-100 last:border-0 dark:border-white/5">
      <td class="px-2 py-1.5 whitespace-nowrap">${formatDateID(t.tanggal)}<br /><span class="text-[10px] text-slate-400">${t.jam}</span></td>
      <td class="px-2 py-1.5"><span class="rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.usaha === 'Barber' ? 'bg-barber-100 text-barber-700 dark:bg-barber-500/10 dark:text-barber-300' : 'bg-warkop-100 text-warkop-700 dark:bg-warkop-500/10 dark:text-warkop-300'}">${t.usaha}</span></td>
      <td class="px-2 py-1.5 font-mono text-[11px] whitespace-nowrap">${t.nomorTransaksi}</td>
      <td class="px-2 py-1.5 max-w-xs truncate" title="${t.deskripsi}">${t.deskripsi}</td>
      <td class="px-2 py-1.5 whitespace-nowrap">${t.namaKasir}</td>
      <td class="px-2 py-1.5 text-right whitespace-nowrap">${formatRupiah(t.grandTotal)}</td>
      <td class="px-2 py-1.5 whitespace-nowrap">${t.metodePembayaran}</td>
    </tr>`;
}

export async function renderLaporan(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">📊 Laporan</h1>
      </div>

      <div class="glass-card flex flex-wrap gap-1.5 p-3">
        ${USAHA_TABS.map((u) => `
          <button type="button" data-usaha="${u.value}" class="usaha-tab rounded-full border px-3 py-1.5 text-xs font-semibold transition
            ${u.value === 'Gabungan' ? u.accent + ' border-transparent' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'}">
            ${u.label}
          </button>`).join('')}
      </div>

      ${filterBarHtml()}

      <div id="cards-periode" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"></div>

      <div class="glass-card flex flex-wrap items-center gap-2 p-3">
        <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Ekspor:</span>
        <button type="button" id="export-pdf" class="btn-ghost border border-slate-200 !py-1.5 text-xs dark:border-white/10">📄 PDF</button>
        <button type="button" id="export-excel" class="btn-ghost border border-slate-200 !py-1.5 text-xs dark:border-white/10">📊 Excel</button>
        <button type="button" id="export-csv" class="btn-ghost border border-slate-200 !py-1.5 text-xs dark:border-white/10">🧾 CSV</button>
        <button type="button" id="export-print" class="btn-ghost border border-slate-200 !py-1.5 text-xs dark:border-white/10">🖨️ Cetak</button>
        <span id="row-count" class="ml-auto text-xs text-slate-400"></span>
      </div>

      <div class="glass-card overflow-x-auto p-0">
        <table class="w-full text-xs">
          <thead class="border-b border-slate-200 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:border-white/10">
            <tr>
              <th class="px-2 py-2">Tanggal</th>
              <th class="px-2 py-2">Usaha</th>
              <th class="px-2 py-2">No. Transaksi</th>
              <th class="px-2 py-2">Deskripsi</th>
              <th class="px-2 py-2">Kasir</th>
              <th class="px-2 py-2 text-right">Total</th>
              <th class="px-2 py-2">Metode</th>
            </tr>
          </thead>
          <tbody id="laporan-rows"></tbody>
        </table>
        <p id="empty-state" class="hidden py-8 text-center text-xs text-slate-400">Tidak ada transaksi pada periode ini.</p>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span id="page-summary" class="text-slate-500 dark:text-slate-400"></span>
        <div class="flex gap-2">
          <button id="prev-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">‹ Sebelumnya</button>
          <button id="next-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">Selanjutnya ›</button>
        </div>
      </div>
    </div>
  `;

  let usaha = 'Gabungan';
  let page = 1;
  let lastData = null;

  function renderUsahaTabs() {
    root.querySelectorAll('.usaha-tab').forEach((btn) => {
      const tab = USAHA_TABS.find((u) => u.value === btn.dataset.usaha);
      const active = btn.dataset.usaha === usaha;
      btn.className = `usaha-tab rounded-full border px-3 py-1.5 text-xs font-semibold transition
        ${active ? tab.accent + ' border-transparent' : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300'}`;
    });
  }

  async function load(state) {
    try {
      const data = await apiCall('laporanTransaksi', { usaha, page, pageSize: PAGE_SIZE, ...state });
      lastData = data;
      root.querySelector('#cards-periode').innerHTML = metricCardsHtml(data.ringkasan);
      setPeriodeLabel(root, data.periode);

      const tbody = root.querySelector('#laporan-rows');
      tbody.innerHTML = data.transaksi.map(tableRowHtml).join('');
      root.querySelector('#empty-state').classList.toggle('hidden', data.transaksi.length > 0);
      root.querySelector('#row-count').textContent = `${data.total} transaksi`;

      const totalPages = Math.max(Math.ceil(data.total / PAGE_SIZE), 1);
      root.querySelector('#page-summary').textContent = `Halaman ${data.page}/${totalPages}`;
      root.querySelector('#prev-page').disabled = data.page <= 1;
      root.querySelector('#next-page').disabled = data.page >= totalPages;
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat laporan.');
    }
  }

  root.querySelectorAll('.usaha-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      usaha = btn.dataset.usaha;
      page = 1;
      renderUsahaTabs();
      load(filterState);
    });
  });

  root.querySelector('#prev-page').addEventListener('click', () => { if (page > 1) { page--; load(filterState); } });
  root.querySelector('#next-page').addEventListener('click', () => { page++; load(filterState); });

  function summaryLines(data) {
    const periodeText = data.periode.startDate === data.periode.endDate ? data.periode.startDate : `${data.periode.startDate} s/d ${data.periode.endDate}`;
    return [
      `Usaha: ${data.usaha} | Periode: ${periodeText}`,
      `Pendapatan: ${formatRupiah(data.ringkasan.pendapatan)}  |  Pengeluaran: ${formatRupiah(data.ringkasan.pengeluaran)}  |  Laba Bersih: ${formatRupiah(data.ringkasan.labaBersih)}`
    ];
  }

  /**
   * Tabel layar dipaginasi (lihat load()), tapi ekspor harus mencakup SELURUH
   * transaksi periode yang difilter -- ambil beberapa halaman berurutan
   * (EXPORT_PAGE_SIZE per request) sampai semua baris terkumpul atau
   * EXPORT_MAX_PAGES tercapai (batas aman supaya browser tidak macet
   * generate PDF/print untuk periode yang sangat besar).
   */
  async function fetchAllForExport() {
    if (!lastData || lastData.total === 0) {
      toastInfo('Tidak ada data untuk diekspor pada periode ini.');
      return null;
    }
    let all = [];
    let exportPage = 1;
    let data;
    do {
      data = await apiCall('laporanTransaksi', { usaha, ...filterState, page: exportPage, pageSize: EXPORT_PAGE_SIZE });
      all = all.concat(data.transaksi);
      exportPage++;
    } while (all.length < data.total && exportPage <= EXPORT_MAX_PAGES);

    const truncated = all.length < data.total;
    if (truncated) {
      toastInfo(`Data melebihi batas ekspor (${all.length} dari ${data.total} baris). Persempit filter periode untuk laporan lengkap.`);
    }
    return Object.assign({}, data, { transaksi: all });
  }

  root.querySelector('#export-pdf').addEventListener('click', async () => {
    const data = await fetchAllForExport();
    if (!data) return;
    try {
      exportPDF(`laporan-${data.usaha.toLowerCase()}-${data.periode.startDate}_${data.periode.endDate}.pdf`,
        `Laporan ${data.usaha}`, TABLE_HEADERS, toExportRows(data.transaksi), summaryLines(data));
    } catch (err) {
      toastError(err.message || 'Gagal membuat PDF.');
    }
  });

  root.querySelector('#export-excel').addEventListener('click', async () => {
    const data = await fetchAllForExport();
    if (!data) return;
    exportExcel(`laporan-${data.usaha.toLowerCase()}-${data.periode.startDate}_${data.periode.endDate}.xls`,
      `Laporan ${data.usaha}`, TABLE_HEADERS, toExportRows(data.transaksi));
  });

  root.querySelector('#export-csv').addEventListener('click', async () => {
    const data = await fetchAllForExport();
    if (!data) return;
    exportCSV(`laporan-${data.usaha.toLowerCase()}-${data.periode.startDate}_${data.periode.endDate}.csv`,
      TABLE_HEADERS, toExportRows(data.transaksi));
  });

  root.querySelector('#export-print').addEventListener('click', async () => {
    const data = await fetchAllForExport();
    if (!data) return;
    printReport(`Laporan ${data.usaha}`, TABLE_HEADERS, toExportRows(data.transaksi), summaryLines(data));
  });

  let filterState = wireFilterBar(root, (state) => { filterState = state; page = 1; load(state); }, 'bg-gabungan-600 text-white');
  await load(filterState);
}
