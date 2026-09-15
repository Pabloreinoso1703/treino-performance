const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){
    var d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0,10);
  }

  // Dados reais do Apple Watch de 15/09: força (12:37-13:24, FC med 147) +
  // corrida na esteira logo em seguida (13:24-13:34, FC med 188, pico 195, 8:05 em zona 5)
  const seed = {
    treino_watch: {
      w1: {data: isoDaysAgo(0), tipoAtividade: "forca", duracao: "47", fcMedia: "147", fcMax: "185", calorias: "535", rpe: "6", criadoEm: new Date().toISOString()},
      w2: {data: isoDaysAgo(0), tipoAtividade: "corrida_esteira", duracao: "10", distancia: "1.30", ritmo: "7min40s/km", fcMedia: "188", fcMax: "195", zonaAlta: "8.5", calorias: "134", rpe: "7", criadoEm: new Date().toISOString()},
      w3: {data: isoDaysAgo(7), tipoAtividade: "corrida_esteira", duracao: "12", distancia: "1.6", fcMedia: "179", fcMax: "190", zonaAlta: "6", calorias: "150", rpe: "6", criadoEm: new Date().toISOString()}
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

  await page.click('nav.tabs button[data-tab="analise"]');
  await page.waitForTimeout(300);
  const histItems = await page.evaluate(() => Array.from(document.querySelectorAll('#view-analise .hist-item')).map(el => el.textContent.replace(/\s+/g,' ').trim()));
  console.log('registros no historico da Analise:', JSON.stringify(histItems, null, 2));

  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);
  const chartTitles = await page.evaluate(() => Array.from(document.querySelectorAll('#view-progresso h2')).map(h => h.textContent));
  console.log('graficos em Progresso:', JSON.stringify(chartTitles));
  const fcChartSvgPoints = await page.evaluate(() => {
    var panels = Array.from(document.querySelectorAll('#view-progresso .panel'));
    var p = panels.find(p => p.querySelector('h2').textContent.includes('FC média'));
    var path = p ? p.querySelector('svg path') : null;
    return path ? path.getAttribute('d') : null;
  });
  console.log('FC media chart tem path desenhado:', !!fcChartSvgPoints);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
