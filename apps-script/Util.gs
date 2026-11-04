function sha256_(str) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
}

function now_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function uid_(prefixo) { return prefixo + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 14).toUpperCase(); }

function canon_(pares) { return JSON.stringify(pares.map(function (p) { return [p[0], p[1] === undefined || p[1] === null ? '' : String(p[1])]; })); }

function norm_(s) { return String(s === undefined || s === null ? '' : s).normalize('NFC').replace(/\r\n?/g, '\n'); }

function txt_(s, max, campo) {
  const v = norm_(s).trim();
  if (max && v.length > max) throw new AppError((campo || 'Campo') + ' excede ' + max + ' caracteres.');
  return v;
}

function req_(s, max, campo) {
  const v = txt_(s, max, campo);
  if (!v) throw new AppError((campo || 'Campo') + ' é obrigatório.');
  return v;
}

function csv_(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(String); }

function pad_(n, t) { return ('000000' + n).slice(-t); }

function msDe_(iso) { return iso ? new Date(iso).getTime() : 0; }

let __lockDepth = 0;
let __lock = null;
function withLock_(fn) {
  if (__lockDepth > 0) { __lockDepth++; try { return fn(); } finally { __lockDepth--; } }
  __lock = LockService.getScriptLock();
  if (!__lock.tryLock(25000)) throw new AppError('Sistema ocupado. Tente novamente em alguns segundos.', 'BUSY');
  __lockDepth = 1;
  try { return fn(); } finally { __lockDepth = 0; SpreadsheetApp.flush(); __lock.releaseLock(); __lock = null; }
}
