const test = require('node:test');
const assert = require('node:assert/strict');
const { isLowStock_ } = require('../../backend/gas/Inventory.js');

test('isLowStock_ true ketika Stok <= StokMinimum', () => {
  assert.equal(isLowStock_({ Stok: 5, StokMinimum: 5 }), true);
  assert.equal(isLowStock_({ Stok: 3, StokMinimum: 5 }), true);
  assert.equal(isLowStock_({ Stok: 0, StokMinimum: 5 }), true);
});

test('isLowStock_ false ketika Stok > StokMinimum', () => {
  assert.equal(isLowStock_({ Stok: 6, StokMinimum: 5 }), false);
  assert.equal(isLowStock_({ Stok: 100, StokMinimum: 5 }), false);
});
