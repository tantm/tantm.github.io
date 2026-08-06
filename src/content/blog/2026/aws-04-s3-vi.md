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

S3 trông giống một ổ chia sẻ file và chính sự giống đó là cái bẫy. Nó là một **object store** (chỗ chứa đánh địa chỉ theo key qua HTTP, không theo block ổ đĩa) — một giống loài khác với vật lý khác. Nó lặng lẽ chống lưng nửa AWS: data lake, snapshot EBS, kho log, website tĩnh, dataset ML.

## Bạn sẽ học được gì

- Giải thích được vì sao S3 không có folder và không sửa được file — và điều đó đổi gì trong code của bạn.
- Chọn storage class từ access pattern, và nhận ra hai cái bẫy trong chữ nhỏ.
- Viết lifecycle rule tự động phân bậc và xoá dữ liệu, mãi mãi.
- Chia sẻ object an toàn bằng presigned URL, và không bao giờ cần bucket public.

**Cần biết trước:** Phần 2 (IAM role — presigned URL dùng nó). Phần 1 giúp ích cho mental model mọi-thứ-là-API.

## 1. Object, không phải file

Một **bucket** S3 (tên duy nhất toàn cầu) chứa các **object**: một key (nguyên chuỗi "đường dẫn"), phần bytes, và metadata. Những cú chỉnh mental model đáng giá:

- **Không có folder.** `raw/2026/07/orders.parquet` là một key phẳng; console chỉ *vẽ* dấu gạch chéo thành cây thư mục. Hệ quả: "đổi tên folder" nghĩa là copy từng object dưới một prefix — không tồn tại cú `mv` giá rẻ.
- **Object bất biến.** Bạn không bao giờ sửa một object; bạn ghi đè nguyên khối dưới cùng key. "Append vào file trên S3" không phải một phép toán. Chính vì thế file big data đi theo các format bất biến như Parquet, và table format tồn tại để giả lập tính sửa được ở bên trên.
- **Nó là HTTP API, không phải ổ đĩa.** Khoảng mili-giây mỗi request, throughput song song gần như vô hạn. Code tối ưu là code làm *ít request hơn, to hơn* — một nghìn object 1 KB tốn thời gian và tiền hơn một object 1 MB.
- **Durability và availability là hai lời hứa khác nhau.** Mười một số 9 về durability (bytes của bạn sống sót), nhưng lỗi request lẻ tẻ là bình thường — client phải retry. Object sống trong một **region**, replicate qua các AZ; dữ liệu cư trú hợp pháp ở đâu được quyết bởi đúng một lựa chọn region đó.

![Key là phẳng: cây thư mục chỉ là hình vẽ, và mỗi object là bất biến.](images/s04-p04-concept1.png)

## 2. Storage class: cùng đống bytes, năm mức giá

Bytes không đổi; lời hứa về access pattern đổi. Thực đơn, rút gọn về những gì bạn sẽ dùng:

| Class | Thoả thuận | Dùng khi |
|---|---|---|
| Standard | Giá đủ, tức thì, không ràng buộc | Dữ liệu nóng, mặc định |
| Intelligent-Tiering | Phí giám sát nhỏ, tự chuyển bậc | Bạn thành thật không biết access pattern |
| Standard-IA | Storage rẻ hơn ~45%, phí lấy theo GB, tối thiểu 30 ngày | Backup, partition cũ thỉnh thoảng còn query |
| Glacier Instant | Rẻ hơn ~68%, vẫn truy cập mili-giây | Kho lưu hiếm chạm nhưng không chờ được |
| Glacier Deep Archive | Rẻ hơn ~95%, vài giờ để restore, tối thiểu 180 ngày | Kho compliance giữ nhiều năm |

Hai cái bẫy nấp trong chữ nhỏ. **Thời hạn lưu tối thiểu**: xoá object IA sau một tuần vẫn trả tiền đủ 30 ngày. **Phí lấy dữ liệu**: chuyển dataset nóng sang IA là khoản "tiết kiệm" lộn ngược. Vì thế mặc định thật thà cho workload lẫn lộn là Intelligent-Tiering — và công cụ thật nằm ở mục kế.

