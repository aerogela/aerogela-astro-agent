#!/bin/bash
# 全站 URL 状态码批量检查(sitemap 222 个),找 4xx/5xx
check() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null --max-time 20 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -w "%{http_code}" "$url" 2>/dev/null) || code="ERR"
  echo "$code|$url"
}
export -f check
xargs -P 15 -I{} bash -c 'check "{}"' < /tmp/online.txt > /tmp/url-status.txt
echo "=== 状态码分布 ==="
awk -F'|' '{print $1}' /tmp/url-status.txt | sort | uniq -c | sort -rn
echo ""
echo "=== 非 200 明细 ==="
grep -v '^200|' /tmp/url-status.txt || echo "(无 — 全部 200)"