/**
 * Dashboard.js — agregasi 3 dashboard (Gabungan/Barber/Warkop). GAS-only:
 * mem-fetch data mentah dari sheet lalu mendelegasikan seluruh matematika ke
 * Aggregate.js (murni, teruji). Lihat docs/ARCHITECTURE.md §12 untuk
 * penjelasan kenapa kartu "Hari Ini"/"Bulan Ini" selalu tetap (tidak
 * mengikuti filter) sementara filter mengontrol blok "Periode Terpilih" +
 * seluruh chart.
 */

var DASHBOARD_TREND_DAYS = 14;
var DASHBOARD_TERLARIS_LIMIT = 5;

function fetchTransaksiBarberInRange_(start, end) {
  return dbGetAll(SHEET.TRANSAKSI_BARBER)
    .filter(function (t) { return isWithinRange(new Date(t.Tanggal), start, end); })
    .map(parseTransaksiBarberRow_);
}

function fetchTransaksiWarkopInRange_(start, end) {
  return dbGetAll(SHEET.TRANSAKSI_WARKOP)
    .filter(function (t) { return isWithinRange(new Date(t.Tanggal), start, end); })
    .map(parseTransaksiWarkopRow_);
}

function fetchPengeluaranInRange_(sheetName, start, end) {
  return dbGetAll(sheetName).filter(function (p) { return isWithinRange(new Date(p.Tanggal), start, end); });
}

function computeBarberStats_(range) {
  return computeRevenueStats(fetchTransaksiBarberInRange_(range.start, range.end), fetchPengeluaranInRange_(SHEET.PENGELUARAN_BARBER, range.start, range.end));
}

function computeWarkopStats_(range) {
  return computeRevenueStats(fetchTransaksiWarkopInRange_(range.start, range.end), fetchPengeluaranInRange_(SHEET.PENGELUARAN_WARKOP, range.start, range.end));
}

function computeCombinedStats_(range) {
  var trx = fetchTransaksiBarberInRange_(range.start, range.end).concat(fetchTransaksiWarkopInRange_(range.start, range.end));
  var exp = fetchPengeluaranInRange_(SHEET.PENGELUARAN_BARBER, range.start, range.end).concat(fetchPengeluaranInRange_(SHEET.PENGELUARAN_WARKOP, range.start, range.end));
  return computeRevenueStats(trx, exp);
}

function resolveDashboardFilterRange_(filterType, customStart, customEnd) {
  return resolveDateRangeFilter(filterType || 'today', customStart, customEnd);
}

function getDashboardGabungan(filterType, customStart, customEnd) {
  var now = new Date();
  var todayRange = resolveDateRangeFilter('today', null, null, now);
  var monthRange = resolveDateRangeFilter('month', null, null, now);
  var filterRange = resolveDashboardFilterRange_(filterType, customStart, customEnd);

  var trend14Start = new Date(now); trend14Start.setDate(trend14Start.getDate() - (DASHBOARD_TREND_DAYS - 1));
  var dateKeys = buildDateKeyRange(trend14Start, now);
  var trxTrend = fetchTransaksiBarberInRange_(trend14Start, now).concat(fetchTransaksiWarkopInRange_(trend14Start, now));

  var yearStart = new Date(now.getFullYear(), 0, 1);
  var monthKeys = buildMonthKeyRange(now.getFullYear());
  var trxThisYear = fetchTransaksiBarberInRange_(yearStart, now).concat(fetchTransaksiWarkopInRange_(yearStart, now));

  var fiveYearStart = new Date(now.getFullYear() - 4, 0, 1);
  var yearKeys = buildYearKeyRange(now.getFullYear(), 5);
  var trxLast5Years = fetchTransaksiBarberInRange_(fiveYearStart, now).concat(fetchTransaksiWarkopInRange_(fiveYearStart, now));

  return {
    filterType: filterType || 'today',
    hariIni: computeCombinedStats_(todayRange),
    bulanIni: computeCombinedStats_(monthRange),
    periodeTerpilih: computeCombinedStats_(filterRange),
    chartPendapatanHarian: groupRevenueByDay(trxTrend, dateKeys),
    chartPendapatanBulanan: groupRevenueByMonth(trxThisYear, monthKeys),
    chartPendapatanTahunan: groupRevenueByYear(trxLast5Years, yearKeys)
  };
}

