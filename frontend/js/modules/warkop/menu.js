/**
 * warkop/menu — kelola Menu Warkop (Nama, Kategori, Modal, Harga Jual,
 * Margin otomatis, Stok, Status Aktif). Owner/Admin bisa tambah/edit/restock
 * (produk.manage), Kasir hanya melihat (produk.list).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';

function stokBadge(p) {
  const stok = Number(p.Stok);
  const min = Number(p.StokMinimum);
  if (stok <= 0) return `<span class="badge-danger">Habis</span>`;
  if (stok <= min) return `<span class="badge-danger">${stok} ${escapeHtml(p.SatuanStok)} (rendah)</span>`;
  return `<span class="badge-gabungan">${stok} ${escapeHtml(p.SatuanStok)}</span>`;
}

async function loadAndRenderTable(container, canEdit) {
  const wrap = container.querySelector('#menu-table-wrap');
  wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat menu...</div>`;
  let produk;
  try {
    produk = await apiCall('produk.list', { includeInactive: true });
  } catch (err) {
    wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Menu</th>
          <th class="py-2 pr-3">Kategori</th>
          <th class="py-2 pr-3">Modal</th>
          <th class="py-2 pr-3">Harga Jual</th>
          <th class="py-2 pr-3">Margin</th>
          <th class="py-2 pr-3">Stok</th>
          <th class="py-2 pr-3">Status</th>
          ${canEdit ? '<th class="py-2 pr-3">Aksi</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${produk
          .map(
            (p) => `
          <tr class="border-b border-slate-100 dark:border-slate-800/60" data-produk-id="${escapeHtml(p.ProdukID)}">
            <td class="py-2 pr-3">${escapeHtml(p.NamaMenu)}</td>
            <td class="py-2 pr-3">${escapeHtml(p.Kategori)}</td>
            <td class="py-2 pr-3">${formatRupiah(p.Modal)}</td>
            <td class="py-2 pr-3">${formatRupiah(p.HargaJual)}</td>
            <td class="py-2 pr-3">${formatRupiah(p.Margin)}</td>
            <td class="py-2 pr-3">${stokBadge(p)}</td>
            <td class="py-2 pr-3">${p.Aktif ? '<span class="badge-gabungan">Aktif</span>' : '<span class="badge-danger">Nonaktif</span>'}</td>
            ${
              canEdit
                ? `<td class="py-2 pr-3">
                    <div class="flex flex-wrap gap-2">
                      <input type="number" min="0" placeholder="+stok" data-field="restock" class="input-field !w-20 !py-1.5" />
                      <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="restock">Tambah</button>
                      <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="toggle">${p.Aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                    </div>
                  </td>`
                : ''
            }
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${produk.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada menu.</p>' : ''}
  `;

  if (!canEdit) return;

  wrap.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-produk-id]');
      const produkId = row.dataset.produkId;
      const nowActive = btn.textContent.trim() === 'Nonaktifkan';
      try {
        await apiCall('produk.manage', { produkId, aktif: !nowActive });
        showToast('Status menu diperbarui', 'success');
        loadAndRenderTable(container, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  wrap.querySelectorAll('[data-action="restock"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-produk-id]');
      const produkId = row.dataset.produkId;
      const tambahan = row.querySelector('[data-field="restock"]').value;
      if (!tambahan || Number(tambahan) <= 0) return showToast('Isi jumlah tambahan stok', 'error');
      try {
        await apiCall('produk.manage', { produkId, restock: true, tambahan });
        showToast('Stok berhasil ditambah', 'success');
        loadAndRenderTable(container, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderMenuWarkop(container) {
  const canEdit = hasRole(getCurrentUser(), ['Owner', 'Admin']);

  container.innerHTML = `
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">Menu Warkop</h1>
        ${canEdit ? '<button id="btn-new-menu" type="button" class="btn-warkop">+ Tambah Menu</button>' : ''}
      </div>

      ${
        canEdit
          ? `
      <form id="form-new-menu" class="glass-card mb-6 hidden grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label class="label-field" for="new-nama-menu">Nama Menu</label>
          <input id="new-nama-menu" name="namaMenu" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-kategori-menu">Kategori</label>
          <input id="new-kategori-menu" name="kategori" class="input-field" placeholder="Minuman, Makanan, dll" />
        </div>
        <div>
          <label class="label-field" for="new-modal-menu">Modal (Rp)</label>
          <input id="new-modal-menu" name="modal" type="number" min="0" step="500" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-harga-menu">Harga Jual (Rp)</label>
          <input id="new-harga-menu" name="hargaJual" type="number" min="0" step="500" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-stok-menu">Stok Awal</label>
          <input id="new-stok-menu" name="stok" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="new-stok-min-menu">Stok Minimum (alert)</label>
          <input id="new-stok-min-menu" name="stokMinimum" type="number" min="0" value="5" class="input-field" />
        </div>
        <div class="flex items-end gap-2 sm:col-span-2">
          <button type="submit" class="btn-warkop">Simpan Menu</button>
          <button type="button" id="btn-cancel-new-menu" class="btn-outline">Batal</button>
        </div>
      </form>`
          : ''
      }

      <div class="glass-card overflow-x-auto p-4">
        <div id="menu-table-wrap"></div>
      </div>
    </div>
  `;

  if (canEdit) {
    const form = container.querySelector('#form-new-menu');
    container.querySelector('#btn-new-menu').addEventListener('click', () => form.classList.toggle('hidden'));
    container.querySelector('#btn-cancel-new-menu').addEventListener('click', () => {
      form.reset();
      form.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await apiCall('produk.manage', payload);
        showToast('Menu baru berhasil ditambahkan', 'success');
        form.reset();
        form.classList.add('hidden');
        loadAndRenderTable(container, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  await loadAndRenderTable(container, canEdit);
}
