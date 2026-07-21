const test = require('node:test');
const assert = require('node:assert/strict');
const { computeShiftReconciliation_ } = require('../../backend/gas/ClosingShift.js');

test('computeShiftReconciliation_: kas fisik pas -> selisih 0', () => {
  // Saldo awal 100rb, cash masuk Barber 50rb + Warkop 30rb, pengeluaran Barber 10rb -> sistem = 100+50+30-10 = 170rb
  const r = computeShiftReconciliation_(100000, 50000, 30000, 10000, 0, 170000);
  assert.equal(r.totalSistem, 170000);
  assert.equal(r.selisih, 0);
});

test('computeShiftReconciliation_: kas fisik kurang -> selisih negatif', () => {
  const r = computeShiftReconciliation_(100000, 50000, 30000, 10000, 0, 165000);
  assert.equal(r.totalSistem, 170000);
  assert.equal(r.selisih, -5000);
});

test('computeShiftReconciliation_: kas fisik lebih -> selisih positif', () => {
  const r = computeShiftReconciliation_(100000, 50000, 30000, 10000, 0, 175000);
  assert.equal(r.selisih, 5000);
});

test('computeShiftReconciliation_: QRIS tidak memengaruhi kas fisik (tidak ada parameter QRIS)', () => {
  // Fungsi ini sengaja tidak menerima qrisBarber/qrisWarkop sama sekali -> QRIS tidak pernah masuk hitungan kas fisik.
  const r = computeShiftReconciliation_(0, 0, 0, 0, 0, 0);
  assert.equal(r.totalSistem, 0);
  assert.equal(r.selisih, 0);
});

test('computeShiftReconciliation_: pengeluaran Barber+Warkop keduanya mengurangi kas sistem', () => {
  const r = computeShiftReconciliation_(0, 100000, 0, 20000, 30000, 50000);
  assert.equal(r.totalSistem, 50000); // 100000-20000-30000
  assert.equal(r.selisih, 0);
});
