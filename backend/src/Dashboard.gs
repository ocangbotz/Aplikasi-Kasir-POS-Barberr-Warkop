/**
 * Dashboard.gs
 * Agregasi data untuk 3 dashboard (Gabungan/Barber/Warkop): kartu metrik
 * (Hari Ini, Bulan Ini, dan periode sesuai filter), grafik tren, dan
 * leaderboard (capster/layanan/menu/kategori terlaris).
 *
 * Desain filter: kartu "Hari Ini" & "Bulan Ini" SELALU tetap (patokan cepat,
 * sesuai spesifikasi), sementara filter (Hari Ini/Kemarin/Minggu Ini/Bulan
 * Ini/Tahun Ini/Custom) mengontrol kartu "Periode Terpilih" + seluruh grafik
 * & leaderboard -- supaya "semua grafik dan kartu berubah otomatis" sesuai
 * filter tetap terpenuhi tanpa membuat kartu Hari Ini/Bulan Ini kehilangan makna.
 */

function resolveDateRange_(payload) {
  var today = todayDateString_();
  switch (payload.filter) {
    case 'yesterday': {
      var y = shiftDateString_(today, -1);
      return { startDate: y, endDate: y };
    }
    case 'week':
      return { startDate: startOfWeekString_(today), endDate: today };
    case 'month':
      return { startDate: startOfMonthString_(today), endDate: today };
    case 'year':
      return { startDate: startOfYearString_(today), endDate: today };
    case 'custom':
      requireFields_(payload, ['startDate', 'endDate']);
      if (payload.startDate > payload.endDate) {
        throw new AppError_('VALIDATION_ERROR', 'Tanggal awal tidak boleh setelah tanggal akhir.');
      }
      return { startDate: payload.startDate, endDate: payload.endDate };
    case 'today':
    default:
      return { startDate: today, endDate: today };
  }
}

function loadBarberSelesai_() {
  return getSheetData_(SHEETS.TRANSAKSI_BARBER).rows.filter(function (r) {
    return r.IsDeleted !== true && r.IsDeleted !== 'TRUE' && r.Status === STATUS_TRANSAKSI.SELESAI;
  });
}

function loadWarkopSelesai_() {
  return getSheetData_(SHEETS.TRANSAKSI_WARKOP).rows.filter(function (r) {
    return r.IsDeleted !== true && r.IsDeleted !== 'TRUE' && r.Status === STATUS_TRANSAKSI.SELESAI;
  });
}

function inDateRange_(rows, start, end) {
  return rows.filter(function (r) { return r.Tanggal >= start && r.Tanggal <= end; });
}

function sumMetodeBarber_(rows) {
  var cash = 0, qris = 0;
  rows.forEach(function (r) {
    if (r.MetodePembayaran === METODE_BAYAR.CASH) cash += Number(r.GrandTotal);
    else if (r.MetodePembayaran === METODE_BAYAR.QRIS) qris += Number(r.GrandTotal);
  });
  return { cash: round2_(cash), qris: round2_(qris) };
}

/** Warkop bisa "Split" -- rinciannya di kolom SplitBill dijumlahkan ke Cash/QRIS. */
function sumMetodeWarkop_(rows) {
  var cash = 0, qris = 0;
  rows.forEach(function (r) {
    if (r.MetodePembayaran === METODE_BAYAR.CASH) {
      cash += Number(r.GrandTotal);
    } else if (r.MetodePembayaran === METODE_BAYAR.QRIS) {
      qris += Number(r.GrandTotal);
    } else if (r.MetodePembayaran === 'Split') {
      var split = [];
      try { split = JSON.parse(r.SplitBill); } catch (e) { split = []; }
      split.forEach(function (s) {
        if (s.metode === METODE_BAYAR.CASH) cash += Number(s.jumlah);
        else if (s.metode === METODE_BAYAR.QRIS) qris += Number(s.jumlah);
      });
    }
  });
  return { cash: round2_(cash), qris: round2_(qris) };
}

function baseMetrics_(rows, pengeluaranSheet, start, end) {
  var pendapatan = round2_(rows.reduce(function (s, r) { return s + Number(r.GrandTotal); }, 0));
  var pengeluaran = sumPengeluaranInRange_(pengeluaranSheet, start, end);
  return {
    pendapatan: pendapatan,
    transaksi: rows.length,
    pengeluaran: pengeluaran,
    labaBersih: round2_(pendapatan - pengeluaran)
  };
}

function barberMetrics_(rows, start, end) {
  var m = baseMetrics_(rows, SHEETS.PENGELUARAN_BARBER, start, end);
  var metode = sumMetodeBarber_(rows);
  m.cash = metode.cash;
  m.qris = metode.qris;
  m.totalKepala = rows.length; // 1 transaksi Barber = 1 pelanggan (kepala) dilayani
  return m;
}

