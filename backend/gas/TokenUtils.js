/**
 * TokenUtils.js — bagian *murni* dari sistem token sesi mirip-JWT (stateless,
 * HMAC-SHA256, tanpa CacheService supaya masa berlaku tidak terbatas 6 jam).
 *
 * Kenapa dipisah dari Auth.js: perhitungan HMAC-SHA256 sendiri harus memakai
 * primitive kripto milik masing-masing runtime (Node: `crypto`, Apps Script:
 * `Utilities.computeHmacSha256Signature`). Supaya logika token (encode payload,
 * cek kedaluwarsa, bangun & verifikasi tanda tangan, base64url, hex) BENAR-BENAR
 * teruji dan bukan re-implementasi, seluruh logika di file ini murni dan
 * menerima fungsi HMAC sebagai parameter (dependency injection) — Auth.js
 * (Apps Script only, tidak di-unit-test) tinggal menyuntikkan
 * `Utilities.computeHmacSha256Signature`, sedangkan test Node menyuntikkan
 * `crypto.createHmac('sha256', secret)`. Kedua primitive tsb menghasilkan
 * digest HMAC-SHA256 yang identik untuk pesan+secret yang sama (standar
 * kriptografi yang sama), jadi verifikasi tanda tangan diuji dengan sungguhan.
 */

/** Encode string (JS UTF-16) menjadi array byte UTF-8 (0-255). */
function utf8Bytes(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.codePointAt(i);
    if (code > 0xFFFF) i++; // lompati surrogate pair kedua
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    } else if (code < 0x10000) {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    } else {
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F)
      );
    }
  }
  return bytes;
}

/** Decode array byte UTF-8 (0-255) kembali menjadi string. */
function bytesToUtf8String(bytes) {
  var str = '';
  var i = 0;
  while (i < bytes.length) {
    var b0 = bytes[i];
    var codePoint;
    var len;
    if (b0 < 0x80) { codePoint = b0; len = 1; }
    else if ((b0 & 0xE0) === 0xC0) { codePoint = b0 & 0x1F; len = 2; }
    else if ((b0 & 0xF0) === 0xE0) { codePoint = b0 & 0x0F; len = 3; }
    else { codePoint = b0 & 0x07; len = 4; }
    for (var j = 1; j < len; j++) {
      codePoint = (codePoint << 6) | (bytes[i + j] & 0x3F);
    }
    str += String.fromCodePoint(codePoint);
    i += len;
  }
  return str;
}

var B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Base64url encode (RFC 4648 §5, tanpa padding) dari array byte 0-255. */
function base64UrlEncodeBytes(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var b1 = bytes[i];
    var b2 = i + 1 < bytes.length ? bytes[i + 1] : null;
    var b3 = i + 2 < bytes.length ? bytes[i + 2] : null;
    var c1 = b1 >> 2;
    var c2 = ((b1 & 0x03) << 4) | (b2 === null ? 0 : (b2 >> 4));
    out += B64URL_CHARS[c1] + B64URL_CHARS[c2];
    if (b2 !== null) {
      var c3 = ((b2 & 0x0F) << 2) | (b3 === null ? 0 : (b3 >> 6));
      out += B64URL_CHARS[c3];
    }
    if (b3 !== null) {
      var c4 = b3 & 0x3F;
      out += B64URL_CHARS[c4];
    }
  }
  return out;
}

/** Base64url decode -> array byte 0-255. */
function base64UrlDecodeToBytes(str) {
  var lookup = {};
  for (var i = 0; i < B64URL_CHARS.length; i++) lookup[B64URL_CHARS[i]] = i;
  var bytes = [];
  var buffer = 0;
  var bits = 0;
  for (var j = 0; j < str.length; j++) {
    var c = str[j];
    if (!(c in lookup)) continue;
    buffer = (buffer << 6) | lookup[c];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xFF);
    }
  }
  return bytes;
}

function encodeJsonToB64Url(obj) {
  return base64UrlEncodeBytes(utf8Bytes(JSON.stringify(obj)));
}

function decodeB64UrlToJson(b64) {
  return JSON.parse(bytesToUtf8String(base64UrlDecodeToBytes(b64)));
}

/** Konversi array byte SIGNED (-128..127, seperti keluaran Apps Script Utilities.*) menjadi UNSIGNED (0-255). */
function normalizeSignedBytes(bytes) {
  var out = new Array(bytes.length);
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    out[i] = b < 0 ? b + 256 : b;
  }
  return out;
}