## 3. Lifecycle rule: tiering thành hiện thực

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

Dữ liệu thô nguội dần theo tuổi: Standard cho quý đang làm, IA cho năm, Deep Archive tới khi hết 7 năm retention, rồi biến mất. Viết một lần lúc thiết kế, nó cộng dồn tiết kiệm mãi mãi.

Nhớ trám luôn lỗ rò kém hào nhoáng: một rule **huỷ multipart upload dang dở** sau 7 ngày. Các cú upload fail để lại phần dữ liệu mồ côi, âm thầm tính tiền cho tới khi có thứ gì đó xoá chúng.

## 4. Versioning: nút undo kèm hoá đơn

Bật versioning là ghi đè/xoá thôi phá huỷ dữ liệu: các version cũ xếp chồng; một cú xoá chỉ thêm *delete marker*. Hai lưỡi:

- **Mặt tốt**: chống lỡ tay, và là nền cho replication + audit trail. Bucket chứa thứ không thay thế được thì đây là điều không thương lượng.
- **Hoá đơn**: mỗi version bị ghi đè tiếp tục tính tiền nguyên giá class. Versioning **không kèm** lifecycle rule dọn version cũ (`NoncurrentVersionExpiration`) là một sự cố chi phí quay chậm — cặp đôi này đi cùng nhau, luôn luôn.

## 5. Presigned URL: chia sẻ mà không mở cửa

Bucket vẫn private. Backend của bạn, dùng IAM role từ Phần 2, đúc một URL có hạn giờ, cấp đúng một thao tác trên đúng một object:

```python
url = s3.generate_presigned_url("get_object",
        Params={"Bucket": "my-app-uploads", "Key": "reports/july.pdf"},
        ExpiresIn=900)   # 15 phút, chỉ object này
```

Một primitive này chống lưng đa số tính năng "tải hoá đơn" và "upload avatar" trên Internet. Upload của user đi *thẳng* vào S3 qua presigned PUT, không bao giờ chảy qua backend — nên bạn không phải size server cho lưu lượng file. Nó giữ bucket private trong khi sản phẩm vẫn tiện.

Và nó dẫn tới chế độ hỏng nổi tiếng: **bucket public**. Một thập kỷ tít báo rò rỉ đến từ "cứ mở public cho app chạy đã." S3 hiện đại bật sẵn **Block Public Access** — cứ để yên. Ngoại lệ chính danh là hosting website tĩnh *có chủ đích*, và ngay cả khi đó vẫn ưu tiên CloudFront kèm Origin Access Control để bản thân bucket không public. Nếu bạn sắp bỏ tick cái ô đó vì bất kỳ lý do nào khác — đáp án đúng là một presigned URL.

## Thực hành (25 phút — free tier, cảm nhận từng cơ chế)

Làm theo thứ tự; mỗi bước cho ra một thứ nhìn thấy được:

