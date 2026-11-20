# 04 – Chơi quiz (phiên chơi & phản hồi tức thì)

> Giai đoạn: 1, nâng cấp ở giai đoạn 2 và 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Học sinh trả lời từng câu (trắc nghiệm, nối từ, điền từ, sắp xếp câu; có thể kèm ảnh và câu nghe) và **biết ngay đúng/sai** kèm âm thanh, đáp án đúng và giải thích. Giao diện to, sáng màu, dùng tốt trên máy tính bảng. Đáp án vẫn không bao giờ gửi xuống trình duyệt trước khi trả lời.

## Luồng chính
1. Từ bản đồ (tài liệu [07](07-progression-quest-map.md)) bấm một trạm đang mở → `/play/:quizId`.
2. Trình duyệt tải câu hỏi (`GET /quizzes/:id/play`, không có đáp án) và mở **phiên chơi** (`POST /progress/sessions`). Nếu học sinh đã có phiên dở của bài này thì **tiếp tục** đúng câu đang làm.
3. Mỗi câu:
   - **Trắc nghiệm**: chạm một ô là gửi ngay.
   - **Nối từ**: chạm ô trái rồi ô phải; nối đủ thì bấm **Kiểm tra ✔**.
   - **Điền từ**: có từ gợi ý thì chạm một từ để đặt vào chỗ trống (chạm lại để bỏ); không có thì gõ vào ô chữ to → **Kiểm tra ✔**.
   - **Sắp xếp câu**: chạm các thẻ để xếp lên dòng câu (chạm thẻ đã xếp để trả về); xếp hết thì **Kiểm tra ✔**.
   - Câu có ảnh: ảnh hiện to phía trên. Câu **nghe**: nút 🔊 tròn to phát file MP3 do server tạo (D16), tự phát một lần khi hiện câu (nếu đang bật âm thanh) và phát lại mỗi lần chạm. Câu nghe chưa có âm thanh (`audioPending`) hiện "Chưa nghe được câu này".
   - Server chấm → hiện xanh/đỏ, "ting-ting" hoặc "boop" nhẹ, đáp án đúng + 💡 giải thích. **Câu đã trả lời không đổi được.**
4. **Câu tiếp theo →**. Thanh trên cùng: tiến độ, số câu đúng, chuỗi 🔥 khi đúng ≥ 3 câu liên tiếp. **← Xem lại** để xem lại câu trước (chỉ đọc).
5. Câu cuối → **Xem kết quả 🏁** → `POST /progress/sessions/:id/finish` → màn kết quả (tài liệu [05](05-progress-results.md)).
6. Bấm ✕ để thoát: phiên được giữ **24 giờ** trên server, vào lại là chơi tiếp.
7. Giáo viên/admin mở `/play/:id` (nút **Chơi thử**) ở **chế độ xem thử**: cùng giao diện, không chấm, không lưu, không bị khoá trạm.

## Backend
### Dữ liệu chơi
`GET /api/v1/quizzes/:id/play` (Query `GetPlayQuizQuery`, module Quizzes):

```json
{
  "id": "…", "title": "Khám phá sở thú", "topic": "Animals", "gradeLevel": 1, "coverEmoji": "🦁",
  "questions": [
    { "id": "…", "type": "multiple_choice", "questionText": "🐶 What animal is this?", "options": ["Cat", "Dog", "Duck"] },
    { "id": "…", "type": "matching", "questionText": "Match…", "matching": { "lefts": ["🐶", "🐱"], "rights": ["cat", "dog"] } },
    { "id": "…", "type": "fill_in_blank", "questionText": "I have a ___.", "mediaUrl": "/api/v1/uploads/images/….png", "options": ["sun", "cat", "fish"] },
    { "id": "…", "type": "ordering", "questionText": "Sắp xếp thành câu đúng", "ordering": { "items": ["cat", "I", "my", "like"] } },
    { "id": "…", "type": "multiple_choice", "questionText": "Nghe và chọn", "audioUrl": "/api/v1/uploads/audio/3f2a….mp3", "options": ["🐔", "🦆"] }
  ]
}
```
- Projection chỉ lấy trường cần cho trò chơi → **không có** `correctAnswer`, `pairs`, `explanation`. Riêng câu sắp xếp, server đọc `correctAnswer` chỉ để xáo thành `ordering.items` (luôn khác thứ tự đúng khi có thể) và không trả về.
- Điền từ: `options` là từ gợi ý đã xáo (không có = học sinh tự gõ); đáp án được chấp nhận không gửi xuống.
- Lựa chọn trắc nghiệm và cột phải nối từ luôn xáo ở server; thứ tự câu xáo nếu `settings.shuffleQuestions`.
- Học sinh gọi trạm đang khoá → **403** (hỏi Progress qua `IsQuizUnlockedQuery`).

