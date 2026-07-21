const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateId,
  formatDateYMD,
  formatTimeHM,
  generateTransactionNumber,
  sanitizeString,
  toSafeNumber,
  roundCurrency,
  formatRupiah,
  resolveDateRangeFilter,
  isWithinRange
} = require('../../backend/gas/Utils.js');

test('generateId menghasilkan ID unik & sesuai prefix', () => {
  const id1 = generateId('USR', () => new Date(2026, 0, 1, 10, 0, 0), () => 0.1);
  const id2 = generateId('USR', () => new Date(2026, 0, 1, 10, 0, 0), () => 0.9);
  assert.ok(id1.startsWith('USR-'));
  assert.notEqual(id1, id2, 'ID dengan random berbeda harus menghasilkan ID berbeda');
});

test('formatDateYMD & formatTimeHM memakai komponen lokal (bukan UTC)', () => {
  const d = new Date(2026, 6, 20, 9, 5, 0); // 20 Juli 2026, 09:05 lokal
  assert.equal(formatDateYMD(d), '2026-07-20');
  assert.equal(formatTimeHM(d), '09:05');
});

test('generateTransactionNumber format & urutan benar', () => {
  const d = new Date(2026, 6, 20);
  assert.equal(generateTransactionNumber('Barber', d, 0), 'TRX-BRB-20260720-0001');
  assert.equal(generateTransactionNumber('Warkop', d, 4), 'TRX-WRK-20260720-0005');
});

test('sanitizeString membuang tag HTML/script (mencegah stored XSS)', () => {
  assert.equal(sanitizeString('<script>alert(1)</script>Budi'), 'alert(1)Budi');
  assert.equal(sanitizeString('  Nama Pelanggan  '), 'Nama Pelanggan');
  assert.equal(sanitizeString('<img src=x onerror=alert(1)>'), '');
  assert.equal(sanitizeString(null), '');
  assert.equal(sanitizeString('a'.repeat(600), 10).length, 10);
});

test('toSafeNumber menangani input invalid & batas min/max', () => {
  assert.equal(toSafeNumber('100', 0), 100);
  assert.equal(toSafeNumber('abc', 5), 5);
  assert.equal(toSafeNumber(-10, 0, { min: 0 }), 0);
  assert.equal(toSafeNumber(-10, 99, { min: 0, clamp: true }), 0);
  assert.equal(toSafeNumber(9999, 0, { max: 100, clamp: true }), 100);
});

test('roundCurrency & formatRupiah', () => {
  assert.equal(roundCurrency(12000.4), 12000);
  assert.equal(roundCurrency(12000.6), 12001);
  assert.equal(formatRupiah(12000), 'Rp 12.000');
  assert.equal(formatRupiah(1000000), 'Rp 1.000.000');
  assert.equal(formatRupiah(-5000), '-Rp 5.000');
  assert.equal(formatRupiah(0), 'Rp 0');
});

test('resolveDateRangeFilter: today/yesterday/week/month/year/custom', () => {
  const ref = new Date(2026, 6, 20, 15, 30); // Senin, 20 Juli 2026

  const today = resolveDateRangeFilter('today', null, null, ref);
  assert.equal(formatDateYMD(today.start), '2026-07-20');
  assert.equal(formatDateYMD(today.end), '2026-07-20');

  const yesterday = resolveDateRangeFilter('yesterday', null, null, ref);
  assert.equal(formatDateYMD(yesterday.start), '2026-07-19');
  assert.equal(formatDateYMD(yesterday.end), '2026-07-19');

  const week = resolveDateRangeFilter('week', null, null, ref);
  assert.equal(formatDateYMD(week.start), '2026-07-20', 'Senin 20 Juli adalah awal minggu itu sendiri');
  assert.equal(formatDateYMD(week.end), '2026-07-20');

  const wedRef = new Date(2026, 6, 22, 8, 0); // Rabu, 22 Juli 2026
  const weekWed = resolveDateRangeFilter('week', null, null, wedRef);
  assert.equal(formatDateYMD(weekWed.start), '2026-07-20', 'Minggu mulai Senin');
  assert.equal(formatDateYMD(weekWed.end), '2026-07-22');

  const month = resolveDateRangeFilter('month', null, null, ref);
  assert.equal(formatDateYMD(month.start), '2026-07-01');
  assert.equal(formatDateYMD(month.end), '2026-07-20');

  const year = resolveDateRangeFilter('year', null, null, ref);
  assert.equal(formatDateYMD(year.start), '2026-01-01');
  assert.equal(formatDateYMD(year.end), '2026-07-20');

  const custom = resolveDateRangeFilter('custom', '2026-01-05', '2026-01-10', ref);
  assert.equal(formatDateYMD(custom.start), '2026-01-05');
  assert.equal(formatDateYMD(custom.end), '2026-01-10');

  assert.throws(() => resolveDateRangeFilter('custom', null, null, ref));
  assert.throws(() => resolveDateRangeFilter('unknown-filter', null, null, ref));
});

test('isWithinRange inklusif di kedua ujung', () => {
  const start = new Date(2026, 6, 20, 0, 0, 0, 0);
  const end = new Date(2026, 6, 20, 23, 59, 59, 999);
  assert.equal(isWithinRange(new Date(2026, 6, 20, 0, 0, 0, 0), start, end), true);
  assert.equal(isWithinRange(new Date(2026, 6, 20, 23, 59, 59, 999), start, end), true);
  assert.equal(isWithinRange(new Date(2026, 6, 19, 23, 59, 59, 999), start, end), false);
  assert.equal(isWithinRange(new Date(2026, 6, 21, 0, 0, 0, 0), start, end), false);
});
