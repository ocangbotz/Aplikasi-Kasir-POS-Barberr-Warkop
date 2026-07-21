/**
 * barber/layanan — kelola daftar Layanan Barber. Owner boleh tambah/edit,
 * Admin/Kasir hanya melihat (sesuai RBAC layanan.manage vs layanan.list).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';

async function loadAndRenderTable(container, canEdit) {
  const wrap = container.querySelector('#layanan-table-wrap');
  wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat layanan...</div>`;
  let layanan;
  try {
    layanan = await apiCall('layanan.list', { includeInactive: true });
  } catch (err) {
    wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Nama Layanan</th>
          <th class="py-2 pr-3">Kategori</th>
          <th class="py-2 pr-3">Harga</th>
          <th class="py-2 pr-3">Durasi</th>
          <th class="py-2 pr-3">Status</th>
          ${canEdit ? '<th class="py-2 pr-3">Aksi</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${layanan
          .map(
            (l) => `
          <tr class="border-b border-slate-100 dark:border-slate-800/60" data-layanan-id="${escapeHtml(l.LayananID)}">
            <td class="py-2 pr-3">${escapeHtml(l.NamaLayanan)}</td>
            <td class="py-2 pr-3">${escapeHtml(l.Kategori)}</td>
            <td class="py-2 pr-3">${formatRupiah(l.Harga)}</td>
            <td class="py-2 pr-3">${escapeHtml(l.DurasiMenit)} menit</td>
            <td class="py-2 pr-3">${l.Aktif ? '<span class="badge-gabungan">Aktif</span>' : '<span class="badge-danger">Nonaktif</span>'}</td>
            ${canEdit ? `<td class="py-2 pr-3"><button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="toggle">${l.Aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td>` : ''}
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${layanan.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada layanan.</p>' : ''}
  `;

  if (!canEdit) return;
  wrap.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-layanan-id]');
      const layananId = row.dataset.layananId;
      const nowActive = btn.textContent.trim() === 'Nonaktifkan';
      try {
        await apiCall('layanan.manage', { layananId, aktif: !nowActive });
        showToast('Status layanan diperbarui', 'success');
        loadAndRenderTable(container, canEdit);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderLayananBarber(container) {
  const canEdit = hasRole(getCurrentUser(), ['Owner']);

  container.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">Layanan Barber</h1>
        ${canEdit ? '<button id="btn-new-layanan" type="button" class="btn-barber">+ Tambah Layanan</button>' : ''}
      </div>

      ${
        canEdit
          ? `
      <form id="form-new-layanan" class="glass-card mb-6 hidden grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label class="label-field" for="new-nama-layanan">Nama Layanan</label>
          <input id="new-nama-layanan" name="namaLayanan" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-harga-layanan">Harga (Rp)</label>
          <input id="new-harga-layanan" name="harga" type="number" min="0" step="500" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-durasi-layanan">Durasi (menit)</label>
          <input id="new-durasi-layanan" name="durasiMenit" type="number" min="0" value="30" class="input-field" />
        </div>
        <div>
          <label class="label-field" for="new-kategori-layanan">Kategori</label>
          <input id="new-kategori-layanan" name="kategori" class="input-field" placeholder="Haircut, Grooming, dll" />
        </div>
        <div class="flex items-end gap-2 sm:col-span-2">
          <button type="submit" class="btn-barber">Simpan Layanan</button>
          <button type="button" id="btn-cancel-new-layanan" class="btn-outline">Batal</button>
        </div>
      </form>`
          : ''
      }

      <div class="glass-card overflow-x-auto p-4">
        <div id="layanan-table-wrap"></div>
      </div>
    </div>
  `;

  if (canEdit) {
    const form = container.querySelector('#form-new-layanan');
    container.querySelector('#btn-new-layanan').addEventListener('click', () => form.classList.toggle('hidden'));
    container.querySelector('#btn-cancel-new-layanan').addEventListener('click', () => {
      form.reset();
      form.classList.add('hidden');
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await apiCall('layanan.manage', payload);
        showToast('Layanan baru berhasil ditambahkan', 'success');
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
