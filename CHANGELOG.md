# Changelog

Mọi thay đổi người dùng thấy được của EnQuiz, theo phiên bản ([SemVer](https://semver.org/lang/vi/)). Số phiên bản nằm trong file `VERSION`; quy trình phát hành: [docs/deploy.md](docs/deploy.md#phát-hành-theo-phiên-bản) (quyết định D21, [phase-6-plan.md](docs/phase-6-plan.md)).

Mỗi mục ghi: thay đổi chính, PR liên quan, và **việc cần làm khi deploy** (biến môi trường mới, migrate) nếu có.

## [1.0.0] – 2026-11-21

Bản phát hành đầu tiên có số phiên bản. Gồm mọi thứ đã làm từ giai đoạn 1 tới 5, cùng 4.0–4.2:

- **Học sinh:** bản đồ phiêu lưu lớp 1–5, chơi quiz 4 dạng câu (trắc nghiệm, nối, điền từ, sắp xếp), câu nghe có âm thanh, XP và cấp độ, bảng xếp hạng, bài tập của thầy cô, bài kiểm tra có giờ, Đấu trường trực tuyến (PIN/QR, điểm theo tốc độ).
- **Giáo viên:** lớp học và nhóm, tạo học sinh hàng loạt, kho câu hỏi và nhập CSV, soạn quiz, giao bài và chấm, thống kê và xuất Excel/PDF, mở phòng Đấu trường.
- **Admin:** duyệt giáo viên, khoá và cấp lại mật khẩu, sắp xếp bản đồ, tạo âm thanh câu nghe.
- **Tài khoản:** đổi mật khẩu cho mọi vai trò; đổi hoặc đặt lại mật khẩu thì các máy khác bị đăng xuất (D20, PR #9).
- **Bảo mật và vận hành** (PR #5–#10): kiểm tra trước khi launch (A1–A6, B1–B4), lưu file không dùng khoá, log JSON cho Error Reporting, backup DB.
- **Mới so với bản đang chạy trước đó** (`85ab510`): log JSON cho Error Reporting (PR #10), link có gạch chân ở trang đăng nhập và đăng ký (PR #10), số phiên bản ở `/health` và chân trang (6.5).

**Khi deploy:** script phát hành tự đặt `APP_VERSION`, `GIT_COMMIT` cho revision. Không có biến hay migrate nào khác.
