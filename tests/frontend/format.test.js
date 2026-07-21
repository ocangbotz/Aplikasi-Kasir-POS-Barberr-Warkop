const test = require('node:test');
const assert = require('node:assert/strict');

test('format.js: formatRupiah, formatDateID, formatTimeID, formatDateTimeID', async () => {
  const { formatRupiah, formatDateID, formatTimeID, formatDateTimeID } = await import('../../frontend/js/core/format.js');

  assert.equal(formatRupiah(12000), 'Rp 12.000');
  assert.equal(formatRupiah(1000000), 'Rp 1.000.000');
  assert.equal(formatRupiah(-5000), '-Rp 5.000');
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah('12000.6'), 'Rp 12.001');

  const d = new Date(2026, 6, 20, 9, 5);
  assert.equal(formatDateID(d), '20 Jul 2026');
  assert.equal(formatTimeID(d), '09:05');
  assert.equal(formatDateTimeID(d), '20 Jul 2026, 09:05');

  assert.equal(formatDateID('2026-01-05T00:00:00'), '5 Jan 2026');
});
