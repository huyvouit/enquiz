# 15 – Đấu trường trực tuyến (Live Quiz)

> Giai đoạn: 5 · Trạng thái: **Xong (code + kiểm thử)**: 5.0–5.3; chưa chạy trên Cloud Run thật · Cập nhật: 2026-11-21 · Quyết định D19, L1–L12 ở [phase-5-plan.md](../phase-5-plan.md)

## Mục tiêu
Giáo viên mở một trận đấu kiểu Kahoot, chiếu lên màn hình lớp:
- Học sinh vào bằng mã PIN hoặc QR, trả lời trên tablet hay điện thoại. Điểm tính theo đúng/sai và tốc độ.
- Giữa các câu có Top 5, cuối trận có bục vinh quang.
- Học sinh có tài khoản được lưu kết quả như một lượt luyện tập.
- Khách vãng lai (nếu giáo viên cho phép) chỉ cần biệt danh.

## Luồng chính

### Giáo viên (màn chiếu)
1. Mở phòng theo một trong hai cách:
   - **⚔️ Đấu trường → Mở phòng mới**;
   - nút **⚔️ Đấu trường** trên thẻ quiz ở dashboard (`/teacher/live/new?quizId=…`).
2. Cài đặt phòng:
   - chọn quiz;
   - lớp (không bắt buộc; không chọn = phòng mở);
   - thời gian mỗi câu: 10 / **20** / 30 / 60 giây;
   - cho khách vãng lai vào (mặc định tắt);
   - tự chuyển câu sau 5 giây (mặc định tắt).
3. **Sảnh chờ** (`/teacher/live/:matchId/host`, toàn màn hình):
   - PIN cỡ lớn, mã QR tới `/live?pin=…` và đường dẫn vào phòng;
   - nhãn lớp/phòng mở, khách, thời gian, số câu, "N câu không phải trắc nghiệm được bỏ qua";
   - danh sách người chơi theo thời gian thực: người mất kết nối hiện mờ, nút ✕ để kick;
   - **Bắt đầu ▶** (chỉ bấm được khi có người online), **Đóng phòng**.
4. **Trong trận:**
   - Đếm ngược 3 giây (hiện câu hỏi).
   - Trả lời: câu hỏi, ảnh, nút 🔊, các ô màu, đồng hồ lớn, "N/M em đã trả lời", nút **Bỏ qua ⏭**.
   - Công bố: biểu đồ phân bố lựa chọn, ô đúng được đánh dấu.
   - Top 5.
   - Nút **Tiếp ▶**, hoặc "Tự chuyển sau N giây" nếu đã bật.
   - Đầu trang luôn có **Kết thúc trận** (hỏi xác nhận).
5. **Bục vinh quang** Top 3 (pháo giấy, âm thanh), bảng xếp hạng đầy đủ, **📊 Xem báo cáo**, **Đóng phòng**.
6. **Lịch sử** (`/teacher/live`) và **báo cáo** (`/teacher/live/:matchId`):
   - số người chơi (khách), số câu, tỉ lệ đúng trung bình, hạng nhất;
   - bảng điểm có nhãn khách;
   - từng câu: phân bố lựa chọn, tỉ lệ đúng, thời gian trung bình, nhãn **🔥 Khó nhất**.

### Học sinh / khách (máy của em)
1. Vào `/live` (menu **⚔️ Đấu trường**, hoặc quét QR có sẵn `?pin=`), rồi nhập PIN:
   - **Học sinh đã đăng nhập:** vào thẳng.
   - **Chưa đăng nhập:** nếu phòng cho khách thì nhập **biệt danh**; nếu không thì được mời đăng nhập, và quay lại đúng phòng sau khi đăng nhập.
   - **Giáo viên mở `/live`:** được chỉ sang mục mở phòng.