```bash
B=my-s3-lab-$RANDOM                                  # tên bucket là duy nhất toàn cầu
aws s3 mb s3://$B                                    # Block Public Access bật sẵn — cứ để yên

# 1. Key là phẳng: cái "folder" chỉ là hình vẽ
echo "hello" > a.txt
aws s3 cp a.txt s3://$B/raw/2026/07/a.txt
aws s3api list-objects-v2 --bucket $B --query 'Contents[].Key'   # một key duy nhất, kèm cả dấu /

# 2. Versioning: nút undo
aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
echo "goodbye" > a.txt && aws s3 cp a.txt s3://$B/raw/2026/07/a.txt
aws s3api list-object-versions --bucket $B --query 'Versions[].[Key,VersionId,IsLatest]'
aws s3 rm s3://$B/raw/2026/07/a.txt                  # một delete marker, không phải xoá thật
aws s3api list-object-versions --bucket $B --query 'DeleteMarkers[].VersionId'
# khôi phục: xoá cái marker (dán VersionId ở trên vào)
aws s3api delete-object --bucket $B --key raw/2026/07/a.txt --version-id <MARKER_ID>
aws s3 cp s3://$B/raw/2026/07/a.txt -                # "goodbye" quay lại

# 3. Lifecycle: phân bậc + lỗ rò multipart, trong một bộ rule
cat > lc.json <<'EOF'
{"Rules":[
 {"ID":"archive-raw","Status":"Enabled","Filter":{"Prefix":"raw/"},
  "Transitions":[{"Days":30,"StorageClass":"STANDARD_IA"}],
  "NoncurrentVersionExpiration":{"NoncurrentDays":7}},
 {"ID":"abort-multipart","Status":"Enabled","Filter":{"Prefix":""},
  "AbortIncompleteMultipartUpload":{"DaysAfterInitiation":7}}]}
EOF
aws s3api put-bucket-lifecycle-configuration --bucket $B --lifecycle-configuration file://lc.json
aws s3api get-bucket-lifecycle-configuration --bucket $B   # cả hai rule đã đăng ký

# 4. Presigned URL: chia sẻ mà không cần public
aws s3 presign s3://$B/raw/2026/07/a.txt --expires-in 60
curl -s "https://$B.s3.amazonaws.com/raw/2026/07/a.txt"     # AccessDenied — bucket đang private
curl -s "<dán presigned url>"                               # "goodbye" — một object, một phút

aws s3 rb s3://$B --force                                   # dọn dẹp
```

Kết quả mong đợi: bước 1 cho thấy đúng một key phẳng — không hề có object folder nào. Ở bước 2, cú xoá không hề mất dữ liệu; object quay lại khi bạn xoá cái marker, và đó là lúc "nút undo" thôi là phép ẩn dụ. Rule thứ hai ở bước 3 là thứ không ai nhớ nhưng hoá đơn nào cũng nhớ. Ở bước 4, URL trần bị từ chối trong khi URL presigned chạy đúng 60 giây — chính sự tương phản đó là toàn bộ lập luận chống bucket public.

## Tự kiểm tra

1. Đồng nghiệp muốn "đổi tên folder `raw/2026/` thành `raw/archive/`". Thực tế phải làm gì, và tốn gì?
2. Bạn chuyển 5 TB dữ liệu đang bị query liên tục sang Standard-IA để tiết kiệm. Hai đường nào khiến nó hoá ra *đắt hơn*?
3. Bạn bật versioning cho bucket bị ghi đè 10 GB mỗi ngày, và hoá đơn tăng gấp ba sau một tháng. Bạn quên gì, và sửa thế nào?

<details><summary>Xem đáp án</summary>

1. Mọi object dưới prefix phải được copy sang key mới rồi xoá key cũ — không tồn tại phép đổi tên, vì không tồn tại folder. Cái giá là một cặp request cho mỗi object cộng thời gian copy dữ liệu; với hàng triệu object nhỏ thì vừa chậm vừa không miễn phí.
2. Phí lấy dữ liệu (query liên tục nghĩa là trả phí per-GB retrieval liên tục), và thời hạn lưu tối thiểu 30 ngày nếu phần dữ liệu đó bị xoá hoặc chuyển bậc sớm. Cả hai khiến IA sai chỗ cho dữ liệu nóng.
3. Quên lifecycle rule `NoncurrentVersionExpiration`. Mỗi lần ghi đè giữ lại version cũ tính tiền nguyên giá mãi mãi; versioning và dọn version cũ luôn đi thành cặp.

</details>

## Điều cần nhớ

- S3 là object store: key phẳng không phải folder, object bất biến không phải file sửa được, HTTP API không phải ổ đĩa — ít request hơn, to hơn là thắng.
- Storage class là giá của lời hứa access pattern; thời hạn tối thiểu và phí lấy là phần chữ nhỏ; lifecycle rule tự động hoá tiering mãi mãi.
- Versioning là nút undo và nó tính tiền — luôn ghép với dọn version cũ.
- Bucket giữ private: presigned URL để chia sẻ, Block Public Access không đụng vào, CloudFront cho ca website có chủ đích.

*Tiếp theo — Phần 5: VPC networking không đau đầu.*
