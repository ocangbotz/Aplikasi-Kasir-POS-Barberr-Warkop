/**
 * Settings.gs
 * Pengaturan usaha (nama, alamat, kontak, target, dsb) dipakai di struk,
 * dashboard, dan owner panel. Disimpan sebagai pasangan Key/Value supaya
 * mudah ditambah tanpa mengubah skema sheet.
 */

function getSettings_(payload) {
  requireAuth_(payload.token);
  var data = getSheetData_(SHEETS.SETTINGS);
  var settings = {};
  data.rows.forEach(function (r) { settings[r.Key] = r.Value; });
  return { settings: settings };
}

/** Hanya Owner yang boleh mengubah pengaturan usaha (logo, alamat, target, dsb). */
function updateSettings_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'kelolaSettings');
  requireFields_(payload, ['values']);

  var data = getSheetData_(SHEETS.SETTINGS);
  var byKey = {};
  data.rows.forEach(function (r) { byKey[r.Key] = r; });

  Object.keys(payload.values).forEach(function (key) {
    var value = sanitizeString_(payload.values[key]);
    if (byKey[key]) {
      byKey[key].Value = value;
      byKey[key].UpdatedAt = new Date();
      updateRowObject_(SHEETS.SETTINGS, byKey[key]._rowIndex, byKey[key]);
    } else {
      appendRowObject_(SHEETS.SETTINGS, { Key: key, Value: value, UpdatedAt: new Date() });
    }
  });

  writeAuditLog_(session, 'UPDATE_SETTINGS', 'Settings', '', JSON.stringify(payload.values));
  return getSettings_(payload);
}