function bytesToHex(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
  }
  return hex;
}

/** Bandingkan dua string dengan waktu konstan (mitigasi timing attack sederhana). */
function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Susun payload token dari data user. iat/exp dalam detik epoch (konvensi JWT).
 *
 * `jti` (JWT ID) WAJIB unik per login — signature token dihitung dari isi
 * payload (HMAC), jadi dua login dengan payload identik (bisa terjadi kalau
 * user yang sama login 2x dalam detik yang sama, sehingga iat/exp sama)
 * akan menghasilkan TOKEN & SIGNATURE YANG SAMA PERSIS. Karena fitur logout
 * merevoke token berdasarkan signature-nya (lihat Auth.js), tanpa `jti` yang
 * unik, logout dari salah satu sesi akan ikut merevoke sesi lain yang
 * kebetulan bertoken identik. Auth.js selalu menyuntikkan `Utilities.getUuid()`
 * sebagai jti saat login sungguhan.
 */
function buildTokenPayload(user, ttlHours, nowMs, jti) {
  var now = nowMs || Date.now();
  var iat = Math.floor(now / 1000);
  var exp = iat + Math.round((ttlHours || 12) * 3600);
  return {
    uid: user.uid,
    username: user.username,
    role: user.role,
    name: user.name,
    jti: jti || null,
    iat: iat,
    exp: exp
  };
}

function isTokenPayloadExpired(payload, nowMs) {
  var now = nowMs || Date.now();
  var nowSec = Math.floor(now / 1000);
  return !payload || typeof payload.exp !== 'number' || nowSec >= payload.exp;
}

/**
 * Tanda-tangani payload menjadi token string "payloadB64.sigB64".
 * hmacSignFn(message: string, secret: string) => array byte signature (signed atau unsigned, akan dinormalisasi).
 */
function signToken(payload, secret, hmacSignFn) {
  var payloadB64 = encodeJsonToB64Url(payload);
  var sigBytes = normalizeSignedBytes(hmacSignFn(payloadB64, secret));
  var sigB64 = base64UrlEncodeBytes(sigBytes);
  return payloadB64 + '.' + sigB64;
}

/**
 * Verifikasi token. Mengembalikan { valid: boolean, payload: object|null, error: string|null }.
 * Tidak throw — pemanggil (Auth.js) yang memutuskan mengubahnya jadi AppError.
 */
function verifyToken(token, secret, hmacSignFn, nowMs) {
  if (typeof token !== 'string' || token.indexOf('.') === -1) {
    return { valid: false, payload: null, error: 'MALFORMED_TOKEN' };
  }
  var parts = token.split('.');
  if (parts.length !== 2) return { valid: false, payload: null, error: 'MALFORMED_TOKEN' };
  var payloadB64 = parts[0];
  var sigB64 = parts[1];

  var expectedSigBytes = normalizeSignedBytes(hmacSignFn(payloadB64, secret));
  var expectedSigB64 = base64UrlEncodeBytes(expectedSigBytes);
  if (!timingSafeEqualStr(sigB64, expectedSigB64)) {
    return { valid: false, payload: null, error: 'INVALID_SIGNATURE' };
  }

  var payload;
  try {
    payload = decodeB64UrlToJson(payloadB64);
  } catch (e) {
    return { valid: false, payload: null, error: 'MALFORMED_PAYLOAD' };
  }

  if (isTokenPayloadExpired(payload, nowMs)) {
    return { valid: false, payload: payload, error: 'EXPIRED' };
  }

  return { valid: true, payload: payload, error: null };
}

if (typeof module !== 'undefined') {
  module.exports = {
    utf8Bytes: utf8Bytes,
    bytesToUtf8String: bytesToUtf8String,
    base64UrlEncodeBytes: base64UrlEncodeBytes,
    base64UrlDecodeToBytes: base64UrlDecodeToBytes,
    encodeJsonToB64Url: encodeJsonToB64Url,
    decodeB64UrlToJson: decodeB64UrlToJson,
    normalizeSignedBytes: normalizeSignedBytes,
    bytesToHex: bytesToHex,
    timingSafeEqualStr: timingSafeEqualStr,
    buildTokenPayload: buildTokenPayload,
    isTokenPayloadExpired: isTokenPayloadExpired,
    signToken: signToken,
    verifyToken: verifyToken
  };
}
