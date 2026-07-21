/**
 * pages/pelanggan/index.js
 * Data Pelanggan: cari, lihat riwayat kunjungan/haircut & pembelian, toggle Member.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah, formatDateID } from '../../core/format.js';

export async function renderPelanggan(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-4xl space-y-4">
      <div class="glass-card p-4">
        <input id="search-input" class="input-field" placeholder="Cari nama atau nomor HP..." />
      </div>
      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">No. HP</th>
              <th class="px-3 py-2">Kunjungan</th>
              <th class="px-3 py-2">Total Belanja</th>
              <th class="px-3 py-2">Poin</th>
              <th class="px-3 py-2">Member</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="pelanggan-body"></tbody>
        </table>
        <p id="pelanggan-empty" class="hidden p-6 text-center text-sm text-slate-400">Tidak ada pelanggan ditemukan.</p>
      </div>
    </div>
  `;

  async function load(query) {
    try {
      const result = await apiCall('pelangganList', { query: query || '' });
      const tbody = root.querySelector('#pelanggan-body');
      const empty = root.querySelector('#pelanggan-empty');
      if (result.pelanggan.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');
      tbody.innerHTML = result.pelanggan.map((p) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2 font-medium">${p.Nama}</td>
          <td class="px-3 py-2">${p.NoHP}</td>
          <td class="px-3 py-2">${p.TotalKunjungan}</td>
          <td class="px-3 py-2">${formatRupiah(p.TotalPengeluaran)}</td>
          <td class="px-3 py-2">${p.PoinLoyalti}</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${p.Member ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">
              ${p.Member ? '⭐ Member' : 'Reguler'}
            </span>
          </td>
          <td class="px-3 py-2 text-right">
            <button type="button" data-id="${p.ID}" class="detail-btn btn-ghost !px-2 !py-1 text-xs">Detail</button>
          </td>
        </tr>`).join('');

      tbody.querySelectorAll('.detail-btn').forEach((btn) => {
        btn.addEventListener('click', () => openDetail(btn.dataset.id));
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data pelanggan.');
    }
  }

  async function openDetail(id) {
    try {
      const { pelanggan, riwayatBarber, riwayatWarkop } = await apiCall('pelangganDetail', { id });
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4';
      overlay.innerHTML = `
        <div class="glass-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-white">${pelanggan.Nama}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">${pelanggan.NoHP} · ${pelanggan.PoinLoyalti} poin · ${formatRupiah(pelanggan.TotalPengeluaran)} total belanja</p>
            </div>
            <button type="button" id="detail-close" class="btn-ghost !px-2 !py-1">✕</button>
          </div>

          <label class="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" id="member-toggle" ${pelanggan.Member ? 'checked' : ''} class="h-4 w-4 rounded" /> Member
          </label>

          <h4 class="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Riwayat Haircut (Barber)</h4>
          <div class="mt-1 space-y-1 text-sm">
            ${riwayatBarber.length === 0 ? '<p class="text-xs text-slate-400">Belum ada riwayat.</p>' : riwayatBarber.map((r) => `
              <div class="flex justify-between rounded-lg bg-slate-900/5 px-2 py-1.5 dark:bg-white/5">
                <span>${formatDateID(r.tanggal)} · ${r.layanan.map((l) => l.nama).join(', ')} · ${r.namaCapster}</span>
                <span class="font-semibold">${formatRupiah(r.grandTotal)}</span>
              </div>`).join('')}
          </div>

          <h4 class="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Riwayat Pembelian (Warkop)</h4>
          <div class="mt-1 space-y-1 text-sm">
            ${riwayatWarkop.length === 0 ? '<p class="text-xs text-slate-400">Belum ada riwayat.</p>' : riwayatWarkop.map((r) => `
              <div class="flex justify-between rounded-lg bg-slate-900/5 px-2 py-1.5 dark:bg-white/5">
                <span>${formatDateID(r.tanggal)} · ${r.items.map((it) => it.nama + ' x' + it.qty).join(', ')}</span>
                <span class="font-semibold">${formatRupiah(r.grandTotal)}</span>
              </div>`).join('')}
          </div>
        </div>`;
      document.body.appendChild(overlay);

      overlay.querySelector('#detail-close').addEventListener('click', () => overlay.remove());
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.querySelector('#member-toggle').addEventListener('change', async (e) => {
        try {
          await apiCall('pelangganSetMember', { id, member: e.target.checked });
          await load(root.querySelector('#search-input').value);
          toastSuccess('Status member diperbarui.');
        } catch (err) {
          toastError(err instanceof ApiError ? err.message : 'Gagal mengubah status member.');
          e.target.checked = !e.target.checked;
        }
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat detail pelanggan.');
    }
  }

  let searchTimer = null;
  root.querySelector('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load(e.target.value.trim()), 250);
  });

  await load('');
}
