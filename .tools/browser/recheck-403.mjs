#!/usr/bin/env node
/**
 * 名录官网 CloakBrowser 复核(403/ERR 的 11 个)
 * 用真实浏览器指纹访问,判断是 WAF 误拦还是网站真异常
 */
import { launchPersistentContext } from 'cloakbrowser';

process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');

const targets = [
  { slug: 'armacell-international-aerogel-insulation', url: 'https://www.armacell.com/en-SG', kw: 'Armacell' },
  { slug: 'anton-paar', url: 'https://www.anton-paar.com/corp-en/', kw: 'Anton Paar' },
  { slug: 'characterization-facility-university-of-minnesota', url: 'https://cse.umn.edu/charfac', kw: 'Characterization' },
  { slug: 'distribution-international', url: 'https://www.distributioninternational.com/', kw: 'Distribution International' },
  { slug: 'r-s-hughes-company-inc', url: 'https://www.rshughes.com/', kw: 'Hughes' },
  { slug: 'rise-research-institutes-of-sweden', url: 'https://www.ri.se/en', kw: 'RISE' },
  { slug: 'shannon-global-energy-solutions', url: 'https://www.shannonglobalenergy.com/', kw: 'Shannon' },
  { slug: 'sino-aerogel-zhongke-huaan', url: 'https://sino-aerogel.com/', kw: '' },
  { slug: 'specialty-products-and-insulation-spi', url: 'https://www.spi-co.com/', kw: 'SPI' },
  { slug: 'tci-europe-n-v', url: 'https://www.tcichemicals.com/', kw: 'TCI' },
  { slug: 'hebei-jinna-low-carbon-materials', url: '', kw: '' }, // 从 JSON 读
];

import { readFileSync } from 'node:fs';
const jinna = JSON.parse(readFileSync('/workspace/aerogela-astro/src/content/listings/hebei-jinna-low-carbon-materials.json', 'utf8'));
targets.find((t) => t.slug === 'hebei-jinna-low-carbon-materials').url = jinna.website;
console.log('[i] hebei-jinna website 字段:', jinna.website);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
      const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2000);
      const status = resp ? resp.status() : 'n/a';
      const title = (await page.title()).trim();
      const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
      const kwHit = t.kw ? (title + body).toLowerCase().includes(t.kw.toLowerCase()) : null;
      const ok = status === 200;
      results.push({ ...t, status, title: title.slice(0, 80), ok, kwHit });
      console.log(`[${ok ? '✓' : '✗'}] ${t.slug} — HTTP ${status} | title="${title.slice(0, 70)}"${t.kw ? ` | 关键词${t.kw}:${kwHit ? '✓' : '✗'}` : ''} | 最终URL=${page.url().slice(0, 80)}`);
    } catch (e) {
      results.push({ ...t, status: 'ERR', title: e.message.slice(0, 90), ok: false });
      console.log(`[✗] ${t.slug} — ERR: ${e.message.slice(0, 100)}`);
    }
  }
  await context.close();
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== CloakBrowser 复核: ${pass}/${results.length} 可正常访问 ===`);
} catch (e) {
  console.error('[✗] 复核失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
