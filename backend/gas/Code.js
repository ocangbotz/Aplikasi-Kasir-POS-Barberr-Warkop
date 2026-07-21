/**
 * Code.js — entry point Web App Apps Script. Semua request masuk lewat
 * doGet/doPost dalam bentuk RPC tunggal: { action, token, payload }.
 *
 * Kenapa doPost dengan text/plain: memanggil Web App Apps Script dari domain
 * lain (frontend statis di Netlify/Vercel/GitHub Pages/dll) akan kena CORS
 * preflight (OPTIONS) kalau Content-Type di-set ke "application/json" — Apps
 * Script Web App TIDAK bisa merespons preflight OPTIONS. Trik standarnya:
 * client mengirim body JSON dengan Content-Type "text/plain;charset=utf-8"
 * (dianggap "simple request" oleh browser sehingga tidak ada preflight), lalu
 * di sini kita tetap JSON.parse isinya secara manual. Lihat frontend/js/core/api.js
 * (dibangun di Fase 2) untuk implementasi sisi client.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (!params.action) {
      return jsonResponse_({ ok: true, data: { status: 'ok', message: 'POS Barber & Warkop API aktif', version: getSettingsMap()['appVersion'] || '1.0.0' } });
    }
    var payload = {};
    Object.keys(params).forEach(function (k) {
      if (k !== 'action' && k !== 'token') payload[k] = params[k];
    });
    var result = dispatchAction_(params.action, params.token, payload);
    return okResponse_(result);
  } catch (err) {
    return errorResponse_(err);
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var result = dispatchAction_(body.action, body.token, body.payload || {});
    return okResponse_(result);
  } catch (err) {
    return errorResponse_(err);
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function okResponse_(data) {
  return jsonResponse_({ ok: true, data: data });
}

function errorResponse_(err) {
  var code = (err && err.code) || 'INTERNAL_ERROR';
  var message = (err && err.message) || 'Terjadi kesalahan tak terduga';
  return jsonResponse_({ ok: false, error: { code: code, message: message } });
}

/**
 * Dispatch table utama. Fase 1 hanya mengisi handler fondasi (auth, users,
 * settings, backup, audit log). Modul lain (transaksi, dashboard, dsb.)
 * ditambahkan sebagai `case` baru di sini pada Fase 4-9 tanpa mengubah
 * struktur doGet/doPost/RBAC yang sudah ada.
 */
