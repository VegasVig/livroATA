function verificarLivro_(livroId) {
  const l = find_('LIVROS_ATA', livroId);
  if (!l) throw new AppError('Livro não encontrado.');
  const problemas = [];
  if (hashGenese_(l) !== l.hashGenese) problemas.push('Termo de abertura do livro foi alterado após a criação.');
  const regs = registrosDoLivro_(l.id);
  const ass = {};
  all_('ASSINATURAS').forEach(function (a) { if (a.livroId === l.id) ass[a.id] = a; });
  let prev = l.hashGenese;
  regs.forEach(function (r, i) {
    const n = 'Registro nº ' + r.numero;
    if (Number(r.numero) !== i + 1) problemas.push(n + ': numeração fora de sequência (esperado ' + (i + 1) + ').');
    const a = ass[r.assinaturaId];
    if (!a) { problemas.push(n + ': assinatura não encontrada.'); prev = r.hashRegistro; return; }
    if (a.registroId !== r.id || a.funcionarioId !== r.funcionarioId) problemas.push(n + ': assinatura não corresponde ao registro.');
    if (sha256_(a.imagem) !== a.hashImagem) problemas.push(n + ': imagem da assinatura foi alterada.');
    if (sha256_(canonRegistro_(r, a.hashImagem)) !== r.hashConteudo) problemas.push(n + ': conteúdo foi alterado após a assinatura.');
    if (r.hashAnterior !== prev) problemas.push(n + ': encadeamento com o registro anterior quebrado.');
    if (sha256_(r.hashAnterior + '|' + r.hashConteudo) !== r.hashRegistro) problemas.push(n + ': hash do registro inválido.');
    prev = r.hashRegistro;
  });
  if (prev !== l.ultimoHash) problemas.push('Último hash do livro não confere com o último registro.');
  if (Number(l.totalRegistros || 0) !== regs.length) problemas.push('Total de registros do livro (' + l.totalRegistros + ') diverge dos registros encontrados (' + regs.length + ').');
  if (l.status === 'ENCERRADO' && hashEncerramento_(l) !== l.hashEncerramento) problemas.push('Termo de encerramento foi alterado.');
  return { livroId: l.id, codigo: l.codigo, ok: problemas.length === 0, totalRegistros: regs.length, ultimoHash: l.ultimoHash, problemas: problemas, verificadoEm: now_() };
}

function verificarIntegridade_(p, sess) {
  limparCache_();
  if (p.livroId) {
    livroComAcesso_(sess, p.livroId);
    const r = verificarLivro_(p.livroId);
    log_(sess, 'VERIFICAR_INTEGRIDADE', 'LIVROS_ATA', p.livroId, { ok: r.ok, problemas: r.problemas.length }, r.ok ? 'OK' : 'ALERTA');
    return r;
  }
  if (sess.perfil !== PERFIL.ADMIN) throw new AppError('Somente o administrador verifica todos os livros.', 'FORBIDDEN');
  const out = verificarTudo_();
  log_(sess, 'VERIFICAR_INTEGRIDADE', 'SISTEMA', '', { ok: out.ok, livros: out.livros.length }, out.ok ? 'OK' : 'ALERTA');
  return out;
}

function verificarTudo_() {
  const livros = all_('LIVROS_ATA').map(function (l) { return verificarLivro_(l.id); });
  const logs = verificarLogs_();
  return { ok: logs.ok && livros.every(function (x) { return x.ok; }), livros: livros, logs: logs, verificadoEm: now_() };
}

function pasta_(caminho) {
  let p = DriveApp.getFolderById(prop_('ROOT_FOLDER_ID'));
  caminho.forEach(function (nome) {
    const it = p.getFoldersByName(nome);
    p = it.hasNext() ? it.next() : p.createFolder(nome);
  });
  return p;
}

function dadosPdf_(p, sess) {
  const base = verLivro_(p, sess);
  const ids = base.registros.map(function (r) { return r.assinaturaId; });
  const imgs = {};
  all_('ASSINATURAS').forEach(function (a) { if (ids.indexOf(a.id) >= 0) imgs[a.id] = a.imagem; });
  base.registros.forEach(function (r) { r.assinatura = imgs[r.assinaturaId] || ''; });
  const posto = find_('POSTOS', base.livro.postoId);
  base.posto = posto ? postoPub_(posto) : null;
  base.verificacao = verificarLivro_(base.livro.id);
  base.geradoEm = now_();
  base.geradoPor = sess.nome + ' (' + sess.login + ')';
  base.app = { nome: APP.NOME, empresa: APP.EMPRESA, slogan: APP.SLOGAN, declaracao: APP.DECLARACAO };
  return base;
}

function salvarPdf_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  const b64 = String(p.base64 || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length < 1000) throw new AppError('PDF inválido.');
  const bytes = Utilities.base64Decode(b64);
  const nome = 'LIVRO_ATA_' + l.codigo + '_' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd_HHmm') + '.pdf';
  const arq = pasta_(['Livros', l.codigo]).createFile(Utilities.newBlob(bytes, 'application/pdf', nome));
  const hash = sha256_(b64);
  update_('LIVROS_ATA', l.id, { pdfFileId: arq.getId(), pdfGeradoEm: now_() });
  log_(sess, 'GERAR_PDF', 'LIVROS_ATA', l.id, { codigo: l.codigo, arquivo: nome, sha256Pdf: hash });
  return { url: arq.getUrl(), nome: nome, sha256: hash };
}

function rotinaDiaria() {
  const r = verificarTudo_();
  const pasta = DriveApp.getFolderById(prop_('BACKUP_FOLDER_ID'));
  const copia = DriveApp.getFileById(prop_('SPREADSHEET_ID')).makeCopy('BACKUP_LIVRO_ATA_' + Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd_HHmm'), pasta);
  const ancora = r.livros.map(function (l) { return l.codigo + ' | registros: ' + l.totalRegistros + ' | último hash: ' + l.ultimoHash + (l.ok ? '' : ' | ALERTA'); }).join('\n');
  const logs = all_('LOG_AUDITORIA');
  const ultimoLog = logs.length ? logs[logs.length - 1].hash : '';
  log_(null, 'ROTINA_DIARIA', 'SISTEMA', copia.getId(), { ok: r.ok, livros: r.livros.length, ancoraLog: ultimoLog }, r.ok ? 'OK' : 'ALERTA');
  const email = prop_('ANCHOR_EMAIL');
  if (email) {
    const problemas = r.livros.filter(function (l) { return !l.ok; }).map(function (l) { return l.codigo + ':\n  - ' + l.problemas.join('\n  - '); }).concat(r.logs.ok ? [] : ['LOG_AUDITORIA:\n  - ' + r.logs.problemas.join('\n  - ')]);
    MailApp.sendEmail(email, (r.ok ? '[OK] ' : '[ALERTA] ') + 'Livro ATA Digital — âncora diária de integridade',
      'Verificação: ' + r.verificadoEm + '\nBackup: ' + copia.getUrl() + '\n\nÂncora dos livros:\n' + ancora + '\n\nÚltimo hash da auditoria: ' + ultimoLog +
      (problemas.length ? '\n\nPROBLEMAS DETECTADOS:\n' + problemas.join('\n') : '') +
      '\n\nGuarde este e-mail: ele permite provar o estado do sistema nesta data, mesmo que a planilha seja alterada depois.');
  }
}
