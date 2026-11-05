function funcionarioAtual_(sess) {
  const f = find_('FUNCIONARIOS', sess.refId);
  if (!f || f.ativo !== '1') throw new AppError('Cadastro de funcionário inativo.', 'FORBIDDEN');
  return f;
}

function livroParaEscrever_(sess, livroId) {
  const l = livroComAcesso_(sess, livroId);
  if (l.status !== 'ABERTO') throw new AppError('Este livro está encerrado e não aceita novos registros.');
  if (csv_(l.autorizados).indexOf(sess.refId) < 0) {
    log_(sess, 'ACESSO_NEGADO', 'LIVROS_ATA', l.id, { motivo: 'não autorizado a escrever' }, 'NEGADO');
    throw new AppError('Você não está autorizado a escrever neste livro.', 'FORBIDDEN');
  }
  return l;
}

function originalRetificavel_(sess, regId, postoId) {
  const o = find_('REGISTROS', regId);
  if (!o || o.status !== 'FINALIZADO') throw new AppError('Registro original não encontrado.');
  if (o.funcionarioId !== sess.refId) throw new AppError('Você só pode retificar registros assinados por você.', 'FORBIDDEN');
  if (o.postoId !== postoId) throw new AppError('A retificação deve ser feita no livro do mesmo posto.');
  return o;
}

function salvarRascunho_(p, sess) {
  const f = funcionarioAtual_(sess);
  const l = livroParaEscrever_(sess, p.livroId);
  const tipo = p.retificaRegistroId ? 'RETIFICACAO' : 'NORMAL';
  const categoria = APP.CATEGORIAS.indexOf(p.categoria) >= 0 ? p.categoria : '';
  if (tipo === 'NORMAL' && !categoria) throw new AppError('Escolha a categoria do registro.');
  const texto = txt_(p.texto, APP.TEXTO_MAX, 'Texto do registro');
  const itens = tipo === 'NORMAL' && categoria === APP.CAT_MATERIAL ? itens_(p.itens) : [];
  let orig = null;
  if (tipo === 'RETIFICACAO') orig = originalRetificavel_(sess, p.retificaRegistroId, l.postoId);
  const lvOrig = orig ? find_('LIVROS_ATA', orig.livroId) : null;
  const dados = {
    livroId: l.id, postoId: l.postoId, tipo: tipo, categoria: tipo === 'RETIFICACAO' ? 'Retificação' : categoria, texto: texto,
    retificaRegistroId: orig ? orig.id : '', retificaNumero: orig ? orig.numero : '', retificaLivroCodigo: lvOrig ? lvOrig.codigo : '',
    itens: itens.length ? JSON.stringify(itens) : '', atualizadoEm: now_()
  };
  if (p.id) {
    const r = find_('REGISTROS', p.id);
    if (!r || r.funcionarioId !== f.id) throw new AppError('Rascunho não encontrado.', 'NOT_FOUND');
    if (r.status !== 'RASCUNHO') throw new AppError('Este registro já foi assinado e não pode ser alterado.', 'IMMUTABLE');
    update_('REGISTROS', r.id, dados);
    return registroPub_(find_('REGISTROS', r.id));
  }
  Object.assign(dados, {
    id: uid_('REG'), numero: '', status: 'RASCUNHO', funcionarioId: f.id, funcionarioNome: f.nome, matricula: cpfMasc_(f.matricula),
    criadoEm: dados.atualizadoEm, finalizadoEm: '', assinaturaId: '', hashConteudo: '', hashAnterior: '', hashRegistro: '', codigoIntegridade: ''
  });
  insert_('REGISTROS', dados);
  log_(sess, 'CRIAR_RASCUNHO', 'REGISTROS', dados.id, { livro: l.codigo, tipo: tipo });
  return registroPub_(dados);
}

function excluirRascunho_(p, sess) {
  const r = find_('REGISTROS', p.id);
  if (!r || r.funcionarioId !== sess.refId || r.status !== 'RASCUNHO') throw new AppError('Rascunho não encontrado.', 'NOT_FOUND');
  remove_('REGISTROS', r.id);
  log_(sess, 'DESCARTAR_RASCUNHO', 'REGISTROS', r.id, {});
  return true;
}

function meusRascunhos_(p, sess) {
  return all_('REGISTROS').filter(function (r) { return r.funcionarioId === sess.refId && r.status === 'RASCUNHO'; })
    .map(function (r) {
      const o = registroPub_(r);
      const l = find_('LIVROS_ATA', r.livroId);
      o.livroCodigo = l ? l.codigo : ''; o.postoNome = l ? l.postoNome : ''; o.livroAberto = !!l && l.status === 'ABERTO';
      return o;
    }).sort(function (a, b) { return b.atualizadoEm.localeCompare(a.atualizadoEm); });
}

