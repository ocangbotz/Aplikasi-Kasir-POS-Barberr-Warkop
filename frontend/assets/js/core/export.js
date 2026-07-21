/**
 * core/export.js
 * Ekspor data tabel (Laporan) ke CSV, Excel, PDF, dan Cetak (print) -- tanpa
 * dependency yang punya kerentanan keamanan diketahui.
 *
 * Catatan keamanan: library "xlsx" (SheetJS) sengaja TIDAK dipakai karena
 * `npm audit` menandai kerentanan Prototype Pollution & ReDoS berseverity
 * tinggi tanpa fix tersedia (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9).
 * Sebagai gantinya export Excel memakai teknik tabel HTML dengan MIME type
 * "application/vnd.ms-excel" (dikenali Microsoft Excel & Google Sheets),
 * tanpa dependency eksternal sama sekali.
 *
 * PDF memakai jsPDF + plugin autoTable yang di-vendor lokal (lihat index.html)
 * -- terpasang sebagai window.jspdf.jsPDF dengan method .autoTable() otomatis
 * ter-attach saat plugin dimuat.
 */

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** @param {string} filename @param {string[]} headers @param {Array<Array<string|number>>} rows */
export function exportCSV(filename, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => row.map(csvEscape).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename);
}

function htmlEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** @param {string} filename @param {string} title @param {string[]} headers @param {Array<Array<string|number>>} rows */
export function exportExcel(filename, title, headers, rows) {
  const headHtml = headers.map((h) => `<th style="background:#e2e8f0;font-weight:bold;border:1px solid #cbd5e1;padding:4px 8px;">${htmlEscape(h)}</th>`).join('');
  const bodyHtml = rows.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #cbd5e1;padding:4px 8px;">${htmlEscape(cell)}</td>`).join('')}</tr>`).join('');
  const html = `<!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>Laporan</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
    <body>
      <table><caption style="text-align:left;font-weight:bold;font-size:14px;">${htmlEscape(title)}</caption>
        <thead><tr>${headHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  triggerDownload(blob, filename);
}

/** @param {string} filename @param {string} title @param {string[]} headers @param {Array<Array<string|number>>} rows @param {string[]} [summaryLines] */
export function exportPDF(filename, title, headers, rows, summaryLines) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('Modul PDF belum siap dimuat. Coba muat ulang halaman.');
  }
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(13);
  doc.text(title, 14, 12);

  let startY = 18;
  if (summaryLines && summaryLines.length) {
    doc.setFontSize(9);
    summaryLines.forEach((line, i) => doc.text(line, 14, startY + i * 4.5));
    startY += summaryLines.length * 4.5 + 3;
  }

  doc.autoTable({
    head: [headers],
    body: rows,
    startY,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  doc.save(filename);
}

/**
 * Cetak laporan lewat dialog print browser (bukan cetak struk 80mm).
 * @param {string} title @param {string[]} headers @param {Array<Array<string|number>>} rows @param {string[]} [summaryLines]
 */
export function printReport(title, headers, rows, summaryLines) {
  const existing = document.getElementById('laporan-print-area');
  if (existing) existing.remove();

  const area = document.createElement('div');
  area.id = 'laporan-print-area';
  area.className = 'hidden';
  area.innerHTML = `
    <h1 style="font-size:16px;font-weight:bold;margin-bottom:4px;">${htmlEscape(title)}</h1>
    ${summaryLines && summaryLines.length ? `<p style="font-size:11px;margin-bottom:8px;">${summaryLines.map(htmlEscape).join(' &bull; ')}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:10px;">
      <thead><tr>${headers.map((h) => `<th style="border:1px solid #999;padding:3px 6px;text-align:left;background:#eee;">${htmlEscape(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #999;padding:3px 6px;">${htmlEscape(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  document.body.appendChild(area);

  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
