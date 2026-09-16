const { chromium } = require('playwright');
(async () => {
  // Sessão 3.18 — valida feature 1 (volume semanal por grupamento vs meta
  // 12-20 séries) e feature 2 (histórico dedicado por exercício, clicável
  // tanto na aba Treino quanto no detalhe de sessão do Histórico).
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // a1 (peito/tríceps) treinado 3x na semana com carga subindo 18->20->22kg
  // (3 séries cada vez = 9 séries de peito/tríceps, abaixo da meta de 12) —
  // dá pra checar tanto a barra de volume quanto o gráfico de progressão.
  const seed = {
    treino_sessions: {
      s1: { data: isoDaysAgo(6), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"18", reps:"10", ok:true},{carga:"18", reps:"9", ok:true},{carga:"18", reps:"8", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: isoDaysAgo(3), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"20", reps:"10", ok:true},{carga:"20", reps:"9", ok:true},{carga:"20", reps:"8", ok:true}] }, rpeGeral: "7", observacoes: "", criadoEm: new Date().toISOString() },
      s3: { data: isoDaysAgo(1), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"22", reps:"8", ok:true},{carga:"22", reps:"7", ok:true},{carga:"22", reps:"6", ok:true}] }, rpeGeral: "8", observacoes: "", criadoEm: new Date().toISOString() }
    }
  };

  await page.addInitScript((seedData) => { window.__SEED__ = seedData; }, seed);
  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub-stateful.js', 'utf8') });
  });
  await page.route('**/youtube.com/**', route => route.abort());

  await page.goto('file://' + __dirname + '/index.html');
  await page.fill('#pw', 'acad1703');
  await page.click('#btnEnter');
  await page.waitForTimeout(500);

  // --- Feature 1: volume por grupamento ---
  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);
  const volInfo = await page.evaluate(() => {
    var rows = Array.from(document.querySelectorAll('.vol-row'));
    var peito = rows.find(r => r.querySelector('.vol-label').textContent.indexOf('Peitoral') !== -1);
    return {
      panelExists: !!document.querySelector('.vol-group'),
      rowCount: rows.length,
      peitoVal: peito ? peito.querySelector('.vol-val').textContent : null,
      peitoFillBg: peito ? peito.querySelector('.vol-fill').style.background : null
    };
  });
  console.log('painel de volume por grupamento:', JSON.stringify(volInfo));
  const volOk = volInfo.panelExists && volInfo.rowCount === 10 && volInfo.peitoVal === '9 séries' && volInfo.peitoFillBg.indexOf('state-bad') !== -1;
  console.log('VOLUME POR GRUPAMENTO CORRETO (9 series peito, abaixo da meta = vermelho):', volOk);

  // --- Feature 2: historico por exercicio, a partir da aba Treino ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);
  await page.click('[data-ex-hist="a1"]');
  await page.waitForTimeout(200);
  const ehVisible1 = await page.evaluate(() => document.getElementById('exerciseHistModal').classList.contains('show'));
  const ehDetail1 = await page.evaluate(() => {
    var body = document.getElementById('exerciseHistBody');
    return {
      title: body.querySelector('.sd-title').textContent,
      hasChart: !!body.querySelector('svg.chart'),
      rowCount: body.querySelectorAll('.eh-row').length,
      firstRow: body.querySelectorAll('.eh-row')[0] ? body.querySelectorAll('.eh-row')[0].textContent : null,
      prCount: body.querySelectorAll('.eh-pr').length
    };
  });
  console.log('modal de historico do exercicio abriu (via Treino):', ehVisible1);
  console.log('detalhe do historico do a1:', JSON.stringify(ehDetail1));
  const ehOk = ehVisible1 && ehDetail1.hasChart && ehDetail1.rowCount === 3 && ehDetail1.prCount === 3; // cada sessao bateu recorde (18->20->22kg subindo)
  console.log('HISTORICO DE EXERCICIO CORRETO (3 sessoes, grafico, 3 PRs subindo):', ehOk);
  await page.click('#exerciseHistClose');
  await page.waitForTimeout(150);
  const ehClosed = await page.evaluate(() => !document.getElementById('exerciseHistModal').classList.contains('show'));
  console.log('modal de historico do exercicio fecha:', ehClosed);

  // --- Feature 2: tambem clicavel a partir do detalhe de sessao (Historico) ---
  await page.click('nav.tabs button[data-tab="historico"]');
  await page.waitForTimeout(200);
  await page.click('#view-historico .hist-item:nth-of-type(1)');
  await page.waitForTimeout(200);
  await page.click('#sessionDetailBody [data-ex-hist="a1"]');
  await page.waitForTimeout(200);
  const ehVisible2 = await page.evaluate(() => document.getElementById('exerciseHistModal').classList.contains('show'));
  console.log('historico de exercicio tambem abre a partir do detalhe de sessao:', ehVisible2);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
