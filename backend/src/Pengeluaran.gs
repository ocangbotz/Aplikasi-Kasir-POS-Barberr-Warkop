/**
 * Pengeluaran.gs
 * Pencatatan pengeluaran, terpisah per usaha (Barber/Warkop). Dipakai oleh
 * Dashboard (Fase 6) untuk menghitung Laba Bersih = Pendapatan - Pengeluaran,
 * dan nanti oleh Closing Shift & Laporan (Fase 7/8).
 */

function pengeluaranSheetFor_(usaha) {
  if (usaha === USAHA.BARBER) return SHEETS.PENGELUARAN_BARBER;
  if (usaha === USAHA.WARKOP) return SHEETS.PENGELUARAN_WARKOP;
  throw new AppError_('VALIDATION_ERROR', 'Usaha harus "Barber" atau "Warkop".');
}

/**
 * Upload foto nota ke Google Drive (opsional). Menerima data URL base64
 * (mis. "data:image/jpeg;base64,...."), mengembalikan URL gambar yang bisa
 * ditampilkan langsung. Mengembalikan '' jika tidak ada foto dikirim.
 */
function uploadNotaPhoto_(dataUrl, filenamePrefix) {
  if (!dataUrl) return '';
  var match = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new AppError_('VALIDATION_ERROR', 'Format foto nota tidak valid.');
  var mimeType = match[1];
  var base64Data = match[2];

  var bytes = Utilities.base64Decode(base64Data);
  var ext = mimeType.split('/')[1] || 'jpg';
  var blob = Utilities.newBlob(bytes, mimeType, filenamePrefix + '-' + Date.now() + '.' + ext);
  var file = DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?id=' + file.getId();
}

function pengeluaranCreate_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'pengeluaran');
  requireFields_(payload, ['usaha', 'nominal', 'kategori', 'tanggal']);

  var sheet = pengeluaranSheetFor_(payload.usaha);
  var nominal = Number(payload.nominal);
  if (!(nominal > 0)) throw new AppError_('VALIDATION_ERROR', 'Nominal pengeluaran harus lebih besar dari 0.');
  if (KATEGORI_PENGELUARAN.indexOf(payload.kategori) === -1) {
    throw new AppError_('VALIDATION_ERROR', 'Kategori pengeluaran tidak valid.');
  }

  var fotoUrl = '';
  if (payload.fotoNotaBase64) {
    fotoUrl = uploadNotaPhoto_(payload.fotoNotaBase64, 'nota-' + payload.usaha.toLowerCase());
  }

  var record = {
    ID: generateId_('PGL'),
    Tanggal: payload.tanggal,
    Nominal: nominal,
    Kategori: payload.kategori,
    Keterangan: sanitizeString_(payload.keterangan),
    FotoNotaURL: fotoUrl,
    InputOlehID: session.userId,
    InputOleh: session.nama,
    ShiftID: payload.shiftId || '',
    CreatedAt: new Date()
  };

  appendRowObject_(sheet, record);
  writeAuditLog_(session, 'CREATE_PENGELUARAN_' + payload.usaha.toUpperCase(), sheet, '', record);
  return { pengeluaran: record };
}

function pengeluaranList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'pengeluaran');
  var sheet = pengeluaranSheetFor_(payload.usaha);
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

  return { pengeluaran: rows.slice(start, start + pageSize), total: rows.length, page: page, pageSize: pageSize };
}

/** Dipakai internal oleh Dashboard.gs -- total nominal pengeluaran dalam rentang tanggal. */
function sumPengeluaranInRange_(sheetName, startDate, endDate) {
  var rows = getSheetData_(sheetName).rows.filter(function (r) {
    return r.Tanggal >= startDate && r.Tanggal <= endDate;
  });
  return round2_(rows.reduce(function (sum, r) { return sum + Number(r.Nominal || 0); }, 0));
}
