const { chromium } = require('playwright');
(async () => {
  // Sessão 3.15 — valida o fix do bug de fuso-horário no week-strip do
  // Dashboard ("Bloco 0"). Roda a página com o relógio emulado em
  // America/Sao_Paulo (UTC-3, o fuso do Pablo) pra reproduzir exatamente o
  // cenário que causava o bug antigo (new Date("YYYY-MM-DD") é sempre
  // interpretado como UTC meia-noite, que em UTC-3 cai no dia ANTERIOR às
  // 21h — deslocando getDay()/getDate() um dia pra trás).
  const TZ = 'America/Sao_Paulo';
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const context = await browser.newContext({ timezoneId: TZ });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function pad2(n){ return (n<10?'0':'')+n; }

  // Data de "hoje" no fuso do Pablo, como string YYYY-MM-DD.
  const nowParts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
  const [ty, tm, td] = nowParts.split('-').map(Number);

  // Constrói os 7 dias (hoje e 6 anteriores) usando aritmética de calendário
  // pura via Date.UTC — o dia da semana de uma data de calendário não depende
  // de fuso-horário, então isso dá um "gabarito" confiável independente de
  // qual TZ o processo Node está rodando.
  const days = [];
  for(let i=6;i>=0;i--){
    const t = Date.UTC(ty, tm-1, td) - i*86400000;
    const dt = new Date(t);
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth()+1, d = dt.getUTCDate();
    const dow = dt.getUTCDay(); // 0=domingo ... 6=sábado, mesma convenção do array DOW do app
    days.push({ iso: y + '-' + pad2(m) + '-' + pad2(d), dow: dow, dateNum: d });
  }
  const todaysISO = days[6].iso;
  const trainedISO = days[4].iso; // treino registrado 2 dias atrás — testa o "check" no meio da tira
  const DOW_LETTERS = ["D","S","T","Q","Q","S","S"];

  const seed = {
    treino_sessions: {
      s1: { data: trainedISO, sessaoTipo: "A", nomeSessao: "Full-Body A (seed)", exercicios: { a1: [{carga:"20", reps:"10", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: todaysISO, sessaoTipo: "A", nomeSessao: "Full-Body A (hoje)", exercicios: { a3: [{carga:"40", reps:"8", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() }
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
  await page.waitForTimeout(700);

  const cells = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#view-dashboard .week-strip .week-day')).map(function(el){
      return {
        dow: el.querySelector('.dow').textContent,
        dot: el.querySelector('.dot').textContent,
        trained: el.classList.contains('trained'),
        today: el.classList.contains('today')
      };
    });
  });

  console.log('todaysISO esperado (fuso ' + TZ + '):', todaysISO);
  console.log('data com treino seedado:', trainedISO);
  console.log('celulas da tira renderizadas:', JSON.stringify(cells, null, 2));

  let allOk = true;
  cells.forEach(function(cell, idx){
    const expected = days[idx];
    const expectedDow = DOW_LETTERS[expected.dow];
    const expectedIsToday = idx === 6;
    const expectedTrained = expected.iso === trainedISO || expected.iso === todaysISO;
    const dowOk = cell.dow === expectedDow;
    const todayOk = cell.today === expectedIsToday;
    const trainedOk = cell.trained === expectedTrained;
    // quando não treinado, o "dot" mostra o número do dia; quando treinado, mostra "✓"
    const dotOk = expectedTrained ? cell.dot === '✓' : Number(cell.dot) === expected.dateNum;
    if(!dowOk || !todayOk || !trainedOk || !dotOk){
      allOk = false;
      console.log('MISMATCH na celula ' + idx + ' (esperado iso=' + expected.iso + '): dow ' + cell.dow + ' vs ' + expectedDow + ', today ' + cell.today + ' vs ' + expectedIsToday + ', trained ' + cell.trained + ' vs ' + expectedTrained + ', dot ' + cell.dot);
    }
  });
  console.log('TODAS AS 7 CELULAS CORRETAS (dia da semana + numero + hoje + treinado):', allOk);

  // --- Mapa muscular: "hoje" (diasDesde===0) deve bater com a MESMA data
  // que o week-strip marca como "today", usando o treino (a3, quadríceps/
  // glúteos) já seedado pra hoje junto com o resto.
  await page.click('nav.tabs button[data-tab="dashboard"]');
  await page.waitForTimeout(200);
  const quadShape = page.locator('.mm-shape[data-mg="quadriceps"]').first();
  const fillBefore = await quadShape.getAttribute('fill');
  await quadShape.click();
  await page.waitForTimeout(150);
  const toastText = await page.evaluate(() => {
    var msgs = document.querySelectorAll('#toast .msg');
    return msgs.length ? msgs[msgs.length-1].textContent : null;
  });
  console.log('cor de preenchimento do quadriceps no SVG (esperado #ff5252 = vermelho/"hoje"):', fillBefore);
  console.log('mensagem ao tocar no quadriceps:', toastText);
  const muscleOk = fillBefore === '#ff5252' && !!toastText && toastText.indexOf('hoje') !== -1;
  console.log('MAPA MUSCULAR CONDIZ COM "HOJE" DO WEEK-STRIP:', muscleOk);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
