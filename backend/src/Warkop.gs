/**
 * Warkop.gs
 * Modul usaha Warkop: menu (produk) dan transaksi (pesanan + split bill).
 */

// ---------------------------------------------------------------------------
// Produk / Menu
// ---------------------------------------------------------------------------

function warkopListProduk_(payload) {
  var session = requireAuth_(payload.token);
  var data = getSheetData_(SHEETS.PRODUK_WARKOP);
  var includeInactive = payload.includeInactive && hasPermission_(session.role, 'kelolaLayananProduk');
  var rows = includeInactive ? data.rows : data.rows.filter(function (r) { return r.StatusAktif === true || r.StatusAktif === 'TRUE'; });
  return { produk: rows };
}

function warkopSaveProduk_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaLayananProduk');
  requireFields_(payload, ['nama', 'kategori', 'hargaJual']);

  var modal = Number(payload.modal) || 0;
  var hargaJual = Number(payload.hargaJual);
  if (!(hargaJual > 0)) throw new AppError_('VALIDATION_ERROR', 'Harga jual harus lebih besar dari 0.');
  if (modal < 0) throw new AppError_('VALIDATION_ERROR', 'Modal tidak boleh negatif.');

  var record = {
    Nama: sanitizeString_(payload.nama),
    Kategori: sanitizeString_(payload.kategori),
    Modal: modal,
    HargaJual: hargaJual,
    Margin: round2_(hargaJual - modal),
    Stok: Math.max(Number(payload.stok) || 0, 0),
    StokMinimum: Math.max(Number(payload.stokMinimum) || 0, 0),
    StatusAktif: payload.statusAktif !== undefined ? !!payload.statusAktif : true,
    UpdatedAt: new Date()
  };

  if (payload.id) {
    var existing = findRowById_(SHEETS.PRODUK_WARKOP, payload.id);
    if (!existing) throw new AppError_('NOT_FOUND', 'Menu tidak ditemukan.');
    // Stok tidak ditimpa lewat form edit biasa -- perubahan stok wajib lewat penyesuaian eksplisit (Fase 5 Inventory) atau transaksi.
    if (payload.stok === undefined) record.Stok = existing.Stok;
    Object.assign(existing, record);
    updateRowObject_(SHEETS.PRODUK_WARKOP, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_PRODUK_WARKOP', 'Produk Warkop', '', existing);
    return { produk: existing };
  }

  record.ID = generateId_('PRD');
  record.CreatedAt = new Date();
  appendRowObject_(SHEETS.PRODUK_WARKOP, record);
  writeAuditLog_(session, 'CREATE_PRODUK_WARKOP', 'Produk Warkop', '', record);
  return { produk: record };
}

// ---------------------------------------------------------------------------
// Transaksi / Pesanan
// ---------------------------------------------------------------------------

function nextWarkopSequenceForDate_(dateStr) {
  var data = getSheetData_(SHEETS.TRANSAKSI_WARKOP);
  var count = data.rows.filter(function (r) { return r.Tanggal === dateStr; }).length;
  return count + 1;
}

function warkopCreateTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiWarkop');
  requireFields_(payload, ['items']);

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new AppError_('VALIDATION_ERROR', 'Minimal 1 menu harus dipesan.');
  }

  // Ambil & kunci data produk sekali di awal supaya validasi stok konsisten.
  var produkData = getSheetData_(SHEETS.PRODUK_WARKOP);
  var produkById = {};
  produkData.rows.forEach(function (p) { produkById[p.ID] = p; });

  var orderItems = payload.items.map(function (item) {
    var produk = produkById[item.produkId];
    if (!produk) throw new AppError_('VALIDATION_ERROR', 'Menu tidak ditemukan: ' + item.produkId);
    var qty = Number(item.qty);
    if (!(qty > 0)) throw new AppError_('VALIDATION_ERROR', 'Jumlah pesanan tidak valid untuk ' + produk.Nama + '.');
    if (Number(produk.Stok) < qty) {
      throw new AppError_('VALIDATION_ERROR', 'Stok "' + produk.Nama + '" tidak cukup (tersisa ' + produk.Stok + ').');
    }
    return { produk: produk, qty: qty, harga: Number(produk.HargaJual), subtotal: round2_(Number(produk.HargaJual) * qty) };
  });

  var subtotal = round2_(orderItems.reduce(function (sum, it) { return sum + it.subtotal; }, 0));
  var diskon = Math.min(Math.max(Number(payload.diskon) || 0, 0), subtotal);
  var grandTotal = round2_(subtotal - diskon);

  var splitBill = null;
  var metodePembayaran = '';
  if (Array.isArray(payload.splitBill) && payload.splitBill.length > 0) {
    splitBill = payload.splitBill.map(function (s) {
      if ([METODE_BAYAR.CASH, METODE_BAYAR.QRIS].indexOf(s.metode) === -1) {
        throw new AppError_('VALIDATION_ERROR', 'Metode pembayaran split bill tidak valid.');
      }
      return { metode: s.metode, jumlah: round2_(Number(s.jumlah) || 0) };
    });
    var splitTotal = round2_(splitBill.reduce(function (sum, s) { return sum + s.jumlah; }, 0));
    if (splitTotal !== grandTotal) {
      throw new AppError_('VALIDATION_ERROR', 'Total split bill (' + splitTotal + ') tidak sama dengan grand total (' + grandTotal + ').');
    }
    // 'Split' menandai transaksi split-bill; rincian Cash/QRIS sesungguhnya
    // ada di kolom SplitBill (dipakai nanti oleh dashboard/laporan untuk
    // menjumlahkan Cash vs QRIS per baris split, bukan sebagai kategori sendiri).
    metodePembayaran = 'Split';
  } else {
    if ([METODE_BAYAR.CASH, METODE_BAYAR.QRIS].indexOf(payload.metodePembayaran) === -1) {
      throw new AppError_('VALIDATION_ERROR', 'Metode pembayaran harus Cash atau QRIS.');
    }
    metodePembayaran = payload.metodePembayaran;
  }

  // Uang diterima & kembalian hanya berlaku untuk pembayaran Cash tunggal
  // (bukan QRIS atau Split Bill) -- membantu kasir menghitung kembalian.
  var uangDiterima = 0;
  var kembalian = 0;
  if (metodePembayaran === METODE_BAYAR.CASH) {
    uangDiterima = Number(payload.uangDiterima);
    if (!(uangDiterima >= grandTotal)) {
      throw new AppError_('VALIDATION_ERROR', 'Uang diterima harus lebih besar atau sama dengan total belanja.');
    }
    kembalian = round2_(uangDiterima - grandTotal);
  }

  var tanggal = payload.tanggal || todayDateString_();
  var jam = payload.jam || nowTimeString_();
  var pelanggan = payload.noHp ? findOrCreatePelanggan_(payload.namaPelanggan || 'Pelanggan', payload.noHp) : null;

  var itemsSnapshot = orderItems.map(function (it) {
    return { produkId: it.produk.ID, nama: it.produk.Nama, qty: it.qty, harga: it.harga, subtotal: it.subtotal };
  });

  var sequence = nextWarkopSequenceForDate_(tanggal);
  var nomorTransaksi = generateTransactionNumber_(USAHA.WARKOP, sequence);

  var transaksi = {
    ID: generateId_('TRW'),
    NomorTransaksi: nomorTransaksi,
    Tanggal: tanggal,
    Jam: jam,
    Items: JSON.stringify(itemsSnapshot),
    Subtotal: subtotal,
    Diskon: diskon,
    GrandTotal: grandTotal,
    MetodePembayaran: metodePembayaran,
    UangDiterima: uangDiterima,
    Kembalian: kembalian,
    SplitBill: splitBill ? JSON.stringify(splitBill) : '',
    Status: STATUS_TRANSAKSI.SELESAI,
    Catatan: sanitizeString_(payload.catatan),
    KasirID: session.userId,
    NamaKasir: session.nama,
    PelangganID: pelanggan ? pelanggan.ID : '',
    ShiftID: currentOpenShiftId_(session),
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
    IsDeleted: false
  };

  appendRowObject_(SHEETS.TRANSAKSI_WARKOP, transaksi);

  // Kurangi stok setiap item yang terjual.
  orderItems.forEach(function (it) {
    var produk = findRowById_(SHEETS.PRODUK_WARKOP, it.produk.ID);
    produk.Stok = Number(produk.Stok) - it.qty;
    produk.UpdatedAt = new Date();
    updateRowObject_(SHEETS.PRODUK_WARKOP, produk._rowIndex, produk);
  });

  if (pelanggan) recordPelangganPurchase_(pelanggan, grandTotal);

  writeAuditLog_(session, 'CREATE_TRANSAKSI_WARKOP', 'Transaksi Warkop', '', transaksi);

  return { transaksi: hydrateWarkopTransaksi_(transaksi) };
}

function hydrateWarkopTransaksi_(row) {
  var out = Object.assign({}, row);
  try { out.Items = JSON.parse(row.Items); } catch (e) { out.Items = []; }
  try { out.SplitBill = row.SplitBill ? JSON.parse(row.SplitBill) : null; } catch (e) { out.SplitBill = null; }
  return out;
}

function warkopListTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiWarkop');

  var data = getSheetData_(SHEETS.TRANSAKSI_WARKOP);
  var rows = data.rows.filter(function (r) {
    if (r.IsDeleted === true || r.IsDeleted === 'TRUE') return false;
    if (payload.startDate && r.Tanggal < payload.startDate) return false;
    if (payload.endDate && r.Tanggal > payload.endDate) return false;
    return true;
  });

  rows.sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });

  var page = Math.max(Number(payload.page) || 1, 1);
  var pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 1), 100);
  var start = (page - 1) * pageSize;
  var pageRows = rows.slice(start, start + pageSize).map(hydrateWarkopTransaksi_);

  return { transaksi: pageRows, total: rows.length, page: page, pageSize: pageSize };
}

function warkopGetTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'transaksiWarkop');
  var row = findRowById_(SHEETS.TRANSAKSI_WARKOP, payload.id);
  if (!row) throw new AppError_('NOT_FOUND', 'Transaksi tidak ditemukan.');
  return { transaksi: hydrateWarkopTransaksi_(row) };
}
