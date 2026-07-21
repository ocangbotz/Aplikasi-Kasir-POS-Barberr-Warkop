/**
 * pages/barber/capster.js
 * Kelola data Capster (Owner/Admin). Persentase bagi hasil dipakai nanti
 * oleh modul Gaji Capster (Fase 7) untuk hitung otomatis.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';

export async function renderBarberCapster(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="capster-form" class="glass-card grid gap-3 p-4 sm:grid-cols-4">
        <input type="hidden" id="capster-id" />
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama</label>
          <input id="capster-nama" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nomor HP</label>
          <input id="capster-nohp" class="input-field" placeholder="08xxxxxxxxxx" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Bagi Hasil (%)</label>
          <input id="capster-persentase" type="number" min="0" max="100" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
          <select id="capster-status" class="input-field">
            <option value="Aktif">Aktif</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </div>
        <div class="sm:col-span-4 flex gap-2">
          <button type="submit" id="capster-submit" class="btn-barber">Simpan Capster</button>
          <button type="button" id="capster-cancel" class="btn-ghost hidden border border-slate-200 dark:border-white/10">Batal Edit</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">No. HP</th>
              <th class="px-3 py-2">Bagi Hasil</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="capster-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const form = root.querySelector('#capster-form');
  const idInput = root.querySelector('#capster-id');
  const namaInput = root.querySelector('#capster-nama');
  const noHpInput = root.querySelector('#capster-nohp');
  const persentaseInput = root.querySelector('#capster-persentase');
  const statusInput = root.querySelector('#capster-status');
  const cancelBtn = root.querySelector('#capster-cancel');

  function resetForm() {
    idInput.value = '';
    form.reset();
    cancelBtn.classList.add('hidden');
    root.querySelector('#capster-submit').textContent = 'Simpan Capster';
  }

  async function load() {
    try {
      const { capster } = await apiCall('barberListCapster', { includeInactive: true });
      root.querySelector('#capster-body').innerHTML = capster.map((c) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2 font-medium">${c.Nama}</td>
          <td class="px-3 py-2">${c.NoHP || '-'}</td>
          <td class="px-3 py-2">${c.PersentaseBagiHasil}%</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${c.Status === 'Aktif' ? 'bg-gabungan-100 text-gabungan-700 dark:bg-gabungan-500/10 dark:text-gabungan-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">${c.Status}</span>
          </td>
          <td class="px-3 py-2 text-right">
            <button type="button" data-id="${c.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>
          </td>
        </tr>`).join('');

      root.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const c = capster.find((x) => x.ID === btn.dataset.id);
          idInput.value = c.ID;
          namaInput.value = c.Nama;
          noHpInput.value = c.NoHP;
          persentaseInput.value = c.PersentaseBagiHasil;
          statusInput.value = c.Status;
          cancelBtn.classList.remove('hidden');
          root.querySelector('#capster-submit').textContent = 'Update Capster';
          namaInput.focus();
        });
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar capster.');
    }
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiCall('barberSaveCapster', {
        id: idInput.value || undefined,
        nama: namaInput.value.trim(),
        noHp: noHpInput.value.trim(),
        persentaseBagiHasil: Number(persentaseInput.value),
        status: statusInput.value
      });
      resetForm();
      await load();
      toastSuccess('Capster berhasil disimpan.');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan capster.');
    }
  });

  await load();
}
