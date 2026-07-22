/**
 * Utils.gs
 * Helper murni: response JSON, ID generator, tanggal, mapping sheet<->object,
 * sanitasi input. Tidak menyimpan state, mudah diuji.
 */

/** Error terstruktur supaya frontend bisa membedakan jenis kegagalan. */
function AppError_(code, message) {
  var err = new Error(message);
  err.code = code;
  err.isAppError = true;
  return err;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function successResponse_(data) {
  return jsonResponse_({ ok: true, data: data });
}

function errorResponse_(err) {
  var code = (err && err.code) || 'INTERNAL_ERROR';
  var message = (err && err.message) || 'Terjadi kesalahan tidak terduga.';
  return jsonResponse_({ ok: false, error: { code: code, message: message } });
}

/** ID unik: prefix + timestamp base36 + random 4 karakter. Urut secara waktu. */
function generateId_(prefix) {
  var ts = Date.now().toString(36).toUpperCase();
  var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return (prefix ? prefix + '-' : '') + ts + rand;
}

/** Nomor transaksi ramah-manusia: BRB-20260721-0001 / WRK-20260721-0001 */
function generateTransactionNumber_(usaha, sequence) {
  var prefix = usaha === USAHA.BARBER ? 'BRB' : 'WRK';
  var dateStr = formatDate_(new Date(), 'yyyyMMdd');
  var seq = ('0000' + sequence).slice(-4);
  return prefix + '-' + dateStr + '-' + seq;
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(date, APP_CONFIG.TIMEZONE, pattern);
}

function todayDateString_() {
  return formatDate_(new Date(), 'yyyy-MM-dd');
}

/** Geser tanggal (string yyyy-MM-dd) sejumlah hari (boleh negatif). */
function shiftDateString_(dateStr, days) {
  var d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDate_(d, 'yyyy-MM-dd');
}

/** Senin di minggu yang sama dengan dateStr. */
function startOfWeekString_(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  var day = d.getDay(); // 0=Minggu, 1=Senin, ...
  var diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return formatDate_(d, 'yyyy-MM-dd');
}

function startOfMonthString_(dateStr) {
  return dateStr.slice(0, 7) + '-01';
}

function startOfYearString_(dateStr) {
  return dateStr.slice(0, 4) + '-01-01';
}

function daysBetweenDateStrings_(startStr, endStr) {
  var a = new Date(startStr + 'T00:00:00');
  var b = new Date(endStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

function nowTimeString_() {
  return formatDate_(new Date(), 'HH:mm:ss');
}

// Kolom yang HARUS berupa string tanggal ('yyyy-MM-dd'/'yyyy-MM'), dibandingkan
// sebagai teks di banyak tempat (filter periode, pencocokan bulan gaji, dst).
// Google Sheets kadang diam-diam mengonversi sel yang isinya "terlihat seperti
// tanggal" (mis. "2026-07-22") menjadi tipe Date sungguhan -- getValues() lalu
// mengembalikan objek Date, bukan string aslinya, dan perbandingan string
// (>=, ===, indexOf) jadi salah tanpa error apa pun (silently wrong).
// SetupDatabase.gs sudah memformat kolom ini sebagai Plain Text supaya tidak
// terkonversi LAGI ke depannya, tapi baris yang SUDAH terlanjur tersimpan
// sebagai Date (dibuat sebelum fix ini) tetap perlu dinormalkan di sini setiap
// kali dibaca, supaya data lama juga otomatis benar tanpa perlu dihapus manual.
var DATE_STRING_FIELDS_ = { Tanggal: 'yyyy-MM-dd', TanggalShift: 'yyyy-MM-dd', Periode: 'yyyy-MM' };

/** Ubah baris sheet (array) menjadi object memakai header sebagai key. */
function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var value = row[i] !== undefined ? row[i] : '';
    var datePattern = DATE_STRING_FIELDS_[headers[i]];
    if (datePattern && value instanceof Date) {
      value = formatDate_(value, datePattern);
    }
    obj[headers[i]] = value;
  }
  return obj;
}

/** Ubah object menjadi array baris sesuai urutan header. Field hilang -> ''. */
function objectToRow_(headers, obj) {
  return headers.map(function (h) {
    return obj[h] !== undefined && obj[h] !== null ? obj[h] : '';
  });
}

/** Ambil semua data sheet sebagai array of object (baris 1 = header). */
function getSheetData_(sheetName) {
  var sheet = getDatabase_().getSheetByName(sheetName);
  if (!sheet) throw new AppError_('SHEET_NOT_FOUND', 'Sheet "' + sheetName + '" tidak ditemukan.');
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { sheet: sheet, headers: sheet.getRange(1, 1, 1, lastCol).getValues()[0], rows: [] };
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values.shift();
  var rows = values.map(function (row, idx) {
    var obj = rowToObject_(headers, row);
    obj._rowIndex = idx + 2; // baris asli di sheet (1-based, +1 utk header)
    return obj;
  });
  return { sheet: sheet, headers: headers, rows: rows };
}

function appendRowObject_(sheetName, obj) {
  var data = getSheetData_(sheetName);
  data.sheet.appendRow(objectToRow_(data.headers, obj));
  return obj;
}

function updateRowObject_(sheetName, rowIndex, obj) {
  var data = getSheetData_(sheetName);
  data.sheet.getRange(rowIndex, 1, 1, data.headers.length)
    .setValues([objectToRow_(data.headers, obj)]);
  return obj;
}

function findRowById_(sheetName, id) {
  var data = getSheetData_(sheetName);
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i].ID) === String(id)) return data.rows[i];
  }
  return null;
}

/** Sanitasi string: buang tag HTML/script dan whitespace berlebih -- cegah XSS saat data ditampilkan ulang. */
function sanitizeString_(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/<[^>]*>/g, '').trim();
}

function sanitizeObject_(obj, stringFields) {
  var clean = {};
  for (var key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    clean[key] = stringFields.indexOf(key) !== -1 ? sanitizeString_(obj[key]) : obj[key];
  }
  return clean;
}

function requireFields_(obj, fields) {
  var missing = fields.filter(function (f) {
    return obj[f] === undefined || obj[f] === null || obj[f] === '';
  });
  if (missing.length > 0) {
    throw new AppError_('VALIDATION_ERROR', 'Field wajib diisi: ' + missing.join(', '));
  }
}

function round2_(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}
