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
  'Barber.gs', 'Warkop.gs', 'Inventory.gs', 'Code.gs', 'SetupDatabase.gs'
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
  assert.strictEqual(setupSummary.sheetsCreated.length, 15);
});

test('setupDatabase() idempotent (jalan dua kali tidak duplikat header/owner)', () => {
  const before = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  ctx.setupDatabase();
  const after = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  assert.strictEqual(before, after, 'akun owner tidak boleh terduplikasi');
});

test('Semua 15 sheet memiliki header sesuai skema', () => {
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
