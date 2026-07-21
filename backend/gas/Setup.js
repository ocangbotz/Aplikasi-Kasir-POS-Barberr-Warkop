/**
 * Setup.js — inisialisasi database sekali-jalan: membuat seluruh sheet + header,
 * mengisi Settings default, dan membuat akun Owner pertama.
 *
 * Cara pakai (lihat juga docs/SPREADSHEET_SETUP.md):
 *  1. Buka Spreadsheet baru -> Extensions -> Apps Script -> tempel semua file backend/gas/*.
 *  2. Buka kembali Spreadsheet (reload) supaya menu "POS Admin" muncul, ATAU
 *     jalankan fungsi `setupDatabase()` langsung dari editor Apps Script (pilih
 *     fungsi ini di dropdown lalu klik Run) dengan argumen default.
 *  3. Simpan username/password Owner yang ditampilkan, lalu segera login &
 *     ganti password lewat menu Owner di aplikasi.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('POS Admin')
    .addItem('Jalankan Setup Awal Database', 'runSetupWizard')
    .addItem('Buat Backup Sekarang', 'runBackupWizard')
    .addToUi();
}

/** Menu-driven wizard (dijalankan dari UI Spreadsheet). Untuk headless setup, panggil setupDatabase() langsung. */
function runSetupWizard() {
  var ui = SpreadsheetApp.getUi();
  var userResp = ui.prompt('Setup Database', 'Username Owner pertama (kosongkan = "owner"):', ui.ButtonSet.OK_CANCEL);
  if (userResp.getSelectedButton() !== ui.Button.OK) return;
  var username = userResp.getResponseText().trim() || 'owner';

  var passResp = ui.prompt('Setup Database', 'Password Owner (kosongkan = digenerate otomatis & ditampilkan di akhir):', ui.ButtonSet.OK_CANCEL);
  if (passResp.getSelectedButton() !== ui.Button.OK) return;
  var password = passResp.getResponseText().trim() || null;

  var nameResp = ui.prompt('Setup Database', 'Nama lengkap Owner:', ui.ButtonSet.OK_CANCEL);
  var fullName = nameResp.getSelectedButton() === ui.Button.OK ? (nameResp.getResponseText().trim() || 'Owner') : 'Owner';

  var result = setupDatabase({ ownerUsername: username, ownerPassword: password, ownerFullName: fullName });

  var msg = 'Setup selesai. ' + result.sheetsCreated + ' sheet siap.\n';
  if (result.owner.created) {
    msg += 'Akun Owner dibuat:\nUsername: ' + result.owner.username + '\nPassword: ' + result.owner.password + '\n\nSEGERA login & ganti password ini.';
  } else {
    msg += 'Akun Owner sudah ada sebelumnya, tidak dibuat ulang.';
  }
  ui.alert(msg);
}

function runBackupWizard() {
  var ui = SpreadsheetApp.getUi();
  var owner = dbGetAll(SHEET.USERS, { includeDeleted: true }).filter(function (u) { return u.Role === ROLES.OWNER; })[0];
  var triggeredBy = owner
    ? { uid: owner.UserID, name: owner.FullName, role: owner.Role }
    : { uid: '-', name: Session.getActiveUser().getEmail() || 'Manual', role: 'Owner' };
  var result = createBackup(triggeredBy);
  ui.alert('Backup dibuat: ' + result.fileName + '\n' + result.url);
}

/**
 * Membuat seluruh sheet (jika belum ada) + header, mengisi Settings default,
 * dan membuat akun Owner pertama (jika belum ada Owner sama sekali).
 * Aman dijalankan berkali-kali (idempotent): sheet/kolom/setting yang sudah
 * ada tidak akan ditimpa atau diduplikasi.
 */
function setupDatabase(options) {
  var opts = options || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = Object.keys(COLUMNS);
  for (var i = 0; i < sheetNames.length; i++) {
    ensureSheetWithHeaders_(ss, sheetNames[i], COLUMNS[sheetNames[i]]);
  }
  removeDefaultBlankSheet_(ss);
  seedDefaultSettings_();
  var ownerResult = seedFirstOwnerIfNeeded_(opts.ownerUsername, opts.ownerPassword, opts.ownerFullName);
  return { ok: true, sheetsCreated: sheetNames.length, owner: ownerResult };
}

function ensureSheetWithHeaders_(ss, name, columns) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var lastCol = sheet.getLastColumn();
  var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var headersMatch = currentHeaders.length === columns.length && columns.every(function (c, idx) { return currentHeaders[idx] === c; });
  if (!headersMatch) {
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function removeDefaultBlankSheet_(ss) {
  var sheet = ss.getSheetByName('Sheet1');
  if (sheet && ss.getSheets().length > 1 && sheet.getLastRow() === 0 && sheet.getLastColumn() === 0) {
    ss.deleteSheet(sheet);
  }
}

function seedDefaultSettings_() {
  var existing = dbGetAll(SHEET.SETTINGS, { includeDeleted: true });
  var existingKeys = {};
  existing.forEach(function (row) { existingKeys[row.Key] = true; });
  DEFAULT_SETTINGS.forEach(function (setting) {
    if (!existingKeys[setting.key]) {
      dbAppend(SHEET.SETTINGS, { Key: setting.key, Value: setting.value, Keterangan: setting.note });
    }
  });
}

function seedFirstOwnerIfNeeded_(username, password, fullName) {
  var existingOwners = dbGetAll(SHEET.USERS, { includeDeleted: true }).filter(function (u) { return u.Role === ROLES.OWNER; });
  if (existingOwners.length > 0) return { created: false };

  var uname = username || 'owner';
  var generatedPassword = password || generateRandomPassword_();
  var salt = generateSalt_();
  var hash = hashPassword_(generatedPassword, salt);

  dbAppend(SHEET.USERS, {
    UserID: generateId('USR'),
    Username: uname,
    PasswordHash: hash,
    PasswordSalt: salt,
    FullName: fullName || 'Owner',
    Role: ROLES.OWNER,
    LinkedProfileType: '-',
    LinkedProfileID: '-',
    Aktif: true,
    CreatedAt: new Date().toISOString(),
    LastLoginAt: ''
  });

  return { created: true, username: uname, password: generatedPassword };
}

function generateRandomPassword_() {
  return Utilities.getUuid().split('-')[0];
}