function warkopMetrics_(rows, start, end) {
  var m = baseMetrics_(rows, SHEETS.PENGELUARAN_WARKOP, start, end);
  var metode = sumMetodeWarkop_(rows);
  m.cash = metode.cash;
  m.qris = metode.qris;
  return m;
}

function gabunganMetrics_(barberRows, warkopRows, start, end) {
  var b = barberMetrics_(barberRows, start, end);
  var w = warkopMetrics_(warkopRows, start, end);
  return {
    pendapatan: round2_(b.pendapatan + w.pendapatan),
    transaksi: b.transaksi + w.transaksi,
    cash: round2_(b.cash + w.cash),
    qris: round2_(b.qris + w.qris),
    pengeluaran: round2_(b.pengeluaran + w.pengeluaran),
    labaBersih: round2_(b.labaBersih + w.labaBersih)
  };
}

function trendGranularity_(start, end) {
  if (start === end) return 'hour';
  if (daysBetweenDateStrings_(start, end) <= 31) return 'day';
  return 'month';
}

/**
 * Bangun seri tren (label + value) dengan granularitas otomatis: per jam
 * (rentang 1 hari), per hari (<=31 hari), atau per bulan (lebih panjang,
 * mis. filter Tahun Ini). Bucket kosong tetap ditampilkan sebagai 0 supaya
 * grafik tidak terputus-putus.
 */
function buildTrendSeries_(rows, start, end, valueFn) {
  var granularity = trendGranularity_(start, end);
  var buckets = {};
  var order = [];

  if (granularity === 'hour') {
    for (var h = 0; h < 24; h++) {
      var hLabel = ('0' + h).slice(-2) + ':00';
      buckets[hLabel] = 0;
      order.push(hLabel);
    }
  } else if (granularity === 'day') {
    var cur = start;
    while (cur <= end) {
      buckets[cur] = 0;
      order.push(cur);
      cur = shiftDateString_(cur, 1);
    }
  } else {
    var curMonth = start.slice(0, 7);
    var endMonth = end.slice(0, 7);
    while (curMonth <= endMonth) {
      buckets[curMonth] = 0;
      order.push(curMonth);
      var d = new Date(curMonth + '-01T00:00:00');
      d.setMonth(d.getMonth() + 1);
      curMonth = formatDate_(d, 'yyyy-MM');
    }
  }

  rows.forEach(function (r) {
    var label = granularity === 'hour' ? r.Jam.slice(0, 2) + ':00'
      : granularity === 'day' ? r.Tanggal
      : r.Tanggal.slice(0, 7);
    if (buckets[label] === undefined) { buckets[label] = 0; order.push(label); }
    buckets[label] += valueFn(r);
  });

  return {
    granularity: granularity,
    labels: order,
    values: order.map(function (l) { return round2_(buckets[l]); })
  };
}

function topCapster_(rows, limit) {
  var map = {};
  rows.forEach(function (r) {
    var key = r.CapsterID;
    if (!map[key]) map[key] = { capsterId: key, nama: r.NamaCapster, transaksi: 0, pendapatan: 0 };
    map[key].transaksi += 1;
    map[key].pendapatan += Number(r.GrandTotal);
  });
  var list = Object.keys(map).map(function (k) { map[k].pendapatan = round2_(map[k].pendapatan); return map[k]; });
  list.sort(function (a, b) { return b.pendapatan - a.pendapatan; });
  return list.slice(0, limit || 5);
}

function topLayanan_(rows, limit) {
  var map = {};
  rows.forEach(function (r) {
    var items = [];
    try { items = JSON.parse(r.Layanan); } catch (e) { items = []; }
    items.forEach(function (it) {
      if (!map[it.nama]) map[it.nama] = { nama: it.nama, jumlah: 0, pendapatan: 0 };
      map[it.nama].jumlah += 1;
      map[it.nama].pendapatan += Number(it.harga);
    });
  });
  var list = Object.keys(map).map(function (k) { map[k].pendapatan = round2_(map[k].pendapatan); return map[k]; });
  list.sort(function (a, b) { return b.jumlah - a.jumlah; });
  return list.slice(0, limit || 5);
}

function topProdukWarkop_(rows, limit) {
  var map = {};
  rows.forEach(function (r) {
    var items = [];
    try { items = JSON.parse(r.Items); } catch (e) { items = []; }
    items.forEach(function (it) {
      if (!map[it.nama]) map[it.nama] = { nama: it.nama, qty: 0, pendapatan: 0 };
      map[it.nama].qty += Number(it.qty);
      map[it.nama].pendapatan += Number(it.subtotal);
    });
  });
  var list = Object.keys(map).map(function (k) { map[k].pendapatan = round2_(map[k].pendapatan); return map[k]; });
  list.sort(function (a, b) { return b.qty - a.qty; });
  return list.slice(0, limit || 5);
}

