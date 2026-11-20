# 10 – Lớp học, nhóm & tài khoản học sinh

> Giai đoạn: 3 (mốc 3.1) · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Giáo viên gom học sinh của mình vào **lớp** để giao bài, xem thống kê và có bảng xếp hạng riêng của lớp. Học sinh nhỏ (lớp 1–2) không cần tự đăng ký: cô tạo tài khoản cho cả lớp và in thẻ đăng nhập.

## Luồng chính
1. Giáo viên: menu **🏫 Lớp học** → **Tạo lớp** (tên, khối, tên trường không bắt buộc) → hệ thống sinh **mã mời 6 ký tự** (bỏ 0/O/1/I/L).
2. Cách 1 – học sinh tự vào: cô chiếu mã lên bảng (mã hiển thị cỡ lớn, có nút sao chép), em nhập mã ở thẻ **“Vào lớp của cô”** trên trang chủ. Mã không phân biệt hoa/thường, bỏ qua dấu cách và gạch ngang. Vào lại lần nữa không sao.
3. Cách 2 – cô tạo tài khoản: **Thêm học sinh** → dán danh sách họ tên (mỗi dòng một em) → xem trước → **Tạo** → bảng tên đăng nhập + mật khẩu → **🖨️ In thẻ đăng nhập** (A4, 8 thẻ/trang). Mật khẩu **chỉ hiện một lần**; đóng hộp thoại phải xác nhận.
4. Tab **Học sinh**: cấp, XP từng em; **📈 Xem tiến độ** (báo cáo cá nhân – tài liệu 12), **🔑 Đặt lại mật khẩu** (mật khẩu tạm hiện một lần), **Cho rời lớp** (tài khoản và lịch sử giữ nguyên).
5. Tab **Nhóm**: tạo nhóm có tên (“Nhóm cần kèm”), chạm để chọn học sinh (không kéo thả). Nhóm dùng để giao bài cho một phần lớp (tài liệu 11).
6. **⚙️ Cài đặt lớp**: đổi tên/khối/tên trường, **lưu trữ** lớp (ẩn khỏi danh sách, mã ngừng hoạt động, dữ liệu giữ nguyên) hoặc mở lại. **🔄 Đổi mã**: mã cũ hết hiệu lực, học sinh đã vào lớp không bị ảnh hưởng.

