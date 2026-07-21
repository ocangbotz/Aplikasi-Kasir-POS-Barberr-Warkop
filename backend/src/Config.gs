/**
 * Config.gs
 * Konstanta global aplikasi Kasir Barber & Warkop.
 * Semua modul lain membaca konfigurasi dari sini agar tidak ada "magic string".
 */

var APP_CONFIG = {
  APP_NAME: 'Kasir Barber & Warkop',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_TTL_HOURS: 12,
  DEFAULT_LOW_STOCK_THRESHOLD: 5,
  // 1 poin loyalti didapat tiap kelipatan belanja segini (Rupiah).
  LOYALTY_RUPIAH_PER_POINT: 10000
};

// Nama-nama sheet -- HARUS sinkron dengan SetupDatabase.gs
var SHEETS = {
  DASHBOARD: 'Dashboard',
  TRANSAKSI_BARBER: 'Transaksi Barber',
  TRANSAKSI_WARKOP: 'Transaksi Warkop',
  PENGELUARAN_BARBER: 'Pengeluaran Barber',
  PENGELUARAN_WARKOP: 'Pengeluaran Warkop',
  CAPSTER: 'Capster',
  KASIR: 'Kasir',
  PELANGGAN: 'Pelanggan',
  PRODUK_WARKOP: 'Produk Warkop',
  LAYANAN_BARBER: 'Layanan Barber',
  INVENTORY_BARBER: 'Inventory Barber',
  INVENTORY_WARKOP: 'Inventory Warkop',
  CLOSING_SHIFT: 'Closing Shift',
  AUDIT_LOG: 'Audit Log',
  SETTINGS: 'Settings'
};

// Role & permission matrix
var ROLES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  KASIR: 'Kasir',
  CAPSTER: 'Capster'
};

// Daftar modul/aksi yang dapat dibatasi per role.
// true = boleh akses. Dicek lewat Auth.hasPermission(role, permission).
var PERMISSIONS = {
  Owner: { all: true },
  Admin: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: true,
    inventory: true, pelanggan: true, pengeluaran: true, closingShift: true,
    gajiCapster: true, laporan: true, kelolaLayananProduk: true, kelolaCapster: true,
    kelolaSettings: false, auditLog: true, kelolaUser: false, backupRestore: false,
    editTransaksi: true, hapusTransaksi: false, reopenShift: true
  },
  Kasir: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: true,
    inventory: false, pelanggan: true, pengeluaran: true, closingShift: true,
    gajiCapster: false, laporan: true, kelolaLayananProduk: false, kelolaCapster: false,
    kelolaSettings: false, auditLog: false, kelolaUser: false, backupRestore: false,
    editTransaksi: false, hapusTransaksi: false, reopenShift: false
  },
  Capster: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: false,
    inventory: false, pelanggan: true, pengeluaran: false, closingShift: false,
    gajiCapster: false, laporan: false, kelolaLayananProduk: false, kelolaCapster: false,
    kelolaSettings: false, auditLog: false, kelolaUser: false, backupRestore: false,
    editTransaksi: false, hapusTransaksi: false, reopenShift: false
  }
};

var USAHA = {
  BARBER: 'Barber',
  WARKOP: 'Warkop'
};

var METODE_BAYAR = {
  CASH: 'Cash',
  QRIS: 'QRIS'
};

var STATUS_TRANSAKSI = {
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
};

var KATEGORI_PENGELUARAN = [
  'Operasional', 'Gaji', 'Sewa', 'Listrik & Air', 'Belanja Stok',
  'Maintenance', 'Marketing', 'Lain-lain'
];

/**
 * Mengambil ID Spreadsheet database.
 * Disimpan di Script Properties supaya tidak hardcode di kode.
 */
function getDatabaseId_() {
  var id = PropertiesService.getScriptProperties().getProperty('DATABASE_SPREADSHEET_ID');
  if (!id) {
    throw new AppError_('CONFIG_ERROR', 'DATABASE_SPREADSHEET_ID belum diatur. Jalankan SetupDatabase terlebih dahulu.');
  }
  return id;
}

function getDatabase_() {
  return SpreadsheetApp.openById(getDatabaseId_());
}
