# Kế hoạch Giai đoạn 5 – Đấu trường trực tuyến (Live Quiz)

> Trạng thái: **Đang triển khai** · Quyết định D19, L1–L12 **đã chốt** (2026-11-21) · 5.0–5.3: **xong**, đã thử trên Cloud Run thật (2026-11-21) · Lập: 2026-11-20 · Xem [roadmap](roadmap.md) · Tài liệu: [15-live-quiz.md](features/15-live-quiz.md)
>
> Giai đoạn 4.3 (UX & thao tác giáo viên) **tạm hoãn**, làm Giai đoạn 5 trước. Phần hạ tầng còn lại của 4.0 (dựng Cloud Run, Firebase, Atlas, Storage theo [deploy.md](deploy.md)) vẫn cần làm, vì WebSocket chỉ kiểm chứng được trên Cloud Run thật (xem mục 7).

Tài liệu này ghép ba nguồn:
- 5.1–5.3 trong roadmap;
- bảng phân tích Live Quiz của bạn (vòng đời trận đấu, use case UC1–UC8, định danh kép, tính điểm theo tốc độ, tự kết nối lại);
- những gì code hiện có cho phép hoặc ràng buộc (dạng câu hỏi, tiến trình XP, bảng `student_progress`, cấu hình Cloud Run D12–D14).

---

## 1. Mục tiêu

Giáo viên chiếu một trận đấu kiểu Kahoot lên màn hình lớp:
- Học sinh vào bằng **mã PIN 6 số** hoặc **mã QR**, trả lời trên tablet/điện thoại.
- Điểm tính theo **đúng/sai và tốc độ**.
- Giữa các câu có **bảng xếp hạng tạm thời**, cuối trận có **bục vinh quang**.
- Học sinh đã đăng nhập được **lưu kết quả** vào lịch sử, tiến độ và thống kê của giáo viên.
- Khách vãng lai (do giáo viên cho phép) chỉ cần biệt danh, không lưu gì ngoài báo cáo trận.

## 2. Hiện trạng liên quan

| Hiện có | Ảnh hưởng tới Live |
| --- | --- |
| Câu trắc nghiệm có **2–6 lựa chọn** (`QUESTION_LIMITS`). `MultipleChoiceGame` đã có 6 màu + 6 hình | Không cố định "4 khối màu": hiện đúng số lựa chọn của câu, mỗi ô một màu và một hình (L1) |
| 4 dạng câu: trắc nghiệm, nối từ, điền từ, sắp xếp câu. Câu nghe là trắc nghiệm hoặc điền từ có `audioUrl` | Nối từ, điền từ, sắp xếp không hợp với nhịp "một chạm" (L1) |
| Chấm ở server (`gradeAnswer`), phát câu hỏi không kèm đáp án (`toPlayQuestion`) | Dùng lại được nguyên |
| `student_progress` + `ProgressionService.recordAttempt` (XP = phần điểm vượt điểm cao nhất cũ; mở trạm); đã có `mode: classic \| exam` | Lượt live có thể ghi như một lượt luyện tập với `mode: 'live'` (L8) |
| Thống kê và bản đồ nhiệt đọc `student_progress.details[]` | Kết quả live của học sinh có tài khoản tự vào thống kê, không phải sửa analytics |
| Cloud Run `max-instances=1`; bộ đếm giới hạn đăng nhập nằm trong RAM (D14) | Trạng thái phòng đấu cũng giữ trong RAM của một instance (L2) |
| Firebase Hosting rewrite **không chuyển tiếp WebSocket** (D12) | Socket kết nối thẳng domain `*.run.app`, cần CORS (D19) |
| JWT 7 ngày, gửi qua header `Authorization`. Giai đoạn 6 mới chuyển sang access token trên RAM + cookie refresh | Handshake socket gửi token trong `auth.token`. Giai đoạn 6 vẫn dùng được vì access token vẫn ở RAM |
| `ActiveAccountGuard`: giáo viên chưa duyệt không dùng được API | Gateway phải kiểm tra lại trạng thái tài khoản khi mở phòng |

---

## 3. Quyết định

Quyết định chung đánh số tiếp từ Giai đoạn 4 (D19…). Quyết định riêng cho Live dùng L1–L12. Tất cả **đã chốt** ngày 2026-11-21.

### Chỗ khác so với bảng phân tích

