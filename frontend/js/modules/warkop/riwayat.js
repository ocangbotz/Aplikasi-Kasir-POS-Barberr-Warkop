/**
 * warkop/riwayat — daftar transaksi Warkop dengan filter tanggal, cetak
 * ulang struk (termasuk split bill), dan (Owner/Admin) Owner Panel: edit
 * catatan/nama pelanggan, hapus (soft-delete + alasan wajib, stok menu
 * otomatis dikembalikan), pulihkan (stok dipotong lagi, ditolak kalau stok
 * sekarang tidak cukup). Item/harga/diskon/metode bayar SENGAJA tidak bisa
 * diedit retroaktif — lihat catatan di backend/gas/Warkop.js.
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml, confirmDialog } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';
import { showReceiptModal } from '../receipt/receipt.js';

const FILTERS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' }
];

function metodeBadge(t) {
  if (t.MetodeBayar === 'Split' && t.SplitBillPayers?.length) return `<span class="badge-neutral">Split Bill (${t.SplitBillPayers.length} org)</span>`;
  if (t.MetodeBayar === 'Split') return '<span class="badge-neutral">Split</span>';
  return `<span class="badge-neutral">${escapeHtml(t.MetodeBayar)}</span>`;
}

function openEditModal(trx, onSaved) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4';
  overlay.innerHTML = `
    <div class="glass-card w-full max-w-md bg-white/95 p-6 dark:bg-slate-900/95">
      <h3 class="mb-4 text-lg font-semibold">Edit Transaksi ${escapeHtml(trx.NomorTransaksi)}</h3>
      <form id="form-edit-trx" class="space-y-3">
        <div>
          <label class="label-field" for="edit-nama-pelanggan">Pelanggan/Meja</label>
          <input id="edit-nama-pelanggan" class="input-field" value="${escapeHtml(trx.NamaPelanggan)}" />
        </div>
        <div>
          <label class="label-field" for="edit-catatan">Catatan</label>
          <input id="edit-catatan" class="input-field" value="${escapeHtml(trx.Catatan || '')}" />
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">Nominal, item, diskon, dan metode bayar tidak bisa diedit di sini (sudah ikut potong stok & rekonsiliasi shift/laporan). Untuk koreksi nominal/item, hapus transaksi ini lalu buat yang baru.</p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" data-action="cancel" class="btn-outline">Batal</button>
          <button type="submit" class="btn-primary">Simpan</button>
        </div>
      </form>
    </div>`;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-action="cancel"]')) overlay.remove();
  });

  overlay.querySelector('#form-edit-trx').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      jenisUsaha: 'Warkop',
      transaksiId: trx.TransaksiID,
      namaPelanggan: overlay.querySelector('#edit-nama-pelanggan').value,
      catatan: overlay.querySelector('#edit-catatan').value
    };
    try {
      await apiCall('transaksi.update', payload);
      showToast('Transaksi berhasil diperbarui', 'success');
      overlay.remove();
      onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.body.appendChild(overlay);
}

export async function renderRiwayatWarkop(container) {
  const canManage = hasRole(getCurrentUser(), ['Owner', 'Admin']);

  container.innerHTML = `
    <div class="mx-auto max-w-5xl">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-xl font-bold">Riwayat Transaksi — Warkop</h1>
        <div class="flex flex-wrap items-center gap-3">
          ${
            canManage
              ? `<label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="checkbox" id="riwayat-include-deleted" class="h-4 w-4 rounded" /> Termasuk yang dihapus
                 </label>`
              : ''
          }
          <select id="riwayat-filter" class="input-field !w-auto">
            ${FILTERS.map((f) => `<option value="${f.value}" ${f.value === 'today' ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="glass-card overflow-x-auto p-4">
        <div id="riwayat-table-wrap"></div>
      </div>
    </div>
  `;

  const filterSelect = container.querySelector('#riwayat-filter');
  const includeDeletedCheckbox = container.querySelector('#riwayat-include-deleted');
  const wrap = container.querySelector('#riwayat-table-wrap');

  async function load() {
    wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat transaksi...</div>`;
    let rows;
    try {
      rows = await apiCall('transaksi.list', {
        jenisUsaha: 'Warkop',
        filterType: filterSelect.value,
        includeDeleted: !!(includeDeletedCheckbox && includeDeletedCheckbox.checked)
      });
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
            <th class="py-2 pr-3">Pelanggan/Meja</th>
            <th class="py-2 pr-3">Total</th>
            <th class="py-2 pr-3">Metode</th>
            <th class="py-2 pr-3">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (t) => `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 ${t.Deleted ? 'opacity-60' : ''}" data-trx-id="${escapeHtml(t.TransaksiID)}">
              <td class="py-2 pr-3 font-mono text-xs">${escapeHtml(t.NomorTransaksi)} ${t.Deleted ? '<span class="badge-danger">Dihapus</span>' : ''}</td>
              <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateTimeID(t.CreatedAt))}</td>
              <td class="py-2 pr-3">${escapeHtml(t.NamaPelanggan)}</td>
              <td class="py-2 pr-3">${formatRupiah(t.GrandTotal)}</td>
              <td class="py-2 pr-3">${metodeBadge(t)}</td>
              <td class="py-2 pr-3">
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="print">Cetak Ulang</button>
                  ${
                    canManage
                      ? t.Deleted
                        ? '<button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="restore">Pulihkan</button>'
                        : '<button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="edit">Edit</button><button type="button" class="btn-danger !px-2.5 !py-1.5 text-xs" data-action="delete">Hapus</button>'
                      : ''
                  }
                </div>
              </td>
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
          const detail = await apiCall('transaksi.list', { jenisUsaha: 'Warkop', transaksiId: trxId });
          await showReceiptModal(detail, 'Warkop');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    if (!canManage) return;

    wrap.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const trxId = btn.closest('[data-trx-id]').dataset.trxId;
        const trx = rows.find((r) => r.TransaksiID === trxId);
        openEditModal(trx, load);
      });
    });

    wrap.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const trxId = btn.closest('[data-trx-id]').dataset.trxId;
        const ok = await confirmDialog('Transaksi akan dihapus & stok menu yang terpakai dikembalikan (masih bisa dipulihkan Owner/Admin). Lanjutkan?', { title: 'Hapus Transaksi', confirmText: 'Ya, Hapus', danger: true });
        if (!ok) return;
        const reason = window.prompt('Alasan penghapusan (wajib diisi):');
        if (!reason) { showToast('Alasan penghapusan wajib diisi, dibatalkan', 'warning'); return; }
        try {
          await apiCall('transaksi.delete', { jenisUsaha: 'Warkop', transaksiId: trxId, reason });
          showToast('Transaksi dihapus, stok dikembalikan', 'success');
          load();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    wrap.querySelectorAll('[data-action="restore"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const trxId = btn.closest('[data-trx-id]').dataset.trxId;
        const ok = await confirmDialog('Pulihkan transaksi ini? Stok menu yang terpakai akan dipotong lagi.', { title: 'Pulihkan Transaksi', confirmText: 'Ya, Pulihkan' });
        if (!ok) return;
        try {
          await apiCall('transaksi.restore', { jenisUsaha: 'Warkop', transaksiId: trxId });
          showToast('Transaksi dipulihkan', 'success');
          load();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  filterSelect.addEventListener('change', load);
  if (includeDeletedCheckbox) includeDeletedCheckbox.addEventListener('change', load);
  await load();
}
