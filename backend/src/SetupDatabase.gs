/**
 * SetupDatabase.gs
 * Jalankan fungsi setupDatabase() SEKALI dari editor Apps Script untuk membuat
 * seluruh struktur Google Spreadsheet yang dipakai sebagai database.
 * Aman dijalankan berulang: sheet yang sudah ada & sudah punya header tidak ditimpa.
 */

var SHEET_SCHEMAS_ = {};
SHEET_SCHEMAS_[SHEETS.DASHBOARD] = [
  'Tanggal', 'Usaha', 'Pendapatan', 'Transaksi', 'Cash', 'QRIS', 'Pengeluaran',
  'LabaBersih', 'TotalKepala', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.TRANSAKSI_BARBER] = [
  'ID', 'NomorTransaksi', 'Tanggal', 'Jam', 'NamaPelanggan', 'NoHP', 'PelangganID',
  'CapsterID', 'NamaCapster', 'Layanan', 'Subtotal', 'Diskon', 'GrandTotal',
  'MetodePembayaran', 'Status', 'Catatan', 'KasirID', 'NamaKasir', 'ShiftID',
  'CreatedAt', 'UpdatedAt', 'IsDeleted'
];
SHEET_SCHEMAS_[SHEETS.TRANSAKSI_WARKOP] = [
  'ID', 'NomorTransaksi', 'Tanggal', 'Jam', 'Items', 'Subtotal', 'Diskon', 'GrandTotal',
  'MetodePembayaran', 'SplitBill', 'Status', 'Catatan', 'KasirID', 'NamaKasir',
  'PelangganID', 'ShiftID', 'CreatedAt', 'UpdatedAt', 'IsDeleted'
];
SHEET_SCHEMAS_[SHEETS.PENGELUARAN_BARBER] = [
  'ID', 'Tanggal', 'Nominal', 'Kategori', 'Keterangan', 'FotoNotaURL',
  'InputOlehID', 'InputOleh', 'ShiftID', 'CreatedAt'
];
SHEET_SCHEMAS_[SHEETS.PENGELUARAN_WARKOP] = SHEET_SCHEMAS_[SHEETS.PENGELUARAN_BARBER];
SHEET_SCHEMAS_[SHEETS.CAPSTER] = [
  'ID', 'Nama', 'NoHP', 'PersentaseBagiHasil', 'Status', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.KASIR] = [
  'ID', 'Nama', 'Username', 'PasswordHash', 'PasswordSalt', 'Role', 'CapsterID',
  'Status', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.PELANGGAN] = [
  'ID', 'Nama', 'NoHP', 'TotalKunjungan', 'TotalPengeluaran', 'Member',
  'PoinLoyalti', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.PRODUK_WARKOP] = [
  'ID', 'Nama', 'Kategori', 'Modal', 'HargaJual', 'Margin', 'Stok', 'StokMinimum',
  'StatusAktif', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.LAYANAN_BARBER] = [
  'ID', 'Nama', 'Harga', 'Durasi', 'StatusAktif', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.INVENTORY_BARBER] = [
  'ID', 'NamaItem', 'Kategori', 'Stok', 'StokMinimum', 'Satuan', 'HargaBeli',
  'Supplier', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.INVENTORY_WARKOP] = SHEET_SCHEMAS_[SHEETS.INVENTORY_BARBER];
SHEET_SCHEMAS_[SHEETS.CLOSING_SHIFT] = [
  'ID', 'TanggalShift', 'KasirID', 'NamaKasir', 'JamBuka', 'JamTutup', 'SaldoAwal',
  'CashBarber', 'CashWarkop', 'QRISBarber', 'QRISWarkop', 'PengeluaranBarber',
  'PengeluaranWarkop', 'TotalSeharusnya', 'UangKasFisik', 'SelisihKas',
  'CatatanKasir', 'Status', 'ClosedAt', 'ReopenedBy', 'ReopenedAt'
];
SHEET_SCHEMAS_[SHEETS.GAJI_CAPSTER] = [
  'ID', 'Periode', 'CapsterID', 'NamaCapster', 'PersentaseBagiHasil', 'TotalKepala',
  'Pendapatan', 'BagiHasilAmount', 'Bonus', 'Potongan', 'Keterlambatan', 'TotalGaji',
  'Catatan', 'DibuatOlehID', 'DibuatOleh', 'CreatedAt', 'UpdatedAt'
];
SHEET_SCHEMAS_[SHEETS.AUDIT_LOG] = [
  'ID', 'Timestamp', 'UserID', 'UserName', 'Aksi', 'Modul', 'DataSebelum', 'DataSesudah'
];
SHEET_SCHEMAS_[SHEETS.SETTINGS] = ['Key', 'Value', 'UpdatedAt'];

// Kolom-kolom ini HARUS tetap Plain Text -- isinya string tanggal/jam
// ('yyyy-MM-dd'/'yyyy-MM'/'HH:mm:ss') yang dibandingkan atau di-slice sebagai
// TEKS di banyak tempat (filter periode Dashboard/Laporan, pencocokan bulan
// Gaji Capster, granularitas grafik per jam, dst). Tanpa format Plain Text,
// Google Sheets diam-diam mengonversi nilai yang "terlihat seperti tanggal/jam"
// jadi tipe Date/Time sungguhan saat ditulis, membuat semua perbandingan/method
// teks itu gagal atau crash TANPA error yang jelas (lihat juga rowToObject_ di
// Utils.gs yang menormalkan balik baris LAMA yang mungkin sudah terlanjur ke-convert).
var TEXT_FORMAT_COLUMNS_ = {};
TEXT_FORMAT_COLUMNS_[SHEETS.TRANSAKSI_BARBER] = ['Tanggal', 'Jam'];
TEXT_FORMAT_COLUMNS_[SHEETS.TRANSAKSI_WARKOP] = ['Tanggal', 'Jam'];
TEXT_FORMAT_COLUMNS_[SHEETS.PENGELUARAN_BARBER] = ['Tanggal'];
TEXT_FORMAT_COLUMNS_[SHEETS.PENGELUARAN_WARKOP] = ['Tanggal'];
TEXT_FORMAT_COLUMNS_[SHEETS.CLOSING_SHIFT] = ['TanggalShift'];
TEXT_FORMAT_COLUMNS_[SHEETS.GAJI_CAPSTER] = ['Periode'];
TEXT_FORMAT_COLUMNS_[SHEETS.DASHBOARD] = ['Tanggal'];

