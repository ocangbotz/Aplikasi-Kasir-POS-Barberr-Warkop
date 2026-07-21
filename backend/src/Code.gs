/**
 * Code.gs
 * Entry point Web App. Semua request masuk lewat doPost (JSON body:
 * { action, token, ...payload }) dan diteruskan ke ROUTES[action].
 *
 * Kenapa satu endpoint saja? Google Apps Script Web App hanya expose satu
 * URL; memisah per-resource lewat query "action" jauh lebih simpel daripada
 * mengelola banyak deployment/URL.
 *
 * Frontend WAJIB mengirim body sebagai text/plain (bukan application/json)
 * agar browser tidak melakukan CORS preflight (OPTIONS) -- Apps Script tidak
 * bisa merespon preflight dengan benar.
 */

var ROUTES = {
  ping: function () { return { pong: true, time: new Date().toISOString(), version: APP_CONFIG.VERSION }; },

  login: function (p) { return authLogin_(p); },
  logout: function (p) { return authLogout_(p); },
  getMe: function (p) { return authGetMe_(p); },
  changePassword: function (p) { return authChangePassword_(p); },

  auditLogList: function (p) { return auditLogList_(p); },

  getSettings: function (p) { return getSettings_(p); },
  updateSettings: function (p) { return updateSettings_(p); },

  searchPelanggan: function (p) { return searchPelanggan_(p); },

  barberListLayanan: function (p) { return barberListLayanan_(p); },
  barberSaveLayanan: function (p) { return barberSaveLayanan_(p); },
  barberListCapster: function (p) { return barberListCapster_(p); },
  barberSaveCapster: function (p) { return barberSaveCapster_(p); },
  barberCreateTransaksi: function (p) { return barberCreateTransaksi_(p); },
  barberListTransaksi: function (p) { return barberListTransaksi_(p); },
  barberGetTransaksi: function (p) { return barberGetTransaksi_(p); },

  warkopListProduk: function (p) { return warkopListProduk_(p); },
  warkopSaveProduk: function (p) { return warkopSaveProduk_(p); },
  warkopCreateTransaksi: function (p) { return warkopCreateTransaksi_(p); },
  warkopListTransaksi: function (p) { return warkopListTransaksi_(p); },
  warkopGetTransaksi: function (p) { return warkopGetTransaksi_(p); },

  inventoryList: function (p) { return inventoryList_(p); },
  inventorySaveItem: function (p) { return inventorySaveItem_(p); },
  inventoryAdjustStock: function (p) { return inventoryAdjustStock_(p); },
  inventoryLowStockSummary: function (p) { return inventoryLowStockSummary_(p); },

  pengeluaranCreate: function (p) { return pengeluaranCreate_(p); },
  pengeluaranList: function (p) { return pengeluaranList_(p); },

  dashboardData: function (p) { return dashboardData_(p); },

  shiftGetCurrent: function (p) { return shiftGetCurrent_(p); },
  shiftOpen: function (p) { return shiftOpen_(p); },
  shiftClose: function (p) { return shiftClose_(p); },
  shiftReopen: function (p) { return shiftReopen_(p); },
  shiftList: function (p) { return shiftList_(p); },

  gajiCapsterPreview: function (p) { return gajiCapsterPreview_(p); },
  gajiCapsterSave: function (p) { return gajiCapsterSave_(p); },
  gajiCapsterList: function (p) { return gajiCapsterList_(p); },

  pelangganList: function (p) { return pelangganList_(p); },
  pelangganDetail: function (p) { return pelangganDetail_(p); },
  pelangganSetMember: function (p) { return pelangganSetMember_(p); },

  usersList: function (p) { return usersList_(p); },
  usersSave: function (p) { return usersSave_(p); },

  ownerListTransaksi: function (p) { return ownerListTransaksi_(p); },
  ownerUpdateTransaksi: function (p) { return ownerUpdateTransaksi_(p); },
  ownerDeleteTransaksi: function (p) { return ownerDeleteTransaksi_(p); },
  ownerRestoreTransaksi: function (p) { return ownerRestoreTransaksi_(p); },
  ownerBackupData: function (p) { return ownerBackupData_(p); },
  ownerRestoreData: function (p) { return ownerRestoreData_(p); }
};

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  try {
    var body = parseRequestBody_(e, method);
    var action = body.action;
    if (!action) throw new AppError_('BAD_REQUEST', 'Parameter "action" wajib diisi.');
    var handler = ROUTES[action];
    if (!handler) throw new AppError_('NOT_FOUND', 'Action "' + action + '" tidak dikenal.');
    var result = handler(body);
    return successResponse_(result);
  } catch (err) {
    logErrorSafe_(err);
    return errorResponse_(err);
  }
}

function parseRequestBody_(e, method) {
  if (method === 'POST' && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (parseErr) {
      throw new AppError_('BAD_REQUEST', 'Body request bukan JSON yang valid.');
    }
  }
  // Fallback GET (query string) -- dipakai untuk ping/testing manual.
  return e.parameter || {};
}

function logErrorSafe_(err) {
  try {
    console.error((err && err.stack) || err);
  } catch (ignored) { /* Logger tidak tersedia di beberapa konteks eksekusi */ }
}
