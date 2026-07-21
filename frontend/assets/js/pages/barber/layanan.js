/**
 * pages/barber/layanan.js
 * Kelola daftar layanan Barber (Owner/Admin). Layanan yang dinonaktifkan
 * tidak hilang dari histori transaksi lama -- hanya disembunyikan dari POS.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';

export async function renderBarberLayanan(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="layanan-form" class="glass-card grid gap-3 p-4 sm:grid-cols-4">
        <input type="hidden" id="layanan-id" />
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Layanan</label>
          <input id="layanan-nama" required class="input-field" placeholder="Potong Rambut" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Harga (Rp)</label>
          <input id="layanan-harga" type="number" min="1" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Durasi (menit)</label>
          <input id="layanan-durasi" type="number" min="0" class="input-field" />
        </div>
        <div class="sm:col-span-4 flex gap-2">
          <button type="submit" id="layanan-submit" class="btn-barber">Simpan Layanan</button>
          <button type="button" id="layanan-cancel" class="btn-ghost hidden border border-slate-200 dark:border-white/10">Batal Edit</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">Harga</th>
              <th class="px-3 py-2">Durasi</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="layanan-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const form = root.querySelector('#layanan-form');
  const idInput = root.querySelector('#layanan-id');
  const namaInput = root.querySelector('#layanan-nama');
  const hargaInput = root.querySelector('#layanan-harga');
  const durasiInput = root.querySelector('#layanan-durasi');
  const cancelBtn = root.querySelector('#layanan-cancel');

  function resetForm() {
    idInput.value = '';
    form.reset();
    cancelBtn.classList.add('hidden');
    root.querySelector('#layanan-submit').textContent = 'Simpan Layanan';
  }

  async function load() {
    try {
      const { layanan } = await apiCall('barberListLayanan', { includeInactive: true });
      root.querySelector('#layanan-body').innerHTML = layanan.map((l) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2 font-medium">${l.Nama}</td>
          <td class="px-3 py-2">${formatRupiah(l.Harga)}</td>
          <td class="px-3 py-2">${l.Durasi || 0} menit</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${l.StatusAktif ? 'bg-gabungan-100 text-gabungan-700 dark:bg-gabungan-500/10 dark:text-gabungan-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">
              ${l.StatusAktif ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td class="px-3 py-2 text-right">
            <button type="button" data-id="${l.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>
            <button type="button" data-id="${l.ID}" data-status="${!l.StatusAktif}" class="toggle-btn btn-ghost !px-2 !py-1 text-xs">${l.StatusAktif ? '🚫 Nonaktifkan' : '✅ Aktifkan'}</button>
          </td>
        </tr>`).join('');

      root.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const l = layanan.find((x) => x.ID === btn.dataset.id);
          idInput.value = l.ID;
          namaInput.value = l.Nama;
          hargaInput.value = l.Harga;
          durasiInput.value = l.Durasi;
          cancelBtn.classList.remove('hidden');
          root.querySelector('#layanan-submit').textContent = 'Update Layanan';
          namaInput.focus();
        });
      });
      root.querySelectorAll('.toggle-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const l = layanan.find((x) => x.ID === btn.dataset.id);
          try {
            await apiCall('barberSaveLayanan', { id: l.ID, nama: l.Nama, harga: l.Harga, durasi: l.Durasi, statusAktif: btn.dataset.status === 'true' });
            toastSuccess('Status layanan diperbarui.');
            load();
          } catch (err) {
            toastError(err instanceof ApiError ? err.message : 'Gagal mengubah status layanan.');
          }
        });
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar layanan.');
    }
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiCall('barberSaveLayanan', {
        id: idInput.value || undefined,
        nama: namaInput.value.trim(),
        harga: Number(hargaInput.value),
        durasi: Number(durasiInput.value) || 0
      });
      toastSuccess('Layanan berhasil disimpan.');
      resetForm();
      load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan layanan.');
    }
  });

  await load();
}
