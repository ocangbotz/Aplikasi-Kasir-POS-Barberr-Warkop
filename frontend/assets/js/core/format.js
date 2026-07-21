/**
 * format.js
 * Helper format angka/tanggal dipakai di seluruh modul (Barber, Warkop, dashboard, laporan).
 */

export function formatRupiah(value) {
  const n = Math.round(Number(value) || 0);
  return 'Rp' + n.toLocaleString('id-ID');
}

export function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function todayISODate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowHHMM() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
