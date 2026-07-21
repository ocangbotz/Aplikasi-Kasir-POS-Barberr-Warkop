/**
 * pages/warkop/pesanan.js
 * Layar kasir (POS) Warkop: pilih menu (dengan qty) -> keranjang -> diskon ->
 * Cash/QRIS atau Split Bill -> cetak struk. Stok berkurang otomatis di backend.
 */
import { apiCall, ApiError } from '../../core/api.js';
import { toastError, toastSuccess } from '../../core/toast.js';
import { formatRupiah } from '../../core/format.js';
import { openWarkopStrukModal } from './struk.js';

export async function renderWarkopPesanan(root) {
  root.innerHTML = `
    <div class="mx-auto grid max-w-5xl gap-4 lg:grid-cols-5">
      <div class="glass-card p-4 lg:col-span-3">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-bold text-slate-900 dark:text-white">Pilih Menu</h2>
        </div>
        <div id="kategori-chips" class="mb-3 flex flex-wrap gap-1.5"></div>
        <div id="produk-grid" class="grid grid-cols-2 gap-2 sm:grid-cols-3"></div>
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

      <form id="pesanan-form" class="glass-card space-y-3 p-4 lg:col-span-5">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nama Pelanggan (opsional)</label>
            <input id="namaPelanggan" class="input-field" autocomplete="off" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Nomor HP (opsional)</label>
            <input id="noHp" class="input-field" autocomplete="off" placeholder="08xxxxxxxxxx" />
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Catatan</label>
            <textarea id="catatan" rows="2" class="input-field"></textarea>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <label class="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Metode Pembayaran</label>
          <label class="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input type="checkbox" id="split-toggle" class="h-4 w-4 rounded" /> Split Bill
          </label>
        </div>

        <div id="single-payment" class="flex gap-2">
          <button type="button" data-metode="Cash" class="metode-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">💵 Cash</button>
          <button type="button" data-metode="QRIS" class="metode-btn option-btn btn-ghost flex-1 border border-slate-200 dark:border-white/10">📱 QRIS</button>
        </div>

        <div id="split-payment" class="hidden space-y-2">
          <div id="split-rows" class="space-y-2"></div>
          <button type="button" id="add-split-row" class="btn-ghost border border-slate-200 text-xs dark:border-white/10">+ Tambah Pembayaran</button>
          <p id="split-remaining" class="text-xs font-semibold text-slate-500 dark:text-slate-400"></p>
        </div>

        <button type="submit" id="submit-btn" class="btn-warkop w-full">Buat Transaksi & Cetak Struk</button>
      </form>
    </div>
  `;

  const state = { produk: [], cart: [], metode: '', splitMode: false, splitRows: [], activeKategori: 'Semua' };

  function grandTotal() {
    const subtotal = state.cart.reduce((sum, c) => sum + c.harga * c.qty, 0);
    const diskon = Math.min(Math.max(Number(root.querySelector('#diskon').value) || 0, 0), subtotal);
    return { subtotal, diskon, total: subtotal - diskon };
  }

  function renderChips() {
    const kategoris = ['Semua', ...new Set(state.produk.map((p) => p.Kategori))];
    root.querySelector('#kategori-chips').innerHTML = kategoris.map((k) => `
      <button type="button" data-kategori="${k}" class="chip-btn rounded-full border px-3 py-1 text-xs font-medium transition
        ${k === state.activeKategori ? 'border-warkop-600 bg-warkop-600 text-white' : 'border-slate-200 text-slate-600 hover:border-warkop-300 dark:border-white/10 dark:text-slate-300'}">
        ${k}
      </button>`).join('');
    root.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeKategori = btn.dataset.kategori;
        renderChips();
        renderProdukGrid();
      });
    });
  }

  function renderProdukGrid() {
    const grid = root.querySelector('#produk-grid');
    const list = state.activeKategori === 'Semua' ? state.produk : state.produk.filter((p) => p.Kategori === state.activeKategori);
    grid.innerHTML = list.map((p) => {
      const inCart = state.cart.find((c) => c.produkId === p.ID);
      const habis = Number(p.Stok) <= 0;
      return `
        <button type="button" data-id="${p.ID}" ${habis ? 'disabled' : ''} class="produk-card rounded-xl border p-3 text-left text-xs transition disabled:opacity-40
          ${inCart ? 'border-warkop-500 bg-warkop-50 dark:bg-warkop-500/10' : 'border-slate-200 hover:border-warkop-300 dark:border-white/10'}">
          <p class="font-semibold text-slate-900 dark:text-white">${p.Nama}</p>
          <p class="mt-1 text-slate-500 dark:text-slate-400">${formatRupiah(p.HargaJual)}</p>
          <p class="mt-1 text-[10px] ${habis ? 'text-red-500' : 'text-slate-400'}">${habis ? 'Stok habis' : 'Stok: ' + p.Stok}${inCart ? ' · di keranjang: ' + inCart.qty : ''}</p>
        </button>`;
    }).join('') || '<p class="col-span-full text-sm text-slate-400">Belum ada menu aktif. Tambahkan lewat menu Menu Warkop.</p>';

    grid.querySelectorAll('.produk-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = state.produk.find((x) => x.ID === btn.dataset.id);
        const existing = state.cart.find((c) => c.produkId === p.ID);
        if (existing) {
          if (existing.qty < Number(p.Stok)) existing.qty += 1;
        } else {
          state.cart.push({ produkId: p.ID, nama: p.Nama, harga: p.HargaJual, stok: p.Stok, qty: 1 });
        }
        renderProdukGrid();
        renderCart();
      });
    });
  }

  function renderCart() {
    const list = root.querySelector('#cart-list');
    if (state.cart.length === 0) {
      list.innerHTML = '<p class="text-slate-400">Belum ada menu dipilih.</p>';
    } else {
      list.innerHTML = state.cart.map((c, i) => `
        <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-900/5 px-2 py-1.5 dark:bg-white/5">
          <span class="flex-1">${c.nama}</span>
          <div class="flex items-center gap-1.5">
            <button type="button" data-idx="${i}" class="qty-minus rounded bg-white px-1.5 dark:bg-slate-800">-</button>
            <span class="w-5 text-center">${c.qty}</span>
            <button type="button" data-idx="${i}" class="qty-plus rounded bg-white px-1.5 dark:bg-slate-800">+</button>
          </div>
          <span class="w-16 text-right">${formatRupiah(c.harga * c.qty)}</span>
          <button type="button" data-idx="${i}" class="remove-item text-red-500">✕</button>
        </div>`).join('');

      list.querySelectorAll('.qty-plus').forEach((btn) => btn.addEventListener('click', () => {
        const item = state.cart[Number(btn.dataset.idx)];
        if (item.qty < Number(item.stok)) item.qty += 1;
        renderCart(); renderProdukGrid();
      }));
      list.querySelectorAll('.qty-minus').forEach((btn) => btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        state.cart[idx].qty -= 1;
        if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
        renderCart(); renderProdukGrid();
      }));
      list.querySelectorAll('.remove-item').forEach((btn) => btn.addEventListener('click', () => {
        state.cart.splice(Number(btn.dataset.idx), 1);
        renderCart(); renderProdukGrid();
      }));
    }
    updateTotals();
  }

  function updateTotals() {
    const { subtotal, total } = grandTotal();
    root.querySelector('#subtotal-text').textContent = formatRupiah(subtotal);
    root.querySelector('#total-text').textContent = formatRupiah(total);
    if (state.splitMode) renderSplitRows();
  }
  root.querySelector('#diskon').addEventListener('input', updateTotals);

  root.querySelectorAll('.metode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.metode = btn.dataset.metode;
      root.querySelectorAll('.metode-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // --- Split bill ---
  const splitToggle = root.querySelector('#split-toggle');
  const singlePaymentEl = root.querySelector('#single-payment');
  const splitPaymentEl = root.querySelector('#split-payment');

  splitToggle.addEventListener('change', () => {
    state.splitMode = splitToggle.checked;
    if (state.splitMode) {
      singlePaymentEl.classList.add('hidden');
      splitPaymentEl.classList.remove('hidden');
      if (state.splitRows.length === 0) state.splitRows = [{ metode: 'Cash', jumlah: 0 }];
      renderSplitRows();
    } else {
      singlePaymentEl.classList.remove('hidden');
      splitPaymentEl.classList.add('hidden');
    }
  });

  root.querySelector('#add-split-row').addEventListener('click', () => {
    state.splitRows.push({ metode: 'Cash', jumlah: 0 });
    renderSplitRows();
  });

  function renderSplitRows() {
    const wrap = root.querySelector('#split-rows');
    wrap.innerHTML = state.splitRows.map((row, i) => `
      <div class="flex items-center gap-2">
        <select data-idx="${i}" class="split-metode input-field !py-1.5 w-28">
          <option value="Cash" ${row.metode === 'Cash' ? 'selected' : ''}>Cash</option>
          <option value="QRIS" ${row.metode === 'QRIS' ? 'selected' : ''}>QRIS</option>
        </select>
        <input data-idx="${i}" type="number" min="0" value="${row.jumlah}" class="split-jumlah input-field !py-1.5 flex-1" placeholder="Jumlah" />
        <button type="button" data-idx="${i}" class="split-remove text-red-500">✕</button>
      </div>`).join('');

    wrap.querySelectorAll('.split-metode').forEach((el) => el.addEventListener('change', () => {
      state.splitRows[Number(el.dataset.idx)].metode = el.value;
    }));
    wrap.querySelectorAll('.split-jumlah').forEach((el) => el.addEventListener('input', () => {
      state.splitRows[Number(el.dataset.idx)].jumlah = Number(el.value) || 0;
      updateSplitRemaining();
    }));
    wrap.querySelectorAll('.split-remove').forEach((el) => el.addEventListener('click', () => {
      state.splitRows.splice(Number(el.dataset.idx), 1);
      renderSplitRows();
    }));
    updateSplitRemaining();
  }

  function updateSplitRemaining() {
    const { total } = grandTotal();
    const sum = state.splitRows.reduce((s, r) => s + r.jumlah, 0);
    const remaining = total - sum;
    const el = root.querySelector('#split-remaining');
    el.textContent = remaining === 0 ? '✅ Pas, total pembayaran sudah sesuai.' : `Sisa yang harus dibagi: ${formatRupiah(remaining)}`;
    el.className = 'text-xs font-semibold ' + (remaining === 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-red-500');
  }

  try {
    const { produk } = await apiCall('warkopListProduk', {});
    state.produk = produk;
    renderChips();
    renderProdukGrid();
    renderCart();
  } catch (err) {
    toastError(err instanceof ApiError ? err.message : 'Gagal memuat daftar menu.');
  }

  root.querySelector('#pesanan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.cart.length === 0) return toastError('Pilih minimal 1 menu.');

    const payload = {
      items: state.cart.map((c) => ({ produkId: c.produkId, qty: c.qty })),
      diskon: Number(root.querySelector('#diskon').value) || 0,
      namaPelanggan: root.querySelector('#namaPelanggan').value.trim(),
      noHp: root.querySelector('#noHp').value.trim(),
      catatan: root.querySelector('#catatan').value.trim()
    };

    if (state.splitMode) {
      const { total } = grandTotal();
      const sum = state.splitRows.reduce((s, r) => s + r.jumlah, 0);
      if (sum !== total) return toastError('Total split bill harus sama persis dengan grand total.');
      payload.splitBill = state.splitRows;
    } else {
      if (!state.metode) return toastError('Pilih metode pembayaran.');
      payload.metodePembayaran = state.metode;
    }

    const submitBtn = root.querySelector('#submit-btn');
    submitBtn.disabled = true;
    try {
      const { transaksi } = await apiCall('warkopCreateTransaksi', payload);
      toastSuccess(`Transaksi ${transaksi.NomorTransaksi} berhasil dibuat.`);
      await openWarkopStrukModal(transaksi);

      state.cart = [];
      state.metode = '';
      state.splitMode = false;
      state.splitRows = [];
      root.querySelector('#namaPelanggan').value = '';
      root.querySelector('#noHp').value = '';
      root.querySelector('#catatan').value = '';
      root.querySelector('#diskon').value = 0;
      splitToggle.checked = false;
      singlePaymentEl.classList.remove('hidden');
      splitPaymentEl.classList.add('hidden');
      root.querySelectorAll('.metode-btn').forEach((b) => b.classList.remove('selected'));

      const { produk } = await apiCall('warkopListProduk', {});
      state.produk = produk;
      renderChips();
      renderProdukGrid();
      renderCart();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Gagal membuat transaksi.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}
