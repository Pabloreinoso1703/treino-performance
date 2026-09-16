const { chromium } = require('playwright');
(async () => {
  // Sessão 3.18, feature 3 — fotos de progresso: upload (com compressão via
  // canvas), tira de miniaturas, e comparação lado a lado ao tocar em duas.
  const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if(msg.type()==='error' && !msg.text().includes('permissions policy')) errors.push('CONSOLE ERROR: ' + msg.text()); });

  function isoDaysAgo(n){ var d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); }

  // Seed com 1 foto (um PNG 1x1 vermelho em base64, só pra existir um registro
  // prévio) pra validar que a tira e a comparação lidam bem com fotos já
  // existentes antes de fazer upload de uma nova.
  const tinyPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const seed = {
    treino_photos: {
      p1: { data: isoDaysAgo(10), imagem: tinyPngDataUrl, criadoEm: new Date().toISOString() }
    }
  };

  await page.addInitScript((seedData) => { window.__SEED__ = seedData; }, seed);
  await page.route('**/firebasejs/**', route => {
    route.fulfill({ contentType: 'application/javascript', body: require('fs').readFileSync(__dirname + '/firebase-stub-stateful.js', 'utf8') });
  });
  await page.route('**/youtube.com/**', route => route.abort());

  let firestoreAddLine = null;
  page.on('console', msg => { if(msg.text().startsWith('FIRESTORE ADD:') && msg.text().indexOf('imagem') !== -1) firestoreAddLine = msg.text(); });

  await page.goto('file://' + __dirname + '/index.html');
  await page.fill('#pw', 'acad1703');
  await page.click('#btnEnter');
  await page.waitForTimeout(500);

  await page.click('nav.tabs button[data-tab="progresso"]');
  await page.waitForTimeout(300);

  const beforeUpload = await page.evaluate(() => ({
    thumbCount: document.querySelectorAll('.photo-thumb').length,
    panelExists: !!document.querySelector('#photoStrip')
  }));
  console.log('antes do upload (1 foto seedada):', JSON.stringify(beforeUpload));

  // Cria um arquivo de imagem de teste (PNG pequeno) e faz upload via input file
  const fs = require('fs');
  const pngPath = __dirname + '/test-upload.png';
  fs.writeFileSync(pngPath, Buffer.from(tinyPngDataUrl.split(',')[1], 'base64'));
  await page.setInputFiles('#photoUploadInput', pngPath);
  await page.waitForTimeout(500);
  console.log('FIRESTORE ADD (foto):', firestoreAddLine ? firestoreAddLine.slice(0,120) + '...' : null);
  const uploadOk = firestoreAddLine && firestoreAddLine.indexOf('"imagem":"data:image') !== -1 && firestoreAddLine.indexOf('"data":"' + new Date().toISOString().slice(0,10)) !== -1;
  console.log('UPLOAD SALVOU FOTO COMPRIMIDA COMO data: URL:', uploadOk);

  await page.waitForTimeout(300);
  const afterUpload = await page.evaluate(() => document.querySelectorAll('.photo-thumb').length);
  console.log('miniaturas apos upload (esperado 2):', afterUpload);

  // Seleciona as 2 fotos pra comparar
  await page.click('.photo-thumb:nth-child(1)');
  await page.click('.photo-thumb:nth-child(2)');
  await page.waitForTimeout(200);
  const compareInfo = await page.evaluate(() => {
    var slots = document.querySelectorAll('.pc-slot');
    return {
      slotCount: slots.length,
      imgsInSlots: Array.from(slots).filter(s => s.querySelector('img')).length,
      selectedThumbs: document.querySelectorAll('.photo-thumb.selected').length
    };
  });
  console.log('comparacao lado a lado apos selecionar 2 fotos:', JSON.stringify(compareInfo));
  const compareOk = compareInfo.slotCount === 2 && compareInfo.imgsInSlots === 2 && compareInfo.selectedThumbs === 2;
  console.log('COMPARACAO LADO A LADO CORRETA:', compareOk);

  fs.unlinkSync(pngPath);
  console.log('ERRORS:', JSON.stringify(errors, null, 2));
  await browser.close();
})();
