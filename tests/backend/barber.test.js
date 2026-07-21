const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTransaksiBarberPayload_, buildTransaksiBarberEditPatch_ } = require('../../backend/gas/Barber.js');

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

test('buildTransaksiBarberEditPatch_ hanya menyertakan field yang dikirim & men-sanitize teks', () => {
  const patch = buildTransaksiBarberEditPatch_({ catatan: '  Diskon karyawan  ' });
  assert.deepEqual(Object.keys(patch), ['Catatan']);
  assert.equal(patch.Catatan, 'Diskon karyawan');
});

test('buildTransaksiBarberEditPatch_ mengabaikan field finansial/nominal walau dikirim di payload', () => {
  const patch = buildTransaksiBarberEditPatch_({
    catatan: 'ok',
    grandTotal: 999999,
    items: [{ layananId: 'LYN-X', qty: 99 }],
    metodeBayar: 'QRIS'
  });
  assert.deepEqual(Object.keys(patch), ['Catatan']);
});

test('buildTransaksiBarberEditPatch_ bisa mengoreksi nama & no HP pelanggan sekaligus', () => {
  const patch = buildTransaksiBarberEditPatch_({ namaPelanggan: 'Budi Santoso', noHp: '081234567890' });
  assert.equal(patch.NamaPelanggan, 'Budi Santoso');
  assert.equal(patch.NoHP, '081234567890');
});
