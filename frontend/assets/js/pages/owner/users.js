/**
 * pages/owner/users.js
 * Kelola akun: buat/edit user, ubah role & status, reset password (Owner saja).
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';

const ROLES = ['Owner', 'Admin', 'Kasir', 'Capster'];

export async function renderOwnerUsers(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="user-form" class="glass-card grid gap-3 p-4 sm:grid-cols-2">
        <input type="hidden" id="user-id" />
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama</label>
          <input id="user-nama" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Username</label>
          <input id="user-username" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Role</label>
          <select id="user-role" required class="input-field">${ROLES.map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
          <select id="user-status" class="input-field">
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" id="password-label">Password</label>
          <input id="user-password" type="password" class="input-field" placeholder="Minimal 6 karakter" />
          <p id="password-hint" class="mt-1 hidden text-[11px] text-slate-400">Kosongkan jika tidak ingin mengganti password.</p>
        </div>
        <div class="sm:col-span-2 flex gap-2">
          <button type="submit" id="user-submit" class="btn-primary">Simpan Akun</button>
          <button type="button" id="user-cancel" class="btn-ghost hidden border border-slate-200 dark:border-white/10">Batal Edit</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">Username</th>
              <th class="px-3 py-2">Role</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="user-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const form = root.querySelector('#user-form');
  const idInput = root.querySelector('#user-id');
  const namaInput = root.querySelector('#user-nama');
  const usernameInput = root.querySelector('#user-username');
  const roleInput = root.querySelector('#user-role');
  const statusInput = root.querySelector('#user-status');
  const passwordInput = root.querySelector('#user-password');
  const passwordHint = root.querySelector('#password-hint');
  const cancelBtn = root.querySelector('#user-cancel');

  function resetForm() {
    idInput.value = '';
    form.reset();
    passwordInput.required = true;
    passwordHint.classList.add('hidden');
    cancelBtn.classList.add('hidden');
    root.querySelector('#user-submit').textContent = 'Simpan Akun';
  }
  passwordInput.required = true;

  async function load() {
    try {
      const { users } = await apiCall('usersList', {});
      root.querySelector('#user-body').innerHTML = users.map((u) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2 font-medium">${u.Nama}</td>
          <td class="px-3 py-2 font-mono text-xs">${u.Username}</td>
          <td class="px-3 py-2">${u.Role}</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${u.Status === 'Aktif' ? 'bg-gabungan-100 text-gabungan-700 dark:bg-gabungan-500/10 dark:text-gabungan-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">${u.Status}</span>
          </td>
          <td class="px-3 py-2 text-right">
            <button type="button" data-id="${u.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>
          </td>
        </tr>`).join('');

      root.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const u = users.find((x) => x.ID === btn.dataset.id);
          idInput.value = u.ID;
          namaInput.value = u.Nama;
          usernameInput.value = u.Username;
          roleInput.value = u.Role;
          statusInput.value = u.Status;
          passwordInput.value = '';
          passwordInput.required = false;
          passwordHint.classList.remove('hidden');
          cancelBtn.classList.remove('hidden');
          root.querySelector('#user-submit').textContent = 'Update Akun';
          namaInput.focus();
        });
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar akun.');
    }
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiCall('usersSave', {
        id: idInput.value || undefined,
        nama: namaInput.value.trim(),
        username: usernameInput.value.trim(),
        role: roleInput.value,
        status: statusInput.value,
        password: passwordInput.value || undefined
      });
      toastSuccess('Akun berhasil disimpan.');
      resetForm();
      load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan akun.');
    }
  });

  await load();
}
