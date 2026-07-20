/**
 * Backup.js — backup & restore seluruh Spreadsheet. Hanya boleh dipanggil
 * setelah RBAC check (Owner-only, lihat ACTIONS.BACKUP_CREATE/BACKUP_RESTORE
 * di Validation.js) yang dilakukan router (Code.js) sebelum sampai ke sini.
 */

/** Duplikat seluruh spreadsheet aktif sebagai file Drive baru bernama "Backup - ... - <timestamp>". */
function createBackup(triggeredBy) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  var name = 'Backup - ' + ss.getName() + ' - ' + timestamp;
  var file = DriveApp.getFileById(ss.getId()).makeCopy(name);

  logAudit({
    userId: triggeredBy.uid, userName: triggeredBy.name, role: triggeredBy.role,
    action: 'backup.create', module: 'Backup', targetId: file.getId(),
    detail: { fileName: name }, result: 'Success'
  });

  return { fileId: file.getId(), fileName: name, url: file.getUrl() };
}

/**
 * Restore data dari file backup (hasil createBackup) ke spreadsheet yang sedang aktif.
 * DESTRUKTIF terhadap data sheet yang cocok namanya — karena itu:
 *  1. Selalu membuat backup pengaman dari kondisi SEKARANG dulu sebelum menimpa apa pun.
 *  2. Menimpa isi sheet per-sheet (clear + copy values) hanya untuk sheet yang namanya
 *     dikenali skema (Object.keys(COLUMNS)) — sheet lain di file backup diabaikan.
 *  3. Mencatat seluruh proses ke Audit Log.
 */
function restoreFromBackup(backupFileId, triggeredBy) {
  var currentSs = SpreadsheetApp.getActiveSpreadsheet();

  var safetyBackup = createBackup(triggeredBy); // jaring pengaman sebelum aksi destruktif

  var backupFile = DriveApp.getFileById(backupFileId);
  var backupSs = SpreadsheetApp.open(backupFile);
  var sheetNames = Object.keys(COLUMNS);
  var restoredSheets = [];

  sheetNames.forEach(function (name) {
    var srcSheet = backupSs.getSheetByName(name);
    if (!srcSheet) return;
    var destSheet = currentSs.getSheetByName(name);
    if (!destSheet) destSheet = currentSs.insertSheet(name);
    destSheet.clearContents();
    var lastRow = srcSheet.getLastRow();
    var lastCol = srcSheet.getLastColumn();
    if (lastRow > 0 && lastCol > 0) {
      var values = srcSheet.getRange(1, 1, lastRow, lastCol).getValues();
      destSheet.getRange(1, 1, lastRow, lastCol).setValues(values);
      destSheet.setFrozenRows(1);
    }
    restoredSheets.push(name);
  });

  logAudit({
    userId: triggeredBy.uid, userName: triggeredBy.name, role: triggeredBy.role,
    action: 'backup.restore', module: 'Backup', targetId: backupFileId,
    detail: { restoredSheets: restoredSheets, safetyBackupFileId: safetyBackup.fileId },
    result: 'Success'
  });

  return { restoredSheets: restoredSheets, safetyBackupFileId: safetyBackup.fileId };
}