| Bảng phân tích | Đề xuất | Lý do |
| --- | --- | --- |
| "4 khối màu to bản" | **2–6 ô**, đúng số lựa chọn của câu | Kho câu có 2–6 lựa chọn; ép về 4 sẽ phải cắt bớt hoặc chèn đáp án giả |
| Màn học sinh chỉ có khối màu | Màn học sinh **hiện cả chữ** của câu hỏi và lựa chọn, kèm nút 🔊 | Học sinh tiểu học ngồi xa màn chiếu khó đọc; khách chơi ở nhà không có màn chiếu |
| Kết quả đúng/sai "hiện ngay lập tức" sau khi chọn | Chọn xong chỉ báo **"Đã chọn ✔️, chờ các bạn…"**; đúng/sai hiện ở pha **Công bố đáp án** | Nếu hiện ngay, em trả lời trước nói đáp án cho bạn bên cạnh |
| Khôi phục khách bằng `guestId` trong `sessionStorage` | `guestId` **+ `rejoinToken` bí mật** (ngẫu nhiên 128 bit) | Chỉ có `guestId` thì ai biết id cũng chiếm được chỗ và điểm của bạn |
| "Lưu điểm số/XP" theo điểm trận | Điểm tốc độ chỉ dùng **trong trận**. Lịch sử và XP lưu **tỉ lệ câu đúng** như một lượt luyện tập (`mode: 'live'`) | XP và bảng xếp hạng tuần/tháng tính theo thang 100 + "vượt điểm cũ"; điểm tốc độ (tới 1000/câu) sẽ làm lệch bảng xếp hạng |
| Độ trễ dưới 100 ms | Là **mục tiêu**, không phải cam kết. Điểm luôn tính theo giờ server nhận đáp án | Wi-Fi trường học không đảm bảo được; server là nơi quyết định |

### D19. Hạ tầng WebSocket trên Cloud Run – **đã chốt**
- Cloud Run giữ `max-instances=1` (như D14) và đổi sang:
  - `--min-instances=1`: không tắt khi đang có trận;
  - `--no-cpu-throttling`: CPU luôn được cấp, để đồng hồ câu hỏi chạy cả khi không có request HTTP;
  - `--session-affinity`;
  - `--timeout=3600`: một kết nối WebSocket sống tối đa 60 phút; client tự nối lại khi bị cắt.
- **Frontend:**
  - Socket kết nối thẳng `VITE_LIVE_URL` (`https://enquiz-api-….run.app`), namespace `/live`, ưu tiên `transports: ['websocket']`.
  - REST vẫn đi qua `/api/**` của Firebase.
- **Backend:** biến `LIVE_CORS_ORIGINS` gồm domain Firebase và `localhost:5173`.
- **Chi phí:** 1 instance luôn bật (512 MiB, CPU luôn cấp) tính phí theo giờ. Cần ước tính bằng bảng giá Cloud Run trước khi bật. Phương án tiết kiệm: chỉ bật `min-instances=1` trong giờ học bằng Cloud Scheduler (để sau).
- *(Đổi sau khi thử trên Cloud Run thật, 2026-11-21)*:
  - **Mặc định dùng chế độ tiết kiệm** (`--min-instances=0`, CPU chỉ cấp khi có request). WebSocket đang mở là một request nên CPU được cấp suốt trận; phòng 60 học sinh chạy trọn. `--min-instances=1 --no-cpu-throttling` chỉ còn là tuỳ chọn khi lớp chơi thật gặp lỗi.
  - Thêm **`--concurrency=500`**: mặc định 80 request/máy, mỗi socket tính một request, nên phòng 60 em bị trả 429.
  - Thêm **`LIVE_TRUST_PROXY=1`**: socket đi thẳng vào Cloud Run (một proxy), còn HTTP qua Firebase (hai proxy, `TRUST_PROXY=2`); dùng chung một biến thì socket giả được IP.
- **Khi cần nhiều instance:** Redis adapter của Socket.io + chuyển trạng thái phòng sang Redis. Chưa làm ở Giai đoạn 5.

### Live Quiz (L1–L12)

- **L1. Dạng câu hỏi:**
  - Chỉ **trắc nghiệm**, gồm cả câu có ảnh và câu nghe trắc nghiệm.
  - Khi chọn quiz, giáo viên thấy "8/10 câu chơi được ở Đấu trường". Câu dạng khác bị bỏ qua.
  - Quiz không có câu trắc nghiệm nào thì không mở phòng được.
- **L2. Trạng thái trận nằm trong RAM:**
  - Mỗi phòng là một object trong `LiveRoomRegistry`, có máy trạng thái thuần (pure reducer, nhận đồng hồ từ ngoài vào để test).
  - Ghi MongoDB **khi kết thúc trận**, và khi giáo viên dừng giữa chừng.
  - **Server khởi động lại giữa trận thì mất trận** (chấp nhận được; lớp chơi lại). Màn chơi báo "Phòng đã đóng" thay vì treo.
- **L3. Ai mở phòng:**
  - Giáo viên đã duyệt hoặc admin.
  - Quiz phải là quiz mình xem được (`canSeeQuiz`): quiz của mình, kể cả nháp; quiz hệ thống; quiz được chia sẻ.
  - **Gắn lớp** là tuỳ chọn. Gắn lớp thì:
    - chỉ học sinh của lớp (và khách nếu bật) vào được;
    - bảng xếp hạng dùng họ tên đầy đủ (theo D3).
  - Không gắn lớp: học sinh có tài khoản hiện tên rút gọn "Anh N.".
