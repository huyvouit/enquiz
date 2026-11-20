# Lộ trình EnQuiz

## ✅ Giai đoạn 1 – MVP (xong 2026-11-15)
- [x] Đăng ký/đăng nhập học sinh & giáo viên, JWT, phân quyền Student/Teacher/Admin → [01](features/01-auth.md)
- [x] Kho câu hỏi: trắc nghiệm, nối từ → [02](features/02-question-bank.md)
- [x] Giáo viên tạo quiz (chọn từ kho, tạo nhanh câu mới, sắp xếp, nháp/xuất bản) → [03](features/03-quiz-builder.md)
- [x] Học sinh chơi quiz → [04](features/04-play-quiz.md)
- [x] Chấm điểm ở server, kết quả + xem lại ngay, lịch sử, bảng kết quả cho giáo viên → [05](features/05-progress-results.md)
- [x] Dữ liệu demo & DB in-memory → [06](features/06-demo-seed.md)

## ✅ Giai đoạn 2 – Gamification (xong 2026-11-15)
- [x] **Bỏ** sao vàng, kim cương, avatar, cửa hàng vật phẩm (`rewardConfig`, `inventory`…) + script `npm run migrate:phase2`
- [x] Cấp độ + XP; vượt trạm (≥ 60 điểm) lần đầu → lên cấp → mở trạm tiếp theo → [07](features/07-progression-quest-map.md)
- [x] Bản đồ khoá/mở trạm, khoá cả ở server → [07](features/07-progression-quest-map.md)
- [x] Phiên chơi ở server: phản hồi đúng/sai từng câu, câu trả lời đầu là cuối cùng → [04](features/04-play-quiz.md)
- [x] Bảng xếp hạng tuần/tháng/mọi lúc theo khối → [08](features/08-leaderboard.md)
- [x] Âm thanh đúng/sai/lên cấp, nhạc nền (bật/tắt), pháo giấy, hiệu ứng chuyển động → [09](features/09-sound-and-effects.md)

## ✅ Giai đoạn 3 – Mở rộng (xong 2026-11-16)
Kế hoạch, quyết định D1–D11 (đã chốt): **[phase-3-plan.md](phase-3-plan.md)**.
- [x] 3.0 Nền tảng & an toàn: duyệt tài khoản giáo viên, admin đặt lại mật khẩu, rate limit, chia nhỏ bundle, phân trang quiz
- [x] 3.1 → [10](features/10-classes.md) Lớp học + mã mời (`classes`), nhóm trong lớp, giáo viên tạo tài khoản học sinh hàng loạt, bảng xếp hạng theo lớp
- [x] 3.2 → [11](features/11-assignments.md) Bài tập về nhà & hạn chót: giao theo lớp/nhóm/học sinh, tự phân loại đúng hạn/muộn/chưa nộp, nhắc nhở trên trang chủ học sinh; bản đồ chỉ gồm quiz hệ thống
- [x] 3.3 → [12](features/12-teacher-analytics.md) Teacher Analytics: tổng quan lớp, bản đồ nhiệt câu hỏi & chủ đề, báo cáo tiến độ cá nhân, xuất bảng điểm Excel/PDF
- [x] 3.4 Dạng câu hỏi: Điền từ, Sắp xếp câu, câu hỏi nghe (Web Speech API), upload ảnh
- [x] 3.5 → [13](features/13-question-import.md) Kho câu hỏi chuẩn Cambridge Starters/Movers/Flyers; nhập CSV; admin sắp thứ tự trạm

## ✨ Giai đoạn 4 – Lên production, dọn nợ, Exam Mode & UX
Thứ tự: **4.0 → 4.1 → 4.2**; 4.3 làm song song được sau 4.0.

### 4.0 Deploy & hạ tầng
Đã chốt **phương án B**: frontend trên **Firebase Hosting**, backend trên **Google Cloud Run** (container từ [be/Dockerfile](../be/Dockerfile)). Firebase Hosting rewrite `/api/**` → Cloud Run nên fe và API **chung một domain**, không cần mua domain riêng.

