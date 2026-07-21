const test = require('node:test');
const assert = require('node:assert/strict');

test('core/calc.js: computeItemsSubtotal, applyDiskon, computeKembalian', async () => {
  const { computeItemsSubtotal, applyDiskon, computeKembalian } = await import('../../frontend/js/core/calc.js');

  assert.equal(computeItemsSubtotal([{ harga: 25000, qty: 2 }, { harga: 15000, qty: 1 }]), 65000);
  assert.equal(computeItemsSubtotal([]), 0);

  assert.deepEqual(applyDiskon(100000, 10, 'percent'), { diskonAmount: 10000, grandTotal: 90000 });
  assert.deepEqual(applyDiskon(100000, 10000, 'nominal'), { diskonAmount: 10000, grandTotal: 90000 });
  assert.deepEqual(applyDiskon(100000, 999999, 'nominal'), { diskonAmount: 100000, grandTotal: 0 });

  assert.equal(computeKembalian(90000, 100000), 10000);
  assert.equal(computeKembalian(90000, 50000), 0, 'tidak boleh negatif');
});
