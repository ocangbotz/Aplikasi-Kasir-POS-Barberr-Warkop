const test = require('node:test');
const assert = require('node:assert/strict');
const { computeItemsSubtotal, applyDiskon, computeLoyaltyPoints, computePaymentBreakdown } = require('../../backend/gas/Calc.js');

test('computeItemsSubtotal menjumlahkan harga x qty', () => {
  assert.equal(computeItemsSubtotal([{ harga: 25000, qty: 2 }, { harga: 15000, qty: 1 }]), 65000);
  assert.equal(computeItemsSubtotal([]), 0);
  assert.equal(computeItemsSubtotal([{ harga: 'bukan-angka', qty: 2 }]), 0);
});

test('applyDiskon: nominal & percent, tidak pernah negatif atau melebihi subtotal', () => {
  assert.deepEqual(applyDiskon(100000, 10000, 'nominal'), { diskonAmount: 10000, grandTotal: 90000 });
  assert.deepEqual(applyDiskon(100000, 10, 'percent'), { diskonAmount: 10000, grandTotal: 90000 });
  assert.deepEqual(applyDiskon(100000, 999999, 'nominal'), { diskonAmount: 100000, grandTotal: 0 }, 'diskon nominal tidak boleh melebihi subtotal');
  assert.deepEqual(applyDiskon(100000, 200, 'percent'), { diskonAmount: 100000, grandTotal: 0 }, 'diskon persen di-clamp maksimal 100%');
  assert.deepEqual(applyDiskon(50000, -10, 'nominal'), { diskonAmount: 0, grandTotal: 50000 }, 'diskon negatif diabaikan');
});

test('computeLoyaltyPoints', () => {
  assert.equal(computeLoyaltyPoints(95000, 10000), 9);
  assert.equal(computeLoyaltyPoints(0, 10000), 0);
  assert.equal(computeLoyaltyPoints(50000, 0), 0, 'rate 0 tidak boleh div-by-zero');
});

test('computePaymentBreakdown: Cash cukup -> kembalian benar', () => {
  assert.deepEqual(computePaymentBreakdown(90000, 'Cash', 100000, 0), { cashAmount: 100000, qrisAmount: 0, kembalian: 10000 });
});

test('computePaymentBreakdown: Cash kurang -> ditolak', () => {
  assert.throws(() => computePaymentBreakdown(90000, 'Cash', 50000, 0), /kurang/);
});

test('computePaymentBreakdown: QRIS harus pas', () => {
  assert.deepEqual(computePaymentBreakdown(90000, 'QRIS', 0, 90000), { cashAmount: 0, qrisAmount: 90000, kembalian: 0 });
  assert.throws(() => computePaymentBreakdown(90000, 'QRIS', 0, 80000), /QRIS/);
});

test('computePaymentBreakdown: Split harus pas jumlahnya', () => {
  assert.deepEqual(computePaymentBreakdown(90000, 'Split', 40000, 50000), { cashAmount: 40000, qrisAmount: 50000, kembalian: 0 });
  assert.throws(() => computePaymentBreakdown(90000, 'Split', 40000, 40000), /split bill/);
});

test('computePaymentBreakdown: metode tidak dikenal ditolak', () => {
  assert.throws(() => computePaymentBreakdown(90000, 'Kartu', 90000, 0), /tidak dikenal/);
});
