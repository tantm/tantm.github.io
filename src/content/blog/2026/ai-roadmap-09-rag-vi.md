---
title: 'RAG: làm Retrieval-Augmented Generation tử tế'
description: 'RAG là bài toán search khoác áo AI: chunking mới là quyết định thiết kế thật, vì sao hybrid search thắng vector thuần, và cách đo retrieval trước khi đổ lỗi cho model.'
date: 2026-08-04
category: AI
tags: [ai-roadmap, rag, vector-db, llm]
lang: vi
translationKey: ai-roadmap-09
series: ai-roadmap
cover: images/s03-p09-hero.png
part: 9
---

Cơn đau khai sinh, thẳng từ P07: model chưa từng thấy tài liệu của bạn, và context window là trần cứng — bạn không thể dán cả wiki công ty vào mỗi request. **RAG** (Retrieval-Augmented Generation) là câu trả lời chuẩn: *tìm* vài đoạn văn quan trọng, đặt vào prompt, và yêu cầu model trả lời từ chúng ("retrieval thắng hy vọng" của P06, giờ thành một hệ thống). Và đây là cú đổi khung giúp bạn giỏi nó: **RAG là một cỗ máy search có gắn thêm LLM — và gần như mọi thất bại của RAG là thất bại của search.** Bạn sẽ dành 20% công sức cho LLM và 80% cho retrieval, và tỷ lệ đó là đúng.

## Bạn sẽ học được gì

- Vẽ được cả hai pipeline RAG — ingest và query — và nói mỗi cái hỏng ở đâu.
- Biến chunking thành quyết định thiết kế thay vì để mặc định, và biết mỗi lựa chọn trả giá gì.
- Kết hợp tìm theo từ khoá và theo vector, và giải thích vì sao dùng riêng cái nào cũng bỏ sót.
- Đo chất lượng retrieval *trước khi* đụng vào prompt, để sửa đúng chỗ hỏng.

**Cần biết trước:** Phần 8 (prompting và structured output) và Phần 7 (ngân sách context). Phần 2 cho khái niệm embedding.

## 1. Hai pipeline

```mermaid
flowchart LR
  subgraph Ingest["Ingest (offline)"]
    D[Tài liệu] --> C[Chunk] --> E1[Embed] --> V[(Vector index)]
    C --> K[(Keyword index)]
  end
  subgraph Query["Query (online)"]
    Q[Câu hỏi] --> E2[Embed] --> S[Hybrid search]
    V --> S
    K --> S
    S --> R[Rerank + top-k] --> P[Prompt: luật + chunks + câu hỏi] --> L[LLM] --> A[Câu trả lời có căn cứ + citation]
  end
```

Hai pipeline, hai bề mặt lỗi. Ingest là một *data pipeline* (chunk, embed, index — với đầy đủ vệ sinh của S02: chạy lại idempotent, xử lý tài liệu được cập nhật). Query là một pipeline *search + prompt*. Debug chúng tách biệt — đó là toàn bộ phương pháp luận.

## 2. Embeddings: khoản lãi của Phần 2

Embedding model ánh xạ văn bản thành vector sao cho *nghĩa giống nhau → vector gần nhau* — cosine similarity (bốn ý tưởng của P02, tới lúc gặt) biến "tìm đoạn liên quan" thành "tìm hàng xóm gần nhất." Ba sự thật thực chiến: **dùng một model duy nhất cho cả tài liệu lẫn câu hỏi** (vector từ model khác nhau sống trong không gian khác nhau — so sánh chúng là vô nghĩa); **embedding bắt được nghĩa, không phải chuỗi ký tự chính xác** — "làm sao reset mật khẩu" tìm ra "quy trình khôi phục credential", đó là siêu năng lực; nhưng `ERR_CONN_5023` thì tìm không ra gì đáng tin, đó là điểm yếu mà hybrid search bên dưới vá lại; và **đổi embedding model nghĩa là re-embed toàn bộ** — hãy version cái index như một schema, vì nó chính là schema.

## 3. Chunking: quyết định thiết kế thật sự

Bạn không retrieve tài liệu; bạn retrieve **chunk** — và cỡ chunk là một trade-off thật, không phải config phụ. Quá nhỏ: chunk match nhưng thiếu ngữ cảnh để trả lời ("Có." — có cái gì?). Quá to: câu trả lời nằm trong đó, nhưng bị pha loãng giữa các chủ đề lẫn lộn, vector của nó nhão ra và retrieval trượt. Các mặc định đứng vững:

- **Bắt đầu quanh 300–800 token với ~10–15% overlap**, rồi tune theo eval set (bên dưới) — không phải theo cảm giác.
- **Cắt theo cấu trúc, không phải theo số ký tự**: heading, đoạn văn, ranh giới bảng. Một chunk bắt đầu giữa câu thì retrieve tệ và đọc còn tệ hơn.
- **Gắn metadata cho mọi chunk** — tài liệu nguồn, tiêu đề mục, ngày, mức truy cập. Nó nuôi filtered retrieval ("chỉ tài liệu policy hiện hành"), citation, và khoảnh khắc ai đó hỏi "sao nó trả lời từ sổ tay 2023?"

