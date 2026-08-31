#!/usr/bin/env node
/**
 * Bing Webmaster 登录态验证(CloakBrowser 持久化 profile)
 * 启动 CloakBrowser -> 打开 Bing Webmaster -> 检查是否免登录进入 dashboard
 * 用法: node bing-verify.mjs
 */
import { launchPersistentContext } from 'cloakbrowser';

// 沙盒重置后系统动态库(libatk 等)会丢失,注入 workspace 内离线库。
// 必须在浏览器 launch 前设置,Chrome 子进程继承本进程 env;注入后可裸跑本脚本。
process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');
// Chromium 二进制本地化:缓存指向 workspace(跨沙盒重置保留),固定版本禁后台更新
// (升级时删注释手动: cd cloakbrowser-cache && npx cloakbrowser update)
process.env.CLOAKBROWSER_CACHE_DIR ??= '/workspace/.tools/browser/cloakbrowser-cache';
process.env.CLOAKBROWSER_AUTO_UPDATE ??= 'false';


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
