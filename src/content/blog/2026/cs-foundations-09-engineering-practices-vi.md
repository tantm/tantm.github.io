---
title: 'Git, testing, code review — kỹ năng đi làm thật'
description: 'Git như một cái graph bạn thôi sợ, ba loại test đáng viết, review bắt được thứ compiler không bắt nổi, và đọc code — siêu năng lực bị đánh giá thấp.'
date: 2026-08-03
category: Developer
tags: [cs-foundations, git, testing, career]
lang: vi
translationKey: cs-foundations-09
series: cs-foundations
part: 9
---

Không thứ gì trong phần này nằm trong giáo trình đại học, và tất cả nằm trong mọi ngày đi làm. Sự thật khó chịu của phần mềm chuyên nghiệp: **code được đọc, được review và được bảo trì nhiều hơn được viết rất xa** — và các kỹ năng cho nửa đó của nghề là học được, thuần cơ học, và bị dạy thiếu một cách kinh niên. Bốn kỹ năng, bắt đầu.

## Git: nó là một cái graph, và bạn đã học graph rồi

Phần 3 dạy bạn graph; Git chính là một cái — **commit là node trỏ về cha của nó; branch chỉ là nhãn tên di động dán lên node**. Ngấm câu đó là sự đáng sợ của Git bốc hơi: merge là nối hai chuỗi tại một node; `HEAD` là "cái nhãn bạn đang đứng"; không thứ gì đã commit từng thật sự mất (`git reflog` là lịch sử undo của cái graph — cục tẩy-cơn-hoảng-loạn mà ai cũng học muộn hơn một buổi chiều tồi tệ).

Tay nghề hằng ngày, chưng cất:

- **Commit là đơn vị của ý nghĩa, không phải điểm save.** Một thay đổi logic mỗi commit, với message mà dòng đầu trả lời *"áp cái này vào thì được gì?"* ("Fix duplicate orders on retry" — không phải "fix", không phải "wip"). Khán giả là phiên bản 2-giờ-sáng của bạn đang bisect một con bug.
- **Branch là phạm vi hội thoại giá rẻ**: một branch = một thay đổi review được. Cái branch nghìn dòng "làm tất cả mọi thứ" thì không review nổi (xem bên dưới) và không merge nổi với mức độ ngang nhau.
- **Pull trước khi push, và đọc chuyện gì đã xảy ra.** Merge conflict không phải lỗi — là Git *từ chối đoán mò* giữa hai sự thật (một bài toán rất mùi check-then-act, P8); giải quyết nó nghĩa là quyết định, không phải xoá một bên cho tới khi compile được.

## Testing: ba loại trả tiền thuê nhà, còn lại là kịch

S02-P03 đã nói cho pipeline; đây là dạng tổng quát. Phần trăm coverage là metric phù phiếm (bài học accuracy-nói-dối của Phần 4, đem cấy sang) — thứ quan trọng là *những* test nào tồn tại:

1. **Test hành vi cho phần logic kiếm ra tiền** — nhỏ, nhanh, kiểm tay được (5 input, đáp án biết trước). Chúng định nghĩa code *hứa* gì, và vì thế kiêm luôn vai tài liệu không bao giờ mốc.
2. **Test hồi quy từ mỗi bug thật** — thói quen sự-cố-để-lại-fixture: mỗi bug production trở thành bài test chặn phần tiếp theo của nó. Đây là cách bộ test mọc răng thay vì mọc mỡ.
3. **Một test smoke đầu-cuối** — cả hệ có khởi động, kết nối và trả lời được không? Nó bắt lớp lỗi "mọi thứ pass mà chẳng gì chạy" mà unit test mù về mặt cấu trúc.

Kỷ luật khiến cả ba hoạt động: **test chạy trên mọi thay đổi, tự động** (CI), và test đỏ chặn merge. Bộ test có thể bị bỏ qua là một hòm thư góp ý. Và tác dụng phụ thiết kế không ai quảng cáo: code khó test (cần database, network, và trăng tròn) đang *nói với bạn* rằng dependency của nó rối — cùng bản năng type-ở-biên-giới của S02-P03 chữa cả hai.

