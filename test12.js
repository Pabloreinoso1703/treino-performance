const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Seed com histórico pra dar contexto às 10 melhorias visuais/UX da Sessão
  // 3.12: sessões recentes (carrossel + hero de dias ativos), um registro de
  // watch (Análise em <details>) e uma marca de supino (a1) pra testar PR/barra
  // de carga com um recorde real já existente (20kg).
  const seed = {
    treino_sessions: {
      s1: { data: isoDaysAgo(1), sessaoTipo: "A", nomeSessao: "Full-Body A (seed)", exercicios: { a1: [{carga:"20", reps:"10", ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: isoDaysAgo(3), sessaoTipo: "B", nomeSessao: "Full-Body B (seed)", exercicios: { b1: [{carga:"18", reps:"10", ok:true}] }, rpeGeral: "7", observacoes: "", criadoEm: new Date().toISOString() }
    },
    treino_watch: {
      w1: { data: isoDaysAgo(2), tipoAtividade: "corrida_esteira", duracao: "20", fcMedia: "160", criadoEm: new Date().toISOString() }
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

  // --- Skeleton loading: deve aparecer ANTES do renderAll() de verdade ---
  const skeletonPresent = await page.evaluate(() => document.querySelectorAll('#view-dashboard .skel-line').length > 0);
  console.log('skeleton visivel logo apos desbloquear (antes do fetch resolver):', skeletonPresent);

  await page.waitForTimeout(700);

  const skeletonGoneAfterLoad = await page.evaluate(() => document.querySelectorAll('#view-dashboard .skel-line').length === 0);
  console.log('skeleton some depois que os dados carregam:', skeletonGoneAfterLoad);

  // --- Hero metric + bento grid no Dashboard ---
  const heroInfo = await page.evaluate(() => {
    var hero = document.querySelector('#view-dashboard .bento-tile.bento-hero .hero-number');
    var bentoTiles = document.querySelectorAll('#view-dashboard .bento-grid .bento-tile').length;
    var weekHero = document.querySelector('#view-dashboard .hero-metric .hero-number');
    return { streakHero: hero ? hero.textContent : null, bentoTiles: bentoTiles, diasAtivos: weekHero ? weekHero.textContent : null };
  });
  console.log('hero metric (streak no bento + dias ativos na semana):', JSON.stringify(heroInfo));

  // --- Carrossel de treinos recentes ---
  const carouselCount = await page.evaluate(() => document.querySelectorAll('#view-dashboard .carousel-card').length);
  console.log('cards no carrossel de treinos recentes (esperado 2):', carouselCount);

  // --- Análise: histórico em <details> (divulgação progressiva) ---
  await page.click('nav.tabs button[data-tab="analise"]');
  await page.waitForTimeout(200);
  const detailsInfo = await page.evaluate(() => {
    var det = document.querySelectorAll('#view-analise details.hist-item');
    var firstOpenBeforeClick = det.length ? det[0].open : null;
    return { count: det.length, firstOpenBeforeClick: firstOpenBeforeClick };
  });
  console.log('registros do Watch como <details> (fechados por padrao):', JSON.stringify(detailsInfo));

  // --- Treino: pulse-ok, barra de carga, e confete no PR ---
  await page.click('nav.tabs button[data-tab="treino"]');
  await page.waitForTimeout(200);
  await page.click('.btn-sessao[data-s="A"]');
  await page.waitForTimeout(300);

  // Marca 15kg (abaixo do recorde de 20kg) — não deve gerar confete
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="carga"]', '15');
  await page.fill('input[data-ex="a1"][data-i="0"][data-f="reps"]', '10');
  await page.check('input[data-ex="a1"][data-i="0"][data-f="ok"]');
  await page.waitForTimeout(150);
  const afterFirstCheck = await page.evaluate(() => ({
    pulseOk: document.querySelector('.exercise[data-ex="a1"]').classList.contains('pulse-ok'),
    loadBarRows: document.querySelectorAll('#loadBar-a1 .load-bar-row').length,
    confettiCount: document.querySelectorAll('.confetti-piece').length
  }));
  console.log('apos marcar 15kg (< recorde 20kg — sem confete esperado):', JSON.stringify(afterFirstCheck));

  // Marca 2ª série com 22kg (acima do recorde) — deve virar PR e gerar confete
  await page.fill('input[data-ex="a1"][data-i="1"][data-f="carga"]', '22');
  await page.fill('input[data-ex="a1"][data-i="1"][data-f="reps"]', '8');
  await page.check('input[data-ex="a1"][data-i="1"][data-f="ok"]');
  await page.waitForTimeout(150);
  const afterPr = await page.evaluate(() => ({
    prBadgeVisible: document.getElementById('prBadge-a1').style.display !== 'none',
    loadBarRows: document.querySelectorAll('#loadBar-a1 .load-bar-row').length,
    confettiCount: document.querySelectorAll('.confetti-piece').length
  }));
  console.log('apos marcar 22kg (> recorde 20kg — confete esperado):', JSON.stringify(afterPr));

  // --- Progresso: botao "Resumo do mes" (Wrapped) ---
  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(200);
  await page.click('#btnResumoMes');
  await page.waitForTimeout(200);
  const wrappedInfo = await page.evaluate(() => {
    var overlay = document.getElementById('wrappedModal');
    var cards = document.querySelectorAll('#wrappedScroll .wrapped-card');
    var numbers = Array.from(cards).map(c => c.querySelector('.wc-number').textContent);
    return { visible: overlay.classList.contains('show'), cardCount: cards.length, numbers: numbers };
  });
  console.log('modal de resumo do mes (4 cards esperados):', JSON.stringify(wrappedInfo));

  await page.click('#wrappedClose');
  await page.waitForTimeout(150);
  const wrappedClosed = await page.evaluate(() => !document.getElementById('wrappedModal').classList.contains('show'));
  console.log('modal fecha ao clicar no X:', wrappedClosed);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
