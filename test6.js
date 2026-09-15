const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });
  page.on('dialog', d => { errors.push('BLOCKING DIALOG: ' + d.message()); d.dismiss(); });

  let savedDoc = null;
  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub.js', 'utf8') });
  });
  await page.route('**/youtube.com/**', route => route.abort());

  await page.exposeFunction('__captureAdd', (doc) => { savedDoc = doc; });

  await page.goto('file://' + __dirname + '/index.html');
  await page.fill('#pw', 'acad1703');
  await page.click('#btnEnter');
  await page.waitForTimeout(500);

  // Patch db.collection(...).add to capture the saved doc, like test.js does implicitly via console log.
  // (firebase-stub.js already console.logs "FIRESTORE ADD:"), so instead capture via console.
  let firestoreAddLine = null;
  page.on('console', msg => { if(msg.text().startsWith('FIRESTORE ADD:')) firestoreAddLine = msg.text(); });

  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);

  // --- Prancha abdominal (a5, tipo peso_tempo): default carga should be "0" ---
  const a5CargaDefault = await page.inputValue('input[data-ex="a5"][data-i="0"][data-f="carga"]');
  console.log('a5 default carga (expect 0, bodyweight):', a5CargaDefault);

  const a5SegundosField = await page.locator('input[data-ex="a5"][data-i="0"][data-f="segundos"]').count();
  console.log('a5 has segundos field (expect 1):', a5SegundosField);

  const a5RepsField = await page.locator('input[data-ex="a5"][data-i="0"][data-f="reps"]').count();
  console.log('a5 should NOT have reps field (expect 0):', a5RepsField);

  // headers for a5's table
  const a5Headers = await page.evaluate(() => {
    var exDiv = document.querySelector('.exercise[data-ex="a5"]');
    return Array.from(exDiv.querySelectorAll('table.sets th')).map(th => th.textContent);
  });
  console.log('a5 table headers:', JSON.stringify(a5Headers));

  // set segundos to 40 via stepper (step 5, 8 clicks = 40)
  for(let i=0;i<8;i++){
    await page.click('.step-btn[data-ex="a5"][data-i="0"][data-f="segundos"][data-op="inc"]');
  }
  const a5Segundos = await page.inputValue('input[data-ex="a5"][data-i="0"][data-f="segundos"]');
  console.log('a5 segundos after 8x inc from 0 (step 5, expect 40):', a5Segundos);
  await page.check('input[data-ex="a5"][data-i="0"][data-f="ok"]');

  // --- Desenvolvimento de ombro (a4): mark done, add session-wide observation for seated variant ---
  await page.fill('textarea#obsGeral', 'Ombro: sentado no banco para maior controle.');

  await page.click('#btnFinalizar');
  await page.waitForTimeout(300);
  console.log('FIRESTORE ADD for session A:', firestoreAddLine);

  // --- Cardio session (COND, c1: tipo cardio) ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="COND"]');
  await page.waitForTimeout(300);

  const c1RepeatBtn = await page.locator('.btn-repeat[data-ex="c1"]').count();
  console.log('c1 should NOT show "repetir ultima serie" button (expect 0):', c1RepeatBtn);

  const c1Headers = await page.evaluate(() => {
    var exDiv = document.querySelector('.exercise[data-ex="c1"]');
    return Array.from(exDiv.querySelectorAll('table.sets th')).map(th => th.textContent);
  });
  console.log('c1 table headers:', JSON.stringify(c1Headers));

  // duracaoMin: 10 (10 clicks of step 1), velocidade: 9 (18 clicks of step 0.5)
  for(let i=0;i<10;i++){
    await page.click('.step-btn[data-ex="c1"][data-i="0"][data-f="duracaoMin"][data-op="inc"]');
  }
  for(let i=0;i<18;i++){
    await page.click('.step-btn[data-ex="c1"][data-i="0"][data-f="velocidade"][data-op="inc"]');
  }
  const c1Dur = await page.inputValue('input[data-ex="c1"][data-i="0"][data-f="duracaoMin"]');
  const c1Vel = await page.inputValue('input[data-ex="c1"][data-i="0"][data-f="velocidade"]');
  console.log('c1 duracaoMin (expect 10):', c1Dur, '| velocidade (expect 9):', c1Vel);
  await page.check('input[data-ex="c1"][data-i="0"][data-f="ok"]');

  firestoreAddLine = null;
  await page.click('#btnFinalizar');
  await page.waitForTimeout(300);
  console.log('FIRESTORE ADD for session COND:', firestoreAddLine);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
