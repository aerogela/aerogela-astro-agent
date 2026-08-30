#!/bin/bash
# 名录官网批量可达性检查:并发 curl,输出 slug|status|final_url
check() {
  local slug="$1" url="$2"
  local out
  out=$(curl -s -o /dev/null -L --max-time 15 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" -w "%{http_code}|%{url_effective}" "$url" 2>/dev/null) || out="ERR|ERR"
  echo "$slug|$out"
}
export -f check
cat /tmp/all-websites.txt | awk -F'|' '$2!=""' | xargs -P 15 -I{} bash -c 'IFS="|" read -r s u <<< "{}"; check "$s" "$u"' > /tmp/website-check.txt
echo "=== 状态分布 ==="
awk -F'|' '{print $2}' /tmp/website-check.txt | sort | uniq -c | sort -rn
echo ""
echo "=== 非 200 的明细 ==="
grep -v '^.*|200|' /tmp/website-check.txt
