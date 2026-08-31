#!/usr/bin/env node
/**
 * SEO 每日监控:aerogela.com 的 GSC + Bing Webmaster 双后台数据采集与判定。
 * - 采集: GSC sitemap 状态/URL数/索引数 + Bing sitemap 状态/URL数
 * - 判定: 与 reports/state.json 历史基线对比,输出 [判定] 结论行
 * - 输出: reports/YYYY-MM-DD-se-monitor.md + 控制台; 退出码 0=正常 1=异常
 * 修复动作(重提交 sitemap 等)由调用方 agent 决策,脚本只采集判定。
 */
import { launchPersistentContext } from 'cloakbrowser';
import fs from 'node:fs';
import path from 'node:path';

process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');
// Chromium 二进制本地化:缓存指向 workspace(跨沙盒重置保留),固定版本禁后台更新
process.env.CLOAKBROWSER_CACHE_DIR ??= '/workspace/.tools/browser/cloakbrowser-cache';
process.env.CLOAKBROWSER_AUTO_UPDATE ??= 'false';

const REPORT_DIR = '/workspace/.tools/browser/reports';
const STATE_FILE = path.join(REPORT_DIR, 'state.json');
const BASE_URL_COUNT = 222;          // 全站 URL 基线(2026-08-30 全量校对)
const URL_DROP_PCT = 0.1;            // sitemap URL 数骤降阈值 10%
const INDEX_DROP_PCT = 0.2;          // GSC 已编入索引环比骤降阈值 20%

fs.mkdirSync(REPORT_DIR, { recursive: true });
const prev = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

const grab = (page, url, ms, len = 4000) =>
  page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    .then(() => sleep(ms))
    .then(() => page.evaluate((n) => document.body.innerText.slice(0, n), len));

let context;
const issues = [];
const data = {};

try {
  context = await launchPersistentContext({
    userDataDir: '/workspace/.browser-profiles/cloakbrowser',
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.setViewportSize({ width: 1280, height: 900 });

  /* ---------- 1) GSC ---------- */
  const gscSite = 'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com';
  let t = await grab(page, gscSite, 6000);
  if (/登录|sign in|accounts\.google/i.test(t) || page.url().includes('accounts.google')) {
    issues.push('GSC 登录失效(LOGIN_EXPIRED,需人工重新登录)');
    data.gscLogin = false;
  } else {
    data.gscLogin = true;
    // 表格为制表符分隔: "...sitemap-index.xml\t站点地图索引\t日期\t日期\t成功\t222\t0"
    data.gscSitemapOk = /sitemap-index\.xml[^\n]*?成功/.test(t);
    const rowM = t.match(/sitemap-index\.xml[^\n]*?成功\D{0,10}(\d[\d,]*)/);
    data.gscSitemapUrls = rowM ? parseInt(rowM[1].replace(/,/g, '')) : null;
    if (!data.gscSitemapOk) issues.push('GSC sitemap-index.xml 状态非成功(可能无法读取)');
    if (data.gscSitemapUrls != null && data.gscSitemapUrls < BASE_URL_COUNT * (1 - URL_DROP_PCT))
      issues.push(`GSC sitemap URL 数骤降:${data.gscSitemapUrls} < ${Math.round(BASE_URL_COUNT * (1 - URL_DROP_PCT))}`);

    // 页面索引报告:已编入索引/未编入索引
    t = await grab(page, 'https://search.google.com/search-console/index?resource_id=sc-domain%3Aaerogela.com', 6500);
    const idxAll = t.match(/(?:已编入索引|Indexed)[^\d]{0,40}([\d,]+)/i);
    const idxNot = t.match(/(?:未编入索引|Not indexed)[^\d]{0,40}([\d,]+)/i);
    data.gscIndexed = idxAll ? parseInt(idxAll[1].replace(/,/g, '')) : null;
    data.gscNotIndexed = idxNot ? parseInt(idxNot[1].replace(/,/g, '')) : null;
    if (data.gscIndexed != null && prev?.gscIndexed && data.gscIndexed < prev.gscIndexed * (1 - INDEX_DROP_PCT))
      issues.push(`GSC 已编入索引环比骤降:${prev.gscIndexed} → ${data.gscIndexed}`);
  }

  /* ---------- 2) Bing ---------- */
  t = await grab(page, 'https://www.bing.com/webmasters/sitemaps', 7000);
  if (/\/about|signin|log ?on/i.test(page.url())) {
    issues.push('Bing 登录失效(LOGIN_EXPIRED,需人工重新登录)');
    data.bingLogin = false;
  } else {
    data.bingLogin = true;
    // 列格式: "sitemap-0.xml\nSitemap\n\n8/30/2026\nSubmitted\n8/30/2026\nSuccess\n222"
    const mOk = /sitemap-0\.xml[\s\S]{0,350}?Success/.test(t);
    const m = t.match(/sitemap-0\.xml[\s\S]{0,350}?Success\D{0,5}(\d[\d,]*)/);
    data.bingSitemapOk = mOk;
    data.bingSitemapUrls = m ? parseInt(m[1].replace(/,/g, '')) : null;
    if (!data.bingSitemapOk) issues.push('Bing sitemap-0.xml 状态非 Success');
    if (data.bingSitemapUrls != null && data.bingSitemapUrls < BASE_URL_COUNT * (1 - URL_DROP_PCT))
      issues.push(`Bing sitemap URL 数骤降:${data.bingSitemapUrls}`);
  }

  await context.close();

  /* ---------- 报告 ---------- */
  const ok = issues.length === 0;
  const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${(((a - b) / b) * 100).toFixed(1)}%` : '(无基线)');
  const lines = [
    `# SEO 监控报告 ${today}`,
    '',
    `## GSC`,
    `- 登录态: ${data.gscLogin ? '✓' : '✗ 失效'}`,
    data.gscLogin && `- sitemap-index.xml: ${data.gscSitemapOk ? '成功' : '异常'} | ${data.gscSitemapUrls ?? '?'} URL(基线 ${BASE_URL_COUNT})`,
    data.gscIndexed != null && `- 已编入索引: ${data.gscIndexed}${prev?.gscIndexed ? `(上次 ${prev.gscIndexed},${pct(data.gscIndexed, prev.gscIndexed)})` : '(首次记录,设为基线)'}`,
    data.gscNotIndexed != null && `- 未编入索引: ${data.gscNotIndexed}`,
    `## Bing`,
    `- 登录态: ${data.bingLogin ? '✓' : '✗ 失效'}`,
    data.bingLogin && `- sitemap-0.xml: ${data.bingSitemapOk ? 'Success' : '异常'} | ${data.bingSitemapUrls ?? '?'} URL`,
    '',
    `## 判定`,
    ok ? '**OK** — 双平台正常,无需干预。' : `**${issues.length} 项异常**:\n${issues.map((s) => `- ${s}`).join('\n')}`,
  ].filter(Boolean);

  const reportFile = path.join(REPORT_DIR, `${today}-se-monitor.md`);
  fs.writeFileSync(reportFile, lines.join('\n') + '\n');
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    date: today,
    gscIndexed: data.gscIndexed,
    gscSitemapUrls: data.gscSitemapUrls,
    bingSitemapUrls: data.bingSitemapUrls,
    prev: prev ? { date: prev.date, gscIndexed: prev.gscIndexed } : null,
  }, null, 2));

  console.log(lines.join('\n'));
  console.log(`\n[report] ${reportFile}`);
  console.log(`[判定] ${ok ? 'OK' : 'ISSUES'}`);
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('[✗] 采集失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
