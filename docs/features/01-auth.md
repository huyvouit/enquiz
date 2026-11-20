# 01 – Đăng ký, đăng nhập, phân quyền, quản lý tài khoản

> Giai đoạn: 1, 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Học sinh và giáo viên tạo tài khoản, đăng nhập bằng tên đăng nhập + mật khẩu; hệ thống phân quyền 3 vai trò `student`, `teacher`, `admin`.

Giai đoạn 3 bổ sung:
- Giáo viên mới phải được **quản trị viên duyệt**, vì giáo viên xem được dữ liệu của trẻ.
- Khoá tài khoản.
- Cấp lại mật khẩu: admin cho mọi tài khoản, giáo viên cho học sinh lớp mình.
- Chống dò mật khẩu.

## Luồng chính
1. Người dùng đăng ký: chọn vai trò; học sinh chọn thêm lớp 1–5. Nhận ngay `accessToken`.
   - Học sinh: tài khoản `active`, vào thẳng trang chủ.
   - Giáo viên: tài khoản `pending`. Mọi màn hình sau khi đăng nhập hiện trang **"Tài khoản đang chờ quản trị viên duyệt"**, có nút **Kiểm tra lại** và **Đăng xuất**.
2. Admin vào `/admin/users`, tab **⏳ Chờ duyệt** (mở sẵn khi có người chờ) → **✅ Duyệt**. Giáo viên bấm "Kiểm tra lại" hoặc đăng nhập lại là dùng được.
3. Đăng nhập → nhận `accessToken` (JWT, mặc định hạn 7 ngày). Mọi request sau gửi header `Authorization: Bearer <token>`.
4. Token hết hạn/sai hoặc tài khoản bị khoá → API trả 401 → frontend tự đăng xuất, đưa về `/login`.
5. Học sinh lớp nhỏ thường do giáo viên **tạo hàng loạt** trong lớp (tài liệu [10](10-classes.md)), không tự đăng ký.

## Trạng thái tài khoản (`users.status`)
| Trạng thái | Ai | Được làm gì |
| --- | --- | --- |
| `active` | Học sinh, admin, giáo viên đã duyệt | Bình thường |
| `pending` | Giáo viên tự đăng ký | Chỉ đăng nhập và `GET /users/profile`; mọi API khác → **403** "Tài khoản giáo viên đang chờ quản trị viên duyệt" |
| `disabled` | Do admin khoá | Đăng nhập → 401 "Tài khoản đã bị khoá…"; token cũ → 401 ở request kế tiếp (trễ tối đa 30 giây, xem bên dưới) |

