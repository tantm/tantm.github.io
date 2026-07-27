---
title: 'S3 chuyên sâu: hơn cả chỗ chứa file'
description: 'Object không phải file, prefix không phải folder — cộng storage class, lifecycle rule, versioning, presigned URL, và sai lầm public-bucket từng làm S3 nổi tiếng.'
date: 2026-07-30
category: Cloud
tags: [aws, s3, storage, aws-zero-to-advanced]
lang: vi
translationKey: aws-04
series: aws-zero-to-advanced
part: 4
---

S3 trông giống một ổ chia sẻ file và chính sự giống đó là cái bẫy. Nó là một **object store** — một giống loài khác với vật lý khác — và nó lặng lẽ chống lưng nửa AWS: các data lake của S07, snapshot EBS, kho log, website tĩnh, dataset ML. Hiểu S3 cho đúng thì cả tá service về sau thành hiển nhiên; hiểu sai thì bạn sẽ vật lộn với những cái "folder" không tồn tại.

## Object, không phải file

Một **bucket** S3 (tên duy nhất toàn cầu) chứa các **object**: một key (nguyên chuỗi "đường dẫn"), phần bytes, và metadata. Những cú chỉnh mental model đáng giá:

- **Không có folder.** `raw/2026/07/orders.parquet` là một key phẳng; console chỉ *vẽ* dấu gạch chéo thành cây thư mục. Hệ quả: "đổi tên folder" nghĩa là copy từng object dưới một prefix — không tồn tại cú `mv` giá rẻ.
- **Object bất biến.** Bạn không bao giờ sửa một object; bạn ghi đè nguyên khối dưới cùng key. "Append vào file trên S3" không phải một phép toán — chính vì thế file big data đi theo các format bất biến như Parquet (nấc thang S02-P03), và table format (S07-P03) tồn tại để giả lập tính sửa được ở bên trên.
- **Nó là HTTP API, không phải ổ đĩa** (mọi-thứ-là-API của Phần 1): ~mili-giây mỗi request, throughput song song gần như vô hạn. Code tối ưu là code làm *ít request hơn, to hơn* — một nghìn object 1 KB tốn thời gian và tiền hơn một object 1 MB.
- **Durability và availability là hai lời hứa khác nhau**: mười một số 9 về durability (bytes của bạn sống sót) nhưng lỗi request lẻ tẻ là bình thường — client phải retry (idempotency, lại nó). Object đáp xuống một **region**, replicate qua các AZ — residency (S07-P10) được quyết bởi lựa chọn region của bucket.

## Storage class: cùng đống bytes, năm mức giá

Bytes không đổi; lời hứa về access pattern đổi. Thực đơn, rút gọn về những gì bạn sẽ dùng:

| Class | Thoả thuận | Dùng khi |
|---|---|---|
| Standard | Giá đủ, tức thì, không ràng buộc | Dữ liệu nóng, mặc định |
| Intelligent-Tiering | Phí giám sát nhỏ, tự chuyển bậc | Bạn thành thật không biết access pattern |
| Standard-IA | Storage rẻ hơn ~45%, phí lấy theo GB, tối thiểu 30 ngày | Backup, partition cũ thỉnh thoảng còn query |
| Glacier Instant | Rẻ hơn ~68%, vẫn truy cập mili-giây | Kho lưu hiếm chạm nhưng không chờ được |
| Glacier Deep Archive | Rẻ hơn ~95%, vài giờ để restore, tối thiểu 180 ngày | Kho compliance (các năm retention của S07-P10) |

Hai cái bẫy nấp trong chữ nhỏ: **thời hạn lưu tối thiểu** (xoá object IA sau một tuần vẫn trả tiền đủ 30 ngày) và **phí lấy dữ liệu** (chuyển dataset nóng sang IA là khoản "tiết kiệm" lộn ngược). Vì thế mặc định thật thà cho workload lẫn lộn là Intelligent-Tiering, và công cụ thật nằm ở mục kế.

## Lifecycle rule: tiering của S07-P12, thành hiện thực

Pattern FinOps "phân bậc tự động" đúng nghĩa đen là một rule JSON của S3:

