const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLES } = require('../../backend/gas/Config.js');
const {
  ACTIONS,
  hasPermission,
  assertPermission,
  findMissingFields,
  assertRequiredFields,
  validateLoginPayload,
  createAppError
} = require('../../backend/gas/Validation.js');

test('createAppError menempelkan .code ke Error', () => {
  const err = createAppError('VALIDATION_ERROR', 'pesan');
  assert.ok(err instanceof Error);
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.equal(err.message, 'pesan');
});

test('findMissingFields & assertRequiredFields', () => {
  assert.deepEqual(findMissingFields({ a: 1, b: '' }, ['a', 'b', 'c']), ['b', 'c']);
  assert.deepEqual(findMissingFields({ a: 1, b: 2, c: 3 }, ['a', 'b', 'c']), []);
  assert.throws(() => assertRequiredFields({ a: 1 }, ['a', 'b']), /Field wajib belum diisi: b/);
  assert.doesNotThrow(() => assertRequiredFields({ a: 1, b: 2 }, ['a', 'b']));
});

test('validateLoginPayload mewajibkan username & password, dan mensanitasi username', () => {
  assert.throws(() => validateLoginPayload({ username: 'budi' }), /password/);
  const result = validateLoginPayload({ username: '  <b>budi</b>  ', password: 'secret123' });
  assert.equal(result.username, 'budi');
  assert.equal(result.password, 'secret123');
});

test('RBAC matriks: Owner boleh semua action yang terdaftar', () => {
  Object.values(ACTIONS).forEach((action) => {
    assert.equal(hasPermission(ROLES.OWNER, action), true, `Owner harus boleh melakukan ${action}`);
  });
});

test('RBAC matriks: Kasir boleh transaksi.create tapi tidak boleh edit/hapus/restore transaksi', () => {
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.TRANSAKSI_CREATE), true);
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.TRANSAKSI_UPDATE), false);
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.TRANSAKSI_DELETE), false);
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.TRANSAKSI_RESTORE), false);
});

test('RBAC matriks: hanya Owner yang boleh kelola user & backup/restore', () => {
  [ACTIONS.USERS_CREATE, ACTIONS.USERS_UPDATE, ACTIONS.USERS_LIST, ACTIONS.USERS_SET_ROLE, ACTIONS.BACKUP_CREATE, ACTIONS.BACKUP_RESTORE].forEach((action) => {
    assert.equal(hasPermission(ROLES.OWNER, action), true);
    assert.equal(hasPermission(ROLES.ADMIN, action), false, `Admin tidak boleh ${action}`);
    assert.equal(hasPermission(ROLES.KASIR, action), false);
    assert.equal(hasPermission(ROLES.CAPSTER, action), false);
  });
});

test('RBAC matriks: Admin boleh reopen shift & lihat audit log, Kasir tidak', () => {
  assert.equal(hasPermission(ROLES.ADMIN, ACTIONS.SHIFT_REOPEN), true);
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.SHIFT_REOPEN), false);
  assert.equal(hasPermission(ROLES.ADMIN, ACTIONS.AUDITLOG_LIST), true);
  assert.equal(hasPermission(ROLES.KASIR, ACTIONS.AUDITLOG_LIST), false);
});

test('RBAC matriks: Capster hanya boleh lihat gaji/performa sendiri, tidak boleh bikin transaksi', () => {
  assert.equal(hasPermission(ROLES.CAPSTER, ACTIONS.PAYROLL_VIEW_SELF), true);
  assert.equal(hasPermission(ROLES.CAPSTER, ACTIONS.TRANSAKSI_CREATE), false);
  assert.equal(hasPermission(ROLES.CAPSTER, ACTIONS.DASHBOARD_VIEW), false);
  assert.equal(hasPermission(ROLES.CAPSTER, ACTIONS.PAYROLL_VIEW_ALL), false);
});

test('hasPermission mengembalikan false untuk action yang tidak terdaftar (fail-closed)', () => {
  assert.equal(hasPermission(ROLES.OWNER, 'action.tidak.ada'), false);
});

test('assertPermission melempar AppError FORBIDDEN jika tidak berhak', () => {
  try {
    assertPermission(ROLES.KASIR, ACTIONS.BACKUP_RESTORE);
    assert.fail('harusnya melempar error');
  } catch (err) {
    assert.equal(err.code, 'FORBIDDEN');
  }
});
