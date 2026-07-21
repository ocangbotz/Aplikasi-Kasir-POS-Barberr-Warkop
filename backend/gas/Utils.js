/**
 * Utils.js — kumpulan fungsi murni (tanpa dependency SpreadsheetApp/CacheService)
 * yang dipakai di banyak modul backend. Karena murni, seluruhnya diuji langsung
 * lewat Node (lihat tests/backend/utils.test.js) memakai file ini apa adanya.
 */

/**
 * Generate ID unik. dateFn/randomFn bisa di-override saat testing supaya deterministik.
 */
function generateId(prefix, dateFn, randomFn) {
  var d = (dateFn || function () { return new Date(); })();
  var r = (randomFn || Math.random)();
  var randomPart = Math.floor(r * 1679616).toString(36); // basis36, max 4 char (36^4)
  while (randomPart.length < 4) randomPart = '0' + randomPart;
  return (prefix ? prefix + '-' : '') + d.getTime().toString(36).toUpperCase() + randomPart.toUpperCase();
}

/** Format Date -> 'YYYY-MM-DD' memakai komponen lokal (bukan UTC) agar konsisten dgn timezone toko. */
function formatDateYMD(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/** Format Date -> 'HH:mm' lokal. */
function formatTimeHM(date) {
  var h = String(date.getHours()).padStart(2, '0');
  var m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

var JENIS_USAHA_KODE = { Barber: 'BRB', Warkop: 'WRK' };

/**
 * Nomor transaksi auto-generate: TRX-{KODE}-{YYYYMMDD}-{urutan 4 digit}.
 * `sequenceForDay` = jumlah transaksi jenis usaha ybs pada tanggal tsb (sebelum transaksi ini), dari caller.
 */
function generateTransactionNumber(jenisUsaha, date, sequenceForDay) {
  var kode = JENIS_USAHA_KODE[jenisUsaha] || 'TRX';
  var ymd = formatDateYMD(date).replace(/-/g, '');
  var seq = String(sequenceForDay + 1).padStart(4, '0');
  return 'TRX-' + kode + '-' + ymd + '-' + seq;
}

/**
 * Sanitasi string input user: buang tag HTML/script, trim, batasi panjang.
 * Mencegah XSS tersimpan (stored XSS) karena data ini nantinya dirender ke DOM di frontend.
 */
function sanitizeString(input, maxLength) {
  if (input === null || input === undefined) return '';
  var str = String(input);
  str = str.replace(/<[^>]*>/g, ''); // strip tag HTML
  str = str.replace(/[<>]/g, ''); // sisa kurung yang tidak membentuk tag lengkap
  str = str.trim();
  var max = maxLength || 500;
  if (str.length > max) str = str.substring(0, max);
  return str;
}

/** Parse angka dari input user secara aman, fallback ke default jika invalid/negatif tidak diizinkan. */
function toSafeNumber(input, defaultValue, options) {
  var opts = options || {};
  var n = typeof input === 'number' ? input : parseFloat(input);
  if (isNaN(n) || !isFinite(n)) return defaultValue;
  if (opts.min !== undefined && n < opts.min) return opts.clamp ? opts.min : defaultValue;
  if (opts.max !== undefined && n > opts.max) return opts.clamp ? opts.max : defaultValue;
  return n;
}

/** Bulatkan ke rupiah (integer, tanpa desimal). */
function roundCurrency(n) {
  return Math.round(n);
}

/** Format angka -> "Rp 12.000" (dipakai untuk teks struk / notifikasi yang digenerate backend). */
function formatRupiah(n) {
  var rounded = roundCurrency(n || 0);
  var sign = rounded < 0 ? '-' : '';
  var abs = Math.abs(rounded).toString();
  var withDots = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + 'Rp ' + withDots;
}

var FILTER_TYPES = ['today', 'yesterday', 'week', 'month', 'year', 'custom'];

/**
 * Resolusi filter tanggal dashboard/laporan menjadi rentang [start, end] (inklusif, jam 00:00:00 s/d 23:59:59.999).
 * refDate = "sekarang" yang bisa di-inject saat testing agar deterministik.
 * Minggu dimulai Senin (konvensi Indonesia).
 */
function resolveDateRangeFilter(filterType, customStart, customEnd, refDate) {
  var now = refDate || new Date();
  var startOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0); };
  var endOfDay = function (d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); };

  switch (filterType) {
    case 'today': {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    case 'yesterday': {
      var y = new Date(now); y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case 'week': {
      var day = now.getDay(); // 0=Minggu..6=Sabtu
      var diffToMonday = day === 0 ? 6 : day - 1;
      var monday = new Date(now); monday.setDate(monday.getDate() - diffToMonday);
      return { start: startOfDay(monday), end: endOfDay(now) };
    }
    case 'month': {
      var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(firstOfMonth), end: endOfDay(now) };
    }
    case 'year': {
      var firstOfYear = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(firstOfYear), end: endOfDay(now) };
    }
    case 'custom': {
      if (!customStart || !customEnd) {
        throw new Error('customStart dan customEnd wajib diisi untuk filter custom');
      }
      return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
    }
    default:
      throw new Error('Tipe filter tidak dikenal: ' + filterType);
  }
}

/** Cek apakah sebuah Date berada dalam rentang [start, end] inklusif. */
function isWithinRange(date, start, end) {
  var t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

if (typeof module !== 'undefined') {
  module.exports = {
    generateId: generateId,
    formatDateYMD: formatDateYMD,
    formatTimeHM: formatTimeHM,
    generateTransactionNumber: generateTransactionNumber,
    sanitizeString: sanitizeString,
    toSafeNumber: toSafeNumber,
    roundCurrency: roundCurrency,
    formatRupiah: formatRupiah,
    resolveDateRangeFilter: resolveDateRangeFilter,
    isWithinRange: isWithinRange,
    FILTER_TYPES: FILTER_TYPES
  };
}
