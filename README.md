# EnQuiz – Vừa học vừa chơi tiếng Anh

Nền tảng web học tiếng Anh dạng trò chơi cho học sinh tiểu học (6–11 tuổi), có giáo viên quản lý ra đề.

| Thư mục | Nội dung |
| --- | --- |
| [`be/`](be/) | Backend – NestJS 12 + MongoDB (Mongoose 9), kiến trúc **CQRS** |
| [`fe/`](fe/) | Frontend – React 19 + Vite 8 + TailwindCSS 4 + Framer Motion + Zustand, tổ chức **feature-first** |
| [`docs/`](docs/) | Tài liệu từng tính năng + lộ trình |

**Trạng thái:** ✅ Giai đoạn 1 (MVP), ✅ Giai đoạn 2 (gamification) và ✅ Giai đoạn 3 (lớp học, bài tập về nhà, thống kê cho giáo viên, dạng câu hỏi mới, nhập CSV) đã xong. Xem [docs/roadmap.md](docs/roadmap.md) và [kế hoạch giai đoạn 3](docs/phase-3-plan.md).

> **Nâng cấp database đang có dữ liệu** (chạy một lần, theo thứ tự; an toàn khi chạy lại):
> - Từ giai đoạn 1: `cd be && npm run migrate:phase2` (xoá sao/kim cương/avatar, tính lại cấp và XP).
> - Lên giai đoạn 3: `npm run migrate:phase3` (thêm `-- --dry-run` để xem trước). Script in ra các quiz giáo viên **rời khỏi bản đồ** để giao lại cho lớp.
> - Nội dung chuẩn (tuỳ chọn): `npm run seed:content` nạp 48 câu / 8 trạm mẫu cho lớp 1–5 ([06](docs/features/06-demo-seed.md)).

---

## 1. Chạy dự án

Yêu cầu: **Node.js ≥ 22** và **npm ≥ 11**. npm 10 bị lỗi `Cannot read properties of null (reading 'edgesOut')` với cây dependency này; nếu máy đang dùng npm 10 thì chạy `npx npm@11 install` thay cho `npm install`, hoặc nâng cấp bằng `npm i -g npm@11`.

```bash
# Backend (cổng 3000)
cd be
cp .env.example .env        # rồi sửa MONGODB_URI, JWT_SECRET
npm install
npm run start:dev

# Frontend (cổng 5173), ở terminal khác
cd fe
cp .env.example .env
npm install
npm run dev
```

Mở http://localhost:5173. Ở chế độ dev, frontend gọi `/api/...` và Vite proxy sang `localhost:3000`, nên không cần cấu hình CORS.

**Chưa có MongoDB?** Đặt `MONGODB_URI=memory` trong `be/.env` để chạy một MongoDB tạm trong bộ nhớ (mất dữ liệu khi tắt server; chỉ dùng cho dev/demo).

### Tài khoản demo

Khi `SEED_DEMO_DATA=true` và database **chưa có user nào**, backend tự tạo dữ liệu mẫu (5 quiz, 23 câu hỏi):

| Vai trò | Tên đăng nhập | Mật khẩu |
| --- | --- | --- |
| Quản trị | `admin` | `admin123` |
| Giáo viên (đã duyệt) | `teacher` | `teacher123` |
| Học sinh (lớp 1) | `student` | `student123` |

> ⚠️ Môi trường thật: đặt `SEED_DEMO_DATA=false` và đổi/xoá các tài khoản demo.
>
> Giáo viên **tự đăng ký** phải chờ admin duyệt ở `/admin/users` mới tạo được lớp, quiz, câu hỏi. Học sinh lớp nhỏ thường do giáo viên **tạo tài khoản hàng loạt** trong trang lớp (in thẻ đăng nhập).

### Kiểm thử

```bash
cd be
npm test            # unit test (chấm điểm, tiến độ, bài tập, thống kê, CSV...)
npm run test:e2e    # toàn bộ luồng API trên MongoDB in-memory, không đụng DB thật
npm run lint
cd ../fe
npm run build       # type-check + build
npm run lint
```

---

## 2. Quy tắc chung (bắt buộc)

