/**
 * Kasir.js — profil operasional Kasir, disinkron otomatis dari Users.js
 * (sama seperti Capster.js) supaya sheet "Kasir" yang diminta spesifikasi
 * tetap terisi tanpa input ganda.
 */

function listKasir(includeInactive) {
  var rows = dbGetAll(SHEET.KASIR);
  if (includeInactive) return rows;
  return rows.filter(function (r) { return r.Aktif === true; });
}

/** Dipanggil dari Users.js. user: {uid, username, fullName, aktif}. */
function syncKasirProfileFromUser(user) {
  var existing = dbFindByField(SHEET.KASIR, 'Username', user.username);
  if (existing) {
    dbUpdateById(SHEET.KASIR, 'KasirID', existing.KasirID, { Nama: user.fullName, Aktif: user.aktif });
    return;
  }
  dbAppend(SHEET.KASIR, {
    KasirID: generateId('KSR'),
    Nama: user.fullName,
    Username: user.username,
    Aktif: user.aktif,
    CreatedAt: new Date().toISOString()
  });
}