function getDashboardBarber(filterType, customStart, customEnd) {
  var now = new Date();
  var todayRange = resolveDateRangeFilter('today', null, null, now);
  var monthRange = resolveDateRangeFilter('month', null, null, now);
  var filterRange = resolveDashboardFilterRange_(filterType, customStart, customEnd);

  var hariIni = computeBarberStats_(todayRange);
  var bulanIni = computeBarberStats_(monthRange);
  var periodeTerpilih = computeBarberStats_(filterRange);

  var trxFiltered = fetchTransaksiBarberInRange_(filterRange.start, filterRange.end);
  var dateKeys = buildDateKeyRange(filterRange.start, filterRange.end);
  var trxBulanIni = fetchTransaksiBarberInRange_(monthRange.start, monthRange.end);
  var capsterTerlaris = computeCapsterRanking(trxBulanIni, DASHBOARD_TERLARIS_LIMIT);
  var layananTerlaris = computeItemRanking(trxBulanIni, 'layananId', 'nama', DASHBOARD_TERLARIS_LIMIT);

  return {
    filterType: filterType || 'today',
    hariIni: mergeObj_(hariIni, { totalKepala: hariIni.totalTransaksi }),
    bulanIni: mergeObj_(bulanIni, { totalKepala: bulanIni.totalTransaksi }),
    periodeTerpilih: mergeObj_(periodeTerpilih, { totalKepala: periodeTerpilih.totalTransaksi }),
    chartPendapatan: groupRevenueByDay(trxFiltered, dateKeys),
    chartJumlahKepala: groupCountByDay(trxFiltered, dateKeys),
    chartMetodePembayaran: computePaymentMethodBreakdown(trxFiltered),
    capsterTerlaris: capsterTerlaris,
    layananTerlaris: layananTerlaris
  };
}

function getDashboardWarkop(filterType, customStart, customEnd) {
  var now = new Date();
  var todayRange = resolveDateRangeFilter('today', null, null, now);
  var monthRange = resolveDateRangeFilter('month', null, null, now);
  var filterRange = resolveDashboardFilterRange_(filterType, customStart, customEnd);

  var hariIni = computeWarkopStats_(todayRange);
  var bulanIni = computeWarkopStats_(monthRange);
  var periodeTerpilih = computeWarkopStats_(filterRange);

  var trxFiltered = fetchTransaksiWarkopInRange_(filterRange.start, filterRange.end);
  var dateKeys = buildDateKeyRange(filterRange.start, filterRange.end);
  var trxBulanIni = fetchTransaksiWarkopInRange_(monthRange.start, monthRange.end);

  var produkList = listProdukWarkop(true);
  var kategoriById = {};
  produkList.forEach(function (p) { kategoriById[p.ProdukID] = p.Kategori; });

  var menuTerlaris = computeItemRanking(trxBulanIni, 'produkId', 'nama', DASHBOARD_TERLARIS_LIMIT);
  var kategoriTerlaris = computeKategoriRanking(trxBulanIni, kategoriById, DASHBOARD_TERLARIS_LIMIT);

  return {
    filterType: filterType || 'today',
    hariIni: hariIni,
    bulanIni: bulanIni,
    periodeTerpilih: periodeTerpilih,
    chartPendapatan: groupRevenueByDay(trxFiltered, dateKeys),
    chartProdukTerjual: groupQtyByDay(trxFiltered, dateKeys),
    chartMetodePembayaran: computePaymentMethodBreakdown(trxFiltered),
    menuTerlaris: menuTerlaris,
    kategoriTerlaris: kategoriTerlaris
  };
}

function mergeObj_(a, b) {
  var out = {};
  for (var k in a) out[k] = a[k];
  for (var k2 in b) out[k2] = b[k2];
  return out;
}
