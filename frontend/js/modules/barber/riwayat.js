/**
 * barber/riwayat — daftar transaksi Barber dengan filter tanggal & cetak
 * ulang struk. Edit/hapus/restore transaksi ada di Owner Panel (Fase 8).
 */

import { apiCall } from '../../core/api.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';
import { showReceiptModal } from '../receipt/receipt.js';

const FILTERS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' }
];

function metodeBadge(m) {
  if (m === 'QRIS') return '<span class="badge-neutral">QRIS</span>';
  if (m === 'Split') return '<span class="badge-neutral">Split</span>';
  return '<span class="badge-neutral">Cash</span>';
}

export async function renderRiwayatBarber(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-xl font-bold">Riwayat Transaksi — Barber</h1>
        <select id="riwayat-filter" class="input-field !w-auto">
          ${FILTERS.map((f) => `<option value="${f.value}" ${f.value === 'today' ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
      </div>
      <div class="glass-card overflow-x-auto p-4">
        <div id="riwayat-table-wrap"></div>
      </div>
    </div>
  `;

  const filterSelect = container.querySelector('#riwayat-filter');
  const wrap = container.querySelector('#riwayat-table-wrap');

  async function load() {
    wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat transaksi...</div>`;
    let rows;
    try {
      rows = await apiCall('transaksi.list', { jenisUsaha: 'Barber', filterType: filterSelect.value });
    } catch (err) {
      wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
      return;
    }

    if (rows.length === 0) {
      wrap.innerHTML = '<p class="p-6 text-center text-sm text-slate-400">Tidak ada transaksi pada rentang ini.</p>';
      return;
    }

    wrap.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <th class="py-2 pr-3">No. Transaksi</th>
            <th class="py-2 pr-3">Waktu</th>
            <th class="py-2 pr-3">Pelanggan</th>
            <th class="py-2 pr-3">Capster</th>
            <th class="py-2 pr-3">Total</th>
            <th class="py-2 pr-3">Metode</th>
            <th class="py-2 pr-3">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (t) => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60" data-trx-id="${escapeHtml(t.TransaksiID)}">
              <td class="py-2 pr-3 font-mono text-xs">${escapeHtml(t.NomorTransaksi)}</td>
              <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateTimeID(t.CreatedAt))}</td>
              <td class="py-2 pr-3">${escapeHtml(t.NamaPelanggan)}</td>
              <td class="py-2 pr-3">${escapeHtml(t.NamaCapster)}</td>
              <td class="py-2 pr-3">${formatRupiah(t.GrandTotal)}</td>
              <td class="py-2 pr-3">${metodeBadge(t.MetodeBayar)}</td>
              <td class="py-2 pr-3"><button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="print">Cetak Ulang</button></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;

    wrap.querySelectorAll('[data-action="print"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const trxId = btn.closest('[data-trx-id]').dataset.trxId;
        try {
          const detail = await apiCall('transaksi.list', { jenisUsaha: 'Barber', transaksiId: trxId });
          await showReceiptModal(detail, 'Barber');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  filterSelect.addEventListener('change', load);
  await load();
}
