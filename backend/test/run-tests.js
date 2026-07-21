'use strict';
/**
 * Test harness untuk backend/src/*.gs tanpa perlu deploy ke Google Apps Script.
 * Menjalankan file .gs apa adanya di dalam vm context yang diberi mock GAS API.
 * Jalankan: node backend/test/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { createMockGas } = require('./mockGas');

const SRC_DIR = path.join(__dirname, '..', 'src');
const FILES_IN_ORDER = [
  'Config.gs', 'Utils.gs', 'Auth.gs', 'AuditLog.gs', 'Pelanggan.gs', 'Settings.gs',
  'Barber.gs', 'Warkop.gs', 'Inventory.gs', 'Pengeluaran.gs', 'Dashboard.gs', 'Laporan.gs', 'Shift.gs', 'GajiCapster.gs', 'Users.gs', 'OwnerPanel.gs', 'Code.gs', 'SetupDatabase.gs'
];

function loadContext() {
  const mocks = createMockGas();
  const sandbox = Object.assign({}, mocks, { Object, Array, JSON, Math, Date, String, Number, Error });
  const context = vm.createContext(sandbox);
  FILES_IN_ORDER.forEach((file) => {
    const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  });
  return context;
}

/** deepStrictEqual salah negatif untuk array lintas-realm vm; bandingkan lewat JSON. */
function assertValuesEqual(actual, expected, message) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function assertThrowsCode(fn, expectedCode) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  assert.ok(threw, 'expected function to throw');
  assert.strictEqual(threw.code, expectedCode, 'expected error code ' + expectedCode + ' but got ' + threw.code);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (err) {
    console.error('  ✗ ' + name);
    console.error('      ' + err.message);
    failed++;
  }
}

console.log('Backend logic tests (mocked GAS runtime)\n');

// --- Setup & schema ---
const ctx = loadContext();
let setupSummary;
test('setupDatabase() membuat spreadsheet & seluruh sheet', () => {
  setupSummary = ctx.setupDatabase();
  assert.ok(setupSummary.spreadsheetId);
  assert.strictEqual(setupSummary.sheetsCreated.length, 16);
});

test('setupDatabase() idempotent (jalan dua kali tidak duplikat header/owner)', () => {
  const before = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  ctx.setupDatabase();
  const after = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  assert.strictEqual(before, after, 'akun owner tidak boleh terduplikasi');
});

test('Semua 16 sheet memiliki header sesuai skema', () => {
  Object.keys(ctx.SHEET_SCHEMAS_).forEach((name) => {
    const data = ctx.getSheetData_(name);
    assertValuesEqual(data.headers, ctx.SHEET_SCHEMAS_[name], 'header mismatch: ' + name);
  });
});

test('Settings ter-seed dengan default values', () => {
  const data = ctx.getSheetData_(ctx.SHEETS.SETTINGS);
  assert.ok(data.rows.length >= 9);
  const namaUsaha = data.rows.find((r) => r.Key === 'nama_usaha');
  assert.ok(namaUsaha);
});

// --- Auth ---
let ownerCreds, ownerToken;
test('Akun Owner default dibuat dengan password acak (tidak plaintext hardcoded)', () => {
  const kasirData = ctx.getSheetData_(ctx.SHEETS.KASIR);
  assert.strictEqual(kasirData.rows.length, 1);
  const owner = kasirData.rows[0];
  assert.strictEqual(owner.Username, 'owner');
  assert.strictEqual(owner.Role, 'Owner');
  assert.notStrictEqual(owner.PasswordHash, '');
  ownerCreds = setupSummary.ownerAccountCreated;
  assert.ok(ownerCreds && ownerCreds.password);
});

test('Login dengan password salah ditolak', () => {
  assert.throws(() => {
    ctx.authLogin_({ username: 'owner', password: 'password-salah-sekali' });
  }, /AUTH_INVALID|salah/i);
});

test('Login dengan kredensial benar mengembalikan token & user', () => {
  const result = ctx.authLogin_({ username: 'owner', password: ownerCreds.password });
  assert.ok(result.token);
  assert.strictEqual(result.user.role, 'Owner');
  ownerToken = result.token;
});

test('requireAuth_ menerima token valid & menolak token acak', () => {
  const session = ctx.requireAuth_(ownerToken);
  assert.strictEqual(session.role, 'Owner');
  assertThrowsCode(() => ctx.requireAuth_('token-acak-tidak-valid'), 'AUTH_REQUIRED');
});

test('Permission matrix: Owner boleh semua, Kasir dilarang kelolaUser', () => {
  assert.strictEqual(ctx.hasPermission_('Owner', 'kelolaUser'), true);
  assert.strictEqual(ctx.hasPermission_('Kasir', 'kelolaUser'), false);
  assert.strictEqual(ctx.hasPermission_('Kasir', 'transaksiBarber'), true);
  assert.strictEqual(ctx.hasPermission_('Capster', 'transaksiWarkop'), false);
});

test('requirePermission_ melempar FORBIDDEN untuk role tanpa akses', () => {
  assertThrowsCode(() => ctx.requirePermission_({ role: 'Kasir' }, 'kelolaUser'), 'FORBIDDEN');
});

// --- HTTP router (doPost) ---
test('doPost ping mengembalikan ok:true', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'ping' }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.pong, true);
});

test('doPost login end-to-end melalui router', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'login', username: 'owner', password: ownerCreds.password }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.ok(body.data.token);
});

test('doPost action tidak dikenal mengembalikan error terstruktur, bukan exception mentah', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'tidakAda' }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, 'NOT_FOUND');
});

test('doPost getMe mengembalikan user yang sedang login', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'getMe', token: ownerToken }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.user.username, 'owner');
});

test('changePassword: tolak password lama salah, terima jika benar & login pakai password baru', () => {
  assertThrowsCode(() => ctx.authChangePassword_({ token: ownerToken, oldPassword: 'salah-banget', newPassword: 'passwordBaru123' }), 'AUTH_INVALID');
  const result = ctx.authChangePassword_({ token: ownerToken, oldPassword: ownerCreds.password, newPassword: 'passwordBaru123' });
  assert.strictEqual(result.changed, true);
  const loginResult = ctx.authLogin_({ username: 'owner', password: 'passwordBaru123' });
  assert.ok(loginResult.token);
  assertThrowsCode(() => ctx.authLogin_({ username: 'owner', password: ownerCreds.password }), 'AUTH_INVALID');
});

// --- Modul Barber ---
let layananGunting, layananCukurJenggot, capsterBudi;

test('Owner bisa membuat layanan barber baru', () => {
  layananGunting = ctx.barberSaveLayanan_({ token: ownerToken, nama: 'Potong Rambut', harga: 25000, durasi: 30 }).layanan;
  layananCukurJenggot = ctx.barberSaveLayanan_({ token: ownerToken, nama: 'Cukur Jenggot', harga: 15000, durasi: 15 }).layanan;
  assert.ok(layananGunting.ID);
  assert.strictEqual(layananGunting.Harga, 25000);
});

