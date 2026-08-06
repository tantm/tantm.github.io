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

## Bạn sẽ học được gì

- Nghĩ về Git như một cái graph, để công việc "bị mất" thành thứ tìm lại được thay vì thứ đáng sợ.
- Viết ba loại test có trả tiền thuê nhà, và bỏ qua những loại không trả.
- Cho và nhận code review theo cách làm thay đổi tốt lên chứ không chậm đi.
- Đọc code lạ một cách có phương pháp — kỹ năng không ai phỏng vấn mà ai cũng cần.

**Cần biết trước:** Không cần gì. Có kinh nghiệm Git thì tốt, nhưng không phần nào ở đây giả định bạn thành thạo.

## 1. Git: nó là một cái graph, và bạn đã học graph rồi

Phần 3 dạy bạn graph; Git chính là một cái — **commit là node trỏ về cha của nó; branch chỉ là nhãn tên di động dán lên node**. Ngấm câu đó là sự đáng sợ của Git bốc hơi: merge là nối hai chuỗi tại một node; `HEAD` là "cái nhãn bạn đang đứng"; không thứ gì đã commit từng thật sự mất (`git reflog` là lịch sử undo của cái graph — cục tẩy-cơn-hoảng-loạn mà ai cũng học muộn hơn một buổi chiều tồi tệ).

Tay nghề hằng ngày, chưng cất:

- **Commit là đơn vị của ý nghĩa, không phải điểm save.** Một thay đổi logic mỗi commit, với message mà dòng đầu trả lời *"áp cái này vào thì được gì?"* ("Fix duplicate orders on retry" — không phải "fix", không phải "wip"). Khán giả là phiên bản 2-giờ-sáng của bạn đang bisect một con bug.
- **Branch là phạm vi hội thoại giá rẻ**: một branch = một thay đổi review được. Cái branch nghìn dòng "làm tất cả mọi thứ" thì không review nổi (xem bên dưới) và không merge nổi với mức độ ngang nhau.
- **Pull trước khi push, và đọc chuyện gì đã xảy ra.** Merge conflict không phải lỗi — là Git *từ chối đoán mò* giữa hai sự thật (một bài toán rất mùi check-then-act, P8); giải quyết nó nghĩa là quyết định, không phải xoá một bên cho tới khi compile được.

## 2. Testing: ba loại trả tiền thuê nhà, còn lại là kịch

S02-P03 đã nói cho pipeline; đây là dạng tổng quát. Phần trăm coverage là metric phù phiếm (bài học accuracy-nói-dối của Phần 4, đem cấy sang) — thứ quan trọng là *những* test nào tồn tại:

1. **Test hành vi cho phần logic kiếm ra tiền** — nhỏ, nhanh, kiểm tay được (5 input, đáp án biết trước). Chúng định nghĩa code *hứa* gì, và vì thế kiêm luôn vai tài liệu không bao giờ mốc.
2. **Test hồi quy từ mỗi bug thật** — thói quen sự-cố-để-lại-fixture: mỗi bug production trở thành bài test chặn phần tiếp theo của nó. Đây là cách bộ test mọc răng thay vì mọc mỡ.
3. **Một test smoke đầu-cuối** — cả hệ có khởi động, kết nối và trả lời được không? Nó bắt lớp lỗi "mọi thứ pass mà chẳng gì chạy" mà unit test mù về mặt cấu trúc.

Kỷ luật khiến cả ba hoạt động: **test chạy trên mọi thay đổi, tự động** (CI), và test đỏ chặn merge. Bộ test có thể bị bỏ qua là một hòm thư góp ý. Và tác dụng phụ thiết kế không ai quảng cáo: code khó test (cần database, network, và trăng tròn) đang *nói với bạn* rằng dependency của nó rối — cùng bản năng type-ở-biên-giới của S02-P03 chữa cả hai.

## 3. Code review: giờ đòn bẩy cao nhất trong tuần của bạn

Review tồn tại để bắt thứ compiler và test không bắt nổi: giả định sai, edge case thiếu, tên mù mờ, thiết kế sẽ gây đau sau sáu tháng. Tay nghề cho cả hai phía:

