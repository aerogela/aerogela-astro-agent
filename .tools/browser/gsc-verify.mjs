#!/usr/bin/env node
/**
 * GSC 持久化登录态验证
 * 用 CloakBrowser 持久化 profile 打开 GSC sitemaps 页,验证免登录直接进入。
 * 用法: node gsc-verify.mjs
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

  await page.goto(
    'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com',
    { waitUntil: 'domcontentloaded', timeout: 45000 }
  );
  await sleep(5000);

  const url = page.url();
  const loggedIn = !url.includes('accounts.google.com') && !url.includes('/signin');
  const title = await page.title();
  console.log('[i] url:', url);
  console.log('[i] title:', title);
  console.log(loggedIn ? '[✓] 免登录直达 GSC sitemaps 页面 — 持久化生效!' : '[✗] 仍跳转登录页 — 持久化未生效');

  // 提取页面可见文本片段佐证
  const bodyStart = (await page.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\n+/g, ' | ');
  console.log('[i] 页面内容:', bodyStart);

  await page.screenshot({ path: '/workspace/.screenshots/cloak-gsc-verify.png' });
  await context.close();
  process.exit(loggedIn ? 0 : 1);
} catch (e) {
  console.error('[✗] 验证失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
