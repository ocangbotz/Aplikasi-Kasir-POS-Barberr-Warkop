/**
 * Pelanggan.js — data pelanggan Barber: pencarian cepat, auto-create saat
 * transaksi baru, riwayat kunjungan, member & poin loyalti. GAS-only.
 */

function listPelanggan() {
  return dbGetAll(SHEET.PELANGGAN);
}

/** Pencarian cepat berdasarkan nama ATAU nomor HP (bonus fitur "Pencarian pelanggan"). */
function searchPelanggan(query) {
  var q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  var all = dbGetAll(SHEET.PELANGGAN);
  return all
    .filter(function (p) {
      return String(p.Nama).toLowerCase().indexOf(q) !== -1 || String(p.NoHP).indexOf(q) !== -1;
    })
    .slice(0, 20);
}

function findPelangganByNoHp(noHp) {
  if (!noHp) return null;
  return dbFindByField(SHEET.PELANGGAN, 'NoHP', noHp);
}

/** Dipanggil saat transaksi baru dibuat: pakai pelanggan yang sudah ada (by NoHP) atau buat baru. */
function findOrCreatePelanggan(nama, noHp) {
  var namaClean = sanitizeString(nama, 150);
  var noHpClean = sanitizeString(noHp, 30);

  if (noHpClean) {
    var existing = findPelangganByNoHp(noHpClean);
    if (existing) return existing;
  }

  var pelanggan = {
    PelangganID: generateId('PLG'),
    Nama: namaClean || 'Pelanggan',
    NoHP: noHpClean,
    TotalKunjungan: 0,
    TotalPengeluaran: 0,
    Member: false,
    PoinLoyalti: 0,
    TanggalDaftar: new Date().toISOString(),
    CatatanTerakhir: ''
  };
  dbAppend(SHEET.PELANGGAN, pelanggan);
  return pelanggan;
}

/** Diperbarui setiap transaksi Barber selesai (juga dipakai Warkop untuk pelanggan member, jika ada). */
function updatePelangganAfterTransaction(pelangganId, grandTotal, loyaltyPointsEarned) {
  var existing = dbFindByField(SHEET.PELANGGAN, 'PelangganID', pelangganId);
  if (!existing) return null;
  return dbUpdateById(SHEET.PELANGGAN, 'PelangganID', pelangganId, {
    TotalKunjungan: (Number(existing.TotalKunjungan) || 0) + 1,
    TotalPengeluaran: (Number(existing.TotalPengeluaran) || 0) + grandTotal,
    PoinLoyalti: (Number(existing.PoinLoyalti) || 0) + loyaltyPointsEarned
  });
}

function updatePelanggan(pelangganId, payload, actor) {
  var patch = {};
  if (payload.nama !== undefined) patch.Nama = sanitizeString(payload.nama, 150);
  if (payload.noHp !== undefined) patch.NoHP = sanitizeString(payload.noHp, 30);
  if (payload.member !== undefined) patch.Member = !!payload.member;
  if (payload.catatanTerakhir !== undefined) patch.CatatanTerakhir = sanitizeString(payload.catatanTerakhir, 500);

  var updated = dbUpdateById(SHEET.PELANGGAN, 'PelangganID', pelangganId, patch);
  if (!updated) throw createAppError('NOT_FOUND', 'Pelanggan tidak ditemukan');
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'pelanggan.update', module: 'Pelanggan', targetId: pelangganId, detail: { fields: Object.keys(patch) }, result: 'Success' });
  return updated;
}

/** Riwayat haircut pelanggan (transaksi Barber miliknya), terbaru dulu. */
function getRiwayatHaircut(pelangganId) {
  var all = dbGetAll(SHEET.TRANSAKSI_BARBER);
  return all
    .filter(function (t) { return t.PelangganID === pelangganId; })
    .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); });
}

function getPelangganDetail(pelangganId) {
  var pelanggan = dbFindByField(SHEET.PELANGGAN, 'PelangganID', pelangganId);
  if (!pelanggan) throw createAppError('NOT_FOUND', 'Pelanggan tidak ditemukan');
  return { pelanggan: pelanggan, riwayatHaircut: getRiwayatHaircut(pelangganId) };
}
