const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeRevenueStats,
  groupRevenueByDay,
  groupRevenueByMonth,
  groupRevenueByYear,
  groupCountByDay,
  groupQtyByDay,
  computePaymentMethodBreakdown,
  computeItemRanking,
  computeKategoriRanking,
  computeCapsterRanking,
  buildDateKeyRange,
  buildMonthKeyRange,
  buildYearKeyRange
} = require('../../backend/gas/Aggregate.js');

const trx = [
  { Tanggal: '2026-07-19', GrandTotal: 100000, CashAmount: 100000, QrisAmount: 0, Items: [{ layananId: 'LYN-1', nama: 'Potong Rambut', harga: 25000, qty: 1 }] },
  { Tanggal: '2026-07-20', GrandTotal: 50000, CashAmount: 0, QrisAmount: 50000, Items: [{ layananId: 'LYN-1', nama: 'Potong Rambut', harga: 25000, qty: 2 }] },
  { Tanggal: '2026-07-20', GrandTotal: 30000, CashAmount: 30000, QrisAmount: 0, Items: [{ layananId: 'LYN-2', nama: 'Cukur Jenggot', harga: 15000, qty: 2 }] }
];
const pengeluaran = [{ Nominal: 40000 }, { Nominal: 10000 }];

test('computeRevenueStats menjumlahkan semua metrik & menghitung laba bersih', () => {
  const stats = computeRevenueStats(trx, pengeluaran);
  assert.equal(stats.totalPendapatan, 180000);
  assert.equal(stats.totalTransaksi, 3);
  assert.equal(stats.totalCash, 130000);
  assert.equal(stats.totalQris, 50000);
  assert.equal(stats.totalPengeluaran, 50000);
  assert.equal(stats.labaBersih, 130000);
});

test('computeRevenueStats dengan data kosong tidak error', () => {
  const stats = computeRevenueStats([], []);
  assert.deepEqual(stats, { totalPendapatan: 0, totalTransaksi: 0, totalCash: 0, totalQris: 0, totalPengeluaran: 0, labaBersih: 0 });
});

test('groupRevenueByDay mengelompokkan per tanggal & mengisi 0 untuk hari tanpa transaksi', () => {
  const result = groupRevenueByDay(trx, ['2026-07-18', '2026-07-19', '2026-07-20']);
  assert.deepEqual(result, [
    { periode: '2026-07-18', total: 0 },
    { periode: '2026-07-19', total: 100000 },
    { periode: '2026-07-20', total: 80000 }
  ]);
});

test('groupCountByDay & groupQtyByDay', () => {
  const counts = groupCountByDay(trx, ['2026-07-19', '2026-07-20']);
  assert.deepEqual(counts, [{ periode: '2026-07-19', total: 1 }, { periode: '2026-07-20', total: 2 }]);

  const qty = groupQtyByDay(trx, ['2026-07-19', '2026-07-20']);
  assert.deepEqual(qty, [{ periode: '2026-07-19', total: 1 }, { periode: '2026-07-20', total: 4 }]);
});

test('groupRevenueByMonth & groupRevenueByYear', () => {
  const monthly = groupRevenueByMonth(trx, ['2026-06', '2026-07']);
  assert.deepEqual(monthly, [{ periode: '2026-06', total: 0 }, { periode: '2026-07', total: 180000 }]);

  const yearly = groupRevenueByYear(trx, ['2025', '2026']);
  assert.deepEqual(yearly, [{ periode: '2025', total: 0 }, { periode: '2026', total: 180000 }]);
});

test('computePaymentMethodBreakdown', () => {
  assert.deepEqual(computePaymentMethodBreakdown(trx), { cash: 130000, qris: 50000 });
});

test('computeItemRanking mengurutkan berdasarkan qty terbanyak', () => {
  const ranking = computeItemRanking(trx, 'layananId', 'nama', 5);
  assert.equal(ranking[0].id, 'LYN-1');
  assert.equal(ranking[0].totalQty, 3); // 1 + 2
  assert.equal(ranking[0].totalPendapatan, 75000); // 25000*1 + 25000*2
  assert.equal(ranking[1].id, 'LYN-2');
  assert.equal(ranking[1].totalQty, 2);
});

test('computeKategoriRanking menjumlahkan qty per kategori lewat peta produkId->kategori', () => {
  const trxWarkop = [
    { Items: [{ produkId: 'PRD-1', nama: 'Kopi Susu', harga: 12000, qty: 2 }] },
    { Items: [{ produkId: 'PRD-2', nama: 'Mie Goreng', harga: 15000, qty: 1 }] },
    { Items: [{ produkId: 'PRD-1', nama: 'Kopi Susu', harga: 12000, qty: 1 }] }
  ];
  const kategoriById = { 'PRD-1': 'Minuman', 'PRD-2': 'Makanan' };
  const ranking = computeKategoriRanking(trxWarkop, kategoriById, 5);
  assert.equal(ranking[0].kategori, 'Minuman');
  assert.equal(ranking[0].totalQty, 3);
  assert.equal(ranking[1].kategori, 'Makanan');
});

test('computeCapsterRanking berdasarkan jumlah kepala (transaksi) terbanyak', () => {
  const trxBarber = [
    { CapsterID: 'CPS-1', NamaCapster: 'Andi', GrandTotal: 25000 },
    { CapsterID: 'CPS-2', NamaCapster: 'Budi', GrandTotal: 40000 },
    { CapsterID: 'CPS-1', NamaCapster: 'Andi', GrandTotal: 30000 }
  ];
  const ranking = computeCapsterRanking(trxBarber, 5);
  assert.equal(ranking[0].nama, 'Andi');
  assert.equal(ranking[0].totalKepala, 2);
  assert.equal(ranking[0].totalPendapatan, 55000);
  assert.equal(ranking[1].nama, 'Budi');
});

test('buildDateKeyRange menghasilkan urutan tanggal inklusif', () => {
  const keys = buildDateKeyRange(new Date(2026, 6, 18), new Date(2026, 6, 20));
  assert.deepEqual(keys, ['2026-07-18', '2026-07-19', '2026-07-20']);
});

test('buildMonthKeyRange menghasilkan 12 bulan', () => {
  const keys = buildMonthKeyRange(2026);
  assert.equal(keys.length, 12);
  assert.equal(keys[0], '2026-01');
  assert.equal(keys[11], '2026-12');
});

test('buildYearKeyRange menghasilkan N tahun berturut-turut berakhir di endYear', () => {
  assert.deepEqual(buildYearKeyRange(2026, 5), ['2022', '2023', '2024', '2025', '2026']);
});