### 2.1 Tài liệu
- **Mỗi tính năng có 1 file** trong [`docs/features/`](docs/features/), đánh số theo thứ tự làm, theo mẫu [`_TEMPLATE.md`](docs/features/_TEMPLATE.md).
- Sửa code của tính năng nào thì **cập nhật doc của tính năng đó trong cùng commit/PR** (endpoint, quy tắc nghiệp vụ, quyết định thiết kế).
- Quy tắc dùng chung cho cả dự án thì ghi ở README này, không lặp lại trong doc tính năng.
- Lộ trình và việc còn tồn đọng ghi ở [`docs/roadmap.md`](docs/roadmap.md).

### 2.2 Ngôn ngữ
- Code, tên biến, tên file, commit message: **tiếng Anh**.
- Chữ hiển thị cho người dùng và thông báo lỗi API: **tiếng Việt** (giọng thân thiện với trẻ em ở phía học sinh).
- Tài liệu trong `docs/`: tiếng Việt.

### 2.3 Hợp đồng API
- Tiền tố: `/api/v1`. REST, JSON.
- Thành công: `{ "success": true, "data": ... }` — bọc tự động bởi `ResponseInterceptor`.
- Lỗi: `{ "success": false, "statusCode": 400, "message": "…", "errors"?: ["…"] }` — chuẩn hoá bởi `HttpExceptionFilter`. `message` luôn là một câu đọc được, hiển thị thẳng cho người dùng.
- Mã lỗi: 400 dữ liệu sai · 401 chưa đăng nhập/token hết hạn · 403 sai vai trò · 404 không tồn tại **hoặc không có quyền xem** (không để lộ tài nguyên của người khác) · 409 xung đột.
- **Mặc định mọi endpoint đều cần JWT.** Endpoint công khai phải gắn `@Public()`. Giới hạn vai trò dùng `@Roles(...)`.
- Tài khoản phải ở trạng thái `active` (`ActiveAccountGuard` chạy sau JWT): `disabled` → 401, giáo viên `pending` → 403 trừ endpoint có `@AllowPending()`.
- Tải file (Excel/PDF/CSV) trả `StreamableFile`: đi thẳng, **không** bọc `{ success, data }`.
- **Đáp án của một câu chỉ gửi cho học sinh sau khi học sinh đã trả lời câu đó** (và câu trả lời đã bị khoá). Việc chấm điểm luôn làm ở server.
- Quy tắc tiến độ (khoá trạm, cấp, XP) luôn được kiểm tra ở server; frontend chỉ hiển thị.
- **Trạng thái bài tập và mọi số liệu thống kê được tính lúc đọc** từ `student_progress` (không lưu bản sao có thể lệch). File xuất và màn hình dùng **cùng một query**.
- Thời gian lưu UTC; hiển thị và nhập theo **giờ Việt Nam** (`be/src/common/utils/vn-time.ts`).
- Kiểu dữ liệu ở `fe/src/features/*/types.ts` phải khớp với mapper/DTO ở backend. Đổi một bên thì đổi cả bên kia.

### 2.4 Backend (NestJS – CQRS)
- Mỗi tính năng là một module trong `be/src/modules/<feature>/`:
  ```
  <feature>/
  ├── commands/impl|handlers   # GHI: thay đổi dữ liệu
  ├── queries/impl|handlers    # ĐỌC: không đổi dữ liệu, dùng .lean()
  ├── events/impl|handlers     # Sự kiện miền (side-effect)
  ├── dto/                     # class-validator, validate input
  ├── schemas/                 # Mongoose schema
  ├── <feature>.mapper.ts      # document -> dạng trả về API
  ├── <feature>.controller.ts  # chỉ gọi CommandBus/QueryBus, không chứa logic
  └── <feature>.module.ts
  ```