**Là tác giả** — bạn đang bán một thay đổi, nên hãy hạ giá: giữ nó nhỏ (một review 200 dòng nhận được sự soi xét *tốt hơn* một review 2.000 dòng — sự chú ý của reviewer là ngân sách cố định của Phần 6, phiên bản con người), viết mô tả nói *vì sao* (cái diff đã kể cái gì rồi), và tự review diff của mình trước — bạn sẽ bắt được một phần ba số comment trước khi ai đó tốn thời gian.

**Là reviewer** — đọc mô tả, rồi đọc test (*chúng phát biểu hành vi dự kiến nhanh hơn code*), rồi mới tới code. Comment về: tính đúng (dắt một input cụ thể đi xuyên qua — thói quen P4), edge case (rỗng, trùng, đồng thời — câu hỏi P8 "hai cái này chạy cùng lúc thì sao?"), và độ rõ ("chỗ này em không theo nổi" là feedback hợp lệ và quý). Bỏ qua các nit về style mà formatter nên sở hữu — tự động hoá chúng ra khỏi cuộc hội thoại hẳn. Và phân biệt **blocking** ("chỗ này mất dữ liệu khi X") với **preference** ("anh thì sẽ đặt tên khác") — review mục ruỗng thành oán giận khi mọi comment mang cùng trọng lượng.

Cái lõi văn hoá, nói một lần và nói thật: **review cái code, đừng review con người; nhận review như sự chú ý senior miễn phí, không phải đòn tấn công.** Team hiểu điều này thì lãi kép; team không hiểu thì thay máu.

## 4. Đọc code: kỹ năng không cuộc phỏng vấn nào đo

Bạn sẽ ở trong *code của người khác* nhiều giờ hơn code của mình — debug nó, mở rộng nó, review nó. Phương pháp cơ học, vì chẳng ai dạy:

1. **Điểm vào trước** — `main`, bảng route, định nghĩa DAG: cái gì chạy khi nào?
2. **Bám một request/dòng dữ liệu thật từ đầu tới cuối** — chiều sâu trên một con đường thắng chiều rộng trên mọi file (đúng cú dắt-một-ví-dụ mà P4 khuyên cho review).
3. **Đọc test như bản đặc tả** — chúng biểu diễn cách dùng dự kiến bằng ví dụ chạy được.
4. **Hỏi cái graph, đừng hỏi con mắt**: `git log -p -- path/file` trả lời "sao đoạn code kỳ cục này ở đây?" tốt hơn nhìn chằm chằm — ai đó đã sửa một bug thật bằng chính sự kỳ cục ấy, và message của commit (xem mục trên, về việc viết message tử tế — vòng tròn khép lại) nói là bug nào.

## Thực hành (25 phút — cố tình làm mất một commit, rồi lấy lại)

Không đụng vào repository thật nào. Bạn sẽ tạo một repo bỏ đi, phá công việc theo hai cách thật sự khiến người ta hoảng, và khôi phục cả hai — sau đó `reflog` thôi là một mẩu kiến thức vụn:

```bash
mkdir git-lab && cd git-lab && git init -q
for m in first second third; do echo "$m" >> log.txt; git add -A; git commit -qm "$m"; done
git log --oneline                       # ba commit, một đường thẳng

# 1. Cái graph, do chính Git vẽ ra
git switch -qc feature
echo "feature work" >> log.txt && git commit -qam "feature commit"
git switch -q main && echo "main work" >> log.txt && git commit -qam "main commit"
git log --oneline --graph --all          # thấy chỗ rẽ nhánh: branch chỉ là cái nhãn

# 2. PHÁ #1: một cú hard reset làm "mất" hai commit
git switch -q feature
git log --oneline                        # ghi lại hash commit trên cùng
git reset --hard HEAD~2
git log --oneline                        # công việc biến mất khỏi branch…

# 3. KHÔI PHỤC: các commit vẫn còn — reflog nhớ HEAD đã đi qua đâu
git reflog | head -5
git reset --hard <hash-tu-reflog>        # dán hash của "feature commit"
git log --oneline                        # …và nó quay lại. Chưa gì bị xoá cả.

# 4. PHÁ #2: commit vào hư không (detached HEAD), rồi "làm mất" nó
git switch -q --detach HEAD~1
echo "orphan work" >> log.txt && git commit -qam "orphan commit"
git switch -q feature                    # Git cảnh báo bạn đang bỏ lại một commit
git log --oneline --all | grep orphan || echo "orphan commit không nằm trên branch nào"

# 5. KHÔI PHỤC: tìm nó trong reflog và đặt cho nó một cái tên
git reflog | head -5
git branch rescued <hash-orphan>         # branch chỉ là cái nhãn trỏ vào một node
git log --oneline rescued | head -2
```

