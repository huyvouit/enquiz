# 14 – Chế độ Kiểm tra (Exam Mode)

> Giai đoạn: 4 (mốc 4.2) · Trạng thái: **Xong** (code + kiểm thử; chưa chạy trên môi trường deploy) · Cập nhật: 2026-11-20 · Quyết định E1–E13 ở [phase-4-plan.md](../phase-4-plan.md), mục 2

## Mục tiêu
- Giáo viên giao một quiz dạng **bài kiểm tra**: có giờ, làm một lần, chỉ chấm khi nộp.
- Học sinh làm trong một **phòng thi** tập trung:
  - thanh tiến độ, đồng hồ đếm ngược;
  - đi lại giữa các câu, đánh dấu câu phân vân;
  - rà soát trước khi nộp.
- Sau khi nộp, học sinh thấy điểm và đúng/sai từng câu, kèm đáp án đúng và giải thích (theo cài đặt của giáo viên).

Chế độ hiện có (phản hồi ngay từng câu, câu đầu tiên là câu cuối cùng) gọi là **Luyện tập** (`classic`). Bản đồ trạm và bài tập Luyện tập **giữ nguyên**.

**Phạm vi 4.2:** Exam chỉ có qua **bài tập** (`assignment.mode = 'exam'`).
- Challenge ngẫu nhiên để giai đoạn sau. Schema đã chừa chỗ (`kind`).
- Không có Exam cho "quiz giáo viên tạo" đứng riêng: theo D1/D2, học sinh chỉ thấy quiz của giáo viên khi được giao bài.

---

## Luồng chính

### Giáo viên
1. Lớp → **Bài tập** → **📬 Giao bài**. Có thêm 3 lựa chọn:
   - **Chế độ:** Luyện tập (mặc định) / **Kiểm tra**.
   - **Thời gian làm bài:** 1–90 phút. Mặc định lấy thời gian gợi ý của quiz (`quiz.settings.timeLimitSec`, đặt ở trình tạo quiz), nếu không có thì 15 phút. Bắt buộc với Kiểm tra.
   - **Cho xem đáp án:** *Ngay sau khi nộp* (mặc định) / *Sau hạn nộp*.
     - Chọn *Sau hạn nộp* khi muốn các em nộp trước không chuyển đáp án cho bạn.
     - Điểm và đúng/sai từng câu luôn hiện ngay.
2. Với quiz hệ thống (có trên bản đồ), hộp thoại nhắc: *"Quiz này có trên bản đồ, học sinh có thể đã luyện trước."*
3. Bảng nộp bài có thêm 2 nhãn:
   - **⏱ Tự nộp:** hết giờ, hệ thống nộp thay.
   - **✍️ Đang làm:** kèm giờ còn lại (bảng trong tab Bài tập) hoặc giờ hết hạn (trang kết quả bài tập).
   - Hộp "Gia hạn" của bài kiểm tra có thêm lựa chọn "Cho xem đáp án".
4. Tab Thống kê và bản đồ nhiệt giữ nguyên.

### Học sinh
1. **Trang chủ và Bài tập của em:** bài kiểm tra có nhãn **📝 Kiểm tra · 15 phút**. Nút **📝 Làm bài kiểm tra** / **Làm tiếp ⏱** / **📊 Xem kết quả** mở `/exam/:assignmentId`.
2. **Màn giới thiệu** (chưa bắt đầu tính giờ):
   - Hiện số câu, thời gian, *"Em chỉ được làm 1 lần"*, và *"Đồng hồ vẫn chạy khi em thoát ra"*.
   - Nếu hạn nộp đến sớm hơn lúc hết giờ làm, có thêm cảnh báo: *"Còn 5 phút là đến hạn: nộp sau giờ này sẽ tính nộp muộn"*.
   - Nút **Bắt đầu làm bài**.