function dispatchAction_(action, token, payload) {
  switch (action) {
    case ACTIONS.AUTH_LOGIN:
      return login(payload);

    case ACTIONS.AUTH_LOGOUT: {
      requireAuth(token);
      return logout(token);
    }

    case ACTIONS.AUTH_ME: {
      var meUser = requireAuth(token);
      return { uid: meUser.uid, username: meUser.username, role: meUser.role, name: meUser.name };
    }

    case ACTIONS.SETTINGS_VIEW: {
      requirePermission(token, action);
      return getSettingsMap();
    }

    case ACTIONS.SETTINGS_UPDATE: {
      var settingsActor = requirePermission(token, action);
      return updateSettings(payload, settingsActor);
    }

    case ACTIONS.USERS_LIST: {
      requirePermission(token, action);
      return listUsers();
    }

    case ACTIONS.USERS_CREATE: {
      var createActor = requirePermission(token, action);
      return createUser(payload, createActor);
    }

    case ACTIONS.USERS_UPDATE: {
      var updateActor = requirePermission(token, action);
      assertRequiredFields(payload, ['userId']);
      return updateUser(payload.userId, payload, updateActor);
    }

    case ACTIONS.BACKUP_CREATE: {
      var backupActor = requirePermission(token, action);
      return createBackup(backupActor);
    }

    case ACTIONS.BACKUP_RESTORE: {
      var restoreActor = requirePermission(token, action);
      assertRequiredFields(payload, ['backupFileId', 'confirm']);
      if (payload.confirm !== 'RESTORE') {
        throw createAppError('VALIDATION_ERROR', 'Konfirmasi restore tidak valid. Kirim payload.confirm = "RESTORE".');
      }
      return restoreFromBackup(payload.backupFileId, restoreActor);
    }

    case ACTIONS.AUDITLOG_LIST: {
      requirePermission(token, action);
      var limit = toSafeNumber(payload.limit, 50, { min: 1, max: 200, clamp: true });
      var offset = toSafeNumber(payload.offset, 0, { min: 0, clamp: true });
      return getAuditLogPage(limit, offset);
    }

    case ACTIONS.LAYANAN_LIST: {
      requirePermission(token, action);
      return listLayananBarber(!!payload.includeInactive);
    }

    case ACTIONS.LAYANAN_MANAGE: {
      var layananActor = requirePermission(token, action);
      if (payload.layananId) return updateLayananBarber(payload.layananId, payload, layananActor);
      return createLayananBarber(payload, layananActor);
    }

    case ACTIONS.CAPSTER_LIST: {
      requirePermission(token, action);
      return listCapsters(!!payload.includeInactive);
    }

    case ACTIONS.CAPSTER_MANAGE: {
      var capsterActor = requirePermission(token, action);
      assertRequiredFields(payload, ['capsterId']);
      return updateCapster(payload.capsterId, payload, capsterActor);
    }

    case ACTIONS.PELANGGAN_VIEW: {
      requirePermission(token, action);
      if (payload.query) return searchPelanggan(payload.query);
      if (payload.pelangganId) return getPelangganDetail(payload.pelangganId);
      return listPelanggan();
    }

    case ACTIONS.PELANGGAN_MANAGE: {
      var pelangganActor = requirePermission(token, action);
      assertRequiredFields(payload, ['pelangganId']);
      return updatePelanggan(payload.pelangganId, payload, pelangganActor);
    }

    case ACTIONS.PRODUK_LIST: {
      requirePermission(token, action);
      return listProdukWarkop(!!payload.includeInactive);
    }

    case ACTIONS.PRODUK_MANAGE: {
      var produkActor = requirePermission(token, action);
      if (payload.restock) return restockProdukWarkop(payload.produkId, payload.tambahan, produkActor);
      if (payload.produkId) return updateProdukWarkop(payload.produkId, payload, produkActor);
      return createProdukWarkop(payload, produkActor);
    }

    case ACTIONS.TRANSAKSI_CREATE: {
      var trxCreateActor = requirePermission(token, action);
      assertRequiredFields(payload, ['jenisUsaha']);
      if (payload.jenisUsaha === JENIS_USAHA.BARBER) return createTransaksiBarber(payload, trxCreateActor);
      if (payload.jenisUsaha === JENIS_USAHA.WARKOP) return createTransaksiWarkop(payload, trxCreateActor);
      throw createAppError('NOT_IMPLEMENTED', 'Transaksi jenis usaha "' + payload.jenisUsaha + '" belum didukung.');
    }

    case ACTIONS.TRANSAKSI_LIST: {
      requirePermission(token, action);
      assertRequiredFields(payload, ['jenisUsaha']);
      if (payload.jenisUsaha === JENIS_USAHA.BARBER) {
        if (payload.transaksiId) return getTransaksiBarberById(payload.transaksiId);
        return listTransaksiBarber(payload);
      }
      if (payload.jenisUsaha === JENIS_USAHA.WARKOP) {
        if (payload.transaksiId) return getTransaksiWarkopById(payload.transaksiId);
        return listTransaksiWarkop(payload);
      }
      throw createAppError('NOT_IMPLEMENTED', 'Transaksi jenis usaha "' + payload.jenisUsaha + '" belum didukung.');
    }

    case ACTIONS.PENGELUARAN_CREATE: {
      var pengeluaranActor = requirePermission(token, action);
      return createPengeluaran(payload, pengeluaranActor);
    }

    case ACTIONS.PENGELUARAN_VIEW: {
      requirePermission(token, action);
      assertRequiredFields(payload, ['jenisUsaha']);
      return listPengeluaran(payload.jenisUsaha, payload);
    }

    case ACTIONS.INVENTORY_VIEW: {
      requirePermission(token, action);
      if (payload.summary) return getLowStockSummary();
      assertRequiredFields(payload, ['jenisUsaha']);
      return listInventory(payload.jenisUsaha);
    }

    case ACTIONS.DASHBOARD_VIEW: {
      requirePermission(token, action);
      assertRequiredFields(payload, ['dashboard']);
      if (payload.dashboard === 'gabungan') return getDashboardGabungan(payload.filterType, payload.customStart, payload.customEnd);
      if (payload.dashboard === 'barber') return getDashboardBarber(payload.filterType, payload.customStart, payload.customEnd);
      if (payload.dashboard === 'warkop') return getDashboardWarkop(payload.filterType, payload.customStart, payload.customEnd);
      throw createAppError('VALIDATION_ERROR', 'dashboard tidak dikenal: ' + payload.dashboard);
    }

    case ACTIONS.INVENTORY_MANAGE: {
      var inventoryActor = requirePermission(token, action);
      assertRequiredFields(payload, ['jenisUsaha']);
      if (payload.adjust) {
        assertRequiredFields(payload, ['itemId']);
        return adjustInventoryStok(payload.jenisUsaha, payload.itemId, payload.delta, payload.keterangan, payload.hargaBeliTerakhir, inventoryActor);
      }
      if (payload.itemId) return updateInventoryItem(payload.jenisUsaha, payload.itemId, payload, inventoryActor);
      return createInventoryItem(payload.jenisUsaha, payload, inventoryActor);
    }

    default:
      throw createAppError('UNKNOWN_ACTION', 'Aksi tidak dikenal: ' + action);
  }
}
