function pepper_() {
  const p = prop_('PIN_PEPPER');
  if (!p) throw new AppError('Sistema não configurado.', 'SETUP');
  return p;
}

function hashPin_(pin, salt) {
  let h = sha256_(salt + '|' + pin + '|' + pepper_());
  for (let i = 0; i < APP.PIN_ITER; i++) h = sha256_(h + '|' + salt);
  return h;
}

function validarPinFormato_(pin) {
  const p = String(pin || '');
  if (!/^\d+$/.test(p) || p.length < APP.PIN_MIN || p.length > APP.PIN_MAX) throw new AppError('O PIN deve ter de ' + APP.PIN_MIN + ' a ' + APP.PIN_MAX + ' números.');
  if (/^(\d)\1+$/.test(p) || '0123456789'.indexOf(p) >= 0 || '9876543210'.indexOf(p) >= 0) throw new AppError('PIN muito fácil. Evite números repetidos ou em sequência.');
  return p;
}

function pinAleatorio_() {
  let p;
  do { p = String(Math.floor(100000 + Math.random() * 900000)); } while (/^(\d)\1+$/.test(p));
  return p;
}

function criarUsuario_(login, nome, perfil, refId, pin) {
  login = String(login).trim().toUpperCase();
  if (findBy_('USUARIOS', 'login', login)) throw new AppError('Já existe um acesso com a matrícula ' + login + '.');
  const salt = Utilities.getUuid();
  const t = now_();
  return insert_('USUARIOS', {
    id: uid_('USR'), login: login, nome: nome, perfil: perfil, refId: refId || '',
    pinHash: hashPin_(pin, salt), salt: salt, ativo: '1', trocarPin: '1', tentativas: '0',
    bloqueadoAte: '', ultimoAcesso: '', credencialBiometrica: '', criadoEm: t, atualizadoEm: t
  });
}