function topKategoriWarkop_(rows, limit) {
  var produkKategori = {};
  getSheetData_(SHEETS.PRODUK_WARKOP).rows.forEach(function (p) { produkKategori[p.ID] = p.Kategori || 'Lainnya'; });

  var map = {};
  rows.forEach(function (r) {
    var items = [];
    try { items = JSON.parse(r.Items); } catch (e) { items = []; }
    items.forEach(function (it) {
      var kategori = produkKategori[it.produkId] || 'Lainnya';
      if (!map[kategori]) map[kategori] = { kategori: kategori, qty: 0, pendapatan: 0 };
      map[kategori].qty += Number(it.qty);
      map[kategori].pendapatan += Number(it.subtotal);
    });
  });
  var list = Object.keys(map).map(function (k) { map[k].pendapatan = round2_(map[k].pendapatan); return map[k]; });
  list.sort(function (a, b) { return b.pendapatan - a.pendapatan; });
  return list.slice(0, limit || 5);
}

function dashboardData_(payload) {
  var session = requireAuth_(payload.token);
  requirePermission_(session, 'dashboard');

  var today = todayDateString_();
  var monthStart = startOfMonthString_(today);
  var range = resolveDateRange_(payload);
  var usaha = payload.usaha === USAHA.BARBER || payload.usaha === USAHA.WARKOP ? payload.usaha : 'Gabungan';

  var barberAll = loadBarberSelesai_();
  var warkopAll = loadWarkopSelesai_();

  var result = {
    usaha: usaha,
    filter: payload.filter || 'today',
    periode: { startDate: range.startDate, endDate: range.endDate }
  };

  if (usaha === USAHA.BARBER) {
    var bToday = inDateRange_(barberAll, today, today);
    var bMonth = inDateRange_(barberAll, monthStart, today);
    var bPeriode = inDateRange_(barberAll, range.startDate, range.endDate);

    result.hariIni = barberMetrics_(bToday, today, today);
    result.bulanIni = barberMetrics_(bMonth, monthStart, today);
    result.periodeMetrics = barberMetrics_(bPeriode, range.startDate, range.endDate);
    result.capsterTerlaris = topCapster_(bPeriode, 5);
    result.layananTerlaris = topLayanan_(bPeriode, 5);
    result.metodePembayaran = sumMetodeBarber_(bPeriode);
    result.chartPendapatan = buildTrendSeries_(bPeriode, range.startDate, range.endDate, function (r) { return Number(r.GrandTotal); });
    result.chartKepala = buildTrendSeries_(bPeriode, range.startDate, range.endDate, function () { return 1; });
  } else if (usaha === USAHA.WARKOP) {
    var wToday = inDateRange_(warkopAll, today, today);
    var wMonth = inDateRange_(warkopAll, monthStart, today);
    var wPeriode = inDateRange_(warkopAll, range.startDate, range.endDate);

    result.hariIni = warkopMetrics_(wToday, today, today);
    result.bulanIni = warkopMetrics_(wMonth, monthStart, today);
    result.periodeMetrics = warkopMetrics_(wPeriode, range.startDate, range.endDate);
    result.menuTerlaris = topProdukWarkop_(wPeriode, 5);
    result.kategoriTerlaris = topKategoriWarkop_(wPeriode, 5);
    result.metodePembayaran = sumMetodeWarkop_(wPeriode);
    result.chartPendapatan = buildTrendSeries_(wPeriode, range.startDate, range.endDate, function (r) { return Number(r.GrandTotal); });
    result.chartProdukTerjual = buildTrendSeries_(wPeriode, range.startDate, range.endDate, function (r) {
      var items = [];
      try { items = JSON.parse(r.Items); } catch (e) { items = []; }
      return items.reduce(function (s, it) { return s + Number(it.qty); }, 0);
    });
  } else {
    var bT = inDateRange_(barberAll, today, today), wT = inDateRange_(warkopAll, today, today);
    var bM = inDateRange_(barberAll, monthStart, today), wM = inDateRange_(warkopAll, monthStart, today);
    var bP = inDateRange_(barberAll, range.startDate, range.endDate), wP = inDateRange_(warkopAll, range.startDate, range.endDate);

    result.hariIni = gabunganMetrics_(bT, wT, today, today);
    result.bulanIni = gabunganMetrics_(bM, wM, monthStart, today);
    result.periodeMetrics = gabunganMetrics_(bP, wP, range.startDate, range.endDate);

    result.chartPendapatan = buildTrendSeries_(bP.concat(wP), range.startDate, range.endDate, function (r) { return Number(r.GrandTotal); });
    result.chartPendapatanBarber = buildTrendSeries_(bP, range.startDate, range.endDate, function (r) { return Number(r.GrandTotal); });
    result.chartPendapatanWarkop = buildTrendSeries_(wP, range.startDate, range.endDate, function (r) { return Number(r.GrandTotal); });
  }

  return result;
}
