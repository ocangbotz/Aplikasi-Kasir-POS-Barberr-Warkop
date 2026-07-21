/**
 * Auth.gs
 * Login, session token, dan pengecekan hak akses (role permission).
 * Session disimpan di Script Properties (bertahan lintas eksekusi, TTL manual)
 * karena Apps Script web app tidak punya konsep session server seperti Express.
 */

var SESSION_PREFIX_ = 'SESSION_';

function hashPassword_(password, salt) {
  var digest = Utilities.computeHmacSha256Signature(password, salt);
  return digest.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function generateSalt_() {
  return Utilities.getUuid();
}

/**
 * Login dengan username & password.
 * @return {ok, data:{token, user}} melalui router -- lempar AppError_ jika gagal.
 */
function authLogin_(payload) {
  requireFields_(payload, ['username', 'password']);
  var username = sanitizeString_(payload.username).toLowerCase();
  var data = getSheetData_(SHEETS.KASIR);
  var user = data.rows.filter(function (r) {
    return String(r.Username).toLowerCase() === username;
  })[0];

  if (!user) throw new AppError_('AUTH_INVALID', 'Username atau password salah.');
  if (String(user.Status).toLowerCase() !== 'aktif') {
    throw new AppError_('AUTH_DISABLED', 'Akun ini tidak aktif. Hubungi Owner/Admin.');
  }

  var hash = hashPassword_(payload.password, user.PasswordSalt);
  if (hash !== user.PasswordHash) {
    throw new AppError_('AUTH_INVALID', 'Username atau password salah.');
  }

  var session = createSession_(user);
  writeAuditLog_(user, 'LOGIN', 'Auth', '', 'Login berhasil');
  return { token: session.token, user: publicUser_(user) };
}

function publicUser_(user) {
  return {
    id: user.ID,
    nama: user.Nama,
    username: user.Username,
    role: user.Role,
    capsterId: user.CapsterID || ''
  };
}

function createSession_(user) {
  var token = Utilities.getUuid();
  var expiresAt = Date.now() + APP_CONFIG.SESSION_TTL_HOURS * 60 * 60 * 1000;
  var session = { userId: user.ID, role: user.Role, nama: user.Nama, username: user.Username, expiresAt: expiresAt };
  PropertiesService.getScriptProperties().setProperty(SESSION_PREFIX_ + token, JSON.stringify(session));
  return { token: token, session: session };
}

function getSession_(token) {
  if (!token) return null;
  var raw = PropertiesService.getScriptProperties().getProperty(SESSION_PREFIX_ + token);
  if (!raw) return null;
  var session = JSON.parse(raw);
  if (Date.now() > session.expiresAt) {
    PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX_ + token);
    return null;
  }
  return session;
}

function authLogout_(payload) {
  if (payload && payload.token) {
    PropertiesService.getScriptProperties().deleteProperty(SESSION_PREFIX_ + payload.token);
  }
  return { loggedOut: true };
}

/** Lempar AppError_ jika token tidak valid/expired. @return session */
function requireAuth_(token) {
  var session = getSession_(token);
  if (!session) throw new AppError_('AUTH_REQUIRED', 'Sesi tidak valid atau sudah berakhir. Silakan login kembali.');
  return session;
}

function hasPermission_(role, permission) {
  var perms = PERMISSIONS[role];
  if (!perms) return false;
  if (perms.all) return true;
  return !!perms[permission];
}

/** Lempar AppError_ jika role pada session tidak punya permission tsb. */
function requirePermission_(session, permission) {
  if (!hasPermission_(session.role, permission)) {
    throw new AppError_('FORBIDDEN', 'Anda tidak memiliki akses untuk aksi ini.');
  }
}

function authGetMe_(payload) {
  var session = requireAuth_(payload.token);
  var user = findRowById_(SHEETS.KASIR, session.userId);
  if (!user) throw new AppError_('AUTH_REQUIRED', 'Akun tidak ditemukan.');
  return { user: publicUser_(user) };
}
