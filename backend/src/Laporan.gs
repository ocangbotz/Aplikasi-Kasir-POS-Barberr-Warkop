/**
 * Laporan.gs
 * Laporan detail (tabel transaksi siap ekspor) + ringkasan periode, dengan
 * filter yang sama (Harian/Mingguan/Bulanan/Tahunan/Custom) seperti Dashboard
 * -- menggunakan ulang resolveDateRange_/metrics dari Dashboard.gs supaya
 * angka ringkasan selalu konsisten antara Dashboard dan Laporan.
 */

function flattenBarberTransaksi_(row) {
  var layanan = [];
  try { layanan = JSON.parse(row.Layanan); } catch (e) { layanan = []; }
  return {
    usaha: USAHA.BARBER,
    id: row.ID,
    nomorTransaksi: row.NomorTransaksi,
    tanggal: row.Tanggal,
    jam: row.Jam,
    deskripsi: row.NamaPelanggan + ' — ' + layanan.map(function (l) { return l.nama; }).join(', ') + ' (Capster: ' + row.NamaCapster + ')',
    namaKasir: row.NamaKasir,
    subtotal: Number(row.Subtotal),
    diskon: Number(row.Diskon),
    grandTotal: Number(row.GrandTotal),
    metodePembayaran: row.MetodePembayaran,
    status: row.Status
  };
}

function flattenWarkopTransaksi_(row) {
  var items = [];
  try { items = JSON.parse(row.Items); } catch (e) { items = []; }
  return {
    usaha: USAHA.WARKOP,
    id: row.ID,
    nomorTransaksi: row.NomorTransaksi,
    tanggal: row.Tanggal,
    jam: row.Jam,
    deskripsi: items.map(function (it) { return it.nama + ' x' + it.qty; }).join(', '),
    namaKasir: row.NamaKasir,
    subtotal: Number(row.Subtotal),
    diskon: Number(row.Diskon),
    grandTotal: Number(row.GrandTotal),
    metodePembayaran: row.MetodePembayaran,
    status: row.Status
  };
}

/** Laporan detail transaksi + ringkasan periode -- siap ditampilkan/diekspor. */
function laporanTransaksi_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'laporan');

  var range = resolveDateRange_(payload);
  var usaha = payload.usaha === USAHA.BARBER || payload.usaha === USAHA.WARKOP ? payload.usaha : 'Gabungan';

  var rows = [];
  if (usaha === USAHA.BARBER || usaha === 'Gabungan') {
    rows = rows.concat(inDateRange_(loadBarberSelesai_(), range.startDate, range.endDate).map(flattenBarberTransaksi_));
  }
  if (usaha === USAHA.WARKOP || usaha === 'Gabungan') {
    rows = rows.concat(inDateRange_(loadWarkopSelesai_(), range.startDate, range.endDate).map(flattenWarkopTransaksi_));
  }
  rows.sort(function (a, b) {
    var dateCompare = String(b.tanggal).localeCompare(String(a.tanggal));
    return dateCompare !== 0 ? dateCompare : String(b.jam).localeCompare(String(a.jam));
  });

  var ringkasan;
  if (usaha === USAHA.BARBER) {
    ringkasan = barberMetrics_(inDateRange_(loadBarberSelesai_(), range.startDate, range.endDate), range.startDate, range.endDate);
  } else if (usaha === USAHA.WARKOP) {
    ringkasan = warkopMetrics_(inDateRange_(loadWarkopSelesai_(), range.startDate, range.endDate), range.startDate, range.endDate);
  } else {
    ringkasan = gabunganMetrics_(
      inDateRange_(loadBarberSelesai_(), range.startDate, range.endDate),
      inDateRange_(loadWarkopSelesai_(), range.startDate, range.endDate),
      range.startDate, range.endDate
    );
  }

  return { usaha: usaha, periode: range, ringkasan: ringkasan, transaksi: rows };
}

/** Laporan pengeluaran gabungan Barber+Warkop (atau salah satu) untuk periode yang sama. */
function laporanPengeluaran_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'laporan');

  var range = resolveDateRange_(payload);
  var usaha = payload.usaha === USAHA.BARBER || payload.usaha === USAHA.WARKOP ? payload.usaha : 'Gabungan';

  var rows = [];
  if (usaha === USAHA.BARBER || usaha === 'Gabungan') {
    rows = rows.concat(getSheetData_(SHEETS.PENGELUARAN_BARBER).rows
      .filter(function (r) { return r.Tanggal >= range.startDate && r.Tanggal <= range.endDate; })
      .map(function (r) { return Object.assign({ usaha: USAHA.BARBER }, r); }));
  }
  if (usaha === USAHA.WARKOP || usaha === 'Gabungan') {
    rows = rows.concat(getSheetData_(SHEETS.PENGELUARAN_WARKOP).rows
      .filter(function (r) { return r.Tanggal >= range.startDate && r.Tanggal <= range.endDate; })
      .map(function (r) { return Object.assign({ usaha: USAHA.WARKOP }, r); }));
  }
  rows.sort(function (a, b) { return String(b.Tanggal).localeCompare(String(a.Tanggal)); });

  var total = round2_(rows.reduce(function (s, r) { return s + Number(r.Nominal || 0); }, 0));
  return { usaha: usaha, periode: range, total: total, pengeluaran: rows };
}