- Command/Query kế thừa `Command<TResult>` / `Query<TResult>` để kiểu kết quả được suy ra.
- Controller **không** chứa logic nghiệp vụ; handler không trả document Mongoose thô mà luôn đi qua mapper.
- Module khác cần dữ liệu của nhau: import module (đã `exports: [MongooseModule]`) để đọc model, hoặc gọi qua `QueryBus` khi muốn tách rời hẳn (ví dụ `CountQuizzesUsingQuestionQuery`).
- Mọi `@Prop` ghi rõ `type` (dự án build bằng công cụ không phát sinh đủ metadata kiểu).
- Dự án là **ESM**: import tương đối phải có đuôi `.js`; test dùng Vitest (`vi.fn()`).
- Giữ kiểm tra quyền sở hữu ở handler (`assertCanModify`): giáo viên chỉ sửa/xoá nội dung mình tạo, admin sửa được tất cả, nội dung hệ thống (`createdBy = null`) chỉ admin sửa.
- **Dữ liệu học sinh** mà giáo viên xem được (kể cả file xuất) phải đi qua kiểm tra lớp: `ClassAccessQuery(classId, user, 'manage')` hoặc `TeachesStudentQuery`. Thiếu kiểm tra → trả 404.
- Module tránh phụ thuộc vòng: module "phía trên" import module "phía dưới" (`analytics → assignments → classes/progress/quizzes`); chiều ngược lại chỉ đi qua `QueryBus` (ví dụ `AssignedQuizIdsQuery`, `AssignmentPlayAccessQuery`).
- Logic thuần (chấm điểm, validate nội dung câu hỏi) có unit test `*.spec.ts`; mỗi luồng API mới thêm vào `test/app.e2e-spec.ts`.

### 2.5 Frontend (React – feature-first)
```
fe/src/
├── app/        # Router, layout, bootstrap — nơi DUY NHẤT ghép các feature lại
├── shared/     # Dùng chung, KHÔNG import từ features/
│   ├── api/        # axios instance (http.ts), kiểu dùng chung
│   ├── components/ # Button, Card, Modal, Mascot, Form...
│   └── lib/        # tiện ích thuần
└── features/<feature>/
    ├── api/        # gọi API của feature
    ├── components/ # UI riêng của feature
    ├── hooks/      # queries.ts: query key, hook TanStack, invalidate…()
    ├── store/ lib/
    ├── pages/      # màn hình gắn vào route
    ├── types.ts
    └── index.ts    # PUBLIC API — feature khác chỉ được import từ đây
```
- Feature A dùng feature B: `import { X } from '@/features/b'`, **không** import sâu vào file bên trong B. Ngoại lệ duy nhất: `app/router.tsx` import thẳng file trang (`features/x/pages/...`) để lazy-load tách bundle.
- Tránh import vòng giữa các feature (hiện tại: `play → progress, assignments`, `progress → classes`, `quizzes → questions, progress, assignments, classes`, `assignments → classes`, `analytics → classes`; `classes` chỉ dùng `auth` và `shared`).
- Gọi API qua `api.get/post/put/delete` trong `shared/api/http.ts` (đã gắn token, bóc `data`, đổi lỗi thành `ApiError` có `message` tiếng Việt).
- Trạng thái toàn cục dùng **Zustand** (`features/*/store`). Dữ liệu server: mọi màn hình dùng **TanStack Query** (`shared/api/query-client.ts`). Mỗi feature khai báo query key trong `hooks/queries.ts` (key bắt đầu bằng tên feature, ví dụ `['classes', id]`) kèm hàm `invalidate…()`; **mọi thao tác ghi phải gọi `invalidate…()`** của các feature bị ảnh hưởng (ví dụ nộp bài → `invalidateProgress()` + `invalidateAssignments()`). Form sửa dữ liệu nạp chi tiết với `gcTime: 0` để không khởi tạo từ bản cache cũ. Đăng xuất xoá toàn bộ cache.
- Tính năng gắn vào trang của feature khác qua **props/tab do `app/` truyền vào** (ví dụ tab Bài tập, Thống kê trong trang lớp: `ClassTabProps`), không import ngược.
- Tải file dùng `downloadFile(url, params)`; upload dùng `api.upload(url, field, file)` (`shared/api/http.ts`).
- Style bằng Tailwind với **token màu ở `src/index.css`** (`bg-brand`, `text-ink`, `bg-sunny-soft`...), không viết mã màu rời rạc.
- Giao diện cho học sinh: chữ to, nút lớn (≥ 44px), thao tác **chạm** (không phụ thuộc kéo thả/hover) để dùng tốt trên máy tính bảng; hiệu ứng bằng Framer Motion, tôn trọng `prefers-reduced-motion`.
- Âm thanh luôn phát qua `playSfx(...)` (`shared/sound`) để tôn trọng nút tắt tiếng; khi học sinh sai: âm nhẹ + lời động viên, không trách.
- Không có tiền tệ ảo (sao, kim cương), avatar hay cửa hàng — động lực đến từ **cấp độ, mở khoá bản đồ và bảng xếp hạng** (quyết định giai đoạn 2).
- **Họ tên đầy đủ** của học sinh chỉ hiện trong phạm vi lớp; ngoài lớp (bảng xếp hạng toàn khối) dùng tên rút gọn ("Anh N.").
- TypeScript bật `erasableSyntaxOnly`: dùng union string thay cho `enum`.

