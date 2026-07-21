/**
 * GajiCapster.gs
 * Perhitungan gaji capster per periode (bulan): Total Kepala & Pendapatan
 * dihitung OTOMATIS dari Transaksi Barber (bukan diketik manual), lalu
 * dikombinasikan dengan Bonus/Potongan/Keterlambatan yang diinput manual
 * untuk mendapatkan Total Gaji.
 */

/** Transaksi Selesai milik satu capster dalam satu periode (yyyy-MM). */
function transaksiCapsterPeriode_(capsterId, periode) {
  return getSheetData_(SHEETS.TRANSAKSI_BARBER).rows.filter(function (r) {
    return r.CapsterID === capsterId &&
      r.Status === STATUS_TRANSAKSI.SELESAI &&
      r.IsDeleted !== true && r.IsDeleted !== 'TRUE' &&
      String(r.Tanggal).indexOf(periode) === 0;
  });
}

function hitungKinerjaCapster_(capsterId, periode) {
  var rows = transaksiCapsterPeriode_(capsterId, periode);
  var pendapatan = round2_(rows.reduce(function (s, r) { return s + Number(r.GrandTotal); }, 0));
  return { totalKepala: rows.length, pendapatan: pendapatan };
}

/** Pratinjau tanpa menyimpan -- dipakai UI sebelum kasir/owner mengisi bonus/potongan. */
function gajiCapsterPreview_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'gajiCapster');
  requireFields_(payload, ['capsterId', 'periode']);

  var capster = findRowById_(SHEETS.CAPSTER, payload.capsterId);
  if (!capster) throw new AppError_('NOT_FOUND', 'Capster tidak ditemukan.');

  var kinerja = hitungKinerjaCapster_(payload.capsterId, payload.periode);
  var persentase = Number(capster.PersentaseBagiHasil);
  var bagiHasilAmount = round2_(kinerja.pendapatan * persentase / 100);

  return {
    capsterId: capster.ID, nama: capster.Nama, persentaseBagiHasil: persentase,
    totalKepala: kinerja.totalKepala, pendapatan: kinerja.pendapatan, bagiHasilAmount: bagiHasilAmount
  };
}

function gajiCapsterSave_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'gajiCapster');
  requireFields_(payload, ['capsterId', 'periode']);

  var capster = findRowById_(SHEETS.CAPSTER, payload.capsterId);
  if (!capster) throw new AppError_('NOT_FOUND', 'Capster tidak ditemukan.');

  var kinerja = hitungKinerjaCapster_(payload.capsterId, payload.periode);
  var persentase = Number(capster.PersentaseBagiHasil);
  var bagiHasilAmount = round2_(kinerja.pendapatan * persentase / 100);
  var bonus = Math.max(Number(payload.bonus) || 0, 0);
  var potongan = Math.max(Number(payload.potongan) || 0, 0);
  var keterlambatan = Math.max(Number(payload.keterlambatan) || 0, 0);
  var totalGaji = round2_(bagiHasilAmount + bonus - potongan - keterlambatan);

  var record = {
    Periode: payload.periode,
    CapsterID: capster.ID,
    NamaCapster: capster.Nama,
    PersentaseBagiHasil: persentase,
    TotalKepala: kinerja.totalKepala,
    Pendapatan: kinerja.pendapatan,
    BagiHasilAmount: bagiHasilAmount,
    Bonus: bonus,
    Potongan: potongan,
    Keterlambatan: keterlambatan,
    TotalGaji: totalGaji,
    Catatan: sanitizeString_(payload.catatan),
    DibuatOlehID: session.userId,
    DibuatOleh: session.nama,
    UpdatedAt: new Date()
  };

  // Satu capster hanya punya 1 baris per periode -- upsert.
  var existing = getSheetData_(SHEETS.GAJI_CAPSTER).rows.filter(function (r) {
    return r.CapsterID === capster.ID && r.Periode === payload.periode;
  })[0];

  if (existing) {
    Object.assign(existing, record);
    updateRowObject_(SHEETS.GAJI_CAPSTER, existing._rowIndex, existing);
    writeAuditLog_(session, 'UPDATE_GAJI_CAPSTER', SHEETS.GAJI_CAPSTER, '', existing);
    return { gaji: existing };
  }

  record.ID = generateId_('GJ');
  record.CreatedAt = new Date();
  appendRowObject_(SHEETS.GAJI_CAPSTER, record);
  writeAuditLog_(session, 'CREATE_GAJI_CAPSTER', SHEETS.GAJI_CAPSTER, '', record);
  return { gaji: record };
}

function gajiCapsterList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'gajiCapster');
  var data = getSheetData_(SHEETS.GAJI_CAPSTER);
  var rows = data.rows.filter(function (r) { return !payload.periode || r.Periode === payload.periode; });
  rows.sort(function (a, b) { return String(b.Periode).localeCompare(String(a.Periode)); });
  return { gaji: rows };
}
