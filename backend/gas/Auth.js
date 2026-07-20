/**
 * Auth.js — wrapper login/sesi khusus Apps Script (memakai PropertiesService,
 * Utilities, CacheService). Logika inti token ada di TokenUtils.js (murni,
 * teruji). File ini hanya "menyambungkan" primitive kripto GAS ke TokenUtils.
 */

var SESSION_SECRET_PROPERTY_KEY = 'TOKEN_SECRET_V1';

/** Ambil (atau buat sekali & simpan) secret HMAC dari Script Properties. */
function getOrCreateServerSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty(SESSION_SECRET_PROPERTY_KEY);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(SESSION_SECRET_PROPERTY_KEY, secret);
  }
  return secret;
}

/** hmacSignFn yang dipakai TokenUtils.signToken/verifyToken di runtime Apps Script. */
function gasHmacSign_(message, secret) {
  return Utilities.computeHmacSha256Signature(message, secret);
}

function getSessionTtlHours_() {
  var setting = dbFindByField(SHEET.SETTINGS, 'Key', 'sessionTokenTtlHours');
  var ttl = setting ? Number(setting.Value) : 12;
  return isNaN(ttl) || ttl <= 0 ? 12 : ttl;
}

function generateSalt_() {
  return Utilities.getUuid();
}

/** Hash password+salt -> hex string SHA-256 (dipakai saat membuat user & saat login). */
function hashPassword_(password, salt) {
  var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + ':' + salt);
  return bytesToHex(normalizeSignedBytes(digestBytes));
}

/**
 * Login: verifikasi username/password terhadap sheet Users, kembalikan token + info user.
 * Pesan error sengaja generik ("Username atau password salah") supaya tidak membocorkan
 * username mana yang valid (mitigasi user enumeration).
 */
function login(rawPayload) {
  var payload = validateLoginPayload(rawPayload);
  var user = dbFindByField(SHEET.USERS, 'Username', payload.username);

  var genericError = function () {
    logAudit({ userId: '-', userName: payload.username, role: '-', action: 'auth.login.failed', module: 'Auth', targetId: payload.username, detail: {}, result: 'Failed' });
    throw createAppError('UNAUTHORIZED', 'Username atau password salah');
  };

  if (!user || user.Aktif !== true) genericError();

  var computedHash = hashPassword_(payload.password, user.PasswordSalt);
  if (!timingSafeEqualStr(computedHash, user.PasswordHash)) genericError();

  var ttlHours = getSessionTtlHours_();
  var jti = Utilities.getUuid();
  var tokenPayload = buildTokenPayload({ uid: user.UserID, username: user.Username, role: user.Role, name: user.FullName }, ttlHours, undefined, jti);
  var secret = getOrCreateServerSecret_();
  var token = signToken(tokenPayload, secret, gasHmacSign_);

  dbUpdateById(SHEET.USERS, 'UserID', user.UserID, { LastLoginAt: new Date().toISOString() });
  logAudit({ userId: user.UserID, userName: user.FullName, role: user.Role, action: 'auth.login', module: 'Auth', targetId: user.UserID, detail: {}, result: 'Success' });

  return {
    token: token,
    user: { uid: user.UserID, username: user.Username, role: user.Role, name: user.FullName }
  };
}

var AUTH_ERROR_MESSAGES = {
  MALFORMED_TOKEN: 'Token tidak valid',
  MALFORMED_PAYLOAD: 'Token tidak valid',
  INVALID_SIGNATURE: 'Token tidak valid atau sudah dipalsukan',
  EXPIRED: 'Sesi sudah berakhir, silakan login kembali',
  REVOKED: 'Sesi sudah diakhiri, silakan login kembali'
};

/** Verifikasi token dari client. Melempar AppError('UNAUTHORIZED', ...) jika tidak valid. */
function requireAuth(token) {
  if (!token) throw createAppError('UNAUTHORIZED', 'Token tidak ditemukan, silakan login');
  var secret = getOrCreateServerSecret_();
  var result = verifyToken(token, secret, gasHmacSign_);
  if (result.valid && isTokenRevoked_(token)) {
    result = { valid: false, payload: result.payload, error: 'REVOKED' };
  }
  if (!result.valid) {
    throw createAppError('UNAUTHORIZED', AUTH_ERROR_MESSAGES[result.error] || 'Sesi tidak valid');
  }
  return result.payload; // {uid, username, role, name, iat, exp}
}

/** Verifikasi token + cek RBAC untuk suatu action. Dipakai router Code.js di setiap request. */
function requirePermission(token, action) {
  var authUser = requireAuth(token);
  assertPermission(authUser.role, action);
  return authUser;
}

/**
 * Logout: token stateless tidak bisa "dihapus" di server, jadi kita catat
 * signature-nya ke CacheService sampai waktu kedaluwarsanya sendiri habis —
 * cukup untuk memenuhi "logout" tanpa perlu menyimpan seluruh sesi aktif.
 */
function logout(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return { ok: true };
  var sigB64 = parts[1];
  var secret = getOrCreateServerSecret_();
  var result = verifyToken(token, secret, gasHmacSign_);
  var remainingSeconds = 60; // default kecil kalau payload sudah tidak valid
  if (result.payload && typeof result.payload.exp === 'number') {
    remainingSeconds = Math.max(60, result.payload.exp - Math.floor(Date.now() / 1000));
  }
  CacheService.getScriptCache().put('revoked:' + sigB64, '1', Math.min(remainingSeconds, 21600));
  if (result.payload) {
    logAudit({ userId: result.payload.uid, userName: result.payload.name, role: result.payload.role, action: 'auth.logout', module: 'Auth', targetId: result.payload.uid, detail: {}, result: 'Success' });
  }
  return { ok: true };
}

function isTokenRevoked_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  return CacheService.getScriptCache().get('revoked:' + parts[1]) !== null;
}