- **L4. Mã PIN & QR:**
  - PIN 6 số ngẫu nhiên, không trùng với phòng đang mở. PIN hết hiệu lực khi trận kết thúc, hoặc khi phòng chờ quá 30 phút không bắt đầu.
  - QR mã hoá `https://<domain>/live?pin=123456`, sinh ở client.
  - Chống dò PIN: `live:join` sai PIN quá 10 lần/phút/IP thì tạm khoá 1 phút.
- **L5. Vòng đời trận:**
  - `lobby → countdown → answering → reveal → leaderboard → (câu tiếp) … → podium → ended`.
  - `countdown`: 3 giây, hiện câu hỏi nhưng khoá chọn.
  - `answering`: kết thúc khi **hết giờ** hoặc **mọi người đang kết nối đều đã trả lời**.
  - `reveal → leaderboard → câu tiếp` do **giáo viên bấm**. Thêm tuỳ chọn "Tự chuyển sau 5 giây" để giáo viên rảnh tay.
  - Giáo viên có thể **kết thúc sớm**: tính kết quả tới câu đã công bố.
- **L6. Thời gian & điểm:**
  - Thời gian mỗi câu đặt cho cả phòng: 10 / 20 (mặc định) / 30 / 60 giây.
  - **Điểm câu đúng** = `round(1000 × (1 − 0.5 × t / T))`: từ 500 (sát giờ) tới 1000 (tức thì). Sai hoặc không trả lời: 0. Không có thưởng chuỗi ở bản đầu.
  - `t` = giờ server nhận đáp án − giờ server bắt đầu pha `answering`. Client chỉ hiển thị đồng hồ theo `answerEndsAt` + `serverNow` (giống E1).
  - **Mỗi câu một lần chọn**; server bỏ qua lần gửi thứ hai.
- **L7. Người chơi vào muộn & bị loại:**
  - Vào muộn được trong suốt trận, điểm bắt đầu từ 0, chơi từ câu tiếp theo.
  - Giáo viên **kick** được ở mọi pha. Người bị kick không vào lại được bằng cùng tài khoản hoặc biệt danh trong trận đó.
  - Tối đa **60 người** mỗi phòng.
- **L8. Lưu kết quả:**
  - Ghi `live_matches` (báo cáo trận) khi kết thúc.
  - Với mỗi **học sinh có tài khoản đã trả lời ít nhất 1 câu**: ghi một `student_progress` với `mode: 'live'`, `score` = tỉ lệ đúng trên số câu của trận, `details[]` từng câu. Lượt này đi qua `recordAttempt`, nên được XP "vượt điểm cũ" và mở trạm như luyện tập.
  - `PRACTICE_ONLY` (`mode ≠ exam`) đã bao gồm `live`, không cần sửa tiến trình.
  - Lượt live **không** gắn bài tập (`assignmentId = null`).
- **L9. Học sinh có tài khoản (5.1):**
  - Danh tính lấy từ JWT trong `handshake.auth.token`, kiểm tra `ActiveAccountGuard` khi kết nối; không nhận tên do client gửi.
  - Một tài khoản chỉ có một chỗ trong phòng: mở tab thứ hai thì tab cũ bị ngắt ("Em đã vào từ máy khác").
- **L10. Khôi phục phiên (5.2):**
  - Học sinh có tài khoản: nối lại thì server tự ghép theo `userId`.
  - Khách: `sessionStorage` giữ `{ pin, guestId, rejoinToken }`; server so `rejoinToken` (lưu dạng băm).
  - Khi nối lại, server gửi **ảnh chụp trạng thái**: pha hiện tại, câu đang chạy, đồng hồ, điểm và hạng của em, em đã trả lời câu này chưa.
  - Mất kết nối giữa pha `answering` mà quay lại trước khi hết giờ thì vẫn trả lời được; quá giờ thì câu đó 0 điểm.
  - Người mất kết nối hiện mờ ở sảnh chờ và trên bảng của giáo viên.
  - *(Đổi khi làm 5.1, 2026-11-21)*: người mất kết nối **vẫn được chờ 10 giây** (`OFFLINE_GRACE_MS`) rồi mới bị bỏ qua ở điều kiện "mọi người đã trả lời". Bản đầu không chờ, nên khi chạy thử trên trình duyệt, một em F5 làm cả lớp bị công bố đáp án sớm.
  - Client dùng cơ chế tự nối lại của Socket.io (tối đa ~2 phút), sau đó hiện nút "Vào lại".
- **L11. Khách vãng lai (5.3):**
  - Giáo viên bật hoặc tắt khi tạo phòng. **Mặc định tắt**: lớp đã có tài khoản thì không cần khách.
  - Biệt danh:
    - dài 2–16 ký tự: chữ (có dấu tiếng Việt), số, khoảng trắng;
    - lọc từ không phù hợp bằng danh sách tiếng Việt + tiếng Anh, so sau khi bỏ dấu, bỏ ký tự lặp và đổi số thành chữ (`4 → a`, `3 → e`…);
    - trùng biệt danh trong phòng thì tự thêm số ("Mèo 2").
  - **Giới hạn riêng cho khách:** mỗi IP tối đa 20 lần `live:join` mỗi phút. Khách chiếm tối đa 60 chỗ chung với học sinh.
  - **Lưu trữ:** khách chỉ xuất hiện trong `live_matches` (biệt danh + điểm). Không lưu IP, không tạo tài khoản, không có lịch sử. Báo cáo trận tự xoá sau **180 ngày** (TTL), vì biệt danh có thể là tên thật của trẻ (Nghị định 13/2023).
