/**
 * inventory — stok bahan baku/consumable Barber & Warkop. Satu implementasi
 * generik dipakai kedua jenis usaha lewat parameter jenisUsaha (sama seperti
 * expenses/index.js). Owner/Admin bisa kelola (tambah/edit/restock/pakai),
 * Kasir hanya melihat.
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateTimeID } from '../../core/format.js';

function stokBadge(item) {
  const stok = Number(item.Stok);
  const min = Number(item.StokMinimum);
  if (stok <= 0) return '<span class="badge-danger">Habis</span>';
  if (stok <= min) return `<span class="badge-danger">${stok} ${escapeHtml(item.SatuanStok)} (rendah)</span>`;
  return `<span class="badge-gabungan">${stok} ${escapeHtml(item.SatuanStok)}</span>`;
}

async function loadAndRenderTable(container, jenisUsaha, canEdit) {
  const wrap = container.querySelector('#inv-table-wrap');
  wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat inventory...</div>`;
  let items;
  try {
    items = await apiCall('inventory.view', { jenisUsaha });
  } catch (err) {
    wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Nama Item</th>
          <th class="py-2 pr-3">Kategori</th>
          <th class="py-2 pr-3">Stok</th>
          <th class="py-2 pr-3">Harga Beli Terakhir</th>
          <th class="py-2 pr-3">Supplier</th>
          <th class="py-2 pr-3">Diperbarui</th>
          ${canEdit ? '<th class="py-2 pr-3">Aksi</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (i) => `
          <tr class="border-b border-slate-100 dark:border-slate-800/60" data-item-id="${escapeHtml(i.ItemID)}">
            <td class="py-2 pr-3">${escapeHtml(i.NamaItem)}</td>
            <td class="py-2 pr-3">${escapeHtml(i.Kategori)}</td>
            <td class="py-2 pr-3">${stokBadge(i)}</td>
            <td class="py-2 pr-3">${formatRupiah(i.HargaBeliTerakhir)}</td>
            <td class="py-2 pr-3">${escapeHtml(i.Supplier || '-')}</td>
            <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${i.UpdatedAt ? escapeHtml(formatDateTimeID(i.UpdatedAt)) : '-'}</td>
            ${
              canEdit
                ? `<td class="py-2 pr-3">
                    <div class="flex flex-wrap gap-2">
                      <input type="number" placeholder="+/-" data-field="delta" class="input-field !w-20 !py-1.5" />
                      <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="adjust">Sesuaikan</button>
                    </div>
                  </td>`
                : ''
            }
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${items.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada item inventory.</p>' : ''}
  `;

  if (!canEdit) return;
  wrap.querySelectorAll('[data-action="adjust"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-item-id]');
      const itemId = row.dataset.itemId;
      const delta = row.querySelector('[data-field="delta"]').value;
      if (!delta || Number(delta) === 0) return showToast('Isi jumlah penyesuaian (boleh negatif untuk pemakaian)', 'error');
      try {
        await apiCall('inventory.manage', { jenisUsaha, itemId, adjust: true, delta, keterangan: Number(delta) > 0 ? 'Restock manual' : 'Pemakaian manual' });
        showToast('Stok berhasil disesuaikan', 'success');
        loadAndRenderTable(container, jenisUsaha, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderInventory(container, jenisUsaha) {
  const canEdit = hasRole(getCurrentUser(), ['Owner', 'Admin']);

  container.innerHTML = `
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">Inventory — ${escapeHtml(jenisUsaha)}</h1>
        ${canEdit ? '<button id="btn-new-item" type="button" class="btn-primary">+ Tambah Item</button>' : ''}
      </div>

      ${
        canEdit
          ? `
      <form id="form-new-item" class="glass-card mb-6 hidden grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label class="label-field" for="new-nama-item">Nama Item</label>
          <input id="new-nama-item" name="namaItem" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-kategori-item">Kategori</label>
          <input id="new-kategori-item" name="kategori" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="new-stok-item">Stok Awal</label>
          <input id="new-stok-item" name="stok" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="new-satuan-item">Satuan</label>
          <input id="new-satuan-item" name="satuanStok" class="input-field" placeholder="pcs, kg, liter, dll" value="pcs" />
        </div>
        <div>
          <label class="label-field" for="new-stok-min-item">Stok Minimum (alert)</label>
          <input id="new-stok-min-item" name="stokMinimum" type="number" min="0" value="5" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="new-supplier-item">Supplier</label>
          <input id="new-supplier-item" name="supplier" class="input-field" />
        </div>
        <div class="flex items-end gap-2 sm:col-span-2">
          <button type="submit" class="btn-primary">Simpan Item</button>
          <button type="button" id="btn-cancel-new-item" class="btn-outline">Batal</button>
        </div>
      </form>`
          : ''
      }

      <div class="glass-card overflow-x-auto p-4">
        <div id="inv-table-wrap"></div>
      </div>
    </div>
  `;

  if (canEdit) {
    const form = container.querySelector('#form-new-item');
    container.querySelector('#btn-new-item').addEventListener('click', () => form.classList.toggle('hidden'));
    container.querySelector('#btn-cancel-new-item').addEventListener('click', () => {
      form.reset();
      form.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = { jenisUsaha, ...Object.fromEntries(new FormData(form).entries()) };
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await apiCall('inventory.manage', payload);
        showToast('Item inventory berhasil ditambahkan', 'success');
        form.reset();
        form.classList.add('hidden');
        loadAndRenderTable(container, jenisUsaha, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  await loadAndRenderTable(container, jenisUsaha, canEdit);
}
