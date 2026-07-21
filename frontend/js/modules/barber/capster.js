/**
 * barber/capster — kelola profil Capster (persentase bagi hasil, status
 * aktif). Akun login Capster dibuat lewat Manajemen User; halaman ini hanya
 * mengatur data operasionalnya. Owner/Admin (capster.manage).
 */

import { apiCall } from '../../core/api.js';
import { getCurrentUser, hasRole } from '../../core/auth.js';
import { showToast, escapeHtml } from '../../core/ui.js';

async function loadAndRenderTable(container, canEdit) {
  const wrap = container.querySelector('#capster-table-wrap');
  wrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat data capster...</div>`;
  let capsters;
  try {
    capsters = await apiCall('capster.list', { includeInactive: true });
  } catch (err) {
    wrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Nama</th>
          <th class="py-2 pr-3">Persentase Bagi Hasil</th>
          <th class="py-2 pr-3">Status</th>
          ${canEdit ? '<th class="py-2 pr-3">Aksi</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${capsters
          .map(
            (c) => `
          <tr class="border-b border-slate-100 dark:border-slate-800/60" data-capster-id="${escapeHtml(c.CapsterID)}">
            <td class="py-2 pr-3">${escapeHtml(c.Nama)}</td>
            <td class="py-2 pr-3">
              ${
                canEdit
                  ? `<div class="flex items-center gap-1">
                      <input type="number" min="0" max="100" value="${escapeHtml(c.PersentaseBagiHasil)}" data-field="persentase" class="input-field !w-20 !py-1.5" />
                      <span>%</span>
                    </div>`
                  : `${escapeHtml(c.PersentaseBagiHasil)}%`
              }
            </td>
            <td class="py-2 pr-3">${c.Aktif ? '<span class="badge-gabungan">Aktif</span>' : '<span class="badge-danger">Nonaktif</span>'}</td>
            ${canEdit ? `<td class="py-2 pr-3"><button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="save">Simpan</button></td>` : ''}
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    ${capsters.length === 0 ? '<p class="p-4 text-center text-sm text-slate-400">Belum ada capster. Tambahkan lewat Manajemen User (role Capster).</p>' : ''}
  `;

  if (!canEdit) return;
  wrap.querySelectorAll('[data-action="save"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-capster-id]');
      const capsterId = row.dataset.capsterId;
      const persentase = row.querySelector('[data-field="persentase"]').value;
      try {
        await apiCall('capster.manage', { capsterId, persentaseBagiHasil: persentase });
        showToast('Persentase bagi hasil disimpan', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderCapster(container) {
  const canEdit = hasRole(getCurrentUser(), ['Owner', 'Admin']);
  container.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-4 text-xl font-bold">Capster</h1>
      <div class="glass-card overflow-x-auto p-4">
        <div id="capster-table-wrap"></div>
      </div>
    </div>
  `;
  await loadAndRenderTable(container, canEdit);
}
