#!/usr/bin/env node
/** 诊断:dump GSC/Bing sitemaps 页 sitemap 行附近的原始文本,校准 se-monitor 正则。 */
import { launchPersistentContext } from 'cloakbrowser';
process.env.LD_LIBRARY_PATH = ['/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
process.env.CLOAKBROWSER_CACHE_DIR ??= '/workspace/.tools/browser/cloakbrowser-cache';
process.env.CLOAKBROWSER_AUTO_UPDATE ??= 'false';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let context;
try {
  context = await launchPersistentContext({
    userDataDir: '/workspace/.browser-profiles/cloakbrowser',
    headless: true, humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);
  let t = await page.evaluate(() => document.body.innerText);
  const gi = t.indexOf('sitemap-index.xml');
  console.log('=== GSC 原始行(前后各120字) ===');
  console.log(JSON.stringify(t.slice(Math.max(0, gi - 60), gi + 260)));

  await page.goto('https://www.bing.com/webmasters/sitemaps', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(7000);
  t = await page.evaluate(() => document.body.innerText);
  const bi = t.indexOf('sitemap-0.xml');
  console.log('\n=== Bing 原始行(前后各120字) ===');
  console.log(JSON.stringify(t.slice(Math.max(0, bi - 80), bi + 300)));

  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗]', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
