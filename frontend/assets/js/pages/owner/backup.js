/**
 * pages/owner/backup.js
 * Backup (unduh JSON seluruh database) & Restore (timpa dari file backup).
 * Restore sangat destruktif -- dua kali konfirmasi, dan sheet Kasir/kredensial
 * login tidak pernah ikut ditimpa (dilindungi di backend).
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function renderOwnerBackup(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-2xl space-y-4">
      <div class="glass-card p-4">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">Backup Database</h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Mengunduh seluruh data (transaksi, pelanggan, inventory, dll -- TANPA kredensial login) sebagai satu file JSON.
        </p>
        <button type="button" id="backup-btn" class="btn-primary mt-3">⬇️ Unduh Backup</button>
      </div>

      <div class="glass-card border-2 border-red-200 p-4 dark:border-red-500/30">
        <h2 class="text-sm font-bold text-red-600 dark:text-red-400">⚠️ Restore Database</h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Menimpa data saat ini dengan isi file backup. Aksi ini TIDAK BISA DIBATALKAN. Data akun login (Kasir) tidak akan ikut ditimpa.
        </p>
        <input id="restore-file" type="file" accept="application/json" class="input-field !py-1.5 mt-3" />
        <button type="button" id="restore-btn" class="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700" disabled>
          Restore dari File
        </button>
      </div>
    </div>
  `;

  root.querySelector('#backup-btn').addEventListener('click', async () => {
    try {
      const { backup } = await apiCall('ownerBackupData', {});
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-kasir-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastSuccess('Backup berhasil diunduh.');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal membuat backup.');
    }
  });

  const fileInput = root.querySelector('#restore-file');
  const restoreBtn = root.querySelector('#restore-btn');
  let parsedBackup = null;

  fileInput.addEventListener('change', async () => {
    restoreBtn.disabled = true;
    parsedBackup = null;
    const file = fileInput.files[0];
    if (!file) return;
    try {
      parsedBackup = JSON.parse(await readFileAsText(file));
      restoreBtn.disabled = false;
    } catch {
      toastError('File bukan JSON backup yang valid.');
    }
  });

  restoreBtn.addEventListener('click', async () => {
    if (!parsedBackup) return;
    const confirmed = window.confirm('Yakin ingin menimpa SELURUH data saat ini dengan isi file backup ini? Aksi ini tidak bisa dibatalkan.');
    if (!confirmed) return;
    const confirmedAgain = window.confirm('Konfirmasi sekali lagi: data transaksi, pelanggan, inventory, dll saat ini akan HILANG dan digantikan isi backup. Lanjutkan?');
    if (!confirmedAgain) return;

    restoreBtn.disabled = true;
    try {
      const result = await apiCall('ownerRestoreData', { backup: parsedBackup, confirm: true });
      toastSuccess(`Restore berhasil (${result.restored.length} sheet dipulihkan).`);
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal melakukan restore.');
    } finally {
      restoreBtn.disabled = false;
    }
  });
}