Chunking là nơi kiến thức domain đi vào hệ thống. Một giờ đọc tài liệu thật của bạn thắng mọi setting splitter vạn năng.

## 4. Vector DB: một cái index, không phải đền thờ

Vector database làm đúng một việc: **approximate nearest-neighbor search ở quy mô lớn** — so một query vector với hàng triệu chunk vector thật nhanh. Lời khuyên thực dụng năm 2026: **bắt đầu với năng lực vector bên trong hạ tầng bạn đang chạy sẵn** (pattern pgvector — database quan hệ của bạn mọc thêm cột vector và index; các managed search service cũng vậy). Một vector DB chuyên dụng xứng chỗ khi scale nghiêm túc hoặc nhu cầu filter nghiêm túc, không phải ở mốc 50k chunk. Và hãy coi nó là *index*, không phải nguồn sự thật: tài liệu sống ở storage thật (S04-P04); index rebuild được — chính điều đó khiến chuyện re-embed (ở trên) sống sót được.

## 5. Hybrid search: vì nghĩa không phải là tất cả

Vector search thuần thất bại đúng chỗ exact matching thắng: mã sản phẩm, chuỗi lỗi, tên riêng, số điều khoản hợp đồng. Retrieval production vì thế là **hybrid** — vector search cho nghĩa + keyword search (họ BM25) cho từ chính xác, kết quả gộp lại, rồi một **reranker** (model nhỏ chấm điểm cặp câu-hỏi↔chunk thật chuẩn) sắp xếp cái pool đã gộp để những chunk thật-sự-tốt-nhất lấp vào ngân sách context hạn hẹp (attention bậc hai của P06, hoá đơn token của P07 — top-*k* nhỏ là có lý do). Nếu chỉ thêm một thành phần ngoài RAG ngây thơ, hãy thêm reranker; nó là chiếc hộp đòn bẩy cao nhất trong sơ đồ.

## 6. Đo retrieval trước khi đổ lỗi cho model

Kỷ luật debug phân biệt RAG chạy thật với RAG demo: **khi câu trả lời sai, nhìn vào thứ được retrieve trước tiên.** Chín trên mười lần, đoạn văn đúng chưa bao giờ tới được prompt — và không lượng prompt engineering nào sửa được điều đó. Vậy nên đo từng tầng tách biệt:

- **Xây golden set** — 30–50 câu hỏi thật, mỗi câu gắn nhãn chunk/tài liệu lẽ ra phải tìm thấy. Nhàm chán, không né được, và là khoản đầu tư tốt nhất của cả hệ thống.
- **Metric retrieval**: recall@k ("chunk đúng có nằm trong top k không?") là con số cần nhìn. Nếu recall@5 là 60%, trần của bạn là 60% — ngừng tune prompt đi.
- **Metric câu trả lời**: retrieval đã verify rồi mới đánh giá generation — faithfulness (câu trả lời có bám vào chunk không?) và kỷ luật lối-thoát của P08: prompt phải *bắt buộc* "tôi không biết dựa trên tài liệu được cung cấp" thay vì ứng biến, và eval của bạn phải có những câu hỏi mà đáp án đúng chính xác là câu đó.
- **Chạy golden set ở mọi thay đổi** — cỡ chunk mới, embedding model mới, reranker mới. Đó là luật prompt-là-code của P08 mở rộng cho cả pipeline: không eval, không merge.

## Thực hành (25 phút — tự dựng retrieval từ số không, rồi đo nó)

Không vector database, không framework — ba mươi dòng numpy làm cơ chế thành cụ thể, và khối cuối mới là thói quen đáng giá: đo retrieval tách rời khỏi generation.

