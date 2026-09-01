#!/usr/bin/env bash
# 沙盒重置后一键自愈:node_modules(离线快照优先,免网络) / 浏览器 profile / SSH 密钥
# 定时监控任务第一步应调用本脚本,替代散落的多条自愈命令。
# 用法: bash /workspace/.tools/browser/self-heal.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SNAP="$DIR/node_modules.snapshot.tgz"

# 1. node_modules:重置后该目录会被清空(workspace 同步不含它),但 tar 快照可持久保留
if [ ! -f "$DIR/node_modules/cloakbrowser/package.json" ]; then
  if [ -f "$SNAP" ]; then
    echo "[self-heal] node_modules 缺失,从离线快照恢复(免网络)..."
    tar xzf "$SNAP" -C "$DIR"
  else
    echo "[self-heal] 无快照,回退 npm ci(需网络)..."
    (cd "$DIR" && npm ci)
  fi
else
  echo "[self-heal] node_modules 完好,跳过"
fi

# 2. 浏览器持久化 profile(GSC + Bing 登录态)
bash "$DIR/restore-browser-profiles.sh"

# 3. SSH 密钥:监控本身不需要,但自动修复涉及 git push 时需要;失败不阻断
if [ ! -f ~/.ssh/id_ed25519 ] && [ -f /workspace/.credentials/restore-credentials.sh ]; then
  if bash /workspace/.credentials/restore-credentials.sh >/dev/null 2>&1; then
    echo "[self-heal] SSH 密钥已恢复"
  else
    echo "[self-heal] SSH 恢复失败(不影响监控,仅影响 git push)"
  fi
fi

echo "[self-heal] 完成"
