'use strict';
/**
 * Mock minimal Google Apps Script runtime supaya file .gs bisa dijalankan &
 * diuji dengan Node.js biasa, tanpa deploy ke Google.
 * Hanya mengimplementasikan API yang benar-benar dipakai backend/src/*.gs.
 */
const crypto = require('crypto');

function createMockGas() {
  const store = new Map(); // id -> MockSpreadsheet
  const scriptProps = new Map();

  class MockRange {
    constructor(sheet, row, col, numRows, numCols) {
      this.sheet = sheet; this.row = row; this.col = col;
      this.numRows = numRows; this.numCols = numCols;
    }
    getValues() {
      const out = [];
      for (let r = 0; r < this.numRows; r++) {
        const rowData = [];
        for (let c = 0; c < this.numCols; c++) {
          const rIdx = this.row + r - 1, cIdx = this.col + c - 1;
          rowData.push((this.sheet.data[rIdx] && this.sheet.data[rIdx][cIdx] !== undefined) ? this.sheet.data[rIdx][cIdx] : '');
        }
        out.push(rowData);
      }
      return out;
    }
    setValues(values) {
      for (let r = 0; r < values.length; r++) {
        const rIdx = this.row + r - 1;
        while (this.sheet.data.length <= rIdx) this.sheet.data.push([]);
        for (let c = 0; c < values[r].length; c++) {
          this.sheet.data[rIdx][this.col + c - 1] = values[r][c];
        }
      }
      return this;
    }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
  }

  class MockSheet {
    constructor(name) { this.name = name; this.data = []; }
    getRange(row, col, numRows, numCols) { return new MockRange(this, row, col, numRows || 1, numCols || 1); }
    getLastRow() { return this.data.length; }
    getLastColumn() { return this.data.reduce((max, row) => Math.max(max, row.length), 0); }
    appendRow(rowArr) { this.data.push(rowArr.slice()); }
    setFrozenRows() { return this; }
    getName() { return this.name; }
  }

  class MockSpreadsheet {
    constructor(id, name) { this.id = id; this.name = name; this.sheets = new Map(); }
    getId() { return this.id; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
    getSheetByName(name) { return this.sheets.get(name) || null; }
    insertSheet(name) { const s = new MockSheet(name); this.sheets.set(name, s); return s; }
    deleteSheet(sheet) { this.sheets.delete(sheet.name); }
    getSheets() { return Array.from(this.sheets.values()); }
  }

  const SpreadsheetApp = {
    create(name) {
      const id = 'mock-ss-' + (store.size + 1);
      const ss = new MockSpreadsheet(id, name);
      ss.insertSheet('Sheet1');
      store.set(id, ss);
      return ss;
    },
    openById(id) {
      const ss = store.get(id);
      if (!ss) throw new Error('Spreadsheet not found: ' + id);
      return ss;
    }
  };

  const PropertiesService = {
    getScriptProperties() {
      return {
        getProperty: (k) => (scriptProps.has(k) ? scriptProps.get(k) : null),
        setProperty: (k, v) => { scriptProps.set(k, v); },
        deleteProperty: (k) => { scriptProps.delete(k); }
      };
    }
  };

  const Utilities = {
    getUuid: () => crypto.randomUUID(),
    computeHmacSha256Signature: (value, key) => {
      const buf = crypto.createHmac('sha256', key).update(String(value)).digest();
      return Array.from(buf);
    },
    formatDate: (date, tz, pattern) => {
      const pad = (n) => String(n).padStart(2, '0');
      const map = {
        yyyy: date.getFullYear(), MM: pad(date.getMonth() + 1), dd: pad(date.getDate()),
        HH: pad(date.getHours()), mm: pad(date.getMinutes()), ss: pad(date.getSeconds())
      };
      return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (m) => map[m]);
    }
  };

  class TextOutput {
    setContent(c) { this.content = c; return this; }
    setMimeType() { return this; }
    getContent() { return this.content; }
  }
  const ContentService = {
    MimeType: { JSON: 'JSON' },
    createTextOutput(content) { return new TextOutput().setContent(content); }
  };

  return { SpreadsheetApp, PropertiesService, Utilities, ContentService, console };
}

module.exports = { createMockGas };