### 2.6 Bảo mật & cấu hình
- **Không commit file `.env`** (đã có trong `.gitignore`). Mỗi biến mới phải thêm vào `.env.example` kèm chú thích và vào `be/src/config/env.validation.ts`.
- `JWT_SECRET` ≥ 16 ký tự, ngẫu nhiên. Mật khẩu băm bằng bcrypt; trường `password` có `select: false`.
- Không tự đăng ký được vai trò `admin`. Giáo viên tự đăng ký ở trạng thái **chờ duyệt**.
- Đăng nhập/đăng ký bị giới hạn `AUTH_RATE_LIMIT` lần/phút/username và `AUTH_IP_RATE_LIMIT` lần/phút/IP (429); sau proxy phải đặt đúng `TRUST_PROXY`. `helmet` bật cho mọi response.
- **Mật khẩu tạm** (tạo hàng loạt, đặt lại) chỉ trả về **một lần**, không lưu dạng rõ, không ghi log.
- File upload: kiểm tra **chữ ký file** (không tin đuôi), tối đa 1 MB, chỉ PNG/JPG/WebP; chỉ phục vụ key dạng `<uuid>.<ext>`.
- Xem xét yêu cầu đồng ý của phụ huynh theo Nghị định 13/2023/NĐ-CP trước khi dùng thật ở trường.

### 2.7 Git
- Nhánh: `feature/<tên>`, `fix/<tên>`. Commit theo Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Trước khi tạo PR: `lint`, `test`, `test:e2e` (be) và `build`, `lint` (fe) đều phải qua.

---

## 3. Danh sách tính năng

| # | Tính năng | Giai đoạn | Tài liệu |
| --- | --- | --- | --- |
| 01 | Đăng ký, đăng nhập, phân quyền, duyệt giáo viên | 1, 3 | [01-auth.md](docs/features/01-auth.md) |
| 02 | Kho câu hỏi (4 dạng, câu nghe, ảnh) | 1, 3 | [02-question-bank.md](docs/features/02-question-bank.md) |
| 03 | Tạo & quản lý quiz | 1, 3 | [03-quiz-builder.md](docs/features/03-quiz-builder.md) |
| 04 | Chơi quiz (phiên chơi, phản hồi tức thì) | 1–2 | [04-play-quiz.md](docs/features/04-play-quiz.md) |
| 05 | Kết quả, lịch sử, báo cáo giáo viên | 1–2 | [05-progress-results.md](docs/features/05-progress-results.md) |
| 06 | Dữ liệu demo (seed) | 1 | [06-demo-seed.md](docs/features/06-demo-seed.md) |
| 07 | Cấp độ, XP & mở khoá bản đồ | 2, 3 | [07-progression-quest-map.md](docs/features/07-progression-quest-map.md) |
| 08 | Bảng xếp hạng (lớp / toàn khối) | 2, 3 | [08-leaderboard.md](docs/features/08-leaderboard.md) |
| 09 | Âm thanh & hiệu ứng | 2 | [09-sound-and-effects.md](docs/features/09-sound-and-effects.md) |
| 10 | Lớp học, nhóm, tài khoản học sinh | 3 | [10-classes.md](docs/features/10-classes.md) |
| 11 | Bài tập về nhà & hạn chót, nhắc nhở | 3 | [11-assignments.md](docs/features/11-assignments.md) |
| 12 | Thống kê & phân tích cho giáo viên, xuất Excel/PDF | 3 | [12-teacher-analytics.md](docs/features/12-teacher-analytics.md) |
| 13 | Nhập câu hỏi từ CSV, nội dung chuẩn | 3 | [13-question-import.md](docs/features/13-question-import.md) |
