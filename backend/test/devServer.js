'use strict';
/**
 * devServer.js
 * Server pengembangan LOKAL (bukan untuk produksi). Menjalankan LOGIKA ASLI
 * backend/src/*.gs (lewat vm + mock GAS runtime yang sama dipakai run-tests.js)
 * di balik HTTP server biasa, sekaligus menyajikan file statis frontend/.
 *
 * Tujuannya: frontend bisa ditest end-to-end di browser sungguhan (termasuk
 * oleh Playwright) tanpa perlu deploy ke akun Google terlebih dahulu.
 * Data disimpan in-memory saja (hilang saat server dihentikan) -- produksi
 * tetap memakai Google Apps Script + Google Sheets sesuai docs/01-SETUP-BACKEND.md.
 *
 * Jalankan: npm run dev:server
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { createMockGas } = require('./mockGas');

const SRC_DIR = path.join(__dirname, '..', 'src');
const FILES_IN_ORDER = [
  'Config.gs', 'Utils.gs', 'Auth.gs', 'AuditLog.gs', 'Pelanggan.gs', 'Settings.gs',
  'Barber.gs', 'Warkop.gs', 'Inventory.gs', 'Pengeluaran.gs', 'Dashboard.gs', 'Code.gs', 'SetupDatabase.gs'
];
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

function loadContext() {
  const mocks = createMockGas();
  const sandbox = Object.assign({}, mocks, { Object, Array, JSON, Math, Date, String, Number, Error });
  const context = vm.createContext(sandbox);
  FILES_IN_ORDER.forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(SRC_DIR, file), 'utf8'), context, { filename: file });
  });
  return context;
}

const ctx = loadContext();
const setupSummary = ctx.setupDatabase();
console.log('[dev-server] Database mock siap (spreadsheet ' + setupSummary.spreadsheetId + ')');
if (setupSummary.ownerAccountCreated) {
  console.log('[dev-server] Login pertama -> username: owner / password: ' + setupSummary.ownerAccountCreated.password);
} else {
  console.log('[dev-server] Akun Owner sudah pernah dibuat sebelumnya di sesi ini.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function handleApi(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const result = ctx.doPost({ postData: { contents: body } });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.writeHead(200);
      res.end(result.getContent());
    });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const params = Object.fromEntries(url.searchParams.entries());
  const result = ctx.doGet({ parameter: params });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(200);
  res.end(result.getContent());
}

function handleStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(FRONTEND_DIR, urlPath);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found: ' + urlPath);
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.writeHead(200);
    res.end(data);
  });
}

/**
 * Route KHUSUS dev-server, TIDAK ADA di backend/src/Code.gs asli -- hanya
 * jalan pintas untuk automated test (Playwright) supaya tidak perlu
 * menyalin password owner secara manual dari log setiap kali server restart.
 */
function handleDevCredentials(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.writeHead(200);
  res.end(JSON.stringify(setupSummary.ownerAccountCreated || {}));
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/__dev/owner-credentials')) return handleDevCredentials(req, res);
  if (req.url.startsWith('/api')) return handleApi(req, res);
  return handleStatic(req, res);
});

const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log(`[dev-server] Berjalan di http://localhost:${PORT}`));
