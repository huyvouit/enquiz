# Kế hoạch Giai đoạn 4 – Lên production, dọn nợ, Exam Mode & UX

> Trạng thái: **Đang triển khai** · 4.0, 4.1: code xong, chờ dựng hạ tầng · 4.2: code xong ([tài liệu 14](features/14-exam-mode.md)), chưa chạy trên môi trường deploy · 4.3: **tạm hoãn** (làm Giai đoạn 5 trước, xem [phase-5-plan.md](phase-5-plan.md)) · Lập: 2026-11-20 · Xem [roadmap](roadmap.md)

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
| Đáp án trắc nghiệm được xáo lại mỗi lần tải đề | Với Exam, F5 sẽ làm đáp án đổi chỗ | 4.2 (E10) |
| `ProgressionService` tính `passed`/điểm cao nhất trên mọi lượt làm | Bài kiểm tra đạt điểm sẽ mở trạm, cộng cấp | 4.2 (E4) |
| Sắp xếp câu & Nối từ khó thao tác trên tablet; thiếu thao tác giáo viên (nhân bản câu, CSV mẫu…) | Trải nghiệm lớp 1–2 và giáo viên chưa mượt | 4.3 |

**Đã có sẵn để tận dụng:**
- `quiz_sessions` có unique index `{studentId, quizId, assignmentId}`, có thể dùng luôn làm khoá "1 lượt" cho Exam (E8).
- `student_progress.details[]` đủ cho bản đồ nhiệt mà không cần biết chế độ chơi (E7).
- Bộ chấm từng dạng câu đã tách thành hàm thuần (`graders`), chấm cả mảng đáp án một lần được.
- Driver S3 của `@nestjs/storage` tự ký SigV4, không gửi ACL hay checksum, chấp nhận region `auto`. Nhờ vậy có khả năng chạy được với Cloud Storage qua API tương thích S3.

---

## 2. Quyết định

Quyết định chung đánh số tiếp từ Giai đoạn 3 (D12…). Quyết định cho Exam Mode dùng E1–E13.

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

### D16. Câu nghe: text-to-speech ở server, tạo khi lưu – **đã chốt** (thay phần "Nghe" của D11)
- Server sinh MP3 từ `audioText` bằng **Google Cloud Text-to-Speech** (REST, khoá API chỉ cho phép TTS; không thêm thư viện). File lưu qua storage như ảnh, thư mục `audio/`.
- Học sinh chỉ nhận `audioUrl`, **không bao giờ** nhận `audioText`. Giáo viên vẫn thấy và sửa chữ.
- **Tạo khi lưu** câu hỏi (form và nhập CSV), không tạo lúc chơi: học sinh không phải chờ, và lỗi TTS không lộ ra lúc chơi.
- **TTS lỗi hoặc tắt** (`TTS_DRIVER=none`): câu vẫn được lưu, chỉ thiếu `audioUrl`. Học sinh thấy "Chưa nghe được câu này". Admin tạo bù trong Kho câu hỏi (`POST /questions/audio/backfill`, mỗi lần 25 câu để không vượt 60 giây của Firebase Hosting).
- **Khoá file = băm(ngôn ngữ, giọng, tốc độ, nội dung):** lưu lại cùng câu không tạo file mới; đổi chữ hoặc đổi giọng thì tạo file mới; tên file không lộ nội dung.
- Không làm "giáo viên upload file âm thanh" ở giai đoạn này.
- **Chi phí:** vài trăm câu, mỗi câu vài chục ký tự, nên nằm trong hạn mức miễn phí hằng tháng của Text-to-Speech (theo bảng giá Google, cần kiểm tra lại khi bật).

### D17. Tạo học sinh hàng loạt: xoá bù – **đã chốt**
- Nếu bước thêm vào lớp (hoặc thêm vào bài tập) lỗi sau khi đã tạo tài khoản: gỡ khỏi lớp, gỡ khỏi bài tập, xoá các tài khoản vừa tạo, rồi báo lỗi gốc.
- **Lý do không dùng transaction:** dev và e2e phải chuyển sang `MongoMemoryReplSet`, trong khi lỗi này hiếm.
- **Khe còn lại:** nếu server sập đúng giữa hai bước thì vẫn sót tài khoản. Chấp nhận được; dữ liệu Atlas đã là replica set nếu sau này cần transaction.

