# 05 – Kết quả, lịch sử, báo cáo giáo viên

> Giai đoạn: 1, cập nhật ở giai đoạn 2 · Trạng thái: Xong · Cập nhật: 2026-11-15

## Mục tiêu
Sau khi nộp, học sinh thấy ngay điểm, XP nhận được, có lên cấp/mở trạm mới không, và xem lại từng câu. Học sinh có lịch sử làm bài; giáo viên xem bảng kết quả quiz của mình.

## Luồng chính
1. `POST /progress/sessions/:id/finish` (tài liệu [04](04-play-quiz.md)) trả `AttemptResult` → chuyển tới `/attempts/:id`.
2. Màn kết quả:
   - 0–3 sao **đánh giá** bài (≥ 90: 3, ≥ 60: 2, > 0: 1) — chỉ hiển thị, không tích luỹ.
   - Điểm /100, số câu đúng, thời gian.
   - **⚡ +XP**, **🏅 Cấp**, tổng XP; banner **🎉 LÊN CẤP N!** + pháo giấy + nhạc khi vượt trạm lần đầu.
   - Nút **🔓 Trạm mới: …** nếu vừa mở khoá trạm kế tiếp. Chưa đạt 60 điểm thì nhắc điều kiện vượt trạm.
   - Danh sách xem lại từng câu (đáp án của em, đáp án đúng, giải thích).
3. `/history`: các lượt đã làm, nhãn **✓ Vượt trạm** / **Chưa đạt**, **⚡ +XP**.
4. Giáo viên: dashboard → **📊 Kết quả** → `/teacher/quizzes/:id/results`: lượt làm, số học sinh, điểm trung bình, bảng từng lượt (✓ = đạt).

## Backend
- Module: `be/src/modules/progress/`

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/progress/history` | Student | 100 lượt làm gần nhất |
| GET | `/progress/attempts/:id` | Học sinh làm bài / tác giả quiz / giáo viên của lớp em đang học / Admin | Chi tiết một lượt (404 nếu không có quyền) |
| GET | `/progress/quiz/:quizId` | Tác giả quiz / Admin | Mọi lượt làm của quiz (tối đa 500) |

- Query: `GetMyHistoryQuery`, `GetAttemptQuery`, `GetQuizResultsQuery` · Event: `QuizCompletedEvent` (handler ghi log; thêm handler mới cho side-effect sau này).
- Collection `student_progress`:

| Trường | Ghi chú |
| --- | --- |
| `studentId`, `quizId`, `assignmentId` | `assignmentId = null` (bài tập về nhà – giai đoạn 3) |
| `score` (0–100), `correctCount`, `totalQuestions` | |
| `passed` | `score ≥ 60` |
| `xpEarned` | phần cải thiện so với điểm cao nhất trước đó |
| `leveledUp`, `levelAfter` | vượt trạm lần đầu? cấp sau lượt này |
| `durationSec` | đo ở server |
| `details[] { questionId, studentAnswer, isCorrect }` | |
| `completedAt` | |

Index: `{ studentId, completedAt }`, `{ studentId, quizId, score }`, `{ completedAt, xpEarned }`.

`AttemptResult`:
```json
{
  "attemptId": "…", "quizId": "…", "quizTitle": "Khám phá sở thú", "coverEmoji": "🦁",
  "score": 83, "correctCount": 5, "totalQuestions": 6, "durationSec": 7, "completedAt": "…",
  "progression": {
    "passed": true, "xpEarned": 83, "leveledUp": true, "levelAfter": 2,
    "totalXp": 83,
    "unlockedQuiz": { "id": "…", "title": "Thế giới màu sắc", "coverEmoji": "🌈" }
  },
  "details": [{ "questionId": "…", "type": "multiple_choice", "questionText": "…", "studentAnswer": "Cat", "isCorrect": false, "correctAnswer": "Dog", "explanation": "…" }]
}
```
`totalXp` và `unlockedQuiz` chỉ có ngay sau khi nộp; mở lại từ lịch sử thì là `null`.

### Quy tắc chấm (`grading/graders.ts`)
- So sánh không phân biệt hoa thường, bỏ khoảng trắng thừa.
- Trắc nghiệm: bằng `correctAnswer`. Nối từ: **tất cả** cặp đúng, đủ số cặp, không nối một ô hai lần.
- Điền từ / Sắp xếp câu: bộ chấm có sẵn, chưa mở cho giáo viên tạo.
- Dữ liệu sai định dạng không bao giờ gây lỗi 500, chỉ tính sai.
- `score = round(đúng / tổng × 100)`.

## Frontend
- Feature: `fe/src/features/progress/`
- Route: `/attempts/:attemptId` (`AttemptPage`), `/history` (`HistoryPage`), `/teacher/quizzes/:quizId/results` (`QuizResultsPage`).
- `ResultView` + `ProgressionPanel` (XP, cấp, trạm mới; âm thanh + pháo giấy chỉ chạy khi `fresh`, tức là vừa nộp xong) + `AnswerReview` + `ScoreStars`.
- Ngay sau khi nộp, kết quả truyền qua router state (không gọi API lần hai); tải lại trang thì lấy từ `GET /progress/attempts/:id`.

## Quyết định thiết kế
- **Đã bỏ hẳn sao vàng/kim cương tích luỹ, avatar, cửa hàng** (quyết định giai đoạn 2). 3 ngôi sao trên màn kết quả chỉ là cách đánh giá một bài, không cộng dồn.
- Chấm ở server; xoá quiz/câu hỏi không xoá lịch sử (hiện "đã bị xoá").
- Query lịch sử/kết quả bỏ mảng `details` (projection) cho nhẹ.

## Kiểm thử
- Unit: `grading/graders.spec.ts` (9 test).
- e2e: lịch sử có `passed`/`xpEarned`, chi tiết lượt làm (học sinh khác → 404), bảng kết quả của giáo viên.

## Hướng mở rộng
- Điểm từng phần cho nối từ.
- Giai đoạn 3: thống kê "câu nhiều học sinh sai nhất", tiến độ theo lớp, xuất Excel.
