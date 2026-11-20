# 02 – Kho câu hỏi (Question Bank)

> Giai đoạn: 1, mở rộng ở giai đoạn 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Kho câu hỏi dùng chung cho mọi giáo viên. Giáo viên tạo câu hỏi một lần rồi ghép vào nhiều bài quiz. Từ giai đoạn 3 soạn được đủ **4 dạng**: **Trắc nghiệm**, **Nối từ**, **Điền từ**, **Sắp xếp câu**; mọi dạng có thể kèm **ảnh** (upload) và **câu đọc to** (dạng Nghe). Nhập hàng loạt từ CSV: xem [13](13-question-import.md).

## Luồng chính
1. Giáo viên vào **Kho câu hỏi** → lọc theo chủ đề, lớp, dạng, từ khoá, "của tôi". Câu nghe có nhãn 🔊 Nghe.
2. Tạo/sửa câu hỏi ở `/teacher/questions/new` hoặc ngay trong màn tạo quiz (modal):
   - Chọn dạng → phần đáp án đổi theo dạng (xem bảng dưới).
   - **Tải ảnh** (PNG/JPG/WebP ≤ 1 MB) hoặc dán link https.
   - **Câu đọc to bằng tiếng Anh** (tuỳ chọn) + nút ▶ Nghe thử; có nội dung này thì kỹ năng tự chuyển sang **Nghe** (trừ khi giáo viên đã tự chọn kỹ năng).
   - **Phân loại** (tuỳ chọn): nhãn, cấp độ Cambridge (Starters/Movers/Flyers), bài SGK.
3. Xoá câu hỏi chỉ được khi không quiz nào đang dùng nó.

| Dạng | Giáo viên nhập | Học sinh làm |
| --- | --- | --- |
| Trắc nghiệm | 2–6 lựa chọn, đánh dấu 1 đáp án | Chạm một ô |
| Nối từ | 2–6 cặp trái ↔ phải | Chạm trái rồi chạm phải |
| Điền từ | Câu có đúng một chỗ trống `___` (nút **Chèn chỗ trống**); 1–5 đáp án được chấp nhận; tuỳ chọn **từ gợi ý** 2–6 từ (bật "Cho chọn từ (lớp 1–3)") | Có từ gợi ý: chạm chọn từ; không có: gõ chữ |
| Sắp xếp câu | 2–10 phần theo đúng thứ tự (nút ↑/↓, hoặc gõ cả câu rồi **Tách từ**) | Chạm thẻ để xếp lên dòng câu |

