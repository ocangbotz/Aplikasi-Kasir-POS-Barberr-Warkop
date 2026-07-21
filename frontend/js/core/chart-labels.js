/**
 * chart-labels.js — format label sumbu chart dari kunci periode backend
 * ('YYYY-MM-DD' / 'YYYY-MM' / 'YYYY') menjadi label ringkas Indonesia.
 * Murni (tidak menyentuh DOM/Chart.js) sehingga diuji lewat Node.
 */

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatDayLabel(ymd) {
  const parts = String(ymd).split('-');
  if (parts.length !== 3) return ymd;
  const day = parseInt(parts[2], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return `${day} ${BULAN_PENDEK[monthIdx] || ''}`;
}

export function formatMonthLabel(ym) {
  const parts = String(ym).split('-');
  if (parts.length !== 2) return ym;
  const monthIdx = parseInt(parts[1], 10) - 1;
  return BULAN_PENDEK[monthIdx] || ym;
}

export function formatYearLabel(y) {
  return String(y);
}