- **L12. Báo cáo sau trận (UC4):**
  - Bục vinh quang Top 3 trên màn chiếu.
  - Trang báo cáo cho giáo viên:
    - bảng điểm toàn trận;
    - từng câu: tỉ lệ đúng, phân bố lựa chọn, thời gian trả lời trung bình;
    - câu khó nhất được đánh dấu.
  - Gắn lớp thì kết quả học sinh có tài khoản cũng xuất hiện trong bản đồ nhiệt và báo cáo tiến độ có sẵn (nhờ L8).
  - Xuất Excel để sau.

---

## 4. Thiết kế kỹ thuật

### Backend: module `live`
```
be/src/modules/live/
  live.gateway.ts          # @WebSocketGateway({ namespace: '/live' }): handshake JWT, sự kiện
  live-room.registry.ts    # Map<pin, Room> trong RAM, cấp PIN, dọn phòng hết hạn
  live-room.machine.ts     # reducer thuần: (state, event, now) → state + các lệnh phát
  live-scoring.ts          # công thức điểm L6, xếp hạng (+ spec)
  nickname.ts              # kiểm tra + lọc biệt danh L11 (+ spec)
  live-results.service.ts  # ghi live_matches + student_progress (L8)
  live.controller.ts       # REST: tạo phòng, lịch sử, báo cáo
  schemas/live-match.schema.ts
```
- Thư viện mới: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` (backend); `socket.io-client`, `qrcode` (frontend). Ghim phiên bản lúc cài.
- Chiều phụ thuộc: `live → quizzes, questions, progress, classes (QueryBus)`. Không module nào phụ thuộc ngược vào `live`.
- Gateway không đi qua guard HTTP. Phải tự làm ba việc:
  - kiểm tra JWT;
  - kiểm tra trạng thái tài khoản (`AccountStatusService`);
  - đếm giới hạn theo IP (lấy IP thật theo `TRUST_PROXY`, cách D14 đang làm).

**REST**

| Method | Đường dẫn | Vai trò | Việc |
| --- | --- | --- | --- |
| POST | `/live/matches` | Giáo viên/Admin | `{ quizId, classId?, questionTimeSec, allowGuests, autoAdvance }` → `{ matchId, pin, playableCount, skippedCount }` |
| GET | `/live/matches?classId=` | Giáo viên/Admin | Lịch sử trận của mình |
| GET | `/live/matches/:id` | Chủ phòng/Admin | Báo cáo (L12) |
| GET | `/live/pin/:pin` | Công khai, có giới hạn | Kiểm tra PIN trước khi kết nối: `{ quizTitle, allowGuests, needsLogin }` |

**Sự kiện Socket.io (namespace `/live`)**

| Hướng | Sự kiện | Dữ liệu |
| --- | --- | --- |
| Host → server | `host:attach` | `{ matchId }`: màn chiếu nhận phòng (mở lại được nếu lỡ F5) |
| Host → server | `host:start` · `host:next` · `host:end` · `host:kick` | `host:next` chuyển `reveal → leaderboard → câu tiếp`; `host:kick { playerId }` |
| Player → server | `player:join` | `{ pin, nickname? }`: có token thì là học sinh; không token và phòng cho khách thì là khách. Trả `{ playerId, rejoinToken? }` |
| Player → server | `player:rejoin` | `{ pin, playerId, rejoinToken }` (khách) |
| Player → server | `player:answer` | `{ questionIndex, choice }` → ack `{ accepted }` |
| Server → phòng | `room:state` | Ảnh chụp đầy đủ khi vào/nối lại: pha, câu hiện tại, `answerEndsAt`, `serverNow`, điểm/hạng của em |
| Server → phòng | `lobby:players` | Danh sách người chơi (tên, online/offline) |
| Server → phòng | `question:start` | `{ index, total, question (không có đáp án), countdownEndsAt, answerEndsAt, serverNow }` |
| Server → host | `question:progress` | `{ answered, online }` |
| Server → phòng | `question:reveal` | `{ correctOption, distribution }`, kèm phần riêng của từng em `{ isCorrect, points, score, rank }` |
| Server → phòng | `leaderboard` | Top 5, kèm vị trí riêng của từng em |
| Server → phòng | `match:ended` | Bục Top 3, kèm kết quả riêng của từng em |
| Server → em | `player:kicked` · `room:closed` | Màn chơi báo và quay về trang nhập PIN |

**Dữ liệu `live_matches`**
```
hostId, quizId, classId?, pin (bỏ khi kết thúc), status: 'ended' | 'aborted'
settings { questionTimeSec, allowGuests, autoAdvance }
questionIds[]                      // các câu trắc nghiệm đã chơi, đúng thứ tự
startedAt, endedAt
players[] { playerId, userId?, nickname, isGuest, score, correctCount, rank,
            answers[] { questionIndex, choice, isCorrect, ms, points } }
