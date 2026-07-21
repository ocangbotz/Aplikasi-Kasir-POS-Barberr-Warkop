/**
 * Validation.js — validasi payload & RBAC (role-based access control).
 * Murni logika (tidak ada dependency SpreadsheetApp), jadi diuji langsung lewat Node.
 *
 * PENTING soal urutan file di Apps Script: semua file .gs digabung dalam SATU
 * scope global saat dijalankan, TAPI urutan eksekusi statement top-level LINTAS
 * FILE tidak dijamin oleh Google. Karena itu peta ROLE_PERMISSIONS di bawah
 * sengaja dibangun secara *lazy* (baru dievaluasi saat pertama kali dipakai,
 * bukan saat file di-load) supaya tidak bergantung pada Config.js sudah
 * ter-load duluan atau belum.
 *
 * Daftar ACTIONS di sini akan terus bertambah seiring modul baru ditambahkan
 * (Fase 4-9). Fase 1 sudah mengisi kontrak hak akses penuh (sesuai matriks RBAC
 * di rencana) walau sebagian handler-nya baru diimplementasikan di fase
 * berikutnya — supaya router Fase 1 tidak perlu diubah lagi saat modul baru
 * ditambahkan, cukup tambah handler dan pakai action yang sudah terdaftar.
 */

var ACTIONS = {
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_ME: 'auth.me',

  USERS_LIST: 'users.list',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_SET_ROLE: 'users.setRole',

  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',

  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',

  AUDITLOG_LIST: 'auditlog.list',

  DASHBOARD_VIEW: 'dashboard.view',

  TRANSAKSI_CREATE: 'transaksi.create',
  TRANSAKSI_UPDATE: 'transaksi.update',
  TRANSAKSI_DELETE: 'transaksi.delete',
  TRANSAKSI_RESTORE: 'transaksi.restore',
  TRANSAKSI_LIST: 'transaksi.list',

  LAYANAN_LIST: 'layanan.list',
  LAYANAN_MANAGE: 'layanan.manage',
  CAPSTER_LIST: 'capster.list',
  CAPSTER_MANAGE: 'capster.manage',
  PRODUK_MANAGE: 'produk.manage',
  INVENTORY_MANAGE: 'inventory.manage',
  INVENTORY_VIEW: 'inventory.view',

  PELANGGAN_MANAGE: 'pelanggan.manage',
  PELANGGAN_VIEW: 'pelanggan.view',

  PENGELUARAN_CREATE: 'pengeluaran.create',
  PENGELUARAN_VIEW: 'pengeluaran.view',

  SHIFT_OPEN: 'shift.open',
  SHIFT_CLOSE: 'shift.close',
  SHIFT_REOPEN: 'shift.reopen',
  SHIFT_VIEW: 'shift.view',

  PAYROLL_GENERATE: 'payroll.generate',
  PAYROLL_VIEW_ALL: 'payroll.viewAll',
  PAYROLL_VIEW_SELF: 'payroll.viewSelf',

  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  PROMO_MANAGE: 'promo.manage'
};

/** Ambil objek ROLES baik di GAS (global sudah ter-load) maupun Node (lewat require). */
function _getRoles() {
  if (typeof ROLES !== 'undefined') return ROLES;
  return require('./Config.js').ROLES;
}

var _rolePermissionsCache = null;

