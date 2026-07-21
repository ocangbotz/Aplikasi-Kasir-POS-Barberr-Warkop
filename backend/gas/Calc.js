/**
 * Calc.js — kalkulasi transaksi murni (subtotal, diskon, split pembayaran,
 * poin loyalti). Dipakai bersama oleh Barber.js & Warkop.js supaya rumus
 * konsisten di kedua jenis usaha. Tidak ada dependency SpreadsheetApp -> diuji
 * lewat Node.
 *
 * Referensi ke `roundCurrency`/`createAppError` sengaja lewat fungsi getter
 * lazy (`_roundCurrency()`/`_createAppError()`), BUKAN `var` alias di scope
 * modul — supaya tidak membuat deklarasi global baru yang bisa bentrok/
 * membingungkan di scope global gabungan Apps Script (lihat catatan serupa
 * di Validation.js soal urutan file yang tidak terjamin).
 */

function _roundCurrency(n) {
  if (typeof roundCurrency !== 'undefined') return roundCurrency(n);
  return require('./Utils.js').roundCurrency(n);
}

function _createAppError(code, message) {
  if (typeof createAppError !== 'undefined') return createAppError(code, message);
  return require('./Validation.js').createAppError(code, message);
}

/** items: [{harga:number, qty:number}] -> total harga x qty, dibulatkan. */
function computeItemsSubtotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total += (Number(items[i].harga) || 0) * (Number(items[i].qty) || 0);
  }
  return _roundCurrency(total);
}

/**
 * Terapkan diskon ke subtotal. diskonType: 'nominal' | 'percent'.
 * Grand total tidak pernah negatif; diskon nominal tidak pernah melebihi subtotal.
 */
function applyDiskon(subtotal, diskon, diskonType) {
  var d = Math.max(0, Number(diskon) || 0);
  var diskonAmount;
  if (diskonType === 'percent') {
    diskonAmount = _roundCurrency((subtotal * Math.min(d, 100)) / 100);
  } else {
    diskonAmount = _roundCurrency(Math.min(d, subtotal));
  }
  var grandTotal = _roundCurrency(subtotal - diskonAmount);
  return { diskonAmount: diskonAmount, grandTotal: Math.max(0, grandTotal) };
}

/** Poin loyalti didapat dari grandTotal, berapa Rupiah per 1 poin (dari Settings). */
function computeLoyaltyPoints(grandTotal, rupiahPerPoint) {
  var rate = Number(rupiahPerPoint);
  if (!isFinite(rate) || rate <= 0) return 0;
  return Math.floor(grandTotal / rate);
}

/**
 * Validasi & hitung rincian pembayaran (Cash/QRIS/Split) terhadap grandTotal.
 * - Cash: cashAmount wajib >= grandTotal, sisanya jadi kembalian.
 * - QRIS: qrisAmount wajib == grandTotal, tidak ada kembalian.
 * - Split: cashAmount + qrisAmount wajib == grandTotal, tidak ada kembalian.
 * Melempar AppError('VALIDATION_ERROR', ...) kalau tidak sesuai.
 */
function computePaymentBreakdown(grandTotal, metodeBayar, rawCash, rawQris) {
  var cash = _roundCurrency(Number(rawCash) || 0);
  var qris = _roundCurrency(Number(rawQris) || 0);

  if (metodeBayar === 'Cash') {
    if (cash < grandTotal) {
      throw _createAppError('VALIDATION_ERROR', 'Uang cash kurang dari total tagihan.');
    }
    return { cashAmount: cash, qrisAmount: 0, kembalian: _roundCurrency(cash - grandTotal) };
  }

  if (metodeBayar === 'QRIS') {
    if (qris !== grandTotal) {
      throw _createAppError('VALIDATION_ERROR', 'Nominal QRIS harus sama dengan total tagihan.');
    }
    return { cashAmount: 0, qrisAmount: qris, kembalian: 0 };
  }

  if (metodeBayar === 'Split') {
    if (cash + qris !== grandTotal) {
      throw _createAppError('VALIDATION_ERROR', 'Total Cash + QRIS harus sama dengan total tagihan saat split bill.');
    }
    return { cashAmount: cash, qrisAmount: qris, kembalian: 0 };
  }

  throw _createAppError('VALIDATION_ERROR', 'Metode pembayaran tidak dikenal: ' + metodeBayar);
}

if (typeof module !== 'undefined') {
  module.exports = {
    computeItemsSubtotal: computeItemsSubtotal,
    applyDiskon: applyDiskon,
    computeLoyaltyPoints: computeLoyaltyPoints,
    computePaymentBreakdown: computePaymentBreakdown
  };
}
