# 13 – Nhập câu hỏi từ CSV & kho nội dung chuẩn

> Giai đoạn: 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
- Giáo viên đưa hàng chục câu hỏi vào kho trong một lần (soạn bằng Excel/Google Sheets) thay vì nhập từng câu.
- Admin nạp **kho nội dung chuẩn** (Cambridge Starters/Movers/Flyers) và dựng các **trạm hệ thống** trên bản đồ.

## Luồng chính
1. **Kho câu hỏi → 📥 Nhập từ CSV** (`/teacher/questions/import`).
2. **⬇️ Tải file mẫu** (header + một ví dụ mỗi dạng) → soạn trong Excel → **Lưu thành "CSV UTF-8 (Comma delimited)"** (giữ đúng tiếng Việt và emoji).
3. Kéo thả hoặc chọn file → trình duyệt đọc file (UTF-8) và gửi **chạy thử** (`dryRun=true`): không ghi gì.
4. Màn kết quả: tổng số dòng, **sẽ tạo**, **bỏ qua** (kèm lý do), **lỗi** (bảng đỏ theo số dòng trong bảng tính), bảng xem trước các câu hợp lệ.
5. **Nhập N câu hợp lệ** → gửi lại với `dryRun=false` → màn "Đã nhập xong" → về kho câu hỏi. Dòng lỗi không được nhập; sửa file rồi nhập lại (câu đã nhập sẽ được bỏ qua vì trùng).

## Định dạng CSV
- Dòng 1 là tên cột (không phân biệt hoa thường). Cột bắt buộc: `type, topic, gradeLevel, questionText`.
- Dấu phân cách `,` (hoặc `;` nếu Excel ở máy dùng dấu chấm phẩy — tự nhận từ dòng tiêu đề). Ô có dấu phẩy/xuống dòng đặt trong `"…"`, dấu `"` trong ô viết `""`.
- **Danh sách trong một ô ngăn bằng `|`**; **cặp nối viết `trái=phải`**.

| Cột | Ý nghĩa |
| --- | --- |
| `type` | `multiple_choice` (hoặc `mc`), `matching` (`match`), `fill_in_blank` (`fill`), `ordering` (`order`) |
| `topic`, `gradeLevel` (1–5), `skill` | `skill`: `vocabulary` \| `grammar` \| `listening` (bỏ trống: Nghe nếu có `audioText`, ngược lại Từ vựng) |
| `questionText` | Điền từ: có đúng một `___` |
| `options` | Trắc nghiệm: `Dog\|Cat\|Duck` · Điền từ: từ gợi ý (tuỳ chọn) |
| `correctAnswer` | Trắc nghiệm: `Dog` · Điền từ: các đáp án chấp nhận `cat\|kitten` · Sắp xếp: các phần theo đúng thứ tự `I\|like\|cats` |
| `pairs` | Nối từ: `🐶=dog\|🐱=cat` |
| `audioText`, `mediaUrl`, `explanation` | Tuỳ chọn (`mediaUrl`: link https hoặc ảnh đã upload) |
| `tags` | `pets\|farm` |
| `yleLevel`, `unit` | `starters` \| `movers` \| `flyers`; bài SGK |
| `externalId` | Chỉ admin: mã ổn định của nội dung chuẩn — nhập lại sẽ **cập nhật** thay vì tạo mới |
| `quiz`, `quizEmoji` | Chỉ dùng bởi `seed:content` để gom câu thành trạm; màn nhập bỏ qua |

