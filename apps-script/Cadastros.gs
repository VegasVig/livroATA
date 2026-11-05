function postosDoUsuario_(sess) {
  if (sess.perfil === PERFIL.ADMIN) return all_('POSTOS').map(function (p) { return p.id; });
  if (sess.perfil === PERFIL.SUPERVISOR) { const s = find_('SUPERVISORES', sess.refId); return s ? csv_(s.postoIds) : []; }
  const f = find_('FUNCIONARIOS', sess.refId);
  return f ? csv_(f.postoIds) : [];
}

function assertPosto_(sess, postoId) {
  if (postosDoUsuario_(sess).indexOf(postoId) < 0) {
    log_(sess, 'ACESSO_NEGADO', 'POSTOS', postoId, {}, 'NEGADO');
    throw new AppError('Você não tem acesso a este posto.', 'FORBIDDEN');
  }
}

function postoPub_(p) { return { id: p.id, codigo: p.codigo, nome: p.nome, cliente: p.cliente, endereco: p.endereco, ativo: p.ativo === '1', tipo: p.tipo || '', tipoNome: APP.TIPOS_POSTO[p.tipo] || 'Não informado' }; }

function listarPostos_(p, sess) {
  const ids = postosDoUsuario_(sess);
  return all_('POSTOS').filter(function (x) { return ids.indexOf(x.id) >= 0; }).map(postoPub_).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
}

function salvarPosto_(p, sess) {
  const codigo = req_(p.codigo, 20, 'Código do posto').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!APP.TIPOS_POSTO[p.tipo]) throw new AppError('Informe se o posto é armado ou não armado.');
  const dados = { tipo: p.tipo, codigo: codigo, nome: req_(p.nome, 120, 'Nome do posto'), cliente: txt_(p.cliente, 120, 'Cliente'), endereco: txt_(p.endereco, 200, 'Endereço'), ativo: p.ativo === false ? '0' : '1', atualizadoEm: now_() };
  const dup = findBy_('POSTOS', 'codigo', codigo);
  if (dup && dup.id !== p.id) throw new AppError('Já existe um posto com o código ' + codigo + '.');
  if (p.id) {
    const ant = find_('POSTOS', p.id);
    if (!ant) throw new AppError('Posto não encontrado.');
    if (ant.codigo !== codigo && all_('LIVROS_ATA').some(function (l) { return l.postoId === p.id; })) throw new AppError('O código não pode mudar depois que o posto já tem livros.');
    update_('POSTOS', p.id, dados);
    log_(sess, 'EDITAR_POSTO', 'POSTOS', p.id, { antes: postoPub_(ant), depois: dados });
    return postoPub_(find_('POSTOS', p.id));
  }
  dados.id = uid_('PST'); dados.criadoEm = dados.atualizadoEm;
  insert_('POSTOS', dados);
  log_(sess, 'CRIAR_POSTO', 'POSTOS', dados.id, dados);
  return postoPub_(dados);
}

function validarPostos_(ids) {
  const l = (Array.isArray(ids) ? ids : csv_(ids)).filter(function (id, i, a) { return a.indexOf(id) === i; });
  l.forEach(function (id) { if (!find_('POSTOS', id)) throw new AppError('Posto inválido: ' + id); });
  return l;
}

function usuarioDe_(refId) { return findBy_('USUARIOS', 'refId', refId); }

function pessoaPub_(x, tipo) {
  const u = usuarioDe_(x.id);
  return {
    id: x.id, matricula: x.matricula, cpf: cpfFmt_(x.matricula), nome: x.nome, email: x.email || '', postoIds: csv_(x.postoIds), ativo: x.ativo === '1', tipo: tipo,
    bloqueado: !!(u && u.bloqueadoAte && msDe_(u.bloqueadoAte) > Date.now()), trocarPin: !!(u && u.trocarPin === '1'), ultimoAcesso: u ? u.ultimoAcesso : ''
  };
}