3. **Phòng thi** (toàn màn hình, ẩn menu của AppLayout):
   - **Thanh trên:**
     - Tên bài.
     - Thanh tiến độ "Đã làm 6/10".
     - Nút **🚩 Đánh dấu** cho câu đang xem.
     - Nút **☰ Danh sách câu**: lưới số câu, mỗi ô có màu theo trạng thái đã làm / bỏ trống / đánh dấu; chạm vào để nhảy tới câu đó.
     - Đồng hồ `mm:ss`: còn ≤ 2 phút thì chuyển màu cam; còn ≤ 1 phút thì đỏ và nhấp nháy nhẹ (tắt nhấp nháy khi máy bật `prefers-reduced-motion`).
   - **Vùng câu hỏi:**
     - "Câu 3 / 10", đề bài, ảnh và nút 🔊 nếu có.
     - Thẻ đáp án lớn, có viền đậm và dấu ✔️ khi đã chọn.
     - Dòng nhỏ dưới thanh tiến độ báo "Đã lưu ✓ / Đang lưu… / Đã ghi trên máy".
     - Không có phản hồi đúng/sai, không có nút "Kiểm tra".
   - **Thanh dưới:**
     - **← Câu trước**, **Câu tiếp →**. Ở câu cuối, "Câu tiếp" đổi thành **Xem lại bài**.
     - **Nộp bài** ở góc phải, khác màu, cách xa "Câu tiếp". Trên điện thoại (< 640px), "Nộp bài" nằm ở thanh trên để thanh dưới chỉ còn Câu trước / Câu tiếp.
4. **Nộp bài** mở hộp thoại rà soát:
   - "Em đã làm 8/10 câu".
   - Danh sách câu **bỏ trống** và câu **🚩 đánh dấu**, chạm để quay lại.
   - Hai nút: **Làm tiếp** / **Nộp bài**.
5. **Hết giờ:** khoá thao tác, tự nộp, rồi chuyển sang kết quả.
6. **Kết quả:**
   - Điểm, số câu đúng/sai, thời gian làm.
   - Danh sách từng câu: câu hỏi, em chọn gì, đúng/sai.
   - Đáp án đúng và 💡 giải thích: hiện ngay, hoặc hiện dòng "Đáp án sẽ hiện sau hạn nộp dd/mm hh:mm".
7. **F5, đóng tab, đổi máy:** mở lại bài thì vào tiếp đúng câu đang làm, với đáp án đã chọn và giờ còn lại. Đồng hồ không dừng.

---

## Backend

### Module
`be/src/modules/exams/`, theo CQRS như các module khác.

**Chiều phụ thuộc:** `exams → assignments, progress, quizzes, questions`.
- Assignments và analytics **không import** exams. Khi cần chốt bài quá giờ, hai module này gọi `FinalizeExpiredExamsCommand` qua `CommandBus` và `await` (D13).

