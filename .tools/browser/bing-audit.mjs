#!/usr/bin/env node
/**
 * Bing Webmaster 后台校对(CloakBrowser 免登录):
 * sitemap 状态 + 索引概览
 */
import { launchPersistentContext } from 'cloakbrowser';

process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');
// Chromium 二进制本地化:缓存指向 workspace(跨沙盒重置保留),固定版本禁后台更新
// (升级时删注释手动: cd cloakbrowser-cache && npx cloakbrowser update)
process.env.CLOAKBROWSER_CACHE_DIR ??= '/workspace/.tools/browser/cloakbrowser-cache';
process.env.CLOAKBROWSER_AUTO_UPDATE ??= 'false';


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

  await page.goto('https://www.bing.com/webmasters/sitemaps', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(7000);
  let url = page.url();
  if (/\/about|signin/i.test(url)) {
    console.log('[!] 未进入后台,当前:', url);
  } else {
    console.log('[✓] 已进入 Bing Webmaster:', url);
    const text = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('=== Bing Sitemaps ===');
    console.log(text.replace(/\n{2,}/g, '\n').slice(0, 1400));
    await page.screenshot({ path: '/workspace/.screenshots/bing-sitemaps-audit.png' });
  }
  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗]', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
