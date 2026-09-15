const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Historico: a1 com melhor marca de 20kg ha alguns dias
  const seed = {
    treino_sessions: {
      seed1: { data: isoDaysAgo(3), sessaoTipo: "A", nomeSessao: "Full-Body A (seed)",
        exercicios: { a1: [{carga:"20", reps:"10", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() }
    },
    treino_watch: {
      w1: { data: isoDaysAgo(2), tipoAtividade: "corrida_esteira", duracao: "15", fcMedia: "170", criadoEm: new Date().toISOString() }
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

  // --- Resumo da semana no Dashboard ---
  const resumoText = await page.evaluate(() => {
    var panels = Array.from(document.querySelectorAll('#view-dashboard .panel'));
    var p = panels.find(p => p.querySelector('h2') && p.querySelector('h2').textContent === 'Essa semana');
    return p ? p.textContent.replace(/\s+/g,' ').trim() : null;
  });
  console.log('Resumo da semana (deve ter 1 sessao, 15min cardio):', resumoText);

  // --- Treino: barra de progresso ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);

  const totalSets = await page.evaluate(() => document.querySelectorAll('input[type=checkbox][data-f="ok"]').length);
  const progressoInicial = await page.textContent('#sessionProgressLabel');
  console.log('total de series na sessao A:', totalSets, '| progresso inicial:', progressoInicial);

  // Marca uma serie do a1 com carga MENOR que o recorde (20kg) -> sem badge
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="carga"]', '15');
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="reps"]', '10');
  await page.check('input[data-ex="a1"][data-i="0"][data-f="ok"]');
  await page.waitForTimeout(150);
  const progressoApos1 = await page.textContent('#sessionProgressLabel');
  const badgeVisivelAbaixoRecorde = await page.isVisible('#prBadge-a1');
  console.log('progresso apos 1a serie:', progressoApos1, '| badge PR visivel (deveria ser false, 15kg < recorde 20kg):', badgeVisivelAbaixoRecorde);

  // Marca a 2a serie com carga MAIOR que o recorde -> badge deve aparecer
  await page.fill('input[data-ex="a1"][data-i="1"][data-f="carga"]', '22');
  await page.fill('input[data-ex="a1"][data-i="1"][data-f="reps"]', '8');
  await page.check('input[data-ex="a1"][data-i="1"][data-f="ok"]');
  await page.waitForTimeout(150);
  const badgeVisivelAcimaRecorde = await page.isVisible('#prBadge-a1');
  console.log('badge PR visivel (deveria ser true, 22kg > recorde 20kg):', badgeVisivelAcimaRecorde);

  // Desmarca a 2a serie -> badge deve sumir de novo
  await page.uncheck('input[data-ex="a1"][data-i="1"][data-f="ok"]');
  await page.waitForTimeout(150);
  const badgeApósDesmarcar = await page.isVisible('#prBadge-a1');
  const progressoFinal = await page.textContent('#sessionProgressLabel');
  console.log('badge apos desmarcar (deveria ser false):', badgeApósDesmarcar, '| progresso final:', progressoFinal);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
