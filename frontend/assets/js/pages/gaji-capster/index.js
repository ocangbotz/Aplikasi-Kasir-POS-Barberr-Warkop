/**
 * pages/gaji-capster/index.js
 * Gaji Capster: pilih capster + periode -> Total Kepala & Pendapatan
 * dihitung otomatis dari transaksi, lalu isi Bonus/Potongan/Keterlambatan
 * untuk mendapatkan Total Gaji.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';

function currentPeriode() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function renderGajiCapster(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="gaji-form" class="glass-card grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Capster</label>
          <select id="capster-select" required class="input-field"><option value="">Pilih capster...</option></select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Periode</label>
          <input id="periode" type="month" required class="input-field" />
        </div>

        <div id="preview-area" class="hidden sm:col-span-2 grid grid-cols-3 gap-3">
          <div class="glass-card p-3"><p class="text-xs text-slate-500 dark:text-slate-400">Total Kepala</p><p id="preview-kepala" class="text-lg font-bold text-slate-900 dark:text-white"></p></div>
          <div class="glass-card p-3"><p class="text-xs text-slate-500 dark:text-slate-400">Pendapatan</p><p id="preview-pendapatan" class="text-lg font-bold text-slate-900 dark:text-white"></p></div>
          <div class="glass-card p-3"><p class="text-xs text-slate-500 dark:text-slate-400">Bagi Hasil</p><p id="preview-bagihasil" class="text-lg font-bold text-gabungan-600 dark:text-gabungan-400"></p></div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Bonus (Rp)</label>
          <input id="bonus" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Potongan (Rp)</label>
          <input id="potongan" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Keterlambatan (Rp)</label>
          <input id="keterlambatan" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan</label>
          <input id="catatan" class="input-field" />
        </div>

        <div class="sm:col-span-2 flex items-center justify-between">
          <p class="text-sm">Total Gaji: <span id="total-gaji-preview" class="text-lg font-bold text-slate-900 dark:text-white">Rp0</span></p>
          <button type="submit" id="gaji-submit" class="btn-barber" disabled>Simpan Gaji</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Periode</th>
              <th class="px-3 py-2">Capster</th>
              <th class="px-3 py-2">Kepala</th>
              <th class="px-3 py-2">Pendapatan</th>
              <th class="px-3 py-2">Bagi Hasil</th>
              <th class="px-3 py-2">Total Gaji</th>
            </tr>
          </thead>
          <tbody id="gaji-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const periodeInput = root.querySelector('#periode');
  periodeInput.value = currentPeriode();

  let preview = null;

  function updateTotalPreview() {
    if (!preview) return;
    const bonus = Number(root.querySelector('#bonus').value) || 0;
    const potongan = Number(root.querySelector('#potongan').value) || 0;
    const keterlambatan = Number(root.querySelector('#keterlambatan').value) || 0;
    const total = preview.bagiHasilAmount + bonus - potongan - keterlambatan;
    root.querySelector('#total-gaji-preview').textContent = formatRupiah(total);
  }
  ['bonus', 'potongan', 'keterlambatan'].forEach((id) => root.querySelector('#' + id).addEventListener('input', updateTotalPreview));

  async function loadPreview() {
    const capsterId = root.querySelector('#capster-select').value;
    const periode = periodeInput.value;
    const submitBtn = root.querySelector('#gaji-submit');
    if (!capsterId || !periode) {
      root.querySelector('#preview-area').classList.add('hidden');
      submitBtn.disabled = true;
      return;
    }
    try {
      preview = await apiCall('gajiCapsterPreview', { capsterId, periode });
      root.querySelector('#preview-area').classList.remove('hidden');
      root.querySelector('#preview-kepala').textContent = preview.totalKepala;
      root.querySelector('#preview-pendapatan').textContent = formatRupiah(preview.pendapatan);
      root.querySelector('#preview-bagihasil').textContent = formatRupiah(preview.bagiHasilAmount) + ` (${preview.persentaseBagiHasil}%)`;
      submitBtn.disabled = false;
      updateTotalPreview();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat pratinjau gaji.');
    }
  }

  root.querySelector('#capster-select').addEventListener('change', loadPreview);
  periodeInput.addEventListener('change', loadPreview);

  async function loadHistory() {
    try {
      const { gaji } = await apiCall('gajiCapsterList', {});
      root.querySelector('#gaji-body').innerHTML = gaji.map((g) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2">${g.Periode}</td>
          <td class="px-3 py-2 font-medium">${g.NamaCapster}</td>
          <td class="px-3 py-2">${g.TotalKepala}</td>
          <td class="px-3 py-2">${formatRupiah(g.Pendapatan)}</td>
          <td class="px-3 py-2">${formatRupiah(g.BagiHasilAmount)}</td>
          <td class="px-3 py-2 font-semibold text-gabungan-600 dark:text-gabungan-400">${formatRupiah(g.TotalGaji)}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="p-6 text-center text-sm text-slate-400">Belum ada data gaji.</td></tr>';
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat riwayat gaji.');
    }
  }

  root.querySelector('#gaji-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiCall('gajiCapsterSave', {
        capsterId: root.querySelector('#capster-select').value,
        periode: periodeInput.value,
        bonus: Number(root.querySelector('#bonus').value) || 0,
        potongan: Number(root.querySelector('#potongan').value) || 0,
        keterlambatan: Number(root.querySelector('#keterlambatan').value) || 0,
        catatan: root.querySelector('#catatan').value.trim()
      });
      toastSuccess('Gaji capster berhasil disimpan.');
      loadHistory();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan gaji.');
    }
  });

  try {
    const { capster } = await apiCall('barberListCapster', {});
    const select = root.querySelector('#capster-select');
    capster.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.ID;
      opt.textContent = c.Nama;
      select.appendChild(opt);
    });
  } catch (err) {
    toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar capster.');
  }

  await loadHistory();
}
