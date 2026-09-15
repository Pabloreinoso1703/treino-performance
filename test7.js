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

  const seed = {
    treino_sessions: {
      seed1: {
        data: isoDaysAgo(3),
        sessaoTipo: "A", nomeSessao: "Full-Body A (seed)",
        exercicios: { a5: [{carga:"0", segundos:"35", ok:true},{carga:"0", segundos:"38", ok:true},{carga:"0", segundos:"30", ok:true}] },
        rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString()
      },
      seed2: {
        data: isoDaysAgo(6),
        sessaoTipo: "COND", nomeSessao: "Condicionamento geral (seed)",
        exercicios: { c1: [{duracaoMin:"20", velocidade:"6.5", ok:true}] },
        rpeGeral: "5", observacoes: "", criadoEm: new Date().toISOString()
      }
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
  await page.waitForTimeout(500);

  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);

  const a5Meta = await page.evaluate(() => document.querySelector('.exercise[data-ex="a5"] .meta').textContent);
  console.log('a5 meta line (expect ultima vez 30s + melhor marca 38s):', a5Meta);

  await page.click('#btnCancelar');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="COND"]');
  await page.waitForTimeout(300);

  const c1Meta = await page.evaluate(() => document.querySelector('.exercise[data-ex="c1"] .meta').textContent);
  console.log('c1 meta line (expect ultima vez 20min a 6.5km/h, sem "melhor marca"):', c1Meta);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
