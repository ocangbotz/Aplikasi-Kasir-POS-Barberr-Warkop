const test = require('node:test');
const assert = require('node:assert/strict');
const { rowToObject, objectToRow, applyPatch } = require('../../backend/gas/Db.js');

test('rowToObject memetakan array nilai ke object sesuai header', () => {
  const headers = ['UserID', 'Username', 'Aktif'];
  const row = ['USR-1', 'budi', true];
  assert.deepEqual(rowToObject(headers, row), { UserID: 'USR-1', Username: 'budi', Aktif: true });
});

test('rowToObject menangani sel kosong (undefined) sebagai string kosong', () => {
  const headers = ['A', 'B', 'C'];
  const row = ['x'];
  assert.deepEqual(rowToObject(headers, row), { A: 'x', B: '', C: '' });
});

test('objectToRow mengurutkan nilai sesuai header, field tak dikenal diabaikan', () => {
  const headers = ['UserID', 'Username', 'Aktif'];
  const obj = { Username: 'budi', Aktif: true, UserID: 'USR-1', FieldLiar: 'harus diabaikan' };
  assert.deepEqual(objectToRow(headers, obj), ['USR-1', 'budi', true]);
});

test('objectToRow mengisi "" untuk field yang tidak ada di object', () => {
  const headers = ['A', 'B', 'C'];
  assert.deepEqual(objectToRow(headers, { B: 'ada' }), ['', 'ada', '']);
});

test('rowToObject -> objectToRow round-trip', () => {
  const headers = ['ProdukID', 'NamaMenu', 'HargaJual', 'Aktif'];
  const row = ['PRD-1', 'Kopi Susu', 12000, true];
  const obj = rowToObject(headers, row);
  assert.deepEqual(objectToRow(headers, obj), row);
});

test('applyPatch hanya menerapkan field yang sudah dikenal di object asli', () => {
  const existing = { UserID: 'USR-1', FullName: 'Budi', Aktif: true };
  const patched = applyPatch(existing, { FullName: 'Budi Santoso', RoleBaru: 'Owner' });
  assert.deepEqual(patched, { UserID: 'USR-1', FullName: 'Budi Santoso', Aktif: true });
  assert.ok(!('RoleBaru' in patched), 'field yang tidak dikenal skema tidak boleh ikut masuk');
});

test('applyPatch tidak mengubah object asli (immutable)', () => {
  const existing = { A: 1, B: 2 };
  const patched = applyPatch(existing, { A: 99 });
  assert.equal(existing.A, 1, 'object asli tidak boleh termodifikasi');
  assert.equal(patched.A, 99);
});