## Backend
- Module: `be/src/modules/auth/`, `be/src/modules/users/`. Guard/decorator dùng chung ở `be/src/common/`.

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/auth/register` | Công khai | Đăng ký học sinh/giáo viên, trả `{ accessToken, user }` |
| POST | `/auth/login` | Công khai | Đăng nhập, trả `{ accessToken, user }` |
| GET | `/users/profile` | Mọi vai trò, kể cả `pending` | Người dùng hiện tại (có `status`; học sinh kèm lớp, cấp, XP) |
| GET | `/admin/users?role&status&search&page&limit` | Admin | Danh sách có phân trang, mới nhất trước; `search` khớp tên hoặc tên đăng nhập |
| PATCH | `/admin/users/:id/status` | Admin | `{ status: "active" \| "disabled" }`: duyệt, mở khoá, khoá |
| POST | `/admin/users/:id/reset-password` | Admin | Cấp mật khẩu tạm (trả **một lần**) |
| POST | `/classes/:id/students/:studentId/reset-password` | Giáo viên của lớp | Như trên, cho học sinh lớp mình (tài liệu 10) |
| GET | `/health` | Công khai | Kiểm tra server sống |

- Command: `RegisterCommand`, `LoginCommand`, `SetUserStatusCommand`, `ResetPasswordCommand` · Query: `GetProfileQuery`, `ListUsersQuery`.
- Collection `users`: `username` (unique, lowercase), `password` (bcrypt, `select: false`), `fullName`, `role`, `status`, `studentProfile?` `{ gradeLevel, level, xp }` (cấp/XP: tài liệu [07](07-progression-quest-map.md)).
- Payload JWT: `{ sub: userId, username, role }`. **Không** chứa `status`, vì admin đổi status bất cứ lúc nào.
- Guard toàn cục, theo thứ tự:
  1. `JwtAuthGuard`: mọi endpoint cần token, trừ khi gắn `@Public()`.
  2. `ActiveAccountGuard`: đọc `status` qua `AccountStatusService` (cache 30 giây trong bộ nhớ; admin đổi status thì xoá cache ngay trong cùng tiến trình). `pending` chỉ qua được endpoint gắn `@AllowPending()`.
  3. `RolesGuard`: đọc `@Roles(...)`; không gắn = mọi người đã đăng nhập.
- Quy tắc:
  - Không tự đăng ký được `admin` (400). Admin tạo bằng seed/vận hành.
  - `username`: 3–30 ký tự `[a-zA-Z0-9_.]`, không phân biệt hoa thường. Trùng → 409.
  - Mật khẩu 6–72 ký tự (bcrypt chỉ dùng 72 byte đầu).
  - Sai tên hoặc sai mật khẩu đều trả cùng một thông báo 401 (không để lộ tài khoản nào tồn tại).
  - **Chống dò mật khẩu:** `/auth/login` và `/auth/register` giới hạn `AUTH_RATE_LIMIT` lần/phút/IP (mặc định 10, `@nestjs/throttler`). Vượt → **429** "Bạn thử quá nhiều lần rồi. Vui lòng đợi một phút rồi thử lại nhé"; frontend hiện nguyên câu này.
  - Admin không đổi được status của chính mình hay của admin khác; không cấp lại được mật khẩu admin.
  - Giáo viên chỉ cấp lại được mật khẩu học sinh đang ở **một lớp đang hoạt động của mình** (`TeachesStudentQuery`). Người khác → 404.
  - **Mật khẩu tạm** dạng `tiger42` (từ tiếng Anh dễ + 2 số): chỉ trả trong response đó, không lưu dạng đọc được, không ghi log.
- Thêm `helmet` cho mọi response.

## Frontend
- Feature `fe/src/features/auth/`:
  - Route `/login`, `/register` (bọc `GuestOnly`: đã đăng nhập thì chuyển về trang chủ).
  - Trang đăng ký: khi chọn "Giáo viên" có ghi chú cần quản trị viên duyệt.
  - Trang chủ theo vai trò (`homePathFor`): học sinh → `/home`, giáo viên/admin → `/teacher`.
  - `RequireAuth roles={[...]}` chặn route theo vai trò. Nếu `user.status === 'pending'` thì hiển thị `PendingApprovalPage` thay cho mọi màn hình, **không cần route riêng**. "Kiểm tra lại" gọi `refreshProfile()`; còn chờ thì báo nhẹ.
  - State: `useAuthStore` (Zustand + `persist`, key `enquiz-auth`) giữ `token`, `user` (có `status`). Đăng xuất thì xoá toàn bộ cache TanStack Query.
  - `app/bootstrap.ts` nối store với axios: gắn token mỗi request, gặp 401 thì `logout()`. Khi mở app, nếu có token cũ thì gọi lại `/users/profile` (cập nhật cả `status`).
- Feature `fe/src/features/admin/`, route `/admin/users` (`AdminUsersPage`, chỉ admin):
  - Tab **Chờ duyệt** (kèm số lượng) / **Giáo viên** / **Học sinh** / **Đã khoá** / **Tất cả**, ô tìm kiếm, phân trang 20 dòng.
  - Mỗi dòng: **✅ Duyệt** (tài khoản chờ), **🔒 Khoá** / **🔓 Mở khoá**, **🔑 Mật khẩu**. Khoá và cấp lại mật khẩu đều hỏi xác nhận.
  - Mật khẩu mới hiện một lần trong hộp thoại, có nút **📋 Chép**.
  - Dữ liệu qua TanStack Query, key `['admin', 'users', …]`.

## Quyết định thiết kế
- **Guard toàn cục, mở bằng `@Public()` / `@AllowPending()`** thay vì gắn guard từng controller: quên gắn thì endpoint bị khoá chứ không bị hở.
- **Duyệt giáo viên** thay vì mã mời trường: đơn giản khi chưa có khái niệm "trường"; admin biết ai được xem dữ liệu của trẻ.
- **Status không nằm trong JWT**: khoá tài khoản có hiệu lực ngay ở request tiếp theo, không phải chờ token hết hạn.
- **Học sinh quên mật khẩu → giáo viên cấp lại**, không qua email: trẻ tiểu học thường không có email. Đặt lại qua email cho giáo viên để Giai đoạn 4.
- `shared/api/http.ts` không import feature auth; token được "tiêm" qua `configureHttp` để giữ đúng quy tắc phụ thuộc feature-first.

## Kiểm thử
- `be/test/app.e2e-spec.ts` → nhóm `auth`: đăng ký, chặn admin, trùng tên, học sinh thiếu lớp, sai mật khẩu, route cần token. Giáo viên mới bị chặn 403 cho tới khi admin duyệt; admin xem được danh sách chờ duyệt; giáo viên không gọi được `/admin/users`.
- `be/test/phase3.e2e-spec.ts`: giáo viên cấp lại mật khẩu cho học sinh lớp mình và đăng nhập được bằng mật khẩu tạm; giáo viên khác → 404.

## Hướng mở rộng / còn tồn đọng
- Đặt lại mật khẩu qua email cho giáo viên; bắt đổi mật khẩu sau khi nhận mật khẩu tạm.
- Refresh token; ghi lịch sử đăng nhập / thao tác của admin.
- Cache status là theo từng tiến trình: chạy nhiều instance thì khoá tài khoản có thể trễ tối đa 30 giây ở instance khác.
