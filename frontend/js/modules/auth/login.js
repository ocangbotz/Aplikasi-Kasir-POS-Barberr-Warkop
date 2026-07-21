/**
 * auth/login — halaman login. Publik (tidak butuh role), tapi butuh
 * apiBaseUrl sudah dikonfigurasi (dijamin oleh guard di app.js).
 */

import { login } from '../../core/auth.js';
import { showToast } from '../../core/ui.js';
import { navigate } from '../../core/router.js';

export async function renderLogin(container) {
  container.innerHTML = `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="glass-card w-full max-w-sm p-6 sm:p-8">
        <div class="mb-6 text-center">
          <div class="mb-2 text-3xl">💈☕</div>
          <h1 class="text-xl font-bold">Masuk</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">POS Barber &amp; Warkop</p>
        </div>
        <form id="form-login" novalidate>
          <label class="label-field" for="login-username">Username</label>
          <input id="login-username" name="username" type="text" autocomplete="username" required class="input-field mb-4" />
          <label class="label-field" for="login-password">Password</label>
          <input id="login-password" name="password" type="password" autocomplete="current-password" required class="input-field mb-6" />
          <button type="submit" class="btn-primary w-full">Masuk</button>
        </form>
        <p id="login-error" class="mt-4 min-h-[1.25rem] text-sm text-red-600 dark:text-red-400"></p>
        <button id="btn-change-connection" type="button" class="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          Ubah URL koneksi backend
        </button>
      </div>
    </div>
  `;

  const form = container.querySelector('#form-login');
  const errorEl = container.querySelector('#login-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';
    try {
      const user = await login(form.username.value.trim(), form.password.value);
      showToast(`Selamat datang, ${user.name}`, 'success');
      navigate('/');
    } catch (err) {
      errorEl.textContent = err.message || 'Login gagal';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk';
    }
  });

  container.querySelector('#btn-change-connection').addEventListener('click', () => navigate('/setup-koneksi'));
}
