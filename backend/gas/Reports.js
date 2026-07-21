/**
 * Reports.js — modul Laporan: gabungan transaksi + pengeluaran 1 rentang
 * tanggal bebas (termasuk Custom Date), per jenis usaha atau Gabungan, siap
 * ditabelkan/diexport di frontend. GAS-only, tapi seluruh matematikanya
 * didelegasikan ke Aggregate.js (murni, sudah diuji) — file ini hanya
 * fetch + gabung + label, memakai helper fetch* yang sama dengan
 * Dashboard.js (Fase 6) supaya tidak ada logika duplikat.
 */

function withJenisUsaha_(row, jenisUsaha) {
  var out = {};
  for (var k in row) out[k] = row[k];
  out.JenisUsaha = jenisUsaha;
  return out;
}

/**
 * payload: { jenisUsaha: 'Barber'|'Warkop'|'Gabungan', filterType, customStart, customEnd }
 * filterType mendukung nilai yang sama dengan Dashboard (today/yesterday/week/month/year/custom),
 * default 'month' supaya Laporan yang baru dibuka langsung berisi data berguna.
 */
function getLaporan(payload, actor) {
  assertRequiredFields(payload, ['jenisUsaha']);
  var jenisUsaha = payload.jenisUsaha;
  if (jenisUsaha !== JENIS_USAHA.BARBER && jenisUsaha !== JENIS_USAHA.WARKOP && jenisUsaha !== JENIS_USAHA.GABUNGAN) {
    throw createAppError('VALIDATION_ERROR', 'jenisUsaha tidak dikenal: ' + jenisUsaha);
  }
  var range = resolveDateRangeFilter(payload.filterType || 'month', payload.customStart, payload.customEnd);

  var includeBarber = jenisUsaha !== JENIS_USAHA.WARKOP;
  var includeWarkop = jenisUsaha !== JENIS_USAHA.BARBER;

  var transaksiBarber = includeBarber ? fetchTransaksiBarberInRange_(range.start, range.end) : [];
  var transaksiWarkop = includeWarkop ? fetchTransaksiWarkopInRange_(range.start, range.end) : [];
  var pengeluaranBarber = includeBarber ? fetchPengeluaranInRange_(SHEET.PENGELUARAN_BARBER, range.start, range.end) : [];
  var pengeluaranWarkop = includeWarkop ? fetchPengeluaranInRange_(SHEET.PENGELUARAN_WARKOP, range.start, range.end) : [];

  var transaksiList = transaksiBarber.map(function (t) { return withJenisUsaha_(t, 'Barber'); })
    .concat(transaksiWarkop.map(function (t) { return withJenisUsaha_(t, 'Warkop'); }));
  transaksiList.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

  var pengeluaranList = pengeluaranBarber.map(function (p) { return withJenisUsaha_(p, 'Barber'); })
    .concat(pengeluaranWarkop.map(function (p) { return withJenisUsaha_(p, 'Warkop'); }));
  pengeluaranList.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

  var allTrx = transaksiBarber.concat(transaksiWarkop);
  var allExp = pengeluaranBarber.concat(pengeluaranWarkop);

  return {
    jenisUsaha: jenisUsaha,
    filterType: payload.filterType || 'month',
    range: { start: formatDateYMD(range.start), end: formatDateYMD(range.end) },
    ringkasan: computeRevenueStats(allTrx, allExp),
    paymentBreakdown: computePaymentMethodBreakdown(allTrx),
    transaksiList: transaksiList,
    pengeluaranList: pengeluaranList
  };
}

/**
 * Dicatat ke Audit Log tiap kali user benar-benar mengekspor laporan
 * (CSV/Excel/Cetak) — file-nya sendiri dibuat di browser (lihat
 * frontend/js/core/export.js), panggilan ini murni untuk akuntabilitas
 * ("siapa mengekspor laporan apa, kapan") sesuai kebutuhan Owner Panel.
 */
function logReportExport(payload, actor) {
  assertRequiredFields(payload, ['format', 'jenisUsaha']);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'reports.export', module: 'Reports', targetId: '',
    detail: { format: payload.format, jenisUsaha: payload.jenisUsaha, filterType: payload.filterType, range: payload.range },
    result: 'Success'
  });
  return { success: true };
}