test('Layanan dengan harga <= 0 ditolak', () => {
  assertThrowsCode(() => ctx.barberSaveLayanan_({ token: ownerToken, nama: 'Gratis', harga: 0 }), 'VALIDATION_ERROR');
});

test('barberListLayanan_ hanya mengembalikan layanan aktif untuk user biasa', () => {
  ctx.barberSaveLayanan_({ token: ownerToken, id: layananCukurJenggot.ID, nama: 'Cukur Jenggot', harga: 15000, statusAktif: false });
  const activeOnly = ctx.barberListLayanan_({ token: ownerToken }).layanan;
  assert.ok(!activeOnly.some((l) => l.ID === layananCukurJenggot.ID));
  const withInactive = ctx.barberListLayanan_({ token: ownerToken, includeInactive: true }).layanan;
  assert.ok(withInactive.some((l) => l.ID === layananCukurJenggot.ID));
});

test('Owner bisa membuat data capster baru', () => {
  capsterBudi = ctx.barberSaveCapster_({ token: ownerToken, nama: 'Budi', noHp: '081211112222', persentaseBagiHasil: 45 }).capster;
  assert.ok(capsterBudi.ID);
  assert.strictEqual(capsterBudi.Status, 'Aktif');
});

test('Persentase bagi hasil capster di luar 0-100 ditolak', () => {
  assertThrowsCode(() => ctx.barberSaveCapster_({ token: ownerToken, nama: 'X', persentaseBagiHasil: 150 }), 'VALIDATION_ERROR');
});

// Buat akun Kasir untuk menguji permission (Kasir dilarang kelolaLayananProduk/kelolaCapster).
let kasirToken;
test('Setup akun Kasir untuk uji permission', () => {
  const salt = ctx.generateSalt_();
  ctx.appendRowObject_(ctx.SHEETS.KASIR, {
    ID: ctx.generateId_('USR'), Nama: 'Siti Kasir', Username: 'siti', Role: 'Kasir',
    PasswordHash: ctx.hashPassword_('kasir12345', salt), PasswordSalt: salt,
    CapsterID: '', Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  kasirToken = ctx.authLogin_({ username: 'siti', password: 'kasir12345' }).token;
  assert.ok(kasirToken);
});

test('Kasir dilarang membuat/mengubah layanan & capster', () => {
  assertThrowsCode(() => ctx.barberSaveLayanan_({ token: kasirToken, nama: 'X', harga: 1000 }), 'FORBIDDEN');
  assertThrowsCode(() => ctx.barberSaveCapster_({ token: kasirToken, nama: 'X', persentaseBagiHasil: 10 }), 'FORBIDDEN');
});

test('Kasir bisa membuat transaksi barber; subtotal/diskon/grand total dihitung benar', () => {
  const result = ctx.barberCreateTransaksi_({
    token: kasirToken,
    namaPelanggan: 'Andi',
    noHp: '081234567890',
    capsterId: capsterBudi.ID,
    layanan: [
      { layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }
    ],
    diskon: 5000,
    metodePembayaran: 'Cash'
  }).transaksi;

  assert.strictEqual(result.Subtotal, 25000);
  assert.strictEqual(result.Diskon, 5000);
  assert.strictEqual(result.GrandTotal, 20000);
  assert.strictEqual(result.Status, 'Selesai');
  assert.ok(result.NomorTransaksi.startsWith('BRB-'));
  assert.ok(Array.isArray(result.Layanan) && result.Layanan.length === 1);
});

test('Transaksi baru otomatis membuat profil pelanggan & poin loyalti', () => {
  const found = ctx.findPelangganByPhone_('081234567890');
  assert.ok(found);
  assert.strictEqual(found.Nama, 'Andi');
  assert.strictEqual(found.TotalKunjungan, 1);
  assert.strictEqual(found.TotalPengeluaran, 20000);
  assert.strictEqual(found.PoinLoyalti, Math.floor(20000 / ctx.APP_CONFIG.LOYALTY_RUPIAH_PER_POINT));
});

test('Transaksi kedua dari pelanggan yang sama menambah (bukan menimpa) statistik kunjungan', () => {
  ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Andi', noHp: '081234567890', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'QRIS'
  });
  const found = ctx.findPelangganByPhone_('081234567890');
  assert.strictEqual(found.TotalKunjungan, 2);
  assert.strictEqual(found.TotalPengeluaran, 45000);
});

test('Nomor transaksi berurutan pada tanggal yang sama', () => {
  const t3 = ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Citra', noHp: '081200000001', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Cash'
  }).transaksi;
  assert.ok(t3.NomorTransaksi.endsWith('-0003'));
});

test('Transaksi tanpa layanan ditolak', () => {
  assertThrowsCode(() => ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Kosong', noHp: '0800000', capsterId: capsterBudi.ID,
    layanan: [], metodePembayaran: 'Cash'
  }), 'VALIDATION_ERROR');
});

test('Transaksi dengan metode pembayaran tidak valid ditolak', () => {
  assertThrowsCode(() => ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Andi', noHp: '081234567890', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Transfer Bank'
  }), 'VALIDATION_ERROR');
});

test('barberListTransaksi_ memfilter berdasarkan tanggal & mendukung pagination', () => {
  const today = ctx.todayDateString_();
  const result = ctx.barberListTransaksi_({ token: kasirToken, startDate: today, endDate: today, page: 1, pageSize: 2 });
  assert.strictEqual(result.pageSize, 2);
  assert.ok(result.total >= 3);
  assert.strictEqual(result.transaksi.length, 2);
});

test('barberGetTransaksi_ mengembalikan detail transaksi lengkap dengan Layanan ter-parse', () => {
  const list = ctx.barberListTransaksi_({ token: kasirToken, page: 1, pageSize: 1 }).transaksi;
  const detail = ctx.barberGetTransaksi_({ token: kasirToken, id: list[0].ID }).transaksi;
  assert.ok(Array.isArray(detail.Layanan));
});

test('searchPelanggan_ menemukan pelanggan lewat nama maupun nomor HP', () => {
  const byName = ctx.searchPelanggan_({ token: kasirToken, query: 'Andi' }).pelanggan;
  assert.ok(byName.some((p) => p.NoHP === '081234567890'));
  const byPhone = ctx.searchPelanggan_({ token: kasirToken, query: '081234567890' }).pelanggan;
  assert.ok(byPhone.length >= 1);
});

// --- Settings ---
test('getSettings_ mengembalikan default settings sebagai object key-value', () => {
  const settings = ctx.getSettings_({ token: kasirToken }).settings;
  assert.strictEqual(settings.nama_usaha, 'Barber & Warkop');
});

