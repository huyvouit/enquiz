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
Kế hoạch, quyết định D12–D18 và E1–E8, kết quả từng mốc: **[phase-4-plan.md](phase-4-plan.md)** · Hướng dẫn deploy: **[deploy.md](deploy.md)**.
Thứ tự: **4.0 → 4.1 → 4.2**; 4.3 làm song song được sau 4.0.
- [ ] 4.0 Deploy & hạ tầng: Firebase Hosting + Cloud Run + Atlas + Cloud Storage (D12); CI; giới hạn đăng nhập theo username/IP (D14); `create:admin` (D15). **Code xong** ([kết quả](phase-4-plan.md#kết-quả-40)), chờ dựng hạ tầng
- [ ] 4.1 Bảo mật & nợ kỹ thuật: câu nghe không lộ `audioText` (D16), xoá bù khi tạo học sinh hàng loạt lỗi (D17), thư viện lưu file (D18), bỏ `useAsync`
- [ ] 4.2 Exam Mode (E1–E8): đếm giờ ở server, Previous/Next, rà soát & đánh dấu, 1 lượt, tự nộp khi hết giờ, không cộng XP/mở trạm
- [ ] 4.3 UX & thao tác giáo viên: chạm trên tablet, in thẻ đăng nhập, nhân bản câu, CSV mẫu, nổi câu sai nhiều, vị trí cá nhân trên bảng xếp hạng

## ⚔️ Giai đoạn 5 – Đấu trường trực tuyến
Kế hoạch: `phase-5-plan.md` (viết trước khi bắt đầu giai đoạn).
Điều kiện trên Cloud Run: `min-instances=1` + CPU luôn cấp (để không ngủ giữa trận), bật session affinity; Socket.io kết nối **thẳng domain Cloud Run** vì rewrite của Firebase Hosting không chuyển tiếp WebSocket (cần CORS cho origin Firebase); Redis adapter nếu chạy nhiều instance.
- [ ] **5.1 Đấu trường cho học sinh đã đăng nhập (Socket.io, kiểu Kahoot):** màn hình Host (mã PIN/QR, lobby real-time, kick người chơi, đếm số nộp bài, biểu đồ đáp án, bục vinh quang) & màn hình Player (4 nút màu lớn, tính điểm tốc độ theo server timestamp); JWT handshake, tự lưu kết quả
- [ ] **5.2 Khôi phục phiên:** Auto-Reconnect qua `sessionStorage` chống mất điểm khi F5/rớt mạng
- [ ] **5.3 Khách vãng lai:** Guest nickname (lọc từ ngữ không phù hợp), rate limit riêng cho khách

## 📱 Giai đoạn 6 – Bảo mật Auth, PWA & Quản lý phiên bản
Kế hoạch: `phase-6-plan.md` (viết trước khi bắt đầu giai đoạn).
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
