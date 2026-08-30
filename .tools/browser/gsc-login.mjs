#!/usr/bin/env node
/**
 * GSC 登录脚本(CloakBrowser 持久化 profile)
 * 登录 Google Search Console 并把登录态写入 /workspace/.browser-profiles/cloakbrowser
 * 之后用 cb-persistent.mjs 启动即可免登录访问 GSC。
 *
 * 用法: node gsc-login.mjs
 */
import { launchPersistentContext } from 'cloakbrowser';
import crypto from 'node:crypto';

// 沙盒重置后系统动态库(libatk 等)会丢失,注入 workspace 内离线库。
// 必须在浏览器 launch 前设置,Chrome 子进程继承本进程 env;注入后可裸跑本脚本。
process.env.LD_LIBRARY_PATH = [
  '/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu',
  process.env.LD_LIBRARY_PATH,
].filter(Boolean).join(':');

const PROFILE_DIR = '/workspace/.browser-profiles/cloakbrowser';
const EMAIL = 'aerogelaa@gmail.com';
const PASSWORD = 'KDrn2738ga$';
const TOTP_SECRET = 'mcxqvws3o26lozsgiwww4ctf2jdlsvpo';

// ---- TOTP 计算(与 Python 版同算法) ----
function totp(secret, step = 30) {
  const b32 = secret.toUpperCase().replace(/=+$/, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of b32) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const buf = Buffer.alloc(Math.floor(bits.length / 8));
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  const counter = Math.floor(Date.now() / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', buf).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let context;
try {
  console.log(`[*] 启动 CloakBrowser (持久化 profile: ${PROFILE_DIR}) ...`);
  context = await launchPersistentContext({
    userDataDir: PROFILE_DIR,
    headless: true,
    humanize: false,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = context.pages()[0] || await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. 打开 GSC 具体资源页(sitemaps)验证真实登录态
  console.log('[*] 打开 Google Search Console (sitemaps) ...');
  await page.goto(
    'https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aaerogela.com',
    { waitUntil: 'domcontentloaded', timeout: 45000 }
  );
  await sleep(4000);
  console.log('[i] url:', page.url());

  // 若跳转到 accounts.google.com 或含 /signin => 未登录,走登录流程;否则已登录
  const loggedIn = !page.url().includes('accounts.google.com') && !page.url().includes('/signin');
  if (loggedIn) {
    console.log('[✓] 已处于登录态,无需重新登录');
    await page.screenshot({ path: '/workspace/.screenshots/cloak-gsc-loggedin.png' });
    await context.close();
    process.exit(0);
  }

  // 2. 邮箱
  console.log('[*] 输入邮箱 ...');
  const emailBox = page.locator('input[type="email"], input[name="identifier"]').first();
  await emailBox.click();
  await emailBox.fill(EMAIL);
  await page.keyboard.press('Enter');
  await sleep(3500);

  // 3. 密码
  console.log('[*] 输入密码 ...');
  const pwdBox = page.locator('input[type="password"]').first();
  await pwdBox.click();
  await pwdBox.fill(PASSWORD);
  await page.keyboard.press('Enter');
  await sleep(4000);

  // 4. TOTP 2FA(可能直接进入,也可能需要点确认)
  const code = totp(TOTP_SECRET);
  console.log(`[*] TOTP 验证码: ${code}`);
  let otpBox = page.locator('input[type="tel"], input[name="totp"], input[autocomplete="one-time-code"]').first();
  if (await otpBox.count() > 0) {
    await otpBox.click();
    await otpBox.fill(code);
    await page.keyboard.press('Enter');
    await sleep(5000);
  } else {
    console.log('[i] 未直接出现 OTP 输入框,检查页面状态 ...');
  }

  // 5. 处理可能的 "确认您的设备" / 其他中间页
  for (let i = 0; i < 4; i++) {
    const url = page.url();
    if (url.includes('search.google.com')) break;
    // 找可见的主按钮(Next / Continue / I agree 等)点击
    const btn = page.locator('button:visible').filter({ hasText: /Continue|Next|I agree|Got it/ }).first();
    if (await btn.count() > 0) {
      console.log('[i] 点击中间页按钮 ...');
      await btn.click();
      await sleep(3000);
    } else {
      break;
    }
  }

  // 6. 等待最终落地
  await page.waitForURL(/search\.google\.com/, { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  console.log('[✓] 最终 url:', page.url());
  await page.screenshot({ path: '/workspace/.screenshots/cloak-gsc-loggedin.png' });
  console.log('[✓] GSC 登录完成,profile 已持久化:', PROFILE_DIR);
  await context.close();
  process.exit(0);
} catch (e) {
  console.error('[✗] 登录失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