2. `/live/play` (toàn màn hình), theo từng pha:
   - "Em đã vào phòng!" kèm tên;
   - đếm ngược;
   - trả lời: câu hỏi, ảnh, 🔊, đồng hồ, ô màu lớn; chọn xong hiện **"Đã chọn ✔️ Chờ các bạn…"**;
   - công bố: "Đúng rồi! +950 điểm", "Chưa đúng" hoặc "Hết giờ", ô đúng/sai, tổng điểm, hạng;
   - Top 5, và hạng của mình nếu nằm ngoài Top;
   - bục vinh quang;
   - các màn kết thúc: bị mời ra, đã vào từ máy khác, phòng đã đóng.
3. **F5 hoặc rớt mạng:**
   - Màn hình tự nối lại và vẽ lại đúng pha, đúng điểm, đúng câu đã chọn.
   - Trong lúc nối lại có băng "📶 Mất kết nối, đang kết nối lại... Điểm của em vẫn được giữ".
4. **Sau trận:** học sinh có tài khoản thấy lượt chơi trong **Bài đã làm** với nhãn **⚔️ Đấu trường**, có XP nếu vượt điểm cũ.

## Backend
- Module: `be/src/modules/live/`

| File | Việc |
| --- | --- |
| `live-room.machine.ts` | Máy trạng thái thuần `reduce(state, event, now)`: các pha, chấm, kick/chặn, vào lại, chờ người rớt mạng 10 giây |
| `live-scoring.ts` | Điểm câu đúng = `round(1000 × (1 − 0.5 × t/T))`, sai = 0; xếp hạng đồng hạng (1, 1, 3) |
| `live-room.registry.ts` | Các phòng trong RAM (`LiveRoom` = trạng thái + `meta`: quiz, câu hỏi đã xáo, lớp, khách, token khách); PIN; vòng tick 250 ms; dọn phòng |
| `live.views.ts` | Ảnh chụp `room:state` (từng người chơi) và `host:state` (màn chiếu) |
| `live.gateway.ts` | Namespace `/live`: bắt tay, sự kiện host/player, phát ảnh chụp |
| `live-auth.ts` | JWT khi bắt tay, trạng thái tài khoản, IP thật theo `TRUST_PROXY` |
| `live-access.service.ts`, `rate-limiter.ts` | Giới hạn dò PIN và giới hạn khách |
| `nickname.ts` | Kiểm tra và lọc biệt danh, đánh số khi trùng |
| `live-results.service.ts` | Ghi `live_matches` và các lượt `student_progress` (`mode: 'live'`) |
| `commands/`, `queries/`, `live.controller.ts` | REST: tạo phòng, lịch sử, báo cáo, kiểm tra PIN |