## Backend
- Module: `be/src/modules/classes/`

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/classes?archived=true\|false` | Mọi vai trò | Giáo viên: lớp mình dạy · Admin: mọi lớp · Học sinh: lớp mình học (không có mã) |
| POST | `/classes` | Teacher/Admin | Tạo lớp, sinh mã (thử lại nếu trùng) |
| GET | `/classes/:id` | Chủ lớp/Admin | Chi tiết + học sinh + nhóm |
| PUT | `/classes/:id` | Chủ lớp/Admin | Tên, khối, tên trường, `status` (active/archived) |
| POST | `/classes/:id/code` | Chủ lớp/Admin | Đổi mã mời |
| POST | `/classes/join` | Student | `{ code }` – vào lớp (409 khi đủ 60 em, 404 khi sai mã/lớp đã lưu trữ) |
| POST | `/classes/:id/students/bulk` | Chủ lớp/Admin | `{ fullNames }` (≤ 60) → `{ class, created: [{ id, fullName, username, password }] }` |
| DELETE | `/classes/:id/students/:studentId` | Chủ lớp/Admin | Cho rời lớp (gỡ khỏi mọi nhóm) |
| POST | `/classes/:id/students/:studentId/reset-password` | Chủ lớp/Admin | Mật khẩu tạm (trả về một lần) |
| POST · PUT · DELETE | `/classes/:id/groups[/:groupId]` | Chủ lớp/Admin | Nhóm `{ name, studentIds }` (≤ 10 nhóm) |

- Command: `CreateClass`, `UpdateClass`, `RegenerateClassCode`, `JoinClass`, `BulkCreateStudents`, `RemoveStudent`, `SaveGroup`, `DeleteGroup`, `ResetPassword` (module users).
- Query dùng chung qua `QueryBus` cho module khác: `TeachesStudentQuery` (giáo viên có dạy em này không), `ClassAccessQuery` (`manage` = chủ lớp/admin, `view` = thêm học sinh trong lớp), `StudentClassIdsQuery`.
- Event: `StudentsJoinedClassEvent`, `StudentLeftClassEvent` → module bài tập thêm/gỡ học sinh khỏi bài giao cả lớp.
- Collection `classes`: `name`, `code` (unique), `teacherId`, `gradeLevel`, `schoolName?`, `studentIds[]` (≤ 60, nhúng), `groups[{ _id, name, studentIds }]` (≤ 10), `status`. Index: `code`, `{ teacherId, status, createdAt }`, `studentIds` (multikey).
- Quy tắc:
  - Lớp của giáo viên khác → **404** (không lộ lớp tồn tại).
  - Tên đăng nhập tạo hàng loạt: tên gọi bỏ dấu, không có họ (“Nguyễn Minh Anh” → `minhanh`); tên quá ngắn dùng cả họ (“Phạm An” → `phaman`); trùng thì thêm số (`minhanh2`). Mật khẩu dạng `tiger42`.
  - Mật khẩu tạm không được lưu dạng rõ, không ghi log.

## Frontend
- Feature: `fe/src/features/classes/`
- Route:
  - `/teacher/classes` → `ClassesPage` (thẻ lớp: tên, khối, sĩ số, mã; công tắc hiện lớp đã lưu trữ).
  - `/teacher/classes/:classId?tab=students|groups|assignments|analytics` → `ClassDetailPage`. Tab **Bài tập** và **Thống kê** do feature khác cung cấp, router ghép vào qua prop `tabs` (`ClassTabProps = { classDetail, reload }`) để `classes` không import ngược `assignments`/`analytics`.
- Trang chủ học sinh: `JoinClassCard`; `useMyClasses()` cho các màn khác (bảng xếp hạng lớp).
- State: TanStack Query, key `['classes', …]` (`classKeys`); mọi thay đổi invalidate `['classes']`.
- In thẻ: `LoginCardsPrint` render vào `<body>` qua portal; CSS `@media print` ẩn mọi thứ khác, lưới 2 × 4 thẻ/trang A4. Không thêm thư viện.

## Quyết định thiết kế
- **Nhúng `studentIds` trong lớp** (đúng thiết kế gốc): lớp ≤ 60 em; thêm/bớt bằng `$addToSet`/`$pull` nên không cần khoá. “Kiểm tra sĩ số + thêm” là một lệnh nguyên tử (`studentIds.59` chưa tồn tại).
- **Một học sinh ở được nhiều lớp** (D5): lớp chính khoá + CLB.
- Mật khẩu chỉ hiện ngay sau khi tạo/đặt lại: không có màn nào xem lại mật khẩu.
- Tab chọn bằng `?tab=` trên URL để màn khác dẫn thẳng tới tab (ví dụ “Giao bài ôn” mở `?tab=assignments&assignQuiz=…`).

## Kiểm thử
- Unit `class-rules.spec.ts`: mã không có ký tự dễ nhầm, chuẩn hoá mã, bỏ dấu tiếng Việt, sinh tên đăng nhập.
- e2e `test/phase3.e2e-spec.ts` › classes: tạo lớp, giáo viên khác 404, học sinh không tạo được lớp; vào lớp bằng mã gõ thường/có dấu cách, vào lại, mã sai; tạo hàng loạt (tên trùng `minhanh2`), đăng nhập bằng mật khẩu được cấp; nhóm chỉ gồm thành viên; đặt lại mật khẩu chỉ cho học sinh của mình; rời lớp → gỡ khỏi nhóm và bài tập.

## Hướng mở rộng / còn tồn đọng
- Mã QR trên thẻ đăng nhập (cần thư viện tạo QR).
- Tạo hàng loạt chưa dùng transaction (DB in-memory không có replica set): lỗi giữa chừng có thể để lại một phần tài khoản.
- Chuyển học sinh giữa các lớp, đồng giáo viên (nhiều giáo viên một lớp).