## Code review: giờ đòn bẩy cao nhất trong tuần của bạn

Review tồn tại để bắt thứ compiler và test không bắt nổi: giả định sai, edge case thiếu, tên mù mờ, thiết kế sẽ gây đau sau sáu tháng. Tay nghề cho cả hai phía:

**Là tác giả** — bạn đang bán một thay đổi, nên hãy hạ giá: giữ nó nhỏ (một review 200 dòng nhận được sự soi xét *tốt hơn* một review 2.000 dòng — sự chú ý của reviewer là ngân sách cố định của Phần 6, phiên bản con người), viết mô tả nói *vì sao* (cái diff đã kể cái gì rồi), và tự review diff của mình trước — bạn sẽ bắt được một phần ba số comment trước khi ai đó tốn thời gian.

**Là reviewer** — đọc mô tả, rồi đọc test (*chúng phát biểu hành vi dự kiến nhanh hơn code*), rồi mới tới code. Comment về: tính đúng (dắt một input cụ thể đi xuyên qua — thói quen P4), edge case (rỗng, trùng, đồng thời — câu hỏi P8 "hai cái này chạy cùng lúc thì sao?"), và độ rõ ("chỗ này em không theo nổi" là feedback hợp lệ và quý). Bỏ qua các nit về style mà formatter nên sở hữu — tự động hoá chúng ra khỏi cuộc hội thoại hẳn. Và phân biệt **blocking** ("chỗ này mất dữ liệu khi X") với **preference** ("anh thì sẽ đặt tên khác") — review mục ruỗng thành oán giận khi mọi comment mang cùng trọng lượng.

Cái lõi văn hoá, nói một lần và nói thật: **review cái code, đừng review con người; nhận review như sự chú ý senior miễn phí, không phải đòn tấn công.** Team hiểu điều này thì lãi kép; team không hiểu thì thay máu.

## Đọc code: kỹ năng không cuộc phỏng vấn nào đo

Bạn sẽ ở trong *code của người khác* nhiều giờ hơn code của mình — debug nó, mở rộng nó, review nó. Phương pháp cơ học, vì chẳng ai dạy:

1. **Điểm vào trước** — `main`, bảng route, định nghĩa DAG: cái gì chạy khi nào?
2. **Bám một request/dòng dữ liệu thật từ đầu tới cuối** — chiều sâu trên một con đường thắng chiều rộng trên mọi file (đúng cú dắt-một-ví-dụ mà P4 khuyên cho review).
3. **Đọc test như bản đặc tả** — chúng biểu diễn cách dùng dự kiến bằng ví dụ chạy được.
4. **Hỏi cái graph, đừng hỏi con mắt**: `git log -p -- path/file` trả lời "sao đoạn code kỳ cục này ở đây?" tốt hơn nhìn chằm chằm — ai đó đã sửa một bug thật bằng chính sự kỳ cục ấy, và message của commit (xem mục trên, về việc viết message tử tế — vòng tròn khép lại) nói là bug nào.

## Điều cần nhớ

- Git là graph: commit là node, branch là nhãn tên, reflog là nút undo — commit theo đơn vị ý nghĩa với message mà phiên bản 2-giờ-sáng của bạn bisect được.
- Ba loại test trả tiền thuê: test hành vi trên logic kiếm tiền, một test hồi quy mỗi bug thật, một smoke test — được CI cưỡng chế, không thì chỉ là gợi ý.
- Review: tác giả bán thay đổi nhỏ kèm lý do; reviewer dắt một input, phân blocking với preference, và để formatter sở hữu style.
- Đọc code là nửa chìm của nghề: điểm vào → một con đường đầu-cuối → test làm đặc tả → `git log` cho phần khảo cổ.

*Tiếp theo — Phần 10: Design patterns & abstraction: khi nào dùng, khi nào bỏ.*
