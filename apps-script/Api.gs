let __rotas = null;

function rotas_() {
  if (__rotas) return __rotas;
  const A = PERFIL.ADMIN, S = PERFIL.SUPERVISOR, F = PERFIL.FUNCIONARIO;
  __rotas = {
  login: { publica: true, fn: login_ },
  info: { publica: true, fn: function () { return { nome: APP.NOME, empresa: APP.EMPRESA, slogan: APP.SLOGAN, versao: APP.VERSAO, configurado: !!prop_('SPREADSHEET_ID') }; } },
  me: { pin: true, fn: function (p, s) { return usuarioPublico_(s); } },
  logout: { pin: true, fn: function (p, s) { encerrarSessao_(s.token); log_(s, 'LOGOUT', 'USUARIOS', s.uid, {}); s.__fim = true; return true; } },
  trocarPin: { pin: true, fn: trocarPin_ },
  desbloquearLivro: { fn: desbloquearLivro_ },
  inicio: { fn: inicio_ },
  opcoes: { fn: opcoes_ },

  listarPostos: { fn: listarPostos_ },
  salvarPosto: { perfis: [A], escrita: true, fn: salvarPosto_ },
  listarFuncionarios: { perfis: [A, S], fn: listarFuncionarios_ },
  salvarFuncionario: { perfis: [A, S], escrita: true, fn: salvarFuncionario_ },
  listarSupervisores: { perfis: [A], fn: listarSupervisores_ },
  salvarSupervisor: { perfis: [A], escrita: true, fn: salvarSupervisor_ },
  listarAdmins: { perfis: [A], fn: listarAdmins_ },
  salvarAdmin: { perfis: [A], escrita: true, fn: salvarAdmin_ },
  redefinirPin: { perfis: [A, S], escrita: true, fn: redefinirPin_ },
  definirStatusAcesso: { perfis: [A, S], escrita: true, fn: definirStatusAcesso_ },

  listarLivros: { fn: listarLivros_ },
  criarLivro: { perfis: [S], escrita: true, fn: criarLivro_ },
  atualizarAutorizados: { perfis: [S], escrita: true, fn: atualizarAutorizados_ },
  encerrarLivro: { perfis: [S], escrita: true, fn: encerrarLivro_ },
  verLivro: { fn: verLivro_ },
  assinaturas: { fn: assinaturas_ },
  alterarSenhaLivro: { perfis: [S], escrita: true, fn: alterarSenhaLivro_ },
  ultimoMaterial: { perfis: [F], fn: ultimoMaterial_ },
  statusAssinaturas: { perfis: [A, S], fn: statusAssinaturas_ },
  verificarIntegridade: { perfis: [A, S], fn: verificarIntegridade_ },
  dadosPdf: { perfis: [A, S], fn: dadosPdf_ },
  salvarPdf: { perfis: [A, S], escrita: true, fn: salvarPdf_ },

  meusRascunhos: { perfis: [F], fn: meusRascunhos_ },
  salvarRascunho: { perfis: [F], escrita: true, fn: salvarRascunho_ },
  excluirRascunho: { perfis: [F], escrita: true, fn: excluirRascunho_ },
  finalizarRegistro: { perfis: [F], escrita: true, fn: finalizarRegistro_ },
  meusRegistros: { perfis: [F], fn: meusRegistros_ },
  buscarRegistros: { perfis: [A, S], fn: buscarRegistros_ },

  logs: { perfis: [A], fn: listarLogs_ }
};
  return __rotas;
}

function api(acao, token, payload) {
  let sess = null;
  try {
    const r = rotas_()[acao];
    if (!r) throw new AppError('Ação inválida.', 'BAD_REQUEST');
    const p = payload && typeof payload === 'object' ? payload : {};
    if (!r.publica) {
      sess = sessao_(token);
      if (r.perfis && r.perfis.indexOf(sess.perfil) < 0) {
        log_(sess, 'ACESSO_NEGADO', 'API', acao, {}, 'NEGADO');
        throw new AppError('Seu perfil não tem permissão para esta ação.', 'FORBIDDEN');
      }
      if (sess.trocarPin && !r.pin) throw new AppError('Defina um novo PIN para continuar.', 'PIN_CHANGE');
    }
    const dados = r.escrita ? withLock_(function () { return r.fn(p, sess); }) : r.fn(p, sess);
    if (sess && !sess.__fim) salvarSessao_(sess);
    return { ok: true, dados: dados };
  } catch (e) {
    if (sess && !sess.__fim && e.code !== 'SESSION') salvarSessao_(sess);
    if (!(e instanceof AppError)) console.error(acao + ': ' + (e && e.stack || e));
    return { ok: false, erro: e instanceof AppError ? e.message : 'Erro interno. Tente novamente; se persistir, avise o administrador.', codigo: e.code || 'ERRO' };
  }
}

function doGet() {
  const t = HtmlService.createTemplateFromFile(PASTA_HTML + 'Index');
  return t.evaluate()
    .setTitle('Livro ATA Digital — Vegas Vigilância')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

const PASTA_HTML = '';

function include(nome) { return HtmlService.createHtmlOutputFromFile(PASTA_HTML + nome).getContent(); }