```python
import numpy as np, re
from collections import Counter

DOCS = [
 "To reset your password, open Settings, choose Security, then Reset password.",
 "Refunds are issued within 14 business days of an approved return request.",
 "Our API rate limit is 1000 requests per minute for the Pro plan.",
 "To delete your account, contact support; deletion is permanent after 30 days.",
 "Invoices are generated on the first business day of each month.",
 "The Pro plan costs 49 USD per seat per month, billed annually.",
]

# --- Một retriever theo từ khoá (kiểu BM25) tí hon ---
def tok(t): return re.findall(r"[a-z0-9]+", t.lower())
VOCAB = sorted({w for d in DOCS for w in tok(d)})
IDF = {w: np.log(len(DOCS) / sum(w in tok(d) for d in DOCS)) for w in VOCAB}
def kw_score(q, d):
    dt = Counter(tok(d))
    return sum(IDF.get(w, 0) * dt[w] for w in tok(q))

# --- "Embedding" đóng thế: bag of words chuẩn hoá (embedding thật thì học được; HÌNH DẠNG là thế này) ---
def embed(t):
    v = np.array([tok(t).count(w) for w in VOCAB], dtype=float)
    return v / (np.linalg.norm(v) + 1e-9)
DOC_VECS = np.array([embed(d) for d in DOCS])
def vec_score(q, i): return float(embed(q) @ DOC_VECS[i])       # cosine similarity

def retrieve(q, mode, k=2):
    scores = [(kw_score(q, d) if mode == "kw" else vec_score(q, i)) for i, d in enumerate(DOCS)]
    if mode == "hybrid":
        kws = np.array([kw_score(q, d) for d in DOCS]); vs = np.array([vec_score(q, i) for i in range(len(DOCS))])
        norm = lambda a: (a - a.min()) / (a.ptp() + 1e-9)
        scores = (norm(kws) + norm(vs)) / 2
    return [DOCS[i] for i in np.argsort(scores)[::-1][:k]]

# --- Thói quen: một golden set, và recall@k đo TRƯỚC mọi việc với prompt ---
GOLDEN = [("how do I change my password", 0),
          ("when do I get my money back",  1),
          ("how many API calls can I make", 2),
          ("what does Pro cost",            5)]

for mode in ("kw", "vec", "hybrid"):
    hits = sum(DOCS[gold] in retrieve(q, mode, k=2) for q, gold in GOLDEN)
    print(f"{mode:>7}: recall@2 = {hits}/{len(GOLDEN)}")
    for q, gold in GOLDEN:
        got = retrieve(q, mode, k=2)
        if DOCS[gold] not in got:
            print(f"          TRƯỢT {q!r} → nhận: {got[0][:45]}…")
```

Kết quả mong đợi: retriever từ khoá trượt câu "how do I change my password" vì tài liệu ghi *reset* chứ không phải *change* — thuần tuý lệch từ vựng. Retriever kiểu vector xử lý được cú diễn đạt lại đó nhưng có thể trôi ở những truy vấn cần đúng thuật ngữ. Hybrid thường đạt ít nhất bằng cái tốt hơn trong hai cái, và đó là toàn bộ lập luận cho việc kết hợp chúng. Quan trọng nhất, hãy để ý bạn vừa làm gì: bạn có một con số về chất lượng retrieval mà chưa sinh ra một chữ output nào. Khi một hệ RAG trả lời tệ, đây chính là phép đo cho bạn biết nên sửa retrieval hay sửa prompt — và gần như luôn là retrieval.

## Tự kiểm tra

1. Trợ lý RAG của bạn trả lời sai. Bạn đo gì trước, và vì sao không bắt đầu từ prompt?
2. Vì sao tìm thuần vector đôi khi trượt những tài liệu mà tìm từ khoá thường bắt được ngay lập tức?
3. Team bạn embed lại toàn bộ corpus bằng một model embedding mới hơn nhưng giữ nguyên index cũ. Cái gì vỡ?

<details><summary>Xem đáp án</summary>

1. Retrieval — cụ thể là đoạn văn đúng có nằm trong context được lấy về hay không. Nếu nó không nằm ở đó, không câu chữ prompt nào cứu được câu trả lời, và bạn sẽ tinh chỉnh nhầm thành phần. Hãy dựng một golden set gồm các cặp câu-hỏi và đoạn-mong-đợi rồi đo recall@k; khoảng 80% câu trả lời RAG tệ là lỗi retrieval.
2. Vì embedding nắm bắt nghĩa, không nắm bắt chuỗi chính xác. Các định danh hiếm — một mã lỗi, một mã sản phẩm, họ của một người — thường nằm ở vùng không gian vector không tách bạch rõ, trong khi index từ khoá khớp chúng chính xác và tức thì. Chính điểm yếu bù trừ đó là lý do retrieval hybrid thắng từng nửa riêng lẻ.
3. Mọi thứ, trong im lặng. Vector từ hai model khác nhau sống trong hai không gian khác nhau, nên độ tương đồng giữa vector tài liệu cũ và vector truy vấn mới là vô nghĩa — hệ thống trả về những thứ vô nghĩa đầy tự tin chứ không báo lỗi. Embed lại đòi hỏi dựng lại toàn bộ index, và phiên bản model embedding nên được theo dõi cùng index như một phiên bản schema.

</details>

## Điều cần nhớ

- RAG là cỗ máy search gắn thêm LLM: debug pipeline ingest và pipeline query tách biệt, và hãy chờ sẵn đa số lỗi là lỗi retrieval.
- Chunking là quyết định thiết kế: cắt theo cấu trúc, 300–800 token, có overlap, metadata trên mọi chunk — tune bằng eval set.
- Chơi hybrid: vector cho nghĩa, keyword cho từ chính xác, reranker để tiêu top-k nhỏ bé cho khôn; index đặt trong hạ tầng nhàm chán cho tới khi scale lên tiếng.
- Golden set + recall@k trước khi tune prompt; bắt buộc citation và "tôi không biết" có căn cứ — và chạy lại eval ở mọi thay đổi pipeline.

*Tiếp theo — Phần 10: Agents: LLM biết dùng tool.*
