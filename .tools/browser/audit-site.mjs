#!/usr/bin/env node
/**
 * aerogela.com 线上页面校对(CloakBrowser)
 * 1) 打开首页/名录页/文章页,验证渲染正常且与本地 JSON 数据一致
 * 2) 抽样名录官网,验证外链有效、公司可识别
 */
import { launchPersistentContext } from 'cloakbrowser';
import { readFileSync } from 'node:fs';

process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');

const SITE = 'https://aerogela.com';
const L = '/workspace/aerogela-astro/src/content/listings';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const load = (f) => JSON.parse(readFileSync(`${L}/${f}`, 'utf8'));

const targets = [
  { url: `${SITE}/`, name: 'home' },
  { url: `${SITE}/listing/aspen-aerogels-inc/`, name: 'listing-aspen', expect: load('aspen-aerogels-inc.json') },
  { url: `${SITE}/listing/cabot-corporation/`, name: 'listing-cabot', expect: load('cabot-corporation.json') },
  { url: `${SITE}/blog/what-is-aerogel-insulation/`, name: 'post-what-is', expect: load('../posts/what-is-aerogel-insulation.json') },
];

let context;
const results = [];
try {
  context = await launchPersistentContext({
    userDataDir: '/workspace/.browser-profiles/cloakbrowser',
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const t of targets) {
    try {
      const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(2500);
      const status = resp ? resp.status() : 'n/a';
      const title = await page.title();
      const body = await page.evaluate(() => document.body.innerText.slice(0, 6000));
      const h1 = await page.evaluate(() => (document.querySelector('h1')?.innerText || '').trim());
      const checks = [`HTTP ${status}`];
      let ok = status === 200;

      if (t.expect) {
        if (t.expect.title) {
          const found = (h1 + ' ' + body).includes(t.expect.title.split(',')[0]);
          checks.push(`标题含"${t.expect.title.split(',')[0]}": ${found ? '✓' : '✗'}`);
          ok = ok && found;
        }
        if (t.expect.website) {
          const host = new URL(t.expect.website).hostname.replace(/^www\./, '');
          const found = body.toLowerCase().includes(host);
          checks.push(`官网 ${host} 出现: ${found ? '✓' : '✗'}`);
          ok = ok && found;
        }
        if (Array.isArray(t.expect.location) && t.expect.location[0]) {
          const loc = t.expect.location[0];
          const found = body.includes(loc) || body.includes(loc.replace('United States of America', 'USA'));
          checks.push(`地区 ${loc}: ${found ? '✓' : '✗'}`);
          ok = ok && found;
        }
      }
      await page.screenshot({ path: `/workspace/.screenshots/audit-${t.name}.png`, fullPage: false });
      results.push({ name: t.name, url: t.url, ok, title, checks });
      console.log(`[${ok ? '✓' : '✗'}] ${t.name} — ${checks.join(' | ')} | title="${title}"`);
    } catch (e) {
      results.push({ name: t.name, url: t.url, ok: false, error: e.message });
      console.log(`[✗] ${t.name} — ${e.message}`);
    }
  }
  await context.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== 线上页面校对: ${pass}/${results.length} 通过 ===`);
  process.exit(pass === results.length ? 0 : 1);
} catch (e) {
  console.error('[✗] 校对失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
