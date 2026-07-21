/**
 * ClosingShift.js — buka/tutup kas per kasir. Selama shift terbuka, transaksi
 * & pengeluaran yang dibuat kasir tsb otomatis ditandai ShiftID-nya (lihat
 * `getOpenShiftForKasir` dipanggil dari Barber.js/Warkop.js/Pengeluaran.js)
 * supaya Tutup Kas bisa menghitung Cash/QRIS/Pengeluaran PERSIS milik shift
 * itu, bukan sekadar rentang tanggal. GAS-only.
 */

function getOpenShiftForKasir(kasirId) {
  var all = dbGetAll(SHEET.CLOSING_SHIFT);
  for (var i = 0; i < all.length; i++) {
    if (all[i].KasirID === kasirId && all[i].Status === 'Open') return all[i];
  }
  return null;
}

/** Dipanggil Barber.js/Warkop.js/Pengeluaran.js saat mencatat transaksi/pengeluaran baru. */
function activeShiftId_(actor) {
  var shift = getOpenShiftForKasir(actor.uid);
  return shift ? shift.ShiftID : '';
}

function openShift(payload, actor) {
  var existing = getOpenShiftForKasir(actor.uid);
  if (existing) {
    throw createAppError('VALIDATION_ERROR', 'Anda masih punya shift yang belum ditutup (' + existing.ShiftID + '). Tutup dulu sebelum membuka shift baru.');
  }

  var shift = {
    ShiftID: generateId('SHF'),
    TanggalBuka: new Date().toISOString(),
    TanggalTutup: '',
    KasirID: actor.uid,
    NamaKasir: actor.name,
    SaldoAwal: toSafeNumber(payload.saldoAwal, 0, { min: 0, clamp: true }),
    CashBarber: 0, CashWarkop: 0, QrisBarber: 0, QrisWarkop: 0,
    PengeluaranBarber: 0, PengeluaranWarkop: 0,
    TotalSistem: 0, UangFisik: 0, Selisih: 0,
    CatatanKasir: '',
    Status: 'Open',
    ClosedAt: '', ReopenedBy: '', ReopenedAt: '', ReopenReason: ''
  };
  dbAppend(SHEET.CLOSING_SHIFT, shift);
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'shift.open', module: 'ClosingShift', targetId: shift.ShiftID, detail: { saldoAwal: shift.SaldoAwal }, result: 'Success' });
  return shift;
}

/** Jumlahkan Cash/QRIS transaksi & pengeluaran milik 1 shift, dipisah per jenis usaha. */
function computeShiftTotals_(shiftId) {
  var trxBarber = dbGetAll(SHEET.TRANSAKSI_BARBER).filter(function (t) { return t.ShiftID === shiftId; });
  var trxWarkop = dbGetAll(SHEET.TRANSAKSI_WARKOP).filter(function (t) { return t.ShiftID === shiftId; });
  var expBarber = dbGetAll(SHEET.PENGELUARAN_BARBER).filter(function (p) { return p.ShiftID === shiftId; });
  var expWarkop = dbGetAll(SHEET.PENGELUARAN_WARKOP).filter(function (p) { return p.ShiftID === shiftId; });

  var sum = function (list, key) { return list.reduce(function (s, r) { return s + (Number(r[key]) || 0); }, 0); };

  return {
    cashBarber: sum(trxBarber, 'CashAmount'),
    cashWarkop: sum(trxWarkop, 'CashAmount'),
    qrisBarber: sum(trxBarber, 'QrisAmount'),
    qrisWarkop: sum(trxWarkop, 'QrisAmount'),
    pengeluaranBarber: sum(expBarber, 'Nominal'),
    pengeluaranWarkop: sum(expWarkop, 'Nominal')
  };
}

/**
 * Rekonsiliasi kas fisik: kas seharusnya = saldo awal + cash masuk - kas
 * keluar untuk pengeluaran (QRIS tidak menyentuh kas fisik). Murni -> diuji
 * lewat Node.
 */
function computeShiftReconciliation_(saldoAwal, cashBarber, cashWarkop, pengeluaranBarber, pengeluaranWarkop, uangFisik) {
  var totalSistem = _rc(Number(saldoAwal) + Number(cashBarber) + Number(cashWarkop) - Number(pengeluaranBarber) - Number(pengeluaranWarkop));
  var selisih = _rc(Number(uangFisik) - totalSistem);
  return { totalSistem: totalSistem, selisih: selisih };
}

function _rc(n) {
  if (typeof roundCurrency !== 'undefined') return roundCurrency(n);
  return Math.round(n);
}

