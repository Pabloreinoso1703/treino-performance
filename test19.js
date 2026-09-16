const { chromium } = require('playwright');
(async () => {
  // Sessão 3.18 — valida feature 5 (selos por marcos: streak/total treinos/
  // consistência) e feature 6 (calendário mensal navegável, clicável nos
  // dias com treino, abrindo o mesmo detalhe de sessão do Histórico).
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // 3 dias seguidos de treino (hoje, ontem, anteontem) -> streak=3, desbloqueia
  // "3 dias seguidos" mas não "7 dias seguidos"; 3 sessões no total -> não
  // desbloqueia "10 treinos".
  const seed = {
    treino_sessions: {
      s1: { data: isoDaysAgo(2), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"20",reps:"10",ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s2: { data: isoDaysAgo(1), sessaoTipo: "B", nomeSessao: "Full-Body B", exercicios: { b1: [{carga:"18",reps:"10",ok:true}] }, rpeGeral: "6", observacoes: "", criadoEm: new Date().toISOString() },
      s3: { data: isoDaysAgo(0), sessaoTipo: "A", nomeSessao: "Full-Body A", exercicios: { a1: [{carga:"20",reps:"10",ok:true}] }, rpeGeral: "7", observacoes: "", criadoEm: new Date().toISOString() }
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

  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);

  // --- Feature 5: selos ---
  const badgeInfo = await page.evaluate(() => {
    var chips = Array.from(document.querySelectorAll('.badge-chip'));
    var byLabel = {};
    chips.forEach(c => { byLabel[c.querySelector('.badge-name').textContent] = c.classList.contains('unlocked'); });
    return { total: chips.length, byLabel: byLabel };
  });
  console.log('selos:', JSON.stringify(badgeInfo, null, 2));
  const badgesOk = badgeInfo.total === 10 &&
    badgeInfo.byLabel['3 dias seguidos'] === true &&
    badgeInfo.byLabel['7 dias seguidos'] === false &&
    badgeInfo.byLabel['10 treinos'] === false;
  console.log('SELOS CORRETOS (3 dias desbloqueado, 7 dias e 10 treinos bloqueados):', badgesOk);

  // --- Feature 6: calendario mensal ---
  const calInfo = await page.evaluate(() => {
    var cal = document.querySelector('.cal-grid');
    var todayCell = document.querySelector('.cal-cell.today');
    var trainedCells = document.querySelectorAll('.cal-cell.trained');
    var nextBtn = document.getElementById('calNextMonth');
    return {
      calExists: !!cal,
      todayIsTrained: todayCell ? todayCell.classList.contains('trained') : null,
      trainedCount: trainedCells.length,
      nextDisabled: nextBtn ? nextBtn.disabled : null
    };
  });
  console.log('calendario mensal (mes atual):', JSON.stringify(calInfo));
  const calOk = calInfo.calExists && calInfo.todayIsTrained === true && calInfo.trainedCount === 3 && calInfo.nextDisabled === true;
  console.log('CALENDARIO MENSAL CORRETO (hoje treinado, 3 dias verdes, sem navegar pro futuro):', calOk);

  // Clica no dia de hoje (treinado) -> deve abrir o detalhe de sessao
  await page.click('.cal-cell.today.clickable');
  await page.waitForTimeout(200);
  const modalOpen = await page.evaluate(() => document.getElementById('sessionDetailModal').classList.contains('show'));
  console.log('clicar no dia treinado do calendario abre o detalhe de sessao:', modalOpen);
  await page.click('#sessionDetailClose');
  await page.waitForTimeout(150);

  // Navega pro mes anterior e confere que o botao "proximo" volta a ficar habilitado
  await page.click('#calPrevMonth');
  await page.waitForTimeout(200);
  const afterPrev = await page.evaluate(() => ({
    nextDisabled: document.getElementById('calNextMonth').disabled,
    label: document.querySelector('.cal-month-label').textContent
  }));
  console.log('apos navegar pro mes anterior:', JSON.stringify(afterPrev));
  const navOk = afterPrev.nextDisabled === false;
  console.log('NAVEGACAO DE MES FUNCIONA (proximo habilitado ao sair do mes atual):', navOk);

  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