function canonRegistro_(r, hashImagem) {
  return canon_([
    ['registroId', r.id], ['livroId', r.livroId], ['postoId', r.postoId], ['numero', r.numero], ['tipo', r.tipo], ['categoria', r.categoria],
    ['texto', r.texto], ['funcionarioId', r.funcionarioId], ['funcionarioNome', r.funcionarioNome], ['matricula', r.matricula],
    ['retificaRegistroId', r.retificaRegistroId], ['finalizadoEm', r.finalizadoEm], ['assinaturaId', r.assinaturaId], ['hashImagem', hashImagem]
  ].concat(r.itens ? [['itens', r.itens]] : []));
}

function finalizarRegistro_(p, sess) {
  if (p.declaracao !== true) throw new AppError('É necessário confirmar a declaração antes de assinar.');
  const img = String(p.assinatura || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(img)) throw new AppError('Assinatura manuscrita inválida.');
  if (img.length < APP.ASSINATURA_MIN_CHARS) throw new AppError('Faça a assinatura manuscrita no quadro antes de confirmar.');
  if (img.length > APP.ASSINATURA_MAX_CHARS) throw new AppError('Assinatura muito grande. Limpe o quadro e assine novamente.');

  limparCache_();
  const u = find_('USUARIOS', sess.uid);
  if (!conferirPin_(u, p.pin)) {
    log_(sess, 'ASSINAR_REGISTRO', 'REGISTROS', p.id, { motivo: 'PIN incorreto' }, 'NEGADO');
    throw new AppError('PIN incorreto. A assinatura não foi registrada.');
  }
  const f = funcionarioAtual_(sess);
  const r = find_('REGISTROS', p.id);
  if (!r || r.funcionarioId !== f.id) throw new AppError('Registro não encontrado.', 'NOT_FOUND');
  if (r.status !== 'RASCUNHO') throw new AppError('Este registro já foi assinado.', 'IMMUTABLE');
  if (!r.texto.trim() && !r.itens) throw new AppError('O registro está vazio.');
  if (p.versao && p.versao !== r.atualizadoEm) throw new AppError('O texto foi alterado em outra tela. Revise novamente antes de assinar.');
  const l = livroParaEscrever_(sess, r.livroId);
  if (csv_(f.postoIds).indexOf(l.postoId) < 0) throw new AppError('Você não está mais vinculado a este posto.', 'FORBIDDEN');

  const finalizados = registrosDoLivro_(l.id);
  const total = Number(l.totalRegistros || 0);
  if (finalizados.length !== total) {
    log_(sess, 'ALERTA_INTEGRIDADE', 'LIVROS_ATA', l.id, { esperado: total, encontrado: finalizados.length }, 'ERRO');
    throw new AppError('Inconsistência detectada no livro. A gravação foi bloqueada e o administrador foi notificado no log.', 'INTEGRITY');
  }
  if (total > 0 && finalizados[total - 1].hashRegistro !== l.ultimoHash) {
    log_(sess, 'ALERTA_INTEGRIDADE', 'LIVROS_ATA', l.id, { motivo: 'último hash divergente' }, 'ERRO');
    throw new AppError('Inconsistência detectada no encadeamento do livro. Gravação bloqueada.', 'INTEGRITY');
  }

  const ts = now_();
  const hashImagem = sha256_(img);
  const reg = Object.assign({}, r, { numero: String(total + 1), finalizadoEm: ts, assinaturaId: uid_('ASS') });
  const hashConteudo = sha256_(canonRegistro_(reg, hashImagem));
  const hashRegistro = sha256_(l.ultimoHash + '|' + hashConteudo);
  const codigo = 'VG-' + hashRegistro.slice(0, 4).toUpperCase() + '-' + hashRegistro.slice(4, 8).toUpperCase() + '-' + hashRegistro.slice(8, 12).toUpperCase();

  let arquivoId = '';
  try {
    const pasta = pasta_(['Assinaturas', l.codigo]);
    const blob = Utilities.newBlob(Utilities.base64Decode(img.split(',')[1]), 'image/png', l.codigo + '_R' + pad_(reg.numero, 4) + '_' + reg.assinaturaId + '.png');
    arquivoId = pasta.createFile(blob).getId();
  } catch (e) { console.error('Cópia da assinatura no Drive falhou: ' + e); }

  insert_('ASSINATURAS', {
    id: reg.assinaturaId, registroId: r.id, livroId: l.id, funcionarioId: f.id, funcionarioNome: f.nome, matricula: cpfMasc_(f.matricula),
    metodo: 'PIN+MANUSCRITA', imagem: img, arquivoId: arquivoId, hashImagem: hashImagem, declaracao: APP.DECLARACAO, assinadoEm: ts,
    dispositivo: String(p.dispositivo || '').slice(0, 250)
  });
  update_('REGISTROS', r.id, {
    numero: reg.numero, status: 'FINALIZADO', finalizadoEm: ts, assinaturaId: reg.assinaturaId,
    hashConteudo: hashConteudo, hashAnterior: l.ultimoHash, hashRegistro: hashRegistro, codigoIntegridade: codigo, atualizadoEm: ts
  });
  if (r.tipo === 'RETIFICACAO') {
    const o = find_('REGISTROS', r.retificaRegistroId);
    insert_('RETIFICACOES', {
      id: uid_('RET'), registroOriginalId: r.retificaRegistroId, numeroOriginal: o ? o.numero : r.retificaNumero, livroOriginalId: o ? o.livroId : '',
      registroRetificacaoId: r.id, numeroRetificacao: reg.numero, livroId: l.id, funcionarioId: f.id, motivo: r.texto.slice(0, 500), criadoEm: ts
    });
  }
  update_('LIVROS_ATA', l.id, { ultimoHash: hashRegistro, totalRegistros: reg.numero });
  log_(sess, 'ASSINAR_REGISTRO', 'REGISTROS', r.id, { livro: l.codigo, numero: reg.numero, tipo: r.tipo, codigo: codigo, hash: hashRegistro });
  limparCache_();
  return registroPub_(find_('REGISTROS', r.id));
}

