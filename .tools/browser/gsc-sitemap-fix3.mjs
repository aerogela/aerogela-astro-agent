#!/usr/bin/env node
/**
 * GSC sitemap 收尾 v3(按官方流程):
 * 1) 点击旧行进入详情页 → 更多选项(⋮) → 移除站点地图 → 确认"移除"
 * 2) 回列表重新提交 sitemap-index.xml(robots 修复后触发重抓)
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
  await page.setViewportSize({ width: 1400, height: 950 });

  const GSC = 'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com';
  await page.goto(GSC, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);

  // ---- 1) 进入旧 sitemap.xml 详情页 ----
  const oldRow = page.locator('tr, [role="row"]', { hasText: 'aerogela.com/sitemap.xml' }).first();
  if (!(await oldRow.isVisible().catch(() => false))) {
    console.log('[i] 旧 sitemap.xml 行不存在,跳过删除');
  } else {
    // 点击行的第一个单元格(URL 文本)进入详情
    await oldRow.locator('td, [role="cell"]').first().click({ force: true });
    await sleep(5000);
    console.log('[i] 详情页 URL:', page.url().slice(0, 120));

    // 找"更多选项"三个点按钮
    const moreInfo = await page.evaluate(() =>
      [...document.querySelectorAll('[role="button"], button')]
        .filter((e) => e.offsetParent !== null)
        .map((e) => ({ aria: e.getAttribute('aria-label'), text: (e.innerText || '').slice(0, 15) }))
        .slice(-15)
    );
    console.log('[probe] 详情页可见按钮(尾部15):', JSON.stringify(moreInfo));

    const moreBtn = page
      .locator('[role="button"][aria-label*="更多"], button[aria-label*="更多"], [aria-label*="More options" i], [aria-label*="更多选项"]')
      .first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await sleep(1500);
      const items = await page.evaluate(() =>
        [...document.querySelectorAll('[role="menuitem"], .qVU5Se, [jsname="j7LFlb"]')]
          .filter((e) => e.offsetParent !== null)
          .map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim())
      );
      console.log('[probe] 菜单项:', JSON.stringify(items));
      const removeItem = page
        .locator('[role="menuitem"], [jsname="j7LFlb"]')
        .filter({ hasText: /移除|删除|Remove/i })
        .first();
      if (await removeItem.isVisible().catch(() => false)) {
        await removeItem.click();
        await sleep(2000);
        // 确认对话框按钮"移除"
        const confirm = page.getByRole('button', { name: /^(移除|删除|Remove|Delete)$/i }).last();
        if (await confirm.isVisible().catch(() => false)) {
          await confirm.click();
          console.log('[✓] 已确认移除旧 sitemap.xml');
        } else {
          console.log('[✓] 已点移除(无确认框)');
        }
        await sleep(4000);
      } else {
        console.log('[!] 菜单中无移除项');
      }
    } else {
      console.log('[!] 未找到更多选项按钮');
    }
  }

  // ---- 2) 回列表,重新提交 sitemap-index.xml ----
  await page.goto(GSC, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(5000);
  const inputInfo = await page.evaluate(() =>
    [...document.querySelectorAll('input')].map((i) => ({
      type: i.type,
      aria: i.getAttribute('aria-label')?.slice(0, 40),
      val: i.value.slice(0, 30),
      vis: i.offsetParent !== null,
    }))
  );
  console.log('[probe] inputs:', JSON.stringify(inputInfo));

  // 优先 aria-label 含"站点地图"的输入框,否则第一个可见 text
  let input = page.locator('input[aria-label*="站点地图"], input[aria-label*="sitemap" i]').first();
  if (!(await input.isVisible().catch(() => false))) input = page.locator('input[type="text"]').first();
  await input.click();
  await input.fill('sitemap-index.xml');
  await sleep(1200);
  const submit = page.getByRole('button', { name: /^(提交|submit)$/i }).first();
  if (await submit.isEnabled().catch(() => false)) {
    await submit.click({ timeout: 8000 });
    console.log('[✓] 点击了提交按钮');
  } else {
    await input.press('Enter');
    console.log('[✓] 已按 Enter 提交');
  }
  await sleep(5000);
  const toast = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[role="status"], [role="alert"]')].map((x) => x.innerText).filter(Boolean);
    return t.join(' | ') || null;
  });
  if (toast) console.log('[toast]', toast);

  // ---- 3) 最终状态 ----
  await page.goto(GSC, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(6000);
  const text = await page.evaluate(() => document.body.innerText);
  const m = text.match(/已提交的站点地图[\s\S]{0,600}/);
  if (m) console.log('\n=== GSC 最终状态 ===\n' + m[0].replace(/\n{2,}/g, '\n'));
  await page.screenshot({ path: '/workspace/.screenshots/gsc-sitemaps-final.png' });

  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗]', e.message.split('\n')[0]);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
