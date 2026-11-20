# Kế hoạch Giai đoạn 4 – Lên production, dọn nợ, Exam Mode & UX

> Trạng thái: **Đang triển khai** · 4.0: code xong, chờ dựng hạ tầng · 4.1–4.3: chưa bắt đầu · Lập: 2026-11-20 · Xem [roadmap](roadmap.md)

Bản nháp lộ trình ban đầu đặt Giai đoạn 4 là "Cải thiện UX/DX, Exam Mode & Dọn nợ nền tảng", còn việc deploy để tận Giai đoạn 6. Khi rà soát, có ba lý do khiến deploy phải lên trước:
- Đáp án câu nghe đang bị lộ qua `audioText`.
- Ảnh upload sẽ mất trên mọi nền tảng có ổ đĩa tạm.
- Cookie refresh (Giai đoạn 6) và Socket.io (Giai đoạn 5) đều phụ thuộc cách chọn domain lúc deploy.

Vì vậy Giai đoạn 4 được sắp lại thành **4.0 Deploy → 4.1 Bảo mật & nợ kỹ thuật → 4.2 Exam Mode**. **4.3 UX** làm song song sau khi xong 4.0.

---

## 1. Hiện trạng và khoảng trống

| Vấn đề hiện tại | Hệ quả | Xử lý ở |
| --- | --- | --- |
| Chưa có git, CI, môi trường production | Không có ai ngoài máy dev dùng được; không tự kiểm tra trước khi gộp code | 4.0 |
| Ảnh lưu ra đĩa local (`STORAGE_DRIVER=local`) | Cloud Run và Render đều xoá đĩa khi restart: mất ảnh mà không báo lỗi | 4.0 |
| Giới hạn đăng nhập 10 lần/phút **theo IP**, không có `trust proxy` | Sau proxy, mọi người dùng chung một bộ đếm; cả trường chung một IP nên lớp 30 em đăng nhập cùng lúc bị chặn | 4.0 |
| Thêm/gỡ học sinh khỏi bài tập chạy trong **event handler sau response** | Trên Cloud Run CPU bị hạ sau response nên việc này có thể treo hoặc mất; e2e chỉ pass nhờ handler chạy kịp | 4.0 |
| Không có cách tạo admin khi tắt dữ liệu demo | Production không có ai duyệt giáo viên, sắp thứ tự trạm | 4.0 |
| `audioText` gửi xuống máy học sinh | Lộ đáp án câu "nghe và chọn"; Exam Mode càng nghiêm trọng | 4.1 |
| Tạo học sinh hàng loạt: `insertMany` rồi `updateOne` lớp, không transaction | Lỗi giữa chừng để lại tài khoản không thuộc lớp nào | 4.1 |
| `@nestjs/storage@0.0.5` (bản 0.0.x) | Rủi ro bảo trì; chưa từng chạy với bucket thật | 4.1 |
| 14 file còn dùng `useAsync` (9 file đã dùng TanStack Query) | Hai cách lấy dữ liệu song song, không cache | 4.1 |
| Chỉ có chế độ chơi "classic" (phản hồi từng câu, câu đầu là cuối) | Giáo viên không ra được bài kiểm tra có giờ, đi lại giữa các câu | 4.2 |
| Sắp xếp câu & Nối từ khó thao tác trên tablet; thiếu thao tác giáo viên (nhân bản câu, CSV mẫu…) | Trải nghiệm lớp 1–2 và giáo viên chưa mượt | 4.3 |

**Đã có sẵn để tận dụng:**
- `quiz_sessions` có unique index `{studentId, quizId, assignmentId}`, có thể dùng luôn làm khoá "1 lượt" cho Exam (E8).
- `student_progress.details[]` đủ cho bản đồ nhiệt mà không cần biết chế độ chơi (E7).
- Bộ chấm từng dạng câu đã tách thành hàm thuần (`graders`), chấm cả mảng đáp án một lần được.
- Driver S3 của `@nestjs/storage` tự ký SigV4, không gửi ACL hay checksum, chấp nhận region `auto`. Nhờ vậy có khả năng chạy được với Cloud Storage qua API tương thích S3.

---

## 2. Quyết định

Quyết định chung đánh số tiếp từ Giai đoạn 3 (D12…). Quyết định cho Exam Mode dùng E1–E8.