function listarFuncionarios_(p, sess) {
  const ids = postosDoUsuario_(sess);
  return all_('FUNCIONARIOS').filter(function (f) {
    if (sess.perfil === PERFIL.ADMIN) return true;
    return csv_(f.postoIds).some(function (x) { return ids.indexOf(x) >= 0; });
  }).map(function (f) { return pessoaPub_(f, 'FUNCIONARIO'); }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
}

function listarSupervisores_() {
  return all_('SUPERVISORES').map(function (s) { return pessoaPub_(s, 'SUPERVISOR'); }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
}

function listarAdmins_() {
  return all_('USUARIOS').filter(function (u) { return u.perfil === PERFIL.ADMIN; }).map(function (u) {
    return { id: u.id, matricula: u.login, nome: u.nome, ativo: u.ativo === '1', tipo: 'ADMIN', bloqueado: !!(u.bloqueadoAte && msDe_(u.bloqueadoAte) > Date.now()), ultimoAcesso: u.ultimoAcesso, postoIds: [] };
  });
}

function assertFuncionarioGerido_(sess, funcId) {
  if (sess.perfil === PERFIL.ADMIN) return;
  const f = find_('FUNCIONARIOS', funcId);
  const meus = postosDoUsuario_(sess);
  if (!f || !csv_(f.postoIds).some(function (x) { return meus.indexOf(x) >= 0; })) {
    log_(sess, 'ACESSO_NEGADO', 'FUNCIONARIOS', funcId, {}, 'NEGADO');
    throw new AppError('Este funcionário não pertence aos seus postos.', 'FORBIDDEN');
  }
}

function salvarPessoa_(p, sess, aba, perfil) {
  const cpf = cpfDigitos_(p.cpf);
  if (!cpfValido_(cpf)) throw new AppError('CPF inválido. Confira os números.');
  const nome = req_(p.nome, 120, 'Nome completo');
  let postoIds = validarPostos_(p.postoIds || []);
  const geridos = sess.perfil === PERFIL.ADMIN ? null : postosDoUsuario_(sess);
  if (geridos) {
    if (!postoIds.length) throw new AppError('Selecione ao menos um posto.');
    if (postoIds.some(function (x) { return geridos.indexOf(x) < 0; })) throw new AppError('Você só pode vincular funcionários aos seus postos.', 'FORBIDDEN');
  }
  const t = now_();
  const dupU = findBy_('USUARIOS', 'login', cpf);
  if (p.id) {
    const ant = find_(aba, p.id);
    if (!ant) throw new AppError('Cadastro não encontrado.');
    if (geridos) {
      assertFuncionarioGerido_(sess, p.id);
      postoIds = csv_(ant.postoIds).filter(function (x) { return geridos.indexOf(x) < 0; }).concat(postoIds);
    }
    const u = usuarioDe_(p.id);
    if (dupU && (!u || dupU.id !== u.id)) throw new AppError('O CPF ' + cpfFmt_(cpf) + ' já está cadastrado.');
    const dados = { matricula: cpf, nome: nome, postoIds: postoIds.join(','), atualizadoEm: t };
    if (aba === 'SUPERVISORES') dados.email = txt_(p.email, 120, 'E-mail');
    update_(aba, p.id, dados);
    if (u) update_('USUARIOS', u.id, { login: cpf, nome: nome, atualizadoEm: t });
    log_(sess, 'EDITAR_' + perfil, aba, p.id, { antes: { cpf: cpfMasc_(ant.matricula), nome: ant.nome, postoIds: ant.postoIds }, depois: { cpf: cpfMasc_(cpf), nome: nome, postoIds: dados.postoIds } });
    return { pessoa: pessoaPub_(find_(aba, p.id), perfil) };
  }
  if (dupU) throw new AppError('O CPF ' + cpfFmt_(cpf) + ' já está cadastrado.');
  const pin = p.pin ? validarPinFormato_(p.pin) : pinAleatorio_();
  const dados = { id: uid_(perfil === PERFIL.SUPERVISOR ? 'SUP' : 'FUN'), matricula: cpf, nome: nome, postoIds: postoIds.join(','), ativo: '1', criadoEm: t, atualizadoEm: t };
  if (aba === 'SUPERVISORES') dados.email = txt_(p.email, 120, 'E-mail');
  insert_(aba, dados);
  criarUsuario_(cpf, nome, perfil, dados.id, pin);
  log_(sess, 'CRIAR_' + perfil, aba, dados.id, { cpf: cpfMasc_(cpf), nome: nome, postoIds: dados.postoIds });
  return { pessoa: pessoaPub_(dados, perfil), pinInicial: pin, login: cpfFmt_(cpf) };
}

function salvarFuncionario_(p, sess) { return salvarPessoa_(p, sess, 'FUNCIONARIOS', PERFIL.FUNCIONARIO); }
function salvarSupervisor_(p, sess) { return salvarPessoa_(p, sess, 'SUPERVISORES', PERFIL.SUPERVISOR); }

function salvarAdmin_(p, sess) {
  const login = req_(p.matricula, 30, 'Matrícula').toUpperCase().replace(/\s+/g, '');
  const nome = req_(p.nome, 120, 'Nome completo');
  if (p.id) {
    const u = find_('USUARIOS', p.id);
    if (!u || u.perfil !== PERFIL.ADMIN) throw new AppError('Administrador não encontrado.');
    const dup = findBy_('USUARIOS', 'login', login);
    if (dup && dup.id !== u.id) throw new AppError('A matrícula ' + login + ' já está em uso.');
    update_('USUARIOS', u.id, { login: login, nome: nome, atualizadoEm: now_() });
    log_(sess, 'EDITAR_ADMIN', 'USUARIOS', u.id, { login: login, nome: nome });
    return { pessoa: { id: u.id } };
  }
  const pin = p.pin ? validarPinFormato_(p.pin) : pinAleatorio_();
  const u = criarUsuario_(login, nome, PERFIL.ADMIN, '', pin);
  log_(sess, 'CRIAR_ADMIN', 'USUARIOS', u.id, { login: login, nome: nome });
  return { pessoa: { id: u.id }, pinInicial: pin };
}

function usuarioAlvo_(p, sess) {
  if (sess && sess.perfil === PERFIL.SUPERVISOR) {
    if (p.tipo !== 'FUNCIONARIO') throw new AppError('Permissão negada.', 'FORBIDDEN');
    assertFuncionarioGerido_(sess, p.id);
  }
  const u = p.tipo === 'ADMIN' ? find_('USUARIOS', p.id) : usuarioDe_(p.id);
  if (!u) throw new AppError('Acesso não encontrado.');
  return u;
}

function redefinirPin_(p, sess) {
  const u = usuarioAlvo_(p, sess);
  const pin = pinAleatorio_();
  const salt = Utilities.getUuid();
  update_('USUARIOS', u.id, { pinHash: hashPin_(pin, salt), salt: salt, trocarPin: '1', tentativas: '0', bloqueadoAte: '', atualizadoEm: now_() });
  log_(sess, 'REDEFINIR_PIN', 'USUARIOS', u.id, { usuario: u.nome });
  return { pinInicial: pin, login: /^\d{11}$/.test(u.login) ? cpfFmt_(u.login) : u.login };
}

function definirStatusAcesso_(p, sess) {
  const u = usuarioAlvo_(p, sess);
  if (u.id === sess.uid) throw new AppError('Você não pode alterar o próprio acesso.');
  const t = now_();
  if (p.acao === 'desbloquear') {
    update_('USUARIOS', u.id, { tentativas: '0', bloqueadoAte: '', atualizadoEm: t });
    log_(sess, 'DESBLOQUEAR_ACESSO', 'USUARIOS', u.id, { usuario: u.nome });
    return true;
  }
  const ativo = p.acao === 'ativar' ? '1' : '0';
  if (ativo === '0' && u.perfil === PERFIL.ADMIN && all_('USUARIOS').filter(function (x) { return x.perfil === PERFIL.ADMIN && x.ativo === '1'; }).length <= 1) throw new AppError('Precisa existir ao menos um administrador ativo.');
  update_('USUARIOS', u.id, { ativo: ativo, atualizadoEm: t });
  if (u.perfil === PERFIL.FUNCIONARIO) update_('FUNCIONARIOS', u.refId, { ativo: ativo, atualizadoEm: t });
  if (u.perfil === PERFIL.SUPERVISOR) update_('SUPERVISORES', u.refId, { ativo: ativo, atualizadoEm: t });
  log_(sess, ativo === '1' ? 'ATIVAR_ACESSO' : 'DESATIVAR_ACESSO', 'USUARIOS', u.id, { usuario: u.nome });
  return true;
}
