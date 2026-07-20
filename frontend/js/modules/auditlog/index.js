/**
 * auditlog — riwayat aktivitas (Owner/Admin). Paginasi "muat lebih banyak"
 * dari baris terbaru (lihat AuditLog.getAuditLogPage di backend).
 */

import { apiCall } from '../../core/api.js';
import { escapeHtml } from '../../core/ui.js';
import { formatDateTimeID } from '../../core/format.js';

const PAGE_SIZE = 25;

function resultBadge(hasil) {
  return hasil === 'Success' ? '<span class="badge-gabungan">Success</span>' : '<span class="badge-danger">Failed</span>';
}

function rowsToHtml(rows) {
  return rows
    .map(
      (r) => `
    <tr class="border-b border-slate-100 align-top dark:border-slate-800/60">
      <td class="whitespace-nowrap py-2 pr-3 text-slate-500 dark:text-slate-400">${escapeHtml(formatDateTimeID(r.Timestamp))}</td>
      <td class="py-2 pr-3">${escapeHtml(r.NamaUser)}<div class="text-xs text-slate-400">${escapeHtml(r.Role)}</div></td>
      <td class="py-2 pr-3">${escapeHtml(r.Aksi)}</td>
      <td class="py-2 pr-3">${escapeHtml(r.Modul)}</td>
      <td class="py-2 pr-3 font-mono text-xs">${escapeHtml(r.TargetID)}</td>
      <td class="py-2 pr-3">${resultBadge(r.Hasil)}</td>
    </tr>`
    )
    .join('');
}

export async function renderAuditLog(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-5xl">
      <h1 class="mb-4 text-xl font-bold">Audit Log</h1>
      <div class="glass-card overflow-x-auto p-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th class="py-2 pr-3">Waktu</th>
              <th class="py-2 pr-3">User</th>
              <th class="py-2 pr-3">Aksi</th>
              <th class="py-2 pr-3">Modul</th>
              <th class="py-2 pr-3">Target</th>
              <th class="py-2 pr-3">Hasil</th>
            </tr>
          </thead>
          <tbody id="audit-log-body"></tbody>
        </table>
        <div class="mt-4 text-center">
          <button id="btn-load-more" type="button" class="btn-outline">Muat Lebih Banyak</button>
        </div>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#audit-log-body');
  const loadMoreBtn = container.querySelector('#btn-load-more');
  let offset = 0;

  async function loadPage() {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Memuat...';
    try {
      const rows = await apiCall('auditlog.list', { limit: PAGE_SIZE, offset });
      tbody.insertAdjacentHTML('beforeend', rowsToHtml(rows));
      offset += rows.length;
      if (rows.length < PAGE_SIZE) {
        loadMoreBtn.textContent = 'Tidak ada lagi';
        loadMoreBtn.disabled = true;
      } else {
        loadMoreBtn.textContent = 'Muat Lebih Banyak';
        loadMoreBtn.disabled = false;
      }
    } catch (err) {
      loadMoreBtn.textContent = 'Gagal memuat, coba lagi';
      loadMoreBtn.disabled = false;
    }
  }

  loadMoreBtn.addEventListener('click', loadPage);
  await loadPage();
}
