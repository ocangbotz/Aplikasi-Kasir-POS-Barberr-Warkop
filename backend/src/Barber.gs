/**
 * Barber.gs
 * Modul usaha Barber: layanan, capster, dan transaksi.
 */

// ---------------------------------------------------------------------------
// Layanan
// ---------------------------------------------------------------------------

function barberListLayanan_(payload) {
  var session = requireAuth_(payload.token);
  var data = getSheetData_(SHEETS.LAYANAN_BARBER);
  var includeInactive = payload.includeInactive && hasPermission_(session.role, 'kelolaLayananProduk');
  var rows = includeInactive ? data.rows : data.rows.filter(function (r) { return r.StatusAktif === true || r.StatusAktif === 'TRUE'; });
  return { layanan: rows };
}

function barberSaveLayanan_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaLayananProduk');
  requireFields_(payload, ['nama', 'harga']);

  var harga = Number(payload.harga);
  if (!(harga > 0)) throw new AppError_('VALIDATION_ERROR', 'Harga layanan harus lebih besar dari 0.');

  var record = {
    Nama: sanitizeString_(payload.nama),
    Harga: harga,
    Durasi: Number(payload.durasi) || 0,
    StatusAktif: payload.statusAktif !== undefined ? !!payload.statusAktif : true,
    UpdatedAt: new Date()
  };

  if (payload.id) {
    var existing = findRowById_(SHEETS.LAYANAN_BARBER, payload.id);
    if (!existing) throw new AppError_('NOT_FOUND', 'Layanan tidak ditemukan.');
    Object.assign(existing, record);
    updateRowObject_(SHEETS.LAYANAN_BARBER, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_LAYANAN_BARBER', 'Layanan Barber', '', existing);
    return { layanan: existing };
  }

  record.ID = generateId_('LYN');
  record.CreatedAt = new Date();
  appendRowObject_(SHEETS.LAYANAN_BARBER, record);
  writeAuditLog_(session, 'CREATE_LAYANAN_BARBER', 'Layanan Barber', '', record);
  return { layanan: record };
}

// ---------------------------------------------------------------------------
// Capster
// ---------------------------------------------------------------------------

function barberListCapster_(payload) {
  var session = requireAuth_(payload.token);
  var data = getSheetData_(SHEETS.CAPSTER);
  var includeInactive = payload.includeInactive && hasPermission_(session.role, 'kelolaCapster');
  var rows = includeInactive ? data.rows : data.rows.filter(function (r) { return String(r.Status).toLowerCase() === 'aktif'; });
  return { capster: rows };
}

function barberSaveCapster_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaCapster');
  requireFields_(payload, ['nama']);

  var persentase = Number(payload.persentaseBagiHasil);
  if (isNaN(persentase) || persentase < 0 || persentase > 100) {
    throw new AppError_('VALIDATION_ERROR', 'Persentase bagi hasil harus antara 0-100.');
  }

  var record = {
    Nama: sanitizeString_(payload.nama),
    NoHP: sanitizeString_(payload.noHp),
    PersentaseBagiHasil: persentase,
    Status: payload.status ? sanitizeString_(payload.status) : 'Aktif',
    UpdatedAt: new Date()
  };

  if (payload.id) {
    var existing = findRowById_(SHEETS.CAPSTER, payload.id);
    if (!existing) throw new AppError_('NOT_FOUND', 'Capster tidak ditemukan.');
    Object.assign(existing, record);
    updateRowObject_(SHEETS.CAPSTER, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_CAPSTER', 'Capster', '', existing);
    return { capster: existing };
  }

  record.ID = generateId_('CAP');
  record.CreatedAt = new Date();
  appendRowObject_(SHEETS.CAPSTER, record);
  writeAuditLog_(session, 'CREATE_CAPSTER', 'Capster', '', record);
  return { capster: record };
}

// ---------------------------------------------------------------------------
// Transaksi
// ---------------------------------------------------------------------------

/** Hitung nomor urut transaksi hari ini untuk membentuk NomorTransaksi. */
function nextBarberSequenceForDate_(dateStr) {
  var data = getSheetData_(SHEETS.TRANSAKSI_BARBER);
  var count = data.rows.filter(function (r) { return r.Tanggal === dateStr; }).length;
  return count + 1;
}

function barberCreateTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiBarber');
  requireFields_(payload, ['namaPelanggan', 'capsterId', 'layanan', 'metodePembayaran']);

  if (!Array.isArray(payload.layanan) || payload.layanan.length === 0) {
    throw new AppError_('VALIDATION_ERROR', 'Minimal 1 layanan harus dipilih.');
  }
  if ([METODE_BAYAR.CASH, METODE_BAYAR.QRIS].indexOf(payload.metodePembayaran) === -1) {
    throw new AppError_('VALIDATION_ERROR', 'Metode pembayaran harus Cash atau QRIS.');
  }

  var capster = findRowById_(SHEETS.CAPSTER, payload.capsterId);
  if (!capster) throw new AppError_('VALIDATION_ERROR', 'Capster tidak ditemukan.');

  var layananItems = payload.layanan.map(function (item) {
    var harga = Number(item.harga);
    if (!item.nama || !(harga > 0)) throw new AppError_('VALIDATION_ERROR', 'Data layanan tidak valid.');
    return { layananId: item.layananId || '', nama: sanitizeString_(item.nama), harga: harga };
  });

  var subtotal = round2_(layananItems.reduce(function (sum, it) { return sum + it.harga; }, 0));
  var diskon = Math.min(Math.max(Number(payload.diskon) || 0, 0), subtotal);
  var grandTotal = round2_(subtotal - diskon);

  var tanggal = payload.tanggal || todayDateString_();
  var jam = payload.jam || nowTimeString_();
  var status = payload.status === STATUS_TRANSAKSI.DIBATALKAN ? STATUS_TRANSAKSI.DIBATALKAN : STATUS_TRANSAKSI.SELESAI;

  var pelanggan = findOrCreatePelanggan_(payload.namaPelanggan, payload.noHp);

  var sequence = nextBarberSequenceForDate_(tanggal);
  var nomorTransaksi = generateTransactionNumber_(USAHA.BARBER, sequence);

  var transaksi = {
    ID: generateId_('TRB'),
    NomorTransaksi: nomorTransaksi,
    Tanggal: tanggal,
    Jam: jam,
    NamaPelanggan: sanitizeString_(payload.namaPelanggan),
    NoHP: sanitizeString_(payload.noHp),
    PelangganID: pelanggan ? pelanggan.ID : '',
    CapsterID: capster.ID,
    NamaCapster: capster.Nama,
    Layanan: JSON.stringify(layananItems),
    Subtotal: subtotal,
    Diskon: diskon,
    GrandTotal: grandTotal,
    MetodePembayaran: payload.metodePembayaran,
    Status: status,
    Catatan: sanitizeString_(payload.catatan),
    KasirID: session.userId,
    NamaKasir: session.nama,
    ShiftID: payload.shiftId || '',
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    IsDeleted: false
  };

  appendRowObject_(SHEETS.TRANSAKSI_BARBER, transaksi);

  if (pelanggan && status === STATUS_TRANSAKSI.SELESAI) {
    recordPelangganPurchase_(pelanggan, grandTotal);
  }

  writeAuditLog_(session, 'CREATE_TRANSAKSI_BARBER', 'Transaksi Barber', '', transaksi);

  return { transaksi: hydrateBarberTransaksi_(transaksi) };
}

function hydrateBarberTransaksi_(row) {
  var out = Object.assign({}, row);
  try { out.Layanan = JSON.parse(row.Layanan); } catch (e) { out.Layanan = []; }
  return out;
}

function barberListTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiBarber');

  var data = getSheetData_(SHEETS.TRANSAKSI_BARBER);
  var rows = data.rows.filter(function (r) {
    if (r.IsDeleted === true || r.IsDeleted === 'TRUE') return false;
    if (payload.startDate && r.Tanggal < payload.startDate) return false;
    if (payload.endDate && r.Tanggal > payload.endDate) return false;
    if (payload.status && r.Status !== payload.status) return false;
    return true;
  });

  rows.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

  var page = Math.max(Number(payload.page) || 1, 1);
  var pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 1), 100);
  var start = (page - 1) * pageSize;
  var pageRows = rows.slice(start, start + pageSize).map(hydrateBarberTransaksi_);

  return { transaksi: pageRows, total: rows.length, page: page, pageSize: pageSize };
}

function barberGetTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiBarber');
  var row = findRowById_(SHEETS.TRANSAKSI_BARBER, payload.id);
  if (!row) throw new AppError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
  return { transaksi: hydrateBarberTransaksi_(row) };
}
