# Changelog

Mọi thay đổi người dùng thấy được của EnQuiz, theo phiên bản ([SemVer](https://semver.org/lang/vi/)). Số phiên bản nằm trong file `VERSION`; quy trình phát hành: [docs/deploy.md](docs/deploy.md#phát-hành-theo-phiên-bản) (quyết định D21, [phase-6-plan.md](docs/phase-6-plan.md)).

Mỗi mục ghi: thay đổi chính, PR liên quan, và **việc cần làm khi deploy** (biến môi trường mới, migrate) nếu có.

## [1.1.0] – 2026-11-21

Bản đầu tiên phát hành lên production theo quy trình D21. `1.0.0` đã chuẩn bị (revision và kênh xem trước có tag `v1-0-0`) nhưng **không promote**: mọi thay đổi của nó nằm trong bản này. PR #13.

- **Phiên đăng nhập** (6.1, D22): access token 15 phút chỉ nằm trong RAM, refresh token trong cookie `__session` (HttpOnly, SameSite=Strict), đổi mới mỗi lần dùng; dùng lại token cũ thì thu hồi cả phiên. Ô **"Ghi nhớ đăng nhập trên máy này"** (mặc định tắt: 12 giờ; bật: 7 ngày kể từ lần dùng gần nhất, tối đa 14 ngày). Nút **"Đăng xuất mọi thiết bị"** ở trang Đổi mật khẩu. Đăng xuất, đổi/đặt lại mật khẩu, khoá tài khoản có hiệu lực ngay, cả với socket Đấu trường.
- **Mật khẩu được hash trong trình duyệt** (D26, theo yêu cầu chủ dự án): API chỉ nhận `SHA-256("enquiz-pw-v1:" + username + ":" + mật khẩu)`; server lưu bcrypt của chuỗi đó. App cũ gửi mật khẩu rõ sẽ nhận thông báo "Ứng dụng đã cũ, vui lòng tải lại trang".
- **Cài EnQuiz như ứng dụng** (6.3, D24): có manifest và icon, nên "Thêm vào màn hình chính" được trên tablet và điện thoại. Vỏ app mở nhanh từ cache, và mở được cả khi mất mạng; lúc đó hiện thanh "Mất mạng rồi – kết nối lại để học tiếp nhé!". Ảnh và âm thanh câu hỏi được cache (300 file, 30 ngày). API **không** bao giờ được cache.
- **Thanh "EnQuiz có bản mới – Cập nhật"** (6.4, D25): không hiện trong phòng thi, khi đang chơi quiz hay đang ở trận Đấu trường. `/api/v1/health` trả `minClientVersion`; app cũ hơn tự cập nhật khi rời các màn đó. `release.sh` nhận `MIN_CLIENT_VERSION=x.y.z` lúc `prepare`, và build frontend trong một worktree sạch.

**Khi deploy:**
- Mọi người phải đăng nhập lại một lần (token 7 ngày cũ không còn hợp lệ).
- **Tài khoản tạo trước bản này không đăng nhập được** cho tới khi đặt lại mật khẩu (server chưa từng thấy mật khẩu ở dạng đổi được). Ngay sau `promote`, chạy `npm run set:password -- <username>` (trong `be/`, `MONGODB_URI` của production) cho từng tài khoản; học sinh có thể được giáo viên đặt lại mật khẩu trong app.
- Không có biến môi trường bắt buộc mới (mặc định: `JWT_EXPIRES_IN=15m`, `REFRESH_TTL_SESSION=12h`, `REFRESH_TTL_REMEMBER=7d`, `REFRESH_MAX_REMEMBER=14d`, `MIN_CLIENT_VERSION=0.0.0`). Collection mới `auth_sessions` tự tạo, có TTL index.
- Bật CORS cho bucket ảnh/âm thanh một lần (`deploy.md` mục 2), để service worker cache được file. Thiếu bước này app vẫn chạy, chỉ không cache.
- CSP thêm `https://storage.googleapis.com` vào `connect-src`, vì service worker tải ảnh/âm thanh bằng `fetch`.

## [1.0.0] – 2026-11-21

Chuẩn bị nhưng không đưa lên production (đi thẳng lên `1.1.0`). Bản phát hành đầu tiên có số phiên bản. Gồm mọi thứ đã làm từ giai đoạn 1 tới 5, cùng 4.0–4.2:

- **Học sinh:** bản đồ phiêu lưu lớp 1–5, chơi quiz 4 dạng câu (trắc nghiệm, nối, điền từ, sắp xếp), câu nghe có âm thanh, XP và cấp độ, bảng xếp hạng, bài tập của thầy cô, bài kiểm tra có giờ, Đấu trường trực tuyến (PIN/QR, điểm theo tốc độ).
- **Giáo viên:** lớp học và nhóm, tạo học sinh hàng loạt, kho câu hỏi và nhập CSV, soạn quiz, giao bài và chấm, thống kê và xuất Excel/PDF, mở phòng Đấu trường.
- **Admin:** duyệt giáo viên, khoá và cấp lại mật khẩu, sắp xếp bản đồ, tạo âm thanh câu nghe.
- **Tài khoản:** đổi mật khẩu cho mọi vai trò; đổi hoặc đặt lại mật khẩu thì các máy khác bị đăng xuất (D20, PR #9).
- **Bảo mật và vận hành** (PR #5–#10): kiểm tra trước khi launch (A1–A6, B1–B4), lưu file không dùng khoá, log JSON cho Error Reporting, backup DB.
- **Mới so với bản đang chạy trước đó** (`85ab510`): log JSON cho Error Reporting (PR #10), link có gạch chân ở trang đăng nhập và đăng ký (PR #10), số phiên bản ở `/health` và chân trang (6.5).

**Khi deploy:** script phát hành tự đặt `APP_VERSION`, `GIT_COMMIT` cho revision. Không có biến hay migrate nào khác.
