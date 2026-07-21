/**
 * pages/pengeluaran/shared.js
 * Input & riwayat pengeluaran, dipakai bersama oleh Barber & Warkop (hanya
 * beda parameter `usaha` dan warna aksen -- lihat barber.js/warkop.js).
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah, todayISODate } from '../../core/format.js';

const KATEGORI_PENGELUARAN = ['Operasional', 'Gaji', 'Sewa', 'Listrik & Air', 'Belanja Stok', 'Maintenance', 'Marketing', 'Lain-lain'];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function renderPengeluaranPage(root, usaha, accentBtnClass) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="pengeluaran-form" class="glass-card grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nominal (Rp)</label>
          <input id="pengeluaran-nominal" type="number" min="1" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Kategori</label>
          <select id="pengeluaran-kategori" required class="input-field">
            <option value="">Pilih kategori...</option>
            ${KATEGORI_PENGELUARAN.map((k) => `<option value="${k}">${k}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tanggal</label>
          <input id="pengeluaran-tanggal" type="date" required class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Foto Nota (opsional)</label>
          <input id="pengeluaran-foto" type="file" accept="image/*" class="input-field !py-1.5" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Keterangan</label>
          <textarea id="pengeluaran-keterangan" rows="2" class="input-field"></textarea>
        </div>
        <div class="sm:col-span-2">
          <button type="submit" id="pengeluaran-submit" class="${accentBtnClass}">Simpan Pengeluaran</button>
        </div>
      </form>

      <div class="glass-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Dari Tanggal</label>
          <input id="filter-start" type="date" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Sampai Tanggal</label>
          <input id="filter-end" type="date" class="input-field" />
        </div>
        <button id="filter-apply" type="button" class="btn-ghost border border-slate-200 dark:border-white/10">Terapkan Filter</button>
      </div>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Tanggal</th>
              <th class="px-3 py-2">Kategori</th>
              <th class="px-3 py-2">Nominal</th>
              <th class="px-3 py-2">Keterangan</th>
              <th class="px-3 py-2">Nota</th>
              <th class="px-3 py-2">Oleh</th>
            </tr>
          </thead>
          <tbody id="pengeluaran-body"></tbody>
        </table>
        <p id="pengeluaran-empty" class="hidden p-6 text-center text-sm text-slate-400">Belum ada pengeluaran pada rentang ini.</p>
      </div>
      <p id="pengeluaran-total" class="text-right text-sm font-semibold text-slate-600 dark:text-slate-300"></p>
    </div>
  `;

  const form = root.querySelector('#pengeluaran-form');
  const tanggalInput = root.querySelector('#pengeluaran-tanggal');
  const startInput = root.querySelector('#filter-start');
  const endInput = root.querySelector('#filter-end');
  tanggalInput.value = todayISODate();
  startInput.value = todayISODate();
  endInput.value = todayISODate();

  async function load() {
    try {
      const result = await apiCall('pengeluaranList', { usaha, startDate: startInput.value, endDate: endInput.value, pageSize: 100 });
      const tbody = root.querySelector('#pengeluaran-body');
      const empty = root.querySelector('#pengeluaran-empty');

      if (result.pengeluaran.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
      } else {
        empty.classList.add('hidden');
        tbody.innerHTML = result.pengeluaran.map((p) => `
          <tr class="border-t border-slate-200/60 dark:border-white/10">
            <td class="px-3 py-2">${p.Tanggal}</td>
            <td class="px-3 py-2">${p.Kategori}</td>
            <td class="px-3 py-2 font-semibold">${formatRupiah(p.Nominal)}</td>
            <td class="px-3 py-2 max-w-[200px] truncate" title="${p.Keterangan || ''}">${p.Keterangan || '-'}</td>
            <td class="px-3 py-2">${p.FotoNotaURL ? `<a href="${p.FotoNotaURL}" target="_blank" rel="noopener" class="text-barber-600 underline dark:text-barber-400">Lihat</a>` : '-'}</td>
            <td class="px-3 py-2">${p.InputOleh}</td>
          </tr>`).join('');
      }
      const total = result.pengeluaran.reduce((s, p) => s + Number(p.Nominal), 0);
      root.querySelector('#pengeluaran-total').textContent = `Total: ${formatRupiah(total)} (${result.pengeluaran.length} transaksi)`;
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data pengeluaran.');
    }
  }

  root.querySelector('#filter-apply').addEventListener('click', load);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = root.querySelector('#pengeluaran-submit');
    submitBtn.disabled = true;
    try {
      const fotoFile = root.querySelector('#pengeluaran-foto').files[0];
      const payload = {
        usaha,
        nominal: Number(root.querySelector('#pengeluaran-nominal').value),
        kategori: root.querySelector('#pengeluaran-kategori').value,
        tanggal: tanggalInput.value,
        keterangan: root.querySelector('#pengeluaran-keterangan').value.trim()
      };
      if (fotoFile) payload.fotoNotaBase64 = await readFileAsDataUrl(fotoFile);

      await apiCall('pengeluaranCreate', payload);
      toastSuccess('Pengeluaran berhasil dicatat.');
      form.reset();
      tanggalInput.value = todayISODate();
      load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal mencatat pengeluaran.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  await load();
}