var DEFAULT_SETTINGS_ = [
  ['nama_usaha', 'Barber & Warkop'],
  ['alamat', ''],
  ['whatsapp', ''],
  ['instagram', ''],
  ['logo_url', ''],
  ['qris_image_url', ''],
  ['target_pendapatan_bulanan_barber', '0'],
  ['target_pendapatan_bulanan_warkop', '0'],
  ['low_stock_threshold_default', String(APP_CONFIG.DEFAULT_LOW_STOCK_THRESHOLD)]
];

/**
 * Entry point utama. Jalankan dari editor Apps Script (pilih fungsi ini, klik Run).
 * - Jika belum ada Script Property DATABASE_SPREADSHEET_ID, membuat spreadsheet baru.
 * - Membuat semua sheet + header yang belum ada.
 * - Seed Settings default & 1 akun Owner (jika sheet Kasir masih kosong).
 */
function setupDatabase() {
  var ss = getOrCreateDatabaseSpreadsheet_();

  Object.keys(SHEET_SCHEMAS_).forEach(function (sheetName) {
    ensureSheetWithHeaders_(ss, sheetName, SHEET_SCHEMAS_[sheetName]);
  });

  removeDefaultBlankSheet_(ss);
  seedSettingsIfEmpty_();
  var ownerInfo = seedOwnerAccountIfEmpty_();

  var summary = {
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sheetsCreated: Object.keys(SHEET_SCHEMAS_),
    ownerAccountCreated: ownerInfo
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

function getOrCreateDatabaseSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('DATABASE_SPREADSHEET_ID');
  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (e) {
      // ID tersimpan tapi spreadsheet tidak dapat dibuka -- buat baru di bawah.
    }
  }
  var ss = SpreadsheetApp.create('Database Kasir Barber & Warkop');
  props.setProperty('DATABASE_SPREADSHEET_ID', ss.getId());
  return ss;
}

function ensureSheetWithHeaders_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var firstRow = sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
  var hasHeaders = firstRow.some(function (v) { return v !== ''; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  }
  applyTextFormatColumns_(sheet, sheetName, headers);
  return sheet;
}

/** Konversi indeks kolom (1-based) ke huruf kolom A1 (1->A, 27->AA, dst). */
function columnIndexToLetter_(index) {
  var letter = '';
  while (index > 0) {
    var rem = (index - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    index = Math.floor((index - 1) / 26);
  }
  return letter;
}

/**
 * Kunci kolom tanggal-string (lihat TEXT_FORMAT_COLUMNS_) sebagai Plain Text
 * mulai baris 2 sampai akhir kolom (rentang terbuka "C2:C") -- ini juga
 * berlaku untuk baris yang DITAMBAHKAN nanti lewat appendRow(), tidak cuma
 * baris yang sudah ada saat ini. Aman & murah dijalankan berulang.
 */
function applyTextFormatColumns_(sheet, sheetName, headers) {
  var columns = TEXT_FORMAT_COLUMNS_[sheetName];
  if (!columns) return;
  columns.forEach(function (columnName) {
    var colIndex = headers.indexOf(columnName) + 1;
    if (colIndex < 1) return;
    var letter = columnIndexToLetter_(colIndex);
    sheet.getRange(letter + '2:' + letter).setNumberFormat('@');
  });
}

function removeDefaultBlankSheet_(ss) {
  var sheet = ss.getSheetByName('Sheet1');
  if (sheet && ss.getSheets().length > 1) {
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow === 0 && lastCol === 0) {
      ss.deleteSheet(sheet);
    }
  }
}

function seedSettingsIfEmpty_() {
  var data = getSheetData_(SHEETS.SETTINGS);
  if (data.rows.length > 0) return;
  DEFAULT_SETTINGS_.forEach(function (pair) {
    appendRowObject_(SHEETS.SETTINGS, { Key: pair[0], Value: pair[1], UpdatedAt: new Date() });
  });
}

/**
 * Seed 1 akun Owner default agar bisa login pertama kali.
 * Password default HARUS diganti setelah login pertama -- dicetak ke log, bukan disimpan plaintext.
 */
function seedOwnerAccountIfEmpty_() {
  var data = getSheetData_(SHEETS.KASIR);
  if (data.rows.length > 0) return null;

  var defaultPassword = Utilities.getUuid().split('-')[0]; // password acak 8 karakter
  var salt = generateSalt_();
  var hash = hashPassword_(defaultPassword, salt);

  appendRowObject_(SHEETS.KASIR, {
    ID: generateId_('USR'),
    Nama: 'Owner',
    Username: 'owner',
    PasswordHash: hash,
    PasswordSalt: salt,
    Role: ROLES.OWNER,
    CapsterID: '',
    Status: 'Aktif',
    CreatedAt: new Date(),
    UpdatedAt: new Date()
  });

  var credentials = { username: 'owner', password: defaultPassword };
  console.log('AKUN OWNER DIBUAT -- simpan lalu ganti password setelah login pertama: ' + JSON.stringify(credentials));
  return credentials;
}
