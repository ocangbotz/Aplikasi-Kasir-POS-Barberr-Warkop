/**
 * expenses — input & riwayat Pengeluaran, dipakai untuk Barber (Fase 3) dan
 * Warkop (Fase 4) lewat parameter jenisUsaha (satu implementasi, sesuai
 * spesifikasi yang memisahkan SHEET-nya tapi logikanya identik).
 */

import { apiCall } from '../../core/api.js';
import { showToast, escapeHtml } from '../../core/ui.js';
import { formatRupiah, formatDateID } from '../../core/format.js';

const KATEGORI_UMUM = ['Listrik', 'Air', 'Sewa', 'Gaji', 'Bahan Baku', 'Perawatan Alat', 'Lainnya'];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [, base64] = String(reader.result).split(',');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function renderPengeluaran(container, jenisUsaha) {
  const todayYmd = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-6">
      <h1 class="text-xl font-bold">Pengeluaran — ${escapeHtml(jenisUsaha)}</h1>

      <form id="form-pengeluaran" class="glass-card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label class="label-field" for="exp-nominal">Nominal (Rp)</label>
          <input id="exp-nominal" name="nominal" type="number" min="0" step="500" class="input-field" required />
        </div>
        <div>
          <label class="label-field" for="exp-tanggal">Tanggal</label>
          <input id="exp-tanggal" name="tanggal" type="date" class="input-field" value="${todayYmd}" required />
        </div>
        <div>
          <label class="label-field" for="exp-kategori">Kategori</label>
          <select id="exp-kategori" name="kategori" class="input-field">
            ${KATEGORI_UMUM.map((k) => `<option value="${k}">${k}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="label-field" for="exp-foto">Foto Nota (opsional)</label>
          <input id="exp-foto" name="foto" type="file" accept="image/*" capture="environment" class="input-field" />
        </div>
        <div class="sm:col-span-2">
          <label class="label-field" for="exp-keterangan">Keterangan</label>
          <textarea id="exp-keterangan" name="keterangan" rows="2" class="input-field"></textarea>
        </div>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-primary">Simpan Pengeluaran</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold">Riwayat Pengeluaran</h2>
          <select id="exp-filter" class="input-field !w-auto">
            <option value="today">Hari Ini</option>
            <option value="week">Minggu Ini</option>
            <option value="month" selected>Bulan Ini</option>
            <option value="year">Tahun Ini</option>
          </select>
        </div>
        <div id="exp-table-wrap"></div>
      </div>
    </div>
  `;

  const form = container.querySelector('#form-pengeluaran');
  const filterSelect = container.querySelector('#exp-filter');
  const wrap = container.querySelector('#exp-table-wrap');

  async function loadList() {
    wrap.innerHTML = `<div class="p-4 text-sm text-slate-500">Memuat...</div>`;
    try {
      const rows = await apiCall('pengeluaran.view', { jenisUsaha, filterType: filterSelect.value });
      wrap.innerHTML = rows.length
        ? `<table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th class="py-2 pr-3">Tanggal</th><th class="py-2 pr-3">Kategori</th><th class="py-2 pr-3">Keterangan</th><th class="py-2 pr-3">Nominal</th><th class="py-2 pr-3">Nota</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (r) => `
                <tr class="border-b border-slate-100 dark:border-slate-800/60">
                  <td class="py-2 pr-3">${escapeHtml(formatDateID(r.Tanggal))}</td>
                  <td class="py-2 pr-3">${escapeHtml(r.Kategori)}</td>
                  <td class="py-2 pr-3">${escapeHtml(r.Keterangan)}</td>
                  <td class="py-2 pr-3">${formatRupiah(r.Nominal)}</td>
                  <td class="py-2 pr-3">${r.FotoNotaUrl ? `<a class="text-barber-600 underline visited:text-barber-600 dark:text-barber-400 dark:visited:text-barber-400" href="${escapeHtml(r.FotoNotaUrl)}" target="_blank" rel="noopener">Lihat</a>` : '-'}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>`
        : '<p class="p-4 text-center text-sm text-slate-400">Belum ada pengeluaran pada rentang ini.</p>';
    } catch (err) {
      wrap.innerHTML = `<div class="p-4 text-sm text-red-600 dark:text-red-400">Gagal memuat: ${escapeHtml(err.message)}</div>`;
    }
  }

  filterSelect.addEventListener('change', loadList);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';
    try {
      const fileInput = form.querySelector('#exp-foto');
      const payload = {
        jenisUsaha,
        nominal: form.nominal.value,
        tanggal: form.tanggal.value,
        kategori: form.kategori.value,
        keterangan: form.keterangan.value
      };
      if (fileInput.files[0]) {
        payload.fotoBase64 = await readFileAsBase64(fileInput.files[0]);
        payload.fotoMimeType = fileInput.files[0].type;
      }
      await apiCall('pengeluaran.create', payload);
      showToast('Pengeluaran berhasil disimpan', 'success');
      form.reset();
      form.tanggal.value = todayYmd;
      loadList();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Simpan Pengeluaran';
    }
  });

  await loadList();
}
