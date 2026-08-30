# 沙盒重置恢复 Runbook

沙盒重置会清掉:`~/.ssh`、`/data/user`、`node_modules`、`/usr`(系统库)、`/opt`。
`/workspace` 根目录**跨重置保留**——以下资产都存放在这里。

## 重置后按序执行(共约 1 分钟)

```bash
# 1. 恢复凭据(GitHub SSH + Cloudflare token)
/workspace/.credentials/restore-credentials.sh

# 2. 恢复真实浏览器(chrome-devtools MCP 用)
/workspace/.tools/restore-browser.sh

# 3. 网站开发环境(仅需要构建时)
cd /workspace/aerogela-astro && npm install
```

## 浏览器资产布局(/workspace/.tools/browser/)

- `chrome-linux64/` — Chrome for Testing 152 二进制(约 390MB,跨重置保留)
- `debs/` — 16 个系统库 .deb 离线兜底(apt 失败时 dpkg -x 解包)
- `chrome-launch.sh` — 启动包装器,注入 root 环境必需参数:
  - `--no-sandbox`(root 下不加会秒退,MCP 报 "Target closed")
  - `--headless=new`(沙盒无 X server,MCP 默认 headful 启动会失败)
  - `--disable-dev-shm-usage` 等容器适配参数

MCP 找浏览器的路径固定为 `/opt/google/chrome/chrome`,恢复脚本建软链指向包装器。

## 若浏览器二进制也丢了(如 /workspace 被清)

npmmirror 镜像下载很快(194MB 约十秒),不要用 Google 官方源(走代理仅 ~45KB/s):

```bash
mkdir -p /workspace/.tools/browser && cd /workspace/.tools/browser
curl -sL -x http://127.0.0.1:18080 -o chrome.zip \
  'https://cdn.npmmirror.com/binaries/chrome-for-testing/152.0.7977.64/linux64/chrome-linux64.zip'
unzip -qo chrome.zip && rm chrome.zip
cd /tmp && apt-get download libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libasound2 libnss3 libnspr4 libatspi2.0-0 fonts-liberation
mv /tmp/*.deb /workspace/.tools/browser/debs/ 2>/dev/null
/workspace/.tools/restore-browser.sh
```

## 网络要点(沙盒出网)

- 直连 22 端口被封;SSH 必须走 HTTP 代理 `http://127.0.0.1:18080`
- `storage.googleapis.com` 走代理极慢(~45KB/s);`cdn.npmmirror.com` 极快(~19MB/s);
  `archive.ubuntu.com` 较快(~1.7MB/s)——大文件优先选后两者
