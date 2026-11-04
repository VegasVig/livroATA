let __ss = null;
const __cache = {};

function ss_() {
  if (__ss) return __ss;
  const id = prop_('SPREADSHEET_ID');
  if (!id) throw new AppError('Sistema não configurado. O administrador deve executar setup().', 'SETUP');
  __ss = SpreadsheetApp.openById(id);
  return __ss;
}

function sh_(nome) {
  const s = ss_().getSheetByName(nome);
  if (!s) throw new AppError('Aba ' + nome + ' não encontrada. Execute setup().', 'SETUP');
  return s;
}

function limparCache_(nome) { if (nome) delete __cache[nome]; else Object.keys(__cache).forEach(function (k) { delete __cache[k]; }); }

function all_(nome) {
  if (__cache[nome]) return __cache[nome];
  const s = sh_(nome);
  const cols = SCHEMA[nome];
  const last = s.getLastRow();
  if (last < 2) return (__cache[nome] = []);
  const vals = s.getRange(2, 1, last - 1, cols.length).getValues();
  __cache[nome] = vals.map(function (r, i) {
    const o = { __row: i + 2 };
    cols.forEach(function (k, j) { o[k] = r[j] === null || r[j] === undefined ? '' : String(r[j]); });
    return o;
  }).filter(function (o) { return o.id; });
  return __cache[nome];
}

function find_(nome, id) {
  if (!id) return null;
  const l = all_(nome);
  for (let i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
  return null;
}

function findBy_(nome, campo, valor) {
  const l = all_(nome);
  for (let i = 0; i < l.length; i++) if (l[i][campo] === valor) return l[i];
  return null;
}

function cell_(v) {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@']/.test(s)) s = "'" + s;
  return s;
}

function linha_(nome, obj) { return SCHEMA[nome].map(function (k) { return cell_(obj[k]); }); }

function insert_(nome, obj) {
  const s = sh_(nome);
  const n = SCHEMA[nome].length;
  const r = s.getLastRow() + 1;
  const rg = s.getRange(r, 1, 1, n);
  rg.setNumberFormat('@');
  rg.setValues([linha_(nome, obj)]);
  limparCache_(nome);
  return obj;
}

function update_(nome, id, patch) {
  if (IMUTAVEIS[nome]) throw new AppError('A aba ' + nome + ' não aceita alterações.', 'IMMUTABLE');
  limparCache_(nome);
  const atual = find_(nome, id);
  if (!atual) throw new AppError('Registro não encontrado: ' + id, 'NOT_FOUND');
  if (nome === 'REGISTROS' && atual.status === 'FINALIZADO') throw new AppError('Registro assinado não pode ser alterado.', 'IMMUTABLE');
  const novo = Object.assign({}, atual, patch);
  const rg = sh_(nome).getRange(atual.__row, 1, 1, SCHEMA[nome].length);
  rg.setNumberFormat('@');
  rg.setValues([linha_(nome, novo)]);
  limparCache_(nome);
  return novo;
}

function remove_(nome, id) {
  if (nome !== 'REGISTROS') throw new AppError('Exclusão não permitida.', 'IMMUTABLE');
  limparCache_(nome);
  const atual = find_(nome, id);
  if (!atual) return;
  if (atual.status !== 'RASCUNHO') throw new AppError('Somente rascunhos podem ser descartados.', 'IMMUTABLE');
  sh_(nome).deleteRow(atual.__row);
  limparCache_(nome);
}