test('Kasir dilarang mengubah settings, Owner boleh', () => {
  assertThrowsCode(() => ctx.updateSettings_({ token: kasirToken, values: { nama_usaha: 'Hack' } }), 'FORBIDDEN');
  const updated = ctx.updateSettings_({ token: ownerToken, values: { nama_usaha: 'Barbershop Jaya' } }).settings;
  assert.strictEqual(updated.nama_usaha, 'Barbershop Jaya');
});

// --- Modul Warkop ---
let kopiHitam, indomieGoreng;

test('Owner bisa membuat menu warkop baru; margin dihitung otomatis', () => {
  kopiHitam = ctx.warkopSaveProduk_({ token: ownerToken, nama: 'Kopi Hitam', kategori: 'Minuman', modal: 3000, hargaJual: 8000, stok: 50, stokMinimum: 10 }).produk;
  indomieGoreng = ctx.warkopSaveProduk_({ token: ownerToken, nama: 'Indomie Goreng', kategori: 'Makanan', modal: 4000, hargaJual: 10000, stok: 20, stokMinimum: 5 }).produk;
  assert.strictEqual(kopiHitam.Margin, 5000);
  assert.strictEqual(kopiHitam.Stok, 50);
});

test('Menu dengan harga jual <= 0 ditolak', () => {
  assertThrowsCode(() => ctx.warkopSaveProduk_({ token: ownerToken, nama: 'Gratisan', kategori: 'X', hargaJual: 0 }), 'VALIDATION_ERROR');
});

test('Edit menu tanpa field stok tidak menimpa stok yang ada (mencegah reset stok tidak sengaja)', () => {
  const updated = ctx.warkopSaveProduk_({ token: ownerToken, id: kopiHitam.ID, nama: 'Kopi Hitam', kategori: 'Minuman', modal: 3000, hargaJual: 8500 }).produk;
  assert.strictEqual(updated.Stok, 50);
  assert.strictEqual(updated.HargaJual, 8500);
  kopiHitam = updated;
});

test('Kasir dilarang membuat/mengubah menu', () => {
  assertThrowsCode(() => ctx.warkopSaveProduk_({ token: kasirToken, nama: 'X', kategori: 'X', hargaJual: 1000 }), 'FORBIDDEN');
});

test('Transaksi warkop menghitung subtotal dari beberapa item dengan qty & mengurangi stok', () => {
  const result = ctx.warkopCreateTransaksi_({
    token: kasirToken,
    items: [
      { produkId: kopiHitam.ID, qty: 2 },
      { produkId: indomieGoreng.ID, qty: 1 }
    ],
    diskon: 1000,
    metodePembayaran: 'Cash'
  }).transaksi;

  assert.strictEqual(result.Subtotal, 8500 * 2 + 10000);
  assert.strictEqual(result.Diskon, 1000);
  assert.strictEqual(result.GrandTotal, 8500 * 2 + 10000 - 1000);
  assert.ok(result.NomorTransaksi.startsWith('WRK-'));
  assert.strictEqual(result.Items.length, 2);

  const kopiAfter = ctx.findRowById_(ctx.SHEETS.PRODUK_WARKOP, kopiHitam.ID);
  const indomieAfter = ctx.findRowById_(ctx.SHEETS.PRODUK_WARKOP, indomieGoreng.ID);
  assert.strictEqual(kopiAfter.Stok, 48);
  assert.strictEqual(indomieAfter.Stok, 19);
});

test('Transaksi ditolak jika stok tidak cukup', () => {
  assertThrowsCode(() => ctx.warkopCreateTransaksi_({
    token: kasirToken, items: [{ produkId: indomieGoreng.ID, qty: 999 }], metodePembayaran: 'Cash'
  }), 'VALIDATION_ERROR');
});

test('Split bill: total harus sama persis dengan grand total', () => {
  assertThrowsCode(() => ctx.warkopCreateTransaksi_({
    token: kasirToken,
    items: [{ produkId: kopiHitam.ID, qty: 1 }],
    splitBill: [{ metode: 'Cash', jumlah: 1000 }, { metode: 'QRIS', jumlah: 2000 }]
  }), 'VALIDATION_ERROR');
});

test('Split bill valid: transaksi tersimpan dengan MetodePembayaran "Split" & rincian SplitBill', () => {
  const result = ctx.warkopCreateTransaksi_({
    token: kasirToken,
    items: [{ produkId: kopiHitam.ID, qty: 2 }], // 8500*2 = 17000
    splitBill: [{ metode: 'Cash', jumlah: 10000 }, { metode: 'QRIS', jumlah: 7000 }]
  }).transaksi;
  assert.strictEqual(result.MetodePembayaran, 'Split');
  assert.strictEqual(result.SplitBill.length, 2);
  assert.strictEqual(result.SplitBill[0].jumlah + result.SplitBill[1].jumlah, result.GrandTotal);
});

test('Transaksi warkop dengan nomor HP membuat/menambah statistik pelanggan seperti Barber', () => {
  ctx.warkopCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Eka', noHp: '081299998888',
    items: [{ produkId: indomieGoreng.ID, qty: 1 }], metodePembayaran: 'QRIS'
  });
  const found = ctx.findPelangganByPhone_('081299998888');
  assert.ok(found);
  assert.strictEqual(found.TotalKunjungan, 1);
});

test('warkopListTransaksi_ & warkopGetTransaksi_ bekerja dengan Items ter-parse', () => {
  const list = ctx.warkopListTransaksi_({ token: kasirToken, page: 1, pageSize: 5 });
  assert.ok(list.total >= 3);
  const detail = ctx.warkopGetTransaksi_({ token: kasirToken, id: list.transaksi[0].ID }).transaksi;
  assert.ok(Array.isArray(detail.Items));
});

// --- Modul Inventory ---
let invGula, invKopiBubuk;

test('Owner bisa membuat item Inventory Warkop baru dengan stok awal', () => {
  invGula = ctx.inventorySaveItem_({ token: ownerToken, usaha: 'Warkop', namaItem: 'Gula Pasir', kategori: 'Bahan Baku', satuan: 'kg', stok: 20, stokMinimum: 5, hargaBeli: 15000, supplier: 'Toko Sembako A' }).item;
  invKopiBubuk = ctx.inventorySaveItem_({ token: ownerToken, usaha: 'Warkop', namaItem: 'Kopi Bubuk', kategori: 'Bahan Baku', satuan: 'kg', stok: 3, stokMinimum: 5 }).item;
  assert.strictEqual(invGula.Stok, 20);
});

test('Inventory Barber & Warkop tersimpan di sheet terpisah', () => {
  const invHanduk = ctx.inventorySaveItem_({ token: ownerToken, usaha: 'Barber', namaItem: 'Handuk', kategori: 'Perlengkapan', satuan: 'pcs', stok: 15, stokMinimum: 3 }).item;
  const barberItems = ctx.inventoryList_({ token: ownerToken, usaha: 'Barber' }).items;
  const warkopItems = ctx.inventoryList_({ token: ownerToken, usaha: 'Warkop' }).items;
  assert.ok(barberItems.some((i) => i.ID === invHanduk.ID));
  assert.ok(!warkopItems.some((i) => i.ID === invHanduk.ID));
});

