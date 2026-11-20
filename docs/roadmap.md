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

## ⚔️ Giai đoạn 4 – Thi đấu trực tiếp
- [ ] Đấu trường trực tuyến Socket.io (kiểu Kahoot)
- [ ] Đặt lại mật khẩu qua email, thông báo đẩy / tin nhắn phụ huynh khi có bài tập mới hoặc sắp đến hạn
- [ ] Gia hạn riêng cho từng em, thống kê toàn trường cho admin, upload file âm thanh cho câu nghe

## Nợ kỹ thuật đã biết
- Màn hình cũ (giai đoạn 1–2) còn dùng `useAsync`; chuyển dần sang TanStack Query.
- Bản đồ, bảng xếp hạng, trạng thái bài tập và thống kê tính lại mỗi lần gọi (aggregate). Đủ nhanh cho lớp ≤ 60 em; cần cache/bảng tổng hợp khi một trường có hàng nghìn học sinh.
- Câu nghe dùng giọng đọc của trình duyệt: `audioText` gửi xuống máy học sinh (có thể lộ đáp án với câu "nghe và chọn từ"); khắc phục bằng file âm thanh dựng sẵn ở server.
- Tạo học sinh hàng loạt chưa dùng transaction (DB in-memory không có replica set); lỗi giữa chừng có thể để lại một phần tài khoản.
- `@nestjs/storage` đang ở bản 0.0.x (ghim đúng phiên bản `0.0.5`); kiểm tra changelog trước khi nâng.
