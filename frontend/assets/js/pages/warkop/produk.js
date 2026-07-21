/**
 * pages/warkop/produk.js
 * Kelola menu Warkop (Owner/Admin). Margin dihitung otomatis dari Modal &
 * Harga Jual. Stok awal hanya diisi saat membuat menu baru -- perubahan stok
 * selanjutnya terjadi otomatis lewat transaksi (atau penyesuaian Inventory di Fase 5).
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';

export async function renderWarkopProduk(root) {
  root.innerHTML = `
    <div class="mx-auto max-w-3xl space-y-4">
      <form id="produk-form" class="glass-card grid gap-3 p-4 sm:grid-cols-4">
        <input type="hidden" id="produk-id" />
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Menu</label>
          <input id="produk-nama" required class="input-field" placeholder="Kopi Hitam" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Kategori</label>
          <input id="produk-kategori" required class="input-field" placeholder="Minuman / Makanan / Snack" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Modal (Rp)</label>
          <input id="produk-modal" type="number" min="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Harga Jual (Rp)</label>
          <input id="produk-harga" type="number" min="1" required class="input-field" />
        </div>
        <div id="produk-stok-wrap">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Stok Awal</label>
          <input id="produk-stok" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Stok Minimum</label>
          <input id="produk-stok-minimum" type="number" min="0" value="5" class="input-field" />
        </div>
        <div class="sm:col-span-4 flex gap-2">
          <button type="submit" id="produk-submit" class="btn-warkop">Simpan Menu</button>
          <button type="button" id="produk-cancel" class="btn-ghost hidden border border-slate-200 dark:border-white/10">Batal Edit</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">Kategori</th>
              <th class="px-3 py-2">Harga Jual</th>
              <th class="px-3 py-2">Margin</th>
              <th class="px-3 py-2">Stok</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="produk-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const form = root.querySelector('#produk-form');
  const idInput = root.querySelector('#produk-id');
  const namaInput = root.querySelector('#produk-nama');
  const kategoriInput = root.querySelector('#produk-kategori');
  const modalInput = root.querySelector('#produk-modal');
  const hargaInput = root.querySelector('#produk-harga');
  const stokInput = root.querySelector('#produk-stok');
  const stokWrap = root.querySelector('#produk-stok-wrap');
  const stokMinInput = root.querySelector('#produk-stok-minimum');
  const cancelBtn = root.querySelector('#produk-cancel');

  function resetForm() {
    idInput.value = '';
    form.reset();
    stokInput.value = 0;
    stokMinInput.value = 5;
    stokWrap.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
    root.querySelector('#produk-submit').textContent = 'Simpan Menu';
  }

  async function load() {
    try {
      const { produk } = await apiCall('warkopListProduk', { includeInactive: true });
      root.querySelector('#produk-body').innerHTML = produk.map((p) => `
        <tr class="border-t border-slate-200/60 dark:border-white/10">
          <td class="px-3 py-2 font-medium">${p.Nama}</td>
          <td class="px-3 py-2">${p.Kategori}</td>
          <td class="px-3 py-2">${formatRupiah(p.HargaJual)}</td>
          <td class="px-3 py-2">${formatRupiah(p.Margin)}</td>
          <td class="px-3 py-2 ${Number(p.Stok) <= Number(p.StokMinimum) ? 'font-bold text-red-600 dark:text-red-400' : ''}">${p.Stok}</td>
          <td class="px-3 py-2">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${p.StatusAktif ? 'bg-gabungan-100 text-gabungan-700 dark:bg-gabungan-500/10 dark:text-gabungan-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400'}">
              ${p.StatusAktif ? 'Aktif' : 'Nonaktif'}
            </span>
          </td>
          <td class="px-3 py-2 text-right">
            <button type="button" data-id="${p.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>
            <button type="button" data-id="${p.ID}" data-status="${!p.StatusAktif}" class="toggle-btn btn-ghost !px-2 !py-1 text-xs">${p.StatusAktif ? '🚫 Nonaktifkan' : '✅ Aktifkan'}</button>
          </td>
        </tr>`).join('');

      root.querySelectorAll('.edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const p = produk.find((x) => x.ID === btn.dataset.id);
          idInput.value = p.ID;
          namaInput.value = p.Nama;
          kategoriInput.value = p.Kategori;
          modalInput.value = p.Modal;
          hargaInput.value = p.HargaJual;
          stokMinInput.value = p.StokMinimum;
          stokWrap.classList.add('hidden');
          cancelBtn.classList.remove('hidden');
          root.querySelector('#produk-submit').textContent = 'Update Menu';
          namaInput.focus();
        });
      });
      root.querySelectorAll('.toggle-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const p = produk.find((x) => x.ID === btn.dataset.id);
          try {
            await apiCall('warkopSaveProduk', {
              id: p.ID, nama: p.Nama, kategori: p.Kategori, modal: p.Modal, hargaJual: p.HargaJual,
              stokMinimum: p.StokMinimum, statusAktif: btn.dataset.status === 'true'
            });
            toastSuccess('Status menu diperbarui.');
            load();
          } catch (err) {
            toastError(err instanceof ApiError ? err.message : 'Gagal mengubah status menu.');
          }
        });
      });
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar menu.');
    }
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: idInput.value || undefined,
        nama: namaInput.value.trim(),
        kategori: kategoriInput.value.trim(),
        modal: Number(modalInput.value) || 0,
        hargaJual: Number(hargaInput.value),
        stokMinimum: Number(stokMinInput.value) || 0
      };
      if (!idInput.value) payload.stok = Number(stokInput.value) || 0;

      await apiCall('warkopSaveProduk', payload);
      toastSuccess('Menu berhasil disimpan.');
      resetForm();
      load();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan menu.');
    }
  });

  await load();
}
