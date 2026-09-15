const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });
  page.on('dialog', d => { errors.push('BLOCKING DIALOG: ' + d.message()); d.dismiss(); });

  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub.js', 'utf8') });
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

  const fieldsPresent = await page.evaluate(() => ({
    tipo: !!document.getElementById('wTipo'),
    ritmo: !!document.getElementById('wRitmo'),
    zonaAlta: !!document.getElementById('wZonaAlta'),
    tipoOptions: Array.from(document.getElementById('wTipo').options).map(o => o.value)
  }));
  console.log('campos novos presentes:', JSON.stringify(fieldsPresent));

  // Simula o registro da CORRIDA de hoje (dados reais do Apple Watch)
  await page.selectOption('#wTipo', 'corrida_esteira');
  await page.fill('#wDuracao', '10');
  await page.fill('#wDistancia', '1.30');
  await page.fill('#wRitmo', "7'40\"/km");
  await page.fill('#wFcMedia', '188');
  await page.fill('#wFcMax', '195');
  await page.fill('#wZonaAlta', '8.5');
  await page.fill('#wCalorias', '134');
  await page.fill('#wRpe', '7');
  await page.click('#btnSalvarAnalise');
  await page.waitForTimeout(300);
  console.log('FIRESTORE ADD (watch cardio):', firestoreAddLine);

  const histText = await page.evaluate(() => document.querySelector('#view-analise .hist-item') ? document.querySelector('#view-analise .hist-item').textContent : null);
  console.log('historico apos salvar (deve conter Corrida interna (esteira), ritmo, zona alta):', histText);

  // c1 obs deve refletir a calibração baseada nos dados reais
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="COND"]');
  await page.waitForTimeout(300);
  const c1Obs = await page.evaluate(() => document.querySelector('.exercise[data-ex="c1"] .meta:nth-of-type(2)').textContent);
  console.log('c1 obs (deve mencionar zona/153bpm):', c1Obs);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
