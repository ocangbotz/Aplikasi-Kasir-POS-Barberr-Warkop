/**
 * backup — backup on-demand & restore (Owner only). Restore butuh File ID
 * Drive dari hasil backup sebelumnya (backend belum menyediakan daftar
 * backup — lihat catatan di docs/ARCHITECTURE.md untuk kemungkinan
 * pengembangan lanjutan menyimpan riwayat backup di sheet Settings/terpisah).
 */

import { apiCall } from '../../core/api.js';
import { showToast, confirmDialog, escapeHtml } from '../../core/ui.js';

export async function renderBackup(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-2xl space-y-6">
      <h1 class="text-xl font-bold">Backup &amp; Restore</h1>

      <div class="glass-card p-6">
        <h2 class="mb-1 font-semibold">Buat Backup</h2>
        <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Menduplikasi seluruh Spreadsheet database ke Google Drive Anda dengan nama & waktu unik.
        </p>
        <button id="btn-create-backup" type="button" class="btn-primary">Buat Backup Sekarang</button>
        <div id="backup-result" class="mt-4 text-sm"></div>
      </div>

      <div class="glass-card p-6">
        <h2 class="mb-1 font-semibold">Restore dari Backup</h2>
        <p class="mb-4 text-sm text-slate-500 dark:text-slate-400">
          <strong>Perhatian:</strong> tindakan ini akan MENIMPA data saat ini dengan isi backup yang dipilih.
          Sistem otomatis membuat backup pengaman dari kondisi sekarang sebelum menimpa data.
          Salin File ID dari URL file backup di Google Drive
          (<code>https://drive.google.com/file/d/<strong>FILE_ID</strong>/view</code>).
        </p>
        <form id="form-restore" class="space-y-4">
          <div>
            <label class="label-field" for="restore-file-id">File ID Backup</label>
            <input id="restore-file-id" name="backupFileId" class="input-field" required />
          </div>
          <button type="submit" class="btn-danger">Restore Sekarang</button>
        </form>
        <div id="restore-result" class="mt-4 text-sm"></div>
      </div>
    </div>
  `;

  container.querySelector('#btn-create-backup').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const resultEl = container.querySelector('#backup-result');
    btn.disabled = true;
    btn.textContent = 'Membuat backup...';
    try {
      const result = await apiCall('backup.create', {});
      resultEl.innerHTML = `Backup dibuat: <strong>${escapeHtml(result.fileName)}</strong> — <a class="text-slate-800 visited:text-slate-800 underline dark:text-slate-100 dark:visited:text-slate-100" href="${escapeHtml(result.url)}" target="_blank" rel="noopener">Buka di Drive</a>`;
      showToast('Backup berhasil dibuat', 'success');
    } catch (err) {
      resultEl.textContent = `Gagal: ${err.message}`;
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buat Backup Sekarang';
    }
  });

  container.querySelector('#form-restore').addEventListener('submit', async (e) => {
    e.preventDefault();
    const backupFileId = e.target.backupFileId.value.trim();
    if (!backupFileId) return;
    const ok = await confirmDialog(
      'Data saat ini akan DITIMPA oleh isi backup ini. Backup pengaman otomatis akan dibuat dulu. Lanjutkan?',
      { title: 'Konfirmasi Restore', confirmText: 'Ya, Restore', danger: true }
    );
    if (!ok) return;

    const resultEl = container.querySelector('#restore-result');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      const result = await apiCall('backup.restore', { backupFileId, confirm: 'RESTORE' });
      resultEl.innerHTML = `Restore selesai. Sheet dipulihkan: ${escapeHtml(result.restoredSheets.join(', '))}`;
      showToast('Restore berhasil', 'success');
    } catch (err) {
      resultEl.textContent = `Gagal: ${err.message}`;
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
