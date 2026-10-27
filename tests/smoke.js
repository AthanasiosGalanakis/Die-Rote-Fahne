// Smoke test: opens the built game in a browser and plays it.
// Fails on any console error, script error or failed request, and when the
// game cannot get from the title screen to a later month.
//
// Usage: node tests/smoke.js [port]   (serves out/html itself)
// Needs `playwright` (CI installs it; it is not a project dependency).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'out', 'html');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  const failures = [];
  await new Promise(r => server.listen(Number(process.argv[2]) || 0, r));
  const base = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') failures.push('console error: ' + m.text()); });
  page.on('pageerror', e => failures.push('script error: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) failures.push('HTTP ' + r.status() + ' ' + r.url()); });

  const engine = () => page.evaluate(() => {
    const s = dendryUI.dendryEngine.state;
    return { scene: s.sceneId, time: s.qualities.time, year: s.qualities.year, month: s.qualities.month };
  });
  const wait = ms => page.waitForTimeout(ms);
  const clickLink = async (text) => {
    await page.locator('#content a', { hasText: text }).first().click();
    await wait(400);
  };

  await page.goto(base);
  await wait(1500);

  // every RF function the scenes call must exist (catches removed helpers)
  const missing = await page.evaluate(() => {
    const names = new Set();
    for (const m of window.game.compiled.matchAll(/window\.RF\.([A-Za-z_]+)/g)) names.add(m[1]);
    return [...names].filter(n => window.RF[n] === undefined);
  });
  if (missing.length) failures.push('scenes call missing RF functions: ' + missing.join(', '));

  // title-screen pages
  for (const t of ['Credits', 'Changelog', 'Achievements']) {
    await clickLink(t);
    if (!(await page.locator('#content').innerText()).trim()) failures.push(t + ' page is empty');
    const back = page.locator('#content ul.choices li:not(.unavailable) a').last();
    await back.click(); await wait(400);
  }

  await clickLink('Start Game');
  await clickLink('Begin');
  const start = await engine();
  if (start.scene !== 'rf_main') failures.push('expected the main page after Begin, got ' + start.scene);

  // every sidebar tab renders
  for (const id of ['main_tab', 'party_tab', 'poll_tab', 'missions_tab', 'moscow_tab', 'forces_tab']) {
    await page.click('#' + id); await wait(200);
    if (!(await page.locator('#qualities').innerText()).trim()) failures.push('sidebar tab ' + id + ' is empty');
  }
  await page.click('#main_tab');
  await page.click('#options-link'); await wait(200);
  if (!(await page.locator('#options').isVisible())) failures.push('Options did not open');
  await page.click('#options .close_button');

  // play: take the first available choice or card until nothing is left
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    seen.add((await engine()).scene);
    let link = page.locator('#content ul.choices li:not(.unavailable) a');
    if (!(await link.count())) link = page.locator('#content ul.hand a.card');
    if (!(await link.count())) link = page.locator('#content ul.decks a.card');
    if (!(await link.count())) break;
    await link.first().click();
    await wait(250);
  }
  const end = await engine();
  console.log('scenes visited: ' + [...seen].join(' '));
  console.log('start: ' + start.year + '-' + start.month + ', end: ' + end.year + '-' + end.month);
  if (!(end.time > start.time)) failures.push('the game never advanced a month');

  await browser.close();
  server.close();
  if (failures.length) {
    console.error('SMOKE TEST FAILED:\n- ' + [...new Set(failures)].join('\n- '));
    process.exit(1);
  }
  console.log('Smoke test passed.');
})().catch(e => { console.error(e); process.exit(1); });
