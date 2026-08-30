#!/usr/bin/env node
/**
 * Bing Webmaster 登录态验证(CloakBrowser 持久化 profile)
 * 启动 CloakBrowser -> 打开 Bing Webmaster -> 检查是否免登录进入 dashboard
 * 用法: node bing-verify.mjs
 */
import { launchPersistentContext } from 'cloakbrowser';

const PROFILE_DIR = '/workspace/.browser-profiles/cloakbrowser';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let context;
try {
  context = await launchPersistentContext({
    userDataDir: PROFILE_DIR,
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto('https://www.bing.com/webmasters/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);
  console.log('[i] Bing Webmaster url:', page.url());

  const ok = /bing\.com\/webmasters/.test(page.url()) && !/\/about/.test(page.url()) && !/signin/i.test(page.url());
  console.log(ok ? '[✓] Bing 登录态有效(免登录直达 dashboard)' : '[✗] 未登录(停留在 ' + page.url() + ')');
  await page.screenshot({ path: '/workspace/.screenshots/bing-verify.png' });
  await context.close();
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('[✗] 验证失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
