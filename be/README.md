# EnQuiz – Backend

NestJS 12 (ESM) · Mongoose 9 · CQRS (`@nestjs/cqrs`) · JWT (Passport) · Vitest.

Quy tắc chung, cách chạy và danh sách tính năng: xem [README gốc](../README.md). Chi tiết từng tính năng: [`../docs/features/`](../docs/features/).

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run start:dev` | Chạy dev, tự reload |
| `npm run build` / `npm run start:prod` | Build ra `dist/` rồi chạy |
| `npm test` | Unit test |
| `npm run test:e2e` | E2E toàn luồng trên MongoDB in-memory |
| `npm run lint` | oxlint (type-aware) |
| `npm run migrate:phase2` | Chuyển dữ liệu giai đoạn 1 → 2 (chạy một lần, an toàn khi chạy lại) |
| `npm run migrate:phase3` | Chuyển dữ liệu lên giai đoạn 3; `-- --dry-run` để xem trước |
| `npm run seed:content` | Nạp kho câu hỏi chuẩn `src/database/seed/content/*.csv` + trạm bản đồ (chạy lại an toàn) |
| `npm run set:password -- <username>` | Đặt mật khẩu mới cho một tài khoản bất kỳ, kể cả admin, và kết thúc mọi phiên của nó. Mật khẩu lấy từ `NEW_PASSWORD` (admin ≥ 12, khác ≥ 6 ký tự) hoặc sinh ngẫu nhiên và in **một lần**. Dùng cho tài khoản tạo trước v1.1.0 (D26) |
| `npm run create:admin -- <username> "<Họ tên>"` | Tạo tài khoản admin đầu tiên (production không có dữ liệu demo). Mật khẩu lấy từ `ADMIN_PASSWORD` (≥ 12 ký tự) hoặc sinh ngẫu nhiên và in **một lần** |

## Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP |
| `MONGODB_URI` | — (bắt buộc) | Chuỗi kết nối MongoDB, hoặc `memory` để dùng DB tạm |
| `JWT_SECRET` | — (bắt buộc, ≥ 16 ký tự) | Khoá ký JWT |
| `JWT_EXPIRES_IN` | `15m` | Hạn access token (D22); app tự lấy token mới từ cookie phiên |
| `REFRESH_TTL_SESSION` | `12h` | Phiên khi **không** chọn "Ghi nhớ đăng nhập": cookie mất khi đóng trình duyệt, tối đa 12 giờ |
| `REFRESH_TTL_REMEMBER` | `7d` | Phiên khi chọn "Ghi nhớ": hết hạn sau 7 ngày không dùng… |
| `REFRESH_MAX_REMEMBER` | `14d` | …và không quá 14 ngày kể từ lúc đăng nhập |
| `COOKIE_SECURE` | `true` | Thuộc tính `Secure` của cookie `__session` (trình duyệt vẫn nhận trên `http://localhost`) |
| `CORS_ORIGIN` | `http://localhost:5173` | Danh sách origin, cách nhau bởi dấu phẩy |
| `LIVE_CORS_ORIGINS` | `http://localhost:5173` | Origin được mở socket Đấu trường (`/live`) thẳng tới Cloud Run, cách nhau bởi dấu phẩy. Production: domain Firebase Hosting (D19) |
| `SEED_DEMO_DATA` | `false` | `true` → tạo dữ liệu demo khi DB chưa có user |
| `AUTH_RATE_LIMIT` | `10` | Số lần đăng nhập/đăng ký mỗi phút cho **một username** (chống dò mật khẩu) |
| `AUTH_IP_RATE_LIMIT` | `100` | Số lần đăng nhập/đăng ký mỗi phút cho **một IP**; để cao vì cả trường thường dùng chung một IP |
| `TRUST_PROXY` | `0` | Số proxy đứng trước API (Express `trust proxy`) để giới hạn nhìn đúng IP thật; kiểm tra bằng `clientIp` trong `GET /api/v1/health` |
| `LIVE_TRUST_PROXY` | = `TRUST_PROXY` | Như trên, cho socket Đấu trường. Socket đi thẳng vào Cloud Run nên production đặt ít hơn `TRUST_PROXY` một đơn vị (`TRUST_PROXY=2`, `LIVE_TRUST_PROXY=1`) |
| `STORAGE_DRIVER` | `local` | Nơi lưu ảnh và âm thanh: `local`, `s3` (S3, R2, MinIO… cần khoá) hoặc `gcs` (Cloud Storage, không cần khoá: dùng danh tính tài khoản chạy app; production) |
| `UPLOAD_DIR` | `uploads` | `local`: thư mục lưu ảnh (đã `.gitignore`) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_URL` | — | `s3`: bucket và URL công khai (gốc bucket; file nằm dưới `images/`, `audio/`); khoá lấy từ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
| `GCS_BUCKET` | — | `gcs`: tên bucket; file công khai ở `https://storage.googleapis.com/<bucket>/` |
| `TTS_DRIVER` | `none` | Âm thanh câu nghe (D16): `none` (không tạo), `google` (Cloud Text-to-Speech), `fake` (chỉ cho test). Ảnh và âm thanh dùng chung `STORAGE_DRIVER`, thư mục `images/` và `audio/` |
| `GOOGLE_TTS_API_KEY` | — | Bắt buộc khi `google`; khoá chỉ cho phép Text-to-Speech API |
| `TTS_LANGUAGE`, `TTS_VOICE` | `en-GB`, rỗng | Ngôn ngữ giọng đọc; tên giọng cụ thể (tuỳ chọn) |

Biến được kiểm tra lúc khởi động ở `src/config/env.validation.ts`; thiếu/sai thì server dừng kèm thông báo rõ ràng.

## Cấu trúc

```
src/
├── main.ts / app.module.ts   # khởi động, guard toàn cục
├── common/                   # guard, decorator, filter, interceptor, pipe, tiện ích
├── config/                   # kiểm tra biến môi trường
├── cli/seed-content.ts       # npm run seed:content
├── cli/create-admin.ts       # npm run create:admin
├── database/                 # kết nối Mongo, seed demo, seed/content/*.csv
└── modules/
    ├── auth/        users/   # 01 (users/: duyệt giáo viên, khoá, đặt lại mật khẩu)
    ├── questions/            # 02, 13 (import/: CSV)
    ├── quizzes/              # 03, 04, thứ tự bản đồ (map-order.ts)
    ├── progress/             # 04 (phiên chơi), 05, 07, 08
    ├── classes/              # 10 – lớp, nhóm, mã mời, tạo học sinh hàng loạt
    ├── assignments/          # 11 – bài tập, trạng thái nộp, nhắc nhở
    ├── exams/                # 14 – chế độ kiểm tra: phiên thi, lưu nháp, chấm khi nộp
    ├── live/                 # 15 – Đấu trường: gateway Socket.io /live, máy trạng thái, phòng trong RAM
    ├── analytics/            # 12 – thống kê, bản đồ nhiệt, xuất Excel/PDF
    └── uploads/              # ảnh câu hỏi (@nestjs/storage)
scripts/                      # migrate-phase2/3.mjs, lib.mjs (dùng chung), backup-db.mjs / restore-db.mjs (`npm run backup:db`, `restore:db`: sao lưu và khôi phục DB, xem `deploy.md`), live-check.mjs (kiểm tra kết nối socket Đấu trường), live-load.mjs (thử tải 60 người một phòng, tạo lớp thử)
test/app.e2e-spec.ts          # E2E giai đoạn 1–2
test/phase3.e2e-spec.ts       # E2E giai đoạn 3
test/exam.e2e-spec.ts         # E2E chế độ kiểm tra (4.2)
test/live.e2e-spec.ts         # E2E socket Đấu trường: bắt tay, CORS (5.0)
test/live-match.e2e-spec.ts   # E2E trận đấu: host/player, vào lại, khách (5.1–5.3)
```
