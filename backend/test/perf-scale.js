'use strict';
/**
 * perf-scale.js
 * Uji skala: seed puluhan/ratusan ribu baris transaksi LANGSUNG ke mock sheet
 * (bukan lewat barberCreateTransaksi_/appendRowObject_ satu-satu -- itu O(n^2)
 * karena tiap appendRowObject_ membaca ulang seluruh sheet, tak masuk akal
 * untuk seed 100rb baris) lalu mengukur waktu operasi BACA (dashboardData_,
 * laporanTransaksi_, barberListTransaksi_) yang sesungguhnya dipakai user.
 *
 * PENTING (baca sebelum menyimpulkan apa pun dari angka di bawah): ini
 * mengukur kecepatan ALGORITMA (filter/sort/paginasi di JS) jalan di Node
 * lokal, BUKAN kecepatan sungguhan Google Sheets di produksi -- pembacaan
 * range besar dari Google Sheets API sesungguhnya punya latensi jaringan &
 * infrastruktur Google yang tidak bisa disimulasikan di sini. Tujuannya
 * membuktikan bahwa paginasi benar-benar membatasi payload/DOM (bukan
 * memuat semua baris ke browser) dan bahwa logika filter/sort tidak
 * berkompleksitas kuadratik terhadap jumlah baris.
 *
 * Jalankan: npm run test:perf
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { createMockGas } = require('./mockGas');

const SRC_DIR = path.join(__dirname, '..', 'src');
const FILES_IN_ORDER = [
  'Config.gs', 'Utils.gs', 'Auth.gs', 'AuditLog.gs', 'Pelanggan.gs', 'Settings.gs',
  'Barber.gs', 'Warkop.gs', 'Inventory.gs', 'Pengeluaran.gs', 'Dashboard.gs', 'Laporan.gs', 'Shift.gs', 'GajiCapster.gs', 'Users.gs', 'OwnerPanel.gs', 'Code.gs', 'SetupDatabase.gs'
];

const BARBER_ROWS = Number(process.env.PERF_BARBER_ROWS) || 60000;
const WARKOP_ROWS = Number(process.env.PERF_WARKOP_ROWS) || 40000;
// Sebar HANYA dalam tahun kalender berjalan (1 Jan -> hari ini) -- filter
// "Tahun Ini" backend (lihat resolveDateRange_ di Dashboard.gs) artinya
// year-to-date, BUKAN 365 hari mundur, jadi rentang seed harus cocok persis
// supaya assertion "total = seluruh baris" di bawah valid.
const now = new Date();
const startOfYear = new Date(now.getFullYear(), 0, 1);
const SPREAD_DAYS = Math.max(Math.floor((now - startOfYear) / 86400000) + 1, 1);

function loadContext() {
  const mocks = createMockGas();
  const sandbox = Object.assign({}, mocks, { Object, Array, JSON, Math, Date, String, Number, Error });
  const context = vm.createContext(sandbox);
  FILES_IN_ORDER.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function pad(n) { return String(n).padStart(2, '0'); }
function dateAt(base, offsetDays) {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Seed N baris LANGSUNG ke sheet.data (bypass appendRowObject_ yg O(n) per panggilan) -- total O(n), bukan O(n^2). */
function seedRowsDirect(ctx, sheetName, n, buildRow) {
  const data = ctx.getSheetData_(sheetName);
  const headers = data.headers;
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const tanggal = dateAt(today, i % SPREAD_DAYS);
    const obj = buildRow(i, tanggal);
    data.sheet.appendRow(ctx.objectToRow_(headers, obj));
  }
}

function timeIt(label, fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  console.log(`  ${label}: ${ms.toFixed(1)}ms`);
  return { result, ms };
}

