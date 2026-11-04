const crypto = require('crypto');
const props = {}, cache = {}, logs = [], sheetsDb = {};
let tz = '-03:00';
function mkRange(sh, r, c, nr, nc) {
  const R = {
    setValues(v) { v.forEach((row, i) => row.forEach((val, j) => { let s = val; if (typeof s === 'string' && s.startsWith("'")) s = s.slice(1); sh._set(r + i, c + j, s); })); return R; },
    getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(sh._get(r + i, c + j)); o.push(row); } return o; },
    getValue() { return sh._get(r, c); },
    setNumberFormat() { return R; }, setFontWeight() { return R; }, setBackground() { return R; }, setFontColor() { return R; }
  };
  return R;
}
function mkSheet(name) {
  const rows = [];
  const sh = {
    name, rows,
    _set(r, c, v) { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
    _get(r, c) { const row = rows[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; },
    getLastRow() { let n = rows.length; while (n > 0 && !(rows[n - 1] || []).some(x => x !== '' && x !== undefined)) n--; return n; },
    getMaxColumns() { return 26; }, getMaxRows() { return 1000; }, insertColumnsAfter() {},
    getRange(r, c, nr, nc) { return mkRange(sh, r, c, nr || 1, nc || 1); },
    setFrozenRows() {}, getProtections() { return []; },
    protect() { return { setDescription() {}, removeEditors() {}, getEditors() { return []; }, canDomainEdit() { return false; } }; },
    deleteRow(r) { rows.splice(r - 1, 1); }
  };
  return sh;
}
const ss = { sheets: { Sheet1: mkSheet('Sheet1') }, getId: () => 'SS1', getUrl: () => 'https://ss',
  getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return (this.sheets[n] = mkSheet(n)); },
  getSheets() { return Object.values(this.sheets); }, deleteSheet(s) { delete this.sheets[s.name]; } };
const folder = (id) => ({ getId: () => id, getFoldersByName: () => ({ hasNext: () => false }), createFolder: (n) => folder('F-' + n), createFile: (b) => ({ getId: () => 'FILE-' + Math.random(), getUrl: () => 'https://drive/file' }) });
Object.assign(global, {
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  SpreadsheetApp: { create: () => ss, openById: () => ss, flush() {}, ProtectionType: { SHEET: 'SHEET' } },
  Utilities: {
    DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(String(s), 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, z, f) => { if (f === 'yyyyMMdd_HHmm') return '20261104_1000'; const x = new Date(d.getTime() - 3 * 3600000); return x.toISOString().slice(0, 19) + tz; },
    base64Decode: s => Buffer.from(s, 'base64'), newBlob: (b, m, n) => ({ b, m, n })
  },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  DriveApp: { createFolder: n => folder('F-' + n), getFolderById: id => folder(id), getFileById: () => ({ moveTo() {}, makeCopy: () => ({ getId: () => 'BK', getUrl: () => 'https://bk' }) }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }) }) }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'ti@vegas.com.br' }) },
  MailApp: { sendEmail: (...a) => { global.__mail = a; } },
  Logger: { log: m => logs.push(m) }, console,
  __logs: logs, __ss: ss, __cache: cache
});
