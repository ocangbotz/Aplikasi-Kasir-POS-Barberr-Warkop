/**
 * Inventory.js — stok bahan baku/consumable Barber & Warkop (Nama, Kategori,
 * Stok, Satuan, Stok Minimum, Harga Beli Terakhir, Supplier). Dikelola MANUAL
 * (pembelian menambah, pemakaian mengurangi) — beda dari stok Produk Warkop
 * (Produk.js) yang otomatis berkurang saat transaksi, karena tidak ada
 * resep/BOM yang menghubungkan 1 transaksi ke pemakaian bahan baku tertentu
 * (lihat docs/ARCHITECTURE.md §5 untuk asumsi desain ini). GAS-only.
 */

function inventorySheetFor_(jenisUsaha) {
  if (jenisUsaha === JENIS_USAHA.BARBER) return SHEET.INVENTORY_BARBER;
  if (jenisUsaha === JENIS_USAHA.WARKOP) return SHEET.INVENTORY_WARKOP;
  throw createAppError('VALIDATION_ERROR', 'jenisUsaha harus "Barber" atau "Warkop".');
}

function listInventory(jenisUsaha) {
  return dbGetAll(inventorySheetFor_(jenisUsaha));
}

function createInventoryItem(jenisUsaha, payload, actor) {
  var sheetName = inventorySheetFor_(jenisUsaha);
  assertRequiredFields(payload, ['namaItem']);

  var item = {
    ItemID: generateId('INV'),
    NamaItem: sanitizeString(payload.namaItem, 150),
    Kategori: sanitizeString(payload.kategori || 'Umum', 100),
    Stok: toSafeNumber(payload.stok, 0, { min: 0, clamp: true }),
    SatuanStok: sanitizeString(payload.satuanStok || 'pcs', 20),
    StokMinimum: toSafeNumber(payload.stokMinimum, 5, { min: 0, clamp: true }),
    HargaBeliTerakhir: toSafeNumber(payload.hargaBeliTerakhir, 0, { min: 0, clamp: true }),
    Supplier: sanitizeString(payload.supplier, 150),
    UpdatedAt: new Date().toISOString()
  };
  dbAppend(sheetName, item);
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'inventory.create', module: 'Inventory ' + jenisUsaha, targetId: item.ItemID, detail: { nama: item.NamaItem }, result: 'Success' });
  return item;
}

function updateInventoryItem(jenisUsaha, itemId, payload, actor) {
  var sheetName = inventorySheetFor_(jenisUsaha);
  var patch = { UpdatedAt: new Date().toISOString() };
  if (payload.namaItem !== undefined) patch.NamaItem = sanitizeString(payload.namaItem, 150);
  if (payload.kategori !== undefined) patch.Kategori = sanitizeString(payload.kategori, 100);
  if (payload.satuanStok !== undefined) patch.SatuanStok = sanitizeString(payload.satuanStok, 20);
  if (payload.stokMinimum !== undefined) patch.StokMinimum = toSafeNumber(payload.stokMinimum, 5, { min: 0, clamp: true });
  if (payload.hargaBeliTerakhir !== undefined) patch.HargaBeliTerakhir = toSafeNumber(payload.hargaBeliTerakhir, 0, { min: 0, clamp: true });
  if (payload.supplier !== undefined) patch.Supplier = sanitizeString(payload.supplier, 150);

  var updated = dbUpdateById(sheetName, 'ItemID', itemId, patch);
  if (!updated) throw createAppError('NOT_FOUND', 'Item inventory tidak ditemukan');
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'inventory.update', module: 'Inventory ' + jenisUsaha, targetId: itemId, detail: { fields: Object.keys(patch) }, result: 'Success' });
  return updated;
}

/**
 * Sesuaikan stok manual. delta positif = pembelian/restock (opsional catat
 * hargaBeli terbaru), delta negatif = pemakaian. Ditolak kalau hasil akhir
 * akan negatif.
 */
function adjustInventoryStok(jenisUsaha, itemId, delta, keterangan, hargaBeli, actor) {
  var sheetName = inventorySheetFor_(jenisUsaha);
  var existing = dbFindByField(sheetName, 'ItemID', itemId);
  if (!existing) throw createAppError('NOT_FOUND', 'Item inventory tidak ditemukan');

  var d = toSafeNumber(delta, 0, {});
  var stokBaru = (Number(existing.Stok) || 0) + d;
  if (stokBaru < 0) {
    throw createAppError('VALIDATION_ERROR', 'Stok tidak cukup untuk pengurangan ini (sisa saat ini: ' + existing.Stok + ').');
  }

  var patch = { Stok: stokBaru, UpdatedAt: new Date().toISOString() };
  if (d > 0 && hargaBeli !== undefined && hargaBeli !== '') {
    patch.HargaBeliTerakhir = toSafeNumber(hargaBeli, existing.HargaBeliTerakhir, { min: 0, clamp: true });
  }

  var updated = dbUpdateById(sheetName, 'ItemID', itemId, patch);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: d >= 0 ? 'inventory.restock' : 'inventory.consume', module: 'Inventory ' + jenisUsaha, targetId: itemId,
    detail: { delta: d, keterangan: sanitizeString(keterangan, 200), stokBaru: stokBaru }, result: 'Success'
  });
  return updated;
}

function isLowStock_(item) {
  return Number(item.Stok) <= Number(item.StokMinimum);
}

/** Dipakai badge notifikasi "stok hampir habis" — gabungan Inventory Barber+Warkop & Produk Warkop. */
function getLowStockSummary() {
  var invBarber = listInventory(JENIS_USAHA.BARBER)
    .filter(isLowStock_)
    .map(function (i) { return { jenisUsaha: 'Barber', tipe: 'Inventory', id: i.ItemID, nama: i.NamaItem, stok: i.Stok, satuan: i.SatuanStok, stokMinimum: i.StokMinimum }; });

  var invWarkop = listInventory(JENIS_USAHA.WARKOP)
    .filter(isLowStock_)
    .map(function (i) { return { jenisUsaha: 'Warkop', tipe: 'Inventory', id: i.ItemID, nama: i.NamaItem, stok: i.Stok, satuan: i.SatuanStok, stokMinimum: i.StokMinimum }; });

  var produkWarkopLow = listProdukWarkop(false)
    .filter(isLowStock_)
    .map(function (p) { return { jenisUsaha: 'Warkop', tipe: 'Menu', id: p.ProdukID, nama: p.NamaMenu, stok: p.Stok, satuan: p.SatuanStok, stokMinimum: p.StokMinimum }; });

  return invBarber.concat(invWarkop, produkWarkopLow);
}

if (typeof module !== 'undefined') {
  module.exports = { isLowStock_: isLowStock_ };
}
