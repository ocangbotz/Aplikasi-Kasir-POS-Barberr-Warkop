/**
 * Settings.js — baca/tulis sheet Settings (key-value). GAS-only (memakai Db).
 */

function getSettingsMap() {
  var rows = dbGetAll(SHEET.SETTINGS);
  var map = {};
  rows.forEach(function (r) { map[r.Key] = r.Value; });
  return map;
}

/** patchMap: { key: value, ... }. Key baru akan ditambahkan, key lama di-update di tempat. */
function updateSettings(patchMap, actor) {
  var updatedKeys = [];
  Object.keys(patchMap).forEach(function (key) {
    var value = patchMap[key];
    var existing = dbFindByField(SHEET.SETTINGS, 'Key', key);
    if (existing) {
      dbUpdateById(SHEET.SETTINGS, 'Key', key, { Value: value });
    } else {
      dbAppend(SHEET.SETTINGS, { Key: key, Value: value, Keterangan: '' });
    }
    updatedKeys.push(key);
  });
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'settings.update', module: 'Settings', targetId: '-',
    detail: { updatedKeys: updatedKeys }, result: 'Success'
  });
  return getSettingsMap();
}
