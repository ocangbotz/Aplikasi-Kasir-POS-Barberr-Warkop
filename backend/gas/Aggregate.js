/**
 * Aggregate.js — logika agregasi Dashboard, murni (menerima array transaksi/
 * pengeluaran yang SUDAH difetch, tidak menyentuh SpreadsheetApp) supaya
 * diuji lewat Node. Dashboard.js (GAS-only) yang mem-fetch data mentah dari
 * sheet lalu memanggil fungsi-fungsi di sini.
 */

function sumBy_(list, keyFn) {
  return list.reduce(function (sum, item) { return sum + (Number(keyFn(item)) || 0); }, 0);
}

/** Statistik inti satu rentang waktu: pendapatan, transaksi, cash/qris, pengeluaran, laba bersih. */
function computeRevenueStats(transaksiList, pengeluaranList) {
  var totalPendapatan = sumBy_(transaksiList, function (t) { return t.GrandTotal; });
  var totalTransaksi = transaksiList.length;
  var totalCash = sumBy_(transaksiList, function (t) { return t.CashAmount; });
  var totalQris = sumBy_(transaksiList, function (t) { return t.QrisAmount; });
  var totalPengeluaran = sumBy_(pengeluaranList, function (p) { return p.Nominal; });
  var labaBersih = totalPendapatan - totalPengeluaran;
  return {
    totalPendapatan: totalPendapatan,
    totalTransaksi: totalTransaksi,
    totalCash: totalCash,
    totalQris: totalQris,
    totalPengeluaran: totalPengeluaran,
    labaBersih: labaBersih
  };
}

/** dateKeys: array string 'YYYY-MM-DD' (urutan ditentukan caller). Transaksi dikelompokkan by field Tanggal. */
function groupRevenueByDay(transaksiList, dateKeys) {
  var byDate = {};
  transaksiList.forEach(function (t) {
    byDate[t.Tanggal] = (byDate[t.Tanggal] || 0) + (Number(t.GrandTotal) || 0);
  });
  return dateKeys.map(function (d) { return { periode: d, total: byDate[d] || 0 }; });
}

/** monthKeys: array string 'YYYY-MM'. */
function groupRevenueByMonth(transaksiList, monthKeys) {
  var byMonth = {};
  transaksiList.forEach(function (t) {
    var ym = String(t.Tanggal).slice(0, 7);
    byMonth[ym] = (byMonth[ym] || 0) + (Number(t.GrandTotal) || 0);
  });
  return monthKeys.map(function (m) { return { periode: m, total: byMonth[m] || 0 }; });
}

/** yearKeys: array string 'YYYY'. */
function groupRevenueByYear(transaksiList, yearKeys) {
  var byYear = {};
  transaksiList.forEach(function (t) {
    var y = String(t.Tanggal).slice(0, 4);
    byYear[y] = (byYear[y] || 0) + (Number(t.GrandTotal) || 0);
  });
  return yearKeys.map(function (y) { return { periode: y, total: byYear[y] || 0 }; });
}

/** Jumlah transaksi per hari (dipakai untuk chart "Jumlah Kepala" Barber / "Produk Terjual" Warkop versi transaksi-count). */
function groupCountByDay(transaksiList, dateKeys) {
  var byDate = {};
  transaksiList.forEach(function (t) {
    byDate[t.Tanggal] = (byDate[t.Tanggal] || 0) + 1;
  });
  return dateKeys.map(function (d) { return { periode: d, total: byDate[d] || 0 }; });
}

/** Jumlah unit item terjual per hari (dari Items[].qty) — dipakai chart "Produk Terjual" Warkop. */
function groupQtyByDay(transaksiList, dateKeys) {
  var byDate = {};
  transaksiList.forEach(function (t) {
    var qty = (t.Items || []).reduce(function (s, it) { return s + (Number(it.qty) || 0); }, 0);
    byDate[t.Tanggal] = (byDate[t.Tanggal] || 0) + qty;
  });
  return dateKeys.map(function (d) { return { periode: d, total: byDate[d] || 0 }; });
}

/** Breakdown total nilai per metode pembayaran (Cash/QRIS) dari CashAmount/QrisAmount masing2 transaksi. */
function computePaymentMethodBreakdown(transaksiList) {
  return {
    cash: sumBy_(transaksiList, function (t) { return t.CashAmount; }),
    qris: sumBy_(transaksiList, function (t) { return t.QrisAmount; })
  };
}

