const test = require('node:test');
const assert = require('node:assert/strict');

test('export.js: toCsv menggabungkan header & baris dengan koma, escape field yang mengandung koma/kutip/baris baru', async () => {
  const { toCsv } = await import('../../frontend/js/core/export.js');

  const csv = toCsv(
    ['No. Transaksi', 'Pelanggan', 'Total'],
    [
      ['TRB-001', 'Budi', 'Rp 50.000'],
      ['TRB-002', 'Andi, S.Kom', 'Rp 20.000'],
      ['TRB-003', 'Catatan "penting"', 'Rp 10.000']
    ]
  );

  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'No. Transaksi,Pelanggan,Total');
  assert.equal(lines[1], 'TRB-001,Budi,Rp 50.000');
  assert.equal(lines[2], 'TRB-002,"Andi, S.Kom",Rp 20.000');
  assert.equal(lines[3], 'TRB-003,"Catatan ""penting""",Rp 10.000');
});

test('export.js: toCsv menangani nilai null/undefined sebagai field kosong', async () => {
  const { toCsv } = await import('../../frontend/js/core/export.js');
  const csv = toCsv(['A', 'B'], [[null, undefined]]);
  assert.equal(csv, 'A,B\r\n,');
});

test('export.js: toExcelHtml menghasilkan tabel HTML valid dengan header & baris, meng-escape karakter HTML', async () => {
  const { toExcelHtml } = await import('../../frontend/js/core/export.js');
  const html = toExcelHtml('Laporan Juli', ['Nama'], [['Kopi <Susu>']]);

  assert.match(html, /<title>Laporan Juli<\/title>/);
  assert.match(html, /<th>Nama<\/th>/);
  assert.match(html, /<td>Kopi &lt;Susu&gt;<\/td>/);
  assert.doesNotMatch(html, /<td>Kopi <Susu><\/td>/);
});
