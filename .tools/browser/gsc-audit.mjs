#!/usr/bin/env node
/**
 * GSC 后台校对(CloakBrowser 免登录):
 * 1) sitemap 状态  2) 页面索引报告(sitemap-0.xml)  3) 首页 URL 检查
 */
import { launchPersistentContext } from 'cloakbrowser';

process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let context;
try {
  context = await launchPersistentContext({
    userDataDir: '/workspace/.browser-profiles/cloakbrowser',
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1) sitemaps 页
  await page.goto(
    'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com',
    { waitUntil: 'domcontentloaded', timeout: 45000 }
  );
  await sleep(6000);
  const sitemapText = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  console.log('=== GSC Sitemaps ===');
  console.log(sitemapText.replace(/\n{2,}/g, '\n').slice(0, 1200));
  await page.screenshot({ path: '/workspace/.screenshots/gsc-sitemaps-audit.png' });

  // 2) 页面索引报告
  await page.goto(
    'https://search.google.com/search-console/index?resource_id=sc-domain%3Aaerogela.com',
    { waitUntil: 'domcontentloaded', timeout: 45000 }
  );
  await sleep(6000);
  const indexText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('\n=== GSC 页面索引 ===');
  console.log(indexText.replace(/\n{2,}/g, '\n').slice(0, 1500));
  await page.screenshot({ path: '/workspace/.screenshots/gsc-index-audit.png' });

  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗]', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
