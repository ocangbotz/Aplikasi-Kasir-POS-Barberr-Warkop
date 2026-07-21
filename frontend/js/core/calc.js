/**
 * calc.js — kalkulasi transaksi murni di sisi client (preview instan di form
 * sebelum submit). Cermin dari backend/gas/Calc.js — backend TETAP jadi
 * otoritas final (validasi ulang saat submit), ini hanya untuk UX cepat.
 */

export function computeItemsSubtotal(items) {
  return Math.round(items.reduce((sum, it) => sum + (Number(it.harga) || 0) * (Number(it.qty) || 0), 0));
}

export function applyDiskon(subtotal, diskon, diskonType) {
  const d = Math.max(0, Number(diskon) || 0);
  const diskonAmount = diskonType === 'percent' ? Math.round((subtotal * Math.min(d, 100)) / 100) : Math.round(Math.min(d, subtotal));
  const grandTotal = Math.max(0, Math.round(subtotal - diskonAmount));
  return { diskonAmount, grandTotal };
}

export function computeKembalian(grandTotal, cashAmount) {
  return Math.max(0, Math.round((Number(cashAmount) || 0) - grandTotal));
}
