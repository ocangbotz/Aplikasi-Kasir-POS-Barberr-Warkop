/**
 * AuditLog.gs
 * Pencatatan seluruh aktivitas penting (login, transaksi, edit, hapus, closing shift, dll).
 */

function writeAuditLog_(user, aksi, modul, dataSebelum, dataSesudah) {
  appendRowObject_(SHEETS.AUDIT_LOG, {
    ID: generateId_('LOG'),
    Timestamp: new Date(),
    UserID: user ? user.ID || user.userId : '',
    UserName: user ? user.Nama || user.nama : 'System',
    Aksi: aksi,
    Modul: modul,
    DataSebelum: typeof dataSebelum === 'string' ? dataSebelum : JSON.stringify(dataSebelum || ''),
    DataSesudah: typeof dataSesudah === 'string' ? dataSesudah : JSON.stringify(dataSesudah || '')
  });
}

function auditLogList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'auditLog');
  var data = getSheetData_(SHEETS.AUDIT_LOG);
  var rows = data.rows.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
  var limit = payload.limit || 200;
  return { logs: rows.slice(0, limit) };
}
