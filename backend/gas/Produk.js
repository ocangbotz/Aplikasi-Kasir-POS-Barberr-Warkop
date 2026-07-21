/**
 * Produk.js — CRUD Menu Warkop (Nama, Kategori, Modal, Harga Jual, Margin,
 * Stok, Status Aktif). Margin dihitung otomatis (HargaJual - Modal) setiap
 * kali salah satunya diubah. GAS-only (memakai Db).
 */

function listProdukWarkop(includeInactive) {
  var rows = dbGetAll(SHEET.PRODUK_WARKOP);
  if (includeInactive) return rows;
  return rows.filter(function (r) { return r.Aktif === true; });
}

function createProdukWarkop(payload, actor) {
  assertRequiredFields(payload, ['namaMenu', 'hargaJual']);
  var modal = toSafeNumber(payload.modal, 0, { min: 0, clamp: true });
  var hargaJual = toSafeNumber(payload.hargaJual, 0, { min: 0, clamp: true });

  var produk = {
    ProdukID: generateId('PRD'),
    NamaMenu: sanitizeString(payload.namaMenu, 150),
    Kategori: sanitizeString(payload.kategori || 'Umum', 100),
    Modal: modal,
    HargaJual: hargaJual,
    Margin: roundCurrency(hargaJual - modal),
    Stok: toSafeNumber(payload.stok, 0, { min: 0, clamp: true }),
    SatuanStok: sanitizeString(payload.satuanStok || 'pcs', 20),
    StokMinimum: toSafeNumber(payload.stokMinimum, 5, { min: 0, clamp: true }),
    Aktif: true,
    FotoUrl: sanitizeString(payload.fotoUrl, 500)
  };
  dbAppend(SHEET.PRODUK_WARKOP, produk);
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'produk.create', module: 'Produk', targetId: produk.ProdukID, detail: { nama: produk.NamaMenu }, result: 'Success' });
  return produk;
}

function updateProdukWarkop(produkId, payload, actor) {
  var existing = dbFindByField(SHEET.PRODUK_WARKOP, 'ProdukID', produkId);
  if (!existing) throw createAppError('NOT_FOUND', 'Menu tidak ditemukan');

  var patch = {};
  if (payload.namaMenu !== undefined) patch.NamaMenu = sanitizeString(payload.namaMenu, 150);
  if (payload.kategori !== undefined) patch.Kategori = sanitizeString(payload.kategori, 100);
  if (payload.satuanStok !== undefined) patch.SatuanStok = sanitizeString(payload.satuanStok, 20);
  if (payload.stokMinimum !== undefined) patch.StokMinimum = toSafeNumber(payload.stokMinimum, existing.StokMinimum, { min: 0, clamp: true });
  if (payload.aktif !== undefined) patch.Aktif = !!payload.aktif;
  if (payload.fotoUrl !== undefined) patch.FotoUrl = sanitizeString(payload.fotoUrl, 500);

  var modalBaru = payload.modal !== undefined ? toSafeNumber(payload.modal, existing.Modal, { min: 0, clamp: true }) : Number(existing.Modal);
  var hargaJualBaru = payload.hargaJual !== undefined ? toSafeNumber(payload.hargaJual, existing.HargaJual, { min: 0, clamp: true }) : Number(existing.HargaJual);
  if (payload.modal !== undefined) patch.Modal = modalBaru;
  if (payload.hargaJual !== undefined) patch.HargaJual = hargaJualBaru;
  if (payload.modal !== undefined || payload.hargaJual !== undefined) patch.Margin = roundCurrency(hargaJualBaru - modalBaru);

  var updated = dbUpdateById(SHEET.PRODUK_WARKOP, 'ProdukID', produkId, patch);
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'produk.update', module: 'Produk', targetId: produkId, detail: { fields: Object.keys(patch) }, result: 'Success' });
  return updated;
}

/** Tambah stok (restock manual, terpisah dari pengurangan otomatis saat transaksi). */
function restockProdukWarkop(produkId, tambahan, actor) {
  var existing = dbFindByField(SHEET.PRODUK_WARKOP, 'ProdukID', produkId);
  if (!existing) throw createAppError('NOT_FOUND', 'Menu tidak ditemukan');
  var jumlah = toSafeNumber(tambahan, 0, { min: 0, clamp: true });
  var updated = dbUpdateById(SHEET.PRODUK_WARKOP, 'ProdukID', produkId, { Stok: (Number(existing.Stok) || 0) + jumlah });
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'produk.restock', module: 'Produk', targetId: produkId, detail: { tambahan: jumlah }, result: 'Success' });
  return updated;
}

/** Dipanggil Warkop.js setelah transaksi tersimpan — kurangi stok tiap item terjual. */
function decrementStokProduk_(produkId, qty) {
  var existing = dbFindByField(SHEET.PRODUK_WARKOP, 'ProdukID', produkId);
  if (!existing) return;
  var sisa = Math.max(0, (Number(existing.Stok) || 0) - qty);
  dbUpdateById(SHEET.PRODUK_WARKOP, 'ProdukID', produkId, { Stok: sisa });
}
