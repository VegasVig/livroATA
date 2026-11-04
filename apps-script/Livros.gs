function hashGenese_(l) {
  return sha256_('GENESE|' + canon_([['livroId', l.id], ['postoId', l.postoId], ['postoNome', l.postoNome], ['numero', l.numero], ['codigo', l.codigo], ['supervisorId', l.supervisorId], ['supervisorNome', l.supervisorNome], ['dataAbertura', l.dataAbertura], ['abertoEm', l.abertoEm]]));
}

function hashEncerramento_(l) {
  return sha256_(l.ultimoHash + '|ENCERRAMENTO|' + canon_([['livroId', l.id], ['totalRegistros', l.totalRegistros], ['encerradoEm', l.encerradoEm], ['encerradoPorId', l.encerradoPorId], ['encerradoPorNome', l.encerradoPorNome], ['obsEncerramento', l.obsEncerramento]]));
}

function livroPub_(l) {
  const autorizados = csv_(l.autorizados).map(function (id) {
    const f = find_('FUNCIONARIOS', id);
    return f ? { id: f.id, nome: f.nome, matricula: f.matricula, ativo: f.ativo === '1' } : { id: id, nome: '(removido)', matricula: '', ativo: false };
  });
  const dias = Math.floor((Date.now() - msDe_(l.abertoEm)) / 86400000);
  return {
    id: l.id, postoId: l.postoId, postoNome: l.postoNome, numero: Number(l.numero), codigo: l.codigo,
    supervisorId: l.supervisorId, supervisorNome: l.supervisorNome, dataAbertura: l.dataAbertura, abertoEm: l.abertoEm,
    autorizados: autorizados, status: l.status, totalRegistros: Number(l.totalRegistros || 0),
    encerradoEm: l.encerradoEm, encerradoPorNome: l.encerradoPorNome, obsEncerramento: l.obsEncerramento,
    hashGenese: l.hashGenese, ultimoHash: l.ultimoHash, hashEncerramento: l.hashEncerramento,
    pdfUrl: l.pdfFileId ? 'https://drive.google.com/file/d/' + l.pdfFileId + '/view' : '', pdfGeradoEm: l.pdfGeradoEm,
    aguardandoEncerramento: l.status === 'ABERTO' && (dias >= APP.LIVRO_ALERTA_DIAS || Number(l.totalRegistros || 0) >= APP.LIVRO_ALERTA_REGISTROS),
    diasAberto: dias
  };
}

function livroComAcesso_(sess, livroId) {
  const l = find_('LIVROS_ATA', livroId);
  if (!l) throw new AppError('Livro não encontrado.', 'NOT_FOUND');
  assertPosto_(sess, l.postoId);
  return l;
}

function listarLivros_(p, sess) {
  const ids = postosDoUsuario_(sess);
  let l = all_('LIVROS_ATA').filter(function (x) { return ids.indexOf(x.postoId) >= 0; });
  if (p.postoId) l = l.filter(function (x) { return x.postoId === p.postoId; });
  if (p.status) l = l.filter(function (x) { return x.status === p.status; });
  if (sess.perfil === PERFIL.FUNCIONARIO && p.paraEscrever) l = l.filter(function (x) { return x.status === 'ABERTO' && csv_(x.autorizados).indexOf(sess.refId) >= 0; });
  return l.map(livroPub_).sort(function (a, b) { return b.abertoEm.localeCompare(a.abertoEm); });
}

function validarAutorizados_(postoId, ids) {
  const l = (Array.isArray(ids) ? ids : csv_(ids)).filter(function (id, i, a) { return id && a.indexOf(id) === i; });
  if (!l.length) throw new AppError('Selecione ao menos um funcionário autorizado.');
  l.forEach(function (id) {
    const f = find_('FUNCIONARIOS', id);
    if (!f || f.ativo !== '1') throw new AppError('Funcionário inválido ou inativo.');
    if (csv_(f.postoIds).indexOf(postoId) < 0) throw new AppError(f.nome + ' não está vinculado a este posto.');
  });
  return l;
}

