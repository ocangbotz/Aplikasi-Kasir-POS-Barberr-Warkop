/**
 * Config.js — konstanta global backend: nama sheet, kolom, role, default settings.
 * File ini murni deklarasi data (tidak memanggil SpreadsheetApp) sehingga bisa
 * di-load langsung oleh Node untuk testing (lihat guard module.exports di bawah).
 */

var SHEET = {
  SETTINGS: 'Settings',
  USERS: 'Users',
  KASIR: 'Kasir',
  CAPSTER: 'Capster',
  PELANGGAN: 'Pelanggan',
  LAYANAN_BARBER: 'Layanan Barber',
  PRODUK_WARKOP: 'Produk Warkop',
  INVENTORY_BARBER: 'Inventory Barber',
  INVENTORY_WARKOP: 'Inventory Warkop',
  TRANSAKSI_BARBER: 'Transaksi Barber',
  TRANSAKSI_WARKOP: 'Transaksi Warkop',
  PENGELUARAN_BARBER: 'Pengeluaran Barber',
  PENGELUARAN_WARKOP: 'Pengeluaran Warkop',
  CLOSING_SHIFT: 'Closing Shift',
  GAJI_CAPSTER: 'Gaji Capster',
  PROMO_VOUCHER: 'Promo Voucher',
  AUDIT_LOG: 'Audit Log',
  DASHBOARD: 'Dashboard'
};

// Urutan kolom (header row) per sheet — dipakai oleh Setup.js dan Db.js.
var COLUMNS = {};
COLUMNS[SHEET.SETTINGS] = ['Key', 'Value', 'Keterangan'];
COLUMNS[SHEET.USERS] = ['UserID', 'Username', 'PasswordHash', 'PasswordSalt', 'FullName', 'Role', 'LinkedProfileType', 'LinkedProfileID', 'Aktif', 'CreatedAt', 'LastLoginAt'];
COLUMNS[SHEET.KASIR] = ['KasirID', 'Nama', 'Username', 'Aktif', 'CreatedAt'];
COLUMNS[SHEET.CAPSTER] = ['CapsterID', 'Nama', 'Username', 'PersentaseBagiHasil', 'Aktif', 'FotoUrl', 'CreatedAt'];
COLUMNS[SHEET.PELANGGAN] = ['PelangganID', 'Nama', 'NoHP', 'TotalKunjungan', 'TotalPengeluaran', 'Member', 'PoinLoyalti', 'TanggalDaftar', 'CatatanTerakhir'];
COLUMNS[SHEET.LAYANAN_BARBER] = ['LayananID', 'NamaLayanan', 'Harga', 'DurasiMenit', 'Kategori', 'Aktif'];
COLUMNS[SHEET.PRODUK_WARKOP] = ['ProdukID', 'NamaMenu', 'Kategori', 'Modal', 'HargaJual', 'Margin', 'Stok', 'SatuanStok', 'StokMinimum', 'Aktif', 'FotoUrl'];
COLUMNS[SHEET.INVENTORY_BARBER] = ['ItemID', 'NamaItem', 'Kategori', 'Stok', 'SatuanStok', 'StokMinimum', 'HargaBeliTerakhir', 'Supplier', 'UpdatedAt'];
COLUMNS[SHEET.INVENTORY_WARKOP] = ['ItemID', 'NamaItem', 'Kategori', 'Stok', 'SatuanStok', 'StokMinimum', 'HargaBeliTerakhir', 'Supplier', 'UpdatedAt'];
COLUMNS[SHEET.TRANSAKSI_BARBER] = ['TransaksiID', 'NomorTransaksi', 'Tanggal', 'Jam', 'PelangganID', 'NamaPelanggan', 'NoHP', 'CapsterID', 'NamaCapster', 'ItemsJSON', 'Subtotal', 'Diskon', 'DiskonType', 'GrandTotal', 'MetodeBayar', 'CashAmount', 'QrisAmount', 'Catatan', 'Status', 'KasirID', 'NamaKasir', 'ShiftID', 'CreatedAt', 'UpdatedAt', 'Deleted', 'DeletedAt', 'DeletedBy'];
COLUMNS[SHEET.TRANSAKSI_WARKOP] = ['TransaksiID', 'NomorTransaksi', 'Tanggal', 'Jam', 'NamaPelanggan', 'ItemsJSON', 'Subtotal', 'Diskon', 'DiskonType', 'GrandTotal', 'MetodeBayar', 'CashAmount', 'QrisAmount', 'SplitBillJSON', 'Catatan', 'Status', 'KasirID', 'NamaKasir', 'ShiftID', 'CreatedAt', 'UpdatedAt', 'Deleted', 'DeletedAt', 'DeletedBy'];
COLUMNS[SHEET.PENGELUARAN_BARBER] = ['PengeluaranID', 'Tanggal', 'Nominal', 'Kategori', 'Keterangan', 'FotoNotaUrl', 'InputOleh', 'ShiftID', 'CreatedAt', 'Deleted'];
COLUMNS[SHEET.PENGELUARAN_WARKOP] = ['PengeluaranID', 'Tanggal', 'Nominal', 'Kategori', 'Keterangan', 'FotoNotaUrl', 'InputOleh', 'ShiftID', 'CreatedAt', 'Deleted'];
COLUMNS[SHEET.CLOSING_SHIFT] = ['ShiftID', 'TanggalBuka', 'TanggalTutup', 'KasirID', 'NamaKasir', 'SaldoAwal', 'CashBarber', 'CashWarkop', 'QrisBarber', 'QrisWarkop', 'PengeluaranBarber', 'PengeluaranWarkop', 'TotalSistem', 'UangFisik', 'Selisih', 'CatatanKasir', 'Status', 'ClosedAt', 'ReopenedBy', 'ReopenedAt', 'ReopenReason'];
COLUMNS[SHEET.GAJI_CAPSTER] = ['PayrollID', 'Periode', 'CapsterID', 'NamaCapster', 'TotalKepala', 'TotalPendapatan', 'PersentaseBagiHasil', 'BagiHasilAmount', 'Bonus', 'Potongan', 'Keterlambatan', 'TotalGaji', 'Status', 'GeneratedAt', 'GeneratedBy'];
COLUMNS[SHEET.PROMO_VOUCHER] = ['VoucherID', 'Kode', 'JenisUsaha', 'TipeDiskon', 'Nilai', 'MinimalTransaksi', 'TanggalMulai', 'TanggalBerakhir', 'KuotaPemakaian', 'Terpakai', 'Aktif'];
COLUMNS[SHEET.AUDIT_LOG] = ['LogID', 'Timestamp', 'UserID', 'NamaUser', 'Role', 'Aksi', 'Modul', 'TargetID', 'Detail', 'Hasil'];
COLUMNS[SHEET.DASHBOARD] = ['CacheKey', 'Periode', 'JenisUsaha', 'DataJSON', 'GeneratedAt'];

