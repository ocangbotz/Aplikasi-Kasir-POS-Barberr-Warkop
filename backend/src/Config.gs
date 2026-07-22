/**
 * Config.gs
 * Konstanta global aplikasi Kasir Barber & Warkop.
 * Semua modul lain membaca konfigurasi dari sini agar tidak ada "magic string".
 */

var APP_CONFIG = {
  APP_NAME: 'Kasir Barber & Warkop',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Makassar',
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
  GAJI_CAPSTER: 'Gaji Capster',
  AUDIT_LOG: 'Audit Log',
  SETTINGS: 'Settings'
};

// Role & permission matrix
// Fase awal punya 4 role (Owner/Admin/Kasir/Capster). Atas permintaan pemilik
// usaha, role Admin & Capster (LOGIN role -- beda dengan entitas Capster/
// karyawan potong rambut di SHEETS.CAPSTER yang tetap ada) dihapus; semua
// kewenangan yang dulu dimiliki Admin sekarang melekat langsung ke Kasir.
var ROLES = {
  OWNER: 'Owner',
  KASIR: 'Kasir'
};

// Daftar modul/aksi yang dapat dibatasi per role.
// true = boleh akses. Dicek lewat Auth.hasPermission(role, permission).
// Beberapa kewenangan Admin lama SENGAJA TIDAK ikut digabung ke Kasir, tetap
// khusus Owner Panel (Owner-only), atas permintaan pemilik usaha:
// - reopenShift: shift yang sudah ditutup tidak boleh dibuka lagi oleh Kasir.
// - editTransaksi & auditLog: mengedit transaksi lama dan melihat jejak
//   aktivitas seluruh akun tetap kewenangan Owner saja.
var PERMISSIONS = {
  Owner: { all: true },
  Kasir: {
    dashboard: true, transaksiBarber: true, transaksiWarkop: true,
    inventory: true, pelanggan: true, pengeluaran: true, closingShift: true,
    gajiCapster: true, laporan: true, kelolaLayananProduk: true, kelolaCapster: true,
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

var SHIFT_STATUS = {
  TERBUKA: 'Terbuka',
  DITUTUP: 'Ditutup'
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