test('Kasir dilarang mengakses inventory', () => {
  assertThrowsCode(() => ctx.inventoryList_({ token: kasirToken, usaha: 'Warkop' }), 'FORBIDDEN');
  assertThrowsCode(() => ctx.inventorySaveItem_({ token: kasirToken, usaha: 'Warkop', namaItem: 'X', satuan: 'pcs' }), 'FORBIDDEN');
});

test('Edit item inventory tidak mengubah stok (harus lewat inventoryAdjustStock_)', () => {
  const updated = ctx.inventorySaveItem_({ token: ownerToken, id: invGula.ID, usaha: 'Warkop', namaItem: 'Gula Pasir', kategori: 'Bahan Baku', satuan: 'kg', stokMinimum: 8, hargaBeli: 16000 }).item;
  assert.strictEqual(updated.Stok, 20);
  assert.strictEqual(updated.StokMinimum, 8);
  invGula = updated;
});

test('inventoryAdjustStock_ menambah & mengurangi stok dengan benar', () => {
  const afterRestock = ctx.inventoryAdjustStock_({ token: ownerToken, usaha: 'Warkop', id: invGula.ID, delta: 10, alasan: 'Restock' }).item;
  assert.strictEqual(afterRestock.Stok, 30);
  const afterUsage = ctx.inventoryAdjustStock_({ token: ownerToken, usaha: 'Warkop', id: invGula.ID, delta: -5, alasan: 'Pemakaian' }).item;
  assert.strictEqual(afterUsage.Stok, 25);
});

test('inventoryAdjustStock_ menolak stok menjadi negatif', () => {
  assertThrowsCode(() => ctx.inventoryAdjustStock_({ token: ownerToken, usaha: 'Warkop', id: invKopiBubuk.ID, delta: -100, alasan: 'Pemakaian' }), 'VALIDATION_ERROR');
});

test('inventoryAdjustStock_ menolak alasan yang tidak dikenal', () => {
  assertThrowsCode(() => ctx.inventoryAdjustStock_({ token: ownerToken, usaha: 'Warkop', id: invGula.ID, delta: 1, alasan: 'Alasan Aneh' }), 'VALIDATION_ERROR');
});

test('inventoryLowStockSummary_ mendeteksi item Inventory & Produk Warkop yang stoknya <= minimum', () => {
  const summary = ctx.inventoryLowStockSummary_({ token: ownerToken });
  assert.ok(summary.inventoryWarkop.some((i) => i.ID === invKopiBubuk.ID), 'Kopi Bubuk (stok 3 <= minimum 5) harus terdeteksi');
  assert.ok(!summary.inventoryWarkop.some((i) => i.ID === invGula.ID), 'Gula Pasir (stok 25 > minimum 8) tidak boleh terdeteksi');
  assert.ok(summary.total >= 1);
});

// --- Modul Pengeluaran ---
test('Kasir bisa mencatat pengeluaran Barber & Warkop dengan kategori valid', () => {
  const p1 = ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Barber', nominal: 50000, kategori: 'Operasional', keterangan: 'Beli sabun', tanggal: ctx.todayDateString_() }).pengeluaran;
  const p2 = ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Warkop', nominal: 30000, kategori: 'Belanja Stok', tanggal: ctx.todayDateString_() }).pengeluaran;
  assert.ok(p1.ID);
  assert.strictEqual(p2.Nominal, 30000);
});

test('Pengeluaran dengan nominal <= 0 atau kategori tidak dikenal ditolak', () => {
  assertThrowsCode(() => ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Barber', nominal: 0, kategori: 'Operasional', tanggal: ctx.todayDateString_() }), 'VALIDATION_ERROR');
  assertThrowsCode(() => ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Barber', nominal: 1000, kategori: 'Kategori Ngasal', tanggal: ctx.todayDateString_() }), 'VALIDATION_ERROR');
});

test('Capster dilarang mencatat pengeluaran (permission pengeluaran = false)', () => {
  const salt = ctx.generateSalt_();
  ctx.appendRowObject_(ctx.SHEETS.KASIR, {
    ID: ctx.generateId_('USR'), Nama: 'Rizky Capster', Username: 'rizky', Role: 'Capster',
    PasswordHash: ctx.hashPassword_('capster123', salt), PasswordSalt: salt,
    CapsterID: '', Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  const capsterToken = ctx.authLogin_({ username: 'rizky', password: 'capster123' }).token;
  assertThrowsCode(() => ctx.pengeluaranCreate_({ token: capsterToken, usaha: 'Barber', nominal: 1000, kategori: 'Operasional', tanggal: ctx.todayDateString_() }), 'FORBIDDEN');
});

test('Upload foto nota (base64) menghasilkan URL, tersimpan di FotoNotaURL', () => {
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const p = ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Barber', nominal: 20000, kategori: 'Maintenance', tanggal: ctx.todayDateString_(), fotoNotaBase64: tinyPng }).pengeluaran;
  assert.ok(p.FotoNotaURL.startsWith('https://drive.google.com/uc?id='));
});

test('pengeluaranList_ memfilter berdasarkan tanggal', () => {
  const today = ctx.todayDateString_();
  const result = ctx.pengeluaranList_({ token: kasirToken, usaha: 'Barber', startDate: today, endDate: today });
  assert.ok(result.total >= 2);
  assert.ok(result.pengeluaran.every((p) => p.Tanggal === today));
});

// --- Dashboard ---
test('dashboardData_ Barber: hariIni & periodeMetrics (filter today) mencerminkan transaksi baru secara delta', () => {
  const before = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  const trx = ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Dashboard Test', noHp: '081200011122', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Cash'
  }).transaksi;
  const after = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });

  assert.strictEqual(after.hariIni.pendapatan, ctx.round2_(before.hariIni.pendapatan + trx.GrandTotal));
  assert.strictEqual(after.hariIni.transaksi, before.hariIni.transaksi + 1);
  assert.strictEqual(after.hariIni.totalKepala, before.hariIni.totalKepala + 1);
  assert.strictEqual(after.periodeMetrics.pendapatan, after.hariIni.pendapatan, 'filter today -> periodeMetrics harus sama dengan hariIni');
  assert.strictEqual(after.hariIni.cash, ctx.round2_(before.hariIni.cash + trx.GrandTotal));
});

