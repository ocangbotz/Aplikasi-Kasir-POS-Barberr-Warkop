const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAuditLogRow } = require('../../backend/gas/AuditLog.js');

test('buildAuditLogRow menyusun row lengkap & men-serialize detail sebagai JSON', () => {
  const row = buildAuditLogRow(
    {
      userId: 'USR-1',
      userName: 'Budi',
      role: 'Owner',
      action: 'transaksi.delete',
      module: 'Barber',
      targetId: 'TRX-1',
      detail: { alasan: 'salah input' },
      result: 'Success'
    },
    (prefix) => prefix + '-FIXED-ID',
    () => '2026-07-20T10:00:00.000Z'
  );

  assert.equal(row.LogID, 'LOG-FIXED-ID');
  assert.equal(row.Timestamp, '2026-07-20T10:00:00.000Z');
  assert.equal(row.UserID, 'USR-1');
  assert.equal(row.Aksi, 'transaksi.delete');
  assert.equal(row.Detail, JSON.stringify({ alasan: 'salah input' }));
  assert.equal(row.Hasil, 'Success');
});

test('buildAuditLogRow memakai nilai default yang aman jika field opsional kosong', () => {
  const row = buildAuditLogRow({ action: 'auth.login.failed', module: 'Auth' }, (p) => p + '-X', () => 'now');
  assert.equal(row.UserID, '-');
  assert.equal(row.NamaUser, '-');
  assert.equal(row.Role, '-');
  assert.equal(row.TargetID, '');
  assert.equal(row.Detail, '{}');
  assert.equal(row.Hasil, 'Success');
});