var ROLES = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  KASIR: 'Kasir',
  CAPSTER: 'Capster'
};

var ALL_ROLES = [ROLES.OWNER, ROLES.ADMIN, ROLES.KASIR, ROLES.CAPSTER];

var JENIS_USAHA = {
  BARBER: 'Barber',
  WARKOP: 'Warkop',
  GABUNGAN: 'Gabungan'
};

var METODE_BAYAR = {
  CASH: 'Cash',
  QRIS: 'QRIS',
  SPLIT: 'Split'
};

// Nilai default yang diisikan ke sheet Settings saat setupDatabase() dijalankan.
// Semua bisa diubah kapan saja lewat menu Settings di aplikasi (bukan hardcode permanen).
var DEFAULT_SETTINGS = [
  { key: 'businessName', value: 'Barber & Warkop POS', note: 'Nama usaha yang tampil di struk & header aplikasi' },
  { key: 'address', value: '', note: 'Alamat usaha untuk struk' },
  { key: 'whatsapp', value: '', note: 'Nomor WhatsApp untuk struk' },
  { key: 'instagram', value: '', note: 'Akun Instagram untuk struk' },
  { key: 'logoUrl', value: '', note: 'URL logo (Google Drive) untuk struk & splash screen' },
  { key: 'currency', value: 'IDR', note: 'Mata uang' },
  { key: 'timezone', value: 'Asia/Jakarta', note: 'Timezone untuk perhitungan tanggal/shift' },
  { key: 'receiptFooterMessage', value: 'Terima kasih atas kunjungan Anda!', note: 'Ucapan penutup struk' },
  { key: 'colorBarber', value: '#2563eb', note: 'Warna tema modul Barber (biru)' },
  { key: 'colorWarkop', value: '#ea580c', note: 'Warna tema modul Warkop (oranye)' },
  { key: 'colorGabungan', value: '#16a34a', note: 'Warna tema Dashboard Gabungan (hijau)' },
  { key: 'loyaltyPointsPerRupiah', value: '10000', note: 'Rp berapa = 1 poin loyalti (default: tiap 10.000 = 1 poin)' },
  { key: 'lowStockThresholdDefault', value: '5', note: 'Ambang batas stok rendah default jika item tidak set sendiri' },
  { key: 'sessionTokenTtlHours', value: '12', note: 'Masa berlaku token login (jam)' },
  { key: 'appVersion', value: '1.0.0', note: 'Versi aplikasi' }
];

if (typeof module !== 'undefined') {
  module.exports = { SHEET: SHEET, COLUMNS: COLUMNS, ROLES: ROLES, ALL_ROLES: ALL_ROLES, JENIS_USAHA: JENIS_USAHA, METODE_BAYAR: METODE_BAYAR, DEFAULT_SETTINGS: DEFAULT_SETTINGS };
}
