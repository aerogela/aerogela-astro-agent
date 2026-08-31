# AGENT_HANDOFF — 接手指南

本文件是后续 agent **接手工作前必读**的入口文档,用于在全新/重置后的环境中快速恢复并继续 aerogela.com 的开发与维护。

生成日期:2026-08-30。接手时请结合仓库提交历史、`.tools/README.md`、`.credentials/README.md` 一起阅读。

---

## 1. 一句话业务

**aerogela.com** 是一个气凝胶行业的厂商目录站:维护企业名录(listings)、按品类/国家聚合的落地页、行业科普文章(posts),并提供站内搜索(Pagefind)与旧站 301 重定向。目标是为下游采购/工程师提供可言可信的行业信息。

## 2. 环境恢复(沙盒重置后 1 分钟)

> ⚠️ 仅当你在 **原沙盒**(`/workspace` 持久保留)内才可执行这几步。若你只拿到本仓库而无原沙盒,私钥与 Token 无法从仓库恢复(见 §7)。

```bash
# 1. 恢复 Git 凭据(GitHub SSH 走 HTTP 代理)
bash /workspace/.credentials/restore-credentials.sh

# 2. 恢复真实浏览器(chrome-devtools MCP 依赖 /opt/google/chrome/chrome)
bash /workspace/.tools/restore-browser.sh

# 3. 网站本地开发环境(仅构建/开发时需要)
cd /workspace/aerogela-astro && npm install
```

沙盒网络要点:`22` 端口直连被封,所有外连走 HTTP 代理 `http://127.0.0.1:18080`(系统已注入 `HTTP(S)_PROXY`);大文件走 `cdn.npmmirror.com` 更快。详见 `.tools/README.md`。

## 3. 本地开发与构建

```bash
cd aerogela-astro
npm install                # 安装依赖
npm run dev                # 本地开发伺服
npm run build              # 构建:astro build && pagefind --site dist(生成 dist/ 与搜索索引)
npm run preview            # 预览构建产物
```

- 站点配置:`astro.config.mjs`(`site`、`trailingSlash`、`redirects`、sitemap filter)。
- 部署配置:`wrangler.toml`(Workers 静态资产,`assets.directory = "./dist"`,`npx wrangler deploy`)。

## 4. 项目架构(看懂代码的关键)

**内容驱动**:`src/content/` 下三类内容集,由 `src/content/config.ts` 定义 schema:

| 内容集 | 目录 | 说明 |
| --- | --- | --- |
| `listings` | `src/content/listings/*.json` | 企业名录条目(约 120+ 家),含公司名/国家/类别/联系方式等字段 |
| `pages` | `src/content/pages/*.json` | 单个站内落地页(国家目录、类别目录、政策页等) |
| `posts` | `src/content/posts/*.json` | SEO 科普文章(如 what-is-aerogel-insulation 等) |

**动态路由**(`src/pages/`):
- `listing/[slug].astro` — 单个名录详情
- `listing-category/[slug].astro`、`listing-location/[slug].astro` — 按类别/国家聚合
- `blog/[slug].astro`、`blog/index.astro` — 文章与列表
- `[slug].astro` — 通用内容页(pages 内容集)
- `search.astro` — Pagefind 站内搜索页(URL 查询参数 `?q=`)
- `rss.xml.js`、`index.astro`、`404.astro`

**搜索**:Pagefind 由 `npm run build` 的 `pagefind --site dist` 阶段生成索引;`search.astro` 前端加载 `pagefind` 索引实现站内搜索。

**SEO**:
- `src/lib/seo.ts` + `src/layouts/Base.astro` — head 的 meta/schema.org/OG 等统一输出。
- `@astrojs/sitemap` 生成 sitemap,`/search/` 页 noindex 被过滤。
- 301 重定向来自合并旧站 URL(策略见 `astro.config.mjs` 注释)。

**业务数据**:`src/data/` 含 `taxonomy.json`(类别/国家体系)、`country-intro.json`、`redirects.json`(旧→新 URL 映射,合并自 WXR × GSC × Ahrefs)。

> `aerogela-astro/` 已于 2026-08-30 升级为 `aerogela/aerogela-astro` 的正式 git 克隆(快照与远端逐字节比对一致后移入 `.git`),`node_modules/` 与 `dist/` 保留在本地(已被 gitignore 排除)。

## 5. 部署(推荐:Git 集成自动部署)

**`aerogela/aerogela-astro` 仓库已绑定 Cloudflare Workers Builds(Git 集成):推送到 `main` 即自动构建部署**,无需本地 Token。构建命令 `npm run build`,部署命令 `npx wrangler deploy`(配置见 `wrangler.toml` 注释),`_redirects` / `_headers` 随 `dist/` 原生生效。

