# Kiểm tra trước khi launch (4.0b)

> Ngày rà soát: 2026-11-21 · Phạm vi: toàn bộ `be/`, `fe/`, cấu hình deploy · Trạng thái: **A1–A6, B1–B4 đã làm** ([PR #6](https://github.com/huyvouit/enquiz/pull/6) đã merge vào `main` (merge commit `c4e9aa8`), xem [Kết quả](#kết-quả-a1a6-b1b4)); phần C làm cùng deploy

Rà theo 20 mục kiểm tra trước khi đưa một web app viết nhanh (có AI hỗ trợ) lên production. Mỗi mục ghi: hiện trạng, bằng chứng, việc cần làm. Mục **A** là code phải sửa trước khi launch; **B** nên làm trước khi launch; **C** là việc dựng và vận hành, làm cùng deploy.

Repo là **public**: tài liệu này và mọi commit không chứa ID project, tên site, tên bucket, chuỗi kết nối hay khoá.

## Tóm tắt

| # | Mục | Kết quả | Việc |
| --- | --- | --- | --- |
| 1 | `.env`, API key | Đạt | — |
| 2 | Phân quyền (Auth, RBAC, quyền sở hữu) | Đạt, còn 2 lỗ hổng nhỏ | A1 ✅, A2 ✅ |
| 3 | Injection, XSS, CSRF, open redirect, package lạ | Đạt | — |
| 4 | CORS, rate limit | Đạt một phần | A3 ✅, A4 ✅ |
| 5 | Validate đầu vào | Đạt, còn 1 chỗ | A5 ✅ |
| 6 | Edge case, trạng thái lỗi | Đạt một phần | B1 ✅ |
| 7 | Index, migration, backup | Index đạt; **chưa có backup** | C2 |
| 8 | Thanh toán, webhook | Không áp dụng | — |
| 9 | Ảnh, tài nguyên tĩnh | Đạt một phần | B2 ✅ |
| 10 | Core Web Vitals, cache | Cache đạt; chưa đo | C6 |
| 11 | Code thừa | Đạt (favicon mặc định của Vite đã thay ở B3) | — |
| 12 | Responsive | Đạt (đã chạy thử tablet, điện thoại, máy chiếu ở 4.2 và 5.x) | — |
| 13 | SEO, metadata | Thiếu | B3 ✅ |
| 14 | Loading, thông báo | Đạt | — |
| 15 | HTTPS, domain | Đạt (Firebase Hosting tự cấp HTTPS) | A6 ✅ (header bảo mật) |
| 16 | Biến môi trường production | Đạt | — |
| 17 | Theo dõi lỗi, analytics | Thiếu | C3 |
| 18 | Build, test | Đạt | — |
| 19 | Dependencies | Đạt, còn 1 cảnh báo | B4 ✅ |
| 20 | Rollback | Có hướng dẫn, chưa thử | C5 |

## Chi tiết

### 1. Bảo mật và quyền truy cập

**1. `.env` và key — Đạt**
- `.env`, `.env.*` nằm trong `.gitignore`; trong lịch sử git không có file `.env` nào.
- Frontend chỉ có `VITE_API_BASE_URL` và `VITE_LIVE_URL` (địa chỉ công khai), không có secret.
- Production: JWT, chuỗi kết nối Mongo, khoá Text-to-Speech nằm trong Secret Manager; lưu file dùng danh tính Cloud Run, không có khoá (D18).

**2. Phân quyền — Đạt, còn 2 lỗ hổng nhỏ**
- Mọi route đi qua `JwtAuthGuard` → `ActiveAccountGuard` (đọc trạng thái tài khoản mỗi request, tài khoản bị khoá bị chặn ngay) → `RolesGuard`. Chỉ 6 route công khai: health, đăng ký, đăng nhập, kiểm tra PIN, ảnh, âm thanh.
- Quyền sở hữu (IDOR) được kiểm tra ở handler cho mọi route có id: lớp, nhóm, học sinh, bài tập, thống kê và xuất file, câu hỏi, quiz, phiên chơi, bài kiểm tra, trận Đấu trường. Đáp án không lộ trước thời điểm cho phép (`toPlayQuestion`, `hideAnswers`, Đấu trường chỉ gửi đáp án ở pha công bố).
- **A1.** Tác giả một quiz đã chia sẻ xem được tên, username và điểm của **học sinh lớp khác** đã làm quiz đó (`GET progress/quiz/:quizId`, và `GET progress/attempts/:id`). Đây là dữ liệu trẻ em (Nghị định 13/2023). Sửa: tác giả chỉ thấy học sinh trong lớp mình dạy; admin thấy tất cả.
- **A2.** Đấu trường: lệnh điều khiển phòng (`host:start/next/end/kick`) chỉ dựa vào PIN đã gắn với socket, không kiểm tra lại người chủ phòng. Khi phòng cũ kết thúc và PIN được cấp lại cho phòng mới (trùng ngẫu nhiên), tab cũ của giáo viên khác điều khiển được phòng mới. Sửa: kiểm tra `room.hostId` ở mọi lệnh, xoá PIN khỏi socket khi phòng kết thúc.

**3. Injection, XSS, CSRF, open redirect — Đạt**
- NoSQL injection: mọi giá trị vào bộ lọc Mongo đều qua DTO (`IsString`, `IsMongoId`, `IsEnum`) hoặc `Types.ObjectId`; không có `$where`. Regex từ ô tìm kiếm đều qua `escapeRegex` (không ReDoS).
- XSS: frontend không dùng `dangerouslySetInnerHTML`, `innerHTML` hay `eval`; React tự escape. PDF/Excel xuất ra không chạy script.
- CSRF: API dùng `Authorization: Bearer`, không dùng cookie, nên trang khác không gửi request thay người dùng được.
- Open redirect: sau đăng nhập chỉ chuyển trong app (`location.state.from`, không đọc từ URL).
- Package: không có script cài đặt lạ; xem mục 19.
- Ghi chú: token lưu ở `localStorage`. An toàn khi không có XSS; header CSP ở A6 thêm một lớp chặn.

**4. CORS và rate limit — Đạt một phần**
- CORS: API chỉ nhận origin trong `CORS_ORIGIN`; socket chỉ nhận `LIVE_CORS_ORIGINS`.
- Rate limit có: đăng nhập/đăng ký (theo username và theo IP), sai PIN Đấu trường, khách vào phòng.
- **A3.** `POST classes/join` chưa giới hạn: một tài khoản học sinh dò được mã lớp (6 ký tự). Sửa: sai mã 10 lần/phút/tài khoản thì chặn, giống sai PIN.
- **A4.** Các route nặng chưa giới hạn: xuất PDF/Excel, nhập CSV, tạo âm thanh hàng loạt. Cloud Run chạy một máy (`max-instances=1`), nên một người bấm liên tục làm chậm cả hệ thống. Sửa: giới hạn theo tài khoản, ví dụ 20 lần/phút.

**5. Validate đầu vào — Đạt, còn 1 chỗ**
- `ValidationPipe` toàn cục với `whitelist` và `forbidNonWhitelisted`: trường lạ bị từ chối. Không DTO nào cho client đặt `createdBy`, `role`, `score`, `xp`. Đăng ký chỉ cho vai trò học sinh hoặc giáo viên.
- **A5.** Câu trả lời khi luyện tập (`studentAnswer`) nhận mọi kiểu dữ liệu, không giới hạn độ lớn (body tới 2 MB). Một học sinh gửi câu trả lời 2 MB cho mỗi câu thì phiên có thể vượt giới hạn 16 MB của Mongo và làm phình DB. Sửa: giới hạn kích thước (ví dụ 2 KB) và kiểu (chuỗi, mảng chuỗi, mảng cặp nối).

### 2. Dữ liệu và nghiệp vụ

**6. Edge case — Đạt một phần**
- Có trạng thái tải, rỗng, lỗi cho danh sách; nút gửi bị khoá khi đang gửi; nộp bài kiểm tra chỉ ghi một lần; Đấu trường chờ người rớt mạng 10 giây.
- **B1.** Chưa có error boundary: một lỗi render làm trắng trang. Sửa: thêm `errorElement` cho router, hiện "Có lỗi, tải lại trang" và nút về trang chủ.

**7. Database — Index đạt, chưa có backup**
- Index có cho các truy vấn chính (lớp theo giáo viên, bài tập theo lớp và học sinh, tiến độ theo học sinh và quiz, phiên kiểm tra, trận Đấu trường); TTL cho phiên chơi và trận đấu.
- Migration: không cần cho DB mới; `seed:content` và `create:admin` chạy lại an toàn.
- **C2.** Backup: cluster M0 không có backup tự động. Xem phần C.

**8. Thanh toán — Không áp dụng.** Gọi dịch vụ trả phí duy nhất là Text-to-Speech, chỉ admin gọi được, và âm thanh được lưu lại (không gọi lại).

### 3. Hiệu năng

**9. Ảnh và tài nguyên tĩnh — Đạt một phần**
- Ảnh upload giới hạn 1 MB, chỉ PNG/JPEG/WebP (kiểm tra chữ ký file). Âm thanh đặt tên theo hash, cache 1 năm. Trang nặng (Đấu trường, bài kiểm tra, báo cáo) tải riêng.
- **B2.** Ảnh câu hỏi chưa có `loading="lazy"`, và không được thu nhỏ trước khi upload. Sửa: thêm lazy loading; trình duyệt thu ảnh về tối đa 1280 px, nén WebP trước khi gửi.

**10. Core Web Vitals, cache — Cache đạt; chưa đo.** `/assets/**` cache 1 năm (tên file có hash), `index.html` no-cache. Bundle chính khoảng 318 kB (chưa nén). Đo bằng Lighthouse sau khi deploy (C6).

**11. Code thừa — Đạt.** Không có `console.log` trong code chạy (chỉ trong CLI và dòng khởi động); dữ liệu demo tắt ở production (`SEED_DEMO_DATA=false`); không có route thử nghiệm.

### 4. Giao diện và SEO

**12. Responsive — Đạt.** Đã chạy thử điện thoại, tablet, máy chiếu ở 4.2 và 5.x.

**13. SEO — Thiếu**
- **B3.** Chỉ có `<title>`. Thêm: meta description, Open Graph (ảnh và mô tả khi chia sẻ link Zalo/Facebook), `robots.txt` (cho phép trang chủ và đăng nhập, chặn các trang trong app), `sitemap.xml` với các trang công khai. App chủ yếu sau đăng nhập, nên SEO chỉ cần ở mức này.

**14. Loading và thông báo — Đạt.** Có spinner, toast thành công/lỗi, thông báo tiếng Việt cho mọi lỗi API.

### 5. Hạ tầng và vận hành

**15. HTTPS — Đạt.** Firebase Hosting tự cấp HTTPS và chuyển http sang https; Cloud Run chỉ HTTPS.
- **A6.** Frontend chưa có header bảo mật. Thêm trong `fe/firebase.json`: `Content-Security-Policy` (chỉ cho tải script từ chính site; font Google; ảnh và âm thanh từ Cloud Storage; kết nối tới API và Cloud Run), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, chặn nhúng trang vào iframe. API đã có `helmet`.

**16. Biến môi trường production — Đạt.** `SEED_DEMO_DATA=false`, `NODE_ENV=production` trong image, CORS chỉ domain thật, `TRUST_PROXY` kiểm tra ở bước 6 của `deploy.md`. Lỗi 500 trả thông báo chung, không lộ stack trace.

**17. Theo dõi lỗi, analytics — Thiếu**
- **C3.** Bật Cloud Error Reporting (tự đọc lỗi trong log Cloud Run, miễn phí), uptime check `/api/v1/health` và cảnh báo qua email. Sentry để sau (cần tài khoản, phải lọc tên và đáp án học sinh).
- Analytics: **không** gắn công cụ theo dõi bên thứ ba vì người dùng là trẻ em (Nghị định 13/2023). Dùng số liệu sẵn có của Cloud Run và Firebase Hosting.

**18. Build và test — Đạt.** CI chạy lint, prettier, unit, e2e, build be/fe và image Docker cho mọi PR.

**19. Dependencies — Đạt, còn 1 cảnh báo**
- Frontend: 0 lỗ hổng. Backend: 2 cảnh báo mức trung bình từ `uuid@8` nằm trong `exceljs`. Lỗi chỉ xảy ra khi gọi `uuid` với tham số `buf`, `exceljs` không gọi như vậy.
- **B4.** Ép `uuid` lên bản đã sửa bằng `overrides` trong `be/package.json`, chạy lại test xuất Excel.

**20. Rollback — Có hướng dẫn, chưa thử.**
- **C5.** Sau lần deploy đầu, thử quay lại revision trước một lần (`deploy.md`, mục Cập nhật và rollback).

## Phần C: việc dựng và vận hành (làm cùng deploy)

- **C1. Cảnh báo ngân sách:** Billing → Budgets & alerts, đặt ngưỡng (ví dụ 10 USD/tháng) gửi email ở 50%, 90%, 100%. Quan trọng vì Đấu trường bật thì tính phí theo giờ.
- **C2. Backup Atlas:** chạy `mongodump` định kỳ (script và lịch), hoặc nâng gói có backup.
- **C3.** Error Reporting, uptime check, cảnh báo email (xem mục 17).
- **C4. Đổi mật khẩu DB dev** (đã nhắc trước đây) và giữ DB production tách riêng.
- **C5.** Thử rollback một lần.
- **C6.** Lighthouse trên điện thoại cho trang đăng nhập, bản đồ, màn chơi.
- **C7.** Đồng ý của phụ huynh (Nghị định 13/2023): chặn việc mở cho trường thật, không chặn bản thử nghiệm.

## Thứ tự đề xuất

1. Sửa A1–A6 và B1–B4 trên một nhánh, kèm test; PR như các mốc trước.
2. Deploy theo `deploy.md`, rồi làm C1, C3 ngay trong ngày deploy.
3. Chạy mục 6 của `deploy.md`, C5, C6.
4. C2 trước khi có dữ liệu thật của học sinh.

## Kết quả A1–A6, B1–B4

> Ngày: 2026-11-21 · [PR #6](https://github.com/huyvouit/enquiz/pull/6) đã merge vào `main` (merge commit `c4e9aa8`) · Trạng thái: **code xong**, chờ deploy để chạy bước 9 của `deploy.md` mục 6

**Đã làm**

| Mục | Việc | File chính |
| --- | --- | --- |
| A1 | Kết quả quiz và bài làm: tác giả quiz chỉ thấy học sinh trong các lớp mình dạy (kể cả lớp đã lưu trữ); admin thấy tất cả. Query mới `TaughtStudentIdsQuery` | `get-quiz-results.handler.ts`, `get-attempt.handler.ts`, `class-membership.*` |
| A2 | Socket gắn với cả PIN và mã trận; mọi lệnh điều khiển phòng kiểm tra lại chủ phòng; phòng socket.io đặt tên theo mã trận, nên PIN cấp lại không gửi nhầm dữ liệu sang tab cũ | `live.gateway.ts` |
| A3 | Sai mã lớp 10 lần/phút/tài khoản thì chặn (429) | `class-roster.handlers.ts` |
| A4 | Decorator `@RateLimit` theo tài khoản: xuất PDF/Excel 20/phút, nhập CSV 10/phút, tạo âm thanh 10/phút, upload ảnh 30/phút, mở phòng Đấu trường 10/phút. Bộ đếm dùng chung chuyển sang `common/rate-limit/` | `common/rate-limit/*`, các controller |
| A5 | Câu trả lời luyện tập: tối đa 20 KB ở DTO; chỉ lưu dạng hợp lệ (chuỗi, danh sách chuỗi, danh sách cặp nối, có giới hạn độ dài), dạng khác lưu là `null` và tính sai. Hàm `cleanAnswer` dùng chung với bài kiểm tra | `session.dto.ts`, `answer-question.handler.ts`, `progress/grading/clean-answer.ts` |
| A6 | Header cho frontend: CSP (script chỉ từ site; font Google; ảnh `https:`; âm thanh từ Cloud Storage; kết nối tới `*.run.app` cho Đấu trường; worker `blob:` cho pháo giấy), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | `fe/firebase.json` |
| B1 | Trang báo lỗi cho mọi route thay vì trắng trang; sau khi deploy bản mới, tab cũ thiếu file trang thì tự tải lại một lần (không lặp) | `RouteError.tsx`, `chunk-reload.ts`, `router.tsx` |
| B2 | Ảnh được thu về tối đa 1280 px, nén WebP ngay trên trình duyệt trước khi upload (nhận ảnh gốc tới 15 MB); ảnh trong kho câu hỏi tải lazy | `shared/lib/shrink-image.ts`, `MediaEditor.tsx`, `QuestionPreview.tsx` |
| B3 | Meta description, Open Graph (ảnh 1200×630), icon iPhone, favicon EnQuiz (thay logo mặc định của Vite). `robots.txt` và `sitemap.xml` sinh lúc build từ `VITE_SITE_URL`, nên địa chỉ thật không nằm trong repo | `index.html`, `seo.plugin.ts`, `public/*` |
| B4 | `uuid` trong `exceljs` ép lên 11.1.1 (`overrides`) | `be/package.json` |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **113 unit** test pass; **89 e2e** test pass (7 mới trong `test/launch.e2e-spec.ts`, mỗi lỗ hổng một test). Test A2 đã thử ngược: bỏ phần sửa thì test báo lỗi. Build thành công.
- Frontend: `tsc`, lint, build sạch.
- `npm audit --omit=dev`: 0 lỗ hổng ở cả `be/` và `fe/`.
- **Trình duyệt** (Edge headless, bản build chạy với đúng header của `firebase.json`, DB tạm):
  - đăng nhập, bản đồ, màn chơi, 404, kho câu hỏi, soạn câu hỏi, Đấu trường từ phòng chờ tới bục vinh quang (có pháo giấy): không có lỗi console, không có vi phạm CSP;
  - ảnh gốc 8,6 MB được lưu thành WebP 1280 px, 571 KB (ảnh thử là nhiễu ngẫu nhiên, khó nén nhất);
  - giả lập vừa deploy bản mới (file trang bị xoá): tải lại đúng một lần rồi hiện trang báo lỗi.
- **CI trên PR #6 và trên `main` sau khi merge:** xanh cả 3 job (backend, frontend, docker).
- **Chưa kiểm tra:** header thật trên Firebase Hosting và xem trước link trên Zalo/Messenger (bước 9 của `deploy.md` mục 6).

**Phát hiện thêm trong lúc làm**
- Favicon vẫn là logo mặc định của Vite (mục 11): đã thay.
- Giáo viên được dán link ảnh `https://` bất kỳ, nên CSP phải cho ảnh `https:`. Ảnh không chạy được script, nên rủi ro thấp.