## Backend
- Module: `be/src/modules/questions/` (+ `be/src/modules/uploads/` cho ảnh)

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/questions?topic&gradeLevel&type&search&mine&page&limit` | Teacher/Admin | Danh sách có phân trang `{ items, total, page, limit }` |
| GET | `/questions/topics` | Teacher/Admin | Danh sách chủ đề (cho ô lọc/gợi ý) |
| GET | `/questions/:id` | Teacher/Admin | Chi tiết (kèm đáp án) |
| POST | `/questions` | Teacher/Admin | Tạo câu hỏi |
| PUT | `/questions/:id` | Chủ sở hữu/Admin | Ghi đè toàn bộ câu hỏi |
| DELETE | `/questions/:id` | Chủ sở hữu/Admin | Xoá; 409 nếu đang được quiz dùng |
| POST | `/uploads/images` (multipart, trường `file`) | Teacher/Admin | Lưu ảnh, trả `{ key, url, contentType, size }`. Sai loại → 415, > 1 MB → 413 |
| GET | `/uploads/images/:key` | Công khai | Phục vụ ảnh khi `STORAGE_DRIVER=local` |
| GET/POST | `/questions/import…` | Teacher/Admin | Nhập CSV — tài liệu [13](13-question-import.md) |

- Command: `CreateQuestionCommand`, `UpdateQuestionCommand`, `DeleteQuestionCommand`, `ImportQuestionsCommand` · Query: `ListQuestionsQuery`, `GetQuestionQuery`, `ListTopicsQuery`.
- Collection `questions`:

| Trường | Ghi chú |
| --- | --- |
| `topic`, `gradeLevel` (1–5) | có index, dùng để lọc |
| `type` | `multiple_choice` \| `matching` \| `fill_in_blank` \| `ordering` |
| `skill` | `vocabulary` \| `grammar` \| `listening`; mặc định `listening` nếu có `audioText` |
| `questionText` | điền từ: chứa đúng một `___` (mọi chuỗi ≥ 3 dấu `_` được chuẩn hoá về `___`) |
| `mediaUrl?` | link http(s) hoặc ảnh đã upload `/api/v1/uploads/images/<uuid>.png` |
| `audioText?` | câu tiếng Anh trình duyệt đọc to (≤ 200 ký tự) |
| `explanation?` | hiện cho học sinh khi trả lời sai |
| `options: string[]` | trắc nghiệm: các lựa chọn · điền từ: từ gợi ý (không bắt buộc) |
| `correctAnswer: Mixed` | trắc nghiệm: chuỗi · điền từ: `string[]` đáp án chấp nhận · sắp xếp: `string[]` đúng thứ tự |
| `pairs: {left,right}[]` | nối từ: **chính các cặp là đáp án** |
| `tags[]`, `yleLevel?`, `unit?` | phân loại (giai đoạn 3) |
| `externalId?` | mã nội dung chuẩn (unique, sparse) để nạp lại không trùng |
| `createdBy` | `null` = câu hỏi hệ thống |

- Quy tắc nội dung (`question-content.validator.ts`, có unit test):
  - Trắc nghiệm: 2–6 lựa chọn, không trùng (không phân biệt hoa thường), đáp án phải nằm trong lựa chọn.
  - Nối từ: 2–6 cặp, vế trái không trùng, vế phải không trùng.
  - Điền từ: đúng một chỗ trống; ít nhất 1 đáp án (bỏ trùng, giữ cách viết đầu tiên); nếu có từ gợi ý thì không trùng và phải chứa ít nhất một đáp án.
  - Sắp xếp: 2–10 phần, không rỗng, ít nhất 2 phần khác nhau.
  - Trường không thuộc dạng câu hỏi bị bỏ.
- Chấm điểm (`progress/grading/graders.ts`): mọi so sánh không phân biệt hoa thường/khoảng trắng thừa; điền từ đúng nếu khớp **một** đáp án chấp nhận; sắp xếp đúng khi **mọi vị trí** khớp.
- Quyền: mọi giáo viên **xem** được toàn bộ kho; **sửa/xoá** chỉ câu do mình tạo (admin sửa tất cả, câu hệ thống chỉ admin sửa). Học sinh **không** truy cập được kho (403).
- Ảnh: `@nestjs/storage` với `STORAGE_DRIVER=local` (thư mục `UPLOAD_DIR`) hoặc `s3`; loại file xác định bằng **chữ ký file**, không tin đuôi.

## Frontend
- Feature: `fe/src/features/questions/`
- Route: `/teacher/questions` (`QuestionBankPage`, có nút **📥 Nhập từ CSV**), `/teacher/questions/new`, `/teacher/questions/:id/edit` (`QuestionEditorPage`), `/teacher/questions/import` (`QuestionImportPage`, tài liệu 13).
- `QuestionForm`: form dùng chung cho trang sửa và modal trong màn tạo quiz; các phần nhập theo dạng nằm ở `components/editors/` (`ChoiceEditors`, `TypedEditors`, `MediaEditor`, `ChipsInput`).
  - Kiểm tra trước ở trình duyệt (chỗ trống, từ gợi ý có đáp án…) cho thông báo dễ hiểu; server vẫn kiểm tra lại.
  - Ảnh được kiểm tra loại/dung lượng trước khi gửi (`questionsApi.uploadImage`).
- `QuestionPreview`: nhãn dạng, 🔊 cho câu nghe, ảnh thu nhỏ, đáp án theo dạng, nhãn phân loại.
- Đọc to: `fe/src/shared/speech` (`speak`, `voicesReady`), xem tài liệu [04](04-play-quiz.md).

## Quyết định thiết kế
- **Nối từ lưu `pairs`, không lưu `correctAnswer`**: tránh dùng chuỗi tuỳ ý làm key object trong MongoDB và tránh hai nguồn sự thật.
- **PUT ghi đè toàn bộ** thay vì PATCH: luật kiểm tra phụ thuộc dạng câu hỏi.
- **Chặn xoá câu đang dùng** (409) thay vì xoá lan; kiểm tra qua `CountQuizzesUsingQuestionQuery` trên QueryBus.
- **Điền từ có từ gợi ý tuỳ chọn**: trẻ lớp 1–3 gõ phím chậm và hay sai chính tả không phải lỗi kiến thức → cho chạm chọn từ; lớp 4–5 tắt gợi ý để luyện viết.
- **Body API dùng `acceptedAnswers` / `orderedItems`** thay vì nhồi vào `correctAnswer`: kiểm tra kiểu rõ ràng bằng class-validator; khi lưu vẫn gộp về `correctAnswer`.
- **Giọng đọc của trình duyệt** thay cho file âm thanh: không tốn lưu trữ, giáo viên chỉ gõ chữ (quyết định D11). Đổi lại `audioText` có trong dữ liệu chơi (xem "Tồn đọng").

## Kiểm thử
- Unit: `question-content.validator.spec.ts` (chỗ trống, đáp án trùng, từ gợi ý, sắp xếp).
- e2e `app.e2e-spec.ts` nhóm `question bank`: chặn học sinh, luật trắc nghiệm, tạo 2 dạng, lọc; xoá câu đang dùng → 409.
- e2e `phase3.e2e-spec.ts` nhóm `new question types, listening and images`: upload ảnh (415 khi giả đuôi, 413 khi quá cỡ, 403 với học sinh, chặn đường dẫn lạ), tạo điền từ/sắp xếp/câu nghe, link `javascript:` → 400.

## Hướng mở rộng / còn tồn đọng
- `audioText` gửi xuống máy học sinh để đọc to → với câu "nghe và chọn từ" có thể lộ đáp án nếu mở công cụ dev. Khắc phục: dựng file âm thanh ở server.
- Upload file âm thanh thật (giọng giáo viên).
- Admin duyệt câu hỏi trước khi chia sẻ cho cả trường.