test('dashboardData_: Laba Bersih selalu = Pendapatan - Pengeluaran (Barber, Warkop, Gabungan)', () => {
  ['Barber', 'Warkop', 'Gabungan'].forEach((usaha) => {
    const data = ctx.dashboardData_({ token: ownerToken, usaha, filter: 'today' });
    assert.strictEqual(data.hariIni.labaBersih, ctx.round2_(data.hariIni.pendapatan - data.hariIni.pengeluaran), 'usaha=' + usaha);
    assert.strictEqual(data.bulanIni.labaBersih, ctx.round2_(data.bulanIni.pendapatan - data.bulanIni.pengeluaran), 'usaha=' + usaha);
  });
});

test('dashboardData_ Gabungan hariIni = penjumlahan Barber + Warkop hariIni', () => {
  const barber = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  const warkop = ctx.dashboardData_({ token: ownerToken, usaha: 'Warkop', filter: 'today' });
  const gabungan = ctx.dashboardData_({ token: ownerToken, usaha: 'Gabungan', filter: 'today' });
  assert.strictEqual(gabungan.hariIni.pendapatan, ctx.round2_(barber.hariIni.pendapatan + warkop.hariIni.pendapatan));
  assert.strictEqual(gabungan.hariIni.transaksi, barber.hariIni.transaksi + warkop.hariIni.transaksi);
  assert.strictEqual(gabungan.hariIni.cash, ctx.round2_(barber.hariIni.cash + warkop.hariIni.cash));
});

test('dashboardData_: transaksi kemarin muncul di filter "yesterday" tapi tidak di "today"', () => {
  const yesterday = ctx.shiftDateString_(ctx.todayDateString_(), -1);
  const beforeYesterday = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'yesterday' });
  const beforeToday = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });

  const trx = ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Kemarin', noHp: '081200099988', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Cash', tanggal: yesterday
  }).transaksi;

  const afterYesterday = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'yesterday' });
  const afterToday = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });

  assert.strictEqual(afterYesterday.periodeMetrics.pendapatan, ctx.round2_(beforeYesterday.periodeMetrics.pendapatan + trx.GrandTotal));
  assert.strictEqual(afterToday.periodeMetrics.pendapatan, beforeToday.periodeMetrics.pendapatan, 'transaksi kemarin tidak boleh masuk hitungan hari ini');
  assert.strictEqual(afterToday.hariIni.pendapatan, beforeToday.hariIni.pendapatan);
});

test('dashboardData_ filter custom: rentang tanggal dihormati & validasi start<=end', () => {
  const today = ctx.todayDateString_();
  const weekAgo = ctx.shiftDateString_(today, -7);
  const data = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'custom', startDate: weekAgo, endDate: today });
  assert.strictEqual(data.periode.startDate, weekAgo);
  assert.strictEqual(data.periode.endDate, today);

  assertThrowsCode(() => ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'custom' }), 'VALIDATION_ERROR');
  assertThrowsCode(() => ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'custom', startDate: today, endDate: weekAgo }), 'VALIDATION_ERROR');
});

test('Granularitas grafik otomatis: hour (1 hari), day (<=31 hari), month (>31 hari)', () => {
  const today = ctx.todayDateString_();
  const oneDay = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  assert.strictEqual(oneDay.chartPendapatan.granularity, 'hour');
  assert.strictEqual(oneDay.chartPendapatan.labels.length, 24);

  const tenDays = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'custom', startDate: ctx.shiftDateString_(today, -10), endDate: today });
  assert.strictEqual(tenDays.chartPendapatan.granularity, 'day');
  assert.strictEqual(tenDays.chartPendapatan.labels.length, 11);

  const sixtyDays = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'custom', startDate: ctx.shiftDateString_(today, -60), endDate: today });
  assert.strictEqual(sixtyDays.chartPendapatan.granularity, 'month');
});

test('Capster Terlaris & Layanan Terlaris terurut benar berdasarkan pendapatan/jumlah', () => {
  const capsterKedua = ctx.barberSaveCapster_({ token: ownerToken, nama: 'Dedi', persentaseBagiHasil: 40 }).capster;
  // Budi dapat 1 transaksi besar (baru dibuat di atas + sebelumnya), Dedi dapat 1 transaksi kecil.
  ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Untuk Dedi', noHp: '081200055566', capsterId: capsterKedua.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Cash'
  });
  const data = ctx.dashboardData_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  assert.ok(data.capsterTerlaris.length >= 2);
  assert.ok(data.capsterTerlaris[0].pendapatan >= data.capsterTerlaris[1].pendapatan, 'harus terurut desc berdasarkan pendapatan');
  assert.ok(data.layananTerlaris.some((l) => l.nama === layananGunting.Nama));
});

test('Warkop: metodePembayaran menjumlahkan Split Bill ke Cash & QRIS dengan benar', () => {
  const before = ctx.dashboardData_({ token: ownerToken, usaha: 'Warkop', filter: 'today' });
  ctx.warkopCreateTransaksi_({
    token: kasirToken,
    items: [{ produkId: kopiHitam.ID, qty: 2 }],
    splitBill: [{ metode: 'Cash', jumlah: 8000 }, { metode: 'QRIS', jumlah: 9000 }]
  });
  const after = ctx.dashboardData_({ token: ownerToken, usaha: 'Warkop', filter: 'today' });
  assert.strictEqual(after.metodePembayaran.cash, ctx.round2_(before.metodePembayaran.cash + 8000));
  assert.strictEqual(after.metodePembayaran.qris, ctx.round2_(before.metodePembayaran.qris + 9000));
});

test('Menu Terlaris & Kategori Terlaris Warkop dihitung dari qty terjual', () => {
  const data = ctx.dashboardData_({ token: ownerToken, usaha: 'Warkop', filter: 'today' });
  assert.ok(data.menuTerlaris.length > 0);
  assert.ok(data.kategoriTerlaris.length > 0);
  assert.ok(data.kategoriTerlaris.some((k) => k.kategori === 'Minuman'));
});

// --- Modul Closing Shift ---
let currentShiftId;

test('Kasir bisa membuka shift dengan saldo awal', () => {
  const before = ctx.shiftGetCurrent_({ token: kasirToken }).shift;
  assert.strictEqual(before, null, 'belum ada shift terbuka sebelum test ini');
  const result = ctx.shiftOpen_({ token: kasirToken, saldoAwal: 100000 });
  assert.strictEqual(result.shift.Status, 'Terbuka');
  assert.strictEqual(result.shift.SaldoAwal, 100000);
  currentShiftId = result.shift.ID;
});

test('Tidak bisa membuka shift kedua selagi shift pertama masih terbuka', () => {
  assertThrowsCode(() => ctx.shiftOpen_({ token: kasirToken, saldoAwal: 50000 }), 'VALIDATION_ERROR');
});

