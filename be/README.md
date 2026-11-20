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
| `npm run create:admin -- <username> "<Họ tên>"` | Tạo tài khoản admin đầu tiên (production không có dữ liệu demo). Mật khẩu lấy từ `ADMIN_PASSWORD` (≥ 12 ký tự) hoặc sinh ngẫu nhiên và in **một lần** |

## Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP |
| `MONGODB_URI` | — (bắt buộc) | Chuỗi kết nối MongoDB, hoặc `memory` để dùng DB tạm |
| `JWT_SECRET` | — (bắt buộc, ≥ 16 ký tự) | Khoá ký JWT |
| `JWT_EXPIRES_IN` | `7d` | Hạn token |
| `CORS_ORIGIN` | `http://localhost:5173` | Danh sách origin, cách nhau bởi dấu phẩy |
| `SEED_DEMO_DATA` | `false` | `true` → tạo dữ liệu demo khi DB chưa có user |
| `AUTH_RATE_LIMIT` | `10` | Số lần đăng nhập/đăng ký mỗi phút cho **một username** (chống dò mật khẩu) |
| `AUTH_IP_RATE_LIMIT` | `100` | Số lần đăng nhập/đăng ký mỗi phút cho **một IP**; để cao vì cả trường thường dùng chung một IP |
| `TRUST_PROXY` | `0` | Số proxy đứng trước API (Express `trust proxy`) để giới hạn nhìn đúng IP thật; kiểm tra bằng `clientIp` trong `GET /api/v1/health` |
| `STORAGE_DRIVER` | `local` | Nơi lưu ảnh câu hỏi: `local` hoặc `s3` (S3, R2, MinIO…) |
| `UPLOAD_DIR` | `uploads` | `local`: thư mục lưu ảnh (đã `.gitignore`) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_URL` | — | `s3`: bucket và URL công khai; khoá lấy từ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |

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
    ├── analytics/            # 12 – thống kê, bản đồ nhiệt, xuất Excel/PDF
    └── uploads/              # ảnh câu hỏi (@nestjs/storage)
scripts/                      # migrate-phase2/3.mjs, lib.mjs (dùng chung)
test/app.e2e-spec.ts          # E2E giai đoạn 1–2
test/phase3.e2e-spec.ts       # E2E giai đoạn 3
```