function closeShift(shiftId, payload, actor) {
  var shift = dbFindByField(SHEET.CLOSING_SHIFT, 'ShiftID', shiftId);
  if (!shift) throw createAppError('NOT_FOUND', 'Shift tidak ditemukan');
  if (shift.Status !== 'Open') throw createAppError('VALIDATION_ERROR', 'Shift ini sudah ditutup. Minta Owner/Admin membuka kembali kalau perlu koreksi.');
  if (shift.KasirID !== actor.uid && actor.role !== ROLES.OWNER && actor.role !== ROLES.ADMIN) {
    throw createAppError('FORBIDDEN', 'Anda hanya bisa menutup shift milik Anda sendiri.');
  }

  var totals = computeShiftTotals_(shiftId);
  var uangFisik = toSafeNumber(payload.uangFisik, 0, { min: 0, clamp: true });
  var reconciliation = computeShiftReconciliation_(shift.SaldoAwal, totals.cashBarber, totals.cashWarkop, totals.pengeluaranBarber, totals.pengeluaranWarkop, uangFisik);

  var patch = {
    TanggalTutup: new Date().toISOString(),
    CashBarber: totals.cashBarber, CashWarkop: totals.cashWarkop,
    QrisBarber: totals.qrisBarber, QrisWarkop: totals.qrisWarkop,
    PengeluaranBarber: totals.pengeluaranBarber, PengeluaranWarkop: totals.pengeluaranWarkop,
    TotalSistem: reconciliation.totalSistem, UangFisik: uangFisik, Selisih: reconciliation.selisih,
    CatatanKasir: sanitizeString(payload.catatanKasir, 1000),
    Status: 'Closed',
    ClosedAt: new Date().toISOString()
  };
  var updated = dbUpdateById(SHEET.CLOSING_SHIFT, 'ShiftID', shiftId, patch);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'shift.close', module: 'ClosingShift', targetId: shiftId,
    detail: { totalSistem: reconciliation.totalSistem, uangFisik: uangFisik, selisih: reconciliation.selisih }, result: 'Success'
  });
  return updated;
}

function reopenShift(shiftId, reason, actor) {
  var shift = dbFindByField(SHEET.CLOSING_SHIFT, 'ShiftID', shiftId);
  if (!shift) throw createAppError('NOT_FOUND', 'Shift tidak ditemukan');
  if (shift.Status !== 'Closed') throw createAppError('VALIDATION_ERROR', 'Shift ini belum ditutup.');

  var updated = dbUpdateById(SHEET.CLOSING_SHIFT, 'ShiftID', shiftId, {
    Status: 'Open',
    ReopenedBy: actor.name,
    ReopenedAt: new Date().toISOString(),
    ReopenReason: sanitizeString(reason, 500)
  });
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'shift.reopen', module: 'ClosingShift', targetId: shiftId,
    detail: { reason: reason }, result: 'Success'
  });
  return updated;
}

function listShifts(filterOptions) {
  var opts = filterOptions || {};
  var all = dbGetAll(SHEET.CLOSING_SHIFT);
  if (opts.status) all = all.filter(function (s) { return s.Status === opts.status; });
  if (opts.kasirId) all = all.filter(function (s) { return s.KasirID === opts.kasirId; });
  all.sort(function (a, b) { return new Date(b.TanggalBuka) - new Date(a.TanggalBuka); });
  return all;
}

function getMyOpenShift(actor) {
  return getOpenShiftForKasir(actor.uid);
}

/** Preview total Cash/QRIS/Pengeluaran shift yang sedang terbuka SEBELUM ditutup (Uang Fisik belum diisi). */
function previewOpenShift(actor) {
  var shift = getOpenShiftForKasir(actor.uid);
  if (!shift) return null;
  var totals = computeShiftTotals_(shift.ShiftID);
  var totalSistemEstimasi = computeShiftReconciliation_(shift.SaldoAwal, totals.cashBarber, totals.cashWarkop, totals.pengeluaranBarber, totals.pengeluaranWarkop, 0).totalSistem;
  return {
    shift: shift,
    cashBarber: totals.cashBarber,
    cashWarkop: totals.cashWarkop,
    qrisBarber: totals.qrisBarber,
    qrisWarkop: totals.qrisWarkop,
    pengeluaranBarber: totals.pengeluaranBarber,
    pengeluaranWarkop: totals.pengeluaranWarkop,
    totalSistemEstimasi: totalSistemEstimasi
  };
}

if (typeof module !== 'undefined') {
  module.exports = { computeShiftReconciliation_: computeShiftReconciliation_ };
}