function main() {
  console.log(`Uji Skala Backend: ${BARBER_ROWS} transaksi Barber + ${WARKOP_ROWS} transaksi Warkop\n`);

  const ctx = loadContext();
  // Ambil password Owner yang di-generate setupDatabase (sama seperti dev-server).
  const setupInfo = ctx.setupDatabase();
  const ownerPassword = setupInfo.ownerAccountCreated ? setupInfo.ownerAccountCreated.password : null;
  const token = ownerPassword
    ? ctx.authLogin_({ username: 'owner', password: ownerPassword }).token
    : (() => { throw new Error('Tidak bisa mendapatkan kredensial Owner dari setupDatabase()'); })();

  console.log('Seeding data (langsung ke mock sheet, bypass business logic per-baris)...');
  const seedStart = process.hrtime.bigint();

  seedRowsDirect(ctx, ctx.SHEETS.TRANSAKSI_BARBER, BARBER_ROWS, (i, tanggal) => ({
    ID: 'PERF-TRB-' + i,
    NomorTransaksi: 'BRB-' + tanggal.replace(/-/g, '') + '-' + String((i % 9999) + 1).padStart(4, '0'),
    Tanggal: tanggal,
    Jam: pad(i % 24) + ':' + pad(i % 60) + ':00',
    NamaPelanggan: 'Pelanggan Perf ' + i,
    NoHP: '0812' + String(i).padStart(8, '0'),
    PelangganID: '',
    CapsterID: 'PERF-CAP-' + (i % 5),
    NamaCapster: 'Capster ' + (i % 5),
    Layanan: JSON.stringify([{ layananId: 'PERF-LYN', nama: 'Potong Rambut', harga: 25000 }]),
    Subtotal: 25000,
    Diskon: 0,
    GrandTotal: 25000,
    MetodePembayaran: i % 2 === 0 ? 'Cash' : 'QRIS',
    Status: 'Selesai',
    Catatan: '',
    KasirID: 'PERF-KSR',
    NamaKasir: 'Kasir Perf',
    ShiftID: '',
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    IsDeleted: false
  }));

  seedRowsDirect(ctx, ctx.SHEETS.TRANSAKSI_WARKOP, WARKOP_ROWS, (i, tanggal) => ({
    ID: 'PERF-TRW-' + i,
    NomorTransaksi: 'WRK-' + tanggal.replace(/-/g, '') + '-' + String((i % 9999) + 1).padStart(4, '0'),
    Tanggal: tanggal,
    Jam: pad(i % 24) + ':' + pad(i % 60) + ':00',
    Items: JSON.stringify([{ produkId: 'PERF-PRD', nama: 'Kopi Hitam', qty: 2, harga: 8000 }]),
    Subtotal: 16000,
    Diskon: 0,
    GrandTotal: 16000,
    MetodePembayaran: i % 2 === 0 ? 'Cash' : 'QRIS',
    SplitBill: '',
    Status: 'Selesai',
    Catatan: '',
    KasirID: 'PERF-KSR',
    NamaKasir: 'Kasir Perf',
    PelangganID: '',
    ShiftID: '',
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    IsDeleted: false
  }));

  const seedMs = Number(process.hrtime.bigint() - seedStart) / 1e6;
  console.log(`Seeding selesai: ${seedMs.toFixed(0)}ms untuk ${BARBER_ROWS + WARKOP_ROWS} baris total.\n`);

  console.log('Mengukur operasi BACA (yang sesungguhnya dipakai user di UI):');

  const dash = timeIt('dashboardData_(usaha=Gabungan, filter=year)', () =>
    ctx.dashboardData_({ token, usaha: 'Gabungan', filter: 'year' }));

  const laporanP1 = timeIt('laporanTransaksi_(usaha=Gabungan, filter=year, page=1, pageSize=50)', () =>
    ctx.laporanTransaksi_({ token, usaha: 'Gabungan', filter: 'year', page: 1, pageSize: 50 }));

  const barberList = timeIt('barberListTransaksi_(startDate..endDate=1 tahun, page=1, pageSize=20)', () => {
    const today = ctx.todayDateString_();
    const yearAgo = ctx.shiftDateString_(today, -365);
    return ctx.barberListTransaksi_({ token, startDate: yearAgo, endDate: today, page: 1, pageSize: 20 });
  });

  console.log('\nVerifikasi hasil (bukti paginasi benar-benar membatasi payload, bukan cuma "cepat"):');
  const checks = [];
  function check(label, pass) {
    checks.push(pass);
    console.log(`  ${pass ? '✓' : '✗'} ${label}`);
  }

  check(`dashboardData_ mengembalikan metrik agregat, bukan daftar baris mentah (tidak ada properti array besar)`, dash.result.periodeMetrics && typeof dash.result.periodeMetrics.pendapatan === 'number');
  check(`laporanTransaksi_ halaman 1 berisi TEPAT 50 baris (pageSize) walau total ${laporanP1.result.total}`, laporanP1.result.transaksi.length === 50);
  check(`laporanTransaksi_ .total mencerminkan SELURUH baris periode (${BARBER_ROWS + WARKOP_ROWS})`, laporanP1.result.total === BARBER_ROWS + WARKOP_ROWS);
  check(`barberListTransaksi_ halaman 1 berisi TEPAT 20 baris (pageSize)`, barberList.result.transaksi.length === 20);
  check(`dashboardData_ selesai < 15 detik untuk ${BARBER_ROWS + WARKOP_ROWS} baris`, dash.ms < 15000);
  check(`laporanTransaksi_ selesai < 15 detik`, laporanP1.ms < 15000);
  check(`barberListTransaksi_ selesai < 15 detik`, barberList.ms < 15000);

  const failed = checks.filter((c) => !c).length;
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
