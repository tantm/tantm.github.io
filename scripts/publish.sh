#!/usr/bin/env bash
# make publish — build → commit → push → chờ GitHub Actions deploy → verify site live
set -euo pipefail

MSG="${1:-}"
[[ -n "$MSG" ]] || MSG="update blog $(date +%Y-%m-%d)"
SITE="https://tantm.github.io"
REPO="tantm/tantm.github.io"
WORKFLOW_NAME="Deploy to GitHub Pages"

step() { echo -e "\n\033[1;34m▶ $*\033[0m"; }

step "1/4 Build (astro + pagefind)"
npm run build

step "2/4 Commit + push master"
git add -A
if git diff --cached --quiet; then
  echo "Không có thay đổi mới — dùng commit hiện tại trên master."
else
  git commit -m "$MSG"
fi
git push origin master
SHA="$(git rev-parse HEAD)"
echo "HEAD = ${SHA:0:7}"

step "3/4 Chờ workflow '$WORKFLOW_NAME' cho ${SHA:0:7}"
if ! command -v gh >/dev/null 2>&1; then
  echo "⚠ Không có gh CLI — bỏ qua bước chờ. Theo dõi: https://github.com/$REPO/actions"
  exit 0
fi

conclusion=""
for i in $(seq 1 60); do
  # lọc đúng workflow của mình (bỏ qua legacy "pages build and deployment")
  run="$(gh api "repos/$REPO/actions/runs?head_sha=$SHA&per_page=10" \
    --jq "[.workflow_runs[] | select(.name==\"$WORKFLOW_NAME\")][0] // empty" 2>/dev/null || true)"
  if [[ -n "$run" ]]; then
    status="$(echo "$run" | python3 -c 'import sys,json; print(json.load(sys.stdin)["status"])')"
    conclusion="$(echo "$run" | python3 -c 'import sys,json; print(json.load(sys.stdin)["conclusion"] or "")')"
    echo "  [$i] $status ${conclusion:+→ $conclusion}"
    [[ "$status" == "completed" ]] && break
  else
    echo "  [$i] chờ workflow xuất hiện..."
  fi
  sleep 10
done

if [[ "$conclusion" != "success" ]]; then
  echo "✗ Deploy chưa success (conclusion: ${conclusion:-timeout}). Xem: https://github.com/$REPO/actions"
  exit 1
fi

step "4/4 Verify site live"
sleep 5
fail=0
for p in / /blog/ /rss.xml; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p")"
  echo "  $code $SITE$p"
  [[ "$code" == "200" ]] || fail=1
done
[[ "$fail" == "0" ]] && echo -e "\n✓ Published: $SITE" || { echo "✗ Có route lỗi — check lại."; exit 1; }
