# 06 – Dữ liệu demo (seed)

> Giai đoạn: 1, 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Cài đặt mới là có ngay tài khoản và bài để chơi thử, không cần nhập tay.

## Cách hoạt động
- `be/src/database/seed/seed.service.ts` chạy lúc khởi động (`OnApplicationBootstrap`).
- Chỉ chạy khi **`SEED_DEMO_DATA=true`** **và** collection `users` đang rỗng → không bao giờ ghi đè dữ liệu thật.
- Nội dung ở `be/src/database/seed/demo-data.ts`:
  - 3 tài khoản: `admin/admin123`, `teacher/teacher123` (Cô Lan), `student/student123` (Bé An, lớp 1).
  - 5 quiz hệ thống (`createdBy = null`, đã xuất bản): Animals 🦁, Colors 🌈, Numbers 🔢 (lớp 1); Family 👨‍👩‍👧, School 🎒 (lớp 2) – tổng 23 câu trắc nghiệm + nối từ, có giải thích tiếng Việt.

## Nội dung chuẩn (giai đoạn 3): `npm run seed:content`
- Nạp kho câu hỏi chuẩn từ `be/src/database/seed/content/*.csv` vào database đang cấu hình (`MONGODB_URI`) và tạo **trạm hệ thống** trên bản đồ từ cột `quiz` (cột `quizEmoji` = biểu tượng trạm).
- Dùng **cùng bộ kiểm tra** với màn nhập CSV (tài liệu [13](13-question-import.md)); file có dòng lỗi thì **không nạp** file đó và in lỗi theo dòng.
- **Chạy lại an toàn**: câu hỏi khớp theo `externalId` (cập nhật thay vì tạo mới), trạm khớp theo (khối, tên trạm); trạm mới được nối vào cuối bản đồ (`mapOrder`).
- `starter-bank.csv`: 48 câu tự soạn (không chép đề Cambridge/SGK), 8 trạm – lớp 1 *Nghe và chọn*, lớp 2 *Đồ chơi của em*, lớp 3 *Đồ ăn ngon* + *Nghề nghiệp*, lớp 4 *Thời tiết* + *Một ngày của em*, lớp 5 *Kỳ nghỉ hè* + *Sức khoẻ*. Đủ 4 dạng câu, có câu nghe; gắn `yleLevel` Starters/Movers/Flyers.
- Lệnh build backend rồi chạy `dist/cli/seed-content.js` (NestJS application context, không mở cổng HTTP).
- Nội dung thật cần giáo viên tiếng Anh duyệt trước khi nạp; thêm file CSV mới vào cùng thư mục.

## Chạy lại seed
Xoá hết collection `users` (hoặc cả database) rồi khởi động lại backend với `SEED_DEMO_DATA=true`.

## Database tạm trong bộ nhớ
`MONGODB_URI=memory` (`be/src/database/database.module.ts`) bật `mongodb-memory-server` – mỗi lần khởi động là DB trống + seed lại. Chỉ cho dev/demo; e2e test cũng dùng chế độ này.

## Lưu ý
- Môi trường thật: `SEED_DEMO_DATA=false`, đổi mật khẩu hoặc xoá tài khoản demo.
- Thêm nội dung mẫu cho demo: sửa `DEMO_QUIZZES`. Nội dung dùng thật: thêm CSV vào `seed/content/` rồi `npm run seed:content`.
