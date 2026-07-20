---
title: "Xin chào — vì sao mình (khởi động lại) blog này"
description: "Bài mở đầu: blog này viết về gì, được xây thế nào, và bạn có thể chờ đợi gì."
date: 2026-07-20
category: Developer
tags: [meta, astro, blogging]
lang: vi
translationKey: hello-world-2026
---

Sau nhiều năm ghi chú chỉ nằm trong private repo, mình quyết định biến trang này thành một
blog thực thụ. Nội dung sẽ thực chiến, đúc kết từ kinh nghiệm, xoay quanh bốn chủ đề:

- **Developer** — tooling, workflow, năng suất với AI coding agents
- **Data** — data platform, pipeline, lakehouse, governance
- **AI** — hệ thống agentic, ứng dụng LLM, evaluation
- **Architecture** — pattern và trade-off từ dự án thật (luôn ẩn danh)

## Trang này được xây thế nào

Site theo hướng Markdown-first: mỗi bài là một file `.md` thuần với frontmatter, đọc được
ngay trên GitHub repo và được [Astro](https://astro.build) render thành static site trên
GitHub Pages.

```yaml
---
title: "Tiêu đề bài viết"
date: 2026-07-20
category: Data
tags: [spark, lakehouse]
lang: vi
---
```

Thêm bài mới chỉ cần một lệnh:

```bash
make new-post TITLE="Bài viết tiếp theo" CATEGORY=Data
make dev    # preview tại localhost:4321
```

## Lưu ý về nội dung

Mình làm dự án cho khách hàng, nên mọi thứ ở đây đều được tổng quát hoá: pattern, kiến trúc
và bài học — không bao giờ có tên khách hàng, chi tiết nội bộ hay bất kỳ thông tin mật nào.

Hẹn gặp ở bài tiếp theo.
