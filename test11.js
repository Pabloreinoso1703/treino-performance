const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Historico pra popular os aneis/heatmap: 2 sessoes de forca e 1 registro
  // de watch (corrida) nos ultimos 7 dias, mais uma sessao de 20 dias atras
  // (fora da semana, mas dentro das 12 semanas do heatmap).
  const seed = {
    treino_sessions: {
      s1: { data: isoDaysAgo(2), sessaoTipo: "A", nomeSessao: "Full-Body A (seed)", exercicios: { a1: [{carga:"20", reps:"10", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: isoDaysAgo(4), sessaoTipo: "B", nomeSessao: "Full-Body B (seed)", exercicios: { b1: [{carga:"18", reps:"10", ok:true}] }, rpeGeral: "7", observacoes: "", criadoEm: new Date().toISOString() },
      s3: { data: isoDaysAgo(20), sessaoTipo: "A", nomeSessao: "Full-Body A (seed antiga)", exercicios: { a1: [{carga:"18", reps:"10", ok:true}] }, rpeGeral: "5", observacoes: "", criadoEm: new Date().toISOString() }
    },
    treino_watch: {
      w1: { data: isoDaysAgo(1), tipoAtividade: "corrida_esteira", duracao: "20", fcMedia: "160", criadoEm: new Date().toISOString() },
      w2: { data: isoDaysAgo(3), tipoAtividade: "tenis", duracao: "60", fcMedia: "150", criadoEm: new Date().toISOString() }
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
  await page.waitForTimeout(600);

  // --- Aneis de atividade no Dashboard ---
  const ringsLegend = await page.evaluate(() => {
    var items = Array.from(document.querySelectorAll('#view-dashboard .ring-legend-item'));
    return items.map(i => i.textContent.replace(/\s+/g,' ').trim());
  });
  console.log('legenda dos aneis (Forca 2/3, Cardio 20/150, Tenis 1/1):', JSON.stringify(ringsLegend));

  const ringCount = await page.evaluate(() => document.querySelectorAll('#view-dashboard .rings-row svg circle').length);
  console.log('circulos SVG dos aneis (esperado 6 = 3 aneis x fundo+progresso):', ringCount);

  // --- Heatmap de consistencia em Progresso ---
  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);
  const heatmapInfo = await page.evaluate(() => {
    var panels = Array.from(document.querySelectorAll('#view-progresso .panel'));
    var p = panels.find(p => p.querySelector('h2') && p.querySelector('h2').textContent === 'Consistência');
    var cells = p ? p.querySelectorAll('.heatmap-cell').length : 0;
    var filled = p ? p.querySelectorAll('.heatmap-cell.lvl1, .heatmap-cell.lvl2').length : 0;
    var subText = p ? p.querySelector('.sub').textContent : null;
    return {cells, filled, subText};
  });
  console.log('heatmap (84 celulas, 5 dias com registro: -1,-2,-3,-4,-20):', JSON.stringify(heatmapInfo));

  // --- Timer de descanso automatico ao marcar serie OK ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);

  const restVisibleAntes = await page.evaluate(() => document.getElementById('restPill').classList.contains('show'));
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="carga"]', '20');
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="reps"]', '10');
  await page.check('input[data-ex="a1"][data-i="0"][data-f="ok"]');
  await page.waitForTimeout(150);
  const restInfoApos = await page.evaluate(() => ({
    visible: document.getElementById('restPill').classList.contains('show'),
    time: document.getElementById('restPillTime').textContent
  }));
  console.log('rest pill antes de marcar OK (false):', restVisibleAntes, '| depois de marcar OK peso_reps (visible true, ~01:30):', JSON.stringify(restInfoApos));

  // Prancha (peso_tempo) deve iniciar descanso de 60s
  await page.check('input[data-ex="a5"][data-i="0"][data-f="ok"]');
  await page.waitForTimeout(150);
  const restInfoPrancha = await page.evaluate(() => document.getElementById('restPillTime').textContent);
  console.log('rest pill apos marcar OK prancha peso_tempo (~01:00):', restInfoPrancha);

  // --- Atalho Treino -> Analise com pre-preenchimento ---
  await page.fill('#rpeGeral', '6');
  await page.click('#btnFinalizar');
  await page.waitForTimeout(500);
  const activeTab = await page.evaluate(() => document.querySelector('nav.tabs button.active').getAttribute('data-tab'));
  const analiseState = await page.evaluate(() => ({
    tipo: document.getElementById('wTipo').value,
    duracao: document.getElementById('wDuracao').value,
    notaPrefill: !!document.querySelector('#view-analise .note')
  }));
  console.log('aba ativa apos finalizar (analise):', activeTab, '| pre-preenchimento:', JSON.stringify(analiseState));

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
