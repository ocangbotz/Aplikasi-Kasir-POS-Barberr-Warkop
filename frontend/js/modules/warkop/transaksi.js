/**
 * warkop/transaksi — form pesanan Warkop: cart multi-menu, diskon, dan dua
 * mode pembayaran: normal (Cash/QRIS/Split 2-arah) atau Split Bill (bagi
 * tagihan antar beberapa pembayar, masing2 Cash/QRIS sendiri).
 */

import { apiCall } from '../../core/api.js';
import { showToast, escapeHtml, confirmDialog } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';
import { computeItemsSubtotal, applyDiskon, computeKembalian } from '../../core/calc.js';
import { showReceiptModal } from '../receipt/receipt.js';

export async function renderTransaksiWarkop(container) {
  let produkList = [];
  let cart = []; // [{produkId, nama, harga, qty}]
  let paymentMode = 'normal'; // 'normal' | 'split'
  let metodeBayar = 'Cash';
  let splitPayers = []; // [{nama, metode, jumlah}]

  container.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-4 text-xl font-bold">Pesanan Baru — Warkop</h1>
      <div class="glass-card space-y-6 p-6">
        <div>
          <label class="label-field" for="trx-nama-meja">Nama Pelanggan / Meja</label>
          <input id="trx-nama-meja" class="input-field" placeholder="mis. Meja 3, Andi, dll" />
        </div>

        <div>
          <label class="label-field">Menu</label>
          <div class="flex gap-2">
            <select id="trx-produk-select" class="input-field"></select>
            <input id="trx-produk-qty" type="number" min="1" value="1" class="input-field !w-20" />
            <button type="button" id="btn-add-item" class="btn-warkop whitespace-nowrap">+ Tambah</button>
          </div>
          <div id="trx-cart" class="mt-3 divide-y divide-slate-100 dark:divide-slate-800"></div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label-field" for="trx-diskon">Diskon</label>
            <input id="trx-diskon" type="number" min="0" value="0" class="input-field" />
          </div>
          <div>
            <label class="label-field" for="trx-diskon-type">Tipe Diskon</label>
            <select id="trx-diskon-type" class="input-field">
              <option value="nominal">Nominal (Rp)</option>
              <option value="percent">Persen (%)</option>
            </select>
          </div>
        </div>

        <div id="trx-summary" class="glass-panel space-y-1 p-4 text-sm"></div>

        <div class="flex gap-2">
          <button type="button" id="btn-mode-normal" class="btn-warkop">Bayar Normal</button>
          <button type="button" id="btn-mode-split" class="btn-outline">Split Bill</button>
        </div>
        <div id="trx-payment-area"></div>

        <div>
          <label class="label-field" for="trx-catatan">Catatan</label>
          <textarea id="trx-catatan" class="input-field" rows="2"></textarea>
        </div>

        <button type="button" id="btn-submit-trx" class="btn-warkop w-full text-base">Simpan &amp; Cetak Struk</button>
      </div>
    </div>
  `;

  const els = {
    namaMeja: container.querySelector('#trx-nama-meja'),
    produkSelect: container.querySelector('#trx-produk-select'),
    produkQty: container.querySelector('#trx-produk-qty'),
    cart: container.querySelector('#trx-cart'),
    diskon: container.querySelector('#trx-diskon'),
    diskonType: container.querySelector('#trx-diskon-type'),
    summary: container.querySelector('#trx-summary'),
    btnModeNormal: container.querySelector('#btn-mode-normal'),
    btnModeSplit: container.querySelector('#btn-mode-split'),
    paymentArea: container.querySelector('#trx-payment-area'),
    catatan: container.querySelector('#trx-catatan'),
    submitBtn: container.querySelector('#btn-submit-trx')
  };

  try {
    produkList = await apiCall('produk.list', {});
  } catch (err) {
    showToast('Gagal memuat menu: ' + err.message, 'error');
  }
  els.produkSelect.innerHTML = produkList.length
    ? produkList.map((p) => `<option value="${escapeHtml(p.ProdukID)}">${escapeHtml(p.NamaMenu)} — ${formatRupiah(p.HargaJual)} (stok ${p.Stok})</option>`).join('')
    : '<option value="">Belum ada menu aktif</option>';

  function currentTotals() {
    const subtotal = computeItemsSubtotal(cart);
    const { diskonAmount, grandTotal } = applyDiskon(subtotal, els.diskon.value, els.diskonType.value);
    return { subtotal, diskonAmount, grandTotal };
  }

  function renderCart() {
    els.cart.innerHTML = cart.length
      ? cart
          .map(
            (item, idx) => `
        <div class="flex items-center justify-between py-2 text-sm">
          <div><div class="font-medium">${escapeHtml(item.nama)}</div><div class="text-xs text-slate-500">${formatRupiah(item.harga)} x ${item.qty}</div></div>
          <div class="flex items-center gap-3"><span>${formatRupiah(item.harga * item.qty)}</span><button type="button" class="text-red-500 hover:text-red-700" data-remove="${idx}" aria-label="Hapus">✕</button></div>
        </div>`
          )
          .join('')
      : '<p class="py-3 text-sm text-slate-400">Belum ada menu dipesan.</p>';
    renderSummary();
  }

  els.cart.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    cart.splice(Number(btn.dataset.remove), 1);
    renderCart();
  });

  container.querySelector('#btn-add-item').addEventListener('click', () => {
    const produkId = els.produkSelect.value;
    const produk = produkList.find((p) => p.ProdukID === produkId);
    if (!produk) return;
    const qty = Math.max(1, parseInt(els.produkQty.value, 10) || 1);
    const existing = cart.find((c) => c.produkId === produkId);
    if (existing) existing.qty += qty;
    else cart.push({ produkId, nama: produk.NamaMenu, harga: Number(produk.HargaJual), qty });
    els.produkQty.value = 1;
    renderCart();
  });

  function renderSummary() {
    const { subtotal, diskonAmount, grandTotal } = currentTotals();
    els.summary.innerHTML = `
      <div class="flex justify-between"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
      <div class="flex justify-between"><span>Diskon</span><span>-${formatRupiah(diskonAmount)}</span></div>
      <div class="flex justify-between text-base font-bold"><span>Grand Total</span><span>${formatRupiah(grandTotal)}</span></div>
    `;
    renderPaymentArea();
  }
  els.diskon.addEventListener('input', renderSummary);
  els.diskonType.addEventListener('change', renderSummary);

  // ---- Mode switch ----
  function setMode(mode) {
    paymentMode = mode;
    els.btnModeNormal.className = mode === 'normal' ? 'btn-warkop' : 'btn-outline';
    els.btnModeSplit.className = mode === 'split' ? 'btn-warkop' : 'btn-outline';
    renderPaymentArea();
  }
  els.btnModeNormal.addEventListener('click', () => setMode('normal'));
  els.btnModeSplit.addEventListener('click', () => setMode('split'));

  function renderPaymentArea() {
    if (paymentMode === 'normal') renderNormalPayment();
    else renderSplitBillPayment();
  }

  function renderNormalPayment() {
    const { grandTotal } = currentTotals();
    els.paymentArea.innerHTML = `
      <div class="flex flex-wrap gap-2" id="trx-metode-group">
        <button type="button" data-metode="Cash" class="${metodeBayar === 'Cash' ? 'btn-warkop' : 'btn-outline'}">Cash</button>
        <button type="button" data-metode="QRIS" class="${metodeBayar === 'QRIS' ? 'btn-warkop' : 'btn-outline'}">QRIS</button>
        <button type="button" data-metode="Split" class="${metodeBayar === 'Split' ? 'btn-warkop' : 'btn-outline'}">Split (Cash+QRIS)</button>
      </div>
      <div id="trx-normal-fields" class="mt-3"></div>
    `;
    els.paymentArea.querySelectorAll('[data-metode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        metodeBayar = btn.dataset.metode;
        renderNormalPayment();
      });
    });

    const fieldsEl = els.paymentArea.querySelector('#trx-normal-fields');
    if (metodeBayar === 'Cash') {
      fieldsEl.innerHTML = `<label class="label-field" for="trx-cash">Uang Diterima</label><input id="trx-cash" type="number" min="0" value="${grandTotal}" class="input-field" /><p id="trx-kembalian-hint" class="mt-1 text-xs text-slate-500"></p>`;
      const cashInput = fieldsEl.querySelector('#trx-cash');
      const hint = fieldsEl.querySelector('#trx-kembalian-hint');
      const update = () => { hint.textContent = 'Kembalian: ' + formatRupiah(computeKembalian(currentTotals().grandTotal, cashInput.value)); };
      cashInput.addEventListener('input', update);
      update();
    } else if (metodeBayar === 'QRIS') {
      fieldsEl.innerHTML = `<p class="text-sm text-slate-500">Nominal QRIS otomatis sama dengan Grand Total: <strong>${formatRupiah(grandTotal)}</strong></p>`;
    } else {
      fieldsEl.innerHTML = `
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="label-field" for="trx-split-cash">Cash</label><input id="trx-split-cash" type="number" min="0" value="0" class="input-field" /></div>
          <div><label class="label-field" for="trx-split-qris">QRIS</label><input id="trx-split-qris" type="number" min="0" value="0" class="input-field" /></div>
        </div>
        <p id="trx-split2-hint" class="mt-2 text-xs text-slate-500"></p>
      `;
      const cashInput = fieldsEl.querySelector('#trx-split-cash');
      const qrisInput = fieldsEl.querySelector('#trx-split-qris');
      const hint = fieldsEl.querySelector('#trx-split2-hint');
      const update = () => {
        const sisa = currentTotals().grandTotal - ((Number(cashInput.value) || 0) + (Number(qrisInput.value) || 0));
        hint.textContent = sisa === 0 ? 'Jumlah pas ✓' : sisa > 0 ? `Kurang ${formatRupiah(sisa)}` : `Lebih ${formatRupiah(-sisa)}`;
        hint.className = 'mt-2 text-xs ' + (sisa === 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-amber-600 dark:text-amber-400');
      };
      cashInput.addEventListener('input', update);
      qrisInput.addEventListener('input', update);
      update();
    }
  }

  function renderSplitBillPayment() {
    const { grandTotal } = currentTotals();
    const totalTerbagi = splitPayers.reduce((s, p) => s + (Number(p.jumlah) || 0), 0);
    const sisa = grandTotal - totalTerbagi;

    els.paymentArea.innerHTML = `
      <div class="space-y-2" id="split-payers-list">
        ${splitPayers
          .map(
            (p, idx) => `
          <div class="flex flex-wrap items-center gap-2" data-payer-idx="${idx}">
            <input type="text" placeholder="Nama" value="${escapeHtml(p.nama)}" data-field="nama" class="input-field !w-32" />
            <select data-field="metode" class="input-field !w-28">
              <option value="Cash" ${p.metode === 'Cash' ? 'selected' : ''}>Cash</option>
              <option value="QRIS" ${p.metode === 'QRIS' ? 'selected' : ''}>QRIS</option>
            </select>
            <input type="number" min="0" placeholder="Jumlah" value="${p.jumlah || ''}" data-field="jumlah" class="input-field !w-28" />
            <button type="button" class="text-red-500 hover:text-red-700" data-remove-payer="${idx}" aria-label="Hapus">✕</button>
          </div>`
          )
          .join('')}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" id="btn-add-payer" class="btn-outline text-xs">+ Tambah Pembayar</button>
        <button type="button" id="btn-split-even" class="btn-outline text-xs">Bagi Rata</button>
      </div>
      <p class="mt-2 text-xs ${sisa === 0 && splitPayers.length > 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-amber-600 dark:text-amber-400'}">
        ${splitPayers.length === 0 ? 'Belum ada pembayar ditambahkan.' : sisa === 0 ? 'Total pas ✓' : sisa > 0 ? `Kurang ${formatRupiah(sisa)}` : `Lebih ${formatRupiah(-sisa)}`}
      </p>
    `;

    els.paymentArea.querySelector('#btn-add-payer').addEventListener('click', () => {
      splitPayers.push({ nama: `Pembayar ${splitPayers.length + 1}`, metode: 'Cash', jumlah: 0 });
      renderSplitBillPayment();
    });
    els.paymentArea.querySelector('#btn-split-even').addEventListener('click', () => {
      if (splitPayers.length === 0) return;
      const each = Math.floor(currentTotals().grandTotal / splitPayers.length);
      splitPayers.forEach((p, idx) => { p.jumlah = idx === splitPayers.length - 1 ? currentTotals().grandTotal - each * (splitPayers.length - 1) : each; });
      renderSplitBillPayment();
    });
    els.paymentArea.querySelectorAll('[data-remove-payer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        splitPayers.splice(Number(btn.dataset.removePayer), 1);
        renderSplitBillPayment();
      });
    });
    els.paymentArea.querySelectorAll('[data-payer-idx]').forEach((row) => {
      const idx = Number(row.dataset.payerIdx);
      row.querySelectorAll('[data-field]').forEach((input) => {
        input.addEventListener('input', () => {
          splitPayers[idx][input.dataset.field] = input.value;
          if (input.dataset.field !== 'jumlah' && input.dataset.field !== 'nama') renderSplitBillPayment();
          else {
            const sisaEl = els.paymentArea.querySelector('p.mt-2');
            const newTotal = splitPayers.reduce((s, p) => s + (Number(p.jumlah) || 0), 0);
            const newSisa = currentTotals().grandTotal - newTotal;
            sisaEl.textContent = newSisa === 0 ? 'Total pas ✓' : newSisa > 0 ? `Kurang ${formatRupiah(newSisa)}` : `Lebih ${formatRupiah(-newSisa)}`;
            sisaEl.className = 'mt-2 text-xs ' + (newSisa === 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-amber-600 dark:text-amber-400');
          }
        });
      });
    });
  }

  renderCart();
  setMode('normal');

  // ---- Submit ----
  els.submitBtn.addEventListener('click', async () => {
    if (cart.length === 0) return showToast('Tambahkan minimal 1 menu', 'error');

    const { grandTotal } = currentTotals();
    const payload = {
      jenisUsaha: 'Warkop',
      namaPelanggan: els.namaMeja.value.trim(),
      items: cart.map((c) => ({ produkId: c.produkId, qty: c.qty })),
      diskon: els.diskon.value,
      diskonType: els.diskonType.value,
      catatan: els.catatan.value
    };

    if (paymentMode === 'split') {
      if (splitPayers.length === 0) return showToast('Tambahkan minimal 1 pembayar untuk split bill', 'error');
      const total = splitPayers.reduce((s, p) => s + (Number(p.jumlah) || 0), 0);
      if (total !== grandTotal) return showToast('Total split bill harus sama persis dengan Grand Total', 'error');
      payload.splitBillPayers = splitPayers.map((p) => ({ nama: p.nama, metode: p.metode, jumlah: p.jumlah }));
    } else {
      payload.metodeBayar = metodeBayar;
      if (metodeBayar === 'Cash') payload.cashAmount = els.paymentArea.querySelector('#trx-cash').value;
      else if (metodeBayar === 'QRIS') payload.qrisAmount = grandTotal;
      else {
        payload.cashAmount = els.paymentArea.querySelector('#trx-split-cash').value;
        payload.qrisAmount = els.paymentArea.querySelector('#trx-split-qris').value;
      }
    }

    const ok = await confirmDialog(`Simpan pesanan senilai ${formatRupiah(grandTotal)}?`, { title: 'Konfirmasi Pesanan', confirmText: 'Ya, Simpan' });
    if (!ok) return;

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = 'Menyimpan...';
    try {
      const result = await apiCall('transaksi.create', payload, { queueOnOffline: true });
      if (result.queued) {
        showToast('Anda sedang offline — pesanan disimpan & akan terkirim otomatis saat online.', 'warning', 5000);
        resetForm();
      } else {
        showToast('Pesanan berhasil disimpan', 'success');
        await showReceiptModal(result.transaksi, 'Warkop');
        resetForm();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = 'Simpan & Cetak Struk';
    }
  });

  function resetForm() {
    cart = [];
    splitPayers = [];
    els.namaMeja.value = '';
    els.diskon.value = 0;
    els.diskonType.value = 'nominal';
    els.catatan.value = '';
    setMode('normal');
    renderCart();
  }
}