### D18. Thư viện lưu file – **đã chốt** (2026-11-21, khi dựng hạ tầng 4.0)
- Giữ `@nestjs/storage` (`uploadToDisk`, `serveFile`, kiểm tra chữ ký file), thêm đĩa riêng `GcsDisk` dùng `@google-cloud/storage`: `STORAGE_DRIVER=gcs`.
- Lý do: `S3Disk` với Cloud Storage cần khoá HMAC của tài khoản dịch vụ, mà tổ chức Google Cloud mới mặc định chặn tạo khoá (`iam.disableServiceAccountKeyCreation`). `GcsDisk` đăng nhập bằng danh tính của Cloud Run (tài khoản `enquiz-api`), nên không có khoá nào để lộ.
- `local` và `s3` giữ nguyên cho dev và nhà cung cấp khác.

### Exam Mode (E1–E13) – **đã chốt** (rà soát lại ngày 2026-11-20)

Áp dụng cho bài tập do giáo viên chọn chế độ `exam`. Challenge ngẫu nhiên thuộc giai đoạn sau. **Bản đồ trạm giữ nguyên logic hiện tại.** Thiết kế chi tiết: [tài liệu 14](features/14-exam-mode.md).

- **E1. Đồng hồ:**
  - Server lưu `startedAt` và `deadlineAt = startedAt + timeLimitSec` trong phiên, rồi trả `serverNow` để client hiệu chỉnh độ lệch giờ máy. Client chỉ hiển thị đếm ngược.
  - Hết giờ, client khoá thao tác và tự nộp (`isAutoSubmit: true`).
  - Ân hạn độ trễ mạng `EXAM_GRACE_MS` = **10 giây**.
- **E2. Lưu bài làm:** *(đổi: trước chỉ lưu `sessionStorage`)*
  - Mỗi thao tác lưu ngay vào `localStorage` theo `sessionId`.
  - Lưu **nháp lên server** (`PATCH /exams/:id/answers`) khi chuyển câu, khi đánh dấu, và debounce 10 giây.
  - F5, đóng tab hay đổi máy: `POST /exams/start` trả lại phiên đang làm, kèm nháp server. Client ghép thêm nháp local nếu mới hơn.
- **E3. Sửa đáp án:** được sửa tới khi nộp hoặc hết giờ; server chấm **một lần**. Luật "câu đầu là cuối cùng" chỉ áp dụng cho `classic`.
- **E4. Tính điểm:**
  - Exam **không mở trạm**, **không cộng XP**, không ảnh hưởng cấp độ hay bảng xếp hạng.
  - Mọi truy vấn của `ProgressionService` lọc bỏ `mode: 'exam'`.
- **E5. Hết giờ mà chưa nộp:** *(đổi: trước chấm 0 điểm)*
  - Server **chấm nháp đã lưu**, đặt `status: timed_out`, `isAutoSubmit: true`. Bài này tính là đã nộp (D7).
  - Nộp sau ân hạn: bỏ qua bài gửi lên, chấm nháp.
  - **Chốt lười:** `FinalizeExpiredExamsCommand` chạy (có `await`) trước mỗi lần đọc trạng thái bài tập, bảng nộp bài, thống kê, hoặc khi bắt đầu thi. Không dùng job chạy nền.
- **E6. Thời lượng & chế độ:**
  - `Assignment.mode: 'classic' | 'exam'`; thiếu trường này thì hiểu là `classic`.
  - `Assignment.timeLimitSec` **bắt buộc với exam**, từ 1 đến 90 phút. Mặc định lấy `Quiz.timeLimitSec` (gợi ý), không có thì 15 phút.
  - Chỉ đổi `mode` và giờ khi chưa em nào bắt đầu.
- **E7. Ghi kết quả:**
  - Ghi **một** `student_progress` (`mode: 'exam'`, `isAutoSubmit`, `xpEarned = 0`) để D7, bảng điểm, bản đồ nhiệt và báo cáo dùng được ngay.
  - Không lưu `isLate`. Đúng hạn hay muộn tính theo lúc nộp so với `dueDate`.
