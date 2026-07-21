/**
 * pages/home.js
 * Halaman Beranda/Profil setelah login. Menampilkan data akun yang sedang
 * login (real, dari sesi) dan form ganti password yang benar-benar
 * terhubung ke backend (authChangePassword_).
 */
import { getCurrentUser, changePassword } from '../core/auth.js';
import { ApiError } from '../core/api.js';
import { toastSuccess, toastError } from '../core/toast.js';

export function renderHome(root) {
  const user = getCurrentUser();

  root.innerHTML = `
    <div class="mx-auto max-w-2xl space-y-6">
      <div class="glass-card p-6">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Selamat datang</p>
        <h1 class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">${user?.nama || '-'}</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Masuk sebagai <span class="font-semibold text-slate-700 dark:text-slate-200">${user?.role || '-'}</span>
          &middot; username <span class="font-mono">${user?.username || '-'}</span>
        </p>
      </div>

      <div class="glass-card p-6">
        <h2 class="text-sm font-bold text-slate-900 dark:text-white">Ganti Password</h2>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Disarankan mengganti password bawaan setelah login pertama kali.
        </p>
        <form id="change-password-form" class="mt-4 space-y-3" novalidate>
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password Lama</label>
            <input name="oldPassword" type="password" required autocomplete="current-password" class="input-field" />
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password Baru (min. 6 karakter)</label>
            <input name="newPassword" type="password" required minlength="6" autocomplete="new-password" class="input-field" />
          </div>
          <button type="submit" id="change-password-submit" class="btn-primary">Simpan Password Baru</button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('#change-password-form');
  const submitBtn = root.querySelector('#change-password-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = form.oldPassword.value;
    const newPassword = form.newPassword.value;
    submitBtn.disabled = true;
    try {
      await changePassword(oldPassword, newPassword);
      toastSuccess('Password berhasil diganti.');
      form.reset();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal mengganti password.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