**REST**

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/live/matches` | Giáo viên/Admin | `{ quizId, classId?, questionTimeSec?: 10\|20\|30\|60, allowGuests?, autoAdvance? }` → `{ matchId, pin, playableCount, skippedCount }`. Quiz không có câu trắc nghiệm → 400; lớp không phải của mình → 404 |
| GET | `/live/matches?classId=` | Giáo viên/Admin | Lịch sử trận của mình (mới nhất trước, tối đa 100) |
| GET | `/live/matches/:id` | Chủ phòng/Admin | Báo cáo. Nếu báo cáo đang được ghi (vừa tới bục vinh quang) thì chờ ghi xong |
| GET | `/live/pin/:pin` | Công khai | `{ quizTitle, coverEmoji, className, allowGuests, started }`. PIN sai → 404; sai quá 10 lần/phút/IP → 429 |

**Sự kiện socket** (namespace `/live`). Mọi sự kiện client gửi lên đều nhận ack `{ ok: true, … }` hoặc `{ ok: false, error, message }`, trong đó `message` là câu tiếng Việt hiện cho người dùng.

| Hướng | Sự kiện | Dữ liệu / ack |
| --- | --- | --- |
| Client → | `session:whoami` | → `{ user, clientIp, serverNow }` |
| Host → | `host:attach` | `{ matchId }` → `{ state }`. Gọi lại sau mỗi lần nối lại. Chỉ chủ phòng hoặc admin |
| Host → | `host:start` · `host:next` · `host:end` · `host:kick { playerId }` | `next`: trả lời → công bố (bỏ qua giờ) → Top 5 → câu sau, hoặc bục vinh quang sau câu cuối. `end`: kết thúc sớm, hoặc đóng phòng khi đang ở sảnh chờ/bục vinh quang |
| Player → | `player:join` | `{ pin, nickname? }` → `{ playerId, rejoinToken? (khách), state }`. Có token = học sinh; không token = khách |
| Player → | `player:rejoin` | `{ pin, playerId, rejoinToken }` → `{ playerId, state }` (khách vào lại) |
| Player → | `player:answer` | `{ questionIndex, choice }` → `{ ok }` |
| → Host | `host:state` | Ảnh chụp màn chiếu: người chơi (online/đã trả lời), `answeredCount`/`onlineCount`, `standings` ở bục vinh quang |
| → Player | `room:state` | Ảnh chụp riêng: pha, câu hỏi (không đáp án), `phaseEndsAt`/`answerEndsAt`/`serverNow`, `reveal`, Top 5, `me` (điểm, hạng, lựa chọn, kết quả câu vừa công bố) |
| → Player | `player:kicked` · `player:replaced` · `room:closed` | Màn chơi chuyển sang màn kết thúc |

**Quy tắc nghiệp vụ**
- **Dạng câu (L1):** chỉ câu trắc nghiệm (kể cả có ảnh hay câu nghe). Thứ tự lựa chọn được xáo **một lần cho cả phòng** (hạt giống `matchId:questionId`), nên mọi máy giống nhau.
- **Ai được vào (L3, L9):**
  - Học sinh: đúng vai trò `student`; phòng gắn lớp thì phải thuộc lớp. Phòng gắn lớp hiện họ tên đầy đủ, phòng mở hiện "Anh N.".
  - Giáo viên/admin vào chơi → `students_only`.
  - Một tài khoản chỉ có một chỗ: tab hoặc máy mới thay chỗ cũ (`player:replaced`).
- **Khách (L11):**
  - Phòng phải bật khách.
  - Biệt danh dài 2–16 ký tự: chữ (có dấu), số, khoảng trắng.
  - Bộ lọc từ không phù hợp:
    - từ tiếng Việt có dấu được so nguyên từ, nên "Long", "Các", "Bùi", "Phúc" không bị chặn nhầm;
    - từ không dấu, kiểu viết số thay chữ (`sh1t`), chữ lặp và từ viết dính đều bị bắt.
  - Biệt danh trùng thì tự thêm số ("Mèo 2").
- **Giới hạn (L4, L11):**
  - Sai PIN quá 10 lần/phút thì khoá 1 phút. Đếm theo tài khoản với học sinh (cả trường chung một IP không chặn nhau), theo IP với người ẩn danh.
  - Khách: 20 lần vào phòng/phút/IP.
  - Tối đa 60 người mỗi phòng.
- **Vào lại (L10):**
  - Học sinh: gửi lại `player:join`, server trả đúng chỗ cũ theo `userId`.
  - Khách: `player:rejoin` với `rejoinToken`. Server chỉ lưu băm SHA-256 của token và so bằng `timingSafeEqual`.
  - **Người rớt mạng vẫn được chờ 10 giây** (`OFFLINE_GRACE_MS`) trước khi bị bỏ qua ở điều kiện "mọi người đã trả lời". Không có khoảng chờ này thì một em F5 làm cả lớp bị công bố đáp án sớm (lỗi tìm ra khi chạy thử trên trình duyệt).
- **Kick (L7):** người bị kick không vào lại được bằng cùng tài khoản hoặc biệt danh. Socket của em đó bị ngắt.
- **Lưu kết quả (L8, L12):**
  - Khi tới bục vinh quang: ghi `live_matches`, và ghi mỗi học sinh có tài khoản đã trả lời ít nhất 1 câu thành một `student_progress` (`mode: 'live'`, điểm = tỉ lệ câu đúng trên số câu đã công bố). Lượt này đi qua `recordAttempt`, nên XP "vượt điểm cũ" và mở trạm áp dụng như luyện tập.
  - Phòng bị đóng giữa chừng (bỏ quên): lưu `status: 'aborted'` với các câu đã công bố.
  - Khách chỉ có trong `live_matches`: biệt danh và điểm, không lưu IP. Báo cáo tự xoá sau **180 ngày** (TTL).
- **Bí mật đáp án:** ảnh chụp chỉ có `reveal.correctIndex` ở pha công bố. Học sinh không biết người khác đã trả lời: mỗi lần có người trả lời chỉ màn chiếu được cập nhật.

**Schema `live_matches`:** `hostId`, `quizId`, `quizTitle`, `coverEmoji`, `classId`, `className`, `status`, `settings`, `questions[]` (ảnh chụp chữ câu hỏi và lựa chọn, `distribution`, `correctRate`, `avgMs`), `players[]` (`userId?`, `nickname`, `isGuest`, `score`, `rank`, `answers[]`), `startedAt`, `endedAt`. Index `{hostId, endedAt}`, `{classId, endedAt}`, TTL theo `endedAt`.

**`student_progress.mode`** có thêm `'live'`.

## Frontend
- Feature `fe/src/features/live/`:
  - `types.ts` (khớp `live.views.ts`), `api/live.api.ts`.
  - `hooks/useLiveSocket.ts`: một socket mỗi màn; `onConnect` chạy lại sau mỗi lần nối lại.
  - `hooks/useHostSession.ts`, `hooks/usePlayerSession.ts`:
    - nối lại bằng `player:join` hoặc `player:rejoin`;
    - `sessionStorage` `enquiz.live.player` giữ `{ pin, nickname, playerId, rejoinToken }`;
    - lựa chọn hiện ngay trên màn hình (optimistic).
  - `hooks/useServerClock.ts`: đồng hồ theo giờ server.
  - `components/LiveBoards.tsx` (ô lựa chọn, biểu đồ, Top 5, bục vinh quang), `lib/options.ts` (màu và hình khớp `MultipleChoiceGame`).
  - Trang: `LiveJoinPage`, `LivePlayPage`, `LiveSetupPage`, `LiveHostPage` (QR bằng `qrcode`), `LiveHistoryPage`, `LiveReportPage`.
- **Route:**
  - `/live` và `/live/play`: công khai, ngoài `AppLayout`;
  - `/teacher/live/:matchId/host`: giáo viên, ngoài `AppLayout`;
  - `/teacher/live`, `/teacher/live/new`, `/teacher/live/:matchId`: giáo viên, trong `AppLayout`.
  - Mọi trang tải riêng khi dùng; `socket.io-client` không nằm trong bundle chính (~326 kB).
- **Menu:** "⚔️ Đấu trường" cho học sinh (`/live`) và cho giáo viên (`/teacher/live`). Lịch sử học sinh có nhãn "⚔️ Đấu trường".
- `shared/live/socket.ts`: `connectLive(token)`, `VITE_LIVE_URL`.

## Quyết định thiết kế
- **Gửi lại toàn bộ trạng thái thay vì sự kiện nhỏ lẻ:** sau mỗi thay đổi, mỗi màn nhận nguyên ảnh chụp của mình. Màn nối lại không cần thêm logic gì. Với 60 người, mỗi câu chỉ vài chục gói nhỏ; riêng lúc có người trả lời thì chỉ gửi cho màn chiếu.
- **Máy trạng thái thuần, tách khỏi socket:** mọi luật được test với đồng hồ giả, kể cả trong e2e (đồng hồ của registry bị cố định).
- **Trạng thái trong RAM, một instance (L2, D19):** server khởi động lại thì mất trận đang chơi. Phòng bỏ quên giữa trận được lưu dạng `aborted`.
- **Điểm tốc độ chỉ dùng trong trận:** lịch sử và XP tính theo tỉ lệ đúng (thang 100) để không làm lệch bảng xếp hạng tuần/tháng.
- **Chờ người rớt mạng 10 giây:** đổi từ quyết định ban đầu (L10 cũ: không chờ người mất kết nối) sau khi chạy thử.

## Kiểm thử
- **Unit** (`live/*.spec.ts`, 26 test):
  - máy trạng thái (đủ pha, đồng hồ đúng giờ hẹn, từ chối sai luật, chờ 10 giây người rớt mạng, không chờ người bị kick, tự chuyển, kết thúc sớm, vào lại, chặn người bị kick, giới hạn người, vào muộn);
  - điểm và xếp hạng;
  - registry; `clientIp`;
  - biệt danh (chặn từ xấu kể cả không dấu hoặc viết kiểu số thay chữ; **không** chặn nhầm 13 tên thật); đánh số khi trùng;
  - bộ giới hạn tần suất.
- **e2e** (socket thật trên cổng ngẫu nhiên):
  - `test/live.e2e-spec.ts` (6 test): bắt tay, từ chối token, CORS.
  - `test/live-match.e2e-spec.ts` (11 test):
    - mở phòng (chỉ câu trắc nghiệm, học sinh mở → 403);
    - chỉ chủ phòng điều khiển;
    - chỉ học sinh của lớp vào được, với họ tên đầy đủ;
    - câu hỏi không lộ đáp án;
    - điểm theo tốc độ, một lần chọn, công bố khi mọi người đã trả lời;
    - người chơi khác không biết ai đã trả lời;
    - vào lại đúng chỗ; tab mới thay tab cũ;
    - Top 5; kick và chặn;
    - kết thúc sớm chỉ tính câu đã công bố; báo cáo và lịch sử; `student_progress` `mode: 'live'` có XP; đóng phòng;
    - khách: biệt danh xấu hoặc quá ngắn bị từ chối, đánh số khi trùng; phòng mở hiện "An N.";
    - khách vào lại bằng token (token sai bị từ chối);
    - dò PIN bị chặn.
- **Trình duyệt** (Edge headless, dữ liệu tạm; màn chiếu 1366×768, tablet 820×1180, điện thoại 390×844):
  - giáo viên mở phòng có khách;
  - 2 học sinh và 1 khách vào; sảnh chờ hiện cả 3;
  - bắt đầu, đếm ngược, trả lời;
  - **học sinh F5 giữa câu** rồi vẫn trả lời được; **khách F5** vào lại bằng token;
  - công bố với biểu đồ; Top 5; bỏ qua giờ; kết thúc sớm; bục vinh quang có pháo giấy;
  - báo cáo, lịch sử, nhãn trong "Bài đã làm".
  - Không có lỗi console.
- **Thử tải** (`be/scripts/live-load.mjs`, cục bộ): **60 học sinh trong một phòng**, 3 câu.
  - Câu hỏi tới cả 60 máy trong ~5 ms sau khi giáo viên bấm; các máy lệch nhau 3–16 ms.
  - Phản hồi khi trả lời: median 3 ms, p95 5–14 ms.
  - 60/60 máy tới bục vinh quang.

## Hướng mở rộng / còn tồn đọng
- Thử trên Cloud Run thật (`deploy.md` mục 6, bước 8; chạy thêm `live-load.mjs` vào một DB thử).
- Redis adapter và lưu ảnh chụp trận khi cần nhiều instance hoặc không muốn mất trận khi server khởi động lại.
- Xuất báo cáo trận ra Excel; giao bài ôn cho các em sai nhiều câu.
- Thưởng chuỗi trả lời đúng; dạng câu khác (điền từ có gợi ý).
