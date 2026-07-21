const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTransaksiBarberPayload_ } = require('../../backend/gas/Barber.js');

test('validateTransaksiBarberPayload_ menolak field wajib yang kosong', () => {
  assert.throws(() => validateTransaksiBarberPayload_({}), /Field wajib belum diisi/);
  assert.throws(
    () => validateTransaksiBarberPayload_({ namaPelanggan: 'Budi', capsterId: 'CPS-1', metodeBayar: 'Cash' }),
    /Field wajib belum diisi/
  );
});

test('validateTransaksiBarberPayload_ menolak items kosong atau bukan array', () => {
  const base = { namaPelanggan: 'Budi', capsterId: 'CPS-1', metodeBayar: 'Cash' };
  assert.throws(() => validateTransaksiBarberPayload_({ ...base, items: [] }), /Minimal 1 layanan/);
  assert.throws(() => validateTransaksiBarberPayload_({ ...base, items: 'bukan-array' }), /Minimal 1 layanan/);
});

test('validateTransaksiBarberPayload_ menolak item tanpa layananId atau qty <= 0', () => {
  const base = { namaPelanggan: 'Budi', capsterId: 'CPS-1', metodeBayar: 'Cash' };
  assert.throws(() => validateTransaksiBarberPayload_({ ...base, items: [{ qty: 1 }] }), /layananId & qty/);
  assert.throws(() => validateTransaksiBarberPayload_({ ...base, items: [{ layananId: 'LYN-1', qty: 0 }] }), /layananId & qty/);
});

test('validateTransaksiBarberPayload_ menerima payload valid tanpa error', () => {
  const base = { namaPelanggan: 'Budi', capsterId: 'CPS-1', metodeBayar: 'Cash', items: [{ layananId: 'LYN-1', qty: 2 }] };
  assert.doesNotThrow(() => validateTransaksiBarberPayload_(base));
});
