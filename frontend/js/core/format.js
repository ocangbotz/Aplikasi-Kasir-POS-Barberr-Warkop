/**
 * format.js — helper format murni (Rupiah, tanggal Indonesia) dipakai di
 * seluruh halaman. Tidak menyentuh DOM sehingga diuji lewat Node.
 */

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatRupiah(n) {
  const rounded = Math.round(Number(n) || 0);
  const sign = rounded < 0 ? '-' : '';
  const withDots = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp ${withDots}`;
}

function toDate(input) {
  return input instanceof Date ? input : new Date(input);
}

export function formatDateID(input) {
  const d = toDate(input);
  return `${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTimeID(input) {
  const d = toDate(input);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTimeID(input) {
  return `${formatDateID(input)}, ${formatTimeID(input)}`;
}
