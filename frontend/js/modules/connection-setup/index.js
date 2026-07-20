/**
 * connection-setup — layar sekali-isi untuk menempelkan URL Web App Apps
 * Script hasil deploy (beda untuk setiap instalasi/usaha, lihat
 * docs/SPREADSHEET_SETUP.md §5). Tampil otomatis sebelum layar login kalau
 * belum pernah diisi (lihat guard di app.js).
 */

import { setApiBaseUrl, getApiBaseUrl } from '../../core/config.js';
import { apiHealthCheck } from '../../core/api.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { navigate } from '../../core/router.js';

export async function renderConnectionSetup(container) {
  const existing = getApiBaseUrl();

  container.innerHTML = `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="glass-card w-full max-w-md p-6 sm:p-8">
        <div class="mb-6 text-center">
          <div class="mb-2 text-3xl">💈☕</div>
          <h1 class="text-xl font-bold">Pengaturan Koneksi</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tempel URL Web App Google Apps Script yang sudah Anda deploy.
            Lihat <code>docs/SPREADSHEET_SETUP.md</code> untuk cara mendapatkannya.
          </p>
        </div>
        <form id="form-connection" novalidate>
          <label class="label-field" for="api-url">Web App URL</label>
          <input id="api-url" name="apiUrl" type="url" required
                 placeholder="https://script.google.com/macros/s/xxxx/exec"
                 class="input-field mb-4" value="${escapeHtml(existing)}" />
          <button type="submit" class="btn-primary w-full">Simpan &amp; Uji Koneksi</button>
        </form>
        <p id="connection-status" class="mt-4 min-h-[1.25rem] text-sm"></p>
      </div>
    </div>
  `;

  const form = container.querySelector('#form-connection');
  const statusEl = container.querySelector('#connection-status');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = form.apiUrl.value.trim().replace(/\/+$/, '');
    if (!url) return;

    setApiBaseUrl(url);
    statusEl.textContent = 'Menguji koneksi...';
    statusEl.className = 'mt-4 min-h-[1.25rem] text-sm text-slate-500 dark:text-slate-400';

    try {
      await apiHealthCheck();
      statusEl.textContent = 'Terhubung! Mengalihkan ke halaman login...';
      statusEl.className = 'mt-4 min-h-[1.25rem] text-sm text-gabungan-600 dark:text-gabungan-400';
      showToast('Koneksi backend berhasil disimpan', 'success');
      setTimeout(() => navigate('/login'), 700);
    } catch (err) {
      statusEl.textContent = `Gagal terhubung: ${err.message}`;
      statusEl.className = 'mt-4 min-h-[1.25rem] text-sm text-red-600 dark:text-red-400';
    }
  });
}
