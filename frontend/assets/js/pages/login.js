/**
 * pages/login.js
 * Halaman login (glassmorphism). Tidak butuh layout aplikasi -- dirender
 * langsung ke root.
 */
import { login } from '../core/auth.js';
import { ApiError } from '../core/api.js';
import { APP_CONFIG } from '../core/config.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-barber-100 via-slate-50 to-warkop-100 px-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div class="glass-card w-full max-w-sm p-8">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-barber-500 to-warkop-500 text-xl font-bold text-white shadow-lg">
            ✂
          </div>
          <h1 class="text-lg font-bold text-slate-900 dark:text-white">${APP_CONFIG.APP_NAME}</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Masuk untuk melanjutkan</p>
        </div>

        <form id="login-form" class="space-y-4" novalidate>
          <div>
            <label for="username" class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Username</label>
            <input id="username" name="username" type="text" autocomplete="username" required class="input-field" placeholder="owner" />
          </div>
          <div>
            <label for="password" class="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required class="input-field" placeholder="••••••••" />
          </div>

          <p id="login-error" class="hidden rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400" role="alert"></p>

          <button type="submit" id="login-submit" class="btn-primary w-full">
            <span id="login-submit-label">Masuk</span>
          </button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('#login-form');
  const errorEl = root.querySelector('#login-error');
  const submitBtn = root.querySelector('#login-submit');
  const submitLabel = root.querySelector('#login-submit-label');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    const username = form.username.value.trim();
    const password = form.password.value;

    submitBtn.disabled = true;
    submitLabel.textContent = 'Memproses...';
    try {
      await login(username, password);
      // Tidak perlu navigate() manual di sini -- authStore.set() di dalam login()
      // memicu mountShell() lewat subscription, yang otomatis merender rute saat
      // ini (biasanya '/'). Memanggil navigate('/') di sini dulu menyebabkan
      // race condition: dua render rute yang sama berjalan bersamaan dan
      // membuat Chart.js gagal (canvas dipakai dua instance sekaligus).
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Gagal login. Coba lagi.';
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Masuk';
    }
  });

  root.querySelector('#username').focus();
}