function criarLivro_(p, sess) {
  assertPosto_(sess, p.postoId);
  const posto = find_('POSTOS', p.postoId);
  if (!posto || posto.ativo !== '1') throw new AppError('Posto inativo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.dataAbertura || ''))) throw new AppError('Informe a data de abertura.');
  const autorizados = validarAutorizados_(posto.id, p.autorizados);
  limparCache_('LIVROS_ATA');
  const livros = all_('LIVROS_ATA').filter(function (l) { return l.postoId === posto.id; });
  if (livros.some(function (l) { return l.status === 'ABERTO'; })) throw new AppError('Este posto já tem um livro aberto. Encerre-o antes de abrir outro.');
  const numero = livros.reduce(function (m, l) { return Math.max(m, Number(l.numero)); }, 0) + 1;
  const sup = find_('SUPERVISORES', sess.refId);
  const l = {
    id: uid_('LIV'), postoId: posto.id, postoNome: txt_(p.postoNome, 120, 'Nome do posto') || posto.nome, numero: String(numero),
    codigo: posto.codigo + '-L' + pad_(numero, 3), supervisorId: sup ? sup.id : sess.uid, supervisorNome: sup ? sup.nome : sess.nome,
    dataAbertura: p.dataAbertura, abertoEm: now_(), autorizados: autorizados.join(','), status: 'ABERTO', totalRegistros: '0',
    encerradoEm: '', encerradoPorId: '', encerradoPorNome: '', obsEncerramento: '', hashEncerramento: '', pdfFileId: '', pdfGeradoEm: ''
  };
  l.hashGenese = hashGenese_(l);
  l.ultimoHash = l.hashGenese;
  insert_('LIVROS_ATA', l);
  log_(sess, 'ABRIR_LIVRO', 'LIVROS_ATA', l.id, { codigo: l.codigo, posto: l.postoNome, autorizados: autorizados });
  return livroPub_(l);
}

function atualizarAutorizados_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  if (l.status !== 'ABERTO') throw new AppError('Livro encerrado não aceita alterações.');
  const novos = validarAutorizados_(l.postoId, p.autorizados);
  const antes = csv_(l.autorizados);
  update_('LIVROS_ATA', l.id, { autorizados: novos.join(',') });
  log_(sess, 'ALTERAR_AUTORIZADOS', 'LIVROS_ATA', l.id, {
    incluidos: novos.filter(function (x) { return antes.indexOf(x) < 0; }),
    removidos: antes.filter(function (x) { return novos.indexOf(x) < 0; })
  });
  return livroPub_(find_('LIVROS_ATA', l.id));
}

function encerrarLivro_(p, sess) {
  limparCache_();
  const l = livroComAcesso_(sess, p.livroId);
  if (l.status !== 'ABERTO') throw new AppError('Este livro já está encerrado.');
  const rasc = all_('REGISTROS').filter(function (r) { return r.livroId === l.id && r.status === 'RASCUNHO'; });
  if (rasc.length && !p.forcar) return { pendente: true, rascunhos: rasc.length };
  const sup = find_('SUPERVISORES', sess.refId);
  const patch = {
    status: 'ENCERRADO', encerradoEm: now_(), encerradoPorId: sup ? sup.id : sess.uid,
    encerradoPorNome: sup ? sup.nome : sess.nome, obsEncerramento: txt_(p.obs, 1000, 'Observação de encerramento')
  };
  const base = Object.assign({}, l, patch);
  patch.hashEncerramento = hashEncerramento_(base);
  update_('LIVROS_ATA', l.id, patch);
  log_(sess, 'ENCERRAR_LIVRO', 'LIVROS_ATA', l.id, { codigo: l.codigo, totalRegistros: l.totalRegistros, rascunhosDescartaveis: rasc.length });
  return { livro: livroPub_(find_('LIVROS_ATA', l.id)) };
}

