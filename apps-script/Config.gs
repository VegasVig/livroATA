const APP = {
  NOME: 'LIVRO ATA DIGITAL',
  EMPRESA: 'VEGAS VIGILÂNCIA',
  SLOGAN: 'Transparência, responsabilidade e segurança em cada registro.',
  VERSAO: '1.0.0',
  TZ: 'America/Sao_Paulo',
  SESSAO_INATIVIDADE_MIN: 30,
  SESSAO_MAX_HORAS: 12,
  MAX_TENTATIVAS: 5,
  BLOQUEIO_MIN: 15,
  TEXTO_MAX: 5000,
  PIN_MIN: 4,
  PIN_MAX: 8,
  PIN_ITER: 300,
  ASSINATURA_MAX_CHARS: 48000,
  ASSINATURA_MIN_CHARS: 1200,
  LIVRO_ALERTA_DIAS: 30,
  LIVRO_ALERTA_REGISTROS: 300,
  CATEGORIAS: ['01 - Assunção de serviço', '02 - Material de carga', '03 - Ocorrências', '04 - Término do serviço'],
  CAT_MATERIAL: '02 - Material de carga',
  ITENS_MAX: 40,
  SENHA_LIVRO_MIN: 4,
  TIPOS_POSTO: { ARMADO: 'Armado', DESARMADO: 'Não armado' },
  DECLARACAO: 'Declaro que as informações acima foram registradas por mim e correspondem ao que desejo comunicar neste Livro ATA.'
};

const PERFIL = { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', FUNCIONARIO: 'FUNCIONARIO' };

const SCHEMA = {
  USUARIOS: ['id', 'login', 'nome', 'perfil', 'refId', 'pinHash', 'salt', 'ativo', 'trocarPin', 'tentativas', 'bloqueadoAte', 'ultimoAcesso', 'credencialBiometrica', 'criadoEm', 'atualizadoEm'],
  FUNCIONARIOS: ['id', 'matricula', 'nome', 'postoIds', 'ativo', 'criadoEm', 'atualizadoEm'],
  SUPERVISORES: ['id', 'matricula', 'nome', 'email', 'postoIds', 'ativo', 'criadoEm', 'atualizadoEm'],
  POSTOS: ['id', 'codigo', 'nome', 'cliente', 'endereco', 'ativo', 'criadoEm', 'atualizadoEm', 'tipo'],
  LIVROS_ATA: ['id', 'postoId', 'postoNome', 'numero', 'codigo', 'supervisorId', 'supervisorNome', 'dataAbertura', 'abertoEm', 'autorizados', 'status', 'totalRegistros', 'hashGenese', 'ultimoHash', 'encerradoEm', 'encerradoPorId', 'encerradoPorNome', 'obsEncerramento', 'hashEncerramento', 'pdfFileId', 'pdfGeradoEm', 'postoTipo', 'senhaHash', 'senhaSalt'],
  REGISTROS: ['id', 'livroId', 'postoId', 'numero', 'status', 'tipo', 'categoria', 'texto', 'funcionarioId', 'funcionarioNome', 'matricula', 'retificaRegistroId', 'retificaNumero', 'retificaLivroCodigo', 'criadoEm', 'atualizadoEm', 'finalizadoEm', 'assinaturaId', 'hashConteudo', 'hashAnterior', 'hashRegistro', 'codigoIntegridade', 'itens'],
  ASSINATURAS: ['id', 'registroId', 'livroId', 'funcionarioId', 'funcionarioNome', 'matricula', 'metodo', 'imagem', 'arquivoId', 'hashImagem', 'declaracao', 'assinadoEm', 'dispositivo'],
  RETIFICACOES: ['id', 'registroOriginalId', 'numeroOriginal', 'livroOriginalId', 'registroRetificacaoId', 'numeroRetificacao', 'livroId', 'funcionarioId', 'motivo', 'criadoEm'],
  LOG_AUDITORIA: ['id', 'dataHora', 'usuarioId', 'login', 'perfil', 'acao', 'entidade', 'entidadeId', 'detalhes', 'resultado', 'hashAnterior', 'hash']
};

const IMUTAVEIS = { ASSINATURAS: true, RETIFICACOES: true, LOG_AUDITORIA: true };

class AppError extends Error {
  constructor(msg, code) { super(msg); this.code = code || 'APP'; }
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
