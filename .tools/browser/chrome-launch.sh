#!/usr/bin/env bash
# chrome-devtools MCP 启动器包装
# 作用:
#   1. root 环境下 Chrome 必须加 --no-sandbox,否则进程立即退出(MCP 报 "Target closed")
#   2. 沙盒无 X server,MCP 默认 headful 启动会失败,故强制注入 --headless=new
# MCP 插件的启动参数不可改,所以在中间层统一补参数。
ARGS=("$@")
HAS_HEADLESS=0
for a in "${ARGS[@]}"; do
  case "$a" in --headless*) HAS_HEADLESS=1;; esac
done
EXTRA=(--no-sandbox --disable-gpu --disable-dev-shm-usage --no-first-run --no-default-browser-check)
[ "$HAS_HEADLESS" -eq 0 ] && EXTRA+=(--headless=new)
exec /workspace/.tools/browser/chrome-linux64/chrome "${EXTRA[@]}" "${ARGS[@]}"
