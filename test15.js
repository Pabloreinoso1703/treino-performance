const { chromium } = require('playwright');
(async () => {
  // Sessão 3.18 — valida a solução "sem dados do Apple Watch": checkbox
  // esconde os campos biométricos, salva com semWatch:true e campos vazios,
  // mostra badge no histórico, e a nota de cobertura em Progresso conta
  // certo quantas sessões de cardio têm cada métrica.
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Seed: uma sessão de cardio JÁ com Watch completo (dia -2) pra dar
  // contexto de "1 de 2" na nota de cobertura depois que a gente salvar
  // uma segunda sessão SEM Watch.
  const seed = {
    treino_watch: {
      w1: { data: isoDaysAgo(2), tipoAtividade: "corrida_esteira", duracao: "20", distancia: "3", ritmo: "6'40\"/km",
        fcMedia: "160", fcMax: "175", zonaAlta: "5", calorias: "200", rpe: "6", sono: "", observacoes: "", semWatch: false, criadoEm: new Date().toISOString() }
    }
  };

  await page.addInitScript((seedData) => { window.__SEED__ = seedData; }, seed);
  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub-stateful.js', 'utf8') });
  });
  await page.route('**/youtube.com/**', route => route.abort());

  let firestoreAddLine = null;
  page.on('console', msg => { if(msg.text().startsWith('FIRESTORE ADD:')) firestoreAddLine = msg.text(); });

  await page.goto('file://' + __dirname + '/index.html');
  await page.fill('#pw', 'acad1703');
  await page.click('#btnEnter');
  await page.waitForTimeout(500);

  await page.click('nav.tabs button[data-tab="analise"]');
  await page.waitForTimeout(200);

  // Campos biométricos visíveis por padrão (checkbox desmarcada)
  const visibleBefore = await page.evaluate(() => document.getElementById('wCamposWatch').style.display !== 'none');
  console.log('campos do Watch visiveis antes de marcar a caixa (esperado true):', visibleBefore);

  await page.check('#wSemWatch');
  await page.waitForTimeout(100);
  const visibleAfter = await page.evaluate(() => document.getElementById('wCamposWatch').style.display === 'none');
  console.log('campos do Watch escondidos apos marcar "sem Watch" (esperado true):', visibleAfter);

  // Registra caminhada SEM Watch (só tipo, duração e RPE)
  await page.selectOption('#wTipo', 'caminhada_externa');
  await page.fill('#wDuracao', '30');
  await page.fill('#wRpe', '5');
  await page.click('#btnSalvarAnalise');
  await page.waitForTimeout(300);
  console.log('FIRESTORE ADD (sem Watch):', firestoreAddLine);
  const savedOk = firestoreAddLine && firestoreAddLine.indexOf('"semWatch":true') !== -1 &&
    firestoreAddLine.indexOf('"fcMedia":""') !== -1 && firestoreAddLine.indexOf('"duracao":"30"') !== -1;
  console.log('SALVO COM semWatch:true E CAMPOS BIOMETRICOS VAZIOS:', savedOk);

  await page.waitForTimeout(200);
  const badgeText = await page.evaluate(() => {
    var items = document.querySelectorAll('#view-analise .hist-item summary');
    for(var i=0;i<items.length;i++){ if(items[i].textContent.indexOf('sem Watch') !== -1) return items[i].textContent; }
    return null;
  });
  console.log('badge "sem Watch" aparece no historico:', badgeText);

  // Progresso: nota de cobertura deve dizer "1 de 2" (1 registro com FC, de 2 sessões de cardio)
  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);
  const coverageNotes = await page.evaluate(() => Array.from(document.querySelectorAll('.note-mini')).map(function(n){ return n.textContent; }));
  console.log('notas de cobertura em Progresso:', JSON.stringify(coverageNotes));
  const coverageOk = coverageNotes.some(function(t){ return t.indexOf('1 de 2') !== -1 && t.indexOf('FC') !== -1 && t.indexOf('1 sem Watch') !== -1; });
  console.log('NOTA DE COBERTURA FC CORRETA (1 de 2, 1 sem Watch):', coverageOk);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
