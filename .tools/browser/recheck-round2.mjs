#!/usr/bin/env node
/**
 * 二次复核:CF 挑战站点等待通过 + shannon ERR_ABORTED 排查
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
const targets = [
  { slug: 'armacell', url: 'https://www.armacell.com/en-SG', kw: 'armacell' },
  { slug: 'umn-charfac', url: 'https://cse.umn.edu/charfac', kw: 'characterization' },
  { slug: 'spi', url: 'https://www.spi-co.com/', kw: 'insulation' },
  { slug: 'tci', url: 'https://www.tcichemicals.com/', kw: 'tcichemicals' },
  { slug: 'shannon', url: 'https://www.shannonglobalenergy.com/', kw: 'shannon' },
];

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

  for (const t of targets) {
    try {
      const resp = await page.goto(t.url, { waitUntil: 'commit', timeout: 30000 }).catch(() => null);
      // CF 挑战通常 5-10s 自动通过,轮询检测
      let status = resp ? resp.status() : '?';
      let title = '';
      for (let i = 0; i < 5; i++) {
        await sleep(4000);
        title = (await page.title().catch(() => '')).trim();
        status = await page
          .evaluate(() => fetch(location.href, { method: 'HEAD', credentials: 'include' }).then((r) => r.status).catch(() => -1))
          .catch(() => -1);
        const challenged = /just a moment|access denied|verifying/i.test(title);
        console.log(`  [${t.slug}] 轮${i + 1}: fetch=${status} title="${title.slice(0, 60)}"${challenged ? ' (挑战中)' : ''}`);
        if (!challenged && title) break;
      }
      const ok = !/just a moment|access denied|verifying/i.test(title) && title.length > 0;
      console.log(`[${ok ? '✓' : '?'}] ${t.slug} — 最终 title="${title.slice(0, 70)}"\n`);
    } catch (e) {
      console.log(`[✗] ${t.slug} — ${e.message.slice(0, 110)}\n`);
    }
  }
  await context.close();
} catch (e) {
  console.error('[✗]', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
