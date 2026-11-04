function inicio_(p, sess) {
  if (sess.perfil === PERFIL.FUNCIONARIO) {
    const meus = all_('REGISTROS').filter(function (r) { return r.funcionarioId === sess.refId; });
    return {
      perfil: sess.perfil,
      livros: listarLivros_({ paraEscrever: true }, sess),
      rascunhos: meus.filter(function (r) { return r.status === 'RASCUNHO'; }).length,
      assinados: meus.filter(function (r) { return r.status === 'FINALIZADO'; }).length,
      postos: listarPostos_({}, sess)
    };
  }
  const ids = postosDoUsuario_(sess);
  const postoIds = p.postoId ? ids.filter(function (x) { return x === p.postoId; }) : ids;
  let livros = all_('LIVROS_ATA').filter(function (l) { return postoIds.indexOf(l.postoId) >= 0; });
  let regs = all_('REGISTROS').filter(function (r) { return r.status === 'FINALIZADO' && postoIds.indexOf(r.postoId) >= 0; });
  if (p.livroId) { livros = livros.filter(function (l) { return l.id === p.livroId; }); regs = regs.filter(function (r) { return r.livroId === p.livroId; }); }
  if (p.funcionarioId) regs = regs.filter(function (r) { return r.funcionarioId === p.funcionarioId; });
  if (p.de) regs = regs.filter(function (r) { return r.finalizadoEm.slice(0, 10) >= p.de; });
  if (p.ate) regs = regs.filter(function (r) { return r.finalizadoEm.slice(0, 10) <= p.ate; });
  const funcs = all_('FUNCIONARIOS').filter(function (f) { return f.ativo === '1' && csv_(f.postoIds).some(function (x) { return postoIds.indexOf(x) >= 0; }); });
  const pub = livros.map(livroPub_);
  const porCategoria = {};
  regs.forEach(function (r) { porCategoria[r.categoria || 'Sem categoria'] = (porCategoria[r.categoria || 'Sem categoria'] || 0) + 1; });
  const livroCod = {};
  livros.forEach(function (l) { livroCod[l.id] = l; });
  return {
    perfil: sess.perfil,
    totais: {
      postos: postoIds.length,
      livrosAbertos: pub.filter(function (l) { return l.status === 'ABERTO'; }).length,
      livrosEncerrados: pub.filter(function (l) { return l.status === 'ENCERRADO'; }).length,
      registros: regs.length,
      funcionarios: funcs.length,
      aguardandoEncerramento: pub.filter(function (l) { return l.aguardandoEncerramento; }).length
    },
    porCategoria: porCategoria,
    aguardando: pub.filter(function (l) { return l.aguardandoEncerramento; }),
    ultimos: regs.sort(function (a, b) { return b.finalizadoEm.localeCompare(a.finalizadoEm); }).slice(0, 12).map(function (r) {
      const l = livroCod[r.livroId];
      return { id: r.id, livroId: r.livroId, numero: Number(r.numero), categoria: r.categoria, tipo: r.tipo, funcionarioNome: r.funcionarioNome, finalizadoEm: r.finalizadoEm, livroCodigo: l ? l.codigo : '', postoNome: l ? l.postoNome : '' };
    })
  };
}

function opcoes_(p, sess) {
  return {
    postos: listarPostos_({}, sess),
    funcionarios: sess.perfil === PERFIL.FUNCIONARIO ? [] : listarFuncionarios_({}, sess),
    livros: listarLivros_({}, sess).map(function (l) { return { id: l.id, codigo: l.codigo, postoId: l.postoId, postoNome: l.postoNome, status: l.status }; }),
    categorias: APP.CATEGORIAS,
    declaracao: APP.DECLARACAO
  };
}