- **E8. Số lượt:**
  - **1 lượt** cho mỗi học sinh, mỗi bài. Lượt bị tính **ngay khi bắt đầu**.
  - Unique `{assignmentId, studentId}` trên `exam_sessions`. Việc nộp đổi trạng thái nguyên tử, nên không cần index riêng trên `student_progress`.
  - "Giáo viên cho làm lại" để sau.
- **E9. Collection riêng `exam_sessions`** (module `exams`), không TTL:
  - Lưu ảnh chụp `questionIds`, `timeLimitSec`, bài làm, đánh dấu, trạng thái `in_progress | submitted | timed_out`, `progressId`.
  - `kind: 'assignment'`, chừa chỗ cho `'challenge'`.
- **E10. Đề cố định trong một phiên:**
  - Thứ tự câu được chụp lúc bắt đầu (xáo một lần nếu quiz bật xáo).
  - Thứ tự lựa chọn xáo theo hạt giống `sessionId + questionId`, nên F5 không đổi chỗ đáp án.
- **E11. Chống tra đáp án:**
  - Phiên Luyện tập bị từ chối khi `assignmentId` là bài kiểm tra.
  - Phiên Luyện tập cũng bị từ chối khi em đang có phiên kiểm tra chưa nộp trên **cùng quiz**.
- **E12. Cho xem đáp án:**
  - `Assignment.reveal: 'after_submit'` (mặc định) | `'after_due'`.
  - Điểm và đúng/sai luôn hiện ngay. Đáp án đúng và giải thích hiện theo `reveal`; quy tắc áp dụng cho cả trang xem lại lượt làm.
- **E13. Màn giới thiệu trước khi tính giờ:** số câu, thời gian, "chỉ làm 1 lần". Cảnh báo nếu hạn nộp đến trước lúc hết giờ làm.

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
2. Cloud Storage: tạo bucket công khai đọc; Cloud Run ghi bằng tài khoản `enquiz-api` (`STORAGE_DRIVER=gcs`, D18). Chạy thử upload ảnh.
3. Secret Manager và Cloud Run: `max-instances=1`. Chỉnh `TRUST_PROXY` cho tới khi `clientIp` đúng.
4. Firebase Hosting: `.firebaserc` chứa ID project nên **không commit** (repo public); mỗi máy tự tạo theo `deploy.md` bước 5.
5. Sentry: lọc tên và đáp án học sinh trước khi gửi.
6. Đồng ý của phụ huynh (Nghị định 13/2023): **chặn việc mở cho trường thật**, không chặn bản thử nghiệm.

### 4.1 Bảo mật & nợ kỹ thuật