## Backend
- Module: `be/src/modules/questions/import/`

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/questions/import/template` | Teacher/Admin | File mẫu `mau-cau-hoi-enquiz.csv` (UTF-8 có BOM) |
| POST | `/questions/import?dryRun=true\|false` body `{ csv }` | Teacher/Admin | Báo cáo `{ dryRun, total, created, updated, skipped[], errors[], preview[] }` |

- Command: `ImportQuestionsCommand` → `QuestionImportService` (dùng lại cho `seed:content`).
- `csv.ts`: bộ đọc CSV theo RFC 4180 tự viết (có unit test), không thêm thư viện. `question-row.ts`: dòng → body giống form → **cùng** `class-validator` + `assertValidQuestionContent` như khi soạn tay; thông báo lỗi tiếng Việt theo cột ("Cột gradeLevel: quá lớn").
- Quy tắc:
  - Tối đa **500 dòng** mỗi lần; body JSON tối đa 2 MB.
  - **Trùng** = cùng khối + dạng + nội dung câu + đáp án (không phân biệt hoa thường). Trùng trong file → "Trùng với dòng X"; trùng với kho (của giáo viên đó, hoặc kho hệ thống nếu là admin) → "Đã có trong kho câu hỏi". Đáp án nằm trong khoá trùng vì lời dặn như "Sắp xếp thành câu đúng" lặp lại có chủ ý.
  - Giáo viên nhập vào kho của mình; **admin nhập vào kho hệ thống** (`createdBy = null`), dòng có `externalId` đã tồn tại được cập nhật.

### Kho nội dung chuẩn (`npm run seed:content`)
- Đọc mọi file `be/src/database/seed/content/*.csv` (hiện có `starter-bank.csv`: 48 câu tự soạn, 8 trạm cho lớp 1–5, đủ 4 dạng và có câu nghe).
- Mỗi file: chạy thử trước — có dòng lỗi thì **không nhập file đó** và in lỗi; hợp lệ thì nhập với quyền hệ thống, rồi gom các dòng theo `(gradeLevel, quiz)` thành **quiz hệ thống** (trạm bản đồ) — tạo mới ở cuối bản đồ (`mapOrder`) hoặc cập nhật danh sách câu nếu trạm đã có.
- Chạy lại an toàn (khớp theo `externalId` và tên trạm). Ghi vào database trong `MONGODB_URI` (cảnh báo nếu là `memory`).
- ⚠️ Nội dung tự soạn dựa trên danh mục từ vựng; **không chép** đề mẫu Cambridge hay SGK. Nội dung mới nên có giáo viên tiếng Anh duyệt trước khi thêm file.

## Frontend
- Feature: `fe/src/features/questions/` — `pages/QuestionImportPage.tsx`, `questionsApi.importCsv` / `downloadTemplate`.
- Route: `/teacher/questions/import` (giáo viên, admin). Nút **📥 Nhập từ CSV** trên trang kho câu hỏi.
- Kiểm tra ở trình duyệt: đuôi `.csv`, ≤ 2 MB; đọc file bằng `FileReader` (UTF-8).
- Trạng thái màn hình: chọn file → đang kiểm tra → xem kết quả → đang nhập → xong.

## Quyết định thiết kế
- **Trình duyệt gửi nội dung file dạng JSON** thay vì multipart: server không cần lưu file tạm, dùng lại được cho CLI.
- **Luôn chạy thử trước**: giáo viên thấy lỗi theo số dòng trong bảng tính trước khi có gì được ghi.
- **CSV, chưa đọc .xlsx**: thư viện đọc Excel lớn; Excel/Google Sheets đều lưu được "CSV UTF-8".

## Kiểm thử
- Unit: `csv.spec.ts` (ngoặc kép, xuống dòng trong ô, CRLF, BOM, dấu `;`).
- e2e `phase3.e2e-spec.ts` nhóm `CSV import and quest-map order`: chạy thử báo lỗi đúng dòng + trùng trong file, không ghi DB; nhập thật 4 câu, nhập lại → 0 câu mới; thiếu cột → 400; học sinh → 403; file mẫu tải được; `starter-bank.csv` hợp lệ toàn bộ (48 câu).

## Hướng mở rộng / còn tồn đọng
- Đọc trực tiếp `.xlsx`; xuất kho câu hỏi ra CSV.
- Nhập ảnh hàng loạt (zip).
- Mở rộng kho chuẩn lên ~300 câu (mục tiêu kế hoạch 3.5).