```bash
cd aerogela-astro   # 本目录已是该仓库的正式克隆(origin = git@github.com:aerogela/aerogela-astro.git)
git add -A && git commit -m "..." && git push origin main   # 推送即触发 Cloudflare 自动部署
```

备用方案(手动部署,需 Cloudflare API Token,见 §7):

```bash
cd aerogela-astro
npm run build
npx wrangler deploy
```

## 6a. 浏览器登录态持久化(GSC / Bing Webmaster 免重复登录)

**背景**:GSC(`aerogelaa@gmail.com` + TOTP)与 Bing Webmaster(`aerogela@outlook.com` + TOTP seed `LGRL2Y7RB5RPQZPV`)登录流程含 2FA,每次重登成本高。浏览器 profile 持久化到 `/workspace/.browser-profiles/`(跨沙盒重置保留),登录态不再丢失。

**机制(2026-08-31 起,登录态已全部集中到 CloakBrowser)**:

1. **CloakBrowser 是唯一承载登录态的浏览器**(GSC + Bing 都在此):
   - 持久化 profile:`/workspace/.browser-profiles/cloakbrowser`(约 58MB,GSC + Bing 登录态)。
   - 启动器:`node /workspace/.tools/browser/cb-persistent.mjs <url>`(依赖已在 `/workspace/.tools/browser/` 本地安装,node_modules 被 gitignore)。
   - 内部使用 `launchPersistentContext({ userDataDir: '/workspace/.browser-profiles/cloakbrowser' })`,登录态随 profile 持久化。
   - **Chromium 已本地化(2026-08-31)**:stealth Chromium(697M,v146.0.7680.177.5)缓存于 `/workspace/.tools/browser/cloakbrowser-cache/`(gitignore),全部脚本已注入 `CLOAKBROWSER_CACHE_DIR` + `CLOAKBROWSER_AUTO_UPDATE=false`。沙盒重置后**零下载**直接启动(此前默认缓存 `~/.cloakbrowser/` 会被重置清掉,每次重置都要静默重下 697M)。升级时手动:`CLOAKBROWSER_CACHE_DIR=/workspace/.tools/browser/cloakbrowser-cache npx cloakbrowser update` 后删旧版本目录。
   - **沙盒重置后恢复(2026-08-31 实测,共两步,约 1 分钟)**:
     1. `bash /workspace/.tools/browser/restore-browser-profiles.sh`(杀残留进程 + 清锁文件 + 校验 cookie;CloakBrowser 直接用持久化路径,无需符号链接)。
     2. `cd /workspace/.tools/browser && npm ci`(**node_modules 也会随沙盒重置丢失**,package.json/lock 已持久化,8 包秒装;漏了这步脚本会报 `Cannot find package 'cloakbrowser'`)。
     - 其余无需手动恢复:系统库走脚本自动注入的 LD_LIBRARY_PATH,Chromium 走本地化缓存(见上)。备用 Chrome 二进制在 `/workspace/.tools/browser/chrome-linux64/`。
     - 若需推送 git 且报权限错误:`bash /workspace/.credentials/restore-credentials.sh`(`~/.ssh/` 也随重置丢失,含 HTTP 代理配置)。
     - 验证:`node /workspace/.tools/browser/gsc-verify.mjs` 免登录直达即环境完整。

2. **登录脚本**(均已内置凭据 + TOTP 自动计算,登录态写入持久化 profile;**已内置 `LD_LIBRARY_PATH` 自动注入**,沙盒重置后无需 shell 层环境变量即可裸跑):
   - GSC:`node /workspace/.tools/browser/gsc-login.mjs`;验证:`node /workspace/.tools/browser/gsc-verify.mjs`(免登录直达 sitemaps 页即成功)。
   - Bing:`node /workspace/.tools/browser/bing-login.mjs`;验证:`node /workspace/.tools/browser/bing-verify.mjs`(免登录直达 dashboard 即成功)。
   - **依赖注入说明**:CloakBrowser 依赖 libatk/libnss3 等系统动态库,沙盒重置后系统库丢失会报 `cannot open shared object file: libatk-1.0.so.0`。各脚本在 launch 前自动把 `/workspace/.tools/browser/browser-libs/usr/lib/x86_64-linux-gnu` 注入 `process.env.LD_LIBRARY_PATH`(Chrome 子进程继承),该离线库随 workspace 持久化、跨沙盒重置可用。