Code xong; xem [Kết quả 4.1](#kết-quả-41).

1. **Câu nghe (D16):**
   - Mỗi câu có `audioText` được gắn thêm `audioUrl`.
   - `get-play-quiz` và mapper trả `audioUrl`, **bỏ `audioText`** khỏi dữ liệu gửi cho học sinh. Giáo viên vẫn thấy chữ khi soạn.
   - `ListenButton` phát file thay cho Web Speech. Không có file thì hiện "Chưa có âm thanh".
   - Sinh bù cho câu cũ bằng nút của admin (endpoint theo lô), thay cho script chạy từ máy local.
2. **Tạo học sinh hàng loạt (D17):** thêm bước xoá bù; unit test giả lập lỗi bước cập nhật lớp.
3. **Thư viện lưu file (D18):** đã làm ở 4.0 (`GcsDisk`).
4. **TanStack Query:** chuyển 14 file `useAsync`, rồi xoá `useAsync`.

**Kiểm thử:**
- Dữ liệu chơi quiz của học sinh không chứa `audioText`.
- Tạo hàng loạt bị lỗi giữa chừng thì không để lại tài khoản thừa.

### 4.2 Exam Mode (tài liệu 14)

Code xong; xem [Kết quả 4.2](#kết-quả-42). Thiết kế đầy đủ (luồng, endpoint, payload, quy tắc, giao diện): [14-exam-mode.md](features/14-exam-mode.md). Ở đây chỉ ghi thứ tự làm.

**Dữ liệu**
```
exam_sessions (mới)        studentId, assignmentId, quizId, kind, questionIds, timeLimitSec,
                           startedAt, deadlineAt, status, answers, flagged, draftSavedAt,
                           submittedAt, isAutoSubmit, progressId
                           unique {assignmentId, studentId} · {studentId, status} · {status, deadlineAt}
assignments                mode ('classic' mặc định), timeLimitSec, reveal ('after_submit' mặc định)
quizzes                    settings.timeLimitSec? (gợi ý)
student_progress           mode ('classic' mặc định), isAutoSubmit
```

**Backend** (module `exams`, ~4–5 ngày)

| Method | Đường dẫn | Việc |
| --- | --- | --- |
| POST | `/exams/start` | `{ assignmentId }` → bắt đầu hoặc vào tiếp; đã nộp → 409 |
| PATCH | `/exams/:id/answers` | Lưu nháp (đáp án + đánh dấu); quá ân hạn → 409 |
| POST | `/exams/:id/submit` | `{ answers, flagged?, isAutoSubmit }` → chấm một lần, trả kết quả theo `reveal` |
| GET | `/exams/:id` | Đang làm → phiên; đã nộp → kết quả |

1. Thêm các schema và trường mới. Mở rộng DTO giao bài và sửa bài (`mode`, `timeLimitSec`, `reveal`).
2. Viết hàm thuần (unit test):
   - `examDeadline`, `isWithinGrace`;
   - `seededShuffle`;
   - `gradeExamAnswers`, dùng lại `gradeAnswer`;
   - `redactForReveal`.
3. Handler bắt đầu, lưu nháp, nộp; `FinalizeExpiredExamsCommand`.
4. Ghi `student_progress` cho exam, không đi qua phần XP và mở trạm. Thêm điều kiện `mode ≠ exam` vào `ProgressionService`.
5. Chặn Luyện tập (E11). Ẩn đáp án ở `GET /progress/attempts/:id` theo `reveal`.
6. Assignments và analytics gọi chốt lười trước khi đọc. `/assignments/mine` trả thêm thông tin exam. Bảng nộp bài trả thêm `isAutoSubmit` và `inProgress`.

**Frontend** (feature `exam`, ~4–5 ngày)
1. `FillBlankGame` và `OrderingGame` thêm chế độ điều khiển từ ngoài (không có nút "Kiểm tra").
2. Route `/exam/:assignmentId` ngoài `AppLayout`. Ba màn: Giới thiệu → Phòng thi → Kết quả.
3. Phòng thi:
   - Thanh trên: tiến độ, 🚩 đánh dấu, ☰ lưới câu, đồng hồ cam ở 2 phút và đỏ ở 1 phút.
   - Thanh dưới: Câu trước / Câu tiếp / Xem lại bài.
   - Hộp rà soát trước khi nộp.
4. `useExamClock`, `useExamDraft` (local + server), `useLeaveGuard` (`beforeunload` và `useBlocker`).
5. Phía giáo viên: AssignDialog (chế độ, giờ, cho xem đáp án), SubmissionTable (⏱ Tự nộp, Đang làm), Quiz builder (thời gian gợi ý).
6. Phía học sinh: nhãn 📝 ở trang Bài tập và băng nhắc; nhãn "Kiểm tra" trong lịch sử.

**Kiểm thử:** danh sách đầy đủ ở tài liệu 14, mục *Kiểm thử*. Tối thiểu gồm:
- nộp đúng giờ, trong ân hạn, quá ân hạn;
- bắt đầu lần hai và bấm "Bắt đầu" hai lần cùng lúc;
- chốt lười;
- XP và trạm không đổi;
- chặn Luyện tập;
- `reveal`;
- trạng thái D7 và bản đồ nhiệt;
- chạy thử trên trình duyệt kích thước tablet: F5 giữa giờ, hết giờ tự nộp.

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

- `assignments`, `student_progress`: **không cần migrate**. Thiếu `mode` được hiểu là `classic`; thiếu `reveal` được hiểu là `after_submit`.
- `exam_sessions`: collection mới. **Không cần script**: Mongoose tạo index (unique `{assignmentId, studentId}` và hai index đọc) khi API khởi động, vì dự án không tắt `autoIndex`. Nếu sau này tắt `autoIndex` ở production thì phải viết `migrate:phase4` để tạo index này trước khi mở Exam.
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
| `@nestjs/storage` không chạy với Cloud Storage | Đã xảy ra | Không tạo được khoá HMAC: thêm `GcsDisk` không dùng khoá (D18) |
| `TRUST_PROXY` đặt sai | Trung bình | Mọi người chung một bộ đếm, hoặc IP bị giả mạo. Kiểm tra `clientIp` sau mỗi lần đổi hạ tầng; giới hạn theo username vẫn chặn dò mật khẩu |
| Dữ liệu trẻ em trên production | Cao | Không mở cho trường thật trước khi có cơ chế đồng ý của phụ huynh |
| Khởi động lạnh (`min-instances=0`) làm lần mở đầu chậm vài giây | Thấp | Chấp nhận ở Giai đoạn 4; Giai đoạn 5 đặt `min-instances=1` |
| Exam: lệch giờ máy học sinh | Trung bình | Đồng hồ dựa trên giờ server; server là nơi quyết định |
| Exam: em lỡ đóng tab, tablet hết pin | Thấp | Nháp lưu lên server (E2); hết giờ thì chấm nháp (E5); mở lại thì làm tiếp được |
| Exam: lưu nháp làm tăng số lần ghi DB | Thấp | Debounce 10 giây và lưu khi chuyển câu; 30 em ≈ 3 lần ghi/giây |
| Exam: em mở Luyện tập cùng quiz để xem đáp án | Trung bình | Chặn khi đang có phiên kiểm tra (E11); quiz hệ thống thì nhắc giáo viên lúc giao bài |
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
- Dựng hạ tầng theo `deploy.md` và chạy hết mục 6 (kiểm tra sau deploy). D18 đã chốt (`GcsDisk`, PR #5).
- Kiểm tra trước khi launch (4.0b): [launch-checklist.md](launch-checklist.md). Phần code A1–A6, B1–B4 đã làm; phần C làm cùng deploy.
- Sentry và backup Atlas.
- Đồng ý của phụ huynh trước khi mở cho trường thật.

### Kết quả 4.1

> Ngày: 2026-11-20 · [PR #2](https://github.com/huyvouit/enquiz/pull/2) đã merge vào `main` (merge commit `f836b41`) · Trạng thái: **code xong**; D18 chờ thử bucket thật ở 4.0

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Câu nghe không lộ đáp án (D16) | Lưu câu hỏi (form, CSV) thì sinh MP3 bằng Google Cloud Text-to-Speech, lưu vào storage `audio/`. Học sinh nhận `audioUrl` (hoặc `audioPending` khi chưa có), **không còn `audioText`**. Driver `none` / `google` / `fake`. Khoá file theo băm nội dung + giọng | `be/src/modules/audio/*`, `uploads/audio-storage.ts`, `quizzes.mapper.ts`, `get-play-quiz.handler.ts` |
| Tạo bù âm thanh | Admin: `GET /questions/audio/status`, `POST /questions/audio/backfill` (25 câu/lần). Thanh "🔇 N câu nghe chưa có âm thanh → 🔊 Tạo âm thanh" trong Kho câu hỏi | `questions/audio-backfill.ts`, `AudioBackfillBanner.tsx` |
| Giao diện câu nghe | `ListenButton` phát file MP3; thiếu file thì báo cho học sinh và hướng dẫn giáo viên. Ô soạn câu đọc báo trạng thái: đã có / chưa tạo được / sẽ tạo khi lưu | `ListenButton.tsx`, `MediaEditor.tsx` |
| Nhập lại CSV xoá trường để trống | Trước đây `$set` bỏ qua giá trị rỗng nên trường cũ còn nguyên. Nay các trường tuỳ chọn và nội dung theo dạng câu được `$unset` (bỏ `audioText` thì mất luôn âm thanh cũ) | `question-import.service.ts` |
| Xoá bù khi tạo học sinh hàng loạt (D17) | Lỗi ở bước thêm vào lớp hoặc bài tập: gỡ khỏi lớp, gỡ khỏi bài tập, xoá tài khoản vừa tạo, báo lỗi gốc | `class-roster.handlers.ts` |
| Bỏ `useAsync` | 12 file (trang và component) chuyển sang TanStack Query. Mỗi feature có `hooks/queries.ts` (key, hook, `invalidate…()`). Thao tác ghi xoá cache liên quan (nộp bài → bản đồ, lịch sử, kết quả, bảng xếp hạng, bài tập). Form sửa nạp chi tiết với `gcTime: 0`. Xoá `shared/hooks/useAsync.ts` | `features/{questions,progress,quizzes}/hooks/queries.ts`, `play.api.ts` |
| Tài liệu | Biến `TTS_*` trong `.env.example` và `be/README.md`; `deploy.md` thêm khoá TTS, secret, bước "Tạo âm thanh" và kiểm tra; tài liệu 02, 04; quy tắc TanStack trong README | — |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **60 unit** test pass (13 mới: tạo âm thanh, request gửi Google, lỗi không lộ khoá, `audioPending`, xoá bù); **47 e2e** test pass (3 mới: đổi/bỏ chữ thì đổi/bỏ âm thanh, chỉ admin tạo bù, nhập lại CSV xoá âm thanh); build thành công.
- e2e xác nhận: dữ liệu chơi **không chứa** chữ của câu đọc; file âm thanh tải được với `audio/mpeg`.
- Frontend: lint và build sạch.
- **CI trên PR #2:** xanh cả 3 job (backend, frontend, docker).
- **Chưa kiểm tra:**
  - Gọi Google Text-to-Speech thật (cần khoá API, làm ở 4.0); giọng `en-GB` mặc định chưa được nghe thử.
  - Chưa ghi nhận kết quả chạy thử giao diện trên trình duyệt: phát âm thanh, thanh tạo bù, và các màn hình đã chuyển sang TanStack Query (đặc biệt: sau khi nộp bài, bản đồ và lịch sử phải cập nhật ngay).

**Phát hiện và đã sửa trong lúc làm**
- Nhập lại CSV không xoá được trường đã để trống (lỗi có từ Giai đoạn 3), sẽ làm âm thanh cũ còn lại sau khi bỏ câu đọc.
- Thêm cờ `audioPending`: không có nó, câu nghe chưa có âm thanh sẽ mất hẳn nút nghe mà học sinh không biết vì sao.

**Còn lại**
- D18: kết quả thử `@nestjs/storage` với Cloud Storage thật (4.0).
- Chạy thử trên trình duyệt các màn đã chuyển sang TanStack Query.

### Kết quả 4.2

> Ngày: 2026-11-20 · [PR #3](https://github.com/huyvouit/enquiz/pull/3) đã merge vào `main` (merge commit `1c786cb`) · Trạng thái: **code xong**, chưa chạy trên môi trường deploy

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Module `exams` (E1–E3, E5, E8–E10) | Phiên thi riêng `exam_sessions`, không TTL. Endpoint: giới thiệu, bắt đầu/vào tiếp, lưu nháp, nộp, xem. Chấm một lần bằng `gradeAnswer` có sẵn, ghi một `student_progress`. Hết giờ thì chấm nháp; nộp quá ân hạn bị bỏ qua. Thứ tự đáp án xáo theo hạt giống `sessionId:questionId` | `be/src/modules/exams/*`, `common/utils/exam-time.ts`, `common/utils/shuffle.ts` (`seededRandom`) |
| Chốt bài quá giờ không cần job (E5, D13) | `FinalizeExpiredExamsCommand` được `await` trong `AssignmentSubmissionsService.attempts()` và trước bản đồ nhiệt. Phiên bị chốt tính nộp lúc `deadlineAt` | `assignment-submissions.service.ts`, `analytics.service.ts` |
| Bài tập (E6, E12) | `mode`, `timeLimitSec`, `reveal`; mặc định thời gian lấy từ `quiz.settings.timeLimitSec` rồi 15 phút; khoá đổi chế độ/thời gian khi đã có em làm. Danh sách trả `exam` (học sinh), `inProgress`/`isAutoSubmit` (giáo viên) | `assignments/*` |
| Tiến trình bỏ qua bài kiểm tra (E4) | `PRACTICE_ONLY` trong mọi truy vấn của `ProgressionService`; lượt kiểm tra `xpEarned = 0` | `progression.service.ts`, `student-progress.schema.ts` |
| Chống tra đáp án (E11) | Luyện tập cùng quiz bị chặn khi đang thi; bài kiểm tra không mở được qua `/progress/sessions`; quiz chỉ giao dạng kiểm tra không xem trước được qua `/quizzes/:id/play` | `start-quiz-session.handler.ts`, `assignment-access.handlers.ts` |
| Ẩn đáp án (E12) | `answersHiddenUntil` + `hideAnswers` cho kết quả nộp, `GET /exams/:id`, `GET /progress/attempts/:id` (chỉ với học sinh) | `progress.mapper.ts`, `get-attempt.handler.ts`, `exam.service.ts` |
| Phòng thi (frontend) | `/exam/:assignmentId` ngoài `AppLayout`: giới thiệu (E13) → phòng thi → kết quả. Đồng hồ theo giờ server, cam ở 2 phút, đỏ ở 1 phút; tiến độ; 🚩 đánh dấu; lưới câu; Câu trước/Câu tiếp; hộp rà soát; tự nộp khi hết giờ. Nháp ở `localStorage` + server. Cảnh báo `beforeunload` và `useBlocker`. Trên điện thoại "Nộp bài" lên thanh trên | `fe/src/features/exam/*`, `app/router.tsx` |
| Game điều khiển từ ngoài | `FillBlankGame`, `OrderingGame` có `value`/`onChange` (không nút Kiểm tra); `MultipleChoiceGame.selectedIcon` | `features/play/components/*` |
| Giáo viên & danh sách | Hộp giao bài: Chế độ, Thời gian, Cho xem đáp án, nhắc quiz hệ thống. Nhãn "📝 Kiểm tra · N phút", "✍️ Đang làm", "⏱ Tự nộp". Hộp gia hạn đổi được `reveal`. Trình tạo quiz có "Thời gian gợi ý". Lịch sử có nhãn "📝 Kiểm tra". Kết quả hiện "Đáp án sẽ hiện sau hạn nộp" | `features/assignments/*`, `features/analytics/pages/AssignmentReportPage.tsx`, `QuizBuilderPage.tsx`, `features/progress/components/{ResultView,AnswerReview}.tsx` |
| Tài liệu | Tài liệu 14 (đổi sang Xong, ghi theo code thật), 04, 05, 11, README be/fe, roadmap | — |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **74 unit** test pass (14 mới); **65 e2e** test pass (18 mới trong `test/exam.e2e-spec.ts`); build thành công.
- Frontend: `tsc`, lint, build sạch. `ExamPage` tải riêng (~17 kB), bundle chính giữ ~325 kB.
- Chạy thử trên trình duyệt (dữ liệu tạm trong bộ nhớ, tablet và điện thoại): xem tài liệu 14, mục *Kiểm thử*. Không có lỗi console.
- **CI trên PR #3:** xanh cả 3 job (backend, frontend, docker).
- **Chưa kiểm tra:** chạy trên Cloud Run/Firebase thật; Safari trên iPad (`beforeunload` không chắc chạy — đã có nháp server bù lại).

**Phát hiện và đã sửa trong lúc làm**
- `ProgressionService` tính `passed` và điểm cao nhất trên mọi lượt làm: nếu không lọc, bài kiểm tra đạt điểm sẽ mở trạm và lên cấp.
- `AssignedQuizIdsQuery` cho phép mở `GET /quizzes/:id/play` của mọi quiz được giao: học sinh xem trước được đề kiểm tra mà không tính giờ. Nay bỏ qua bài kiểm tra.
- Phiên bị server chốt muộn (không ai mở trang) sẽ bị tính nộp muộn nếu dùng giờ chốt: nay tính tại `deadlineAt`.
- Trang kết quả bài tập (analytics) có bảng nộp bài riêng, không dùng `SubmissionTable`: phải thêm nhãn Đang làm / Tự nộp ở cả hai nơi.
- Trên điện thoại, `hidden` bị `inline-flex` của `Button` ghi đè nên nút Nộp bài hiện ở cả hai thanh; đã bọc bằng thẻ `div`.

**Còn lại**
- Giáo viên "cho làm lại" một em, gia hạn giờ trong lúc thi (để sau, tài liệu 14).
- Chưa có giao diện đổi `mode`/`timeLimitSec` sau khi giao (API đã hỗ trợ khi chưa ai làm).
- Theo dõi số bài "tự nộp" sau khi deploy để xem có cần nhắc học sinh nhiều hơn không (rủi ro E5).
