// A cached teachers-sun-class.html must replace itself with the published
// build after one load, and must not reload a second time.
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire('/tmp/np/package.json');
const puppeteer = require('puppeteer-core');

const PUBLISHED = 'sun-20261120c';
const real = readFileSync(new URL('../teachers-sun-class.html', import.meta.url), 'utf8');
const stamp = readFileSync(new URL('../sun-class-build.txt', import.meta.url), 'utf8').trim();
if (stamp !== PUBLISHED || !real.includes("var BUILD = '" + PUBLISHED + "'")) {
  console.error('stamp and page BUILD disagree');
  process.exit(1);
}
const freshHtml = real.replace(/<script type="module">[\s\S]*<\/script>/, '');
const staleHtml = freshHtml.replaceAll(PUBLISHED, 'sun-old');

function doc(html) {
  return {
    status: 200,
    contentType: 'text/html',
    headers: { 'cache-control': 'max-age=600' },
    body: html,
  };
}

let failed = 0;
function check(name, cond, detail) {
  if (cond) console.log('  ok  ' + name + (detail ? '  ' + detail : ''));
  else { failed++; console.log('  FAIL ' + name + (detail ? '  ' + detail : '')); }
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox'],
});

async function withPage(route) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', route);
  return page;
}

{
  let freshLoads = 0;
  const page = await withPage((req) => {
    const url = req.url();
    if (url.includes('sun-class-build.txt')) {
      req.respond({
        status: 200,
        contentType: 'text/plain',
        headers: { 'cache-control': 'no-store' },
        body: PUBLISHED + '\n',
      });
      return;
    }
    if (!url.includes('teachers-sun-class.html')) { req.abort(); return; }
    if (url.includes('fresh=1')) { freshLoads++; req.respond(doc(freshHtml)); return; }
    req.respond(doc(staleHtml));
  });
  await page.goto('http://127.0.0.1/teachers-sun-class.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    (id) => document.documentElement.getAttribute('data-build') === id && location.search.includes('fresh=1'),
    { timeout: 5000 },
    PUBLISHED,
  );
  const enabled = await page.evaluate(() => document.getElementById('start-btn').disabled === false);
  await new Promise((r) => setTimeout(r, 400));
  check('cached URL ends on the published build', freshLoads === 1 && enabled, 'loads ' + freshLoads + ' enabled ' + enabled);
  await page.close();
}

{
  const page = await withPage((req) => {
    if (req.url().includes('sun-class-build.txt')) {
      req.respond({ status: 200, contentType: 'text/plain', body: 'sun-newer\n' });
      return;
    }
    req.respond(doc(staleHtml));
  });
  await page.goto('http://127.0.0.1/teachers-sun-class.html?fresh=1&build=sun-old', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));
  const url = page.url();
  const build = await page.evaluate(() => document.documentElement.getAttribute('data-build'));
  check('a second redirect is refused', !url.includes('sun-newer') && build === 'sun-old', url + ' ' + build);
  await page.close();
}

{
  const page = await withPage((req) => {
    if (req.url().includes('sun-class-build.txt')) { req.abort('failed'); return; }
    req.respond(doc(freshHtml));
  });
  await page.goto('http://127.0.0.1/teachers-sun-class.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('start-btn').disabled === false, { timeout: 4000 });
  const build = await page.evaluate(() => document.documentElement.getAttribute('data-build'));
  check('offline keeps this build and enables Start', build === PUBLISHED && !page.url().includes('fresh=1'), build);
  await page.close();
}

await browser.close();
if (failed) { console.log('\n' + failed + ' failed'); process.exit(1); }
console.log('all checks passed');
