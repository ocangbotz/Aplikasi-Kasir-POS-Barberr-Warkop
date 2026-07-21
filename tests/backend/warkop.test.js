const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTransaksiWarkopPayload_ } = require('../../backend/gas/Warkop.js');

test('validateTransaksiWarkopPayload_ menolak items kosong/tidak ada', () => {
  assert.throws(() => validateTransaksiWarkopPayload_({}), /Field wajib belum diisi: items/, 'items sama sekali tidak dikirim');
  assert.throws(() => validateTransaksiWarkopPayload_({ items: [] }), /Minimal 1 menu/, 'items dikirim tapi array kosong');
  assert.throws(() => validateTransaksiWarkopPayload_({ items: 'bukan-array' }), /Minimal 1 menu/);
});

test('validateTransaksiWarkopPayload_ menolak item tanpa produkId atau qty <= 0', () => {
  assert.throws(() => validateTransaksiWarkopPayload_({ items: [{ qty: 1 }], metodeBayar: 'Cash' }), /produkId & qty/);
  assert.throws(() => validateTransaksiWarkopPayload_({ items: [{ produkId: 'PRD-1', qty: 0 }], metodeBayar: 'Cash' }), /produkId & qty/);
});

test('validateTransaksiWarkopPayload_ mewajibkan metodeBayar kalau bukan split bill', () => {
  assert.throws(
    () => validateTransaksiWarkopPayload_({ items: [{ produkId: 'PRD-1', qty: 1 }] }),
    /metodeBayar wajib/
  );
});

test('validateTransaksiWarkopPayload_ menerima payload dengan metodeBayar biasa', () => {
  assert.doesNotThrow(() => validateTransaksiWarkopPayload_({ items: [{ produkId: 'PRD-1', qty: 2 }], metodeBayar: 'Cash' }));
});

test('validateTransaksiWarkopPayload_ menerima payload split bill tanpa metodeBayar eksplisit', () => {
  assert.doesNotThrow(() =>
    validateTransaksiWarkopPayload_({
      items: [{ produkId: 'PRD-1', qty: 2 }],
      splitBillPayers: [{ nama: 'Andi', metode: 'Cash', jumlah: 10000 }]
    })
  );
});
