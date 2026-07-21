/**
 * Layanan.js — CRUD Layanan Barber (Owner boleh menambah layanan baru sesuai
 * spesifikasi). GAS-only (memakai Db).
 */

function listLayananBarber(includeInactive) {
  var rows = dbGetAll(SHEET.LAYANAN_BARBER);
  if (includeInactive) return rows;
  return rows.filter(function (r) { return r.Aktif === true; });
}

function createLayananBarber(payload, actor) {
  assertRequiredFields(payload, ['namaLayanan', 'harga']);
  var layanan = {
    LayananID: generateId('LYN'),
    NamaLayanan: sanitizeString(payload.namaLayanan, 150),
    Harga: toSafeNumber(payload.harga, 0, { min: 0, clamp: true }),
    DurasiMenit: toSafeNumber(payload.durasiMenit, 30, { min: 0, clamp: true }),
    Kategori: sanitizeString(payload.kategori || 'Umum', 100),
    Aktif: true
  };
  dbAppend(SHEET.LAYANAN_BARBER, layanan);
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'layanan.create', module: 'Layanan', targetId: layanan.LayananID, detail: { nama: layanan.NamaLayanan }, result: 'Success' });
  return layanan;
}

function updateLayananBarber(layananId, payload, actor) {
  var patch = {};
  if (payload.namaLayanan !== undefined) patch.NamaLayanan = sanitizeString(payload.namaLayanan, 150);
  if (payload.harga !== undefined) patch.Harga = toSafeNumber(payload.harga, 0, { min: 0, clamp: true });
  if (payload.durasiMenit !== undefined) patch.DurasiMenit = toSafeNumber(payload.durasiMenit, 30, { min: 0, clamp: true });
  if (payload.kategori !== undefined) patch.Kategori = sanitizeString(payload.kategori, 100);
  if (payload.aktif !== undefined) patch.Aktif = !!payload.aktif;

  var updated = dbUpdateById(SHEET.LAYANAN_BARBER, 'LayananID', layananId, patch);
  if (!updated) throw createAppError('NOT_FOUND', 'Layanan tidak ditemukan');
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'layanan.update', module: 'Layanan', targetId: layananId, detail: { fields: Object.keys(patch) }, result: 'Success' });
  return updated;
}
