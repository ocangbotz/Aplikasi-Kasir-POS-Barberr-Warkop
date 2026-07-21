const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  utf8Bytes,
  bytesToUtf8String,
  base64UrlEncodeBytes,
  base64UrlDecodeToBytes,
  normalizeSignedBytes,
  bytesToHex,
  timingSafeEqualStr,
  buildTokenPayload,
  isTokenPayloadExpired,
  signToken,
  verifyToken
} = require('../../backend/gas/TokenUtils.js');

// Simulasi primitive HMAC-SHA256 milik Node (unsigned byte 0-255) — dipakai layaknya
// Apps Script akan menyuntikkan Utilities.computeHmacSha256Signature di Auth.js.
function hmacUnsigned(message, secret) {
  return Array.from(crypto.createHmac('sha256', secret).update(message, 'utf8').digest());
}

// Simulasi keluaran Apps Script yang signed byte (-128..127) — untuk membuktikan
// normalizeSignedBytes benar-benar menyamakan hasil kedua representasi.
function hmacSigned(message, secret) {
  return hmacUnsigned(message, secret).map((b) => (b > 127 ? b - 256 : b));
}

test('utf8Bytes/bytesToUtf8String round-trip untuk ASCII & unicode (emoji, aksen)', () => {
  ['Budi Santoso', 'Café ☕ Warkop', 'Kopi Susu 😀', ''].forEach((str) => {
    const bytes = utf8Bytes(str);
    assert.equal(bytesToUtf8String(bytes), str);
  });
});

test('base64UrlEncodeBytes/DecodeToBytes round-trip, tanpa karakter +/=/ (aman untuk URL)', () => {
  for (let len = 0; len <= 10; len++) {
    const bytes = Array.from({ length: len }, (_, i) => (i * 37 + 5) % 256);
    const encoded = base64UrlEncodeBytes(bytes);
    assert.ok(!/[+/=]/.test(encoded), `encoded="${encoded}" tidak boleh mengandung + / =`);
    assert.deepEqual(base64UrlDecodeToBytes(encoded), bytes);
  }
});

test('normalizeSignedBytes menyamakan representasi signed (-128..127) dan unsigned (0..255)', () => {
  const unsigned = [0, 1, 127, 128, 200, 255];
  const signed = unsigned.map((b) => (b > 127 ? b - 256 : b));
  assert.deepEqual(normalizeSignedBytes(signed), unsigned);
  assert.deepEqual(normalizeSignedBytes(unsigned), unsigned, 'byte yang sudah unsigned tidak boleh berubah');
});

test('bytesToHex menghasilkan hex 2-digit per byte (termasuk leading zero)', () => {
  assert.equal(bytesToHex([0, 1, 15, 16, 255]), '00010f10ff');
});

test('timingSafeEqualStr', () => {
  assert.equal(timingSafeEqualStr('abc', 'abc'), true);
  assert.equal(timingSafeEqualStr('abc', 'abd'), false);
  assert.equal(timingSafeEqualStr('abc', 'ab'), false);
  assert.equal(timingSafeEqualStr('abc', 123), false);
});

test('buildTokenPayload & isTokenPayloadExpired', () => {
  const now = new Date(2026, 6, 20, 10, 0, 0).getTime();
  const payload = buildTokenPayload({ uid: 'USR-1', username: 'budi', role: 'Kasir', name: 'Budi' }, 12, now);
  assert.equal(payload.uid, 'USR-1');
  assert.equal(payload.exp - payload.iat, 12 * 3600);
  assert.equal(isTokenPayloadExpired(payload, now), false);
  assert.equal(isTokenPayloadExpired(payload, now + 11 * 3600 * 1000), false);
  assert.equal(isTokenPayloadExpired(payload, now + 13 * 3600 * 1000), true);
  assert.equal(isTokenPayloadExpired(null, now), true);
});

