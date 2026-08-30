#!/usr/bin/env node
/**
 * CloakBrowser 持久化启动器
 * 使用 launchPersistentContext + userDataDir 指向 /workspace/.browser-profiles/cloakbrowser
 * 登录态(cookie/localStorage)保存在持久化目录,沙盒重置后依然有效,无需重新登录。
 *
 * 用法:
 *   node cb-persistent.mjs <url1> [url2 ...]     # 打开一个或多个 URL
 *   node cb-persistent.mjs                        # 仅启动浏览器(默认打开 about:blank)
 *
 * 说明:
 * - profile 保存在 /workspace/.browser-profiles/cloakbrowser (跨沙盒重置保留)
 * - 保持运行直到 Ctrl+C;关闭时自动把 profile 回写到持久化目录
 */
import { launchPersistentContext } from 'cloakbrowser';

const PROFILE_DIR = '/workspace/.browser-profiles/cloakbrowser';
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['about:blank'];

let context;
try {
  console.log(`[*] 启动 CloakBrowser (持久化 profile: ${PROFILE_DIR}) ...`);
  context = await launchPersistentContext({
    userDataDir: PROFILE_DIR,
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  console.log('[✓] 浏览器已启动(持久化上下文)');

  // 持久化上下文自带一个空白页
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const url of targets) {
    try {
      console.log(`[*] 打开: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      console.log(`[✓] -> title="${await page.title()}" url=${page.url()}`);
    } catch (e) {
      console.log(`[✗] ${url} 打开失败: ${e.message}`);
    }
  }

  console.log('[i] 浏览器保持运行中,按 Ctrl+C 退出(profile 自动回写)...');
  // 保持进程存活,等待 SIGINT
  await new Promise((resolve) => {
    process.on('SIGINT', async () => {
      console.log('\n[*] 收到退出信号,关闭浏览器并回写 profile ...');
      try { await context.close(); } catch {}
      console.log('[✓] profile 已保存:', PROFILE_DIR);
      process.exit(0);
    });
  });
} catch (e) {
  console.error('[✗] 启动失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
