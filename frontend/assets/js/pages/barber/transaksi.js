/**
 * pages/barber/transaksi.js
 * Layar kasir (POS) untuk transaksi Barber: pilih layanan -> keranjang ->
 * data pelanggan & capster -> bayar -> cetak struk.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah, todayISODate, nowHHMM } from '../../core/format.js';
import { openStrukModal } from './struk.js';

export async function renderBarberTransaksi(root) {
  root.innerHTML = `
    <div class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-5">
      <div class="glass-card p-4 lg:col-span-3">
        <h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">Pilih Layanan</h2>
        <div id="layanan-grid" class="grid grid-cols-2 gap-2 sm:grid-cols-3"></div>
      </div>

      <div class="glass-card flex flex-col p-4 lg:col-span-2">
        <h2 class="mb-3 text-sm font-bold text-slate-900 dark:text-white">Keranjang</h2>
        <div id="cart-list" class="min-h-[60px] flex-1 space-y-1 text-sm"></div>
        <div class="mt-3 space-y-1 border-t border-slate-200/70 pt-3 text-sm dark:border-white/10">
          <div class="flex justify-between"><span>Subtotal</span><span id="subtotal-text">Rp0</span></div>
          <div class="flex items-center justify-between gap-2">
            <span>Diskon</span>
            <input id="diskon" type="number" min="0" value="0" class="input-field w-28 !py-1 text-right" />
          </div>
          <div class="flex justify-between text-base font-bold"><span>Total</span><span id="total-text">Rp0</span></div>
        </div>
      </div>

      <form id="transaksi-form" class="glass-card space-y-3 p-4 lg:col-span-5">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="relative">
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Pelanggan</label>
            <input id="namaPelanggan" name="namaPelanggan" required class="input-field" autocomplete="off" />
            <div id="pelanggan-suggestions" class="glass-card absolute z-20 mt-1 hidden w-full overflow-hidden p-1"></div>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nomor HP</label>
            <input id="noHp" name="noHp" class="input-field" autocomplete="off" placeholder="08xxxxxxxxxx" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Capster</label>
            <select id="capsterId" name="capsterId" required class="input-field"><option value="">Pilih capster...</option></select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
            <select id="status" name="status" class="input-field">
              <option value="Selesai" selected>Selesai</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Tanggal</label>
            <input id="tanggal" name="tanggal" type="date" class="input-field" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Jam</label>
            <input id="jam" name="jam" type="time" class="input-field" />
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan</label>
            <textarea id="catatan" name="catatan" rows="2" class="input-field"></textarea>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Metode Pembayaran</label>
          <div class="flex gap-2">
            <button type="button" data-metode="Cash" class="metode-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">💵 Cash</button>
            <button type="button" data-metode="QRIS" class="metode-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">📱 QRIS</button>
          </div>
        </div>

        <div id="cash-fields" class="hidden grid gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Uang Diterima</label>
            <input id="uangDiterima" type="number" min="0" class="input-field" placeholder="0" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Kembalian</label>
            <p id="kembalian-text" class="input-field flex items-center font-bold text-gabungan-600 dark:text-gabungan-400">Rp0</p>
          </div>
        </div>

        <button type="submit" id="submit-btn" class="btn-barber w-full">Buat Transaksi & Cetak Struk</button>
      </form>
    </div>
  `;

  const state = { layanan: [], capster: [], cart: [], metode: '', pelangganId: '' };

  root.querySelector('#tanggal').value = todayISODate();
  root.querySelector('#jam').value = nowHHMM();

  function renderLayananGrid() {
    const grid = root.querySelector('#layanan-grid');
    grid.innerHTML = state.layanan.map((l) => {
      const inCart = state.cart.find((c) => c.layananId === l.ID);
      return `
        <button type="button" data-id="${l.ID}" class="layanan-card rounded-xl border p-3 text-left text-xs transition
          ${inCart ? 'border-barber-500 bg-barber-50 dark:bg-barber-500/10' : 'border-slate-200 hover:border-barber-300 dark:border-white/10'}">
          <p class="font-semibold text-slate-900 dark:text-white">${l.Nama}</p>
          <p class="mt-1 text-slate-500 dark:text-slate-400">${formatRupiah(l.Harga)}</p>
          ${inCart ? `<p class="mt-1 text-[10px] text-barber-600 dark:text-barber-300">di keranjang: ${inCart.qty}</p>` : ''}
        </button>`;
    }).join('') || '<p class="col-span-full text-sm text-slate-400">Belum ada layanan aktif. Tambahkan lewat menu Layanan Barber.</p>';

    grid.querySelectorAll('.layanan-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const existing = state.cart.find((c) => c.layananId === id);
        if (existing) {
          existing.qty += 1;
        } else {
          const l = state.layanan.find((x) => x.ID === id);
          state.cart.push({ layananId: l.ID, nama: l.Nama, harga: l.Harga, qty: 1 });
        }
        renderLayananGrid();
        renderCart();
      });
    });
  }

  function renderCart() {
    const list = root.querySelector('#cart-list');
    if (state.cart.length === 0) {
      list.innerHTML = '<p class="text-slate-400">Belum ada layanan dipilih.</p>';
    } else {
      list.innerHTML = state.cart.map((c, i) => `
        <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-900/5 px-2 py-1.5 dark:bg-white/5">
          <span class="flex-1">${c.nama}</span>
          <div class="flex items-center gap-1.5">
            <button type="button" data-idx="${i}" class="qty-minus rounded bg-white px-1.5 dark:bg-slate-800">-</button>
            <span class="w-5 text-center">${c.qty}</span>
            <button type="button" data-idx="${i}" class="qty-plus rounded bg-white px-1.5 dark:bg-slate-800">+</button>
          </div>
          <span class="w-20 text-right">${formatRupiah(c.harga * c.qty)}</span>
          <button type="button" data-idx="${i}" class="remove-item text-red-500">✕</button>
        </div>`).join('');

      list.querySelectorAll('.qty-plus').forEach((btn) => btn.addEventListener('click', () => {
        state.cart[Number(btn.dataset.idx)].qty += 1;
        renderLayananGrid();
        renderCart();
      }));
      list.querySelectorAll('.qty-minus').forEach((btn) => btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.cart[idx].qty -= 1;
        if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
        renderLayananGrid();
        renderCart();
      }));
      list.querySelectorAll('.remove-item').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.cart.splice(Number(btn.dataset.idx), 1);
          renderLayananGrid();
          renderCart();
        });
      });
    }
    updateTotals();
  }

  function currentTotal() {
    const subtotal = state.cart.reduce((sum, c) => sum + c.harga * c.qty, 0);
    const diskon = Math.min(Math.max(Number(root.querySelector('#diskon').value) || 0, 0), subtotal);
    return subtotal - diskon;
  }

  function updateKembalian() {
    const diterima = Number(root.querySelector('#uangDiterima').value) || 0;
    const kembalian = Math.max(diterima - currentTotal(), 0);
    root.querySelector('#kembalian-text').textContent = formatRupiah(kembalian);
  }
  root.querySelector('#uangDiterima').addEventListener('input', updateKembalian);

  function updateTotals() {
    const subtotal = state.cart.reduce((sum, c) => sum + c.harga * c.qty, 0);
    const diskon = Math.min(Math.max(Number(root.querySelector('#diskon').value) || 0, 0), subtotal);
    root.querySelector('#subtotal-text').textContent = formatRupiah(subtotal);
    root.querySelector('#total-text').textContent = formatRupiah(subtotal - diskon);
    updateKembalian();
  }
  root.querySelector('#diskon').addEventListener('input', updateTotals);

  root.querySelectorAll('.metode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.metode = btn.dataset.metode;
      root.querySelectorAll('.metode-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      root.querySelector('#cash-fields').classList.toggle('hidden', state.metode !== 'Cash');
      updateKembalian();
    });
  });

  // Autocomplete pencarian pelanggan
  const namaInput = root.querySelector('#namaPelanggan');
  const noHpInput = root.querySelector('#noHp');
  const suggestBox = root.querySelector('#pelanggan-suggestions');
  let searchTimer = null;
  namaInput.addEventListener('input', () => {
    state.pelangganId = '';
    clearTimeout(searchTimer);
    const query = namaInput.value.trim();
    if (query.length < 2) { suggestBox.classList.add('hidden'); return; }
    searchTimer = setTimeout(async () => {
      try {
        const { pelanggan } = await apiCall('searchPelanggan', { query });
        if (pelanggan.length === 0) { suggestBox.classList.add('hidden'); return; }
        suggestBox.innerHTML = pelanggan.map((p) => `
          <button type="button" data-id="${p.ID}" data-nama="${p.Nama}" data-nohp="${p.NoHP}"
            class="suggestion-item nav-link w-full !justify-start">
            <span>${p.Nama}</span><span class="ml-auto text-xs text-slate-400">${p.NoHP}</span>
          </button>`).join('');
        suggestBox.classList.remove('hidden');
        suggestBox.querySelectorAll('.suggestion-item').forEach((item) => {
          item.addEventListener('click', () => {
            namaInput.value = item.dataset.nama;
            noHpInput.value = item.dataset.nohp;
            state.pelangganId = item.dataset.id;
            suggestBox.classList.add('hidden');
          });
        });
      } catch {
        suggestBox.classList.add('hidden');
      }
    }, 250);
  });
  document.addEventListener('click', (e) => {
    if (!suggestBox.contains(e.target) && e.target !== namaInput) suggestBox.classList.add('hidden');
  });

  try {
    const [layananRes, capsterRes] = await Promise.all([
      apiCall('barberListLayanan', {}),
      apiCall('barberListCapster', {})
    ]);
    state.layanan = layananRes.layanan;
    state.capster = capsterRes.capster;
    renderLayananGrid();
    renderCart();

    const capsterSelect = root.querySelector('#capsterId');
    state.capster.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.ID;
      opt.textContent = c.Nama;
      capsterSelect.appendChild(opt);
    });
  } catch (err) {
    toastError(err instanceof ApiError ? err.message : 'Gagal memuat data layanan/capster.');
  }

  root.querySelector('#transaksi-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.cart.length === 0) return toastError('Pilih minimal 1 layanan.');
    if (!state.metode) return toastError('Pilih metode pembayaran.');

    const uangDiterima = Number(root.querySelector('#uangDiterima').value) || 0;
    if (state.metode === 'Cash' && uangDiterima < currentTotal()) {
      return toastError('Uang diterima kurang dari total belanja.');
    }

    const submitBtn = root.querySelector('#submit-btn');
    submitBtn.disabled = true;
    try {
      const { transaksi } = await apiCall('barberCreateTransaksi', {
        namaPelanggan: namaInput.value.trim(),
        noHp: noHpInput.value.trim(),
        capsterId: root.querySelector('#capsterId').value,
        layanan: state.cart,
        diskon: Number(root.querySelector('#diskon').value) || 0,
        catatan: root.querySelector('#catatan').value.trim(),
        status: root.querySelector('#status').value,
        tanggal: root.querySelector('#tanggal').value,
        jam: root.querySelector('#jam').value,
        metodePembayaran: state.metode,
        uangDiterima
      });
      toastSuccess(`Transaksi ${transaksi.NomorTransaksi} berhasil dibuat.`);
      await openStrukModal(transaksi);

      state.cart = [];
      state.metode = '';
      namaInput.value = '';
      noHpInput.value = '';
      root.querySelector('#catatan').value = '';
      root.querySelector('#diskon').value = 0;
      root.querySelector('#uangDiterima').value = '';
      root.querySelector('#cash-fields').classList.add('hidden');
      root.querySelector('#kembalian-text').textContent = 'Rp0';
      root.querySelectorAll('.metode-btn').forEach((b) => b.classList.remove('selected'));
      renderLayananGrid();
      renderCart();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal membuat transaksi.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