### Endpoint

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/exams/assignments/:assignmentId` | Student (được giao) | Màn giới thiệu `ExamIntroView`: tên, số câu, thời gian, hạn nộp, lời nhắn, `reveal`, `closed`, `state: not_started\|in_progress\|submitted`, `sessionId`, `serverNow` |
| POST | `/exams/start` | Student | `{ assignmentId }`. **Bắt đầu hoặc vào tiếp.** Trả `ExamSessionView`. Đã nộp → 409 (frontend mở kết quả qua `sessionId` của màn giới thiệu); bài đã đóng và chưa bắt đầu → 409 |
| PATCH | `/exams/:id/answers` | Student (chủ phiên) | Lưu nháp `{ answers: [{questionId, answer}], flagged: [questionId] }`. Quá `deadlineAt + ân hạn` → 409 |
| POST | `/exams/:id/submit` | Student (chủ phiên) | `{ answers, flagged?, isAutoSubmit }` → chấm một lần, trả `ExamResultView` |
| GET | `/exams/:id` | Student (chủ phiên) | Đang làm → `ExamSessionView`; đã nộp → `ExamResultView` (đáp án theo `reveal`) |

Thay đổi ở endpoint sẵn có:
- `POST /classes/:classId/assignments`, `PATCH /assignments/:id`: thêm `mode`, `timeLimitSec`, `reveal`.
  - Chỉ đổi được `mode` và `timeLimitSec` **khi chưa em nào bắt đầu**.
  - `reveal` đổi lúc nào cũng được.
- `GET /assignments/mine`, `/mine/reminders`: thêm `mode`, `timeLimitSec`, `reveal`, và `exam: { state: 'in_progress'|'submitted', sessionId, deadlineAt } | null` (null = chưa bắt đầu). Số câu đã có ở `quiz.questionCount`.
- `GET /assignments/:id` (bảng nộp bài): mỗi em thêm `isAutoSubmit` và `inProgress: { deadlineAt }`.
- `AssignedQuizIdsQuery` bỏ qua bài kiểm tra: quiz của giáo viên chỉ được giao dạng kiểm tra thì học sinh không mở được `GET /quizzes/:id/play` để xem trước đề.
- `POST /progress/sessions` (Luyện tập) bị từ chối 409 khi:
  - `assignmentId` là bài kiểm tra: *"Đây là bài kiểm tra, em mở từ mục Bài tập nhé"*;
  - em đang có phiên kiểm tra **chưa nộp** trên cùng quiz (chống mở tab Luyện tập để xem đáp án).

### Payload
```ts
ExamSessionView {
  sessionId, assignmentId, quizId, title, coverEmoji, status, timeLimitSec,
  startedAt, deadlineAt, serverNow,          // đồng hồ: deadlineAt − serverNow, hiệu chỉnh lệch giờ máy
  questions: PlayQuestion[],                  // không có correctAnswer, explanation, audioText
  answers: { questionId, answer }[],          // nháp đã lưu trên server
  flagged: string[], draftSavedAt
}
ExamResultView = AttemptResult + {           // dùng lại ResultView/AnswerReview ở frontend
  sessionId, assignmentId, status: 'submitted'|'timed_out',
}
// AttemptResult có thêm: mode, isAutoSubmit,
// answersHiddenUntil: Date | null           // khác null → details không có correctAnswer/explanation/audioText
ExamStateView = { status, session: ExamSessionView | null, result: ExamResultView | null }   // GET /exams/:id
```

### Schema
**`exam_sessions` (mới, không có TTL: đây là bằng chứng "đã dùng lượt")**
```ts
studentId, assignmentId, quizId: ObjectId
kind: 'assignment'                     // để chừa cho 'challenge' sau này
questionIds: ObjectId[]                // ảnh chụp lúc bắt đầu, đúng thứ tự em thấy
timeLimitSec: number                   // ảnh chụp từ assignment/quiz
startedAt, deadlineAt: Date            // deadlineAt = startedAt + timeLimitSec
status: 'in_progress' | 'submitted' | 'timed_out'
answers: { questionId, answer: Mixed }[]   // nháp, rồi bản chính thức khi nộp
flagged: ObjectId[]
draftSavedAt?, submittedAt?: Date
isAutoSubmit: boolean
progressId?: ObjectId                  // student_progress được tạo khi chấm
```
Index:
- `{ assignmentId, studentId }` **unique**: khoá 1 lượt (E8), và chặn được bấm "Bắt đầu" hai lần.
- `{ studentId, status }`: tìm phiên đang làm.
- `{ status, deadlineAt }`: tìm phiên quá giờ để chốt.

**`assignments`** thêm:
- `mode: 'classic'|'exam'` (thiếu = `classic`)
- `timeLimitSec?`
- `reveal: 'after_submit'|'after_due'` (mặc định `after_submit`)

**`quizzes`** thêm `settings.timeLimitSec?` (giây, null = không gợi ý): thời lượng gợi ý, giáo viên đặt ở trình tạo quiz.

**`student_progress`** thêm:
- `mode: 'classic'|'exam'` (thiếu = `classic`)
- `isAutoSubmit: boolean`
- Bài kiểm tra luôn ghi `xpEarned = 0`, `leveledUp = false`.

### Quy tắc nghiệp vụ
- **Bắt đầu** (`POST /exams/start`):
  1. Chốt phiên quá giờ của em nếu có.
  2. Đã có phiên cho `{assignmentId, studentId}`: đang làm → trả phiên đó (kể cả khi giáo viên vừa đóng bài); đã nộp → 409.
  3. Chưa có: em phải thuộc bài, bài phải là `exam` (không thì 404) và đang mở (không thì 409).
  4. `questionIds` lấy theo quiz lúc bắt đầu. Nếu quiz bật `shuffleQuestions` thì xáo **một lần** rồi lưu.
  5. Tạo phiên; nếu hai request cùng tạo, index unique làm request sau lỗi trùng khoá và request đó trả lại phiên của request trước.
- **Thứ tự lựa chọn cố định cho mỗi phiên (E10):**
  - Hiện nay `toPlayQuestion` xáo đáp án mỗi lần gọi; với Exam, F5 sẽ làm đáp án đổi chỗ.
  - Exam xáo bằng **hạt giống `sessionId + questionId`**, nên cùng phiên thì luôn ra cùng thứ tự.
- **Lưu nháp:** chỉ khi `status = in_progress` và `now ≤ deadlineAt + EXAM_GRACE_MS`. Ghi đè cả mảng; giới hạn số phần tử bằng số câu.
- **Nộp:** đổi trạng thái nguyên tử (`findOneAndUpdate({_id, status:'in_progress'}, …)`), nên bấm đúp không tạo hai kết quả.
  - `now ≤ deadlineAt + EXAM_GRACE_MS` (10 giây): chấm `answers` vừa gửi, `status = submitted`.
  - Quá ân hạn: **bỏ qua** `answers` vừa gửi, chấm **nháp đã lưu trên server**, `status = timed_out`, `isAutoSubmit = true`.
  - Chỉ chấm câu thuộc `questionIds`; questionId lạ bị bỏ qua.
  - Câu đã bị xoá khỏi kho: không tính vào tổng. Câu bị sửa giữa giờ: chấm theo nội dung hiện tại (rủi ro chấp nhận được).
  - Dùng `gradeAnswer` có sẵn cho cả 4 dạng. Câu nghe là trắc nghiệm hoặc điền từ có âm thanh.
  - Ghi **một** `student_progress` (`mode: 'exam'`, `durationSec = submittedAt − startedAt`, tối đa bằng `timeLimitSec`), rồi lưu `progressId` vào phiên.
  - Nếu ghi kết quả lỗi, phiên được trả về `in_progress` để lần nộp sau (hoặc lần chốt sau) chấm lại.
  - Nộp lần hai (đồng hồ và nút cùng lúc) trả lại đúng kết quả đã có.
- **Chốt phiên quá giờ (E5):** `FinalizeExpiredExamsCommand({ studentId? })` chấm nháp đã lưu của các phiên `in_progress` có `deadlineAt + ân hạn < now` (mỗi lần tối đa 50 phiên, theo index `{status, deadlineAt}`).
  - Chạy (có `await`) trong `AssignmentSubmissionsService.attempts()`, nên mọi màn đọc trạng thái nộp bài đều đi qua: danh sách bài, bảng nộp bài, `/assignments/mine`, `/mine/reminders`, tổng quan lớp, bảng điểm, báo cáo học sinh, xuất file. Bản đồ nhiệt của analytics cũng gọi trước khi tính.
  - Màn giới thiệu, `POST /exams/start` và `GET /exams/:id` chốt phiên của chính em.
  - Phiên bị server chốt được tính **nộp lúc `deadlineAt`**, không phải lúc server phát hiện: em làm đúng hạn không bị tính muộn chỉ vì không ai mở trang.
  - Không cần job chạy nền.
- **Đúng hạn/muộn:** giữ nguyên D7, so `completedAt` (lúc nộp) với `dueDate`. Không cần cập nhật gì ở bài tập.
- **Giáo viên đóng bài** khi có em đang làm: em đó vẫn nộp được tới `deadlineAt`; em chưa bắt đầu thì không bắt đầu được nữa.
- **Tiến trình bỏ qua bài kiểm tra (E4):** mọi truy vấn của `ProgressionService` (điểm cao nhất, `passed`, mở trạm, cấp độ) lọc `mode: {$ne: 'exam'}`.
  - Bài tập, thống kê, bản đồ nhiệt và lịch sử vẫn **gồm** bài kiểm tra.
  - Bảng xếp hạng không bị ảnh hưởng vì `xpEarned = 0`.
- **Ẩn đáp án theo `reveal`:**
  - Áp dụng cho kết quả nộp bài, `GET /exams/:id` và `GET /progress/attempts/:id`.
  - Khi `reveal = after_due` và `now < dueDate`: bỏ `correctAnswer`, `explanation`, `audioText`.
  - Giáo viên luôn thấy đầy đủ.

---

## Frontend
- Feature mới `fe/src/features/exam/`:
  - `pages/ExamPage.tsx`: một route, ba màn **Giới thiệu → Phòng thi → Kết quả**.
  - `components/`: `ExamIntro`, `ExamRoom` (thanh trên, vùng câu hỏi, thanh dưới), `Countdown`, `QuestionGrid` (trong `Modal`), `SubmitReviewDialog`.
  - Phần kết quả dùng lại `ResultView` + `AnswerReview` (feature progress).
  - `hooks/`:
    - `useExamClock(deadlineAt, serverNow)`: đếm ngược theo giờ server; độ lệch tính một lần lúc tải.
    - `useExamDraft(session)`: lưu `localStorage` (`enquiz.exam.<sessionId>`) ngay mỗi thao tác; lưu lên server khi chuyển câu, khi đánh dấu, khi tab bị ẩn, và debounce 10 giây; báo nhỏ "Đã lưu ✓ / Đang lưu… / Đã ghi trên máy". Nộp xong thì xoá bản local.
    - `useLeaveGuard(active)`: `beforeunload`, cộng với `useBlocker` của React Router (router đã là `createBrowserRouter`).
  - `api/exam.api.ts` (`examKeys`, `examApi`). `ExamPage` dùng `useQuery` cho màn giới thiệu và kết quả cũ, `useMutation` cho bắt đầu; tất cả `gcTime: 0` vì đồng hồ và nháp phải luôn lấy từ server. Nộp bài xong thì làm mới cache bài tập, lịch sử và nhắc nhở.
  - Phiên đang làm (F5, mở lại) vào thẳng phòng thi, không qua màn giới thiệu.
- Route `/exam/:assignmentId` nằm trong `RequireAuth` nhưng **ngoài `AppLayout`**, để có màn hình tập trung.
- **Game điều khiển từ ngoài:** `MultipleChoiceGame` và `MatchingGame` đã có `value/onChange`. `FillBlankGame` và `OrderingGame` có thêm chế độ điều khiển (`value` + `onChange`): không có nút "Kiểm tra", báo mỗi lần đổi. Câu sắp xếp mới xếp một phần vẫn được lưu (chấm sai).
- **Cảnh báo rời trang:**
  - Bật khi phiên `in_progress`; tắt **trước** khi chuyển sang kết quả.
  - Lời nhắc trong app: *"Em đang làm bài kiểm tra. Bài đã được lưu, nhưng đồng hồ vẫn chạy. Em có muốn thoát không?"*
  - Lời nhắc khi đóng tab do trình duyệt tự hiển thị; không đổi được chữ.
- **Khôi phục:**
  - Lấy phiên từ server (`POST /exams/start`).
  - Ghép nháp local nếu `savedAt` local mới hơn `draftSavedAt` của server.
  - Chuyển tới câu cuối đang xem (lưu ở local).
- **Tablet/điện thoại:**
  - Nút điều hướng cao ≥ 56px, cách nhau ≥ 12px. Thanh dưới cố định, có `env(safe-area-inset-bottom)`.
  - Thẻ đáp án ≥ 64px, chữ ≥ 20px.
  - "Nộp bài" không đứng cạnh "Câu tiếp" trên màn hình hẹp: Nộp bài ở thanh trên, Câu tiếp ở thanh dưới.
  - Không có thao tác nào chỉ dùng được bằng vuốt.
- **Phía giáo viên:**
  - `AssignDialog`: thêm chế độ, thời gian, cho xem đáp án.
  - `SubmissionTable` (tab Bài tập) và bảng nộp bài ở `AssignmentReportPage` (analytics): thêm nhãn ⏱ Tự nộp và ✍️ Đang làm.
  - `QuizBuilderPage`: thêm "Thời gian gợi ý".
- **Phía học sinh:** `MyAssignmentsPage`, `ReminderBanner`: nhãn 📝 và link `/exam/:assignmentId`. Lịch sử: nhãn "Kiểm tra".

---

## Quyết định thiết kế
- **Collection riêng `exam_sessions`** thay vì thêm `mode` vào `quiz_sessions`:
  - Hai loại phiên có vòng đời khác nhau. `quiz_sessions` bị TTL xoá và bị xoá khi nộp; phiên kiểm tra phải **còn mãi** để khoá 1 lượt và để biết đã nộp hay tự nộp.
  - Không phải viết điều kiện theo mode trong các handler `/answers` và `/finish`.
- **Kết quả vẫn ghi vào `student_progress`**, không chỉ nằm trong phiên:
  - Trạng thái D7, bảng điểm, bản đồ nhiệt, báo cáo học sinh và lịch sử đều đọc từ đây.
  - Nếu kết quả chỉ nằm trong `exam_sessions`, mọi truy vấn trên phải gộp hai collection.
  - `exam_sessions` chỉ giữ bài làm thô và trạng thái phiên.
- **Lưu nháp lên server** (đổi so với bản kế hoạch đầu, vốn chấm 0 điểm khi em đóng tab):
  - Học sinh tiểu học hay lỡ đóng tab, tablet hết pin, và Safari trên iPad không phải lúc nào cũng chạy `beforeunload`.
  - Có nháp ở server thì phiên quá giờ được chấm theo những gì em đã làm, và đổi máy vẫn làm tiếp được.
  - Chi phí: 30 em × 1 lần ghi mỗi 10 giây ≈ 3 lần ghi/giây, Atlas chịu được.
- **Nộp quá ân hạn thì chấm nháp đã lưu, không chấm bài gửi lên muộn:**
  - Nếu chấm bài gửi muộn, em có thể giữ trang (hoặc tắt JS) để có thêm giờ.
  - Server phải là nơi quyết định thời gian.
- **Không có điểm riêng cho từng câu** (`earnedPoints`): giữ thang 100 theo tỉ lệ câu đúng như hiện nay. Câu nhiều điểm hơn để giai đoạn sau nếu giáo viên cần.
- **Exam bắt buộc có giờ:**
  - Không giới hạn giờ thì không có điểm dừng để tự chốt.
  - Giáo viên muốn "làm tập trung, không giờ" thì đặt 90 phút.
- **Màn giới thiệu trước khi tính giờ:** tránh trường hợp em lỡ chạm vào bài và mất lượt.

---

## Kiểm thử
- **Unit** (`exams/exam-rules.spec.ts`, 12 test; `assignment-status.spec.ts`, 2 test mới):
  - `deadlineAt`, ân hạn 10 giây; phiên server chốt được tính nộp lúc `deadlineAt`; thời gian làm không vượt `timeLimitSec`.
  - Xáo theo hạt giống: cùng hạt giống cùng thứ tự, khác hạt giống khác thứ tự; câu sắp xếp vẫn không trùng thứ tự đúng.
  - Làm sạch đáp án (4 dạng, bỏ dạng lạ / quá dài / rỗng, giữ câu trả lời cuối của mỗi câu, bỏ câu không thuộc đề) và đánh dấu.
  - Chấm cả bài: câu trống tính sai, câu đã xoá không tính vào tổng.
  - `answersHiddenUntil` theo `mode`/`reveal`/hạn nộp; `isAutoSubmit` trong trạng thái nộp bài.
- **e2e** (`test/exam.e2e-spec.ts`, 18 test):
  - Giao bài: thời gian ngoài 1–90 phút → 400; mặc định 15 phút; bài Luyện tập không có giờ.
  - Màn giới thiệu không bắt đầu tính giờ; em ngoài lớp → 404; mở bài kiểm tra bằng `/progress/sessions` → 409.
  - Bấm "Bắt đầu" hai lần cùng lúc → cùng một phiên; `deadlineAt − startedAt = timeLimitSec`; dữ liệu câu hỏi không có `correctAnswer`, `explanation`, `audioText`.
  - Tải lại → cùng thứ tự đáp án. Luyện tập cùng quiz khi đang thi → 409, nộp xong thì mở lại được.
  - Lưu nháp bỏ câu lạ, giữ đánh dấu; em khác không đọc/nộp được phiên (404).
  - Đổi `mode`/`timeLimitSec` sau khi có em bắt đầu → 409; bảng nộp bài có `inProgress`.
  - Nộp: 100 điểm, `xpEarned = 0`, XP và bản đồ không đổi, trạm sau vẫn khoá; nộp lần hai trả cùng kết quả; bắt đầu lại → 409.
  - `reveal: after_due`: học sinh không thấy đáp án, giáo viên thấy; đổi sang `after_submit` thì học sinh thấy.
  - Nộp trong ân hạn → `submitted`; quá ân hạn → `timed_out`, chấm nháp, nháp mới bị từ chối 409.
  - Phiên bỏ dở quá giờ được chốt khi giáo viên mở bảng nộp bài, tính **đúng hạn**, `isAutoSubmit`; bản đồ nhiệt có em đó.
  - Giáo viên đóng bài → em chưa bắt đầu không bắt đầu được, màn giới thiệu báo `closed`.
- **Trình duyệt** (Edge headless, dữ liệu tạm trong bộ nhớ; tablet 820×1180 và điện thoại 390×844):
  - Giáo viên giao bài kiểm tra 5 phút "đáp án sau hạn nộp" qua hộp giao bài.
  - Học sinh: thẻ bài có nhãn và nút "Làm tiếp ⏱"; màn giới thiệu; phòng thi; đánh dấu; lưới câu; F5 giữa giờ quay lại đúng câu và giữ đáp án; đóng/tải lại tab có cảnh báo của trình duyệt; nút Back có hộp xác nhận; rà soát; nộp; kết quả ẩn đáp án kèm dòng "sẽ hiện sau hạn nộp".
  - Bài 1 phút: đồng hồ chuyển đỏ, hết giờ tự nộp, kết quả ghi "⏱ Hết giờ, bài được tự nộp".
  - Trang kết quả bài tập của giáo viên có nhãn "✍️ Đang làm".
  - Không có lỗi console.

## Hướng mở rộng / còn tồn đọng
- Challenge ngẫu nhiên (`kind: 'challenge'`): rút câu theo khối/chủ đề lúc bắt đầu. Đã có `questionIds` để chụp ảnh đề.
- **Giáo viên "cho làm lại"** một em (máy hỏng giữa giờ): huỷ phiên và kết quả cũ. Chưa làm ở 4.2.
- Gia hạn giờ cho một em hoặc cả lớp trong lúc thi.
- Điểm riêng cho từng câu; chấm điểm từng phần cho câu nối từ.
- Chống gian lận mạnh hơn (rời tab, xáo đề theo em): chưa cần ở tiểu học.
