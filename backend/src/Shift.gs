/**
 * Shift.gs
 * Closing Shift (Tutup Kas). Kasir membuka shift dengan saldo awal; setiap
 * transaksi/pengeluaran yang dibuat SELAMA shift terbuka otomatis ditandai
 * dengan ShiftID (lihat currentOpenShiftId_, dipanggil dari Barber.gs/
 * Warkop.gs/Pengeluaran.gs). Saat ditutup, Cash/QRIS/Pengeluaran dihitung
 * OTOMATIS dari data yang sudah tercatat -- kasir tidak mengetik ulang
 * angka yang seharusnya sudah tersimpan sebagai transaksi.
 */

/** Dipanggil modul lain saat membuat transaksi/pengeluaran, supaya otomatis tertaut ke shift yang sedang berjalan. */
function currentOpenShiftId_(session) {
  var data = getSheetData_(SHEETS.CLOSING_SHIFT);
  var open = data.rows.filter(function (r) { return r.KasirID === session.userId && r.Status === SHIFT_STATUS.TERBUKA; });
  if (open.length === 0) return '';
  open.sort(function (a, b) { return new Date(b.JamBuka) - new Date(a.JamBuka); });
  return open[0].ID;
}

function shiftGetCurrent_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'closingShift');
  var id = currentOpenShiftId_(session);
  return { shift: id ? findRowById_(SHEETS.CLOSING_SHIFT, id) : null };
}

function shiftOpen_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'closingShift');

  if (currentOpenShiftId_(session)) {
    throw new AppError_('VALIDATION_ERROR', 'Anda masih punya shift yang belum ditutup. Tutup shift sebelumnya dulu.');
  }

  var record = {
    ID: generateId_('SFT'),
    TanggalShift: todayDateString_(),
    KasirID: session.userId,
    NamaKasir: session.nama,
    JamBuka: new Date(),
    JamTutup: '',
    SaldoAwal: Math.max(Number(payload.saldoAwal) || 0, 0),
    CashBarber: 0, CashWarkop: 0, QRISBarber: 0, QRISWarkop: 0,
    PengeluaranBarber: 0, PengeluaranWarkop: 0,
    TotalSeharusnya: 0, UangKasFisik: 0, SelisihKas: 0,
    CatatanKasir: '', Status: SHIFT_STATUS.TERBUKA,
    ClosedAt: '', ReopenedBy: '', ReopenedAt: ''
  };
  appendRowObject_(SHEETS.CLOSING_SHIFT, record);
  writeAuditLog_(session, 'OPEN_SHIFT', SHEETS.CLOSING_SHIFT, '', record);
  return { shift: record };
}

function shiftClose_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'closingShift');
  requireFields_(payload, ['uangKasFisik']);

  var shiftId = currentOpenShiftId_(session);
  if (!shiftId) throw new AppError_('VALIDATION_ERROR', 'Tidak ada shift yang sedang terbuka.');
  var shift = findRowById_(SHEETS.CLOSING_SHIFT, shiftId);

  var barberRows = getSheetData_(SHEETS.TRANSAKSI_BARBER).rows.filter(function (r) {
    return r.ShiftID === shiftId && r.Status === STATUS_TRANSAKSI.SELESAI && r.IsDeleted !== true && r.IsDeleted !== 'TRUE';
  });
  var warkopRows = getSheetData_(SHEETS.TRANSAKSI_WARKOP).rows.filter(function (r) {
    return r.ShiftID === shiftId && r.Status === STATUS_TRANSAKSI.SELESAI && r.IsDeleted !== true && r.IsDeleted !== 'TRUE';
  });

  var metodeBarber = sumMetodeBarber_(barberRows);
  var metodeWarkop = sumMetodeWarkop_(warkopRows);

  var pengeluaranBarber = getSheetData_(SHEETS.PENGELUARAN_BARBER).rows
    .filter(function (r) { return r.ShiftID === shiftId; })
    .reduce(function (s, r) { return s + Number(r.Nominal || 0); }, 0);
  var pengeluaranWarkop = getSheetData_(SHEETS.PENGELUARAN_WARKOP).rows
    .filter(function (r) { return r.ShiftID === shiftId; })
    .reduce(function (s, r) { return s + Number(r.Nominal || 0); }, 0);

  var totalSeharusnya = round2_(
    Number(shift.SaldoAwal) + metodeBarber.cash + metodeWarkop.cash - pengeluaranBarber - pengeluaranWarkop
  );
  var uangKasFisik = Number(payload.uangKasFisik);
  var selisih = round2_(uangKasFisik - totalSeharusnya);

  shift.JamTutup = new Date();
  shift.CashBarber = metodeBarber.cash;
  shift.CashWarkop = metodeWarkop.cash;
  shift.QRISBarber = metodeBarber.qris;
  shift.QRISWarkop = metodeWarkop.qris;
  shift.PengeluaranBarber = round2_(pengeluaranBarber);
  shift.PengeluaranWarkop = round2_(pengeluaranWarkop);
  shift.TotalSeharusnya = totalSeharusnya;
  shift.UangKasFisik = uangKasFisik;
  shift.SelisihKas = selisih;
  shift.CatatanKasir = sanitizeString_(payload.catatanKasir);
  shift.Status = SHIFT_STATUS.DITUTUP;

  updateRowObject_(SHEETS.CLOSING_SHIFT, shift._rowIndex, shift);
  writeAuditLog_(session, 'CLOSE_SHIFT', SHEETS.CLOSING_SHIFT, '', shift);
  return { shift: shift };
}

function shiftReopen_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'reopenShift');
  requireFields_(payload, ['id']);

  var shift = findRowById_(SHEETS.CLOSING_SHIFT, payload.id);
  if (!shift) throw new AppError_('NOT_FOUND', 'Data shift tidak ditemukan.');
  if (shift.Status !== SHIFT_STATUS.DITUTUP) throw new AppError_('VALIDATION_ERROR', 'Shift ini belum ditutup.');

  var before = Object.assign({}, shift);
  shift.Status = SHIFT_STATUS.TERBUKA;
  shift.ReopenedBy = session.nama;
  shift.ReopenedAt = new Date();
  updateRowObject_(SHEETS.CLOSING_SHIFT, shift._rowIndex, shift);
  writeAuditLog_(session, 'REOPEN_SHIFT', SHEETS.CLOSING_SHIFT, before, shift);
  return { shift: shift };
}

function shiftList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'closingShift');
  var data = getSheetData_(SHEETS.CLOSING_SHIFT);

  var rows = data.rows.filter(function (r) {
    if (payload.startDate && r.TanggalShift < payload.startDate) return false;
    if (payload.endDate && r.TanggalShift > payload.endDate) return false;
    return true;
  });
  rows.sort(function (a, b) { return new Date(b.JamBuka) - new Date(a.JamBuka); });

  var page = Math.max(Number(payload.page) || 1, 1);
  var pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 1), 100);
  var start = (page - 1) * pageSize;
  return { shift: rows.slice(start, start + pageSize), total: rows.length, page: page, pageSize: pageSize };
}
