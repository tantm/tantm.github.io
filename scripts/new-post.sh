#!/usr/bin/env bash
# Tạo bài viết mới: scripts/new-post.sh "Title" [Category] [Lang]
set -euo pipefail

TITLE="${1:-}"
CATEGORY="${2:-Developer}"
LANG_CODE="${3:-en}"
# env LANG hệ thống (vd en_US.UTF-8) có thể lọt vào qua Makefile — chỉ nhận en|vi
[[ "$LANG_CODE" == "vi" ]] || LANG_CODE="en"

if [[ -z "$TITLE" ]]; then
  echo "Usage: make new-post TITLE=\"My post title\" [CATEGORY=Data|AI|Developer|Architecture] [LANG=en|vi]"
  exit 1
fi

YEAR="$(date +%Y)"
DATE="$(date +%Y-%m-%d)"
SLUG="$(echo "$TITLE" \
  | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null \
  | tr '[:upper:]' '[:lower:]' \
  | sed -e 's/[^a-z0-9]\+/-/g' -e 's/^-\+//' -e 's/-\+$//')"

DIR="src/content/blog/${YEAR}"
FILE="${DIR}/${SLUG}.md"

if [[ -e "$FILE" ]]; then
  echo "✗ Already exists: $FILE"
  exit 1
fi

mkdir -p "$DIR"
cat > "$FILE" <<EOF
---
title: "${TITLE}"
description: ""
date: ${DATE}
category: ${CATEGORY}
tags: []
lang: ${LANG_CODE}
draft: true
---

Write here...
EOF

echo "✓ Created $FILE (draft: true — bỏ flag khi sẵn sàng publish)"
