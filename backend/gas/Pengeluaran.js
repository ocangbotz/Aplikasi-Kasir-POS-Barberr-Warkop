/**
 * Pengeluaran.js — input pengeluaran Barber/Warkop (dipisah sheet-nya, logika
 * sama) + upload foto nota ke Google Drive. GAS-only.
 */

function pengeluaranSheetFor_(jenisUsaha) {
  if (jenisUsaha === JENIS_USAHA.BARBER) return SHEET.PENGELUARAN_BARBER;
  if (jenisUsaha === JENIS_USAHA.WARKOP) return SHEET.PENGELUARAN_WARKOP;
  throw createAppError('VALIDATION_ERROR', 'jenisUsaha harus "Barber" atau "Warkop".');
}

function getOrCreateNotaFolder_(jenisUsaha) {
  var rootName = 'POS Barber Warkop - Nota Pengeluaran';
  var rootIter = DriveApp.getFoldersByName(rootName);
  var root = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(rootName);
  var subIter = root.getFoldersByName(jenisUsaha);
  return subIter.hasNext() ? subIter.next() : root.createFolder(jenisUsaha);
}

/** Upload foto nota (base64, dikirim frontend lewat FileReader) ke Drive, kembalikan URL. */
function uploadFotoNota_(base64Data, mimeType, jenisUsaha) {
  var folder = getOrCreateNotaFolder_(jenisUsaha);
  var contentType = mimeType || 'image/jpeg';
  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, contentType, 'nota-' + Date.now());
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function createPengeluaran(payload, actor) {
  assertRequiredFields(payload, ['jenisUsaha', 'nominal', 'kategori', 'tanggal']);
  var sheetName = pengeluaranSheetFor_(payload.jenisUsaha);

  var fotoUrl = '';
  if (payload.fotoBase64) {
    fotoUrl = uploadFotoNota_(payload.fotoBase64, payload.fotoMimeType, payload.jenisUsaha);
  }

  var pengeluaran = {
    PengeluaranID: generateId('EXP'),
    Tanggal: payload.tanggal,
    Nominal: toSafeNumber(payload.nominal, 0, { min: 0, clamp: true }),
    Kategori: sanitizeString(payload.kategori, 100),
    Keterangan: sanitizeString(payload.keterangan, 500),
    FotoNotaUrl: fotoUrl,
    InputOleh: actor.name,
    ShiftID: '',
    CreatedAt: new Date().toISOString(),
    Deleted: false
  };

  dbAppend(sheetName, pengeluaran);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'pengeluaran.create', module: 'Pengeluaran ' + payload.jenisUsaha, targetId: pengeluaran.PengeluaranID,
    detail: { nominal: pengeluaran.Nominal, kategori: pengeluaran.Kategori }, result: 'Success'
  });
  return pengeluaran;
}

function listPengeluaran(jenisUsaha, filterOptions) {
  var sheetName = pengeluaranSheetFor_(jenisUsaha);
  var opts = filterOptions || {};
  var all = dbGetAll(sheetName);

  if (opts.filterType) {
    var range = resolveDateRangeFilter(opts.filterType, opts.customStart, opts.customEnd);
    all = all.filter(function (p) { return isWithinRange(new Date(p.Tanggal), range.start, range.end); });
  }

  all.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  return all;
}
