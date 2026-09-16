const { chromium } = require('playwright');
(async () => {
  // Sessão 3.17 — valida o novo detalhe visual de sessão: clicar num item
  // do Histórico abre um bottom-sheet com hero (duração/volume/RPE), chips
  // de grupamentos musculares trabalhados, e por exercício as séries feitas
  // + barra comparativa "nessa sessão x sessão anterior x recorde até então".
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Duas sessões A: uma antiga (recorde de 18kg no supino) e uma recente
  // (22kg, deve virar o novo "recorde até então" quando vista, mas a
  // sessão ANTIGA deve mostrar 18kg como "nessa sessão" e não ter recorde
  // futuro contaminando sua própria barra).
  const seed = {
    treino_sessions: {
      old: { data: isoDaysAgo(7), sessaoTipo: "A", nomeSessao: "Full-Body A (seed antiga)",
        exercicios: { a1: [{carga:"18", reps:"10", ok:true}, {carga:"18", reps:"8", ok:true}], a5: [{carga:"0", segundos:"30", ok:true}] },
        rpeGeral: "6", observacoes: "Treino tranquilo.", temposExercicio: {a1: 300, a5: 90}, criadoEm: new Date().toISOString() },
      recent: { data: isoDaysAgo(1), sessaoTipo: "A", nomeSessao: "Full-Body A (seed recente)",
        exercicios: { a1: [{carga:"22", reps:"8", ok:true}], a5: [{carga:"0", segundos:"35", ok:true}] },
        rpeGeral: "8", observacoes: "", temposExercicio: {a1: 200, a5: 60}, criadoEm: new Date().toISOString() }
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

  await page.click('nav.tabs button[data-tab="historico"]');
  await page.waitForTimeout(200);
  const itemCount = await page.evaluate(() => document.querySelectorAll('#view-historico .hist-item').length);
  console.log('itens clicaveis no historico (esperado 2):', itemCount);

  function extractDetail(){
    return page.evaluate(() => {
      var body = document.getElementById('sessionDetailBody');
      var hero = Array.from(body.querySelectorAll('.sd-hero-tile b')).map(b => b.textContent);
      var chips = Array.from(body.querySelectorAll('.sd-chip')).map(c => c.textContent.trim());
      var firstExercise = body.querySelectorAll('.sd-exercise')[0];
      var loadBarVals = Array.from(firstExercise.querySelectorAll('.load-bar-val')).map(v => v.textContent);
      var loadBarLabels = Array.from(firstExercise.querySelectorAll('.load-bar-label')).map(v => v.textContent);
      var obs = body.querySelector('.sd-obs') ? body.querySelector('.sd-obs').textContent : null;
      return { hero, chips, loadBarLabels, loadBarVals, obs, title: body.querySelector('.sd-title').textContent };
    });
  }

  // state.sessions vem ordenado desc por data (mais recente primeiro), então
  // o 1º .hist-item da lista é a sessão RECENTE (22kg) e o 2º é a ANTIGA (18kg).
  await page.click('#view-historico .hist-item:nth-child(3)'); // 1º item = mais recente
  await page.waitForTimeout(200);
  var visible = await page.evaluate(() => document.getElementById('sessionDetailModal').classList.contains('show'));
  console.log('modal abriu ao clicar no 1o item (mais recente):', visible);

  const recentDetail = await extractDetail();
  console.log('detalhe da sessao RECENTE (22kg): esperado titulo "seed recente", volume 176 (22x8), RPE 8, "Nessa sessao"=22kg, "Sessao anterior"=18kg, "Recorde ate entao"=22kg:');
  console.log(JSON.stringify(recentDetail, null, 2));
  const recentOk = recentDetail.title.indexOf('recente') !== -1 && recentDetail.hero[1] === '176' && recentDetail.hero[2] === '8' &&
    recentDetail.loadBarLabels.join(',') === 'Nessa sessão,Sessão anterior,Recorde até então' &&
    recentDetail.loadBarVals.join(',') === '22kg,18kg,22kg';
  console.log('SESSAO RECENTE CORRETA:', recentOk);

  await page.click('#sessionDetailClose');
  await page.waitForTimeout(150);
  var closed = await page.evaluate(() => !document.getElementById('sessionDetailModal').classList.contains('show'));
  console.log('modal fecha ao clicar no X:', closed);

  // 2º item = sessão ANTIGA (18kg) — é a mais antiga registrada, então não
  // deve ter "Sessão anterior" (não existe nada antes dela).
  await page.click('#view-historico .hist-item:nth-child(4)');
  await page.waitForTimeout(200);
  const oldDetail = await extractDetail();
  console.log('detalhe da sessao ANTIGA (18kg): esperado titulo "seed antiga", volume 324 (18x10+18x8), RPE 6, sem "Sessao anterior", obs "Treino tranquilo.":');
  console.log(JSON.stringify(oldDetail, null, 2));
  const oldOk = oldDetail.title.indexOf('antiga') !== -1 && oldDetail.hero[1] === '324' && oldDetail.hero[2] === '6' &&
    oldDetail.loadBarLabels.join(',') === 'Nessa sessão,Recorde até então' &&
    oldDetail.loadBarVals.join(',') === '18kg,18kg' &&
    oldDetail.obs === 'Treino tranquilo.';
  console.log('SESSAO ANTIGA CORRETA:', oldOk);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
