/**
 * pages/warkop/riwayat.js
 * Riwayat transaksi Warkop dengan filter tanggal, pagination, dan cetak ulang struk.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError } from '../../core/toast.js';
import { formatRupiah, todayISODate } from '../../core/format.js';
import { openWarkopStrukModal } from './struk.js';

export async function renderWarkopRiwayat(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-4xl space-y-4">
      <div class="glass-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Dari Tanggal</label>
          <input id="filter-start" type="date" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Sampai Tanggal</label>
          <input id="filter-end" type="date" class="input-field" />
        </div>
        <button id="filter-apply" type="button" class="btn-warkop">Terapkan Filter</button>
      </div>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">No. Transaksi</th>
              <th class="px-3 py-2">Item</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Bayar</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="riwayat-body"></tbody>
        </table>
        <p id="riwayat-empty" class="hidden p-6 text-center text-sm text-slate-400">Belum ada transaksi pada rentang ini.</p>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span id="riwayat-summary" class="text-slate-500 dark:text-slate-400"></span>
        <div class="flex gap-2">
          <button id="prev-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">‹ Sebelumnya</button>
          <button id="next-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">Selanjutnya ›</button>
        </div>
      </div>
    </div>
  `;

  const startInput = root.querySelector('#filter-start');
  const endInput = root.querySelector('#filter-end');
  startInput.value = todayISODate();
  endInput.value = todayISODate();

  let page = 1;
  const pageSize = 10;

  async function load() {
    try {
      const result = await apiCall('warkopListTransaksi', {
        startDate: startInput.value, endDate: endInput.value, page, pageSize
      });
      const tbody = root.querySelector('#riwayat-body');
      const empty = root.querySelector('#riwayat-empty');

      if (result.transaksi.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
      } else {
        empty.classList.add('hidden');
        tbody.innerHTML = result.transaksi.map((t) => {
          const itemSummary = t.Items.map((it) => `${it.nama} x${it.qty}`).join(', ');
          return `
          <tr class="border-t border-slate-200/60 dark:border-white/10">
            <td class="px-3 py-2 font-mono text-xs">${t.NomorTransaksi}</td>
            <td class="px-3 py-2 max-w-[240px] truncate" title="${itemSummary}">${itemSummary}</td>
            <td class="px-3 py-2 font-semibold">${formatRupiah(t.GrandTotal)}</td>
            <td class="px-3 py-2">${t.MetodePembayaran}</td>
            <td class="px-3 py-2 text-right">
              <button type="button" data-id="${t.ID}" class="print-btn btn-ghost !px-2 !py-1 text-xs">🖨️ Cetak</button>
            </td>
          </tr>`;
        }).join('');

        tbody.querySelectorAll('.print-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const { transaksi } = await apiCall('warkopGetTransaksi', { id: btn.dataset.id });
            openWarkopStrukModal(transaksi);
          });
        });
      }

      const totalPages = Math.max(Math.ceil(result.total / pageSize), 1);
      root.querySelector('#riwayat-summary').textContent = `${result.total} transaksi · Halaman ${page}/${totalPages}`;
      root.querySelector('#prev-page').disabled = page <= 1;
      root.querySelector('#next-page').disabled = page >= totalPages;
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat transaksi.');
    }
  }

  root.querySelector('#filter-apply').addEventListener('click', () => { page = 1; load(); });
  root.querySelector('#prev-page').addEventListener('click', () => { if (page > 1) { page--; load(); } });
  root.querySelector('#next-page').addEventListener('click', () => { page++; load(); });

  await load();
}
