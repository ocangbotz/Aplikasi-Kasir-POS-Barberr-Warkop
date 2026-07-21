'use strict';
/**
 * Test harness untuk backend/src/*.gs tanpa perlu deploy ke Google Apps Script.
 * Menjalankan file .gs apa adanya di dalam vm context yang diberi mock GAS API.
 * Jalankan: node backend/test/run-tests.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { createMockGas } = require('./mockGas');

const SRC_DIR = path.join(__dirname, '..', 'src');
const FILES_IN_ORDER = [
  'Config.gs', 'Utils.gs', 'Auth.gs', 'AuditLog.gs', 'Code.gs', 'SetupDatabase.gs'
];

function loadContext() {
  const mocks = createMockGas();
  const sandbox = Object.assign({}, mocks, { Object, Array, JSON, Math, Date, String, Number, Error });
  const context = vm.createContext(sandbox);
  FILES_IN_ORDER.forEach((file) => {
    const code = fs.readFileSync(path.join(SRC_DIR, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  });
  return context;
}

/** deepStrictEqual salah negatif untuk array lintas-realm vm; bandingkan lewat JSON. */
function assertValuesEqual(actual, expected, message) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function assertThrowsCode(fn, expectedCode) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  assert.ok(threw, 'expected function to throw');
  assert.strictEqual(threw.code, expectedCode, 'expected error code ' + expectedCode + ' but got ' + threw.code);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
    passed++;
  } catch (err) {
    console.error('  ✗ ' + name);
    console.error('      ' + err.message);
    failed++;
  }
}

console.log('Backend logic tests (mocked GAS runtime)\n');

// --- Setup & schema ---
const ctx = loadContext();
let setupSummary;
test('setupDatabase() membuat spreadsheet & seluruh sheet', () => {
  setupSummary = ctx.setupDatabase();
  assert.ok(setupSummary.spreadsheetId);
  assert.strictEqual(setupSummary.sheetsCreated.length, 15);
});

test('setupDatabase() idempotent (jalan dua kali tidak duplikat header/owner)', () => {
  const before = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  ctx.setupDatabase();
  const after = ctx.getSheetData_(ctx.SHEETS.KASIR).rows.length;
  assert.strictEqual(before, after, 'akun owner tidak boleh terduplikasi');
});

test('Semua 15 sheet memiliki header sesuai skema', () => {
  Object.keys(ctx.SHEET_SCHEMAS_).forEach((name) => {
    const data = ctx.getSheetData_(name);
    assertValuesEqual(data.headers, ctx.SHEET_SCHEMAS_[name], 'header mismatch: ' + name);
  });
});

test('Settings ter-seed dengan default values', () => {
  const data = ctx.getSheetData_(ctx.SHEETS.SETTINGS);
  assert.ok(data.rows.length >= 9);
  const namaUsaha = data.rows.find((r) => r.Key === 'nama_usaha');
  assert.ok(namaUsaha);
});

// --- Auth ---
let ownerCreds, ownerToken;
test('Akun Owner default dibuat dengan password acak (tidak plaintext hardcoded)', () => {
  const kasirData = ctx.getSheetData_(ctx.SHEETS.KASIR);
  assert.strictEqual(kasirData.rows.length, 1);
  const owner = kasirData.rows[0];
  assert.strictEqual(owner.Username, 'owner');
  assert.strictEqual(owner.Role, 'Owner');
  assert.notStrictEqual(owner.PasswordHash, '');
  ownerCreds = setupSummary.ownerAccountCreated;
  assert.ok(ownerCreds && ownerCreds.password);
});

test('Login dengan password salah ditolak', () => {
  assert.throws(() => {
    ctx.authLogin_({ username: 'owner', password: 'password-salah-sekali' });
  }, /AUTH_INVALID|salah/i);
});

test('Login dengan kredensial benar mengembalikan token & user', () => {
  const result = ctx.authLogin_({ username: 'owner', password: ownerCreds.password });
  assert.ok(result.token);
  assert.strictEqual(result.user.role, 'Owner');
  ownerToken = result.token;
});

test('requireAuth_ menerima token valid & menolak token acak', () => {
  const session = ctx.requireAuth_(ownerToken);
  assert.strictEqual(session.role, 'Owner');
  assertThrowsCode(() => ctx.requireAuth_('token-acak-tidak-valid'), 'AUTH_REQUIRED');
});

test('Permission matrix: Owner boleh semua, Kasir dilarang kelolaUser', () => {
  assert.strictEqual(ctx.hasPermission_('Owner', 'kelolaUser'), true);
  assert.strictEqual(ctx.hasPermission_('Kasir', 'kelolaUser'), false);
  assert.strictEqual(ctx.hasPermission_('Kasir', 'transaksiBarber'), true);
  assert.strictEqual(ctx.hasPermission_('Capster', 'transaksiWarkop'), false);
});

test('requirePermission_ melempar FORBIDDEN untuk role tanpa akses', () => {
  assertThrowsCode(() => ctx.requirePermission_({ role: 'Kasir' }, 'kelolaUser'), 'FORBIDDEN');
});

// --- HTTP router (doPost) ---
test('doPost ping mengembalikan ok:true', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'ping' }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.pong, true);
});

test('doPost login end-to-end melalui router', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'login', username: 'owner', password: ownerCreds.password }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.ok(body.data.token);
});

test('doPost action tidak dikenal mengembalikan error terstruktur, bukan exception mentah', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'tidakAda' }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, 'NOT_FOUND');
});

test('doPost getMe mengembalikan user yang sedang login', () => {
  const res = ctx.doPost({ postData: { contents: JSON.stringify({ action: 'getMe', token: ownerToken }) } });
  const body = JSON.parse(res.getContent());
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.user.username, 'owner');
});

// --- Utils ---
test('generateId_ menghasilkan ID unik', () => {
  const ids = new Set();
  for (let i = 0; i < 50; i++) ids.add(ctx.generateId_('X'));
  assert.strictEqual(ids.size, 50);
});

test('sanitizeString_ membuang tag HTML (cegah XSS)', () => {
  assert.strictEqual(ctx.sanitizeString_('<script>alert(1)</script>Budi'), 'alert(1)Budi');
});

test('requireFields_ melempar VALIDATION_ERROR jika field kosong', () => {
  assertThrowsCode(() => ctx.requireFields_({ a: '' }, ['a', 'b']), 'VALIDATION_ERROR');
});

test('appendRowObject_ / findRowById_ round-trip pada sheet Capster', () => {
  ctx.appendRowObject_(ctx.SHEETS.CAPSTER, { ID: 'CAP-1', Nama: 'Budi', NoHP: '0812', PersentaseBagiHasil: 40, Status: 'Aktif', CreatedAt: new Date(), UpdatedAt: new Date() });
  const found = ctx.findRowById_(ctx.SHEETS.CAPSTER, 'CAP-1');
  assert.strictEqual(found.Nama, 'Budi');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