function registroPub_(r) {
  return {
    id: r.id, livroId: r.livroId, postoId: r.postoId, numero: Number(r.numero || 0), status: r.status, tipo: r.tipo, categoria: r.categoria,
    texto: r.texto, funcionarioId: r.funcionarioId, funcionarioNome: r.funcionarioNome, matricula: r.matricula,
    retificaRegistroId: r.retificaRegistroId, retificaNumero: r.retificaNumero, retificaLivroCodigo: r.retificaLivroCodigo,
    criadoEm: r.criadoEm, atualizadoEm: r.atualizadoEm, finalizadoEm: r.finalizadoEm, assinaturaId: r.assinaturaId,
    hashRegistro: r.hashRegistro, hashAnterior: r.hashAnterior, codigoIntegridade: r.codigoIntegridade
  };
}

function registrosDoLivro_(livroId) {
  return all_('REGISTROS').filter(function (r) { return r.livroId === livroId && r.status === 'FINALIZADO'; })
    .sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
}

function retificadoPor_(registroIds) {
  const m = {};
  all_('RETIFICACOES').forEach(function (x) {
    if (registroIds.indexOf(x.registroOriginalId) >= 0) {
      const r = find_('REGISTROS', x.registroRetificacaoId);
      const lv = r ? find_('LIVROS_ATA', r.livroId) : null;
      (m[x.registroOriginalId] = m[x.registroOriginalId] || []).push({ numero: x.numeroRetificacao, livroCodigo: lv ? lv.codigo : '', em: x.criadoEm });
    }
  });
  return m;
}

function verLivro_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  const regs = registrosDoLivro_(l.id);
  const ret = retificadoPor_(regs.map(function (r) { return r.id; }));
  if (sess.perfil !== PERFIL.FUNCIONARIO) log_(sess, 'CONSULTAR_LIVRO', 'LIVROS_ATA', l.id, { codigo: l.codigo });
  return {
    livro: livroPub_(l),
    registros: regs.map(function (r) { const o = registroPub_(r); o.retificadoPor = ret[r.id] || []; return o; }),
    podeEscrever: sess.perfil === PERFIL.FUNCIONARIO && l.status === 'ABERTO' && csv_(l.autorizados).indexOf(sess.refId) >= 0,
    podeGerir: sess.perfil === PERFIL.SUPERVISOR && l.status === 'ABERTO'
  };
}

function assinaturas_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  const ids = (p.ids || []).slice(0, 60);
  const out = {};
  all_('ASSINATURAS').forEach(function (a) { if (a.livroId === l.id && ids.indexOf(a.id) >= 0) out[a.id] = a.imagem; });
  return out;
}

function statusAssinaturas_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  const regs = all_('REGISTROS').filter(function (r) { return r.livroId === l.id; });
  const linha = function (f, autorizado) {
    const meus = regs.filter(function (r) { return r.funcionarioId === f.id; });
    const fin = meus.filter(function (r) { return r.status === 'FINALIZADO'; });
    return {
      id: f.id, nome: f.nome, matricula: f.matricula, autorizado: autorizado,
      assinados: fin.length, rascunhos: meus.length - fin.length,
      ultimoEm: fin.reduce(function (m, r) { return r.finalizadoEm > m ? r.finalizadoEm : m; }, '')
    };
  };
  const aut = csv_(l.autorizados);
  const doPosto = all_('FUNCIONARIOS').filter(function (f) { return f.ativo === '1' && csv_(f.postoIds).indexOf(l.postoId) >= 0; });
  return {
    livro: livroPub_(l),
    autorizados: aut.map(function (id) { return find_('FUNCIONARIOS', id); }).filter(Boolean).map(function (f) { return linha(f, true); }),
    naoAutorizados: doPosto.filter(function (f) { return aut.indexOf(f.id) < 0; }).map(function (f) { return { id: f.id, nome: f.nome, matricula: f.matricula }; })
  };
}
