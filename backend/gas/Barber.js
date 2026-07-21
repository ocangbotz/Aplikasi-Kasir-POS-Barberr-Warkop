/**
 * Barber.js — transaksi modul Barber: input pelanggan/layanan/capster,
 * kalkulasi (Calc.js), penyimpanan, update statistik pelanggan & poin
 * loyalti. GAS-only (memakai Db/Calc/Layanan/Capster/Pelanggan/Settings).
 */

function validateTransaksiBarberPayload_(payload) {
  assertRequiredFields(payload, ['namaPelanggan', 'capsterId', 'items', 'metodeBayar']);
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw createAppError('VALIDATION_ERROR', 'Minimal 1 layanan harus dipilih.');
  }
  payload.items.forEach(function (item) {
    if (!item.layananId || !(Number(item.qty) > 0)) {
      throw createAppError('VALIDATION_ERROR', 'Setiap item layanan harus punya layananId & qty > 0.');
    }
  });
}

function resolveTransaksiItems_(rawItems) {
  var layananAktif = listLayananBarber(true);
  var byId = {};
  layananAktif.forEach(function (l) { byId[l.LayananID] = l; });

  return rawItems.map(function (item) {
    var layanan = byId[item.layananId];
    if (!layanan) throw createAppError('VALIDATION_ERROR', 'Layanan tidak ditemukan: ' + item.layananId);
    if (layanan.Aktif !== true) throw createAppError('VALIDATION_ERROR', 'Layanan "' + layanan.NamaLayanan + '" sedang tidak aktif.');
    return {
      layananId: layanan.LayananID,
      nama: layanan.NamaLayanan,
      harga: Number(layanan.Harga) || 0,
      qty: toSafeNumber(item.qty, 1, { min: 1, clamp: true })
    };
  });
}

function createTransaksiBarber(payload, actor) {
  validateTransaksiBarberPayload_(payload);

  var capster = dbFindByField(SHEET.CAPSTER, 'CapsterID', payload.capsterId);
  if (!capster || capster.Aktif !== true) {
    throw createAppError('VALIDATION_ERROR', 'Capster tidak ditemukan atau sedang tidak aktif.');
  }

  var itemsResolved = resolveTransaksiItems_(payload.items);
  var subtotal = computeItemsSubtotal(itemsResolved);
  var diskonResult = applyDiskon(subtotal, payload.diskon || 0, payload.diskonType || 'nominal');
  var payment = computePaymentBreakdown(diskonResult.grandTotal, payload.metodeBayar, payload.cashAmount, payload.qrisAmount);

  var pelanggan = findOrCreatePelanggan(payload.namaPelanggan, payload.noHp);

  var settings = getSettingsMap();
  var loyaltyPoints = computeLoyaltyPoints(diskonResult.grandTotal, settings.loyaltyPointsPerRupiah);

  var tanggalDate = payload.tanggal ? new Date(payload.tanggal) : new Date();
  var tanggalYmd = formatDateYMD(tanggalDate);
  var sequenceForDay = dbCountByField(SHEET.TRANSAKSI_BARBER, 'Tanggal', tanggalYmd);
  var nomorTransaksi = generateTransactionNumber(JENIS_USAHA.BARBER, tanggalDate, sequenceForDay);

  var nowIso = new Date().toISOString();
  var transaksi = {
    TransaksiID: generateId('TRB'),
    NomorTransaksi: nomorTransaksi,
    Tanggal: tanggalYmd,
    Jam: payload.jam || formatTimeHM(tanggalDate),
    PelangganID: pelanggan.PelangganID,
    NamaPelanggan: pelanggan.Nama,
    NoHP: pelanggan.NoHP,
    CapsterID: capster.CapsterID,
    NamaCapster: capster.Nama,
    ItemsJSON: JSON.stringify(itemsResolved),
    Subtotal: subtotal,
    Diskon: diskonResult.diskonAmount,
    DiskonType: payload.diskonType || 'nominal',
    GrandTotal: diskonResult.grandTotal,
    MetodeBayar: payload.metodeBayar,
    CashAmount: payment.cashAmount,
    QrisAmount: payment.qrisAmount,
    Kembalian: payment.kembalian,
    Catatan: sanitizeString(payload.catatan, 500),
    Status: 'Selesai',
    KasirID: actor.uid,
    NamaKasir: actor.name,
    ShiftID: '',
    CreatedAt: nowIso,
    UpdatedAt: nowIso,
    Deleted: false,
    DeletedAt: '',
    DeletedBy: ''
  };

  dbAppend(SHEET.TRANSAKSI_BARBER, transaksi);
  updatePelangganAfterTransaction(pelanggan.PelangganID, diskonResult.grandTotal, loyaltyPoints);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'transaksi.create', module: 'Barber', targetId: transaksi.TransaksiID,
    detail: { nomorTransaksi: nomorTransaksi, grandTotal: diskonResult.grandTotal }, result: 'Success'
  });

  return {
    transaksi: parseTransaksiBarberRow_(transaksi),
    loyaltyPointsEarned: loyaltyPoints
  };
}

function parseTransaksiBarberRow_(row) {
  var parsed = {};
  for (var key in row) parsed[key] = row[key];
  try {
    parsed.Items = JSON.parse(row.ItemsJSON || '[]');
  } catch (e) {
    parsed.Items = [];
  }
  return parsed;
}

function listTransaksiBarber(filterOptions) {
  var opts = filterOptions || {};
  var all = dbGetAll(SHEET.TRANSAKSI_BARBER);

  if (opts.filterType) {
    var range = resolveDateRangeFilter(opts.filterType, opts.customStart, opts.customEnd);
    all = all.filter(function (t) { return isWithinRange(new Date(t.Tanggal), range.start, range.end); });
  }

  all.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  return all.map(parseTransaksiBarberRow_);
}

function getTransaksiBarberById(transaksiId) {
  var row = dbFindByField(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId);
  if (!row) throw createAppError('NOT_FOUND', 'Transaksi tidak ditemukan');
  return parseTransaksiBarberRow_(row);
}

// validateTransaksiBarberPayload_ murni (hanya memvalidasi bentuk payload,
// tidak menyentuh Db) -> diekspor untuk Node supaya diuji langsung.
if (typeof module !== 'undefined') {
  var _validation = require('./Validation.js');
  var assertRequiredFields = _validation.assertRequiredFields;
  var createAppError = _validation.createAppError;
  module.exports = { validateTransaksiBarberPayload_: validateTransaksiBarberPayload_ };
}
