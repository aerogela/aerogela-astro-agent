#!/usr/bin/env node
/**
 * Bing Webmaster 登录脚本(CloakBrowser 持久化 profile)
 * 登录 Bing Webmaster 并把登录态写入 /workspace/.browser-profiles/cloakbrowser
 * 之后用 cb-persistent.mjs 启动即可免登录访问 Bing。
 *
 * 用法: node bing-login.mjs
 */
import { launchPersistentContext } from 'cloakbrowser';
import crypto from 'node:crypto';

const PROFILE_DIR = '/workspace/.browser-profiles/cloakbrowser';
const EMAIL = 'aerogela@outlook.com';
const PASSWORD = 'KMtr7283';
const TOTP_SECRET = 'LGRL2Y7RB5RPQZPV';

// ---- TOTP 计算 ----
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
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function typeInto(page, locator, text) {
  await locator.click();
  await sleep(500);
  await locator.fill('');
  await page.keyboard.type(text, { delay: 30 });
  await sleep(500);
}

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

  // 1. 打开 Bing Webmaster 首页
  console.log('[*] 打开 Bing Webmaster ...');
  await page.goto('https://www.bing.com/webmasters/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(5000);
  console.log('[i] url:', page.url());

  // 已登录检测:登录后 URL 为 /webmasters?tid=... 且页面含 dashboard 内容
  const loggedIn = !/\/about|signin/i.test(page.url());
  if (loggedIn) {
    console.log('[✓] 已处于登录态,无需重新登录');
    await page.screenshot({ path: '/workspace/.screenshots/cloak-bing-loggedin.png' });
    await context.close();
    process.exit(0);
  }

  // 2. 点击 Sign In
  console.log('[*] 点击 Sign In ...');
  const signIn = page.getByRole('button', { name: /sign in/i }).first();
  await signIn.click();
  await sleep(3000);

  // 3. 选择 Microsoft 账号登录(signInCard 弹窗)
  console.log('[*] 选择 Microsoft 登录 ...');
  const msCard = page.locator('.signInCard').filter({ hasText: /microsoft/i }).first();
  if (await msCard.count() > 0) {
    await msCard.click();
  } else {
    const msLogo = page.locator('img[alt*="microsoft" i]').first();
    await msLogo.click();
  }
  await sleep(4000);
  console.log('[i] url:', page.url());

  // 4. 邮箱
  console.log('[*] 输入邮箱 ...');
  await page.waitForSelector('input[name="loginfmt"], input[type="email"]', { timeout: 20000 });
  await typeInto(page, page.locator('input[name="loginfmt"], input[type="email"]').first(), EMAIL);
  // 邮箱/密码/OTP 页的 Next 按钮:优先经典 id,兜底文本 "Next"
  const nextBtn = async () => (await page.locator('#idSIButton9').isVisible()) ? page.locator('#idSIButton9') : page.getByRole('button', { name: /^Next$/ }).first();
  const n1 = await nextBtn();
  await n1.waitFor({ timeout: 15000 });
  await n1.click();
  await sleep(4000);

  // 5. 密码
  console.log('[*] 输入密码 ...');
  await page.waitForSelector('input[name="passwd"], input[type="password"]', { timeout: 20000 });
  await typeInto(page, page.locator('input[name="passwd"], input[type="password"]').first(), PASSWORD);
  await sleep(2000);
  console.log('[i] 密码已输入,当前 url:', page.url());
  // 诊断:输出页面文本片段与可见按钮,判断是密码页/验证码页/OTP 页
  const diag = await page.evaluate(() => {
    const text = document.body ? document.body.innerText.slice(0, 400).replace(/\n+/g, ' | ') : '';
    const btns = [...document.querySelectorAll('button, input[type="submit"], a')]
      .filter((b) => b.offsetWidth || b.offsetHeight)
      .map((b) => (b.innerText || b.value || '').trim().slice(0, 30))
      .filter(Boolean);
    const hasPwd = !!document.querySelector('input[name="passwd"], input[type="password"]');
    const hasOtp = !!document.querySelector('input[name="otc"], input[autocomplete="one-time-code"], input[type="tel"]');
    return { text, btns: [...new Set(btns)].slice(0, 12), hasPwd, hasOtp };
  });
  console.log('[i] 页面文本:', diag.text);
  console.log('[i] 可见按钮:', JSON.stringify(diag.btns));
  console.log('[i] 密码框存在:', diag.hasPwd, '| OTP框存在:', diag.hasOtp);
  await page.screenshot({ path: '/workspace/.screenshots/bing-step-password.png' });
  // 密码页 Next 按钮(优先经典 id,兜底文本 "Next")
  const pwdNext = await nextBtn();
  await pwdNext.waitFor({ timeout: 15000 });
  await pwdNext.click();
  await sleep(5000);
  console.log('[i] 密码提交后 url:', page.url());

  // 6. TOTP 2FA
  const code = totp(TOTP_SECRET);
  console.log(`[*] TOTP 验证码: ${code}`);
  // 诊断:Microsoft 页面含隐藏 <input name="otc" type="hidden" id="otc-confirmation-input">,须排除
  const otpDiag = await page.evaluate(() => {
    return [...document.querySelectorAll('input')]
      .filter((i) => i.offsetWidth || i.offsetHeight)
      .map((i) => ({ id: i.id, name: i.name, type: i.type, autocomplete: i.autocomplete }));
  });
  console.log('[i] OTP 页可见输入框:', JSON.stringify(otpDiag));
  const otpSel = 'input[autocomplete="one-time-code"]:visible, input[name="otc"]:not([type="hidden"]):visible, #idTxtBx_SAOTCC_OTC:visible, input[type="tel"]:visible, input[id^="floatingLabelInput"]:visible';
  const otpBox = page.locator(otpSel).first();
  await otpBox.waitFor({ timeout: 20000 });
  await typeInto(page, otpBox, code);
  console.log('[i] OTP 已输入,当前 url:', page.url());
  const otpNext = (await page.locator('#idSIButton9').isVisible())
    ? page.locator('#idSIButton9')
    : page.getByRole('button', { name: /^(Next|Verify|Continue)$/i }).first();
  await otpNext.waitFor({ timeout: 15000 });
  await otpNext.click();
  await sleep(3000);
  console.log('[i] OTP 提交后 url:', page.url());

  // 6.5 处理 Microsoft 安全引导页(fido/create / passkey 等)
  if (/fido|passkey|hello|security|safe/i.test(page.url())) {
    console.log('[*] 检测到安全设置引导页(fido/passkey) ...');
    // 枚举页面可点击元素(诊断 + 找跳过入口)
    const links = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button, input[type="submit"], input[type="button"]')]
        .filter((b) => b.offsetWidth || b.offsetHeight);
      return els.map((b) => ({ tag: b.tagName, text: (b.innerText || b.value || '').trim().slice(0, 60), href: b.href || '' }))
        .filter((x) => x.text || x.href);
    });
    console.log('[i] 引导页可点击元素:', JSON.stringify(links.slice(0, 30)));
    // 尝试点击含跳过语义的元素
    for (const l of links) {
      if (/skip|not now|later|cancel|close|done|continue/i.test(l.text) || /skip|later|cancel/i.test(l.href)) {
        console.log(`[*] 点击: ${l.tag} "${l.text}" ${l.href}`);
        await page.evaluate((txt) => {
          const el = [...document.querySelectorAll('a, button, input[type="submit"], input[type="button"]')]
            .find((b) => (b.innerText || b.value || '').trim() === txt);
          if (el) el.click();
        }, l.text);
        await sleep(4000);
        console.log('[i] 点击后 url:', page.url());
        if (!/fido|passkey|hello|security|safe/i.test(page.url())) break;
      }
    }
    // 若仍在引导页,用 CDP 虚拟认证器完成 passkey 设置
    if (/fido|passkey|hello|security|safe/i.test(page.url())) {
      console.log('[*] 尝试用 CDP 虚拟认证器完成 passkey ...');
      for (const transport of ['internal', 'usb']) {
        try {
          const cdp = await context.newCDPSession(page);
          await cdp.send('WebAuthn.enable');
          await cdp.send('WebAuthn.addVirtualAuthenticator', {
            options: { protocol: 'ctap2', transport, hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
          });
          console.log(`[i] 已启用虚拟认证器(transport=${transport})`);
        } catch (e) {
          console.log('[i] 虚拟认证器不可用:', e.message);
        }
      }
      const nextBtn2 = page.getByRole('button', { name: /^Next$/ }).first();
      if (await nextBtn2.count() > 0) {
        await nextBtn2.click();
        // 轮询等待离开引导页或出现新按钮
        for (let i = 0; i < 8; i++) {
          await sleep(3000);
          const still = /fido|passkey|hello|security|safe/i.test(page.url());
          if (!still) break;
          const btn = page.getByRole('button', { name: /^(Done|Continue|Close|OK|Skip|Not now|Later)$/i }).first();
          if (await btn.count() > 0) {
            try { await btn.click(); await sleep(3000); } catch {}
          }
          console.log(`[i] 轮询${i + 1}: url=${page.url().slice(0, 120)}`);
        }
      }
      console.log('[i] passkey 处理后 url:', page.url());
    }
    // 已离开 fido(如点击 Cancel -> oauth20_authorize.srf),等待 OAuth 授权回跳 Bing
    if (/login\.(live|microsoft)\.com/.test(page.url()) && !/fido|passkey/i.test(page.url())) {
      console.log('[*] passkey 已取消/完成,等待 OAuth 授权回跳 ...');
      const authDiag = await page.evaluate(() => {
        const text = document.body ? document.body.innerText.slice(0, 400).replace(/\n+/g, ' | ') : '';
        const btns = [...document.querySelectorAll('button, input[type="submit"], input[type="button"], a')]
          .filter((b) => b.offsetWidth || b.offsetHeight)
          .map((b) => (b.innerText || b.value || '').trim().slice(0, 40))
          .filter(Boolean);
        return { text, btns: [...new Set(btns)].slice(0, 12) };
      });
      console.log('[i] 授权续接页文本:', authDiag.text);
      console.log('[i] 按钮:', JSON.stringify(authDiag.btns));
      // 如有 Continue/Next/Yes/Done 类按钮,点击
      const contBtn = page.locator('button, input[type="submit"], input[type="button"], a').filter({ hasText: /^(Continue|Next|Yes|Done)$/i }).first();
      if (await contBtn.count() > 0) {
        try { await contBtn.click(); await sleep(4000); } catch {}
      }
      await page.waitForFunction(
        () => /bing\.com\/webmasters/.test(location.href) && !/\/about/.test(location.href),
        { timeout: 25000 }
      ).catch(() => {});
      await sleep(3000);
      console.log('[i] OAuth 回跳后 url:', page.url());
    }
  }

  // 兜底:仅在不在 Microsoft 登录流程中且未落地 Bing 时才重新触发 Sign In
  const onBingOk = /bing\.com\/webmasters/.test(page.url()) && !/\/about/.test(page.url());
  const inMsFlow = /login\.(live|microsoft)\.com/.test(page.url());
  if (!onBingOk && !inMsFlow) {
    console.log('[*] 兜底:回到 Bing Webmaster 并重新触发 Sign In ...');
    await page.goto('https://www.bing.com/webmasters/home', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await sleep(4000);
    const signIn2 = page.getByRole('button', { name: /sign in/i }).first();
    if (await signIn2.count() > 0) {
      await signIn2.click();
      await sleep(3000);
      // 处理 signInCard 弹窗(选择 Microsoft 登录卡),与初始流程一致
      const msCard2 = page.locator('.signInCard').filter({ hasText: /microsoft/i }).first();
      if (await msCard2.count() > 0) {
        await msCard2.click();
        await sleep(8000);
        console.log('[i] 二次 Sign In(点 MS 卡)后 url:', page.url());
      } else {
        const msLogo2 = page.locator('img[alt*="microsoft" i]').first();
        if (await msLogo2.count() > 0) {
          await msLogo2.click();
          await sleep(8000);
          console.log('[i] 二次 Sign In(点 MS logo)后 url:', page.url());
        }
      }
      // 若出现账号选择/确认页,点击包含邮箱的元素
      if (/login\.(live|microsoft)\.com/.test(page.url())) {
        const acct = page.locator('div[role="option"], div[role="button"], [data-testid], .table').filter({ hasText: /aerogela@outlook\.com/i }).first();
        if (await acct.count() > 0) {
          await acct.click();
          await sleep(6000);
          console.log('[i] 点击账号后 url:', page.url());
        }
      }
    }
    await sleep(3000);
    console.log('[i] 二次处理 url:', page.url());
  }

  // 7. "Stay signed in?" -> Yes
  const stayYes = page.locator('button, input[type="submit"], input[type="button"]').filter({ hasText: /^Yes$/ }).first();
  if (await stayYes.count() > 0) {
    console.log('[*] 点击 Stay signed in -> Yes ...');
    await stayYes.click();
    await sleep(5000);
    console.log('[i] Yes 后 url:', page.url());
  }

  // 8. 等待落地 Bing Webmaster(dashboard 等非 about 页)
  await page.waitForFunction(
    () => /bing\.com\/webmasters/.test(location.href) && !/\/about/.test(location.href),
    { timeout: 30000 }
  ).catch(() => {});
  await sleep(4000);
  console.log('[✓] 最终 url:', page.url());
  await page.screenshot({ path: '/workspace/.screenshots/cloak-bing-loggedin.png' });

  const finalOk = /bing\.com\/webmasters/.test(page.url()) && !/\/about/.test(page.url());
  console.log(finalOk ? '[✓] Bing 登录完成,profile 已持久化:' + PROFILE_DIR : '[✗] 未落地到 Bing Webmaster(停留在 ' + page.url() + '),请检查截图');
  await context.close();
  process.exit(finalOk ? 0 : 1);
} catch (e) {
  console.error('[✗] 登录失败:', e.message);
  try { if (context) await context.close(); } catch {}
  process.exit(1);
}
