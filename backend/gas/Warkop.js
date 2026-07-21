/**
 * Warkop.js — transaksi modul Warkop: pesanan multi-menu, diskon, split
 * bill (bagi tagihan antar beberapa pembayar), Cash/QRIS, potong stok Produk
 * Warkop otomatis. GAS-only (memakai Db/Calc/Produk/Settings).
 */

function validateTransaksiWarkopPayload_(payload) {
  assertRequiredFields(payload, ['items']);
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw createAppError('VALIDATION_ERROR', 'Minimal 1 menu harus dipesan.');
  }
  payload.items.forEach(function (item) {
    if (!item.produkId || !(Number(item.qty) > 0)) {
      throw createAppError('VALIDATION_ERROR', 'Setiap item pesanan harus punya produkId & qty > 0.');
    }
  });
  var hasSplit = Array.isArray(payload.splitBillPayers) && payload.splitBillPayers.length > 0;
  if (!hasSplit && !payload.metodeBayar) {
    throw createAppError('VALIDATION_ERROR', 'metodeBayar wajib diisi jika tidak menggunakan split bill.');
  }
}

function resolveTransaksiItemsWarkop_(rawItems) {
  var produkAktif = listProdukWarkop(true);
  var byId = {};
  produkAktif.forEach(function (p) { byId[p.ProdukID] = p; });

  return rawItems.map(function (item) {
    var produk = byId[item.produkId];
    if (!produk) throw createAppError('VALIDATION_ERROR', 'Menu tidak ditemukan: ' + item.produkId);
    if (produk.Aktif !== true) throw createAppError('VALIDATION_ERROR', 'Menu "' + produk.NamaMenu + '" sedang tidak aktif.');
    var qty = toSafeNumber(item.qty, 1, { min: 1, clamp: true });
    if (Number(produk.Stok) < qty) {
      throw createAppError('VALIDATION_ERROR', 'Stok "' + produk.NamaMenu + '" tidak cukup (tersisa ' + produk.Stok + ').');
    }
    return { produkId: produk.ProdukID, nama: produk.NamaMenu, harga: Number(produk.HargaJual) || 0, qty: qty };
  });
}

/** Split bill: bagi tagihan antar beberapa pembayar, masing2 Cash atau QRIS. */
function resolveSplitBillPayers_(rawPayers) {
  var payers = rawPayers.map(function (p) {
    if (p.metode !== 'Cash' && p.metode !== 'QRIS') {
      throw createAppError('VALIDATION_ERROR', 'Metode split bill harus Cash atau QRIS.');
    }
    return { nama: sanitizeString(p.nama, 100) || 'Pembayar', metode: p.metode, jumlah: roundCurrency(Number(p.jumlah) || 0) };
  });
  var cashTotal = 0;
  var qrisTotal = 0;
  payers.forEach(function (p) {
    if (p.metode === 'Cash') cashTotal += p.jumlah;
    else qrisTotal += p.jumlah;
  });
  return { payers: payers, cashTotal: cashTotal, qrisTotal: qrisTotal };
}

function createTransaksiWarkop(payload, actor) {
  validateTransaksiWarkopPayload_(payload);

  var itemsResolved = resolveTransaksiItemsWarkop_(payload.items);
  var subtotal = computeItemsSubtotal(itemsResolved);
  var diskonResult = applyDiskon(subtotal, payload.diskon || 0, payload.diskonType || 'nominal');

  var hasSplit = Array.isArray(payload.splitBillPayers) && payload.splitBillPayers.length > 0;
  var splitBill = hasSplit ? resolveSplitBillPayers_(payload.splitBillPayers) : null;
  var metodeBayar = splitBill ? 'Split' : payload.metodeBayar;
  var cashInput = splitBill ? splitBill.cashTotal : payload.cashAmount;
  var qrisInput = splitBill ? splitBill.qrisTotal : payload.qrisAmount;
  var payment = computePaymentBreakdown(diskonResult.grandTotal, metodeBayar, cashInput, qrisInput);

  var tanggalDate = payload.tanggal ? new Date(payload.tanggal) : new Date();
  var tanggalYmd = formatDateYMD(tanggalDate);
  var sequenceForDay = dbCountByField(SHEET.TRANSAKSI_WARKOP, 'Tanggal', tanggalYmd);
  var nomorTransaksi = generateTransactionNumber(JENIS_USAHA.WARKOP, tanggalDate, sequenceForDay);

  var nowIso = new Date().toISOString();
  var transaksi = {
    TransaksiID: generateId('TRW'),
    NomorTransaksi: nomorTransaksi,
    Tanggal: tanggalYmd,
    Jam: payload.jam || formatTimeHM(tanggalDate),
    NamaPelanggan: sanitizeString(payload.namaPelanggan, 150) || 'Pelanggan Umum',
    ItemsJSON: JSON.stringify(itemsResolved),
    Subtotal: subtotal,
    Diskon: diskonResult.diskonAmount,
    DiskonType: payload.diskonType || 'nominal',
    GrandTotal: diskonResult.grandTotal,
    MetodeBayar: metodeBayar,
    CashAmount: payment.cashAmount,
    QrisAmount: payment.qrisAmount,
    Kembalian: payment.kembalian,
    SplitBillJSON: splitBill ? JSON.stringify(splitBill.payers) : '',
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

  dbAppend(SHEET.TRANSAKSI_WARKOP, transaksi);
  itemsResolved.forEach(function (item) { decrementStokProduk_(item.produkId, item.qty); });

  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'transaksi.create', module: 'Warkop', targetId: transaksi.TransaksiID,
    detail: { nomorTransaksi: nomorTransaksi, grandTotal: diskonResult.grandTotal }, result: 'Success'
  });

  return { transaksi: parseTransaksiWarkopRow_(transaksi) };
}

function parseTransaksiWarkopRow_(row) {
  var parsed = {};
  for (var key in row) parsed[key] = row[key];
  try { parsed.Items = JSON.parse(row.ItemsJSON || '[]'); } catch (e) { parsed.Items = []; }
  try { parsed.SplitBillPayers = row.SplitBillJSON ? JSON.parse(row.SplitBillJSON) : []; } catch (e) { parsed.SplitBillPayers = []; }
  return parsed;
}

function listTransaksiWarkop(filterOptions) {
  var opts = filterOptions || {};
  var all = dbGetAll(SHEET.TRANSAKSI_WARKOP);

  if (opts.filterType) {
    var range = resolveDateRangeFilter(opts.filterType, opts.customStart, opts.customEnd);
    all = all.filter(function (t) { return isWithinRange(new Date(t.Tanggal), range.start, range.end); });
  }

  all.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
  return all.map(parseTransaksiWarkopRow_);
}

function getTransaksiWarkopById(transaksiId) {
  var row = dbFindByField(SHEET.TRANSAKSI_WARKOP, 'TransaksiID', transaksiId);
  if (!row) throw createAppError('NOT_FOUND', 'Transaksi tidak ditemukan');
  return parseTransaksiWarkopRow_(row);
}

if (typeof module !== 'undefined') {
  var _validationWarkop = require('./Validation.js');
  var assertRequiredFields = _validationWarkop.assertRequiredFields;
  var createAppError = _validationWarkop.createAppError;
  module.exports = { validateTransaksiWarkopPayload_: validateTransaksiWarkopPayload_ };
}
