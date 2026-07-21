/**
 * Inventory.gs
 * Inventory Barber & Inventory Warkop (bahan baku/consumable, TERPISAH dari
 * stok Produk Warkop yang berkurang otomatis lewat penjualan -- lihat catatan
 * di docs/04-MODUL-WARKOP.md). Stok di sini disesuaikan manual (restock,
 * pemakaian, rusak/hilang, koreksi) lewat inventoryAdjustStock_.
 */

var ADJUSTMENT_REASONS = ['Restock', 'Pemakaian', 'Rusak/Hilang', 'Koreksi Stok Opname'];

function inventorySheetFor_(usaha) {
  if (usaha === USAHA.BARBER) return SHEETS.INVENTORY_BARBER;
  if (usaha === USAHA.WARKOP) return SHEETS.INVENTORY_WARKOP;
  throw new AppError_('VALIDATION_ERROR', 'Usaha harus "Barber" atau "Warkop".');
}

function inventoryList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'inventory');
  var sheet = inventorySheetFor_(payload.usaha);
  var data = getSheetData_(sheet);
  return { items: data.rows };
}

function inventorySaveItem_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'inventory');
  requireFields_(payload, ['usaha', 'namaItem', 'satuan']);
  var sheet = inventorySheetFor_(payload.usaha);

  var record = {
    NamaItem: sanitizeString_(payload.namaItem),
    Kategori: sanitizeString_(payload.kategori),
    StokMinimum: Math.max(Number(payload.stokMinimum) || 0, 0),
    Satuan: sanitizeString_(payload.satuan),
    HargaBeli: Math.max(Number(payload.hargaBeli) || 0, 0),
    Supplier: sanitizeString_(payload.supplier),
    UpdatedAt: new Date()
  };

  if (payload.id) {
    var existing = findRowById_(sheet, payload.id);
    if (!existing) throw new AppError_('NOT_FOUND', 'Item inventory tidak ditemukan.');
    Object.assign(existing, record); // Stok TIDAK diubah lewat form edit -- wajib lewat inventoryAdjustStock_.
    updateRowObject_(sheet, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_INVENTORY_' + payload.usaha.toUpperCase(), sheet, '', existing);
    return { item: existing };
  }

  record.ID = generateId_('INV');
  record.Stok = Math.max(Number(payload.stok) || 0, 0);
  appendRowObject_(sheet, record);
  writeAuditLog_(session, 'CREATE_INVENTORY_' + payload.usaha.toUpperCase(), sheet, '', record);
  return { item: record };
}

/** Penyesuaian stok manual: delta bisa positif (restock/koreksi naik) atau negatif (pemakaian/rusak/koreksi turun). */
function inventoryAdjustStock_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'inventory');
  requireFields_(payload, ['usaha', 'id', 'delta', 'alasan']);
  if (ADJUSTMENT_REASONS.indexOf(payload.alasan) === -1) {
    throw new AppError_('VALIDATION_ERROR', 'Alasan penyesuaian tidak valid.');
  }
  var delta = Number(payload.delta);
  if (!delta) throw new AppError_('VALIDATION_ERROR', 'Jumlah penyesuaian tidak boleh 0.');

  var sheet = inventorySheetFor_(payload.usaha);
  var item = findRowById_(sheet, payload.id);
  if (!item) throw new AppError_('NOT_FOUND', 'Item inventory tidak ditemukan.');

  var stokSebelum = Number(item.Stok);
  var stokSesudah = stokSebelum + delta;
  if (stokSesudah < 0) throw new AppError_('VALIDATION_ERROR', 'Stok tidak boleh menjadi negatif.');

  item.Stok = stokSesudah;
  item.UpdatedAt = new Date();
  updateRowObject_(sheet, item._rowIndex, item);

  writeAuditLog_(session, 'ADJUST_STOCK_' + payload.usaha.toUpperCase(), sheet,
    { NamaItem: item.NamaItem, Stok: stokSebelum },
    { NamaItem: item.NamaItem, Stok: stokSesudah, Delta: delta, Alasan: payload.alasan, Catatan: sanitizeString_(payload.catatan) });

  return { item: item };
}

/** Ringkasan item yang stoknya sudah di titik minimum atau di bawahnya -- dipakai untuk notifikasi. */
function inventoryLowStockSummary_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'inventory');

  function lowStockIn(sheetName) {
    return getSheetData_(sheetName).rows.filter(function (r) {
      return Number(r.Stok) <= Number(r.StokMinimum);
    });
  }

  var inventoryBarber = lowStockIn(SHEETS.INVENTORY_BARBER);
  var inventoryWarkop = lowStockIn(SHEETS.INVENTORY_WARKOP);
  var produkWarkop = getSheetData_(SHEETS.PRODUK_WARKOP).rows.filter(function (r) {
    return (r.StatusAktif === true || r.StatusAktif === 'TRUE') && Number(r.Stok) <= Number(r.StokMinimum);
  });

  return {
    inventoryBarber: inventoryBarber,
    inventoryWarkop: inventoryWarkop,
    produkWarkop: produkWarkop,
    total: inventoryBarber.length + inventoryWarkop.length + produkWarkop.length
  };
}