test('Transaksi yang dibuat selagi shift terbuka otomatis ter-tag ShiftID', () => {
  const trx = ctx.barberCreateTransaksi_({
    token: kasirToken, namaPelanggan: 'Shift Test', noHp: '081277788899', capsterId: capsterBudi.ID,
    layanan: [{ layananId: layananGunting.ID, nama: layananGunting.Nama, harga: layananGunting.Harga }],
    metodePembayaran: 'Cash'
  }).transaksi;
  assert.strictEqual(trx.ShiftID, currentShiftId);

  ctx.pengeluaranCreate_({ token: kasirToken, usaha: 'Barber', nominal: 15000, kategori: 'Operasional', tanggal: ctx.todayDateString_() });
  const pengeluaranRow = ctx.getSheetData_(ctx.SHEETS.PENGELUARAN_BARBER).rows.slice(-1)[0];
  assert.strictEqual(pengeluaranRow.ShiftID, currentShiftId);
});

test('shiftClose_ menghitung Cash/QRIS/Pengeluaran otomatis dari data transaksi shift ini, bukan input manual', () => {
  const shiftBarberRows = ctx.getSheetData_(ctx.SHEETS.TRANSAKSI_BARBER).rows.filter((r) => r.ShiftID === currentShiftId && r.Status === 'Selesai');
  const expectedCash = shiftBarberRows.filter((r) => r.MetodePembayaran === 'Cash').reduce((s, r) => s + r.GrandTotal, 0);
  const expectedPengeluaran = ctx.getSheetData_(ctx.SHEETS.PENGELUARAN_BARBER).rows.filter((r) => r.ShiftID === currentShiftId).reduce((s, r) => s + r.Nominal, 0);
  const expectedTotalSeharusnya = ctx.round2_(100000 + expectedCash - expectedPengeluaran);

  const result = ctx.shiftClose_({ token: kasirToken, uangKasFisik: expectedTotalSeharusnya, catatanKasir: 'Pas' }).shift;
  assert.strictEqual(result.CashBarber, expectedCash);
  assert.strictEqual(result.PengeluaranBarber, expectedPengeluaran);
  assert.strictEqual(result.TotalSeharusnya, expectedTotalSeharusnya);
  assert.strictEqual(result.SelisihKas, 0);
  assert.strictEqual(result.Status, 'Ditutup');
});

test('Selisih kas dihitung benar jika uang fisik tidak pas', () => {
  ctx.shiftOpen_({ token: kasirToken, saldoAwal: 0 });
  const closed = ctx.shiftClose_({ token: kasirToken, uangKasFisik: 5000, catatanKasir: 'Kurang' }).shift;
  assert.strictEqual(closed.SelisihKas, ctx.round2_(5000 - closed.TotalSeharusnya));
});

test('Shift yang sudah ditutup tidak bisa ditutup lagi (tidak ada shift terbuka)', () => {
  assertThrowsCode(() => ctx.shiftClose_({ token: kasirToken, uangKasFisik: 1000 }), 'VALIDATION_ERROR');
});

test('Kasir dilarang membuka kembali shift (reopenShift = false); Owner boleh', () => {
  const lastShift = ctx.shiftList_({ token: ownerToken, pageSize: 1 }).shift[0];
  assertThrowsCode(() => ctx.shiftReopen_({ token: kasirToken, id: lastShift.ID }), 'FORBIDDEN');
  const reopened = ctx.shiftReopen_({ token: ownerToken, id: lastShift.ID }).shift;
  assert.strictEqual(reopened.Status, 'Terbuka');
  assert.strictEqual(reopened.ReopenedBy, 'Owner');
  // Tutup lagi supaya tidak mengganggu test lain yang mengasumsikan tidak ada shift terbuka.
  ctx.shiftClose_({ token: kasirToken, uangKasFisik: 0 });
});

// --- Modul Gaji Capster ---
test('gajiCapsterPreview_ menghitung Total Kepala & Pendapatan otomatis dari transaksi bulan berjalan', () => {
  const periode = ctx.todayDateString_().slice(0, 7);
  const preview = ctx.gajiCapsterPreview_({ token: ownerToken, capsterId: capsterBudi.ID, periode });
  const expected = ctx.getSheetData_(ctx.SHEETS.TRANSAKSI_BARBER).rows.filter((r) =>
    r.CapsterID === capsterBudi.ID && r.Status === 'Selesai' && r.Tanggal.indexOf(periode) === 0);
  assert.strictEqual(preview.totalKepala, expected.length);
  assert.strictEqual(preview.pendapatan, ctx.round2_(expected.reduce((s, r) => s + r.GrandTotal, 0)));
  assert.strictEqual(preview.bagiHasilAmount, ctx.round2_(preview.pendapatan * preview.persentaseBagiHasil / 100));
});

test('gajiCapsterSave_ menghitung Total Gaji = BagiHasil + Bonus - Potongan - Keterlambatan, lalu upsert per periode', () => {
  const periode = ctx.todayDateString_().slice(0, 7);
  const saved = ctx.gajiCapsterSave_({ token: ownerToken, capsterId: capsterBudi.ID, periode, bonus: 50000, potongan: 10000, keterlambatan: 5000 }).gaji;
  assert.strictEqual(saved.TotalGaji, ctx.round2_(saved.BagiHasilAmount + 50000 - 10000 - 5000));

  // Simpan lagi dengan angka berbeda -> harus update baris yang sama (upsert), bukan bikin baris baru.
  const savedAgain = ctx.gajiCapsterSave_({ token: ownerToken, capsterId: capsterBudi.ID, periode, bonus: 100000, potongan: 0, keterlambatan: 0 }).gaji;
  assert.strictEqual(savedAgain.ID, saved.ID);
  const allForPeriode = ctx.gajiCapsterList_({ token: ownerToken, periode }).gaji.filter((g) => g.CapsterID === capsterBudi.ID);
  assert.strictEqual(allForPeriode.length, 1, 'harus tetap 1 baris per capster per periode');
});

test('Kasir dilarang mengakses modul Gaji Capster', () => {
  assertThrowsCode(() => ctx.gajiCapsterPreview_({ token: kasirToken, capsterId: capsterBudi.ID, periode: '2026-01' }), 'FORBIDDEN');
});

// --- Modul Pelanggan (list/detail/member) ---
test('pelangganList_ & pelangganDetail_ menampilkan riwayat transaksi Barber pelanggan', () => {
  const found = ctx.findPelangganByPhone_('081234567890'); // dibuat di test Barber sebelumnya (Andi)
  assert.ok(found);
  const list = ctx.pelangganList_({ token: kasirToken, query: 'Andi' }).pelanggan;
  assert.ok(list.some((p) => p.ID === found.ID));

  const detail = ctx.pelangganDetail_({ token: kasirToken, id: found.ID });
  assert.ok(detail.riwayatBarber.length > 0);
  assert.ok(Array.isArray(detail.riwayatBarber[0].layanan));
});

test('pelangganSetMember_ mengubah status Member', () => {
  const found = ctx.findPelangganByPhone_('081234567890');
  const updated = ctx.pelangganSetMember_({ token: ownerToken, id: found.ID, member: true }).pelanggan;
  assert.strictEqual(updated.Member, true);
});

