#!/usr/bin/env bash
# =============================================================================
# restore-browser-profiles.sh
# 在沙盒重置后恢复浏览器登录态(无需重新登录 GSC / Bing Webmaster)。
#
# 背景(2026-08-31 起):
#   所有登录态已集中到 CloakBrowser 一个持久化 profile:
#     /workspace/.browser-profiles/cloakbrowser
#   该目录跨沙盒重置保留,CloakBrowser 启动时直接用 launchPersistentContext
#   指向它,无需符号链接。chrome-devtools MCP 浏览器已弃用(profile 已删除)。
#
# 本脚本只做两件事:
#   1) 杀掉残留的浏览器进程(避免 profile 锁冲突)
#   2) 清理 CloakBrowser profile 的锁文件,并校验 cookie 可访问
#
# 用法:
#   bash restore-browser-profiles.sh
# =============================================================================
set -euo pipefail

PROFILE_DIR="/workspace/.browser-profiles/cloakbrowser"

echo "==> 检查 CloakBrowser 持久化 profile ..."
if [ ! -d "$PROFILE_DIR" ]; then
  echo "[警告] 未找到持久化 profile: $PROFILE_DIR"
  echo "       请先运行登录脚本生成登录态:"
  echo "         node /workspace/.tools/browser/gsc-login.mjs"
  echo "         node /workspace/.tools/browser/bing-login.mjs"
  exit 1
fi

# 若 CloakBrowser 正在运行,先关闭,避免 profile 锁冲突
if pgrep -f "user-data-dir=$PROFILE_DIR" >/dev/null 2>&1; then
  echo "==> 检测到 CloakBrowser 运行中,先关闭 ..."
  pkill -f "user-data-dir=$PROFILE_DIR" 2>/dev/null || true
  sleep 3
fi

# 清理可能残留的 profile 锁文件(浏览器异常退出时产生)
echo "==> 清理 CloakBrowser profile 锁文件 ..."
rm -f "$PROFILE_DIR/SingletonLock" "$PROFILE_DIR/SingletonCookie" "$PROFILE_DIR/SingletonSocket" 2>/dev/null || true

echo "==> 校验 cookie 是否可访问:"
if [ -f "$PROFILE_DIR/Default/Cookies" ]; then
  echo "    [✓] $PROFILE_DIR/Default/Cookies (GSC + Bing 登录态就绪)"
else
  echo "    [警告] 未找到 Cookies 文件,登录态可能为空。"
fi

echo "==> 完成。启动 CloakBrowser 后,GSC / Bing 登录态将自动恢复。"