### Phiên chơi (module Progress)

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/progress/sessions` `{ quizId, assignmentId? }` | Student | Mở hoặc tiếp tục phiên; trả `{ sessionId, quizId, startedAt, answers[] }`. 403 nếu trạm khoá. Có `assignmentId` = làm bài tập về nhà, không khoá trạm (tài liệu [11](11-assignments.md)) |
| POST | `/progress/sessions/:id/answers` `{ questionId, studentAnswer }` | Student (chủ phiên) | Chấm ngay, trả `{ questionId, studentAnswer, isCorrect, correctAnswer, explanation, alreadyAnswered }`. `studentAnswer`: chuỗi (trắc nghiệm, điền từ), `{left,right}[]` (nối từ), `string[]` (sắp xếp) |
| POST | `/progress/sessions/:id/finish` | Student (chủ phiên) | Lưu lượt làm, cập nhật cấp/XP, trả `AttemptResult` |

- Command: `StartQuizSessionCommand`, `AnswerQuestionCommand`, `FinishQuizSessionCommand`.
- Collection `quiz_sessions`: `studentId`, `quizId`, `answers[] { questionId, studentAnswer, isCorrect }`, `startedAt`, `expiresAt`.
  - Index unique `{ studentId, quizId, assignmentId }` → mỗi học sinh chỉ một phiên mở cho mỗi bài trong mỗi ngữ cảnh (bản đồ: `assignmentId = null`, hoặc một bài tập); mở bằng upsert nên bấm 2 lần cũng không tạo 2 phiên.
  - Index **TTL** trên `expiresAt` (24h) → MongoDB tự xoá phiên bỏ dở.
- Quy tắc:
  - **Câu trả lời đầu tiên là cuối cùng**: ghi bằng `$push` có điều kiện `answers.questionId $ne` → hai request song song thì chỉ request đầu được tính; trả lời lại trả về kết quả cũ với `alreadyAnswered: true`.
  - Câu không thuộc bài → 400. Phiên của người khác / hết hạn → 404.
  - `finish` **xoá phiên trước** (claim) rồi mới lưu → bấm nộp 2 lần không tạo 2 lượt làm (lần 2 trả 404).
  - Câu chưa trả lời khi nộp tính **sai**.
  - Thời gian làm bài đo ở **server** (`startedAt` → lúc nộp).

## Frontend
- Feature: `fe/src/features/play/`
  - `pages/PlayPage.tsx`: tải câu hỏi, chọn `StudentGame` (học sinh) hoặc `PreviewGame` (giáo viên).
  - `components/StudentGame.tsx`: mở phiên, giữ `feedback` theo câu, gửi từng câu, nộp bài, làm mới profile (cấp/XP ở header).
  - `MultipleChoiceGame`, `MatchingGame`: nhận `correctAnswer` / `correctPairs` để tô xanh/đỏ sau khi chấm; được truyền làm `children` của `QuestionStage`.
  - `FillBlankGame`, `OrderingGame`: có nút **Kiểm tra** riêng, do `QuestionStage` hiển thị khi được truyền `onSubmit` (+ `feedback` sau khi chấm, hoặc `submitted` ở chế độ xem thử). Sau khi chấm tự hiện đáp án đúng (đáp án đầu tiên / câu đúng) nên `FeedbackBanner` không lặp lại.
  - `ListenButton`: phát `audioUrl` (giọng `TTS_LANGUAGE`, tốc độ 0.85). Dữ liệu chơi **không bao giờ** chứa `audioText`. Thiếu âm thanh → học sinh thấy thông báo, giáo viên xem thử thấy cách khắc phục.
  - `FeedbackBanner` (lời khen/động viên, không bao giờ trách), `PlayTopBar` (tiến độ, ✅, 🔥), `QuestionStage` (ảnh, nút nghe, chỗ trống được tô, hiệu ứng chuyển câu 0.22s).
  - `lib/answers.ts`: `isAnswered` cho cả 4 dạng; chuẩn hoá so sánh giống bộ chấm ở server.
- Không còn lưu đáp án ở localStorage: **server là nơi giữ tiến trình** (giai đoạn 1 dùng `usePlayStore`, đã bỏ).
- Âm thanh qua `playSfx(...)` (tài liệu [09](09-sound-and-effects.md)).

- **Dùng lại trong phòng thi (4.2, tài liệu 14):** `MultipleChoiceGame`, `MatchingGame`, `FillBlankGame`, `OrderingGame` và `QuestionStage` được xuất qua `features/play/index.ts`.
  - `FillBlankGame` và `OrderingGame` có thêm chế độ điều khiển từ ngoài (`value` + `onChange`): không có nút **Kiểm tra**, báo mỗi lần thay đổi, không chấm.
  - `MultipleChoiceGame` nhận `selectedIcon` (⏳ khi luyện tập, ✔️ khi kiểm tra).
- `toPlayQuestion(q, random)` ở backend nhận bộ sinh số ngẫu nhiên: bài kiểm tra truyền bộ có hạt giống `sessionId:questionId` để F5 không đổi chỗ đáp án.

## Quyết định thiết kế
- **Phiên ở server thay cho nộp một lần**: muốn phản hồi tức thì mà không lộ đáp án thì server phải chấm từng câu; muốn chống "thử từng đáp án" thì câu trả lời đầu phải bị khoá → cần lưu trạng thái ở server. Endpoint nộp một lần `POST /progress/submit` của giai đoạn 1 **đã bỏ** để không thể vòng qua luật này.
- Học sinh có thể bỏ phiên, mở phiên mới và làm lại khi đã biết đáp án — chấp nhận được vì làm lại là học; XP chỉ tính phần **cải thiện điểm** nên không "cày" được (tài liệu 07).
- **Chạm-để-nối thay cho kéo thả**: dễ với tay trẻ nhỏ, chạy tốt trên tablet, dùng được bằng bàn phím/screen reader.
- Trắc nghiệm gửi ngay khi chạm (không có nút xác nhận) cho nhịp chơi nhanh như game. Điền từ và sắp xếp cần nút **Kiểm tra** vì câu trả lời được ghép từ nhiều thao tác.
- **Sắp xếp theo vị trí thẻ (index), không theo chữ**: câu có từ lặp ("the … the") vẫn chạm đúng thẻ.
- **Câu nghe tự đọc chỉ khi đang bật âm thanh** (nút 🔊 ở header): lớp học đông thường tắt tiếng; nút đọc lại luôn dùng được.

## Kiểm thử
- e2e `be/test/phase3.e2e-spec.ts` (`new question types…`): payload không lộ `correctAnswer`/đáp án điền từ, thẻ sắp xếp đã xáo, điền từ chấp nhận đáp án phụ không phân biệt hoa thường, sắp xếp sai trả câu đúng.
- e2e (`be/test/app.e2e-spec.ts`, nhóm `progress: sessions…`): payload `/play` không lộ đáp án; giáo viên không mở phiên được (403); phản hồi tức thì; trả lời lại không đổi kết quả; câu ngoài bài 400; phiên người khác 404; tiếp tục phiên; nộp hai lần → 404; câu bỏ trống tính sai.
- Chạy thử trên trình duyệt (tablet 820×1180): sai câu 1 → banner đỏ + đáp án + giải thích, nối từ → xanh + "Xuất sắc!", chuỗi 🔥, nộp → lên cấp.

## Hướng mở rộng
- Câu hỏi có đồng hồ đếm ngược (trắc nghiệm nhanh).
- Thi đấu trực tiếp nhiều người qua Socket.io (giai đoạn 3).