### D12. Nền tảng deploy – **đã chốt**
- **Phương án B:** frontend trên **Firebase Hosting**, backend trên **Google Cloud Run** (container từ `be/Dockerfile`), DB trên **MongoDB Atlas**, ảnh trên **Cloud Storage**. Region `asia-southeast1` (Singapore).
- Firebase Hosting rewrite `/api/**` sang Cloud Run nên fe và API **chung một domain**. Không cần mua domain riêng, và cookie `SameSite=Strict` ở 6.1 chạy được.
- **Đã loại:**
  - Vercel, Netlify, Appwrite Functions: là serverless, không giữ được tiến trình NestJS, không có WebSocket, bộ đếm giới hạn nằm trong RAM của từng instance.
  - AwardSpace: hosting PHP/MySQL, không chạy được Node.
  - Phương án A (Vercel + Render): phải mua domain riêng; rewrite của Vercel không chuyển tiếp WebSocket.
- **Hệ quả cho các giai đoạn sau:**
  - Cookie refresh phải đặt tên `__session`, vì Firebase Hosting chỉ chuyển tiếp cookie này sang Cloud Run.
  - Socket.io phải kết nối thẳng domain Cloud Run.

### D13. Tác dụng phụ cần nhất quán dùng command được `await` – **đã chốt**
- Việc **phải đúng ngay** (thêm em mới vào bài tập cả lớp, gỡ em rời lớp) dùng **command** gọi qua `CommandBus` và chờ chạy xong. Không dùng event.
- Event chỉ dành cho việc **trễ hoặc mất cũng không sao** (log, thông báo sau này).
- Không cần bật "CPU luôn cấp" trên Cloud Run, vốn tính phí theo instance.

### D14. Giới hạn đăng nhập – **đã chốt**
- Hai giới hạn mỗi phút trên `/auth/login` và `/auth/register`:
  - `AUTH_RATE_LIMIT` (10) cho mỗi **username**: chống dò mật khẩu một tài khoản.
  - `AUTH_IP_RATE_LIMIT` (100) cho mỗi **IP**: để cao vì cả trường thường chung một IP.
- `TRUST_PROXY` cho biết số proxy đứng trước API. Kiểm tra bằng `clientIp` trong `GET /api/v1/health`.
- Bộ đếm nằm trong RAM, nên Cloud Run chạy `max-instances=1`. Khi cần nhiều instance thì chuyển bộ đếm sang Redis.

### D15. Tạo admin đầu tiên – **đã chốt**
- Lệnh CLI `npm run create:admin -- <username> "<Họ tên>"`, chạy từ máy local trỏ vào DB production.
- Mật khẩu lấy từ `ADMIN_PASSWORD` (≥ 12 ký tự) hoặc sinh ngẫu nhiên và in một lần.
- Không sửa tài khoản đã tồn tại.
- Không làm endpoint "tạo admin" trên API.

### D16. Câu nghe – **đề xuất** (thay phần "Nghe" của D11)
- Server sinh file âm thanh từ `audioText` bằng TTS (ví dụ Google Cloud Text-to-Speech), lưu vào Cloud Storage. Client chỉ nhận URL, không nhận chữ.
- Giáo viên không phải thu âm. Âm thanh giống nhau trên mọi máy, không còn phụ thuộc máy có giọng tiếng Anh hay không.
- **Cần chốt:**
  - Sinh lúc lưu câu hỏi hay lúc chơi lần đầu (cache)?
  - Câu hỏi cũ sinh bù bằng script.
  - Chi phí TTS ước tính theo số câu (~300 câu chuẩn + câu giáo viên).

### D17. Tạo học sinh hàng loạt – **đề xuất**
- **Đề xuất:** xoá bù. Nếu bước thêm vào lớp lỗi thì xoá các tài khoản vừa tạo rồi báo lỗi.
- **Lý do:**
  - Transaction đòi dev và e2e chuyển sang `MongoMemoryReplSet` (chậm hơn, khác môi trường hiện tại).
  - Lỗi này hiếm: chỉ một bước ghi sau `insertMany`.
- **Phương án khác:** transaction thật. Atlas đã là replica set, chỉ cần đổi môi trường dev/test.

### D18. Thư viện lưu file – **đề xuất**
- Thử `@nestjs/storage` với bucket thật ở 4.0.
  - Chạy được: giữ, ghim phiên bản, theo dõi changelog.
  - Không chạy được: thay bằng `@google-cloud/storage` đặt sau `StorageService` của dự án, để đổi nhà cung cấp chỉ sửa một chỗ.

