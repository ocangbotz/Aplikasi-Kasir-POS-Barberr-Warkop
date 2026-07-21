/**
 * Pelanggan.gs
 * Data pelanggan dipakai bersama oleh modul Barber & Warkop. Setiap transaksi
 * yang menyertakan nomor HP akan otomatis membuat/mengupdate baris pelanggan
 * (kunjungan, total belanja, poin loyalti) -- lihat findOrCreatePelanggan_.
 */

/** Cari pelanggan berdasarkan No HP persis. @return object baris atau null. */
function findPelangganByPhone_(noHp) {
  var phone = normalizePhone_(noHp);
  if (!phone) return null;
  var data = getSheetData_(SHEETS.PELANGGAN);
  var found = data.rows.filter(function (r) { return normalizePhone_(r.NoHP) === phone; })[0];
  return found || null;
}

function normalizePhone_(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

/**
 * Dipanggil dari alur transaksi (Barber/Warkop). Membuat pelanggan baru jika
 * nomor HP belum ada, atau mengembalikan yang sudah ada tanpa mengubah data.
 * Statistik (kunjungan/total belanja/poin) diupdate terpisah lewat
 * recordPelangganPurchase_ SETELAH transaksi berhasil disimpan.
 */
function findOrCreatePelanggan_(nama, noHp) {
  var existing = findPelangganByPhone_(noHp);
  if (existing) return existing;
  if (!noHp) return null; // transaksi tanpa nomor HP -> tidak dibuatkan profil pelanggan

  return appendRowObject_(SHEETS.PELANGGAN, {
    ID: generateId_('PLG'),
    Nama: sanitizeString_(nama) || 'Pelanggan',
    NoHP: sanitizeString_(noHp),
    TotalKunjungan: 0,
    TotalPengeluaran: 0,
    Member: false,
    PoinLoyalti: 0,
    CreatedAt: new Date(),
    UpdatedAt: new Date()
  });
}

/** Update statistik pelanggan setelah transaksi berhasil (dipanggil oleh Barber.gs/Warkop.gs). */
function recordPelangganPurchase_(pelanggan, grandTotal) {
  if (!pelanggan) return;
  var current = findRowById_(SHEETS.PELANGGAN, pelanggan.ID);
  if (!current) return;
  current.TotalKunjungan = Number(current.TotalKunjungan || 0) + 1;
  current.TotalPengeluaran = round2_(Number(current.TotalPengeluaran || 0) + Number(grandTotal || 0));
  current.PoinLoyalti = Number(current.PoinLoyalti || 0) + Math.floor(Number(grandTotal || 0) / APP_CONFIG.LOYALTY_RUPIAH_PER_POINT);
  current.UpdatedAt = new Date();
  updateRowObject_(SHEETS.PELANGGAN, current._rowIndex, current);
  return current;
}

/** Pencarian pelanggan berdasarkan nama ATAU nomor HP (dipakai untuk autocomplete di form transaksi). */
function searchPelanggan_(payload) {
  requireAuth_(payload.token);
  var query = sanitizeString_(payload.query).toLowerCase();
  if (!query) return { pelanggan: [] };

  var data = getSheetData_(SHEETS.PELANGGAN);
  var matches = data.rows.filter(function (r) {
    return String(r.Nama).toLowerCase().indexOf(query) !== -1 ||
      normalizePhone_(r.NoHP).indexOf(normalizePhone_(query)) !== -1;
  });
  return { pelanggan: matches.slice(0, 10) };
}

/** Daftar pelanggan (halaman Data Pelanggan), dengan pencarian & pagination. */
function pelangganList_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'pelanggan');

  var data = getSheetData_(SHEETS.PELANGGAN);
  var query = sanitizeString_(payload.query || '').toLowerCase();
  var rows = data.rows.filter(function (r) {
    if (!query) return true;
    return String(r.Nama).toLowerCase().indexOf(query) !== -1 || normalizePhone_(r.NoHP).indexOf(normalizePhone_(query)) !== -1;
  });
  rows.sort(function (a, b) { return new Date(b.UpdatedAt) - new Date(a.UpdatedAt); });

  var page = Math.max(Number(payload.page) || 1, 1);
  var pageSize = Math.min(Math.max(Number(payload.pageSize) || 20, 1), 100);
  var start = (page - 1) * pageSize;
  return { pelanggan: rows.slice(start, start + pageSize), total: rows.length, page: page, pageSize: pageSize };
}

/** Detail satu pelanggan + riwayat transaksi Barber & Warkop mereka (Riwayat Haircut & pembelian). */
function pelangganDetail_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'pelanggan');
  requireFields_(payload, ['id']);

  var pelanggan = findRowById_(SHEETS.PELANGGAN, payload.id);
  if (!pelanggan) throw new AppError_('NOT_FOUND', 'Pelanggan tidak ditemukan.');

  var riwayatBarber = getSheetData_(SHEETS.TRANSAKSI_BARBER).rows
    .filter(function (r) { return r.PelangganID === pelanggan.ID && r.IsDeleted !== true && r.IsDeleted !== 'TRUE'; })
    .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); })
    .slice(0, 20)
    .map(function (r) {
      var layanan = [];
      try { layanan = JSON.parse(r.Layanan); } catch (e) { layanan = []; }
      return { nomorTransaksi: r.NomorTransaksi, tanggal: r.Tanggal, layanan: layanan, grandTotal: r.GrandTotal, namaCapster: r.NamaCapster };
    });

  var riwayatWarkop = getSheetData_(SHEETS.TRANSAKSI_WARKOP).rows
    .filter(function (r) { return r.PelangganID === pelanggan.ID && r.IsDeleted !== true && r.IsDeleted !== 'TRUE'; })
    .sort(function (a, b) { return new Date(b.CreatedAt) - new Date(a.CreatedAt); })
    .slice(0, 20)
    .map(function (r) {
      var items = [];
      try { items = JSON.parse(r.Items); } catch (e) { items = []; }
      return { nomorTransaksi: r.NomorTransaksi, tanggal: r.Tanggal, items: items, grandTotal: r.GrandTotal };
    });

  return { pelanggan: pelanggan, riwayatBarber: riwayatBarber, riwayatWarkop: riwayatWarkop };
}

function pelangganSetMember_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'pelanggan');
  requireFields_(payload, ['id']);

  var pelanggan = findRowById_(SHEETS.PELANGGAN, payload.id);
  if (!pelanggan) throw new AppError_('NOT_FOUND', 'Pelanggan tidak ditemukan.');

  pelanggan.Member = !!payload.member;
  pelanggan.UpdatedAt = new Date();
  updateRowObject_(SHEETS.PELANGGAN, pelanggan._rowIndex, pelanggan);
  writeAuditLog_(session, 'SET_MEMBER_PELANGGAN', SHEETS.PELANGGAN, '', pelanggan);
  return { pelanggan: pelanggan };
}
