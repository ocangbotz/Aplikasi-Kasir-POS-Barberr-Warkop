/**
 * Capster.js — profil operasional Capster (nama, persentase bagi hasil, dsb),
 * terpisah dari kredensial login (sheet Users). Baris di sini dibuat/disinkron
 * OTOMATIS oleh Users.js saat akun ber-role Capster dibuat/diubah, supaya
 * Owner cukup satu kali input lewat halaman Manajemen User — tidak perlu
 * mengisi data yang sama dua kali.
 */

var DEFAULT_PERSENTASE_BAGI_HASIL = 40;

function listCapsters(includeInactive) {
  var rows = dbGetAll(SHEET.CAPSTER);
  if (includeInactive) return rows;
  return rows.filter(function (r) { return r.Aktif === true; });
}

/** Dipanggil dari Users.js. user: {uid, username, fullName, aktif}. */
function syncCapsterProfileFromUser(user) {
  var existing = dbFindByField(SHEET.CAPSTER, 'Username', user.username);
  if (existing) {
    dbUpdateById(SHEET.CAPSTER, 'CapsterID', existing.CapsterID, { Nama: user.fullName, Aktif: user.aktif });
    return;
  }
  dbAppend(SHEET.CAPSTER, {
    CapsterID: generateId('CPS'),
    Nama: user.fullName,
    Username: user.username,
    PersentaseBagiHasil: DEFAULT_PERSENTASE_BAGI_HASIL,
    Aktif: user.aktif,
    FotoUrl: '',
    CreatedAt: new Date().toISOString()
  });
}

function updateCapster(capsterId, payload, actor) {
  var patch = {};
  if (payload.persentaseBagiHasil !== undefined) {
    patch.PersentaseBagiHasil = toSafeNumber(payload.persentaseBagiHasil, DEFAULT_PERSENTASE_BAGI_HASIL, { min: 0, max: 100, clamp: true });
  }
  if (payload.aktif !== undefined) patch.Aktif = !!payload.aktif;
  if (payload.fotoUrl !== undefined) patch.FotoUrl = sanitizeString(payload.fotoUrl, 500);

  var updated = dbUpdateById(SHEET.CAPSTER, 'CapsterID', capsterId, patch);
  if (!updated) throw createAppError('NOT_FOUND', 'Capster tidak ditemukan');
  logAudit({ userId: actor.uid, userName: actor.name, role: actor.role, action: 'capster.update', module: 'Capster', targetId: capsterId, detail: { fields: Object.keys(patch) }, result: 'Success' });
  return updated;
}
