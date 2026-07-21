/**
 * users — manajemen akun login (Owner only). Buat user baru per role,
 * aktifkan/nonaktifkan, reset password.
 */

import { apiCall } from '../../core/api.js';
import { showToast, confirmDialog, escapeHtml } from '../../core/ui.js';
import { formatDateTimeID } from '../../core/format.js';

const ROLES = ['Owner', 'Admin', 'Kasir', 'Capster'];

async function loadAndRenderTable(container) {
  const tableWrap = container.querySelector('#users-table-wrap');
  tableWrap.innerHTML = `<div class="p-6 text-sm text-slate-500">Memuat data user...</div>`;
  let users;
  try {
    users = await apiCall('users.list', {});
  } catch (err) {
    tableWrap.innerHTML = `<div class="p-6 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    return;
  }

  tableWrap.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <th class="py-2 pr-3">Nama</th>
          <th class="py-2 pr-3">Username</th>
          <th class="py-2 pr-3">Role</th>
          <th class="py-2 pr-3">Status</th>
          <th class="py-2 pr-3">Login Terakhir</th>
          <th class="py-2 pr-3">Aksi</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr class="border-b border-slate-100 dark:border-slate-800/60" data-user-id="${escapeHtml(u.uid)}">
            <td class="py-2 pr-3">${escapeHtml(u.fullName)}</td>
            <td class="py-2 pr-3">${escapeHtml(u.username)}</td>
            <td class="py-2 pr-3">${escapeHtml(u.role)}</td>
            <td class="py-2 pr-3">${u.aktif ? '<span class="badge-gabungan">Aktif</span>' : '<span class="badge-danger">Nonaktif</span>'}</td>
            <td class="py-2 pr-3 text-slate-500 dark:text-slate-400">${u.lastLoginAt ? escapeHtml(formatDateTimeID(u.lastLoginAt)) : '-'}</td>
            <td class="py-2 pr-3">
              <div class="flex flex-wrap gap-2">
                <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="toggle-active">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button type="button" class="btn-outline !px-2.5 !py-1.5 text-xs" data-action="reset-password">Reset Password</button>
              </div>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  tableWrap.querySelectorAll('[data-action="toggle-active"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-user-id]');
      const userId = row.dataset.userId;
      const isCurrentlyActive = btn.textContent.trim() === 'Nonaktifkan';
      const ok = await confirmDialog(
        isCurrentlyActive ? 'Nonaktifkan user ini? User tidak akan bisa login lagi.' : 'Aktifkan kembali user ini?',
        { danger: isCurrentlyActive }
      );
      if (!ok) return;
      try {
        await apiCall('users.update', { userId, aktif: !isCurrentlyActive });
        showToast('Status user diperbarui', 'success');
        loadAndRenderTable(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  tableWrap.querySelectorAll('[data-action="reset-password"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('[data-user-id]');
      const userId = row.dataset.userId;
      const newPassword = window.prompt('Masukkan password baru untuk user ini (minimal 6 karakter):');
      if (!newPassword) return;
      if (newPassword.length < 6) {
        showToast('Password minimal 6 karakter', 'error');
        return;
      }
      try {
        await apiCall('users.update', { userId, newPassword });
        showToast('Password berhasil direset', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function renderUsers(container) {
  container.innerHTML = `
    <div class="mx-auto max-w-4xl">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="text-xl font-bold">Manajemen User</h1>
        <button id="btn-new-user" type="button" class="btn-primary">+ Tambah User</button>
      </div>

      <form id="form-new-user" class="glass-card mb-6 hidden grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label class="label-field" for="new-fullName">Nama Lengkap</label>
          <input id="new-fullName" name="fullName" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-username">Username</label>
          <input id="new-username" name="username" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="new-password">Password</label>
          <input id="new-password" name="password" type="password" class="input-field" required minlength="6" />
        </div>
        <div>
          <label class="label-field" for="new-role">Role</label>
          <select id="new-role" name="role" class="input-field" required>
            ${ROLES.map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end gap-2 sm:col-span-2">
          <button type="submit" class="btn-primary">Simpan User</button>
          <button type="button" id="btn-cancel-new-user" class="btn-outline">Batal</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-4">
        <div id="users-table-wrap"></div>
      </div>
    </div>
  `;

  const form = container.querySelector('#form-new-user');
  container.querySelector('#btn-new-user').addEventListener('click', () => form.classList.toggle('hidden'));
  container.querySelector('#btn-cancel-new-user').addEventListener('click', () => {
    form.reset();
    form.classList.add('hidden');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await apiCall('users.create', payload);
      showToast('User baru berhasil dibuat', 'success');
      form.reset();
      form.classList.add('hidden');
      loadAndRenderTable(container);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await loadAndRenderTable(container);
}
