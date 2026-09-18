const { chromium } = require('playwright');
(async () => {
  // Sessão 3.19 — valida a correção da lacuna do antebraço: novo grupamento
  // rastreado no mapa muscular (frente + costas), com exercício direto em
  // cada sessão de força (a8/rosca de punho, b8/rosca de punho invertida).
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
  await page.waitForTimeout(600);

  // --- Mapa muscular: antebraco deve existir na vista de frente E de costas ---
  const mapInfo = await page.evaluate(() => {
    var frontShapes = document.querySelectorAll('.muscle-front .mm-shape[data-mg="antebraco"], .mm-view-front .mm-shape[data-mg="antebraco"]');
    var allShapes = document.querySelectorAll('.mm-shape[data-mg="antebraco"]');
    return { totalAntebracoShapes: allShapes.length };
  });
  console.log('formas de antebraco no SVG (frente+costas, 2 bracos cada = esperado 4):', JSON.stringify(mapInfo));

  // Clica numa das formas de antebraço pra ver o toast
  const shapeCount = await page.locator('.mm-shape[data-mg="antebraco"]').count();
  console.log('total de paths antebraco clicaveis:', shapeCount);
  if (shapeCount > 0) {
    await page.locator('.mm-shape[data-mg="antebraco"]').first().click();
    await page.waitForTimeout(200);
    const toastText = await page.evaluate(() => {
      var msgs = document.querySelectorAll('#toast .msg');
      return msgs.length ? msgs[msgs.length-1].textContent : null;
    });
    console.log('toast ao clicar em antebraco:', toastText);
    const toastOk = toastText && toastText.indexOf('Antebraço') !== -1;
    console.log('TOAST DE ANTEBRACO CORRETO:', toastOk);
  }

  // --- Treino: sessao A deve ter 8 exercicios agora, incluindo a8 ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);
  const exList = await page.evaluate(() => Array.from(document.querySelectorAll('.exercise')).map(e => e.getAttribute('data-ex')));
  console.log('exercicios da sessao A:', JSON.stringify(exList));
  const hasA8 = exList.indexOf('a8') !== -1;
  console.log('SESSAO A TEM a8 (rosca de punho):', hasA8);

  // Marca a serie de a8 como feita, finaliza a sessao (persiste no Firestore)
  // e confere que antebraco fica vermelho no mapa.
  await page.fill('input[data-ex="a8"][data-i="0"][data-f="carga"]', '5');
  await page.fill('input[data-ex="a8"][data-i="0"][data-f="reps"]', '18');
  await page.check('input.chk[data-ex="a8"][data-i="0"][data-f="ok"]');
  await page.waitForTimeout(200);
  await page.click('#btnFinalizar');
  await page.waitForTimeout(600);
  await page.click('nav.tabs button[data-tab="dashboard"]');
  await page.waitForTimeout(200);
  const antebracoFill = await page.evaluate(() => {
    var el = document.querySelector('.mm-shape[data-mg="antebraco"]');
    return el ? el.getAttribute('fill') : null;
  });
  console.log('cor do antebraco apos marcar a8 (esperado #ff5252 = vermelho/hoje):', antebracoFill);
  console.log('ANTEBRACO FICA VERMELHO APOS TREINAR:', antebracoFill === '#ff5252');

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