// --- Modul Users (kelola akun) ---
test('usersList_ tidak pernah mengembalikan PasswordHash/PasswordSalt', () => {
  const users = ctx.usersList_({ token: ownerToken }).users;
  assert.ok(users.length > 0);
  users.forEach((u) => {
    assert.strictEqual(u.PasswordHash, undefined);
    assert.strictEqual(u.PasswordSalt, undefined);
  });
});

test('Owner bisa membuat akun Admin baru; username duplikat ditolak', () => {
  const created = ctx.usersSave_({ token: ownerToken, nama: 'Admin Baru', username: 'admin1', role: 'Admin', password: 'admin12345' }).user;
  assert.strictEqual(created.Role, 'Admin');
  assertThrowsCode(() => ctx.usersSave_({ token: ownerToken, nama: 'Dup', username: 'admin1', role: 'Kasir', password: 'abcdef12' }), 'VALIDATION_ERROR');
});

test('Kasir dilarang mengelola user (kelolaUser = false)', () => {
  assertThrowsCode(() => ctx.usersSave_({ token: kasirToken, nama: 'X', username: 'xx', role: 'Kasir', password: 'abcdef12' }), 'FORBIDDEN');
});

test('Update akun bisa reset password; login lama gagal, password baru berhasil', () => {
  const admin = ctx.usersSave_({ token: ownerToken, nama: 'Admin Reset', username: 'adminreset', role: 'Admin', password: 'passwordLama1' }).user;
  ctx.usersSave_({ token: ownerToken, id: admin.ID, nama: 'Admin Reset', username: 'adminreset', role: 'Admin', password: 'passwordBaru9' });
  assertThrowsCode(() => ctx.authLogin_({ username: 'adminreset', password: 'passwordLama1' }), 'AUTH_INVALID');
  const login = ctx.authLogin_({ username: 'adminreset', password: 'passwordBaru9' });
  assert.ok(login.token);
});

// --- Owner Panel: edit/hapus/restore transaksi + backup/restore ---
test('Owner bisa mengedit diskon & catatan transaksi; GrandTotal dihitung ulang', () => {
  const list = ctx.barberListTransaksi_({ token: ownerToken, page: 1, pageSize: 1 }).transaksi;
  const target = list[0];
  const updated = ctx.ownerUpdateTransaksi_({ token: ownerToken, usaha: 'Barber', id: target.ID, diskon: 5000, catatan: 'Dikoreksi Owner' }).transaksi;
  assert.strictEqual(updated.Diskon, 5000);
  assert.strictEqual(updated.GrandTotal, ctx.round2_(updated.Subtotal - 5000));
  assert.strictEqual(updated.Catatan, 'Dikoreksi Owner');
});

