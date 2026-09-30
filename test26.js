const { chromium } = require('playwright');
(async () => {
  // Sessão 3.29 (30/09/2026) — valida a revisão de exercícios do Bloco 1:
  // (1) tríceps direto novo (a9/b9) existe e renderiza certo;
  // (2) abdominal/core (a5 em A, b5 em B) é sempre o ÚLTIMO exercício da
  //     sessão, como pedido pelo Pablo;
  // (3) duração estimada das sessões A/B caiu pra "50-60 min" (era "60-70").
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub-stateful.js', 'utf8') });
  });
  await page.route('**/youtube.com/**', route => route.abort());

  await page.goto('file://' + __dirname + '/index.html');
  await page.fill('#pw', 'acad1703');
  await page.click('#btnEnter');
  await page.waitForTimeout(500);

  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);

  for (const key of ['A', 'B']) {
    await page.click('.btn-sessao[data-s="' + key + '"]');
    await page.waitForTimeout(300);

    const ids = await page.$$eval('.exercise', els => els.map(e => e.getAttribute('data-ex')));
    console.log('Sessão ' + key + ' — ordem dos exercícios:', JSON.stringify(ids));

    const triId = key === 'A' ? 'a9' : 'b9';
    const abdId = key === 'A' ? 'a5' : 'b5';
    console.log('Sessão ' + key + ' — tríceps novo (' + triId + ') presente:', ids.includes(triId));
    console.log('Sessão ' + key + ' — abdômen/core (' + abdId + ') é o último exercício:', ids[ids.length - 1] === abdId);

    const dur = await page.$eval('#view-treino .panel .sub', el => el.textContent);
    console.log('Sessão ' + key + ' — texto de duração/aquecimento:', dur);

    const triMetas = await page.$$eval('.exercise[data-ex="' + triId + '"] .meta', els => els.map(e => e.textContent));
    console.log('Sessão ' + key + ' — obs do tríceps novo:', triMetas[1] || '(sem obs)');

    await page.click('#btnCancelar');
    await page.waitForTimeout(200);
  }

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
