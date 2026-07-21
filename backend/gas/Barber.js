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
    ShiftID: activeShiftId_(actor),
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
  var all = dbGetAll(SHEET.TRANSAKSI_BARBER, { includeDeleted: !!opts.includeDeleted });

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

/**
 * Field yang boleh diedit Owner/Admin di Owner Panel. Item/harga/diskon/
 * metode bayar SENGAJA tidak termasuk — nominalnya sudah ikut dihitung di
 * rekonsiliasi Closing Shift (kalau shift-nya sudah ditutup) dan agregat
 * Dashboard/Laporan; mengubahnya diam-diam bisa merusak angka yang sudah
 * "terkunci" di masa lalu. Koreksi nominal/item pakai Hapus + transaksi
 * baru, bukan edit di tempat. Murni -> diuji lewat Node.
 */
function buildTransaksiBarberEditPatch_(payload) {
  var patch = {};
  if (payload.catatan !== undefined) patch.Catatan = sanitizeString(payload.catatan, 500);
  if (payload.namaPelanggan !== undefined) patch.NamaPelanggan = sanitizeString(payload.namaPelanggan, 150);
  if (payload.noHp !== undefined) patch.NoHP = sanitizeString(payload.noHp, 20);
  return patch;
}

function updateTransaksiBarber(transaksiId, payload, actor) {
  var existing = dbFindByField(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId);
  if (!existing) throw createAppError('NOT_FOUND', 'Transaksi tidak ditemukan');
  if (existing.Deleted === true) throw createAppError('VALIDATION_ERROR', 'Transaksi yang sudah dihapus tidak bisa diedit. Pulihkan dulu.');

  var patch = buildTransaksiBarberEditPatch_(payload);
  if (payload.capsterId !== undefined) {
    var capster = dbFindByField(SHEET.CAPSTER, 'CapsterID', payload.capsterId);
    if (!capster || capster.Aktif !== true) throw createAppError('VALIDATION_ERROR', 'Capster tidak ditemukan atau sedang tidak aktif.');
    patch.CapsterID = capster.CapsterID;
    patch.NamaCapster = capster.Nama;
  }
  patch.UpdatedAt = new Date().toISOString();

  var updated = dbUpdateById(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId, patch);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'transaksi.update', module: 'Barber', targetId: transaksiId,
    detail: { fields: Object.keys(patch) }, result: 'Success'
  });
  return parseTransaksiBarberRow_(updated);
}

function deleteTransaksiBarber(transaksiId, reason, actor) {
  var existing = dbFindByField(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId);
  if (!existing) throw createAppError('NOT_FOUND', 'Transaksi tidak ditemukan');
  if (existing.Deleted === true) throw createAppError('VALIDATION_ERROR', 'Transaksi ini sudah dihapus.');
  var alasan = sanitizeString(reason, 500);
  if (!alasan) throw createAppError('VALIDATION_ERROR', 'Alasan penghapusan wajib diisi.');

  dbUpdateById(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId, {
    Deleted: true, DeletedAt: new Date().toISOString(), DeletedBy: actor.name, DeletedReason: alasan
  });
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'transaksi.delete', module: 'Barber', targetId: transaksiId,
    detail: { nomorTransaksi: existing.NomorTransaksi, alasan: alasan }, result: 'Success'
  });
  return { success: true };
}

function restoreTransaksiBarber(transaksiId, actor) {
  var existing = dbFindByField(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId);
  if (!existing) throw createAppError('NOT_FOUND', 'Transaksi tidak ditemukan');
  if (existing.Deleted !== true) throw createAppError('VALIDATION_ERROR', 'Transaksi ini tidak sedang dihapus.');

  var restored = dbUpdateById(SHEET.TRANSAKSI_BARBER, 'TransaksiID', transaksiId, {
    Deleted: false, DeletedAt: '', DeletedBy: '', DeletedReason: ''
  });
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'transaksi.restore', module: 'Barber', targetId: transaksiId,
    detail: { nomorTransaksi: existing.NomorTransaksi }, result: 'Success'
  });
  return parseTransaksiBarberRow_(restored);
}

// validateTransaksiBarberPayload_ & buildTransaksiBarberEditPatch_ murni
// (hanya memvalidasi/membentuk bentuk payload, tidak menyentuh Db) -> diekspor
// untuk Node supaya diuji langsung.
if (typeof module !== 'undefined') {
  var _validation = require('./Validation.js');
  var assertRequiredFields = _validation.assertRequiredFields;
  var createAppError = _validation.createAppError;
  var _utils = require('./Utils.js');
  var sanitizeString = _utils.sanitizeString;
  module.exports = {
    validateTransaksiBarberPayload_: validateTransaksiBarberPayload_,
    buildTransaksiBarberEditPatch_: buildTransaksiBarberEditPatch_
  };
}
