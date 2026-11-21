# EnQuiz – Frontend

React 19 · Vite 8 · TypeScript · TailwindCSS 4 · Framer Motion · Zustand · TanStack Query · React Router 7 · Axios.

Quy tắc chung (cấu trúc feature-first, quy tắc import, style), cách chạy: xem [README gốc](../README.md). Chi tiết từng tính năng: [`../docs/features/`](../docs/features/).

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Dev server http://localhost:5173 (proxy `/api` → `localhost:3000`) |
| `npm run build` | Type-check + build ra `dist/` |
| `npm run preview` | Xem bản build |
| `npm run lint` | oxlint |

## Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api/v1` | URL API. Dev giữ mặc định (qua proxy); production cũng giữ `/api/v1` (Firebase Hosting chuyển sang Cloud Run) |
| `VITE_LIVE_URL` | rỗng | Socket Đấu trường. Dev để rỗng (qua proxy); production là URL Cloud Run (D19) |
| `VITE_SITE_URL` | rỗng | Chỉ dùng lúc build: địa chỉ site cho link Open Graph và `sitemap.xml` (`seo.plugin.ts`). Để rỗng khi dev |

## Cấu trúc

```
src/
├── app/          # router, layout, bootstrap (nối các feature)
├── shared/       # api (axios, query-client), components, hooks, lib, sound (09), speech (TTS), live (socket Đấu trường, 15) — không import features/
└── features/
    ├── auth/        # 01 – đăng nhập, đăng ký, guard route, màn chờ duyệt
    ├── admin/       # 01, 07 – duyệt/khoá tài khoản, thứ tự trạm bản đồ
    ├── questions/   # 02, 13 – kho câu hỏi (4 dạng, ảnh, câu nghe), nhập CSV
    ├── quizzes/     # 03 – tạo quiz, dashboard giáo viên, bản đồ học sinh
    ├── play/        # 04 – màn chơi (phiên chơi, phản hồi tức thì, bài tập)
    ├── progress/    # 05, 07, 08 – kết quả, lịch sử, bản đồ, xếp hạng
    ├── classes/     # 10 – lớp học, nhóm, tạo học sinh hàng loạt, vào lớp bằng mã
    ├── assignments/ # 11 – giao bài, nhắc nhở, bài tập của em
    ├── exam/        # 14 – phòng thi: đồng hồ, đánh dấu, rà soát, nộp bài
    └── analytics/   # 12 – thống kê, bản đồ nhiệt, báo cáo, xuất file
```

Import alias: `@/` = `src/` (ví dụ `import { Button } from '@/shared/components'`).

## Routes

| Route | Vai trò | Màn hình |
| --- | --- | --- |
| `/login`, `/register` | Khách | Đăng nhập / đăng ký |
| `/home` | Học sinh | Bản đồ thử thách |
| `/assignments` | Học sinh | Bài tập của em |
| `/history` | Học sinh | Bài đã làm |
| `/leaderboard` | Mọi vai trò | Bảng xếp hạng |
| `/play/:quizId` | Mọi vai trò | Chơi quiz (giáo viên: xem thử) |
| `/exam/:assignmentId` | Học sinh | Bài kiểm tra: giới thiệu → phòng thi → kết quả (toàn màn hình, ngoài `AppLayout`) |
| `/live`, `/live/play` | Công khai (học sinh, khách) | Đấu trường: nhập PIN/biệt danh → màn chơi (ngoài `AppLayout`) |
| `/teacher/live`, `/teacher/live/new`, `/teacher/live/:matchId` | Giáo viên/Admin | Đấu trường: lịch sử, mở phòng, báo cáo trận |
| `/teacher/live/:matchId/host` | Giáo viên/Admin | Màn chiếu trận đấu (toàn màn hình, ngoài `AppLayout`) |
| `/attempts/:attemptId` | Học sinh / giáo viên | Kết quả & xem lại |
| `/teacher` | Giáo viên/Admin | Dashboard quiz |
| `/teacher/questions[/new\|/:id/edit]` | Giáo viên/Admin | Kho câu hỏi |
| `/teacher/quizzes/new`, `/teacher/quizzes/:id/edit` | Giáo viên/Admin | Tạo/sửa quiz |
| `/teacher/quizzes/:quizId/results` | Giáo viên/Admin | Kết quả của quiz |
| `/teacher/classes`, `/teacher/classes/:classId?tab=students\|groups\|assignments\|analytics` | Giáo viên/Admin | Lớp học (các tab) |
| `/teacher/classes/:classId/students/:studentId` | Giáo viên/Admin | Báo cáo tiến độ một học sinh |
| `/teacher/assignments/:assignmentId` | Giáo viên/Admin | Kết quả bài tập + bản đồ nhiệt câu hỏi |
| `/teacher/questions/import` | Giáo viên/Admin | Nhập câu hỏi từ CSV |
| `/admin/users`, `/admin/map` | Admin | Tài khoản, thứ tự trạm bản đồ |

Trang giáo viên/admin được **lazy-load** (`app/router.tsx` import thẳng file trang để tách bundle).