/** Bangun (sekali, memoized) peta aksi -> daftar role yang diizinkan. */
function getRolePermissions() {
  if (_rolePermissionsCache) return _rolePermissionsCache;
  var R = _getRoles();
  var P = {};
  P[ACTIONS.AUTH_LOGIN] = [R.OWNER, R.ADMIN, R.KASIR, R.CAPSTER];
  P[ACTIONS.AUTH_LOGOUT] = [R.OWNER, R.ADMIN, R.KASIR, R.CAPSTER];
  P[ACTIONS.AUTH_ME] = [R.OWNER, R.ADMIN, R.KASIR, R.CAPSTER];

  P[ACTIONS.USERS_LIST] = [R.OWNER];
  P[ACTIONS.USERS_CREATE] = [R.OWNER];
  P[ACTIONS.USERS_UPDATE] = [R.OWNER];
  P[ACTIONS.USERS_SET_ROLE] = [R.OWNER];

  P[ACTIONS.SETTINGS_VIEW] = [R.OWNER, R.ADMIN, R.KASIR, R.CAPSTER];
  P[ACTIONS.SETTINGS_UPDATE] = [R.OWNER];

  P[ACTIONS.BACKUP_CREATE] = [R.OWNER];
  P[ACTIONS.BACKUP_RESTORE] = [R.OWNER];

  P[ACTIONS.AUDITLOG_LIST] = [R.OWNER, R.ADMIN];

  P[ACTIONS.DASHBOARD_VIEW] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.TRANSAKSI_CREATE] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.TRANSAKSI_UPDATE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.TRANSAKSI_DELETE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.TRANSAKSI_RESTORE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.TRANSAKSI_LIST] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.LAYANAN_LIST] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.LAYANAN_MANAGE] = [R.OWNER];
  P[ACTIONS.CAPSTER_LIST] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.CAPSTER_MANAGE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.PRODUK_MANAGE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.INVENTORY_MANAGE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.INVENTORY_VIEW] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.PELANGGAN_MANAGE] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.PELANGGAN_VIEW] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.PENGELUARAN_CREATE] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.PENGELUARAN_VIEW] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.SHIFT_OPEN] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.SHIFT_CLOSE] = [R.OWNER, R.ADMIN, R.KASIR];
  P[ACTIONS.SHIFT_REOPEN] = [R.OWNER, R.ADMIN];
  P[ACTIONS.SHIFT_VIEW] = [R.OWNER, R.ADMIN, R.KASIR];

  P[ACTIONS.PAYROLL_GENERATE] = [R.OWNER, R.ADMIN];
  P[ACTIONS.PAYROLL_VIEW_ALL] = [R.OWNER, R.ADMIN];
  P[ACTIONS.PAYROLL_VIEW_SELF] = [R.OWNER, R.ADMIN, R.CAPSTER];

  P[ACTIONS.REPORTS_VIEW] = [R.OWNER, R.ADMIN];
  P[ACTIONS.REPORTS_EXPORT] = [R.OWNER, R.ADMIN];

  P[ACTIONS.PROMO_MANAGE] = [R.OWNER, R.ADMIN];

  _rolePermissionsCache = P;
  return P;
}

/** Buat Error dengan .code untuk dibedakan dari error tak terduga saat di-catch router. */
function createAppError(code, message) {
  var err = new Error(message);
  err.code = code;
  return err;
}

function hasPermission(role, action) {
  var allowed = getRolePermissions()[action];
  if (!allowed) return false;
  return allowed.indexOf(role) !== -1;
}

/** Lempar AppError('FORBIDDEN', ...) jika role tidak berhak melakukan action. */
function assertPermission(role, action) {
  if (!hasPermission(role, action)) {
    throw createAppError('FORBIDDEN', 'Role "' + role + '" tidak memiliki akses untuk aksi "' + action + '"');
  }
}

/** Kembalikan array nama field yang kosong/hilang dari payload. */
function findMissingFields(payload, requiredFields) {
  var missing = [];
  var p = payload || {};
  for (var i = 0; i < requiredFields.length; i++) {
    var f = requiredFields[i];
    var v = p[f];
    if (v === undefined || v === null || v === '') missing.push(f);
  }
  return missing;
}

/** Lempar AppError('VALIDATION_ERROR', ...) jika ada field wajib yang kosong. */
function assertRequiredFields(payload, requiredFields) {
  var missing = findMissingFields(payload, requiredFields);
  if (missing.length > 0) {
    throw createAppError('VALIDATION_ERROR', 'Field wajib belum diisi: ' + missing.join(', '));
  }
}

function _getSanitizeString() {
  if (typeof sanitizeString !== 'undefined') return sanitizeString;
  return require('./Utils.js').sanitizeString;
}

function validateLoginPayload(payload) {
  assertRequiredFields(payload, ['username', 'password']);
  var sanitize = _getSanitizeString();
  return {
    username: sanitize(payload.username, 100),
    password: String(payload.password)
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    ACTIONS: ACTIONS,
    getRolePermissions: getRolePermissions,
    createAppError: createAppError,
    hasPermission: hasPermission,
    assertPermission: assertPermission,
    findMissingFields: findMissingFields,
    assertRequiredFields: assertRequiredFields,
    validateLoginPayload: validateLoginPayload
  };
}
