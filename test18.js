const { chromium } = require('playwright');
(async () => {
  // Sessão 3.18, feature 4 — tendência de carga de treino (média móvel de 7
  // dias) embaixo dos anéis de atividade, no Dashboard ("Essa semana").
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // 2 sessões na semana passada (dia -10, 3 séries) e 2 nessa semana (dia -1,
  // -2, 3 séries cada) — carga subindo de 3 (média móvel de 7d há 7 dias
  // atrás só pegava a sessão de -10 se estivesse dentro da janela) pra 6
  // séries agora. Simplificando: só precisamos de ALGUM dado pra aparecer.
  const seed = {
    treino_sessions: {
      s1: { data: isoDaysAgo(1), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"20",reps:"10",ok:true},{carga:"20",reps:"9",ok:true},{carga:"20",reps:"8",ok:true}] }, rpeGeral: "7", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: isoDaysAgo(3), sessaoTipo: "B", nomeSessao: "Full-Body B", exercicios: { b1: [{carga:"18",reps:"10",ok:true},{carga:"18",reps:"9",ok:true},{carga:"18",reps:"8",ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() }
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

  const trendInfo = await page.evaluate(() => {
    var trend = document.querySelector('.load-trend');
    return {
      exists: !!trend,
      hasSub: trend ? !!trend.querySelector('.sub') : false,
      subText: trend ? trend.querySelector('.sub').textContent : null,
      hasChart: trend ? !!trend.querySelector('svg.chart') : false
    };
  });
  console.log('bloco de tendencia de carga:', JSON.stringify(trendInfo));
  const trendOk = trendInfo.exists && trendInfo.hasChart && trendInfo.subText.indexOf('tendência') !== -1;
  console.log('TENDENCIA DE CARGA DE TREINO PRESENTE E COM GRAFICO:', trendOk);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
