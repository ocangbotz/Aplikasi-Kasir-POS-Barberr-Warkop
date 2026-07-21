/**
 * pages/audit-log/index.js
 * Log seluruh aktivitas penting (Owner/Admin). Data Sebelum/Sesudah bisa
 * di-expand untuk melihat detail JSON mentah.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError } from '../../core/toast.js';

function fmtDateTime(value) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
}

export async function renderAuditLog(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-5xl space-y-4">
      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Waktu</th>
              <th class="px-3 py-2">User</th>
              <th class="px-3 py-2">Aksi</th>
              <th class="px-3 py-2">Modul</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="log-body"></tbody>
        </table>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span id="log-summary" class="text-slate-500 dark:text-slate-400"></span>
        <div class="flex gap-2">
          <button id="prev-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">‹ Sebelumnya</button>
          <button id="next-page" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">Selanjutnya ›</button>
        </div>
      </div>
    </div>
  `;

  let page = 1;
  const pageSize = 50;

  async function load() {
    let logs = [];
    try {
      const result = await apiCall('auditLogList', { page, pageSize });
      logs = result.logs;
      const totalPages = Math.max(Math.ceil(result.total / pageSize), 1);
      root.querySelector('#log-summary').textContent = `${result.total} aktivitas · Halaman ${page}/${totalPages}`;
      root.querySelector('#prev-page').disabled = page <= 1;
      root.querySelector('#next-page').disabled = page >= totalPages;
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat audit log.');
      return;
    }
    root.querySelector('#log-body').innerHTML = logs.map((log, i) => `
      <tr class="border-t border-slate-200/60 dark:border-white/10">
        <td class="px-3 py-2 whitespace-nowrap text-xs">${fmtDateTime(log.Timestamp)}</td>
        <td class="px-3 py-2">${log.UserName}</td>
        <td class="px-3 py-2 font-mono text-xs">${log.Aksi}</td>
        <td class="px-3 py-2">${log.Modul}</td>
        <td class="px-3 py-2 text-right">
          <button type="button" data-idx="${i}" class="toggle-detail-btn btn-ghost !px-2 !py-1 text-xs">Detail</button>
        </td>
      </tr>
      <tr id="detail-row-${i}" class="hidden border-t border-slate-200/60 bg-slate-900/5 dark:border-white/10 dark:bg-white/5">
        <td colspan="5" class="px-3 py-2">
          <p class="text-xs font-semibold text-slate-500">Sebelum:</p>
          <pre class="overflow-x-auto whitespace-pre-wrap break-all text-[11px]">${escapeHtml(log.DataSebelum)}</pre>
          <p class="mt-2 text-xs font-semibold text-slate-500">Sesudah:</p>
          <pre class="overflow-x-auto whitespace-pre-wrap break-all text-[11px]">${escapeHtml(log.DataSesudah)}</pre>
        </td>
      </tr>`).join('') || '<tr><td colspan="5" class="p-6 text-center text-sm text-slate-400">Belum ada aktivitas tercatat.</td></tr>';

    root.querySelectorAll('.toggle-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelector('#detail-row-' + btn.dataset.idx).classList.toggle('hidden');
      });
    });
  }

  root.querySelector('#prev-page').addEventListener('click', () => { if (page > 1) { page--; load(); } });
  root.querySelector('#next-page').addEventListener('click', () => { page++; load(); });

  await load();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
