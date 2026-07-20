const test = require('node:test');
const assert = require('node:assert/strict');
const { SHEET, COLUMNS, ROLES, ALL_ROLES, DEFAULT_SETTINGS } = require('../../backend/gas/Config.js');

test('setiap nama sheet di SHEET punya definisi kolom di COLUMNS', () => {
  Object.keys(SHEET).forEach((key) => {
    const sheetName = SHEET[key];
    assert.ok(Array.isArray(COLUMNS[sheetName]), `COLUMNS['${sheetName}'] harus berupa array`);
    assert.ok(COLUMNS[sheetName].length > 0, `COLUMNS['${sheetName}'] tidak boleh kosong`);
  });
});

test('total sheet yang didefinisikan sesuai skema (18 sheet)', () => {
  assert.equal(Object.keys(SHEET).length, 18);
  assert.equal(Object.keys(COLUMNS).length, 18);
});

test('tidak ada nama kolom duplikat dalam satu sheet', () => {
  Object.keys(COLUMNS).forEach((sheetName) => {
    const cols = COLUMNS[sheetName];
    const unique = new Set(cols);
    assert.equal(unique.size, cols.length, `Ada kolom duplikat di sheet '${sheetName}'`);
  });
});

test('sheet transaksi & pengeluaran punya kolom soft-delete untuk restore Owner', () => {
  ['Transaksi Barber', 'Transaksi Warkop', 'Pengeluaran Barber', 'Pengeluaran Warkop'].forEach((sheetName) => {
    const cols = COLUMNS[sheetName];
    assert.ok(cols.includes('Deleted'), `${sheetName} harus punya kolom Deleted`);
  });
});

test('ROLES berisi 4 role sesuai spesifikasi', () => {
  assert.deepEqual(new Set(Object.values(ROLES)), new Set(['Owner', 'Admin', 'Kasir', 'Capster']));
  assert.equal(ALL_ROLES.length, 4);
});

test('DEFAULT_SETTINGS punya key unik dan field lengkap', () => {
  const keys = DEFAULT_SETTINGS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'Ada key setting duplikat');
  DEFAULT_SETTINGS.forEach((s) => {
    assert.equal(typeof s.key, 'string');
    assert.notEqual(s.key, '');
    assert.ok('value' in s);
    assert.equal(typeof s.note, 'string');
  });
});