test('buildTokenPayload: dua login pada detik yang sama HARUS tetap menghasilkan token berbeda (butuh jti unik)', () => {
  // Regresi: tanpa `jti` unik, dua payload dgn iat/exp identik akan
  // menghasilkan signature identik -> logout salah satu sesi ikut
  // merevoke sesi lain yang bertoken sama persis (ditemukan lewat
  // simulasi end-to-end saat implementasi Fase 1).
  const secret = 'secret';
  const now = Date.now();
  const user = { uid: 'USR-1', username: 'owner', role: 'Owner', name: 'Owner' };
  const payload1 = buildTokenPayload(user, 12, now, 'jti-session-1');
  const payload2 = buildTokenPayload(user, 12, now, 'jti-session-2');
  assert.notEqual(JSON.stringify(payload1), JSON.stringify(payload2));

  const token1 = signToken(payload1, secret, hmacUnsigned);
  const token2 = signToken(payload2, secret, hmacUnsigned);
  assert.notEqual(token1, token2, 'token dua sesi login berbeda harus punya signature berbeda');
});

test('signToken + verifyToken: round-trip valid dengan primitive unsigned maupun signed (simulasi GAS)', () => {
  const secret = 'super-secret-key';
  const now = Date.now();
  const payload = buildTokenPayload({ uid: 'USR-1', username: 'owner', role: 'Owner', name: 'Owner' }, 12, now);

  const tokenUnsigned = signToken(payload, secret, hmacUnsigned);
  const tokenSigned = signToken(payload, secret, hmacSigned);
  assert.equal(tokenUnsigned, tokenSigned, 'token harus identik terlepas dari representasi signed/unsigned byte');

  const resultUnsigned = verifyToken(tokenUnsigned, secret, hmacUnsigned, now + 1000);
  assert.equal(resultUnsigned.valid, true);
  assert.equal(resultUnsigned.payload.uid, 'USR-1');
  assert.equal(resultUnsigned.payload.role, 'Owner');

  const resultSigned = verifyToken(tokenSigned, secret, hmacSigned, now + 1000);
  assert.equal(resultSigned.valid, true);

  const crossCheck = verifyToken(tokenSigned, secret, hmacUnsigned, now + 1000);
  assert.equal(crossCheck.valid, true, 'token yang ditandatangani dgn primitive signed harus tetap valid diverifikasi primitive unsigned');
});

test('verifyToken menolak token yang di-tamper (payload diubah tanpa re-sign)', () => {
  const secret = 'super-secret-key';
  const payload = buildTokenPayload({ uid: 'USR-1', username: 'kasir1', role: 'Kasir', name: 'Kasir Satu' }, 12);
  const token = signToken(payload, secret, hmacUnsigned);
  const [payloadB64, sigB64] = token.split('.');

  const tamperedPayload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  tamperedPayload.role = 'Owner'; // coba naikkan hak akses sendiri
  const tamperedPayloadB64 = base64UrlEncodeBytes(utf8Bytes(JSON.stringify(tamperedPayload)));
  const tamperedToken = tamperedPayloadB64 + '.' + sigB64;

  const result = verifyToken(tamperedToken, secret, hmacUnsigned);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'INVALID_SIGNATURE');
});

test('verifyToken menolak secret yang salah', () => {
  const payload = buildTokenPayload({ uid: 'USR-1', username: 'a', role: 'Kasir', name: 'A' }, 12);
  const token = signToken(payload, 'secret-benar', hmacUnsigned);
  const result = verifyToken(token, 'secret-salah', hmacUnsigned);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'INVALID_SIGNATURE');
});

test('verifyToken mendeteksi token kedaluwarsa', () => {
  const secret = 'secret';
  const now = Date.now();
  const payload = buildTokenPayload({ uid: 'USR-1', username: 'a', role: 'Kasir', name: 'A' }, 1, now); // ttl 1 jam
  const token = signToken(payload, secret, hmacUnsigned);
  const result = verifyToken(token, secret, hmacUnsigned, now + 2 * 3600 * 1000);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'EXPIRED');
});

test('verifyToken menolak token yang malformed (tanpa titik pemisah)', () => {
  const result = verifyToken('bukan-token-valid', 'secret', hmacUnsigned);
  assert.equal(result.valid, false);
  assert.equal(result.error, 'MALFORMED_TOKEN');
});
