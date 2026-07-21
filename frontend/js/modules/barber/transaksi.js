/**
 * barber/transaksi — form input transaksi Barber: cari/pilih pelanggan,
 * pilih capster, tambah layanan (multi-item), diskon, metode pembayaran,
 * catatan -> submit -> tampilkan struk siap cetak.
 */

import { apiCall } from '../../core/api.js';
import { showToast, escapeHtml, confirmDialog } from '../../core/ui.js';
import { formatRupiah } from '../../core/format.js';
import { computeItemsSubtotal, applyDiskon, computeKembalian } from '../../core/calc.js';
import { showReceiptModal } from '../receipt/receipt.js';

const SEARCH_DEBOUNCE_MS = 300;

export async function renderTransaksiBarber(container) {
  let layananList = [];
  let capsterList = [];
  let cart = []; // [{layananId, nama, harga, qty}]
  let selectedPelanggan = null; // {PelangganID, Nama, NoHP} | null (pelanggan baru)
  let searchTimer = null;

  container.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-4 text-xl font-bold">Transaksi Baru — Barber</h1>
      <div class="glass-card space-y-6 p-6">
        <div class="relative">
          <label class="label-field" for="trx-pelanggan-nama">Nama Pelanggan</label>
          <input id="trx-pelanggan-nama" class="input-field" autocomplete="off" placeholder="Ketik nama untuk cari / buat baru" required />
          <div id="trx-pelanggan-suggestions" class="absolute z-10 mt-1 hidden w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"></div>
        </div>
        <div>
          <label class="label-field" for="trx-pelanggan-hp">Nomor HP</label>
          <input id="trx-pelanggan-hp" class="input-field" autocomplete="off" placeholder="08xxxxxxxxxx" />
        </div>

        <div>
          <label class="label-field" for="trx-capster">Capster</label>
          <select id="trx-capster" class="input-field" required></select>
        </div>

        <div>
          <label class="label-field">Layanan</label>
          <div class="flex gap-2">
            <select id="trx-layanan-select" class="input-field"></select>
            <input id="trx-layanan-qty" type="number" min="1" value="1" class="input-field !w-20" />
            <button type="button" id="btn-add-item" class="btn-barber whitespace-nowrap">+ Tambah</button>
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

        <div>
          <label class="label-field">Metode Pembayaran</label>
          <div class="flex flex-wrap gap-2" id="trx-metode-group">
            <button type="button" class="btn-outline" data-metode="Cash">Cash</button>
            <button type="button" class="btn-outline" data-metode="QRIS">QRIS</button>
            <button type="button" class="btn-outline" data-metode="Split">Split</button>
          </div>
        </div>
        <div id="trx-payment-fields"></div>

        <div>
          <label class="label-field" for="trx-catatan">Catatan</label>
          <textarea id="trx-catatan" class="input-field" rows="2"></textarea>
        </div>

        <button type="button" id="btn-submit-trx" class="btn-barber w-full text-base">Simpan &amp; Cetak Struk</button>
      </div>
    </div>
  `;

  const els = {
    nama: container.querySelector('#trx-pelanggan-nama'),
    hp: container.querySelector('#trx-pelanggan-hp'),
    suggestions: container.querySelector('#trx-pelanggan-suggestions'),
    capster: container.querySelector('#trx-capster'),
    layananSelect: container.querySelector('#trx-layanan-select'),
    layananQty: container.querySelector('#trx-layanan-qty'),
    cart: container.querySelector('#trx-cart'),
    diskon: container.querySelector('#trx-diskon'),
    diskonType: container.querySelector('#trx-diskon-type'),
    summary: container.querySelector('#trx-summary'),
    metodeGroup: container.querySelector('#trx-metode-group'),
    paymentFields: container.querySelector('#trx-payment-fields'),
    catatan: container.querySelector('#trx-catatan'),
    submitBtn: container.querySelector('#btn-submit-trx')
  };

  let metodeBayar = 'Cash';

  // ---- Load master data ----
  try {
    [layananList, capsterList] = await Promise.all([apiCall('layanan.list', {}), apiCall('capster.list', {})]);
  } catch (err) {
    showToast('Gagal memuat data layanan/capster: ' + err.message, 'error');
  }

  els.layananSelect.innerHTML = layananList.map((l) => `<option value="${escapeHtml(l.LayananID)}">${escapeHtml(l.NamaLayanan)} — ${formatRupiah(l.Harga)}</option>`).join('');
  els.capster.innerHTML =
    '<option value="">-- Pilih Capster --</option>' + capsterList.map((c) => `<option value="${escapeHtml(c.CapsterID)}">${escapeHtml(c.Nama)}</option>`).join('');

  if (layananList.length === 0) {
    els.layananSelect.innerHTML = '<option value="">Belum ada layanan aktif</option>';
  }

  // ---- Pencarian pelanggan (debounce) ----
  els.nama.addEventListener('input', () => {
    selectedPelanggan = null;
    clearTimeout(searchTimer);
    const q = els.nama.value.trim();
    if (q.length < 2) {
      els.suggestions.classList.add('hidden');
      return;
    }
    searchTimer = setTimeout(async () => {
      try {
        const results = await apiCall('pelanggan.view', { query: q });
        if (results.length === 0) {
          els.suggestions.classList.add('hidden');
          return;
        }
        els.suggestions.innerHTML = results
          .map(
            (p) => `<button type="button" class="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" data-id="${escapeHtml(p.PelangganID)}" data-nama="${escapeHtml(p.Nama)}" data-hp="${escapeHtml(p.NoHP)}">
              <div class="font-medium">${escapeHtml(p.Nama)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(p.NoHP)} · ${p.TotalKunjungan} kunjungan${p.Member ? ' · Member' : ''}</div>
            </button>`
          )
          .join('');
        els.suggestions.classList.remove('hidden');
      } catch (err) {
        els.suggestions.classList.add('hidden');
      }
    }, SEARCH_DEBOUNCE_MS);
  });

  els.suggestions.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (!btn) return;
    selectedPelanggan = { PelangganID: btn.dataset.id, Nama: btn.dataset.nama, NoHP: btn.dataset.hp };
    els.nama.value = btn.dataset.nama;
    els.hp.value = btn.dataset.hp;
    els.suggestions.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!els.suggestions.contains(e.target) && e.target !== els.nama) els.suggestions.classList.add('hidden');
  });

  // ---- Cart ----
  function renderCart() {
    if (cart.length === 0) {
      els.cart.innerHTML = '<p class="py-3 text-sm text-slate-400">Belum ada layanan ditambahkan.</p>';
    } else {
      els.cart.innerHTML = cart
        .map(
          (item, idx) => `
        <div class="flex items-center justify-between py-2 text-sm">
          <div>
            <div class="font-medium">${escapeHtml(item.nama)}</div>
            <div class="text-xs text-slate-500">${formatRupiah(item.harga)} x ${item.qty}</div>
          </div>
          <div class="flex items-center gap-3">
            <span>${formatRupiah(item.harga * item.qty)}</span>
            <button type="button" class="text-red-500 hover:text-red-700" data-remove="${idx}" aria-label="Hapus">✕</button>
          </div>
        </div>`
        )
        .join('');
    }
    renderSummary();
  }

  els.cart.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    cart.splice(Number(btn.dataset.remove), 1);
    renderCart();
  });

  container.querySelector('#btn-add-item').addEventListener('click', () => {
    const layananId = els.layananSelect.value;
    const layanan = layananList.find((l) => l.LayananID === layananId);
    if (!layanan) return;
    const qty = Math.max(1, parseInt(els.layananQty.value, 10) || 1);
    const existing = cart.find((c) => c.layananId === layananId);
    if (existing) existing.qty += qty;
    else cart.push({ layananId, nama: layanan.NamaLayanan, harga: Number(layanan.Harga), qty });
    els.layananQty.value = 1;
    renderCart();
  });

  // ---- Summary & payment ----
  function currentTotals() {
    const subtotal = computeItemsSubtotal(cart);
    const { diskonAmount, grandTotal } = applyDiskon(subtotal, els.diskon.value, els.diskonType.value);
    return { subtotal, diskonAmount, grandTotal };
  }

  function renderSummary() {
    const { subtotal, diskonAmount, grandTotal } = currentTotals();
    els.summary.innerHTML = `
      <div class="flex justify-between"><span>Subtotal</span><span>${formatRupiah(subtotal)}</span></div>
      <div class="flex justify-between"><span>Diskon</span><span>-${formatRupiah(diskonAmount)}</span></div>
      <div class="flex justify-between text-base font-bold"><span>Grand Total</span><span>${formatRupiah(grandTotal)}</span></div>
    `;
    renderPaymentFields();
  }

  function renderPaymentFields() {
    const { grandTotal } = currentTotals();
    if (metodeBayar === 'Cash') {
      els.paymentFields.innerHTML = `
        <label class="label-field" for="trx-cash">Uang Diterima (Cash)</label>
        <input id="trx-cash" type="number" min="0" class="input-field" value="${grandTotal}" />
        <p id="trx-kembalian-hint" class="mt-1 text-xs text-slate-500"></p>
      `;
      const cashInput = els.paymentFields.querySelector('#trx-cash');
      const hint = els.paymentFields.querySelector('#trx-kembalian-hint');
      const updateHint = () => {
        hint.textContent = 'Kembalian: ' + formatRupiah(computeKembalian(currentTotals().grandTotal, cashInput.value));
      };
      cashInput.addEventListener('input', updateHint);
      updateHint();
    } else if (metodeBayar === 'QRIS') {
      els.paymentFields.innerHTML = `<p class="text-sm text-slate-500">Nominal QRIS otomatis sama dengan Grand Total: <strong>${formatRupiah(grandTotal)}</strong></p>`;
    } else {
      els.paymentFields.innerHTML = `
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="label-field" for="trx-split-cash">Cash</label><input id="trx-split-cash" type="number" min="0" value="0" class="input-field" /></div>
          <div><label class="label-field" for="trx-split-qris">QRIS</label><input id="trx-split-qris" type="number" min="0" value="0" class="input-field" /></div>
        </div>
        <p id="trx-split-hint" class="mt-2 text-xs text-slate-500"></p>
      `;
      const cashInput = els.paymentFields.querySelector('#trx-split-cash');
      const qrisInput = els.paymentFields.querySelector('#trx-split-qris');
      const hint = els.paymentFields.querySelector('#trx-split-hint');
      const updateHint = () => {
        const total = (Number(cashInput.value) || 0) + (Number(qrisInput.value) || 0);
        const sisa = currentTotals().grandTotal - total;
        hint.textContent = sisa === 0 ? 'Jumlah pas ✓' : sisa > 0 ? `Kurang ${formatRupiah(sisa)}` : `Lebih ${formatRupiah(-sisa)}`;
        hint.className = 'mt-2 text-xs ' + (sisa === 0 ? 'text-gabungan-600 dark:text-gabungan-400' : 'text-amber-600 dark:text-amber-400');
      };
      cashInput.addEventListener('input', updateHint);
      qrisInput.addEventListener('input', updateHint);
      updateHint();
    }
  }

  els.metodeGroup.querySelectorAll('[data-metode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      metodeBayar = btn.dataset.metode;
      els.metodeGroup.querySelectorAll('[data-metode]').forEach((b) => b.classList.toggle('btn-barber', b === btn));
      els.metodeGroup.querySelectorAll('[data-metode]').forEach((b) => b.classList.toggle('btn-outline', b !== btn));
      renderPaymentFields();
    });
  });
  els.metodeGroup.querySelector('[data-metode="Cash"]').classList.add('btn-barber');

  els.diskon.addEventListener('input', renderSummary);
  els.diskonType.addEventListener('change', renderSummary);

  renderCart();
  renderPaymentFields();

  // ---- Submit ----
  els.submitBtn.addEventListener('click', async () => {
    if (cart.length === 0) return showToast('Tambahkan minimal 1 layanan', 'error');
    if (!els.capster.value) return showToast('Pilih capster terlebih dahulu', 'error');
    if (!els.nama.value.trim()) return showToast('Nama pelanggan wajib diisi', 'error');

    const { grandTotal } = currentTotals();
    let cashAmount = 0;
    let qrisAmount = 0;
    if (metodeBayar === 'Cash') cashAmount = els.paymentFields.querySelector('#trx-cash').value;
    else if (metodeBayar === 'QRIS') qrisAmount = grandTotal;
    else {
      cashAmount = els.paymentFields.querySelector('#trx-split-cash').value;
      qrisAmount = els.paymentFields.querySelector('#trx-split-qris').value;
    }

    const payload = {
      jenisUsaha: 'Barber',
      namaPelanggan: els.nama.value.trim(),
      noHp: els.hp.value.trim(),
      capsterId: els.capster.value,
      items: cart.map((c) => ({ layananId: c.layananId, qty: c.qty })),
      diskon: els.diskon.value,
      diskonType: els.diskonType.value,
      metodeBayar,
      cashAmount,
      qrisAmount,
      catatan: els.catatan.value
    };

    const ok = await confirmDialog(`Simpan transaksi senilai ${formatRupiah(grandTotal)}?`, { title: 'Konfirmasi Transaksi', confirmText: 'Ya, Simpan' });
    if (!ok) return;

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = 'Menyimpan...';
    try {
      const result = await apiCall('transaksi.create', payload, { queueOnOffline: true });
      if (result.queued) {
        showToast('Anda sedang offline — transaksi disimpan & akan terkirim otomatis saat online.', 'warning', 5000);
        resetForm();
      } else {
        showToast('Transaksi berhasil disimpan', 'success');
        await showReceiptModal(result.transaksi, 'Barber');
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
    selectedPelanggan = null;
    els.nama.value = '';
    els.hp.value = '';
    els.capster.value = '';
    els.diskon.value = 0;
    els.diskonType.value = 'nominal';
    els.catatan.value = '';
    renderCart();
  }
}
