/**
 * AuditLog.js — pencatatan aktivitas user (login, edit/hapus/restore transaksi,
 * buka-tutup shift, backup/restore, dsb). Dipanggil dari modul lain, tidak
 * pernah melempar error ke pemanggil (kegagalan logging tidak boleh
 * menggagalkan aksi utama pengguna).
 */

/** Bangun row Audit Log dari entry — murni, diuji lewat Node. */
function buildAuditLogRow(entry, generateIdFn, nowIsoFn) {
  var genId = generateIdFn || generateId;
  var nowIso = nowIsoFn || function () { return new Date().toISOString(); };
  return {
    LogID: genId('LOG'),
    Timestamp: nowIso(),
    UserID: entry.userId || '-',
    NamaUser: entry.userName || '-',
    Role: entry.role || '-',
    Aksi: entry.action,
    Modul: entry.module,
    TargetID: entry.targetId || '',
    Detail: JSON.stringify(entry.detail || {}),
    Hasil: entry.result || 'Success'
  };
}

/**
 * Tulis 1 entry ke sheet Audit Log. entry: { userId, userName, role, action,
 * module, targetId, detail, result }. GAS-only (memanggil dbAppend).
 */
function logAudit(entry) {
  var row = buildAuditLogRow(entry);
  try {
    dbAppend(SHEET.AUDIT_LOG, row);
  } catch (e) {
    Logger.log('Gagal menulis Audit Log: ' + e.message);
  }
}

/**
 * Ambil halaman Audit Log terbaru lebih dulu (newest-first), dihitung dari
 * baris paling bawah sheet supaya tetap efisien walau log sudah sangat besar
 * (tidak perlu membaca & membalik seluruh sheet).
 */
function getAuditLogPage(limit, offset) {
  var sheet = getSheetOrThrow_(SHEET.AUDIT_LOG);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var endRow = lastRow - offset;
  if (endRow < 2) return [];
  var startRow = Math.max(2, endRow - limit + 1);
  var numRows = endRow - startRow + 1;
  var values = sheet.getRange(startRow, 1, numRows, headers.length).getValues();
  var rows = [];
  for (var i = values.length - 1; i >= 0; i--) rows.push(rowToObject(headers, values[i]));
  return rows;
}

if (typeof module !== 'undefined') {
  module.exports = { buildAuditLogRow: buildAuditLogRow };
}