Thứ tự làm:
- [x] **Git:** repo [huyvouit/enquiz](https://github.com/huyvouit/enquiz)
- [ ] **CI:** GitHub Actions chạy lint + test + build + build image. Cache binary MongoDB cho test e2e; ghim Node 22 (`engines` + `NODE_VERSION` trong Dockerfile)
- [ ] **Cloud Run (`be`):** deploy image; startup probe `GET /api/v1/health`; `min-instances=0` ở giai đoạn 4 (chấp nhận khởi động lạnh vài giây). Biến bí mật (`JWT_SECRET`, `MONGODB_URI`, khoá Storage) đặt qua Secret Manager; `JWT_SECRET` mới, khác dev
- [ ] **Sự kiện CQRS chạy sau response:** mặc định Cloud Run chỉ cấp CPU khi đang xử lý request, nên handler trong `assignment.events.ts` (ví dụ thêm em mới vào lớp vào các bài giao còn hạn) có thể bị treo hoặc mất. Chọn: bật "CPU luôn cấp" (tính phí theo instance), hoặc chuyển các side-effect quan trọng vào command handler và `await`
- [ ] **Firebase Hosting (`fe`):** `firebase.json` rewrite `/api/**` → service Cloud Run và `**` → `/index.html` (router SPA); `VITE_API_BASE_URL` để trống (dùng `/api/v1`). Cùng domain nên không cần CORS cho REST
- [ ] **MongoDB Atlas:** M0 không có backup tự động (nâng gói hoặc `mongodump` định kỳ). Cloud Run không có IP ra cố định → mở `0.0.0.0/0`, hoặc VPC connector + Cloud NAT (trả phí). Nạp kho câu hỏi bằng `npm run seed:content` từ máy local trỏ vào Atlas; `SEED_DEMO_DATA=false`
- [ ] **Ảnh:** `STORAGE_DRIVER=s3` (filesystem của Cloud Run nằm trong RAM, mất khi restart). Dùng Cloud Storage qua API tương thích S3: HMAC key, `S3_ENDPOINT=https://storage.googleapis.com`. Chạy thử `@nestjs/storage` với bucket thật; không chạy được → thay thư viện ở 4.1
- [ ] **Giới hạn đăng nhập:** bật `trust proxy` và lấy IP thật qua chuỗi Firebase Hosting → Cloud Run (kiểm tra `X-Forwarded-For` thực tế); giới hạn theo IP + username vì cả trường dùng chung một IP. Throttler đếm trong RAM từng instance → giữ `max-instances=1`, hoặc dùng storage chung (Redis) khi tăng instance
- [ ] **Theo dõi lỗi:** Sentry, lọc dữ liệu cá nhân học sinh (tên, đáp án) trước khi gửi
- [ ] **Dữ liệu trẻ em:** cơ chế đồng ý của phụ huynh (Nghị định 13/2023), ai thu thập (trường hay app), chính sách lưu/xoá dữ liệu. Chặn việc **mở cho trường thật**, không chặn deploy thử nghiệm

### 4.1 Bảo mật & nợ kỹ thuật
- [ ] **Câu nghe lộ đáp án:** ngừng gửi `audioText` xuống máy học sinh; server sinh file âm thanh (TTS, ví dụ Google Cloud Text-to-Speech) lưu Cloud Storage, client chỉ nhận URL. Thay thế D11 (Web Speech API)
- [ ] **Tạo học sinh hàng loạt:** bọc MongoDB Transaction (dev/e2e chuyển sang `MongoMemoryReplSet`), hoặc xoá bù tài khoản khi bước thêm vào lớp lỗi
- [ ] **Bỏ `@nestjs/storage@0.0.5`:** dùng SDK chính chủ (`@google-cloud/storage`, hoặc `@aws-sdk/client-s3` nếu giữ API S3) sau `StorageService` của dự án
- [ ] **TanStack Query:** chuyển 14 file còn dùng `useAsync`

### 4.2 Chế độ Exam
Áp dụng cho quiz giáo viên, bài tập và challenge ngẫu nhiên (tương lai). **Bản đồ trạm giữ nguyên logic hiện tại.**
- [ ] Đồng hồ đếm ngược, chuyển câu Previous/Next, màn hình rà soát + đánh dấu câu trước khi nộp, cảnh báo khi thoát trang
- [ ] Nộp bài chấm ở server; sau khi nộp hiển thị đúng/sai từng câu + giải thích

Quyết định đã chốt:
- **E1. Đồng hồ:** server lưu `startedAt` và `deadlineAt = startedAt + timeLimitSec` (E6) trong phiên; client chỉ hiển thị đếm ngược theo `deadlineAt`. Hết giờ client khoá form và tự nộp (`isAutoSubmit: true`); server so thời điểm nộp với `deadlineAt` (+ vài giây ân hạn do mạng) để ghi nhận đúng giờ / quá giờ. Không dùng `expiresAt` hiện có làm hạn nộp vì TTL index xoá document đúng lúc đó; TTL đặt bằng `deadlineAt` + khoảng đệm.
- **E2. Lưu đáp án & F5:** nháp lưu liên tục ở `sessionStorage` theo `sessionId` (đáp án, câu đang đứng, câu đánh dấu). F5 → gọi API khôi phục phiên `IN_PROGRESS`; server trả câu hỏi + `deadlineAt`, client ghép nháp vào và đồng hồ chạy tiếp theo giờ server. Nộp thành công → xoá nháp. Lưu nháp lên server: tuỳ chọn, khi cần đồng bộ nhiều thiết bị.
- **E3. Sửa đáp án:** `answers[questionId]` được ghi đè tới khi nộp hoặc hết giờ; server chấm **một lần** trên mảng đáp án cuối. Luật "câu trả lời đầu là cuối cùng" chỉ áp dụng cho `mode: 'classic'` (bản đồ và bài tập hiện tại); service chấm tách nhánh `classic` (phản hồi từng câu) và `exam` (chấm khi kết thúc).
- **E4. Tính điểm:** bài Exam **không mở trạm** và **không cộng XP**, nên không ảnh hưởng bảng xếp hạng (xếp theo XP).
- **E5. Đóng tab, không quay lại trước khi hết giờ:** server **tự nộp bài rỗng → 0 điểm** (`isAutoSubmit: true`), lượt đã dùng (E8). Theo D7, bài này tính là **đã nộp**, không phải "chưa nộp". Mở lại trên cùng trình duyệt trước khi hết giờ → làm tiếp theo E2. Không lưu nháp lên server.
  - Server phải chốt phiên quá `deadlineAt` trước khi TTL xoá nó: TTL đặt dài hơn `deadlineAt` đủ để chốt kịp. Cơ chế chốt (job định kỳ, hoặc chốt khi có lượt đọc kết quả/trạng thái) chọn lúc làm.
  - Mở rộng sau (nếu cần đổi thiết bị giữa chừng, hoặc muốn giữ bài đã làm khi đóng tab): `PATCH /exams/:sessionId/draft` chạy debounce 15–20 giây khi có thay đổi; khi đó server nộp theo bản nháp cuối thay vì bài rỗng.
- **E6. Thời lượng & chế độ:**
  - Thời lượng: `Quiz.timeLimitSec` là mặc định (`null` = không giới hạn); lúc giao bài có thể ghi đè bằng `Assignment.timeLimitSec`. Không đặt tên `durationSec` vì `student_progress.durationSec` đã là thời gian học sinh thực làm.
  - Chế độ: `Assignment.mode: 'classic' | 'exam'`, giáo viên chọn khi giao. Bài tập cũ không có trường này được hiểu là `classic`; không ép chuyển sang Exam.
- **E7. Ghi kết quả:** Exam ghi vào **cùng `student_progress`** mà D7 và Teacher Analytics đang đọc, không tạo collection mới.
  - Dùng lại trường sẵn có: `studentId`, `quizId`, `assignmentId`, `score`, `correctCount`, `totalQuestions`, `completedAt` (thời điểm nộp), `details[]` (`questionId`, `studentAnswer`, `isCorrect`); bản đồ nhiệt đọc `details[]` như hiện tại, không cần biết chế độ.
  - Thêm `mode: 'classic' | 'exam'` (bản ghi cũ thiếu trường này = `classic`) và `isAutoSubmit`. `xpEarned = 0`, `passed` không dùng để mở trạm.
  - **Không lưu `isLate`:** D7 tính đúng hạn/muộn lúc đọc bằng `completedAt` so với `dueDate`, để giáo viên đổi hạn thì trạng thái tự đúng lại.

- **E8. Số lượt:** mỗi học sinh chỉ có **1 lượt** cho mỗi bài Exam.
  - Lượt bị tính **ngay khi bắt đầu phiên**, không phải lúc nộp, để không thể mở xem đề rồi làm lại. Phiên Exam không bị xoá khi kết thúc như phiên `classic`; cần ràng buộc unique (học sinh × bài Exam) chặn mở phiên thứ hai.
  - Hết giờ → **tự nộp với đáp án hiện có**: client nộp nếu tab còn mở (E1); server nộp bài rỗng nếu tab đã đóng (E5).
  - Quy tắc "nhiều lần nộp, lấy điểm cao nhất" của D7 không áp dụng cho Exam: điểm bài tập là điểm của lượt duy nhất. Đúng hạn / muộn vẫn tính theo D7.

### 4.3 UX & thao tác giáo viên
- [ ] **Chơi quiz trên tablet/mobile:** tăng vùng chạm cho Sắp xếp câu & Nối từ, hỗ trợ chạm chọn-điền song song với kéo-thả; giải thích ngắn + nút nghe lại sau mỗi câu
- [ ] **Lớp học & soạn đề:** in thẻ đăng nhập hàng loạt dạng cắt phát cho học sinh lớp 1–2; lọc trạng thái duyệt giáo viên kèm lý do; nhân bản câu hỏi, cảnh báo chưa lưu & Live Preview giao diện học sinh; tải file CSV mẫu + highlight dòng/cột lỗi khi dry-run
- [ ] **Báo cáo:** làm nổi bật câu hỏi tỷ lệ sai cao trên bản đồ nhiệt; hiển thị vị trí cá nhân trên bảng xếp hạng kể cả khi ngoài Top đầu
- [ ] **Lỗi font tiếng Việt khi xuất file:** cần ghi rõ định dạng tái hiện (Excel dùng `exceljs`, PDF dùng `pdfmake` + font nhúng; hiện chưa có xuất CSV)

## ⚔️ Giai đoạn 5 – Đấu trường trực tuyến
Điều kiện trên Cloud Run: `min-instances=1` + CPU luôn cấp (để không ngủ giữa trận), bật session affinity; Socket.io kết nối **thẳng domain Cloud Run** vì rewrite của Firebase Hosting không chuyển tiếp WebSocket (cần CORS cho origin Firebase); Redis adapter nếu chạy nhiều instance.
- [ ] **5.1 Đấu trường cho học sinh đã đăng nhập (Socket.io, kiểu Kahoot):** màn hình Host (mã PIN/QR, lobby real-time, kick người chơi, đếm số nộp bài, biểu đồ đáp án, bục vinh quang) & màn hình Player (4 nút màu lớn, tính điểm tốc độ theo server timestamp); JWT handshake, tự lưu kết quả
- [ ] **5.2 Khôi phục phiên:** Auto-Reconnect qua `sessionStorage` chống mất điểm khi F5/rớt mạng
- [ ] **5.3 Khách vãng lai:** Guest nickname (lọc từ ngữ không phù hợp), rate limit riêng cho khách

## 📱 Giai đoạn 6 – Bảo mật Auth, PWA & Quản lý phiên bản
- [ ] **6.1 Token:** `access_token` trên RAM + `refresh_token` qua HttpOnly Cookie (`SameSite=Strict`, `Path=/api/v1/auth`). Chung domain nhờ rewrite của Firebase Hosting (4.0). **Lưu ý:** Firebase Hosting chỉ chuyển tiếp cookie tên `__session` sang Cloud Run, nên cookie refresh phải đặt tên `__session`
- [ ] **6.2 OAuth Google cho giáo viên** (Google Workspace for Education nếu trường dùng); gộp tài khoản chỉ khi email đã xác minh. Không làm Facebook: học sinh 6–11 tuổi, Facebook yêu cầu từ 13 tuổi
- [ ] **6.3 PWA:** `vite-plugin-pwa`, manifest `standalone` cho tablet/mobile, cache tài nguyên & ảnh từ Cloud Storage
- [ ] **6.4 Cập nhật phiên bản:** báo bản mới qua service worker (`registerType: 'prompt'`); thêm cờ `forceUpdate` khi cần ép cập nhật bắt buộc

## 🗂️ Backlog / Ý tưởng
- Đặt lại mật khẩu qua email
- Thông báo đẩy / tin nhắn phụ huynh khi có bài tập mới hoặc sắp đến hạn
- Gia hạn riêng cho từng em
- Thống kê toàn trường cho admin

## Nợ kỹ thuật đã biết
- Bản đồ, bảng xếp hạng, trạng thái bài tập và thống kê tính lại mỗi lần gọi (aggregate). Đủ nhanh cho lớp ≤ 60 em; cần cache/bảng tổng hợp khi một trường có hàng nghìn học sinh.
- `audioText` gửi xuống máy học sinh, có thể lộ đáp án → xử lý ở 4.1.
- Tạo học sinh hàng loạt chưa dùng transaction; lỗi giữa chừng có thể để lại một phần tài khoản → xử lý ở 4.1.
- `@nestjs/storage` ghim bản `0.0.5` → thay ở 4.1.
- Màn hình cũ còn dùng `useAsync` → chuyển ở 4.1.