/**
 * Ranking item terlaris berdasar total qty terjual dari Items[] tiap transaksi.
 * idField/nameField = nama properti di dalam objek item (mis. 'layananId'/'nama' atau 'produkId'/'nama').
 * Kembalikan array terurut (terbanyak dulu), dibatasi `limit` (default 5).
 */
function computeItemRanking(transaksiList, idField, nameField, limit) {
  var byId = {};
  transaksiList.forEach(function (t) {
    (t.Items || []).forEach(function (item) {
      var key = item[idField];
      if (!key) return;
      if (!byId[key]) byId[key] = { id: key, nama: item[nameField], totalQty: 0, totalPendapatan: 0 };
      byId[key].totalQty += Number(item.qty) || 0;
      byId[key].totalPendapatan += (Number(item.harga) || 0) * (Number(item.qty) || 0);
    });
  });
  var ranked = Object.keys(byId).map(function (k) { return byId[k]; });
  ranked.sort(function (a, b) { return b.totalQty - a.totalQty; });
  return ranked.slice(0, limit || 5);
}

/**
 * Ranking kategori terlaris (Warkop) — butuh peta produkId -> kategori
 * (kategoriById) karena kategori tidak disimpan langsung di item transaksi.
 */
function computeKategoriRanking(transaksiList, kategoriById, limit) {
  var byKategori = {};
  transaksiList.forEach(function (t) {
    (t.Items || []).forEach(function (item) {
      var kategori = kategoriById[item.produkId] || 'Lainnya';
      if (!byKategori[kategori]) byKategori[kategori] = { kategori: kategori, totalQty: 0, totalPendapatan: 0 };
      byKategori[kategori].totalQty += Number(item.qty) || 0;
      byKategori[kategori].totalPendapatan += (Number(item.harga) || 0) * (Number(item.qty) || 0);
    });
  });
  var ranked = Object.keys(byKategori).map(function (k) { return byKategori[k]; });
  ranked.sort(function (a, b) { return b.totalQty - a.totalQty; });
  return ranked.slice(0, limit || 5);
}

/** Ranking capster terlaris (Barber) — berdasar jumlah kepala (transaksi) yang ditangani. */
function computeCapsterRanking(transaksiBarberList, limit) {
  var byCapster = {};
  transaksiBarberList.forEach(function (t) {
    var key = t.CapsterID;
    if (!key) return;
    if (!byCapster[key]) byCapster[key] = { capsterId: key, nama: t.NamaCapster, totalKepala: 0, totalPendapatan: 0 };
    byCapster[key].totalKepala += 1;
    byCapster[key].totalPendapatan += Number(t.GrandTotal) || 0;
  });
  var ranked = Object.keys(byCapster).map(function (k) { return byCapster[k]; });
  ranked.sort(function (a, b) { return b.totalKepala - a.totalKepala; });
  return ranked.slice(0, limit || 5);
}

/** Barisan tanggal 'YYYY-MM-DD' dari `start` sampai `end` inklusif (urut naik). */
function buildDateKeyRange(start, end) {
  var keys = [];
  var cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  var last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatDateYMD_(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function formatDateYMD_(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/** 12 kunci bulan 'YYYY-01'..'YYYY-12' untuk tahun tertentu. */
function buildMonthKeyRange(year) {
  var keys = [];
  for (var m = 1; m <= 12; m++) keys.push(year + '-' + String(m).padStart(2, '0'));
  return keys;
}

/** N kunci tahun berturut-turut berakhir di `endYear` (inklusif). */
function buildYearKeyRange(endYear, count) {
  var keys = [];
  for (var i = count - 1; i >= 0; i--) keys.push(String(endYear - i));
  return keys;
}

if (typeof module !== 'undefined') {
  module.exports = {
    computeRevenueStats: computeRevenueStats,
    groupRevenueByDay: groupRevenueByDay,
    groupRevenueByMonth: groupRevenueByMonth,
    groupRevenueByYear: groupRevenueByYear,
    groupCountByDay: groupCountByDay,
    groupQtyByDay: groupQtyByDay,
    computePaymentMethodBreakdown: computePaymentMethodBreakdown,
    computeItemRanking: computeItemRanking,
    computeKategoriRanking: computeKategoriRanking,
    computeCapsterRanking: computeCapsterRanking,
    buildDateKeyRange: buildDateKeyRange,
    buildMonthKeyRange: buildMonthKeyRange,
    buildYearKeyRange: buildYearKeyRange
  };
}