### Exam Mode (E1–E8) – **đã chốt**

Áp dụng cho bài tập do giáo viên chọn chế độ `exam`. Challenge ngẫu nhiên thuộc giai đoạn sau. **Bản đồ trạm giữ nguyên logic hiện tại.**

- **E1. Đồng hồ:**
  - Server lưu `startedAt` và `deadlineAt = startedAt + timeLimitSec` trong phiên. Client chỉ hiển thị đếm ngược theo `deadlineAt`.
  - Hết giờ, client khoá form và tự nộp (`isAutoSubmit: true`).
  - Server so thời điểm nộp với `deadlineAt`, cộng vài giây ân hạn cho độ trễ mạng.
  - Không dùng `expiresAt` hiện có làm hạn nộp, vì TTL index xoá document đúng lúc đó. TTL đặt bằng `deadlineAt` cộng khoảng đệm.
- **E2. Lưu đáp án & F5:**
  - Nháp lưu liên tục ở `sessionStorage` theo `sessionId`: đáp án, câu đang đứng, câu đánh dấu.
  - Khi F5, client gọi API khôi phục phiên đang làm. Server trả câu hỏi và `deadlineAt`; client ghép nháp vào.
  - Nộp thành công thì xoá nháp.
- **E3. Sửa đáp án:**
  - `answers[questionId]` được ghi đè cho tới khi nộp hoặc hết giờ. Server chấm **một lần**.
  - Luật "câu trả lời đầu là cuối cùng" chỉ áp dụng cho `mode: 'classic'`.
- **E4. Tính điểm:** Exam **không mở trạm** và **không cộng XP**, nên không ảnh hưởng bảng xếp hạng (xếp theo XP).
- **E5. Đóng tab và không quay lại trước khi hết giờ:**
  - Server tự nộp bài rỗng, 0 điểm (`isAutoSubmit: true`), lượt đã dùng. Theo D7 bài này tính là **đã nộp**.
  - Không lưu nháp lên server. Nếu sau này cần thì thêm `PATCH /progress/sessions/:id/draft` chạy debounce 15–20 giây.
- **E6. Thời lượng & chế độ:**
  - `Quiz.timeLimitSec` là mặc định (`null` = không giới hạn). Lúc giao bài có thể ghi đè bằng `Assignment.timeLimitSec`.
  - `Assignment.mode: 'classic' | 'exam'`. Bài cũ thiếu trường này được hiểu là `classic`.
- **E7. Ghi kết quả:**
  - Ghi vào **cùng `student_progress`**, dùng lại các trường sẵn có (`score`, `completedAt`, `details[]`…).
  - Thêm `mode` và `isAutoSubmit`; `xpEarned = 0`.
  - **Không lưu `isLate`:** D7 tính đúng hạn hay muộn lúc đọc.
- **E8. Số lượt:**
  - **1 lượt** cho mỗi học sinh, mỗi bài Exam. Lượt bị tính **ngay khi bắt đầu**.
  - Hết giờ thì tự nộp với đáp án hiện có.
  - Không áp dụng quy tắc "lấy điểm cao nhất" của D7.

---

## 3. Lộ trình

Ước lượng cho 1 lập trình viên full-stack đã quen code.

| Mốc | Nội dung | Ước lượng | Tài liệu mới/sửa |
| --- | --- | --- | --- |
| 4.0 | Deploy & hạ tầng | 2 ngày code (✅) + 1–2 ngày dựng hạ tầng | **deploy.md**, README, 10, 11 |
| 4.1 | Bảo mật & nợ kỹ thuật | 4–6 ngày | 02, 04, 10, README |
| 4.2 | Exam Mode | 8–10 ngày | **14-exam-mode.md**, 04, 05, 11, 12 |
| 4.3 | UX & thao tác giáo viên | 6–8 ngày | 02, 04, 08, 10, 12, 13 |
| | **Tổng** | **~4–5 tuần** | |

---

### 4.0 Deploy & hạ tầng