3. **Bing 登录脚本要点**(微软登录 UI 坑多,已逐一解决):
   - 新登录 UI 无 `#idSIButton9`,需 `nextBtn()` helper:优先 `#idSIButton9`,否则 `getByRole('button', { name: /^Next$/ })`。
   - OTP 输入框是 `#floatingLabelInput5`(无 name/autocomplete 属性);页面里另有**隐藏**的 `<input name="otc" type="hidden" id="otc-confirmation-input">` 须排除。
   - 2FA 通过后微软会插入 **passkey/fido 引导页**(`login.microsoft.com/consumers/fido/create`):点 **Cancel**(INPUT 元素)即可继续 OAuth(`PasskeyEnrollResult=user_cancel`),首次 Cancel 后微软会记住,后续登录不再出现。
   - 成功后落地 URL 形如 `https://www.bing.com/webmasters?tid=...`(含 tid 才算登录成功,`/webmasters/about` 是未登录页)。

4. **chrome-devtools MCP 浏览器已弃用**(2026-08-31 起,profile `/workspace/.browser-profiles/chrome-devtools-mcp/` 已删除):
   - 曾用于承载 Bing 登录态,现登录态已全部迁入 CloakBrowser。
   - MCP 浏览器仍可正常启动,但为全新空 profile(无登录态);日常登录操作一律走 CloakBrowser。

**安全**:`.browser-profiles/` 已加入 `/workspace/.gitignore`(含登录 cookie,绝不入库)。

## 6. 数据与资产说明

- `../.uploads/`:迁移期原始数据(Ahrefs/GSC 导出 CSV + ZIP、WordPress `aerogeldirectory` XML 导出),可用于核查数据口径、增量补充名录或文章。
- `../.screenshots/`:工作过程截图留档。
- `../.trae-html-share-packages/`:SEO 审计、迁移包、部署 Runbook 等 HTML 报告。

## 7. 凭据与安全(重要)

- ✅ 仓库内**只含公钥**(`id_ed25519.pub`)与恢复脚本;**不含** GitHub 私钥(`id_ed25519`)与 Cloudflare Token(`cloudflare-token.txt`)。
- 原值仅存在于 **原沙盒** `/workspace/.credentials/` 内(该目录跨沙盒重置保留,已由 README 验证)。私钥/Tokent 不入 git,防止仓库泄露即密钥泄露。
- 若丢失原沙盒:需向仓库/账号所有者(Aerogela org,SSH 身份 `trae-deploy@aerogela`)重新索要私钥与 Token 后,再运行 `restore-credentials.sh`。
- 推送到 aerogela 名下仓库走 SSH:`git@github.com:aerogela/aerogela-*.git`(经 HTTP 代理)。
- **2026-08-30 密钥轮换记录**:原沙盒丢失导致原私钥失效,已生成新密钥对(指纹 `SHA256:oYGEu5miDF0A064hiZWaqIGzVBafBGeskYRvjBlNLM`,身份 `trae-deploy@aerogela`),新公钥已入库,新私钥存当前沙盒 `/workspace/.credentials/id_ed25519`(gitignore 排除)。Cloudflare Token 未恢复,但日常发布走 §5 的 Git 自动部署,不依赖 Token。

## 8. 当前状态与建议的下一步

- 源工程 `aerogela-astro/` 已是正式克隆,工作树干净,`main` 与 `origin/main`(cdcb897)一致,推送即自动部署。
- 搜索页 UI、移动端适配等已迭代完成(见 `src/pages/search.astro`、`src/styles/global.css`)。
- 建议的继续方向(示例,按需取舍):扩展/校对 listings 数据、新增 SEO 收录页、优化搜索相关性与分面筛选、监控 sitemap/重定向覆盖、站点性能与 Core Web Vitals 巡检。

接手后建议先在本地 `npm run build` 成功构建并 `npm run dev` 跑通,再开始改动;改动发布走标准 `git commit + push`,部署经 `npx wrangler deploy`。
## 11. SEO 每日监控(2026-08-31 起)
- **定时任务**: 每天 09:00(Asia/Shanghai)自动跑 `/workspace/.tools/browser/se-monitor.mjs`,监控 GSC + Bing Webmaster(登录态/sitemap 状态/URL 数/GSC 已编入索引环比)。
- **产出**: `reports/YYYY-MM-DD-se-monitor.md`(当日报告) + `reports/state.json`(跨次基线,首次已建: GSC 索引 271 / 双平台 sitemap 222 URL)。
- **判定阈值**: sitemap URL 数 < 200(基线 222 骤降 10%)或状态非成功 → 异常;GSC 已编入索引环比降 > 20% → 异常;登录失效 → 需人工(gsc-login.mjs / bing-login.mjs)。
- **修复工具**: GSC 重提交 `gsc-sitemap-fix3.mjs`;Bing 重提交 `bing-sitemap-fix.mjs`(新版 UI 无删除功能,旧记录无害)。
- reports/ 已 gitignore;定时任务 message 内含完整环境自愈流程(npm ci + restore 脚本)。
