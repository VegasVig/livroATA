function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  if (props.getProperty('SPREADSHEET_ID')) ss = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
  else {
    ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('LIVRO ATA DIGITAL — VEGAS VIGILÂNCIA (BANCO DE DADOS)');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  __ss = ss;
  Object.keys(SCHEMA).forEach(function (nome) {
    let s = ss.getSheetByName(nome);
    if (!s) s = ss.insertSheet(nome);
    const cols = SCHEMA[nome];
    if (s.getMaxColumns() < cols.length) s.insertColumnsAfter(s.getMaxColumns(), cols.length - s.getMaxColumns());
    s.getRange(1, 1, s.getMaxRows(), cols.length).setNumberFormat('@');
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#1b1f26').setFontColor('#ffffff');
    s.setFrozenRows(1);
    const prot = s.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    const pr = prot.length ? prot[0] : s.protect();
    pr.setDescription('Somente o Apps Script do Livro ATA grava nesta aba.');
    pr.removeEditors(pr.getEditors());
    if (pr.canDomainEdit()) pr.setDomainEdit(false);
  });
  const padrao = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
  if (padrao && ss.getSheets().length > 1) ss.deleteSheet(padrao);

  if (!props.getProperty('ROOT_FOLDER_ID')) {
    const raiz = DriveApp.createFolder('LIVRO ATA DIGITAL — VEGAS');
    props.setProperty('ROOT_FOLDER_ID', raiz.getId());
    DriveApp.getFileById(ss.getId()).moveTo(raiz);
  }
  if (!props.getProperty('BACKUP_FOLDER_ID')) {
    const bk = DriveApp.createFolder('LIVRO ATA DIGITAL — BACKUPS (independente)');
    props.setProperty('BACKUP_FOLDER_ID', bk.getId());
  }
  if (!props.getProperty('PIN_PEPPER')) props.setProperty('PIN_PEPPER', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('ANCHOR_EMAIL')) props.setProperty('ANCHOR_EMAIL', Session.getEffectiveUser().getEmail());

  limparCache_();
  let pinAdmin = '';
  if (!all_('USUARIOS').some(function (u) { return u.perfil === PERFIL.ADMIN; })) {
    pinAdmin = pinAleatorio_();
    criarUsuario_('ADMIN', 'Administrador Geral', PERFIL.ADMIN, '', pinAdmin);
    log_(null, 'SETUP', 'SISTEMA', '', { login: 'SETUP', admin: 'ADMIN' });
  }

  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'rotinaDiaria') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(3).create();

  Logger.log('Planilha: ' + ss.getUrl());
  Logger.log('Pasta raiz: https://drive.google.com/drive/folders/' + props.getProperty('ROOT_FOLDER_ID'));
  if (pinAdmin) Logger.log('ACESSO INICIAL → matrícula: ADMIN | PIN provisório: ' + pinAdmin + ' (troca obrigatória no 1º acesso)');
}

function definirEmailAncora(email) { setProp_('ANCHOR_EMAIL', email); }
