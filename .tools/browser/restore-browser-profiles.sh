#!/usr/bin/env bash
# =============================================================================
# restore-browser-profiles.sh
# 在沙盒重置后恢复浏览器登录态(无需重新登录 GSC / Bing Webmaster)。
#
# 原理:
#   /workspace 跨沙盒重置保留。浏览器 profile(含 cookie)持久化在
#   /workspace/.browser-profiles/ 下;本脚本把 chrome-devtools-mcp 的默认
#   profile 路径重新指向该持久化目录(符号链接),使登录态自动恢复。
#
# 用法:
#   bash restore-browser-profiles.sh
# =============================================================================
set -euo pipefail

PROFILES_ROOT="/workspace/.browser-profiles"
CDP_PROFILE_NAME="chrome-devtools-mcp"
CDP_DEFAULT_DIR="/root/.cache/chrome-devtools-mcp"
CDP_LINK="$CDP_DEFAULT_DIR/chrome-profile"

echo "==> 检查持久化 profile ..."
if [ ! -d "$PROFILES_ROOT/$CDP_PROFILE_NAME" ]; then
  echo "[警告] 未找到持久化 profile: $PROFILES_ROOT/$CDP_PROFILE_NAME"
  echo "       请先正常使用一次浏览器(chrome-devtools MCP)以生成登录态。"
  exit 1
fi

echo "==> 确保默认缓存目录存在: $CDP_DEFAULT_DIR"
mkdir -p "$CDP_DEFAULT_DIR"

# 若浏览器正在运行,先关闭,避免 profile 锁冲突
if pgrep -f "user-data-dir=$CDP_LINK" >/dev/null 2>&1; then
  echo "==> 检测到浏览器运行中,先关闭 ..."
  pkill -f "user-data-dir=$CDP_LINK" 2>/dev/null || true
  sleep 3
fi

# 重建符号链接
if [ -L "$CDP_LINK" ]; then
  echo "==> 符号链接已存在: $(readlink "$CDP_LINK")"
elif [ -e "$CDP_LINK" ]; then
  echo "==> 检测到普通目录(沙盒重置残留),替换为符号链接 ..."
  rm -rf "$CDP_LINK"
  ln -s "$PROFILES_ROOT/$CDP_PROFILE_NAME" "$CDP_LINK"
  echo "==> 已重建符号链接"
else
  ln -s "$PROFILES_ROOT/$CDP_PROFILE_NAME" "$CDP_LINK"
  echo "==> 已创建符号链接"
fi

# 清理可能残留的 profile 锁文件(浏览器异常退出时产生)
rm -f "$CDP_LINK/SingletonLock" "$CDP_LINK/SingletonCookie" "$CDP_LINK/SingletonSocket" 2>/dev/null || true

echo "==> 校验 cookie 是否可访问:"
if [ -f "$CDP_LINK/Default/Cookies" ]; then
  echo "    [✓] $CDP_LINK/Default/Cookies (登录态就绪)"
else
  echo "    [警告] 未找到 Cookies 文件,登录态可能为空。"
fi

echo "==> 完成。启动 chrome-devtools MCP 浏览器后,GSC / Bing 登录态将自动恢复。"