```json
{
  "Rules": [{
    "ID": "archive-raw-data",
    "Filter": { "Prefix": "raw/" },
    "Transitions": [
      { "Days": 90,  "StorageClass": "STANDARD_IA" },
      { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
    ],
    "Expiration": { "Days": 2555 }
  }]
}
```

Dữ liệu thô nguội dần theo tuổi: Standard cho quý đang làm, IA cho năm, Deep Archive tới khi hết 7 năm retention, rồi biến mất. Viết một lần lúc thiết kế ("quyết retention lúc thiết kế" của S07-P12 — đây chính là cơ chế), nó cộng dồn tiết kiệm mãi mãi. Nhớ trám luôn lỗ rò kém hào nhoáng: một rule **huỷ multipart upload dang dở** sau 7 ngày — các cú upload fail âm thầm tính tiền cho tới khi bạn làm việc này.

## Versioning: nút undo kèm hoá đơn

Bật versioning là ghi đè/xoá thôi phá huỷ dữ liệu: các version cũ xếp chồng; một cú xoá chỉ thêm *delete marker*. Hai lưỡi:

- **Mặt tốt**: chống lỡ tay, và là nền cho replication + audit trail. Bucket chứa thứ không thay thế được thì đây là điều không thương lượng.
- **Hoá đơn**: mỗi version bị ghi đè tiếp tục tính tiền nguyên giá class. Versioning **không kèm** lifecycle rule dọn version cũ (`NoncurrentVersionExpiration`) là một sự cố chi phí quay chậm — cặp đôi này đi cùng nhau, luôn luôn.

## Presigned URL: chia sẻ mà không mở cửa

Bucket vẫn private; backend của bạn (dùng IAM role của nó, S04-P02) đúc một URL có hạn giờ, cấp đúng một thao tác trên đúng một object:

```python
url = s3.generate_presigned_url("get_object",
        Params={"Bucket": "my-app-uploads", "Key": "reports/july.pdf"},
        ExpiresIn=900)   # 15 phút, chỉ object này
```

Một primitive này chống lưng đa số tính năng "tải hoá đơn" và "upload avatar" trên Internet — upload của user đi *thẳng* vào S3 qua presigned PUT, không bao giờ chảy qua (hay bắt bạn size server cho) backend. Đó là pattern giữ bucket private trong khi sản phẩm vẫn tiện.

Và nó dẫn tới chế độ hỏng nổi tiếng: **bucket public**. Một thập kỷ tít báo rò rỉ đến từ "cứ mở public cho app chạy đã." S3 hiện đại bật sẵn **Block Public Access** — cứ để yên. Ngoại lệ chính danh là hosting website tĩnh *có chủ đích* (pattern của chính blog này qua dạng GitHub Pages; trên AWS, ưu tiên CloudFront + Origin Access Control để bản thân bucket vẫn không public). Nếu bạn sắp bỏ tick cái ô đó vì bất kỳ lý do nào khác — đáp án đúng là một presigned URL.

## Thực hành (20 phút, free tier)

1. Tạo bucket (Block Public Access bật), upload một file qua console và CLI (`aws s3 cp`).
2. Bật versioning; ghi đè file; liệt kê version; xoá nó; quan sát delete marker; khôi phục bằng cách xoá cái marker. Cảm nhận nút undo.
3. Thêm lifecycle rule ở trên (rút xuống 1 ngày để thấy nó có hiệu lực) + rule huỷ multipart.
4. Sinh presigned URL từ CLI, mở trong cửa sổ ẩn danh, xem nó chạy — rồi hết hạn.

## Điều cần nhớ

- S3 là object store: key phẳng không phải folder, object bất biến không phải file sửa được, HTTP API không phải ổ đĩa — ít request hơn, to hơn là thắng.
- Storage class là giá của lời hứa access pattern; thời hạn tối thiểu và phí lấy là phần chữ nhỏ; lifecycle rule tự động hoá tiering mãi mãi.
- Versioning là nút undo và nó tính tiền — luôn ghép với dọn version cũ.
- Bucket giữ private: presigned URL để chia sẻ, Block Public Access không đụng vào, CloudFront cho ca website có chủ đích.

*Tiếp theo — Phần 5: VPC networking không đau đầu.*
