/**
 * pages/owner/transaksi.js
 * Owner Panel - Kelola Transaksi: lihat semua transaksi (termasuk yang
 * dihapus), edit diskon/catatan/status, hapus (soft-delete), dan restore.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';
import { hasPermission } from '../../core/auth.js';

export async function renderOwnerTransaksi(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-5xl space-y-4">
      <div class="glass-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Usaha</label>
          <select id="usaha-select" class="input-field">
            <option value="Barber">Barber</option>
            <option value="Warkop">Warkop</option>
          </select>
        </div>
        <button id="reload-btn" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">Muat Ulang</button>
      </div>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">No. Transaksi</th>
              <th class="px-3 py-2">Total</th>
              <th class="px-3 py-2">Metode</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Dihapus?</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="trx-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const usahaSelect = root.querySelector('#usaha-select');
  const canDelete = hasPermission('hapusTransaksi');

  async function load() {
    try {
      const result = await apiCall('ownerListTransaksi', { usaha: usahaSelect.value, pageSize: 50 });
      root.querySelector('#trx-body').innerHTML = result.transaksi.map((t) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10 ${t.IsDeleted ? 'opacity-50' : ''}">
          <td class="px-3 py-2 font-mono text-xs">${t.NomorTransaksi}</td>
          <td class="px-3 py-2 font-semibold">${formatRupiah(t.GrandTotal)}</td>
          <td class="px-3 py-2">${t.MetodePembayaran}</td>
          <td class="px-3 py-2">${t.Status}</td>
          <td class="px-3 py-2">${t.IsDeleted ? '🗑️ Ya' : '-'}</td>
          <td class="px-3 py-2 text-right whitespace-nowrap">
            ${!t.IsDeleted ? `<button type="button" data-id="${t.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>` : ''}
            ${canDelete && !t.IsDeleted ? `<button type="button" data-id="${t.ID}" class="delete-btn btn-ghost !px-2 !py-1 text-xs text-red-500">🗑️ Hapus</button>` : ''}
            ${canDelete && t.IsDeleted ? `<button type="button" data-id="${t.ID}" class="restore-btn btn-ghost !px-2 !py-1 text-xs">♻️ Restore</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="6" class="p-6 text-center text-sm text-slate-400">Belum ada transaksi.</td></tr>';

      root.querySelectorAll('.edit-btn').forEach((btn) => btn.addEventListener('click', () => openEditModal(btn.dataset.id, result.transaksi)));
      root.querySelectorAll('.delete-btn').forEach((btn) => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
      root.querySelectorAll('.restore-btn').forEach((btn) => btn.addEventListener('click', () => handleRestore(btn.dataset.id)));
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat transaksi.');
    }
  }

  function openEditModal(id, list) {
    const t = list.find((x) => x.ID === id);
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4';
    overlay.innerHTML = `
      <div class="glass-card w-full max-w-sm p-5">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Edit Transaksi ${t.NomorTransaksi}</h3>
        <form id="edit-form" class="mt-3 space-y-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Diskon (Rp)</label>
            <input id="edit-diskon" type="number" min="0" value="${t.Diskon}" class="input-field" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
            <select id="edit-status" class="input-field">
              <option value="Selesai" ${t.Status === 'Selesai' ? 'selected' : ''}>Selesai</option>
              <option value="Dibatalkan" ${t.Status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan</label>
            <textarea id="edit-catatan" rows="2" class="input-field">${t.Catatan || ''}</textarea>
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" id="edit-cancel" class="btn-ghost flex-1 border border-slate-200 dark:border-white/10">Batal</button>
            <button type="submit" class="btn-primary flex-1">Simpan</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#edit-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiCall('ownerUpdateTransaksi', {
          usaha: usahaSelect.value, id: t.ID,
          diskon: Number(overlay.querySelector('#edit-diskon').value) || 0,
          status: overlay.querySelector('#edit-status').value,
          catatan: overlay.querySelector('#edit-catatan').value.trim()
        });
        overlay.remove();
        await load();
        toastSuccess('Transaksi berhasil diperbarui.');
      } catch (err) {
        toastError(err instanceof ApiError ? err.message : 'Gagal memperbarui transaksi.');
      }
    });
  }

  async function handleDelete(id) {
    try {
      await apiCall('ownerDeleteTransaksi', { usaha: usahaSelect.value, id });
      await load();
      toastSuccess('Transaksi dihapus (bisa di-restore).');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menghapus transaksi.');
    }
  }

  async function handleRestore(id) {
    try {
      await apiCall('ownerRestoreTransaksi', { usaha: usahaSelect.value, id });
      await load();
      toastSuccess('Transaksi berhasil dipulihkan.');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memulihkan transaksi.');
    }
  }

  usahaSelect.addEventListener('change', load);
  root.querySelector('#reload-btn').addEventListener('click', load);

  await load();
}