Kết quả mong đợi: sau cú hard reset, các commit biến khỏi `git log` nhưng vẫn nằm nguyên trong `git reflog` — vì reset dời một *cái nhãn*, nó không xoá node nào. Commit ở detached HEAD cũng vậy: nó không tới được từ branch nào, chứ không phải đã mất, và tạo một branch tại hash của nó là nó trở lại bình thường. Làm hai lần như vậy rồi thì câu "branch là các nhãn trên một graph các commit" trở thành thứ bạn đã tự kiểm chứng chứ không phải thứ được nghe kể, và cơn hoảng thường theo sau `reset --hard` biến mất.

## Tự kiểm tra

1. Đồng nghiệp force-push đè lên branch của bạn và hai commit cuối "biến mất" khỏi GitHub. Bạn kiểm gì ở local, và vì sao tình huống này thường cứu được?
2. Team bạn có 4.000 unit test, coverage 92%, và production vẫn vỡ hằng tuần vì các vấn đề tích hợp. Bộ test này sai ở đâu?
3. Bạn được nhờ review một pull request 2.000 dòng. Bạn làm gì?

<details><summary>Xem đáp án</summary>

1. Kiểm `git reflog` trong bản clone local của bạn: nó ghi lại HEAD đã đi qua những đâu, nên các hash commit vẫn còn và các object vẫn tồn tại ở local cho tới khi garbage collection dọn. Tạo một branch tại hash đã mất rồi push lên. Bài học tổng quát hơn — Git gần như không bao giờ huỷ công việc đã commit, nó chỉ dời các nhãn.
2. Nó đang test sai tầng. Unit test với coverage cao xác nhận các hàm làm đúng thứ chúng được viết ra để làm; chúng không bắt được các giả định lệch nhau *giữa* các thành phần, mà đó mới là chỗ production đang vỡ. Hãy thêm integration test tại các đường may hay vỡ — ranh giới giữa các service, hợp đồng với database, đường deploy — và thôi coi phần trăm coverage là thước đo chất lượng.
3. Đề nghị tách nhỏ ra. Một review 2.000 dòng sẽ được đóng dấu cho xong, vì không ai giữ nổi ngần ấy context và sự chú ý của reviewer tụt rất nhanh theo kích thước — bạn sẽ duyệt qua các con bug một cách lịch sự. Nếu thật sự không tách được (file sinh tự động, một cú đổi tên máy móc), hãy nói rõ bạn đã review phần nào và không review phần nào, để hồ sơ được trung thực.

</details>

## Điều cần nhớ

- Git là graph: commit là node, branch là nhãn tên, reflog là nút undo — commit theo đơn vị ý nghĩa với message mà phiên bản 2-giờ-sáng của bạn bisect được.
- Ba loại test trả tiền thuê: test hành vi trên logic kiếm tiền, một test hồi quy mỗi bug thật, một smoke test — được CI cưỡng chế, không thì chỉ là gợi ý.
- Review: tác giả bán thay đổi nhỏ kèm lý do; reviewer dắt một input, phân blocking với preference, và để formatter sở hữu style.
- Đọc code là nửa chìm của nghề: điểm vào → một con đường đầu-cuối → test làm đặc tả → `git log` cho phần khảo cổ.

*Tiếp theo — Phần 10: Design patterns & abstraction: khi nào dùng, khi nào bỏ.*
