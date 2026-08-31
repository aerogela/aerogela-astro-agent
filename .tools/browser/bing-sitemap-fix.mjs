#!/usr/bin/env node
/**
 * Bing Webmaster sitemap 维护(CloakBrowser):
 * 1) 提交叶子 sitemap https://aerogela.com/sitemap-0.xml
 * 2) 逐个删除旧记录(/sitemap.xml, /sitemap_index.xml, www 变体)
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
  await page.setViewportSize({ width: 1400, height: 950 });

  await page.goto('https://www.bing.com/webmasters/sitemaps', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);
  console.log('[i] 页面:', page.url());

  // ---- 1) 提交 sitemap-0.xml ----
  // 找 "Submit sitemap" 按钮
  const submitBtn = page.getByText(/submit sitemap/i).first();
  await submitBtn.click();
  await sleep(1500);
  await page.screenshot({ path: '/workspace/.screenshots/bing-submit-1.png' });

  // 出现的输入框填完整 sitemap URL
  const input = page.locator('input[type="text"], input[type="url"]').last();
  const inputVisible = await input.isVisible().catch(() => false);
  console.log('[i] 输入框可见:', inputVisible);
  if (inputVisible) {
    await input.fill('https://aerogela.com/sitemap-0.xml');
    await sleep(500);
    // 提交(可能是输入框旁的 Submit 按钮或回车)
    const goBtn = page.getByRole('button', { name: /^(submit|提交)$/i }).last();
    if (await goBtn.isVisible().catch(() => false)) await goBtn.click();
    else await input.press('Enter');
    await sleep(5000);
    await page.screenshot({ path: '/workspace/.screenshots/bing-submit-2.png' });
    console.log('[i] 已提交 sitemap-0.xml,等待生效');
  }

  // 刷新查看结果
  await page.goto('https://www.bing.com/webmasters/sitemaps', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('[i] 提交后表格片段:');
  const m = text.match(/Sitemap URL[\s\S]{0,900}/);
  console.log(m ? m[0].replace(/\n{2,}/g, '\n') : '(未匹配到表格)');

  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗]', e.message);
  await page_screenshot_safe();
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
async function page_screenshot_safe() {}
