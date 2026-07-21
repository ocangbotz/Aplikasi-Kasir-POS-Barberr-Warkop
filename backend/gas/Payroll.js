/**
 * Payroll.js — Gaji Capster: hitung otomatis dari transaksi Barber milik
 * capster ybs dalam 1 periode (Total Kepala, Pendapatan), lalu tambahkan
 * bagi hasil + bonus - potongan - keterlambatan = Total Gaji. GAS-only.
 */

/** Total kepala & pendapatan capster dalam rentang tanggal [start, end] (inklusif, string YYYY-MM-DD). */
function computeCapsterPeriodStats_(capsterId, periodeStart, periodeEnd) {
  var start = new Date(periodeStart);
  var end = new Date(periodeEnd);
  var endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  var trx = dbGetAll(SHEET.TRANSAKSI_BARBER).filter(function (t) {
    return t.CapsterID === capsterId && isWithinRange(new Date(t.Tanggal), start, endInclusive);
  });

  var totalKepala = trx.length;
  var totalPendapatan = trx.reduce(function (s, t) { return s + (Number(t.GrandTotal) || 0); }, 0);
  return { totalKepala: totalKepala, totalPendapatan: totalPendapatan };
}

/**
 * Perhitungan gaji: bagi hasil dari persentase x pendapatan, ditambah bonus,
 * dikurangi potongan & keterlambatan. Murni -> diuji lewat Node.
 */
function computeGajiTotal_(totalPendapatan, persentaseBagiHasil, bonus, potongan, keterlambatan) {
  var bagiHasilAmount = _rcPay(((Number(totalPendapatan) || 0) * (Number(persentaseBagiHasil) || 0)) / 100);
  var totalGaji = _rcPay(bagiHasilAmount + (Number(bonus) || 0) - (Number(potongan) || 0) - (Number(keterlambatan) || 0));
  return { bagiHasilAmount: bagiHasilAmount, totalGaji: totalGaji };
}

function _rcPay(n) {
  if (typeof roundCurrency !== 'undefined') return roundCurrency(n);
  return Math.round(n);
}

/**
 * Hitung & simpan gaji 1 capster untuk 1 periode. Jika sudah ada record
 * untuk kombinasi capsterId+periode yang sama, ditimpa (bukan duplikat) —
 * supaya bisa di-generate ulang kalau ada koreksi transaksi sebelum digaji.
 */
function generateGajiCapster(payload, actor) {
  assertRequiredFields(payload, ['capsterId', 'periodeStart', 'periodeEnd']);
  var capster = dbFindByField(SHEET.CAPSTER, 'CapsterID', payload.capsterId);
  if (!capster) throw createAppError('NOT_FOUND', 'Capster tidak ditemukan');

  var stats = computeCapsterPeriodStats_(payload.capsterId, payload.periodeStart, payload.periodeEnd);
  var persentase = payload.persentaseBagiHasil !== undefined
    ? toSafeNumber(payload.persentaseBagiHasil, capster.PersentaseBagiHasil, { min: 0, max: 100, clamp: true })
    : Number(capster.PersentaseBagiHasil) || 0;

  var bonus = toSafeNumber(payload.bonus, 0, { min: 0, clamp: true });
  var potongan = toSafeNumber(payload.potongan, 0, { min: 0, clamp: true });
  var keterlambatan = toSafeNumber(payload.keterlambatan, 0, { min: 0, clamp: true });
  var gajiResult = computeGajiTotal_(stats.totalPendapatan, persentase, bonus, potongan, keterlambatan);
  var bagiHasilAmount = gajiResult.bagiHasilAmount;
  var totalGaji = gajiResult.totalGaji;

  var periodeLabel = payload.periodeStart + ' s/d ' + payload.periodeEnd;
  var existing = dbGetAll(SHEET.GAJI_CAPSTER).filter(function (g) {
    return g.CapsterID === payload.capsterId && g.Periode === periodeLabel;
  })[0];

  var row = {
    PayrollID: existing ? existing.PayrollID : generateId('PAY'),
    Periode: periodeLabel,
    CapsterID: capster.CapsterID,
    NamaCapster: capster.Nama,
    TotalKepala: stats.totalKepala,
    TotalPendapatan: stats.totalPendapatan,
    PersentaseBagiHasil: persentase,
    BagiHasilAmount: bagiHasilAmount,
    Bonus: bonus,
    Potongan: potongan,
    Keterlambatan: keterlambatan,
    TotalGaji: totalGaji,
    Status: 'Final',
    GeneratedAt: new Date().toISOString(),
    GeneratedBy: actor.name
  };

  if (existing) {
    dbUpdateById(SHEET.GAJI_CAPSTER, 'PayrollID', existing.PayrollID, row);
  } else {
    dbAppend(SHEET.GAJI_CAPSTER, row);
  }

  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: existing ? 'payroll.regenerate' : 'payroll.generate', module: 'Payroll', targetId: row.PayrollID,
    detail: { capster: capster.Nama, periode: periodeLabel, totalGaji: totalGaji }, result: 'Success'
  });
  return row;
}

/** Owner/Admin: semua slip gaji (opsional filter periode/capster). Capster: hanya miliknya sendiri. */
function listGajiCapster(filterOptions, actor) {
  var opts = filterOptions || {};
  var all = dbGetAll(SHEET.GAJI_CAPSTER);

  if (actor.role === ROLES.CAPSTER) {
    var myProfile = dbFindByField(SHEET.CAPSTER, 'Username', actor.username);
    var myCapsterId = myProfile ? myProfile.CapsterID : '__none__';
    all = all.filter(function (g) { return g.CapsterID === myCapsterId; });
  } else if (opts.capsterId) {
    all = all.filter(function (g) { return g.CapsterID === opts.capsterId; });
  }

  all.sort(function (a, b) { return new Date(b.GeneratedAt) - new Date(a.GeneratedAt); });
  return all;
}

if (typeof module !== 'undefined') {
  module.exports = { computeGajiTotal_: computeGajiTotal_ };
}
