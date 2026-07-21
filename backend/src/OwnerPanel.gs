/**
 * OwnerPanel.gs
 * Kemampuan khusus Owner (dan sebagian Admin): melihat/edit/hapus/restore
 * seluruh transaksi lintas usaha, serta backup & restore seluruh database.
 */

function transaksiSheetFor_(usaha) {
  if (usaha === USAHA.BARBER) return SHEETS.TRANSAKSI_BARBER;
  if (usaha === USAHA.WARKOP) return SHEETS.TRANSAKSI_WARKOP;
  throw new AppError_('VALIDATION_ERROR', 'Usaha harus "Barber" atau "Warkop".');
}

/** Melihat SEMUA transaksi (termasuk yang sudah dihapus) -- untuk Owner Panel. */
function ownerListTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'editTransaksi');
  var sheet = transaksiSheetFor_(payload.usaha);
  var data = getSheetData_(sheet);

  var rows = data.rows.filter(function (r) {
    if (payload.startDate && r.Tanggal < payload.startDate) return false;
    if (payload.endDate && r.Tanggal > payload.endDate) return false;
    return true;
  });
  rows.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

  var page = Math.max(Number(payload.page) || 1, 1);
  var pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 1), 100);
  var start = (page - 1) * pageSize;
  return { transaksi: rows.slice(start, start + pageSize), total: rows.length, page: page, pageSize: pageSize };
}

/** Edit terbatas: Catatan, Diskon (GrandTotal dihitung ulang), dan Status. */
function ownerUpdateTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'editTransaksi');
  requireFields_(payload, ['usaha', 'id']);

  var sheet = transaksiSheetFor_(payload.usaha);
  var row = findRowById_(sheet, payload.id);
  if (!row) throw new AppError_('NOT_FOUND', 'Transaksi tidak ditemukan.');

  var before = Object.assign({}, row);

  if (payload.diskon !== undefined) {
    var diskon = Math.min(Math.max(Number(payload.diskon) || 0, 0), Number(row.Subtotal));
    row.Diskon = diskon;
    row.GrandTotal = round2_(Number(row.Subtotal) - diskon);
  }
  if (payload.catatan !== undefined) row.Catatan = sanitizeString_(payload.catatan);
  if (payload.status !== undefined) {
    if ([STATUS_TRANSAKSI.SELESAI, STATUS_TRANSAKSI.DIBATALKAN].indexOf(payload.status) === -1) {
      throw new AppError_('VALIDATION_ERROR', 'Status transaksi tidak valid.');
    }
    row.Status = payload.status;
  }
  row.UpdatedAt = new Date();

  updateRowObject_(sheet, row._rowIndex, row);
  writeAuditLog_(session, 'EDIT_TRANSAKSI_' + payload.usaha.toUpperCase(), sheet, before, row);
  return { transaksi: row };
}

function ownerDeleteTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'hapusTransaksi');
  requireFields_(payload, ['usaha', 'id']);

  var sheet = transaksiSheetFor_(payload.usaha);
  var row = findRowById_(sheet, payload.id);
  if (!row) throw new AppError_('NOT_FOUND', 'Transaksi tidak ditemukan.');

  row.IsDeleted = true;
  row.UpdatedAt = new Date();
  updateRowObject_(sheet, row._rowIndex, row);
  writeAuditLog_(session, 'DELETE_TRANSAKSI_' + payload.usaha.toUpperCase(), sheet, '', row);
  return { transaksi: row };
}

function ownerRestoreTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'hapusTransaksi');
  requireFields_(payload, ['usaha', 'id']);

  var sheet = transaksiSheetFor_(payload.usaha);
  var row = findRowById_(sheet, payload.id);
  if (!row) throw new AppError_('NOT_FOUND', 'Transaksi tidak ditemukan.');

  row.IsDeleted = false;
  row.UpdatedAt = new Date();
  updateRowObject_(sheet, row._rowIndex, row);
  writeAuditLog_(session, 'RESTORE_TRANSAKSI_' + payload.usaha.toUpperCase(), sheet, '', row);
  return { transaksi: row };
}

/** Backup: dump seluruh sheet (kecuali kredensial) sebagai JSON, diunduh klien sebagai file. */
function ownerBackupData_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'backupRestore');

  var dump = { exportedAt: new Date().toISOString(), sheets: {} };
  Object.keys(SHEET_SCHEMAS_).forEach(function (sheetName) {
    var rows = getSheetData_(sheetName).rows.map(function (r) {
      var clean = Object.assign({}, r);
      delete clean._rowIndex;
      if (sheetName === SHEETS.KASIR) { delete clean.PasswordHash; delete clean.PasswordSalt; }
      return clean;
    });
    dump.sheets[sheetName] = rows;
  });

  writeAuditLog_(session, 'BACKUP_DATABASE', 'Database', '', { sheets: Object.keys(dump.sheets) });
  return { backup: dump };
}

/**
 * Restore: menimpa isi sheet dari hasil backup sebelumnya. SANGAT DESTRUKTIF
 * -- hanya Owner, dan sengaja TIDAK bisa memulihkan Kasir (kredensial login)
 * lewat jalur ini supaya Owner tidak pernah terkunci dari akunnya sendiri.
 */
function ownerRestoreData_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'backupRestore');
  requireFields_(payload, ['backup']);
  if (!payload.confirm) {
    throw new AppError_('VALIDATION_ERROR', 'Konfirmasi restore diperlukan (confirm=true) -- aksi ini menimpa seluruh data.');
  }

  var backup = payload.backup;
  if (!backup || !backup.sheets) throw new AppError_('VALIDATION_ERROR', 'Format file backup tidak valid.');

  var restoredSheets = [];
  Object.keys(backup.sheets).forEach(function (sheetName) {
    if (sheetName === SHEETS.KASIR) return; // lindungi kredensial login dari restore
    if (!SHEET_SCHEMAS_[sheetName]) return; // abaikan sheet tak dikenal

    var sheet = getDatabase_().getSheetByName(sheetName);
    var headers = SHEET_SCHEMAS_[sheetName];
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();

    var rows = backup.sheets[sheetName] || [];
    if (rows.length > 0) {
      var values = rows.map(function (obj) { return objectToRow_(headers, obj); });
      sheet.getRange(2, 1, values.length, headers.length).setValues(values);
    }
    restoredSheets.push(sheetName);
  });

  writeAuditLog_(session, 'RESTORE_DATABASE', 'Database', '', { sheets: restoredSheets });
  return { restored: restoredSheets };
}