questions[] { questionId, distribution[], correctRate, avgMs }
index { hostId, endedAt } · { classId, endedAt } · TTL theo endedAt (180 ngày, L11)
```

### Frontend: feature `live`
- `/live` (công khai): nhập PIN, hoặc đọc `?pin=` từ QR. Đã đăng nhập thì vào bằng tài khoản; chưa đăng nhập và phòng cho khách thì nhập biệt danh.
- `/live/play`: màn người chơi. Toàn màn hình, ngoài `AppLayout`, dùng lại `MultipleChoiceGame` (ô màu + hình), nút 🔊, đồng hồ theo giờ server.
- `/teacher/live/new` → `/teacher/live/:matchId/host`: màn chiếu. Chữ rất to, PIN + QR, sảnh chờ kèm nút kick, đếm "18/25 em đã trả lời", biểu đồ phân bố, Top 5, bục vinh quang có pháo giấy và âm thanh (dùng lại `shared/sound`).
- `/teacher/live/:matchId`: báo cáo trận. Thêm mục "⚔️ Đấu trường" trong menu giáo viên và tab trong trang lớp.
- `shared/live/socket.ts`: một socket dùng chung, gắn token lúc kết nối. Hook `useLiveRoom()` nhận sự kiện và giữ ảnh chụp trạng thái (Zustand hoặc `useReducer`).

---

## 5. Lộ trình

Ước lượng cho 1 lập trình viên full-stack đã quen code.

| Mốc | Nội dung | Ước lượng | Tài liệu mới/sửa |
| --- | --- | --- | --- |
| 5.0 | Nền tảng realtime & hạ tầng | 2–3 ngày | **15-live-quiz.md**, deploy.md, README |
| 5.1 | Đấu trường cho học sinh đã đăng nhập (UC1–UC6) | 8–10 ngày | 15, 05, 12 |
| 5.2 | Khôi phục phiên (UC8) | 2–3 ngày | 15 |
| 5.3 | Khách vãng lai (UC7) | 3–4 ngày | 15, 01 |
| | **Tổng** | **~3–4 tuần** | |

### 5.0 Nền tảng realtime & hạ tầng
1. Cài thư viện. Gateway `/live` với handshake JWT; từ chối tài khoản bị khoá hoặc chưa duyệt.
2. `LiveRoomRegistry`: cấp PIN, dọn phòng hết hạn. `live-room.machine.ts` với đủ pha L5 và unit test (đồng hồ giả).
3. Biến môi trường `LIVE_CORS_ORIGINS`, `VITE_LIVE_URL`. Sửa `deploy.md` theo D19.
4. **Thử sớm trên Cloud Run thật:** WebSocket qua `*.run.app`, CORS từ domain Firebase, kết nối giữ được 60 phút rồi tự nối lại. Cần 4.0 dựng xong hạ tầng.
5. Script thử tải (scratch, không đưa vào CI): 60 client giả vào một phòng, trả lời ngẫu nhiên; đo thời gian phát `question:start` tới client cuối.

### 5.1 Đấu trường cho học sinh đã đăng nhập
1. **Backend:** REST tạo phòng (L1, L3), `host:*` / `player:join` / `player:answer`, chấm và tính điểm (L6), `question:reveal` / `leaderboard` / `match:ended`, ghi kết quả (L8), báo cáo (L12).
2. **Frontend:** màn tạo phòng (chọn quiz, lớp, thời gian, tự chuyển), màn chiếu, màn người chơi, trang báo cáo, mục menu.
3. **Kiểm thử:**
   - Unit: công thức điểm, xếp hạng khi bằng điểm, máy trạng thái (hết giờ, mọi người đã trả lời, kết thúc sớm).
   - e2e với `socket.io-client` trên app chạy cổng ngẫu nhiên:
     - mở phòng → 3 học sinh vào → trả lời → công bố → kết thúc;
     - `live_matches` có đủ dữ liệu;
     - `student_progress` có `mode: 'live'`;
     - XP của học sinh tăng đúng quy tắc;
     - học sinh lớp khác không vào được phòng gắn lớp;
     - trả lời hai lần chỉ tính lần đầu;
     - trả lời sau giờ bị từ chối.

### 5.2 Khôi phục phiên
- Ghép lại theo `userId` hoặc `rejoinToken`; gửi ảnh chụp `room:state`; trạng thái online/offline; host F5 thì `host:attach` lại.
- **Kiểm thử:**
  - e2e: ngắt socket giữa `answering` rồi nối lại → vẫn trả lời được, điểm giữ nguyên.
  - e2e: `rejoinToken` sai → từ chối.
  - Trình duyệt: F5 ở màn người chơi và màn chiếu.

### 5.3 Khách vãng lai
- Bật/tắt khách theo phòng, kiểm tra và lọc biệt danh, giới hạn theo IP, kick + chặn biệt danh, TTL báo cáo.
- **Kiểm thử:**
  - Unit: bộ lọc biệt danh (bỏ dấu, số thay chữ, ký tự lặp; không chặn nhầm tên thường như "Phúc", "Cúc").
  - e2e: phòng tắt khách → khách bị từ chối; vượt giới hạn IP → bị chặn tạm.

---

## 6. Migrate dữ liệu
- Không cần script. `live_matches` là collection mới; `student_progress.mode` thêm giá trị `'live'`, các bản ghi cũ không đổi.
- Kiểm tra lại các chỗ đang so `mode === 'exam'` hoặc `mode ?? 'classic'` (lịch sử, `ResultView`) để nhãn "⚔️ Đấu trường" hiện đúng.

## 7. Phụ thuộc & rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| Hạ tầng 4.0 chưa dựng nên chưa thử được WebSocket trên Cloud Run | Cao | Dựng 4.0 trước hoặc song song với 5.0; mốc 5.0 chỉ xong khi đã thử trên Cloud Run thật |
| Server khởi động lại (deploy, lỗi) giữa trận thì mất trận (L2) | Trung bình | Không deploy trong giờ học; màn chơi báo rõ "Phòng đã đóng"; sau này lưu ảnh chụp mỗi câu vào Mongo hoặc Redis |
| Wi-Fi trường yếu, 30–60 thiết bị cùng lúc | Trung bình | Payload nhỏ (không gửi ảnh qua socket, chỉ URL); ưu tiên WebSocket; thử tải ở 5.0 |
| Chi phí instance luôn bật (D19) | Thấp–Trung bình | Ước tính trước; bật theo giờ học bằng Cloud Scheduler nếu cần |
| Dò PIN, khách spam biệt danh xấu | Trung bình | Giới hạn theo IP (L4, L11), bộ lọc, kick + chặn, mặc định tắt khách |
| Dữ liệu trẻ em (biệt danh có thể là tên thật) | Trung bình | Không lưu IP; TTL 180 ngày; chưa mở cho trường thật trước khi có đồng ý của phụ huynh (như 4.0) |
| Đồng hồ máy học sinh lệch | Thấp | Hiển thị theo `serverNow`; điểm tính theo giờ server nhận đáp án |

## 8. Quy tắc mới cần thêm vào README
- Sự kiện socket có tên dạng `vai_trò:hành_động`. Mọi dữ liệu client gửi lên đều kiểm tra như DTO (class-validator) trước khi vào reducer.
- Không gửi đáp án qua socket trước pha `reveal`.
- Trạng thái realtime chỉ nằm trong `LiveRoomRegistry`. Ghi DB chỉ ở `LiveResultsService` khi trận kết thúc.

## 9. Định nghĩa "xong" cho mỗi mốc
- Như Giai đoạn 4:
  - lint, test, test:e2e (be), lint và build (fe) đều qua;
  - CI xanh;
  - có tài liệu tính năng **15-live-quiz.md**;
  - cập nhật README và roadmap.
- Chạy thử trên trình duyệt với **ít nhất 1 màn chiếu và 3 người chơi** (tablet + điện thoại). Từ 5.0 trở đi, chạy thử cả trên Cloud Run.
- Viết mục **"Kết quả 5.x"** ở cuối file này sau mỗi mốc.

---

## Kết quả các mốc

### Kết quả 5.0

> Ngày: 2026-11-21 · [PR #4](https://github.com/huyvouit/enquiz/pull/4) đã merge vào `main` (merge commit `2a53dcf`), chung với 5.1–5.3 · Trạng thái: **code xong**, chờ thử trên Cloud Run thật

**Đã làm**

| Việc | Chi tiết | File chính |
| --- | --- | --- |
| Thư viện | `@nestjs/websockets` và `@nestjs/platform-socket.io` ghim `~12.5.1` cho khớp `@nestjs/core` 12.5; `socket.io-client` ^4.8 (fe, và devDependency be cho e2e). `qrcode` để sang 5.1 | `be/package.json`, `fe/package.json` |
| Máy trạng thái trận (L5–L7, L9) | Reducer thuần đủ các pha `lobby → … → ended`, đồng hồ bắt đầu đúng giờ hẹn, công bố sớm, tự chuyển, kết thúc sớm chỉ tính câu đã công bố, vào lại cùng tài khoản, kick + chặn, giới hạn 60 người, vào muộn | `live/live-room.machine.ts`, `live-scoring.ts` |
| Quản lý phòng (L2, L4) | Phòng trong RAM, PIN 6 số không trùng, vòng tick 250 ms, dọn phòng bỏ quên, một phòng lỗi không làm dừng phòng khác | `live/live-room.registry.ts` |
| Socket `/live` (L9, D19) | Bắt tay kiểm tra JWT và trạng thái tài khoản (`unauthorized` / `pending`), ẩn danh khi không có token, IP thật theo `TRUST_PROXY`, `session:whoami`; CORS theo `LIVE_CORS_ORIGINS`, gói tối đa 64 KB, ping 10 s / 15 s | `live/live.gateway.ts`, `live-auth.ts`, `live-io.adapter.ts`, `common/setup-app.ts` |
| Guard/interceptor chỉ cho HTTP | `JwtAuthGuard`, `ActiveAccountGuard`, `RolesGuard`, `ResponseInterceptor` bỏ qua ngữ cảnh khác `http` | `common/guards/*`, `users/guards/active-account.guard.ts`, `common/interceptors/response.interceptor.ts` |
| Frontend | `connectLive(token)`, `liveWhoAmI()`; Vite chuyển `/socket.io` (`ws: true`); `VITE_LIVE_URL` | `fe/src/shared/live/socket.ts`, `fe/vite.config.ts`, `fe/.env.example` |
| Script kiểm tra | `live-check.mjs`: mở N socket, đo thời gian bắt tay và `whoami`, giữ kết nối N phút để xem Cloud Run cắt và client tự nối lại | `be/scripts/live-check.mjs` |
| Tài liệu | `deploy.md` theo D19 (cờ Cloud Run, `LIVE_CORS_ORIGINS`, `VITE_LIVE_URL`, bước kiểm tra 8); tài liệu 15; README (quy tắc socket), be/fe README, `.env.example` | — |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **94 unit** test pass (20 mới cho Live); **71 e2e** test pass (6 mới trong `test/live.e2e-spec.ts`, socket thật); build thành công.
- Frontend: `tsc`, lint sạch.
- Chạy cục bộ bằng `live-check.mjs`:
  - **60 socket** cùng lúc bằng token học sinh: 60/60 kết nối được, transport `websocket`, bắt tay median ~95 ms (p95 ~107 ms), `whoami` median ~19 ms.
  - Token sai bị từ chối `unauthorized`.
  - Qua proxy Vite (`localhost:5173`): 5/5 kết nối được.
- **Cloud Run thật** (2026-11-21, chế độ tiết kiệm, từ Việt Nam; `deploy.md` mục 6, bước 8):
  - 60 socket ẩn danh với origin của site: 60/60, transport `websocket`, bắt tay median ~378 ms, `whoami` median ~82 ms.
  - Bằng token học sinh: server nhận đúng vai trò và IP thật; gửi `X-Forwarded-For` giả thì vẫn thấy IP thật (`LIVE_TRUST_PROXY=1`).
  - Trận thật trên trình duyệt ở site production (màn chiếu và điện thoại): không có lỗi console, CSP cho phép `wss://*.run.app`.
  - **Chưa thử:** giữ kết nối 65 phút để xem Cloud Run cắt ở phút 60 rồi tự nối lại.

**Phát hiện và đã sửa trong lúc làm**
- Nest chạy cả **guard toàn cục** (`APP_GUARD`) cho sự kiện WebSocket: `JwtAuthGuard` đọc header `authorization` không có trên socket nên văng lỗi, mọi sự kiện đều bị chặn.
- **Interceptor toàn cục** bọc cả ack của socket thành `{ success, data }`.
- Socket.io không dùng `trust proxy` của Express: IP người chơi (cần cho giới hạn khách ở 5.3) phải tự đọc `X-Forwarded-For` theo `TRUST_PROXY`.
- `deploy.md` cũ ghi "không cần CPU luôn cấp" và `--min-instances=0`: đã đổi theo D19, có ghi chú chi phí.

**Còn lại**
- Giữ kết nối 65 phút trên Cloud Run (`live-check.mjs --hold 65`).
- Thử tải 60 người chơi **trong một phòng**: đã làm ở 5.1 và trên Cloud Run (xem bên dưới).

### Kết quả 5.1–5.3

> Ngày: 2026-11-21 · [PR #4](https://github.com/huyvouit/enquiz/pull/4) đã merge vào `main` (merge commit `2a53dcf`) · Trạng thái: **code xong**, chờ thử trên Cloud Run thật · Chi tiết: [tài liệu 15](features/15-live-quiz.md)

**Đã làm**

| Mốc | Việc | File chính |
| --- | --- | --- |
| 5.1 | **REST:** tạo phòng (chỉ câu trắc nghiệm, xáo lựa chọn một lần cho cả phòng, gắn lớp tuỳ chọn), lịch sử, báo cáo (chờ báo cáo đang ghi), kiểm tra PIN | `live/commands`, `live/queries`, `live.controller.ts`, `live.mapper.ts` |
| 5.1 | **Socket:** `host:attach/start/next/end/kick`, `player:join/answer`; mỗi màn nhận ảnh chụp riêng (`room:state`, `host:state`); học sinh không biết ai đã trả lời; một tài khoản một chỗ (tab mới thay tab cũ) | `live.gateway.ts`, `live.views.ts` |
| 5.1 | **Lưu kết quả:** `live_matches` (TTL 180 ngày) + `student_progress` `mode: 'live'` qua `recordAttempt` (XP, mở trạm như luyện tập); phòng bỏ quên giữa trận lưu dạng `aborted` | `live-results.service.ts`, `schemas/live-match.schema.ts`, `progression.service.ts` |
| 5.1 | **Frontend giáo viên:** trang mở phòng, màn chiếu (PIN, QR, sảnh chờ + kick, đếm ngược, đồng hồ, "N/M em đã trả lời", biểu đồ, Top 5, bục vinh quang), lịch sử, báo cáo; menu; nút trên thẻ quiz | `features/live/pages/Live{Setup,Host,History,Report}Page.tsx`, `components/LiveBoards.tsx`, `AppLayout.tsx` |
| 5.1 | **Frontend học sinh:** nhập PIN (học sinh vào thẳng; khách nhập biệt danh; phòng cần tài khoản thì đăng nhập rồi quay lại), màn chơi theo từng pha, âm thanh, pháo giấy, nhãn "⚔️ Đấu trường" trong lịch sử | `LiveJoinPage.tsx`, `LivePlayPage.tsx`, `progress/pages/HistoryPage.tsx` |
| 5.2 | Học sinh vào lại theo tài khoản; khách bằng `rejoinToken` (server lưu băm SHA-256, so bằng `timingSafeEqual`); `sessionStorage` giữ PIN/biệt danh/token; mọi màn tự gắn lại sau khi nối lại; **chờ người rớt mạng 10 giây** | `usePlayerSession.ts`, `useHostSession.ts`, `useLiveSocket.ts`, `live-room.machine.ts` |
| 5.3 | Bật/tắt khách theo phòng; biệt danh 2–16 ký tự; bộ lọc từ không phù hợp (có dấu so nguyên từ, không dấu/leetspeak/dính liền); đánh số khi trùng; giới hạn 20 lần vào/phút/IP; sai PIN 10 lần/phút (theo tài khoản với học sinh, theo IP với ẩn danh) | `nickname.ts`, `live-access.service.ts`, `rate-limiter.ts` |
| — | Script thử tải `live-load.mjs`; tài liệu 15 viết lại theo code; README, roadmap | `be/scripts/live-load.mjs` |

**Kết quả kiểm tra**
- Backend: lint, prettier sạch; **100 unit** test pass (6 mới: biệt danh, bộ giới hạn, chờ người rớt mạng); **82 e2e** test pass (11 mới trong `test/live-match.e2e-spec.ts`); build thành công.
- Frontend: `tsc`, lint, build sạch. Các trang Đấu trường tải riêng; bundle chính giữ ~326 kB.
- **Trình duyệt** (Edge headless, dữ liệu tạm):
  - 1 màn chiếu, 2 học sinh (tablet, điện thoại) và 1 khách đi hết một trận;
  - học sinh và khách F5 giữa câu vẫn chơi tiếp được;
  - có bỏ qua giờ và kết thúc sớm;
  - xem được báo cáo, lịch sử, nhãn trong "Bài đã làm";
  - không có lỗi console.
- **Thử tải cục bộ** (60 học sinh, một phòng, 3 câu):
  - câu hỏi tới đủ 60 máy ~5 ms sau khi giáo viên bấm, các máy lệch nhau 3–16 ms;
  - phản hồi khi trả lời median 3 ms;
  - 60/60 máy tới bục vinh quang.
- **CI trên PR #4:** xanh cả 3 job (backend, frontend, docker).
- **Cloud Run thật** (2026-11-21, chế độ tiết kiệm, 60 học sinh một phòng, từ Việt Nam): vào phòng median ~327 ms; câu hỏi tới đủ 60 máy sau 86–114 ms (lệch nhau 37–66 ms); nhận câu trả lời median ~72 ms; 60/60 máy tới bục vinh quang. Lần đầu bị Cloud Run trả 429 vì giới hạn 80 request/máy; đã thêm `--concurrency=500`.
- **Chưa kiểm tra:** Wi-Fi của một trường thật (độ trễ sẽ lớn hơn).

**Phát hiện và đã sửa trong lúc làm**
- **F5 làm lộ đáp án cho cả lớp:** một em F5 giữa câu thì server coi em đã rời đi; nếu những em còn lại đã trả lời hết, câu hỏi bị công bố ngay. Nay người rớt mạng được chờ 10 giây (quyết định L10 đã ghi lại).
- **Học sinh bị chặn oan khi nhập sai PIN:** giới hạn dò PIN đếm theo IP sẽ khiến cả trường (chung một IP) bị khoá nếu vài em gõ sai. Nay học sinh đếm theo tài khoản, chỉ người ẩn danh đếm theo IP.
- **Tên học sinh trong phòng mở:** dùng tên rút gọn như bảng xếp hạng toàn khối (D3), không lộ họ tên đầy đủ cho người ngoài lớp.

**Còn lại**
- Chạy với một lớp thật qua Wi-Fi trường.
- Xuất báo cáo trận ra Excel; thưởng chuỗi trả lời đúng (hướng mở rộng trong tài liệu 15).
