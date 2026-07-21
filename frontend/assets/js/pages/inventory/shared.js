/**
 * pages/inventory/shared.js
 * Implementasi bersama untuk Inventory Barber & Inventory Warkop -- hanya
 * berbeda pada parameter `usaha` dan warna aksen. Lihat barber.js/warkop.js
 * untuk wrapper tipis masing-masing.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';

const ADJUSTMENT_REASONS = ['Restock', 'Pemakaian', 'Rusak/Hilang', 'Koreksi Stok Opname'];

export async function renderInventoryPage(root, usaha, accentBtnClass) {
  root.innerHTML = `
    <div class="mx-auto max-w-4xl space-y-4">
      <form id="item-form" class="glass-card grid gap-3 p-4 sm:grid-cols-4">
        <input type="hidden" id="item-id" />
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Item</label>
          <input id="item-nama" required class="input-field" placeholder="Gula Pasir" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Kategori</label>
          <input id="item-kategori" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Satuan</label>
          <input id="item-satuan" required class="input-field" placeholder="kg / pcs / liter" />
        </div>
        <div id="item-stok-wrap">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Stok Awal</label>
          <input id="item-stok" type="number" min="0" value="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Stok Minimum</label>
          <input id="item-stok-minimum" type="number" min="0" value="5" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Harga Beli (Rp)</label>
          <input id="item-harga-beli" type="number" min="0" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Supplier</label>
          <input id="item-supplier" class="input-field" />
        </div>
        <div class="sm:col-span-4 flex gap-2">
          <button type="submit" id="item-submit" class="${accentBtnClass}">Simpan Item</button>
          <button type="button" id="item-cancel" class="btn-ghost hidden border border-slate-200 dark:border-white/10">Batal Edit</button>
        </div>
      </form>

      <div class="glass-card overflow-x-auto p-2">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr class="text-xs uppercase text-slate-400">
              <th class="px-3 py-2">Nama</th>
              <th class="px-3 py-2">Kategori</th>
              <th class="px-3 py-2">Stok</th>
              <th class="px-3 py-2">Harga Beli</th>
              <th class="px-3 py-2">Supplier</th>
              <th class="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody id="item-body"></tbody>
        </table>
        <p id="item-empty" class="hidden p-6 text-center text-sm text-slate-400">Belum ada item inventory.</p>
      </div>
    </div>
  `;

  const form = root.querySelector('#item-form');
  const idInput = root.querySelector('#item-id');
  const namaInput = root.querySelector('#item-nama');
  const kategoriInput = root.querySelector('#item-kategori');
  const satuanInput = root.querySelector('#item-satuan');
  const stokInput = root.querySelector('#item-stok');
  const stokWrap = root.querySelector('#item-stok-wrap');
  const stokMinInput = root.querySelector('#item-stok-minimum');
  const hargaBeliInput = root.querySelector('#item-harga-beli');
  const supplierInput = root.querySelector('#item-supplier');
  const cancelBtn = root.querySelector('#item-cancel');

  function resetForm() {
    idInput.value = '';
    form.reset();
    stokInput.value = 0;
    stokMinInput.value = 5;
    stokWrap.classList.remove('hidden');
    cancelBtn.classList.add('hidden');
    root.querySelector('#item-submit').textContent = 'Simpan Item';
  }

  async function load() {
    try {
      const { items } = await apiCall('inventoryList', { usaha });
      const tbody = root.querySelector('#item-body');
      const empty = root.querySelector('#item-empty');

      if (items.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
      } else {
        empty.classList.add('hidden');
        tbody.innerHTML = items.map((i) => {
          const low = Number(i.Stok) <= Number(i.StokMinimum);
          return `
          <tr class="border-t border-slate-200/60 dark:border-white/10">
            <td class="px-3 py-2 font-medium">${i.NamaItem} ${low ? '<span title="Stok hampir habis">⚠️</span>' : ''}</td>
            <td class="px-3 py-2">${i.Kategori || '-'}</td>
            <td class="px-3 py-2 ${low ? 'font-bold text-red-600 dark:text-red-400' : ''}">${i.Stok} ${i.Satuan}</td>
            <td class="px-3 py-2">${formatRupiah(i.HargaBeli)}</td>
            <td class="px-3 py-2">${i.Supplier || '-'}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <button type="button" data-id="${i.ID}" class="edit-btn btn-ghost !px-2 !py-1 text-xs">✏️ Edit</button>
              <button type="button" data-id="${i.ID}" class="adjust-btn btn-ghost !px-2 !py-1 text-xs">🔧 Sesuaikan</button>
            </td>
          </tr>`;
        }).join('');

        root.querySelectorAll('.edit-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const i = items.find((x) => x.ID === btn.dataset.id);
            idInput.value = i.ID;
            namaInput.value = i.NamaItem;
            kategoriInput.value = i.Kategori;
            satuanInput.value = i.Satuan;
            stokMinInput.value = i.StokMinimum;
            hargaBeliInput.value = i.HargaBeli;
            supplierInput.value = i.Supplier;
            stokWrap.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
            root.querySelector('#item-submit').textContent = 'Update Item';
            namaInput.focus();
          });
        });
        root.querySelectorAll('.adjust-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const i = items.find((x) => x.ID === btn.dataset.id);
            openAdjustModal(i, load);
          });
        });
      }
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal memuat data inventory.');
    }
  }

  function openAdjustModal(item, onDone) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4';
    overlay.innerHTML = `
      <div class="glass-card w-full max-w-sm p-5">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">Sesuaikan Stok: ${item.NamaItem}</h3>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Stok saat ini: ${item.Stok} ${item.Satuan}</p>
        <form id="adjust-form" class="mt-4 space-y-3">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Jenis Penyesuaian</label>
            <div class="flex gap-2">
              <button type="button" data-arah="1" class="arah-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">➕ Tambah</button>
              <button type="button" data-arah="-1" class="arah-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">➖ Kurangi</button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Jumlah</label>
            <input id="adjust-jumlah" type="number" min="1" required class="input-field" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Alasan</label>
            <select id="adjust-alasan" required class="input-field">
              <option value="">Pilih alasan...</option>
              ${ADJUSTMENT_REASONS.map((r) => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan (opsional)</label>
            <input id="adjust-catatan" class="input-field" />
          </div>
          <div class="flex gap-2 pt-1">
            <button type="button" id="adjust-cancel" class="btn-ghost flex-1 border border-slate-200 dark:border-white/10">Batal</button>
            <button type="submit" id="adjust-submit" class="${accentBtnClass} flex-1">Simpan</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    let arah = 1;
    overlay.querySelectorAll('.arah-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        arah = Number(btn.dataset.arah);
        overlay.querySelectorAll('.arah-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
    overlay.querySelector('#adjust-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#adjust-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const jumlah = Number(overlay.querySelector('#adjust-jumlah').value);
      const alasan = overlay.querySelector('#adjust-alasan').value;
      const catatan = overlay.querySelector('#adjust-catatan').value.trim();
      if (!jumlah || jumlah <= 0) return toastError('Jumlah harus lebih besar dari 0.');
      if (!alasan) return toastError('Pilih alasan penyesuaian.');
      try {
        await apiCall('inventoryAdjustStock', { usaha, id: item.ID, delta: jumlah * arah, alasan, catatan });
        overlay.remove();
        await onDone();
        toastSuccess('Stok berhasil disesuaikan.');
      } catch (err) {
        toastError(err instanceof ApiError ? err.message : 'Gagal menyesuaikan stok.');
      }
    });
  }

  cancelBtn.addEventListener('click', resetForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        id: idInput.value || undefined,
        usaha,
        namaItem: namaInput.value.trim(),
        kategori: kategoriInput.value.trim(),
        satuan: satuanInput.value.trim(),
        stokMinimum: Number(stokMinInput.value) || 0,
        hargaBeli: Number(hargaBeliInput.value) || 0,
        supplier: supplierInput.value.trim()
      };
      if (!idInput.value) payload.stok = Number(stokInput.value) || 0;

      await apiCall('inventorySaveItem', payload);
      resetForm();
      await load();
      toastSuccess('Item inventory berhasil disimpan.');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal menyimpan item inventory.');
    }
  });

  await load();
}