function itens_(lista) {
  if (!Array.isArray(lista)) return [];
  const l = lista.filter(function (it) { return it && String(it.descricao || '').trim(); });
  if (l.length > APP.ITENS_MAX) throw new AppError('Máximo de ' + APP.ITENS_MAX + ' itens por registro.');
  return l.map(function (it) {
    const descricao = req_(it.descricao, 80, 'Descrição do item');
    const q = Number(it.qtd);
    if (!Number.isInteger(q) || q < 1 || q > 9999) throw new AppError('Quantidade inválida no item "' + descricao + '".');
    return { qtd: String(q), descricao: descricao, serie: txt_(it.serie, 40, 'Número de série') };
  });
}

function ultimoMaterial_(p, sess) {
  const l = livroParaEscrever_(sess, p.livroId);
  const regs = all_('REGISTROS').filter(function (r) { return r.status === 'FINALIZADO' && r.postoId === l.postoId && r.categoria === APP.CAT_MATERIAL && r.itens; })
    .sort(function (a, b) { return b.finalizadoEm.localeCompare(a.finalizadoEm); });
  if (!regs.length) return null;
  return { itens: lerItens_(regs[0].itens), finalizadoEm: regs[0].finalizadoEm, funcionarioNome: regs[0].funcionarioNome };
}

function meusRegistros_(p, sess) {
  return all_('REGISTROS').filter(function (r) { return r.funcionarioId === sess.refId && r.status === 'FINALIZADO'; })
    .map(function (r) {
      const o = registroPub_(r);
      const l = find_('LIVROS_ATA', r.livroId);
      o.livroCodigo = l ? l.codigo : ''; o.postoNome = l ? l.postoNome : '';
      return o;
    }).sort(function (a, b) { return b.finalizadoEm.localeCompare(a.finalizadoEm); }).slice(0, 200);
}

function buscarRegistros_(p, sess) {
  const ids = postosDoUsuario_(sess);
  let l = all_('REGISTROS').filter(function (r) { return r.status === 'FINALIZADO' && ids.indexOf(r.postoId) >= 0; });
  if (p.postoId) l = l.filter(function (r) { return r.postoId === p.postoId; });
  if (p.livroId) l = l.filter(function (r) { return r.livroId === p.livroId; });
  if (p.funcionarioId) l = l.filter(function (r) { return r.funcionarioId === p.funcionarioId; });
  if (p.categoria) l = l.filter(function (r) { return r.categoria === p.categoria; });
  if (p.de) l = l.filter(function (r) { return r.finalizadoEm.slice(0, 10) >= p.de; });
  if (p.ate) l = l.filter(function (r) { return r.finalizadoEm.slice(0, 10) <= p.ate; });
  if (p.texto) { const q = norm_(p.texto).toLowerCase(); l = l.filter(function (r) { return (r.texto + ' ' + r.itens).toLowerCase().indexOf(q) >= 0; }); }
  l.sort(function (a, b) { return b.finalizadoEm.localeCompare(a.finalizadoEm); });
  log_(sess, 'CONSULTAR_REGISTROS', 'REGISTROS', '', { filtros: p, resultados: l.length });
  return {
    total: l.length,
    itens: l.slice(0, 200).map(function (r) {
      const o = registroPub_(r);
      const lv = find_('LIVROS_ATA', r.livroId);
      o.livroCodigo = lv ? lv.codigo : ''; o.postoNome = lv ? lv.postoNome : '';
      return o;
    })
  };
}
