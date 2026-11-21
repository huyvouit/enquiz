# Kế hoạch Giai đoạn 6 – Bảo mật Auth, PWA & Quản lý phiên bản

> Trạng thái: **Đã chốt quyết định** D21–D25 (2026-11-21) · Bắt đầu từ 6.5 · Lập: 2026-11-21 · Xem [roadmap](roadmap.md)
>
> Giai đoạn 4.0 đã đóng và production đang chạy ([phase-4-plan.md](phase-4-plan.md#kết-quả-vận-hành-phần-c-của-launch-checklist-và-đóng-40)). Giai đoạn 4.3 (UX & thao tác giáo viên) vẫn **tạm hoãn**. Các thay đổi đã merge nhưng chưa deploy (log JSON cho Error Reporting, link có gạch chân) sẽ lên production cùng bản phát hành có số phiên bản đầu tiên (6.5).

Tài liệu này ghép:
- 6.1–6.4 trong roadmap, và 6.5 (quản lý phiên bản deploy) thêm ngày 2026-11-21;
- yêu cầu của chủ dự án: **mỗi lần deploy đều phải được xác nhận**;
- những gì code và hạ tầng hiện có cho phép hoặc ràng buộc (JWT 7 ngày trong `localStorage`, D20 `passwordChangedAt`, socket Đấu trường đi thẳng vào Cloud Run, Firebase Hosting chỉ chuyển cookie `__session`, tổ chức Google Cloud chặn khoá tài khoản dịch vụ).

---

## 1. Mục tiêu

| Mốc | Người dùng thấy gì | Vì sao cần |
| --- | --- | --- |
| 6.5 Phiên bản deploy | Chân trang ghi `EnQuiz v1.2.0`; giáo viên biết đang dùng bản nào khi báo lỗi | Biết production đang chạy gì, quay lại đúng bản, chỉ deploy khi chủ dự án đồng ý |
| 6.1 Token | Không phải đăng nhập lại mỗi tuần; máy dùng chung không giữ phiên lâu | Token 7 ngày trong `localStorage` bị lộ là dùng được cả tuần; không có cách thu hồi từng phiên |
| 6.3 PWA | Cài EnQuiz lên màn hình tablet như một ứng dụng; mở nhanh; ảnh và âm thanh đã tải không tải lại | Trường dùng tablet và Wi-Fi chậm |
| 6.4 Cập nhật | "Có bản mới – Cập nhật" thay vì lỗi lạ sau mỗi lần deploy; bản quá cũ bị ép cập nhật | Service worker giữ bản cũ; cần cách đưa người dùng lên bản mới an toàn |
| 6.2 Google | Giáo viên bấm "Đăng nhập bằng Google" | Giáo viên đỡ nhớ mật khẩu; trường dùng Google Workspace |

## 2. Hiện trạng liên quan

| Hiện có | Hệ quả cho giai đoạn 6 |
| --- | --- |
| JWT 7 ngày (`JWT_EXPIRES_IN`), lưu `localStorage` (`enquiz-auth`); 401 → frontend đăng xuất | 6.1 thay bằng access token ngắn trong RAM + refresh token trong cookie HttpOnly |
| D20: `passwordChangedAt`, token cũ bị từ chối ở guard và socket | Giữ nguyên; đổi/đặt lại mật khẩu còn thu hồi luôn refresh token |
| Socket Đấu trường gửi JWT lúc bắt tay (`connectLive(token)`), đi thẳng tới `*.run.app` | Cookie của site không tới được Cloud Run trực tiếp: socket vẫn dùng access token; khi nối lại phải lấy token mới |
| Firebase Hosting chỉ chuyển tiếp cookie tên `__session` sang Cloud Run | Refresh cookie bắt buộc tên `__session` |
| CSP (A6): `script-src 'self'`, `connect-src 'self' *.run.app`, `worker-src 'self' blob:` | 6.2 phải mở thêm Google Identity Services; 6.3 service worker nằm trong `'self'` |
| B1: trang lỗi + tự tải lại một lần khi thiếu file sau deploy | 6.4 thay bằng cơ chế cập nhật chủ động; giữ B1 làm lưới an toàn |
| Deploy bằng tay theo `deploy.md`; image tag = commit ngắn; `version` trong `package.json` là `0.0.0`/`0.0.1` | 6.5 đặt một nguồn số phiên bản duy nhất |
| Tổ chức Google Cloud chặn khoá tài khoản dịch vụ | Deploy tự động từ GitHub (nếu chọn) phải dùng Workload Identity Federation, không dùng khoá JSON |
| Học sinh 6–11 tuổi, nhiều em dùng **tablet chung** của trường | Không lưu dữ liệu API trong cache trình duyệt; phiên trên máy chung phải ngắn |
| Users không có trường email | 6.2 cần thêm `email` (đã xác minh bởi Google) và `googleSub` |

## 3. Quyết định

### D21. Phiên bản và phát hành (6.5) – **đã chốt**
- **Một số phiên bản cho cả hệ thống**, dạng SemVer `MAJOR.MINOR.PATCH`, ghi trong file `VERSION` ở gốc repo. Bản phát hành đầu tiên: **`v1.0.0`** (gồm mọi thứ đã có trên `main`, kể cả PR #10 chưa deploy).
  - MINOR: tính năng mới (6.1, 6.3…). PATCH: sửa lỗi. MAJOR: thay đổi làm hỏng dữ liệu hoặc API cũ.
- **Mỗi phiên bản gắn với:**
  - git tag `vX.Y.Z` trên `main`;
  - image Cloud Run tag `X.Y.Z` (giữ thêm tag commit ngắn);
  - Cloud Run revision có **tag** `v1-2-0`, cho một URL thử riêng trước khi nhận traffic;
  - Firebase Hosting: deploy vào **kênh xem trước** `v1-2-0` (URL riêng), rồi mới đưa lên site chính;
  - `CHANGELOG.md`: mỗi phiên bản liệt kê thay đổi người dùng thấy được, PR liên quan, việc cần làm khi deploy (biến môi trường mới, migrate).
- **Hiện số phiên bản:**
  - Backend: `/api/v1/health` trả thêm `{ version, commit }` (biến môi trường lúc build).
  - Frontend: chân trang `EnQuiz vX.Y.Z`, nhúng lúc build (`VITE_APP_VERSION`).
- **Quy trình phát hành (bắt buộc xác nhận):**
  1. Chuẩn bị: tăng `VERSION`, viết `CHANGELOG.md`, PR, merge.
  2. Build và deploy **không nhận traffic**: Cloud Run `--no-traffic --tag v1-2-0`; Firebase kênh xem trước.
  3. Kiểm tra trên hai URL thử (health có đúng phiên bản, đăng nhập, một luồng chính).
  4. **Hỏi chủ dự án**, kèm CHANGELOG và URL thử. Chỉ khi được đồng ý mới chuyển traffic Cloud Run sang revision mới và đưa kênh xem trước lên site chính.
  5. Gắn git tag, ghi kết quả.
- **Rollback theo phiên bản:** Cloud Run chuyển traffic về revision có tag phiên bản trước; Firebase đưa phiên bản trước lên lại (release history). `deploy.md` có bảng "phiên bản → revision → release".
- **Công cụ (đã chốt: làm (a) trước, (b) sau):**
  - (a) **Script chạy tay** `scripts/release.sh` trên máy người vận hành: làm bước 2–3, in URL thử, dừng chờ gõ `yes` cho bước 4. Đơn giản, không thêm hạ tầng. **Đề xuất làm trước.**
  - (b) **GitHub Actions**: đẩy tag thì tự build và deploy không traffic; bước chuyển traffic nằm trong environment `production` có **người duyệt bắt buộc** (chủ dự án bấm Approve trên GitHub). Cần Workload Identity Federation (không có khoá). Làm sau (a) khi quy trình đã ổn.

### D22. Phiên đăng nhập: access token + refresh token (6.1) – **đã chốt**
- **Access token** (JWT) sống **15 phút**, chỉ giữ trong RAM của trang (Zustand, không `persist`). Payload như hiện nay (`sub`, `username`, `role`, `iat`) thêm `sid` (mã phiên).
- **Refresh token**: chuỗi ngẫu nhiên 256 bit trong cookie **`__session`**, `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. Chỉ đọc được bởi `POST /auth/refresh` và `POST /auth/logout`.
- **Collection `auth_sessions`**: `{ userId, familyId, tokenHash (SHA-256), expiresAt (TTL), createdAt, lastUsedAt, remember, userAgent rút gọn }`. Không lưu IP (dữ liệu cá nhân, không cần).
- **Xoay vòng (rotation)**: mỗi lần refresh cấp token mới, token cũ hết hiệu lực. Token cũ bị dùng lại → coi như bị lộ: **thu hồi cả họ phiên** (`familyId`) và trả 401.
- **Thời hạn phiên (đã chốt):**
  - Ô **"Ghi nhớ đăng nhập trên máy này"** ở trang đăng nhập, **mặc định tắt** (tablet chung của trường).
  - Tắt: cookie phiên (mất khi đóng trình duyệt), phiên tối đa **12 giờ**.
  - Bật: **7 ngày** kể từ lần dùng gần nhất, tối đa 14 ngày kể từ lúc đăng nhập.
- **Thu hồi:** đăng xuất (phiên này); "Đăng xuất mọi thiết bị" (trang tài khoản); đổi hoặc đặt lại mật khẩu (D20) và khoá tài khoản: thu hồi mọi phiên của người đó.
- **CSRF:** cookie `SameSite=Strict` + chỉ nhận `POST` + kiểm tra header `Origin` thuộc `CORS_ORIGIN`. Các API khác vẫn dùng `Authorization: Bearer`, không đọc cookie.
- **Frontend:**
  - Mở app: gọi `/auth/refresh` một lần để lấy access token (thay cho đọc `localStorage`).
  - Gặp 401: thử refresh **một lần** (gom các request đồng thời vào một lần refresh), lỗi mới đăng xuất.
  - Bài kiểm tra và Đấu trường không bị gián đoạn khi token hết hạn giữa chừng (refresh trong nền; socket dùng `auth` dạng hàm để lấy token mới khi nối lại).
- **Chuyển đổi:** sau khi deploy, token 7 ngày cũ trong `localStorage` bị bỏ qua; mọi người đăng nhập lại **một lần**. Production hiện chưa có người dùng thật nên chấp nhận được.
- **Giới hạn:** `/auth/refresh` giới hạn theo phiên và theo IP (như đăng nhập, D14).

### D23. Đăng nhập Google cho giáo viên (6.2) – **đã chốt**
- **Google Identity Services** (nút "Đăng nhập bằng Google") trên trang đăng nhập và đăng ký giáo viên → frontend nhận ID token → `POST /auth/google` → backend kiểm tra bằng `google-auth-library` (`audience` = OAuth client ID, `email_verified`).
- **Chỉ giáo viên và admin.** Học sinh không dùng Google (6–11 tuổi; tài khoản Google cho trẻ do phụ huynh quản lý).
- **Liên kết tài khoản:**
  - Tài khoản đã có: đăng nhập bằng mật khẩu → trang tài khoản → "Liên kết Google". Lưu `googleSub` và `email`.
  - Lần sau: "Đăng nhập bằng Google" tìm theo `googleSub`. **Không tự gộp theo email** nếu chưa liên kết.
  - Giáo viên mới đăng ký bằng Google: tạo tài khoản `pending` như hiện nay (admin vẫn duyệt), username sinh từ email.
- **Mọi tài khoản Google** (đã chốt): không giới hạn theo tên miền trường. Admin vẫn duyệt giáo viên mới, nên tài khoản Google lạ không tự có quyền giáo viên.
- **Hạ tầng:** OAuth consent screen loại External, chỉ xin `openid email profile` (không phải phạm vi nhạy cảm); OAuth client ID loại Web với origin là site. Miễn phí.
- **CSP:** thêm `https://accounts.google.com` vào `script-src`, `frame-src`, `connect-src`.
- **Rủi ro đã biết:** link mở trong trình duyệt nhúng của Zalo/Facebook bị Google chặn đăng nhập (`disallowed_useragent`). Nút Google hiện hướng dẫn "Mở bằng Chrome/Safari"; đăng nhập bằng mật khẩu vẫn dùng được.

### D24. PWA (6.3) – **đã chốt**
- `vite-plugin-pwa` (Workbox), manifest: tên `EnQuiz`, `display: standalone`, `theme_color` thương hiệu, icon 192/512 px và icon maskable (render từ favicon như B3).
- **Cache:**
  - Vỏ ứng dụng (JS, CSS, font, icon): precache theo phiên bản build.
  - Ảnh và âm thanh câu hỏi (`storage.googleapis.com/<bucket>/images|audio/…`, tên file là hash nên không đổi nội dung): **CacheFirst**, tối đa ~300 file, 30 ngày.
  - **API: không cache** (`NetworkOnly`). Lý do: đúng dữ liệu (điểm, bài tập) và **riêng tư trên máy dùng chung**.
- **Ngoại tuyến:** chỉ hiện trang "Mất mạng – kết nối lại để học tiếp". Không chơi offline (chấm điểm ở server).
- Firebase Hosting: `sw.js` và `manifest.webmanifest` `no-cache`.
- **Lối thoát:** nếu service worker lỗi, deploy bản "tự gỡ" (self-destroying) theo `deploy.md`.

### D25. Cập nhật phiên bản trên máy người dùng (6.4) – **đã chốt**
- `registerType: 'prompt'`: có bản mới thì hiện thanh "🎉 EnQuiz có bản mới – Cập nhật". Bấm thì tải lại.
- **Không làm phiền giữa chừng:** không hiện khi đang ở phòng thi (`/exam/…`) hoặc màn chơi Đấu trường (`/live/play`, màn chiếu); hiện khi rời các trang đó. *(Lúc làm: thêm cả màn chơi quiz `/play/…`, vì tải lại giữa chừng thì mất lượt đang làm.)*
- **Ép cập nhật (`forceUpdate`):** `/api/v1/health` trả thêm `minClientVersion`. Frontend thấy phiên bản của mình nhỏ hơn thì tải lại ngay khi không ở phòng thi hoặc trận đấu; nếu đang thi thì đợi nộp bài. Dùng khi API đổi không tương thích.
- Giữ cơ chế B1 (thiếu file trang sau deploy → tải lại một lần) làm lưới an toàn.

### D26. Hash mật khẩu trong trình duyệt (6.1) – **đã chốt** (chủ dự án yêu cầu, 2026-11-21)
- Mật khẩu không rời trình duyệt ở dạng rõ: app gửi `SHA-256("enquiz-pw-v1:" + username viết thường + ":" + mật khẩu)` (hex, chuẩn hoá Unicode NFC). Server lưu `bcrypt` của chuỗi đó. Username vẫn gửi dạng rõ (cần để tìm tài khoản và giới hạn số lần thử).
- **Bảo vệ được:** người đọc được traffic đã giải mã (proxy kiểm tra HTTPS của trường, log lỗi) không thấy mật khẩu gốc, nên không dùng lại được ở trang khác. **Không bảo vệ:** chuỗi hash vẫn đăng nhập được EnQuiz, nên vẫn phải giữ bí mật như mật khẩu; HTTPS vẫn là lớp bảo vệ chính.
- Quy tắc độ dài (6, admin 12) chỉ kiểm tra ở frontend. Server vẫn từ chối mật khẩu trùng username (đúng chữ thường) và trùng mật khẩu hiện tại.
- Mật khẩu do server tạo (mật khẩu tạm, seed, `create:admin`, `set:password`) được server tự hash theo cùng công thức trước khi bcrypt.
- **Chuyển đổi:** không chuyển dần được, vì server chỉ có `bcrypt(mật khẩu gốc)` và từ nay không còn nhận mật khẩu gốc. Tài khoản có từ trước phải đặt lại mật khẩu một lần (`npm run set:password`; học sinh: giáo viên đặt lại trong app). Production lúc này có 4 tài khoản.

## 4. Thiết kế kỹ thuật

### Backend
- `VERSION`, `GIT_COMMIT`: đưa vào image lúc build (`--build-arg`), đọc trong `health.controller.ts`. `MIN_CLIENT_VERSION`: biến môi trường Cloud Run (D25).
- Module `auth`:
  - `POST /auth/login`, `/auth/register`: như cũ nhưng trả access token và đặt cookie refresh (có `remember`).
  - `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`.
  - `POST /auth/google`, `POST /auth/google/link`, `DELETE /auth/google/link`.
  - `AuthSessionService`: tạo, xoay vòng, thu hồi phiên; TTL index trên `expiresAt`.
  - `ActiveAccountGuard`: thêm kiểm tra `sid` còn sống (đọc cùng cache 30 giây như trạng thái tài khoản), để đăng xuất có hiệu lực ngay, không chờ 15 phút.
- `users`: thêm `email?` (unique, sparse), `googleSub?` (unique, sparse).
- `JWT_EXPIRES_IN` mặc định `15m`; biến mới `REFRESH_TTL_REMEMBER` (7d, kể từ lần dùng gần nhất), `REFRESH_MAX_REMEMBER` (14d, kể từ lúc đăng nhập), `REFRESH_TTL_SESSION` (12h), `GOOGLE_CLIENT_ID`.

### Frontend
- `shared/version.ts`: `APP_VERSION` từ `VITE_APP_VERSION`; chân trang hiện phiên bản.
- `auth.store`: bỏ `persist` cho token; `bootstrap` gọi refresh; interceptor 401 → refresh một lần (khoá dùng chung).
- `connectLive`: `auth: (cb) => cb({ token: getFreshToken() })`.
- PWA: `vite-plugin-pwa`, `UpdatePrompt` (D25), trang ngoại tuyến.
- Google: nút GIS (tải script chỉ ở trang đăng nhập và trang tài khoản).

### Hạ tầng
- `scripts/release.sh` (D21a); `deploy.md` mục "Phát hành theo phiên bản" thay mục "Cập nhật và rollback".
- OAuth consent screen và client ID (6.2): làm trên Console, ghi giá trị thật vào ghi chú riêng ở máy, không vào repo.

## 5. Lộ trình

Thứ tự (đã chốt): **6.5 → 6.1 → 6.3 → 6.4 → 6.2**; 4.3 vẫn tạm hoãn.
- 6.5 trước: mọi mốc sau đều phát hành bằng quy trình có số phiên bản và xác nhận.
- 6.1 trước PWA: đổi cách giữ phiên trước khi có service worker, tránh cache nhầm.
- 6.4 cần service worker của 6.3.
- 6.2 sau cùng: cần tạo OAuth consent screen và client ID trên Console.

| Mốc | Việc | Ước lượng | Phát hành |
| --- | --- | --- | --- |
| 6.5 | `VERSION`, `CHANGELOG.md`, health + chân trang có phiên bản, `release.sh`, `deploy.md` | 1 ngày | **v1.0.0** (gồm PR #10 chưa deploy) |
| 6.1 | Phiên refresh, cookie `__session`, xoay vòng, thu hồi, frontend refresh, socket | 2–3 ngày | v1.1.0 |
| 6.3 | PWA, cache ảnh/âm thanh, trang ngoại tuyến | 1–2 ngày | v1.2.0 |
| 6.4 | Thanh cập nhật, `minClientVersion` | 1 ngày | v1.3.0 (có thể gộp với 6.3) |
| 6.2 | Google Identity Services, liên kết tài khoản, CSP | 1–2 ngày | v1.4.0 |

### 6.5 Phiên bản deploy
- Kiểm thử: `/health` trả đúng `version`/`commit`; chân trang đúng phiên bản; `release.sh` dừng ở bước xác nhận; thử rollback theo tag phiên bản.

### 6.1 Token
- Kiểm thử e2e: đăng nhập có/không "ghi nhớ" (thuộc tính cookie); refresh xoay vòng; dùng lại token cũ → thu hồi cả họ; đăng xuất, đăng xuất mọi thiết bị; đổi mật khẩu thu hồi phiên; `Origin` lạ bị từ chối; access token hết hạn giữa bài kiểm tra vẫn nộp được; socket nối lại với token mới.
- Thử thật qua Firebase Hosting: cookie `__session` tới được Cloud Run.

### 6.3 PWA
- Kiểm thử: Lighthouse PWA; cài lên Android/iPad; ảnh câu hỏi lần hai lấy từ cache; API không có trong cache (DevTools → Cache Storage).

### 6.4 Cập nhật
- Kiểm thử: deploy bản mới → thanh cập nhật hiện; không hiện trong phòng thi; `minClientVersion` cao hơn → tải lại sau khi nộp bài.

### 6.2 Google
- Kiểm thử: liên kết, đăng nhập bằng Google, giáo viên mới thành `pending`, tên miền ngoài danh sách bị từ chối, trình duyệt nhúng hiện hướng dẫn.

## 6. Migrate dữ liệu
- Không cần script migrate: `email`, `googleSub` là trường tuỳ chọn; `auth_sessions` là collection mới.
- 6.1: token cũ trong `localStorage` bị bỏ qua, người dùng đăng nhập lại một lần.

## 7. Phụ thuộc & rủi ro

| Rủi ro | Mức | Cách xử lý |
| --- | --- | --- |
| Firebase Hosting đổi cách chuyển cookie, hoặc cookie `__session` không tới Cloud Run | Trung bình | Thử thật ở bước 3 của quy trình phát hành (URL kênh xem trước) trước khi chuyển traffic |
| Service worker giữ bản cũ, người dùng kẹt | Trung bình | D25 (thanh cập nhật, `minClientVersion`), B1, bản tự gỡ service worker |
| Cache trên máy dùng chung lộ dữ liệu học sinh khác | Cao nếu cache API | Không cache API (D24); phiên mặc định ngắn (D22) |
| Google chặn đăng nhập trong trình duyệt nhúng Zalo | Cao (giáo viên hay mở link từ Zalo) | Hướng dẫn mở bằng trình duyệt; mật khẩu vẫn dùng được |
| Access token ngắn làm rớt Đấu trường hoặc bài kiểm tra | Trung bình | Refresh trong nền; socket lấy token mới khi nối lại; e2e cho cả hai |
| Quên tăng phiên bản hoặc ghi CHANGELOG | Thấp | `release.sh` từ chối nếu tag đã tồn tại hoặc CHANGELOG chưa có mục phiên bản đó |

## 8. Quy tắc mới cần thêm vào README
- Mọi lần deploy production đi qua quy trình phát hành D21 và **phải được chủ dự án xác nhận**.
- Không lưu token hay dữ liệu API trong `localStorage`/cache trình duyệt (trừ cài đặt giao diện).
- API mới không đọc cookie, trừ `/auth/refresh` và `/auth/logout`.

## 9. Định nghĩa "xong" cho mỗi mốc
- Code, test (unit + e2e), lint, build sạch; PR có mô tả và CI xanh.
- Tài liệu cập nhật (tài liệu tính năng, `deploy.md`, README nếu có quy tắc mới).
- **Đã phát hành thành một phiên bản** theo D21, được chủ dự án xác nhận, và kiểm tra lại trên production.
- Ghi "Kết quả 6.x" vào tài liệu này.

## Quyết định đã chốt (2026-11-21)
1. **D21:** một số phiên bản chung, bắt đầu từ `v1.0.0`; script phát hành chạy tay trước, GitHub Actions có người duyệt sau.
2. **D22:** ô "Ghi nhớ đăng nhập" mặc định tắt; tắt = phiên 12 giờ; bật = **7 ngày** kể từ lần dùng gần nhất, **tối đa 14 ngày** kể từ lúc đăng nhập.
3. **D23:** đăng nhập Google cho **mọi tài khoản Google** (giáo viên mới vẫn chờ admin duyệt).
4. **Thứ tự** 6.5 → 6.1 → 6.3 → 6.4 → 6.2; 4.3 vẫn tạm hoãn.

---

## Kết quả các mốc

### Kết quả 6.5

> Ngày: 2026-11-21 · PR #12, #14 · Trạng thái: **xong**. `v1.0.0` chỉ chạy `prepare` (không promote); **`v1.1.0` là bản đầu tiên phát hành theo quy trình** (xem "Phát hành v1.1.0" dưới đây)

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Số phiên bản | `VERSION` = `1.0.0`; `CHANGELOG.md` có mục `[1.0.0]` | `VERSION`, `CHANGELOG.md` |
| Backend | `/api/v1/health` trả thêm `version`, `commit` (biến `APP_VERSION`, `GIT_COMMIT`; mặc định `dev`/`unknown`) | `health.controller.ts`, `env.validation.ts` |
| Frontend | Vite đọc `VERSION` và commit lúc build; chân trang `EnQuiz vX.Y.Z` (commit trong tooltip) ở mọi trang đã đăng nhập và trang đăng nhập/đăng ký; sinh `version.json` (no-cache) | `vite.config.ts`, `shared/version/*`, `AppLayout.tsx`, `AuthCard.tsx`, `firebase.json` |
| Script phát hành | `scripts/release.sh prepare | promote | status | rollback <x.y.z>`; `DRY_RUN=1`; giá trị thật trong `.env.release` (không commit, có `.env.release.example`) | `scripts/release.sh` |
| Tài liệu | `deploy.md` mục "Phát hành theo phiên bản" (quy trình 5 bước, rollback, bảng phiên bản); bước 4–5 ghi rõ chỉ dùng lần đầu; README mục 2.8 Phát hành | `deploy.md`, `README.md` |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **127 unit**, **97 e2e** test pass (test health kiểm tra `version`, `commit`).
- Frontend: `tsc`, lint, build sạch. Bản build chứa `1.0.0` và commit; `version.json` đúng; chân trang hiện `EnQuiz v1.0.0` (ảnh chụp trên điện thoại).
- `release.sh`: `DRY_RUN=1 prepare` chạy đủ các bước kiểm tra (VERSION, CHANGELOG, tag) và in đúng lệnh build/deploy; `status` đọc được production hiện tại (báo "before versioning"); `DRY_RUN=1 rollback` in đúng lệnh.
- **Chưa kiểm tra:** `prepare`/`promote` chạy thật — làm khi phát hành `v1.0.0`.

**Phát hiện trong lúc làm**
- Kênh xem trước của Firebase vẫn gọi API của bản đang chạy (rewrite `/api` trỏ vào traffic chính của Cloud Run), nên API mới thử qua URL của revision. Đã ghi vào quy trình; với thay đổi API không tương thích sẽ cần `minClientVersion` (6.4).
- Bản production trước `v1.0.0` không có tag: rollback về nó bằng tên revision (ghi trong `deploy.md`).


### Kết quả 6.1

> Ngày: 2026-11-21 · PR #13 · Trạng thái: **xong, đã phát hành `v1.1.0`**

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Phiên đăng nhập | Collection `auth_sessions` (một tài liệu = một phiên = một "họ" token; `_id` là `sid`): chỉ lưu SHA-256 của refresh token, `prevHash` để nhận ra token cũ bị dùng lại, TTL index trên `expiresAt`, `maxExpiresAt` cho mức trần 14 ngày | `users/sessions/auth-session.{schema,service}.ts` |
| Xoay vòng, thu hồi | Mỗi lần refresh đổi token (cập nhật có điều kiện theo hash cũ: hai request cùng lúc chỉ một thắng). Token cũ quay lại **sau 30 giây** → thu hồi cả phiên; trong 30 giây → chỉ từ chối (hai tab, mất response) | `auth-session.service.ts` |
| Endpoint | `POST /auth/refresh`, `/auth/logout` (đọc cookie, không cần access token), `/auth/logout-all`; đăng nhập/đăng ký đặt cookie; `remember` trong `LoginDto` | `session.controller.ts`, `auth.controller.ts` |
| Cookie, CSRF | `__session`, HttpOnly, Secure, SameSite=Strict, `Path=/api/v1/auth`; không có `remember` thì là cookie phiên. Refresh/logout đòi `Origin` thuộc `CORS_ORIGIN`/`LIVE_CORS_ORIGINS` hoặc kênh xem trước `https://<site>--<kênh>.web.app` (thiếu `Origin` thì cần `Sec-Fetch-Site: same-origin`). `Cache-Control: private, no-store` | `session-cookie.ts` |
| Kiểm tra mỗi request | Access token mang `sid`; `ActiveAccountGuard` và socket Đấu trường từ chối khi phiên đã thu hồi (cache 30 giây, xoá ngay khi thu hồi). Token không có `sid` (JWT 7 ngày cũ) bị từ chối | `active-account.guard.ts`, `live-auth.ts` |
| Thu hồi theo sự kiện | Đổi mật khẩu: thu hồi mọi phiên **trừ máy đang đổi**. Giáo viên/admin đặt lại mật khẩu, khoá tài khoản: thu hồi mọi phiên | `change-password.handler.ts`, `reset-password.handler.ts`, `set-user-status.handler.ts` |
| Hash mật khẩu (D26) | `passwordHash` ở trình duyệt, `clientPasswordHash` ở server (cùng công thức, chung test vector); DTO chỉ nhận chuỗi hex 64 ký tự (khác → "Ứng dụng đã cũ…"); CLI `set:password` | `shared/lib/password-hash.ts`, `common/utils/passwords.ts`, `cli/set-password.ts` |
| Frontend | Store bỏ `persist`, token chỉ trong RAM, xoá khoá `enquiz-auth` cũ; mở app gọi refresh một lần (màn chờ 🦉); 401 → refresh **một lần** rồi gửi lại (gom request đồng thời, khoá `navigator.locks` giữa các tab); socket lấy token còn hạn ≥ 1 phút mỗi lần (nối lại), không nối lại khi token đổi | `auth.store.ts`, `http.ts`, `socket.ts`, `useLiveSocket.ts` |
| Giao diện | Ô "Ghi nhớ đăng nhập trên máy này" (mặc định tắt, ghi chú máy dùng chung); thẻ "Đăng xuất mọi thiết bị" ở trang Đổi mật khẩu; frontend kiểm tra độ dài và "không trùng tên đăng nhập" | `LoginPage.tsx`, `ChangePasswordPage.tsx` |

**Kết quả kiểm tra**
- Backend: lint sạch; **134 unit** (thêm `readCookie`, `originAllowed`, `parseDuration`, test vector của hash), **112 e2e** (thêm `sessions.e2e-spec.ts`, 15 test: thuộc tính cookie có/không ghi nhớ, mức trần 14 ngày, xoay vòng, dùng lại token cũ, Origin lạ/thiếu/kênh xem trước, token hết hạn → refresh, giáo viên chờ duyệt refresh được, đăng xuất có hiệu lực ngay cả với socket, đăng xuất mọi thiết bị, đổi mật khẩu giữ phiên này, đặt lại/khoá thu hồi phiên, token không `sid` bị từ chối). Test cũ chuyển sang gửi hash; thêm test "mật khẩu rõ bị từ chối".
- Frontend: `tsc`, lint, build sạch. Hàm hash cho đúng test vector của backend (kể cả mật khẩu tiếng Việt gõ dạng NFD).
- Chạy thật trên trình duyệt (backend `JWT_EXPIRES_IN=20s`), 16 bước đều đúng, không lỗi console: body đăng nhập chỉ có hash; cookie đúng thuộc tính, `localStorage` không có token; F5 vẫn đăng nhập; token hết hạn → tự refresh, không bị đăng xuất; ghi nhớ = cookie 7 ngày; đăng xuất xoá cookie, máy khác không ảnh hưởng; đổi mật khẩu → máy khác về `/login`, máy này vẫn vào; đăng xuất mọi thiết bị.
- **Chưa kiểm tra:** cookie `__session` đi qua Firebase Hosting tới Cloud Run (làm ở bước kiểm tra của `release.sh prepare`); socket Đấu trường nối lại sau khi token hết hạn trên trình duyệt thật (đã có e2e phía server).

**Phát hiện trong lúc làm**
- Yêu cầu hash mật khẩu đến giữa mốc: không chuyển dần được tài khoản cũ (D26), nên phát hành `v1.1.0` phải kèm bước `set:password` cho 4 tài khoản production.
- Kênh xem trước của Firebase gọi API của bản đang chạy, nên 6.1 chỉ thử trọn vẹn được sau `promote` hoặc khi kênh xem trước trỏ vào revision có tag. Đề xuất thử trường `tag` trong rewrite Cloud Run của Firebase cho kênh xem trước khi chuẩn bị `v1.1.0`.
- Truy vấn Mongoose theo `userId` dạng chuỗi trong test không tự đổi sang ObjectId: code luôn ép kiểu rõ ràng.

### Kết quả 6.3 và 6.4

> Ngày: 2026-11-21 · PR #13 · Trạng thái: **xong, đã phát hành `v1.1.0`**

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Manifest, icon | `vite-plugin-pwa` 2.0.0 (chế độ `injectManifest`): tên, `standalone`, màu thương hiệu, icon 192/512 và icon maskable 512, render từ favicon | `vite.config.ts`, `public/pwa-*.png` |
| Service worker | Precache vỏ app (47 file, ~1 MB chưa nén; bỏ `og-image.png`). Mọi trang trả `index.html` (trừ `/api`, `/socket.io`, `/version.json`). Ảnh/âm thanh trên Cloud Storage: CacheFirst, 300 file, 30 ngày, `purgeOnQuotaError`, trả byte range từ file đã cache. **API không có route nào**, tức là không bao giờ cache | `fe/sw/sw.ts`, `tsconfig.sw.json` |
| CORS cho cache ảnh/âm thanh | Service worker xin file ở chế độ CORS và chỉ cache response 200. Bucket chưa bật CORS thì tải lại theo cách thường và không cache, nên không phụ thuộc thứ tự triển khai. `deploy.md` có lệnh bật CORS cho bucket | `sw.ts`, `deploy.md` |
| Mất mạng | Thanh đỏ "Mất mạng rồi – kết nối lại để học tiếp nhé!", hiện cả trên màn chờ lúc khởi động. Có mạng lại thì tự lấy lại phiên | `OfflineBanner.tsx`, `App.tsx` |
| Thanh cập nhật (6.4) | `registerType: 'prompt'`. Kiểm tra bản mới mỗi 30 phút và khi quay lại tab. "EnQuiz có bản mới – Cập nhật" → `SKIP_WAITING` → tải lại vào bản mới | `UpdatePrompt.tsx`, `sw.ts` |
| Không làm phiền | Ẩn trong `/exam/…`, `/play/…`, `/live/play`, màn chiếu `/teacher/live/:id/host`; hiện lại khi rời | `busy-route.ts` |
| `minClientVersion` | Backend: biến `MIN_CLIENT_VERSION` (mặc định `0.0.0`), trả trong `/health`. Frontend: bản cũ hơn thì hiện "Cần cập nhật EnQuiz để dùng tiếp", rồi tự chuyển khi bản mới đã cài xong và người dùng không ở màn đang làm. Mỗi tab tối đa một lần, nên không lặp | `health.controller.ts`, `UpdatePrompt.tsx` |
| Hạ tầng | `firebase.json`: `sw.js`, `manifest.webmanifest` dùng `no-cache`; CSP thêm `storage.googleapis.com` vào `connect-src`. `release.sh`: `MIN_CLIENT_VERSION=…` lúc `prepare`; frontend build trong worktree tạm từ `HEAD` (không phụ thuộc `fe/node_modules`); ghi chú PATH cho Windows trong `.env.release.example` | `firebase.json`, `scripts/release.sh` |

**Kết quả kiểm tra**
- Backend: 134 unit, 112 e2e (test `/health` có `minClientVersion`). Frontend: `tsc` (thêm project `tsconfig.sw.json`), lint, build sạch.
- Chạy bản build production thật (`vite preview` + backend), trình duyệt Edge không giao diện, không lỗi console:
  - service worker active; **cài được** (`Page.getInstallabilityErrors` không có lỗi); manifest đủ 3 icon;
  - Cache Storage chỉ có precache (có `index.html`), **không có response `/api` nào**;
  - file âm thanh thật trên bucket production (chưa bật CORS) vẫn tải được qua service worker và không bị cache;
  - tắt mạng rồi tải lại: app vẫn mở, hiện thanh mất mạng; có mạng lại thì thanh biến mất;
  - đang mở `v1.0.0`, phát hành `v1.0.1`: thanh cập nhật hiện; vào màn chơi quiz thì ẩn, về trang chủ thì hiện lại; bấm Cập nhật → chân trang `v1.0.1`, vẫn đăng nhập;
  - backend đặt `MIN_CLIENT_VERSION=9.0.0`: hiện "Cần cập nhật EnQuiz"; có bản mới thì app tự chuyển sang mà không cần bấm, rồi không tải lại thêm lần nào.
- **Chưa kiểm tra:** cài thật lên Android/iPad; cache ảnh/âm thanh khi bucket đã bật CORS (làm lúc phát hành); Lighthouse không còn mục PWA từ bản 12, nên kiểm tra khả năng cài bằng DevTools Protocol.

**Phát hiện trong lúc làm**
- Bucket không trả header CORS, nên `<img>`/`new Audio()` nhận response opaque. Cache trực tiếp những response này sẽ tốn hàng GB quota trên tablet, vì vậy service worker tự xin file ở chế độ CORS.
- Lần mở đầu, service worker chưa đăng ký xong mà lệnh ép cập nhật đã chạy và tải lại trang. Đã sửa bằng cách chỉ coi "không có service worker" khi trình duyệt thật sự không hỗ trợ.
- Các dev server Vite đang chạy giữ khoá file trong `fe/node_modules`, nên `npm ci` thất bại và xoá dở thư mục này. Việc kiểm tra frontend chạy trong worktree sạch, và `release.sh` giờ cũng build ở đó.

### Phát hành v1.1.0 (2026-11-21)

> Gồm 6.1, 6.3, 6.4 (PR #13) và mọi thay đổi của `v1.0.0`. PR chuẩn bị: #14. Chủ dự án xác nhận promote ngày 2026-11-21.

**Diễn biến**
1. **`v1.0.0` chỉ chạy `prepare`:** revision `enquiz-api-00009` (tag `v1-0-0`), kênh xem trước `v1-0-0`. Chủ dự án chọn đi thẳng lên `v1.1.0`, để mọi người chỉ phải đăng nhập lại một lần.
2. **`prepare` v1.1.0:** build image `api:1.1.0`, deploy revision `enquiz-api-00010` với 0% traffic, health của URL tag trả `1.1.0`.
   - Firebase CLI **từ chối deploy kênh xem trước có `pinTag` khi site chính chưa được ghim** (kiểm tra `unsafePins` nằm trong CLI).
   - Xử lý một lần: deploy kênh xem trước không ghim, rồi dùng Hosting API tạo bản sao của version, đặt `run.tag = "v1-1-0"` và release vào kênh xem trước. Production không bị đụng tới.
   - Sau promote, site chính được ghim, nên từ bản sau `release.sh prepare` chạy bình thường.
3. **Kiểm tra trên kênh xem trước** (gọi API của revision mới), với một tài khoản học sinh tự đăng ký để thử, sau đó đã khoá:
   - chân trang `v1.1.0`, service worker chạy, header `no-cache` của `sw.js`/manifest và CSP mới đúng;
   - **cookie `__session` đi qua Firebase Hosting tới Cloud Run**; F5 vẫn giữ đăng nhập; đăng xuất, "Ghi nhớ" (7 ngày), đăng xuất mọi thiết bị đều đúng;
   - `Origin` lạ bị từ chối 403; mật khẩu gửi dạng rõ nhận "Ứng dụng đã cũ…".
4. **`promote`:** 100% traffic sang `enquiz-api-00010-pol`; kênh xem trước được đưa lên site chính; health và `version.json` của site chính trả `1.1.0`; git tag `v1.1.0`.
5. **Bucket ảnh/âm thanh:** bật CORS (`origin: *`, GET/HEAD); response giờ có `Access-Control-Allow-Origin: *`.
6. **Đặt lại mật khẩu** (D26) bằng `set:password` cho cả 4 tài khoản production (admin, giáo viên, 2 học sinh). Mật khẩu do script sinh, ghi trong ghi chú riêng ở máy. Cả 4 đăng nhập được trên production; mật khẩu cũ bị từ chối (401).
7. **Kiểm tra trên site chính:** trang do service worker điều khiển; cài được (không có lỗi khả năng cài đặt); file âm thanh tải qua service worker là response `cors`, được lưu vào `enquiz-media`, lần tải sau mất 4 ms; không lỗi console.

**Phát hiện**
- Trên Windows, Git Bash không có `gcloud` trong PATH, nên thêm PATH vào `.env.release` (đã có ghi chú trong `.env.release.example`).
- Các dev server và `vite preview` cũ giữ khoá file trong `node_modules`, nên `npm ci` thất bại và một lần deploy nhầm `dist` cũ lên kênh xem trước. Đã sửa: `release.sh` build trong worktree tạm (6.4), lần chạy lại dùng worktree mới.
- Từ v1.1.0, rollback = đưa bản Hosting cũ lên lại (API đi theo vì được ghim) **cộng** chuyển traffic (cho socket). Rollback về trước v1.1.0 sẽ làm 4 tài khoản đã đặt lại mật khẩu không đăng nhập được, vì bản cũ không hiểu mật khẩu đã hash.

