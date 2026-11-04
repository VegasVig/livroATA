function log_(sess, acao, entidade, entidadeId, detalhes, resultado) {
  try {
    withLock_(function () {
      const s = sh_('LOG_AUDITORIA');
      const last = s.getLastRow();
      const anterior = last >= 2 ? String(s.getRange(last, SCHEMA.LOG_AUDITORIA.length).getValue()) : 'LOG-GENESE';
      const e = {
        id: uid_('LOG'),
        dataHora: now_(),
        usuarioId: sess ? sess.uid : '',
        login: sess ? sess.login : (detalhes && detalhes.login) || '',
        perfil: sess ? sess.perfil : '',
        acao: acao,
        entidade: entidade || '',
        entidadeId: entidadeId || '',
        detalhes: typeof detalhes === 'string' ? detalhes : JSON.stringify(detalhes || {}),
        resultado: resultado || 'OK',
        hashAnterior: anterior
      };
      e.hash = sha256_(anterior + '|' + canonLog_(e));
      insert_('LOG_AUDITORIA', e);
    });
  } catch (err) {
    console.error('Falha ao gravar auditoria: ' + err);
  }
}

function canonLog_(e) {
  return canon_([['id', e.id], ['dataHora', e.dataHora], ['usuarioId', e.usuarioId], ['login', e.login], ['perfil', e.perfil], ['acao', e.acao], ['entidade', e.entidade], ['entidadeId', e.entidadeId], ['detalhes', e.detalhes], ['resultado', e.resultado]]);
}

function verificarLogs_() {
  limparCache_('LOG_AUDITORIA');
  const l = all_('LOG_AUDITORIA');
  let prev = 'LOG-GENESE';
  const problemas = [];
  l.forEach(function (e, i) {
    if (e.hashAnterior !== prev) problemas.push('Log ' + e.id + ' (linha ' + e.__row + '): encadeamento quebrado.');
    if (sha256_(e.hashAnterior + '|' + canonLog_(e)) !== e.hash) problemas.push('Log ' + e.id + ' (linha ' + e.__row + '): conteúdo alterado.');
    prev = e.hash;
  });
  return { ok: problemas.length === 0, total: l.length, problemas: problemas.slice(0, 50) };
}

function listarLogs_(p, sess) {
  let l = all_('LOG_AUDITORIA').slice();
  if (p.acao) l = l.filter(function (e) { return e.acao === p.acao; });
  if (p.login) { const q = String(p.login).toUpperCase(); l = l.filter(function (e) { return e.login.toUpperCase().indexOf(q) >= 0; }); }
  if (p.de) l = l.filter(function (e) { return e.dataHora.slice(0, 10) >= p.de; });
  if (p.ate) l = l.filter(function (e) { return e.dataHora.slice(0, 10) <= p.ate; });
  if (p.resultado) l = l.filter(function (e) { return e.resultado === p.resultado; });
  l.reverse();
  const acoes = {};
  all_('LOG_AUDITORIA').forEach(function (e) { acoes[e.acao] = 1; });
  return {
    itens: l.slice(0, 300).map(function (e) { return { id: e.id, dataHora: e.dataHora, login: e.login, perfil: e.perfil, acao: e.acao, entidade: e.entidade, entidadeId: e.entidadeId, detalhes: e.detalhes, resultado: e.resultado }; }),
    total: l.length,
    acoes: Object.keys(acoes).sort()
  };
}