function conferirPin_(u, pin) {
  if (u.bloqueadoAte && msDe_(u.bloqueadoAte) > Date.now()) {
    throw new AppError('Acesso bloqueado temporariamente por tentativas incorretas. Aguarde ' + APP.BLOQUEIO_MIN + ' minutos ou procure o administrador.', 'LOCKED');
  }
  const ok = hashPin_(String(pin || ''), u.salt) === u.pinHash;
  if (ok) {
    if (u.tentativas !== '0' || u.bloqueadoAte) update_('USUARIOS', u.id, { tentativas: '0', bloqueadoAte: '' });
    return true;
  }
  const t = Number(u.tentativas || 0) + 1;
  const patch = { tentativas: String(t) };
  if (t >= APP.MAX_TENTATIVAS) {
    patch.tentativas = '0';
    patch.bloqueadoAte = Utilities.formatDate(new Date(Date.now() + APP.BLOQUEIO_MIN * 60000), APP.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  update_('USUARIOS', u.id, patch);
  return false;
}

function vinculoAtivo_(u) {
  if (u.ativo !== '1') return false;
  if (u.perfil === PERFIL.FUNCIONARIO) { const f = find_('FUNCIONARIOS', u.refId); return !!f && f.ativo === '1'; }
  if (u.perfil === PERFIL.SUPERVISOR) { const s = find_('SUPERVISORES', u.refId); return !!s && s.ativo === '1'; }
  return true;
}

function login_(p) {
  let login = String(p.login || '').trim().toUpperCase();
  if (/^[\d.\-\s]+$/.test(login)) login = cpfDigitos_(login);
  const pin = String(p.pin || '');
  if (!login || !pin) throw new AppError('Informe matrícula e PIN.');
  return withLock_(function () {
    const u = findBy_('USUARIOS', 'login', login);
    if (!u) { log_(null, 'LOGIN', 'USUARIOS', '', { login: login, motivo: 'matrícula inexistente' }, 'NEGADO'); throw new AppError('Matrícula ou PIN incorretos.', 'AUTH'); }
    if (!vinculoAtivo_(u)) { log_(null, 'LOGIN', 'USUARIOS', u.id, { login: login, motivo: 'acesso desativado' }, 'NEGADO'); throw new AppError('Acesso desativado. Procure o administrador.', 'AUTH'); }
    let ok;
    try { ok = conferirPin_(u, pin); } catch (e) { log_(null, 'LOGIN', 'USUARIOS', u.id, { login: login, motivo: 'bloqueado' }, 'NEGADO'); throw e; }
    if (!ok) { log_(null, 'LOGIN', 'USUARIOS', u.id, { login: login, motivo: 'PIN incorreto' }, 'NEGADO'); throw new AppError('Matrícula ou PIN incorretos.', 'AUTH'); }
    update_('USUARIOS', u.id, { ultimoAcesso: now_() });
    const sess = novaSessao_(u);
    log_(sess, 'LOGIN', 'USUARIOS', u.id, { dispositivo: String(p.dispositivo || '').slice(0, 200) }, 'OK');
    return { token: sess.token, usuario: usuarioPublico_(sess) };
  });
}

function novaSessao_(u) {
  const agora = Date.now();
  const sess = {
    token: Utilities.getUuid() + Utilities.getUuid().replace(/-/g, ''),
    uid: u.id, login: u.login, nome: u.nome, perfil: u.perfil, refId: u.refId,
    trocarPin: u.trocarPin === '1', livros: [], criado: agora, ultimo: agora
  };
  salvarSessao_(sess);
  return sess;
}

function salvarSessao_(sess) {
  CacheService.getScriptCache().put('S_' + sess.token, JSON.stringify(sess), Math.min(21600, APP.SESSAO_INATIVIDADE_MIN * 60 + 60));
}

function sessao_(token) {
  if (!token) throw new AppError('Sessão expirada. Entre novamente.', 'SESSION');
  const raw = CacheService.getScriptCache().get('S_' + token);
  if (!raw) throw new AppError('Sessão expirada. Entre novamente.', 'SESSION');
  const sess = JSON.parse(raw);
  const agora = Date.now();
  if (agora - sess.ultimo > APP.SESSAO_INATIVIDADE_MIN * 60000 || agora - sess.criado > APP.SESSAO_MAX_HORAS * 3600000) {
    encerrarSessao_(token);
    throw new AppError('Sessão expirada. Entre novamente.', 'SESSION');
  }
  const u = find_('USUARIOS', sess.uid);
  if (!u || !vinculoAtivo_(u)) { encerrarSessao_(token); throw new AppError('Acesso desativado.', 'SESSION'); }
  sess.ultimo = agora;
  return sess;
}

function encerrarSessao_(token) { CacheService.getScriptCache().remove('S_' + token); }

function usuarioPublico_(sess) {
  return { nome: sess.nome, login: /^\d{11}$/.test(sess.login) ? cpfMasc_(sess.login) : sess.login, perfil: sess.perfil, trocarPin: sess.trocarPin };
}

function trocarPin_(p, sess) {
  return withLock_(function () {
    const u = find_('USUARIOS', sess.uid);
    if (!conferirPin_(u, p.atual)) { log_(sess, 'TROCAR_PIN', 'USUARIOS', u.id, {}, 'NEGADO'); throw new AppError('PIN atual incorreto.'); }
    const novo = validarPinFormato_(p.novo);
    if (novo === String(p.atual)) throw new AppError('O novo PIN deve ser diferente do atual.');
    const salt = Utilities.getUuid();
    update_('USUARIOS', u.id, { pinHash: hashPin_(novo, salt), salt: salt, trocarPin: '0', atualizadoEm: now_() });
    sess.trocarPin = false;
    log_(sess, 'TROCAR_PIN', 'USUARIOS', u.id, {}, 'OK');
    return usuarioPublico_(sess);
  });
}

function desbloquearLivro_(p, sess) {
  const l = livroComAcesso_(sess, p.livroId);
  const c = CacheService.getScriptCache();
  const k = 'VC_' + sess.uid;
  const n = Number(c.get(k) || 0);
  if (n >= APP.MAX_TENTATIVAS) throw new AppError('Muitas tentativas. Aguarde ' + APP.BLOQUEIO_MIN + ' minutos.', 'LOCKED');
  if (!l.senhaHash || hashPin_(String(p.senha || ''), l.senhaSalt) !== l.senhaHash) {
    c.put(k, String(n + 1), APP.BLOQUEIO_MIN * 60);
    log_(sess, 'SENHA_LIVRO', 'LIVROS_ATA', l.id, { codigo: l.codigo }, 'NEGADO');
    throw new AppError('Senha do livro incorreta.');
  }
  c.remove(k);
  sess.livros = (sess.livros || []).filter(function (x) { return x !== l.id; }).concat([l.id]);
  log_(sess, 'SENHA_LIVRO', 'LIVROS_ATA', l.id, { codigo: l.codigo }, 'OK');
  return true;
}

function exigeSenhaLivro_(sess, l) {
  if (sess.perfil !== PERFIL.FUNCIONARIO || !l.senhaHash) return;
  if ((sess.livros || []).indexOf(l.id) < 0) throw new AppError('Digite a senha do livro ' + l.codigo + '.', 'CONSULTA');
}
