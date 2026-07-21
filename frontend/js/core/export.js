/**
 * core/export.js — export tabel ke CSV & Excel + trigger download di browser.
 * Excel dibentuk sebagai HTML table bermimetype .xls (teknik standar yang
 * benar-benar dibuka Excel/Google Sheets/LibreOffice sebagai spreadsheet
 * asli) supaya tidak perlu vendor library biner xlsx yang berat hanya untuk
 * export sederhana. `toCsv`/`toExcelHtml` murni & diuji lewat Node;
 * `downloadBlob` menyentuh DOM sehingga hanya bisa diverifikasi di browser
 * (lihat verifikasi Playwright Fase 8).
 */

function csvEscapeField_(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** headers: array string. rows: array of array (nilai sudah dlm urutan headers). */
export function toCsv(headers, rows) {
  const lines = [headers.map(csvEscapeField_).join(',')];
  rows.forEach((row) => lines.push(row.map(csvEscapeField_).join(',')));
  return lines.join('\r\n');
}

function htmlEscapeCell_(value) {
  const str = value === null || value === undefined ? '' : String(value);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toExcelHtml(title, headers, rows) {
  const headHtml = headers.map((h) => `<th>${htmlEscapeCell_(h)}</th>`).join('');
  const bodyHtml = rows.map((row) => `<tr>${row.map((cell) => `<td>${htmlEscapeCell_(cell)}</td>`).join('')}</tr>`).join('');
  return (
    `<html><head><meta charset="UTF-8"><title>${htmlEscapeCell_(title)}</title></head>` +
    `<body><table border="1"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`
  );
}

function downloadBlob(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** BOM di depan supaya Excel membuka CSV UTF-8 (mis. karakter "Rp") dengan benar, bukan sebagai teks acak. */
export function exportCsv(filename, headers, rows) {
  downloadBlob(filename, '\uFEFF' + toCsv(headers, rows), 'text/csv;charset=utf-8;');
}

export function exportExcel(filename, title, headers, rows) {
  downloadBlob(filename, toExcelHtml(title, headers, rows), 'application/vnd.ms-excel;charset=utf-8;');
}