Code đã xong; xem [Kết quả 4.0](#kết-quả-40). Phần hạ tầng làm theo [deploy.md](deploy.md):
1. MongoDB Atlas: tạo user riêng, mở `0.0.0.0/0`, chạy `seed:content`, chạy `create:admin`, lên lịch backup.
2. Cloud Storage: tạo bucket công khai đọc và HMAC key. Chạy thử upload ảnh để chốt D18.
3. Secret Manager và Cloud Run: `max-instances=1`. Chỉnh `TRUST_PROXY` cho tới khi `clientIp` đúng.
4. Firebase Hosting: commit `.firebaserc`.
5. Sentry: lọc tên và đáp án học sinh trước khi gửi.
6. Đồng ý của phụ huynh (Nghị định 13/2023): **chặn việc mở cho trường thật**, không chặn bản thử nghiệm.

### 4.1 Bảo mật & nợ kỹ thuật

1. **Câu nghe (D16):**
   - Mỗi câu có `audioText` được gắn thêm `audioUrl`.
   - `get-play-quiz` và mapper trả `audioUrl`, **bỏ `audioText`** khỏi dữ liệu gửi cho học sinh. Giáo viên vẫn thấy chữ khi soạn.
   - `ListenButton` phát file thay cho Web Speech. Không có file thì hiện "Chưa có âm thanh".
   - Viết script sinh bù cho câu cũ.
2. **Tạo học sinh hàng loạt (D17):** thêm bước xoá bù; e2e giả lập lỗi bước cập nhật lớp.
3. **Thư viện lưu file (D18):** chỉ làm nếu thử ở 4.0 không chạy được.
4. **TanStack Query:** chuyển 14 file `useAsync`, rồi xoá `useAsync`.

**Kiểm thử:**
- Dữ liệu chơi quiz của học sinh không chứa `audioText`.
- Tạo hàng loạt bị lỗi giữa chừng thì không để lại tài khoản thừa.

### 4.2 Exam Mode (tài liệu 14)

**Dữ liệu**
```
quizzes.timeLimitSec?: Number          // null = không giới hạn (E6)
assignments.mode: 'classic' | 'exam'   // thiếu = classic
assignments.timeLimitSec?: Number      // ghi đè của quiz
quiz_sessions.mode, deadlineAt         // exam: không chấm từng câu
student_progress.mode, isAutoSubmit    // E7
```
- **Khoá 1 lượt (E8):** bắt đầu Exam bị từ chối khi đang có phiên mở (unique index sẵn có) **hoặc** đã có `student_progress` với `mode: 'exam'` cho bài đó. Thêm index unique một phần `{assignmentId, studentId}` với điều kiện `mode: 'exam'` để chặn nộp trùng khi hai request chạy song song.
- **Chốt phiên quá giờ (E5):**
  - **Đề xuất: chốt lười.** Mỗi lần đọc trạng thái bài tập (danh sách bài của em, bảng nộp bài, thống kê) hoặc bắt đầu phiên, server chốt các phiên Exam quá `deadlineAt + ân hạn` thành bài 0 điểm.
  - Không dùng job định kỳ, vì Cloud Run `min-instances=0` không giữ tiến trình chạy nền. TTL đặt `deadlineAt` + 30 ngày.

**Backend**

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| POST | `/progress/sessions` | Bài `mode: exam` → tạo phiên có `deadlineAt`, trả câu hỏi (không có đáp án) |
| GET | `/progress/sessions/:id` | Khôi phục phiên đang làm sau F5: câu hỏi, `deadlineAt`, giờ server |
| POST | `/progress/sessions/:id/submit` | `{ answers[], isAutoSubmit }` → chấm một lần, ghi `student_progress`, trả kết quả kèm đáp án đúng và giải thích |

- Nhánh `classic` (`/answers`, `/finish`) giữ nguyên. Phiên exam gọi `/answers` thì trả 409.

**Frontend**
- Trang làm bài Exam:
  - Đồng hồ tính theo `deadlineAt − giờ server`, có hiệu chỉnh độ lệch giờ máy.
  - Lưới số câu để nhảy tới câu bất kỳ; nút Trước/Sau; đánh dấu câu.
  - Màn rà soát trước khi nộp.
  - Cảnh báo `beforeunload` khi rời trang.
  - Nháp lưu ở `sessionStorage`.
- Sau khi nộp: điểm, đúng/sai từng câu và giải thích.
- Form giao bài có chọn chế độ (Luyện tập / Kiểm tra) và thời lượng.
- Bảng nộp bài và thống kê ghi chú bài nào được tự nộp.

**Kiểm thử**
- Unit: tính `deadlineAt`, ân hạn, chấm cả mảng đáp án.
- e2e:
  - Nộp đúng giờ, nộp trong ân hạn, nộp quá giờ.
  - Bắt đầu lần hai → 409.
  - Phiên quá giờ chưa nộp được chốt thành 0 điểm khi đọc.
  - XP không đổi, trạm không mở.
  - Trạng thái D7 và bản đồ nhiệt đúng với bài exam.

### 4.3 UX & thao tác giáo viên

1. **Chơi quiz trên tablet/mobile:**
   - Vùng chạm ≥ 44px cho Sắp xếp câu và Nối từ.
   - Chạm chọn rồi chạm điền, song song với kéo thả.
   - Giải thích ngắn và nút nghe lại sau mỗi câu.
2. **Lớp học & soạn đề:**
   - In thẻ đăng nhập dạng cắt phát cho lớp 1–2.
   - Lọc trạng thái duyệt giáo viên, kèm lý do.
   - Nhân bản câu hỏi.
   - Cảnh báo khi rời trang chưa lưu.
   - Live Preview giao diện học sinh.
   - Tải file CSV mẫu; khi dry-run, tô đỏ dòng và cột lỗi.
3. **Báo cáo:**
   - Làm nổi câu có tỉ lệ sai cao trên bản đồ nhiệt.
   - Hiện vị trí của em trên bảng xếp hạng kể cả khi ngoài Top.
4. **Lỗi font tiếng Việt khi xuất file:** tái hiện trước, ghi rõ định dạng (Excel/PDF). Hiện chưa có xuất CSV.

---

## 4. Migrate dữ liệu (`npm run migrate:phase4`, nếu cần)

- `assignments`, `student_progress`: **không cần migrate**. Thiếu `mode` được hiểu là `classic`.
- `student_progress`: tạo index unique một phần `{assignmentId, studentId}` với `mode: 'exam'`.
- `questions`: sinh `audioUrl` cho câu có `audioText` (4.1). Script idempotent, có `--dry-run`.

---

## 5. Quy tắc mới cần thêm vào README

- Việc **phải đúng ngay** giữa các module dùng command được `await`; event chỉ cho việc **trễ hoặc mất cũng không sao** (D13).
- Không gửi xuống máy học sinh bất cứ dữ liệu nào làm lộ đáp án: `correctAnswer`, `audioText`, thứ tự đúng của câu sắp xếp.
- Biến môi trường mới phải có ở `.env.example`, `env.validation.ts`, bảng trong `be/README.md`, và lệnh deploy trong `deploy.md`.
- Không đưa file bí mật vào image hay lên Cloud Build: kiểm tra `.dockerignore` và `.gcloudignore`.

---

## 6. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| `@nestjs/storage` không chạy với Cloud Storage | Trung bình | Thử ngay ở 4.0; dự phòng D18 |
| `TRUST_PROXY` đặt sai | Trung bình | Mọi người chung một bộ đếm, hoặc IP bị giả mạo. Kiểm tra `clientIp` sau mỗi lần đổi hạ tầng; giới hạn theo username vẫn chặn dò mật khẩu |
| Dữ liệu trẻ em trên production | Cao | Không mở cho trường thật trước khi có cơ chế đồng ý của phụ huynh |
| Khởi động lạnh (`min-instances=0`) làm lần mở đầu chậm vài giây | Thấp | Chấp nhận ở Giai đoạn 4; Giai đoạn 5 đặt `min-instances=1` |
| Exam: lệch giờ máy học sinh | Trung bình | Đồng hồ dựa trên giờ server; server là nơi quyết định |
| Exam: em lỡ đóng tab trên tablet bị 0 điểm (E5) | Trung bình | Cảnh báo `beforeunload`; theo dõi số bài tự nộp rỗng, nhiều thì bật lưu nháp lên server |
| Chi phí TTS và Cloud Storage | Thấp | Sinh một lần mỗi câu, cache; ước tính trước khi chạy script sinh bù |

---

## 7. Định nghĩa "xong" cho mỗi mốc

- Như Giai đoạn 3: CQRS ở backend, feature-first ở frontend. `lint`, `test`, `test:e2e` (be) và `lint`, `build` (fe) đều qua. Có tài liệu tính năng; cập nhật README và `roadmap.md`.
- **CI xanh** trên pull request.
- Từ 4.0 trở đi: **chạy thử trên môi trường đã deploy**, không chỉ trên máy dev.
- **Viết mục "Kết quả" cho mốc vừa xong** ở cuối file này: đã làm gì, quyết định nào đã chốt, kết quả kiểm tra, việc còn lại.

---

## Kết quả các mốc

### Kết quả 4.0

> Ngày: 2026-11-20 · [PR #1](https://github.com/huyvouit/enquiz/pull/1) đã merge vào `main` (merge commit `d260d26`) · Trạng thái: **code xong, chờ dựng hạ tầng**

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Git | Repo public [huyvouit/enquiz](https://github.com/huyvouit/enquiz). Hai commit đầu: hết Giai đoạn 3, và kế hoạch Giai đoạn 4 kèm Dockerfile. Tác giả commit và đăng nhập GitHub cấu hình riêng cho repo, không ảnh hưởng tài khoản GitLab | — |
| CI | GitHub Actions: lint, prettier, unit, e2e, build be/fe, build image Docker (không push). Cache binary MongoDB; Node 22, npm 11 | `.github/workflows/ci.yml`, `.nvmrc`, `engines` |
| Bỏ event chạy sau response (D13) | `StudentsJoinedClassEvent` / `StudentLeftClassEvent` chuyển thành `AddJoinersToAssignmentsCommand` / `RemoveLeaverFromAssignmentsCommand`, được `await` trong handler của module lớp | `assignments/commands/*/class-membership.*.ts`, `class-roster.handlers.ts` |
| Giới hạn đăng nhập (D14) | Hai giới hạn: theo username và theo IP. Biến mới `AUTH_IP_RATE_LIMIT`, `TRUST_PROXY`. `/health` trả `clientIp` | `auth/auth-throttle.ts`, `env.validation.ts`, `main.ts`, `health.controller.ts` |
| Admin đầu tiên (D15) | `npm run create:admin` | `cli/create-admin.ts` |
| Image Cloud Run | Build hai bước, Node 22, npm 11, chạy bằng user `node`, cổng 8080. `.gcloudignore` không tải `.env` lên Cloud Build | `be/Dockerfile`, `.dockerignore`, `.gcloudignore` |
| Firebase Hosting | Rewrite `/api/**` sang Cloud Run `enquiz-api`, các đường dẫn khác về `index.html`. Cache dài cho `/assets/**`, `no-cache` cho trang | `fe/firebase.json` |
| Tài liệu | Hướng dẫn deploy từng bước; cập nhật README, `.env.example`, tài liệu 10, 11 và bài CQRS trong `docs-be.md` | `docs/deploy.md` |

**Kết quả kiểm tra**
- Backend: lint và prettier sạch; **47 unit** test pass (3 test mới cho giới hạn đăng nhập); **44 e2e** test pass; build thành công.
- Frontend: lint và build pass.
- `create:admin` chạy trên MongoDB tạm, 5 trường hợp đều đúng:
  - Thiếu tham số, tên sai quy tắc, mật khẩu ngắn: báo lỗi.
  - Tạo mới: thành công, mật khẩu sinh ra khớp với hash đã lưu.
  - Trùng tên: không sửa gì.
- Với chỉ các dependency production, `dist` nạp được đủ mọi module.
- **CI trên GitHub:** lần chạy đầu trên PR #1 xanh cả 3 job: backend, frontend, và docker. Đây cũng là lần đầu image Cloud Run được build, nên Dockerfile với npm 11 đã được xác nhận.
- **Chưa kiểm tra:** image chưa chạy trên Cloud Run thật; các bước kiểm tra sau deploy (`deploy.md` mục 6) chưa làm.

**Phát hiện và đã sửa trong lúc làm**
- `node:22` đi kèm npm 10, trong khi project yêu cầu npm ≥ 11. Dockerfile và CI đã cài npm 11.
- Thiếu `.gcloudignore` thì `gcloud builds submit` sẽ tải `be/.env` lên Cloud Build. Đã thêm file này.
- Binary MongoDB của test nằm ở `node_modules/.cache`, không phải `~/.cache`. CI đặt `MONGOMS_DOWNLOAD_DIR` cố định để cache đúng chỗ.
- Fine-grained token GitHub dùng cho `gh` phải có các quyền sau trên repo: **Contents**, **Workflows** (để push `.github/workflows/`), và **Pull requests** (để `gh pr create`), tất cả ở mức Read and write.

**Còn lại để đóng 4.0**
- Dựng hạ tầng theo `deploy.md` và chạy hết mục 6 (kiểm tra sau deploy). Trong đó có kết quả thử `@nestjs/storage` để chốt D18.
- Sentry và backup Atlas.
- Đồng ý của phụ huynh trước khi mở cho trường thật.
