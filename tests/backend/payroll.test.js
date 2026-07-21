const test = require('node:test');
const assert = require('node:assert/strict');
const { computeGajiTotal_ } = require('../../backend/gas/Payroll.js');

test('computeGajiTotal_: bagi hasil dasar tanpa bonus/potongan', () => {
  const r = computeGajiTotal_(1000000, 40, 0, 0, 0);
  assert.equal(r.bagiHasilAmount, 400000);
  assert.equal(r.totalGaji, 400000);
});

test('computeGajiTotal_: dengan bonus & potongan & keterlambatan', () => {
  const r = computeGajiTotal_(1000000, 40, 50000, 20000, 10000);
  assert.equal(r.bagiHasilAmount, 400000);
  assert.equal(r.totalGaji, 420000); // 400000+50000-20000-10000
});

test('computeGajiTotal_: pendapatan 0 -> gaji hanya dari bonus dikurangi potongan', () => {
  const r = computeGajiTotal_(0, 40, 100000, 10000, 0);
  assert.equal(r.bagiHasilAmount, 0);
  assert.equal(r.totalGaji, 90000);
});

test('computeGajiTotal_: potongan+keterlambatan lebih besar dari bagi hasil -> gaji bisa negatif (butuh review manual)', () => {
  const r = computeGajiTotal_(100000, 10, 0, 50000, 0);
  assert.equal(r.bagiHasilAmount, 10000);
  assert.equal(r.totalGaji, -40000);
});

test('computeGajiTotal_: pembulatan Rupiah benar (bagi hasil desimal)', () => {
  const r = computeGajiTotal_(100000, 33, 0, 0, 0);
  assert.equal(r.bagiHasilAmount, 33000);
});
