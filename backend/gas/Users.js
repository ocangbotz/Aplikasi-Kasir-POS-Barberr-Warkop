/**
 * Users.js — manajemen akun login (Owner only). GAS-only (memakai Db/Auth helpers).
 * Data profil operasional (Kasir/Capster) ada di sheet terpisah (Kasir.js/Capster.js)
 * — sheet Users murni untuk kredensial & role. Setiap user dibuat/diubah dengan
 * Role Kasir/Capster otomatis disinkron ke sheet profilnya masing-masing supaya
 * Owner tidak perlu input data yang sama dua kali.
 */

function syncRoleProfile_(user) {
  if (user.Role === ROLES.KASIR) syncKasirProfileFromUser({ username: user.Username, fullName: user.FullName, aktif: user.Aktif });
  if (user.Role === ROLES.CAPSTER) syncCapsterProfileFromUser({ username: user.Username, fullName: user.FullName, aktif: user.Aktif });
}

/** Jangan pernah kirim PasswordHash/PasswordSalt ke client. */
function sanitizeUserForClient_(u) {
  return {
    uid: u.UserID,
    username: u.Username,
    fullName: u.FullName,
    role: u.Role,
    linkedProfileType: u.LinkedProfileType,
    linkedProfileId: u.LinkedProfileID,
    aktif: u.Aktif,
    createdAt: u.CreatedAt,
    lastLoginAt: u.LastLoginAt
  };
}

function listUsers() {
  return dbGetAll(SHEET.USERS).map(sanitizeUserForClient_);
}

function createUser(payload, actor) {
  assertRequiredFields(payload, ['username', 'password', 'fullName', 'role']);
  if (ALL_ROLES.indexOf(payload.role) === -1) {
    throw createAppError('VALIDATION_ERROR', 'Role tidak dikenal: ' + payload.role);
  }
  var username = sanitizeString(payload.username, 100);
  var existing = dbFindByField(SHEET.USERS, 'Username', username);
  if (existing) throw createAppError('VALIDATION_ERROR', 'Username sudah dipakai');

  var salt = generateSalt_();
  var hash = hashPassword_(payload.password, salt);
  var user = {
    UserID: generateId('USR'),
    Username: username,
    PasswordHash: hash,
    PasswordSalt: salt,
    FullName: sanitizeString(payload.fullName, 150),
    Role: payload.role,
    LinkedProfileType: payload.linkedProfileType || '-',
    LinkedProfileID: payload.linkedProfileId || '-',
    Aktif: true,
    CreatedAt: new Date().toISOString(),
    LastLoginAt: ''
  };
  dbAppend(SHEET.USERS, user);
  syncRoleProfile_(user);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'users.create', module: 'Users', targetId: user.UserID,
    detail: { username: user.Username, role: user.Role }, result: 'Success'
  });
  return sanitizeUserForClient_(user);
}

function updateUser(userId, patch, actor) {
  var allowed = {};
  if (patch.fullName !== undefined) allowed.FullName = sanitizeString(patch.fullName, 150);
  if (patch.role !== undefined) {
    if (ALL_ROLES.indexOf(patch.role) === -1) throw createAppError('VALIDATION_ERROR', 'Role tidak dikenal: ' + patch.role);
    allowed.Role = patch.role;
  }
  if (patch.aktif !== undefined) allowed.Aktif = !!patch.aktif;
  if (patch.newPassword) {
    var salt = generateSalt_();
    allowed.PasswordSalt = salt;
    allowed.PasswordHash = hashPassword_(patch.newPassword, salt);
  }
  var updated = dbUpdateById(SHEET.USERS, 'UserID', userId, allowed);
  if (!updated) throw createAppError('NOT_FOUND', 'User tidak ditemukan');
  syncRoleProfile_(updated);
  logAudit({
    userId: actor.uid, userName: actor.name, role: actor.role,
    action: 'users.update', module: 'Users', targetId: userId,
    detail: { fields: Object.keys(allowed) }, result: 'Success'
  });
  return sanitizeUserForClient_(updated);
}