test('Admin dilarang menghapus transaksi (hapusTransaksi = false untuk Admin); Owner boleh', () => {
  const salt = ctx.generateSalt_();
  ctx.appendRowObject_(ctx.SHEETS.KASIR, {
    ID: ctx.generateId_('USR'), Nama: 'Admin Test', Username: 'admintest', Role: 'Admin',
    PasswordHash: ctx.hashPassword_('admin12345', salt), PasswordSalt: salt,
    CapsterID: '', Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  const adminToken = ctx.authLogin_({ username: 'admintest', password: 'admin12345' }).token;

  const list = ctx.barberListTransaksi_({ token: ownerToken, page: 1, pageSize: 1 }).transaksi;
  const target = list[0];
  assertThrowsCode(() => ctx.ownerDeleteTransaksi_({ token: adminToken, usaha: 'Barber', id: target.ID }), 'FORBIDDEN');

  const deleted = ctx.ownerDeleteTransaksi_({ token: ownerToken, usaha: 'Barber', id: target.ID }).transaksi;
  assert.strictEqual(deleted.IsDeleted, true);

  const afterDelete = ctx.barberListTransaksi_({ token: ownerToken, page: 1, pageSize: 50 }).transaksi;
  assert.ok(!afterDelete.some((t) => t.ID === target.ID), 'transaksi terhapus tidak boleh muncul di riwayat normal');

  const restored = ctx.ownerRestoreTransaksi_({ token: ownerToken, usaha: 'Barber', id: target.ID }).transaksi;
  assert.strictEqual(restored.IsDeleted, false);
  const afterRestore = ctx.barberListTransaksi_({ token: ownerToken, page: 1, pageSize: 50 }).transaksi;
  assert.ok(afterRestore.some((t) => t.ID === target.ID), 'transaksi yang di-restore harus muncul lagi');
});

test('ownerListTransaksi_ menampilkan transaksi termasuk yang terhapus (untuk keperluan restore)', () => {
  const list = ctx.barberListTransaksi_({ token: ownerToken, page: 1, pageSize: 1 }).transaksi;
  const target = list[0];
  ctx.ownerDeleteTransaksi_({ token: ownerToken, usaha: 'Barber', id: target.ID });
  const all = ctx.ownerListTransaksi_({ token: ownerToken, usaha: 'Barber', pageSize: 100 }).transaksi;
  assert.ok(all.some((t) => t.ID === target.ID && t.IsDeleted === true));
  ctx.ownerRestoreTransaksi_({ token: ownerToken, usaha: 'Barber', id: target.ID });
});

test('Backup mengembalikan seluruh sheet tanpa kredensial password', () => {
  const backup = ctx.ownerBackupData_({ token: ownerToken }).backup;
  assert.ok(backup.sheets[ctx.SHEETS.TRANSAKSI_BARBER].length > 0);
  backup.sheets[ctx.SHEETS.KASIR].forEach((u) => {
    assert.strictEqual(u.PasswordHash, undefined);
  });
});

test('Restore database menolak tanpa confirm=true, dan tidak pernah menimpa sheet Kasir', () => {
  const backup = ctx.ownerBackupData_({ token: ownerToken }).backup;
  assertThrowsCode(() => ctx.ownerRestoreData_({ token: ownerToken, backup }), 'VALIDATION_ERROR');

  const kasirCountBefore = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  const settingsBefore = ctx.getSheetData_(ctx.SHEETS.SETTINGS).rows.length;
  const result = ctx.ownerRestoreData_({ token: ownerToken, backup, confirm: true });
  assert.ok(result.restored.indexOf(ctx.SHEETS.KASIR) === -1, 'Kasir tidak boleh ada di daftar sheet yang di-restore');
  assert.strictEqual(ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length, kasirCountBefore, 'jumlah akun tidak boleh berubah oleh restore');
  assert.strictEqual(ctx.getSheetData_(ctx.SHEETS.SETTINGS).rows.length, settingsBefore);
});

test('Kasir dilarang backup/restore database (backupRestore = false)', () => {
  assertThrowsCode(() => ctx.ownerBackupData_({ token: kasirToken }), 'FORBIDDEN');
});

// --- Modul Laporan ---
test('laporanTransaksi_ menggabungkan Barber+Warkop, urut terbaru dulu, dan ringkasan cocok dengan dashboard', () => {
  const today = ctx.todayDateString_();
  const dash = ctx.dashboardData_({ token: ownerToken, usaha: 'Gabungan', filter: 'today' });
  const laporan = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Gabungan', filter: 'today' });

  assert.strictEqual(laporan.ringkasan.pendapatan, dash.hariIni.pendapatan, 'ringkasan Laporan harus konsisten dengan Dashboard');
  assert.strictEqual(laporan.ringkasan.transaksi, dash.hariIni.transaksi);
  assert.ok(laporan.transaksi.every((t) => t.tanggal === today));
  assert.ok(laporan.transaksi.some((t) => t.usaha === 'Barber'));
  assert.ok(laporan.transaksi.some((t) => t.usaha === 'Warkop'));
  for (let i = 1; i < laporan.transaksi.length; i++) {
    assert.ok(laporan.transaksi[i - 1].tanggal + laporan.transaksi[i - 1].jam >= laporan.transaksi[i].tanggal + laporan.transaksi[i].jam, 'harus terurut terbaru dulu');
  }
});

test('laporanTransaksi_ dengan usaha=Barber hanya berisi baris Barber', () => {
  const laporan = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  assert.ok(laporan.transaksi.length > 0);
  assert.ok(laporan.transaksi.every((t) => t.usaha === 'Barber'));
  assert.ok(laporan.transaksi[0].deskripsi.indexOf('Capster:') !== -1);
});

test('laporanPengeluaran_ menjumlahkan Barber+Warkop dan total sesuai isi baris', () => {
  const laporan = ctx.laporanPengeluaran_({ token: ownerToken, usaha: 'Gabungan', filter: 'today' });
  const expectedTotal = ctx.round2_(laporan.pengeluaran.reduce((s, p) => s + Number(p.Nominal), 0));
  assert.strictEqual(laporan.total, expectedTotal);
  assert.ok(laporan.pengeluaran.length > 0);
});

test('Capster dilarang mengakses Laporan (permission laporan = false)', () => {
  const salt = ctx.generateSalt_();
  ctx.appendRowObject_(ctx.SHEETS.KASIR, {
    ID: ctx.generateId_('USR'), Nama: 'Capster Laporan Test', Username: 'capsterlaporan', Role: 'Capster',
    PasswordHash: ctx.hashPassword_('capster123', salt), PasswordSalt: salt,
    CapsterID: '', Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  const token = ctx.authLogin_({ username: 'capsterlaporan', password: 'capster123' }).token;
  assertThrowsCode(() => ctx.laporanTransaksi_({ token, usaha: 'Barber', filter: 'today' }), 'FORBIDDEN');
  assertThrowsCode(() => ctx.laporanPengeluaran_({ token, usaha: 'Barber', filter: 'today' }), 'FORBIDDEN');
});

test('laporanTransaksi_ menghormati filter custom rentang tanggal', () => {
  const today = ctx.todayDateString_();
  const weekAgo = ctx.shiftDateString_(today, -7);
  const laporan = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Barber', filter: 'custom', startDate: weekAgo, endDate: today });
  assert.strictEqual(laporan.periode.startDate, weekAgo);
  assert.ok(laporan.transaksi.every((t) => t.tanggal >= weekAgo && t.tanggal <= today));
});

test('laporanTransaksi_ memaginasi tabel tapi ringkasan tetap dihitung dari SELURUH baris periode', () => {
  const capster = ctx.appendRowObject_(ctx.SHEETS.CAPSTER, {
    ID: ctx.generateId_('CAP'), Nama: 'Capster Paginasi', NoHP: '0812', PersentaseBagiHasil: 40, Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  const layanan = ctx.appendRowObject_(ctx.SHEETS.LAYANAN_BARBER, {
    ID: ctx.generateId_('LYN'), Nama: 'Cukur Paginasi', Harga: 20000, Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date()
  });
  const before = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Barber', filter: 'today' });
  const seedCount = 7;
  for (let i = 0; i < seedCount; i++) {
    ctx.barberCreateTransaksi_({
      token: ownerToken, namaPelanggan: 'Pelanggan Paginasi ' + i, capsterId: capster.ID,
      layanan: [{ layananId: layanan.ID, nama: layanan.Nama, harga: layanan.Harga }],
      diskon: 0, metodePembayaran: 'Cash'
    });
  }

  const page1 = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Barber', filter: 'today', page: 1, pageSize: 3 });
  const page2 = ctx.laporanTransaksi_({ token: ownerToken, usaha: 'Barber', filter: 'today', page: 2, pageSize: 3 });

  assert.strictEqual(page1.transaksi.length, 3, 'halaman 1 harus dibatasi tepat pageSize');
  assert.strictEqual(page2.transaksi.length, 3, 'halaman 2 juga dibatasi pageSize');
  assert.strictEqual(page1.total, before.total + seedCount, 'total harus mencerminkan SELURUH baris, bukan cuma satu halaman');
  assert.strictEqual(page1.ringkasan.transaksi, before.ringkasan.transaksi + seedCount, 'ringkasan tetap dihitung dari seluruh baris periode, bukan cuma halaman yang diminta');
  assert.strictEqual(page1.ringkasan.pendapatan, page2.ringkasan.pendapatan, 'ringkasan sama persis di semua halaman (bukti tidak ikut terpotong paginasi)');
  const page1Ids = page1.transaksi.map((t) => t.id);
  const page2Ids = page2.transaksi.map((t) => t.id);
  assert.ok(page1Ids.every((id) => !page2Ids.includes(id)), 'halaman 1 & 2 tidak boleh tumpang tindih');
});

// --- Utils ---
test('generateId_ menghasilkan ID unik', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(ctx.generateId_('X'));
  assert.strictEqual(ids.size, 50);
});

test('sanitizeString_ membuang tag HTML (cegah XSS)', () => {
  assert.strictEqual(ctx.sanitizeString_('<script>alert(1)</script>Budi'), 'alert(1)Budi');
});

test('requireFields_ melempar VALIDATION_ERROR jika field kosong', () => {
  assertThrowsCode(() => ctx.requireFields_({ a: '' }, ['a', 'b']), 'VALIDATION_ERROR');
});

test('appendRowObject_ / findRowById_ round-trip pada sheet Capster', () => {
  ctx.appendRowObject_(ctx.SHEETS.CAPSTER, { ID: 'CAP-1', Nama: 'Budi', NoHP: '0812', PersentaseBagiHasil: 40, Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date() });
  const found = ctx.findRowById_(ctx.SHEETS.CAPSTER, 'CAP-1');
  assert.strictEqual(found.Nama, 'Budi');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
