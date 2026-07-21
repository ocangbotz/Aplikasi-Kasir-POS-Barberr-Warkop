/**
 * Db.js — akses generik ke Google Sheet sebagai "tabel".
 *
 * `rowToObject` dan `objectToRow` murni (tanpa SpreadsheetApp) sehingga diuji
 * lewat Node. Sisanya (getSheet, appendRow, updateById, dst.) memanggil
 * SpreadsheetApp/LockService langsung sehingga hanya bisa diverifikasi setelah
 * deploy ke Apps Script sungguhan — ditulis setipis & sesederhana mungkin agar
 * mudah direview manual.
 */

/** Ubah 1 baris (array nilai) + header menjadi object {header: value}. */
function rowToObject(headers, rowArray) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = rowArray[i] !== undefined ? rowArray[i] : '';
  }
  return obj;
}

/** Ubah object menjadi array nilai sesuai urutan header (field yang tidak ada di object -> ''). */
function objectToRow(headers, obj) {
  var row = new Array(headers.length);
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var v = obj[key];
    row[i] = v === undefined || v === null ? '' : v;
  }
  return row;
}

/** Terapkan patch (partial object) ke row object yang sudah ada, hanya field yang dikenal header yang dipakai. */
function applyPatch(existingObj, patch) {
  var merged = {};
  for (var key in existingObj) merged[key] = existingObj[key];
  for (var pkey in patch) {
    if (Object.prototype.hasOwnProperty.call(existingObj, pkey)) merged[pkey] = patch[pkey];
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Bagian di bawah ini HANYA berjalan di Apps Script (memakai SpreadsheetApp /
// LockService). Tidak diberi module.exports guard karena tidak bisa dieksekusi
// di Node — diverifikasi lewat code review + smoke test manual pasca-deploy.
// ---------------------------------------------------------------------------

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetOrThrow_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw createAppError('SHEET_NOT_FOUND', 'Sheet "' + sheetName + '" tidak ditemukan. Jalankan setupDatabase() terlebih dahulu.');
  }
  return sheet;
}

function getHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/** Baca seluruh baris data (tanpa header) sebagai array of object. */
function dbGetAll(sheetName, options) {
  var opts = options || {};
  var sheet = getSheetOrThrow_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var obj = rowToObject(headers, values[i]);
    if (!opts.includeDeleted && obj.Deleted === true) continue;
    rows.push(obj);
  }
  return rows;
}

/** Baca satu halaman data (untuk pagination di modul Laporan/Transaksi agar tetap cepat pada data besar). */
function dbGetPage(sheetName, offset, limit) {
  var sheet = getSheetOrThrow_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var headers = getHeaders_(sheet);
  var startRow = 2 + offset;
  if (startRow > lastRow) return [];
  var numRows = Math.min(limit, lastRow - startRow + 1);
  var values = sheet.getRange(startRow, 1, numRows, headers.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) rows.push(rowToObject(headers, values[i]));
  return rows;
}

function dbFindByField(sheetName, fieldName, value) {
  var all = dbGetAll(sheetName, { includeDeleted: true });
  for (var i = 0; i < all.length; i++) {
    if (all[i][fieldName] === value) return all[i];
  }
  return null;
}

/**
 * Hitung baris yang cocok fieldName===value (dipakai mis. untuk menentukan
 * urutan nomor transaksi harian). Full-scan — cukup untuk skala sekarang;
 * dioptimasi (index/cache) di Fase 10 kalau data sudah sangat besar.
 */
function dbCountByField(sheetName, fieldName, value) {
  var all = dbGetAll(sheetName, { includeDeleted: true });
  var count = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i][fieldName] === value) count++;
  }
  return count;
}

/** Tambah baris baru. Mengunci script (LockService) agar aman dari race condition multi-kasir. */
function dbAppend(sheetName, obj) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheetOrThrow_(sheetName);
    var headers = getHeaders_(sheet);
    sheet.appendRow(objectToRow(headers, obj));
    return obj;
  } finally {
    lock.releaseLock();
  }
}

/** Update baris berdasarkan kolom ID. Mengembalikan object hasil update, atau null jika tidak ditemukan. */
function dbUpdateById(sheetName, idField, idValue, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheetOrThrow_(sheetName);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var headers = getHeaders_(sheet);
    var idColIndex = headers.indexOf(idField);
    if (idColIndex === -1) throw createAppError('INVALID_SCHEMA', 'Kolom "' + idField + '" tidak ada di sheet "' + sheetName + '"');
    var range = sheet.getRange(2, 1, lastRow - 1, headers.length);
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][idColIndex] === idValue) {
        var existingObj = rowToObject(headers, values[i]);
        var merged = applyPatch(existingObj, patch);
        var newRow = objectToRow(headers, merged);
        sheet.getRange(2 + i, 1, 1, headers.length).setValues([newRow]);
        return merged;
      }
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}

/** Soft delete: set Deleted=true + metadata, tidak menghapus baris fisik (agar bisa direstore Owner). */
function dbSoftDeleteById(sheetName, idField, idValue, deletedBy, nowIso) {
  return dbUpdateById(sheetName, idField, idValue, {
    Deleted: true,
    DeletedAt: nowIso || new Date().toISOString(),
    DeletedBy: deletedBy
  });
}

/** Restore baris yang sebelumnya soft-deleted. */
function dbRestoreById(sheetName, idField, idValue) {
  return dbUpdateById(sheetName, idField, idValue, {
    Deleted: false,
    DeletedAt: '',
    DeletedBy: ''
  });
}

if (typeof module !== 'undefined') {
  module.exports = { rowToObject: rowToObject, objectToRow: objectToRow, applyPatch: applyPatch };
}
