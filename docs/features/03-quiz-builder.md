# 03 – Tạo & quản lý quiz (Quiz Builder)

> Giai đoạn: 1, 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Giáo viên ghép câu hỏi từ kho thành bài quiz (một "trạm" trên bản đồ thử thách), chọn thứ tự, biểu tượng, xuất bản cho học sinh.

## Luồng chính
1. `/teacher` → **Tạo quiz mới**.
2. Nhập tên, chủ đề, lớp, mô tả, chọn biểu tượng emoji.
3. Bên phải: tìm trong kho → **＋ Thêm**. Hoặc **✨ Tạo câu hỏi mới** (modal), câu mới được lưu vào kho và thêm luôn vào quiz.
4. Bên trái: kéo thả để đổi thứ tự, ✕ để bỏ.
5. Bật/tắt **Chia sẻ cho giáo viên khác** (`status: published`; tắt = bản nháp) và **Xáo trộn câu hỏi**. Quiz của giáo viên đến với học sinh **qua bài tập** của lớp (tài liệu [11](11-assignments.md)); bản nháp vẫn giao được cho lớp của chính mình.
6. **Lưu quiz**. Trên dashboard có: Chơi thử, Kết quả, Sửa, Xoá.

## Backend
- Module: `be/src/modules/quizzes/`

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/quizzes?topic&gradeLevel&mine&search&page&limit` | Mọi vai trò | Danh sách tóm tắt có phân trang `{ items, total, page, limit }`, đã lọc theo quyền xem |
| GET / PUT | `/quizzes/map-order?gradeLevel` | Admin | Thứ tự trạm hệ thống của một khối (tài liệu [07](07-progression-quest-map.md)) |
| GET | `/quizzes/:id` | Teacher/Admin | Chi tiết kèm câu hỏi **có đáp án** |
| GET | `/quizzes/:id/play` | Mọi vai trò | Dữ liệu để chơi, **không có đáp án** (xem tài liệu 04) |
| POST | `/quizzes` | Teacher/Admin | Tạo quiz |
| PUT | `/quizzes/:id` | Chủ sở hữu/Admin | Ghi đè quiz |
| DELETE | `/quizzes/:id` | Chủ sở hữu/Admin | Xoá quiz (giữ lịch sử làm bài) |

- Command: `CreateQuizCommand`, `UpdateQuizCommand`, `DeleteQuizCommand` · Query: `ListQuizzesQuery`, `GetQuizDetailQuery`, `GetPlayQuizQuery`, `CountQuizzesUsingQuestionQuery`.
- Collection `quizzes`: `title`, `description?`, `topic`, `gradeLevel`, `coverEmoji`, `questionIds: ObjectId[]` (có thứ tự), `status: draft|published`, `settings.shuffleQuestions`, `createdBy` (`null` = quiz hệ thống). (`rewardConfig` của giai đoạn 1 đã bỏ.)
  - **Bản đồ trạm** chỉ gồm quiz **hệ thống** đã xuất bản, theo `mapOrder` — xem tài liệu [07](07-progression-quest-map.md). Quiz **admin** tạo là quiz hệ thống (`createdBy = null`) và được nối vào cuối bản đồ khối đó.
- Quy tắc:
  - 1–50 câu, không trùng; mọi id phải tồn tại trong kho (400 nếu không).
  - Quyền xem (`quiz-access.ts`): admin thấy tất cả; giáo viên thấy quiz đã chia sẻ + quiz hệ thống + nháp của mình; học sinh chỉ thấy **trạm trên bản đồ** + **quiz được giao làm bài tập**. Không có quyền → **404** (không để lộ bản nháp).
  - Phân trang: `limit` 1–100 (mặc định 20).

## Frontend
- Feature: `fe/src/features/quizzes/`
- Route: `/teacher` (`TeacherDashboardPage`, tab "Quiz của tôi" / "Tất cả quiz"), `/teacher/quizzes/new`, `/teacher/quizzes/:id/edit` (`QuizBuilderPage`).
- `QuizBuilderPage` tải dữ liệu rồi render `QuizBuilderForm` với `key` theo id → state form khởi tạo một lần từ props, không đồng bộ bằng `useEffect`.
- Kéo thả thứ tự bằng `Reorder` của Framer Motion.
- Modal tạo câu hỏi nằm **ngoài** `<form>` của quiz và render qua portal (form lồng nhau là HTML sai, sự kiện submit còn lan theo cây React).

## Quyết định thiết kế
- **`status: draft | published`**: giai đoạn 1–2 nghĩa là "học sinh có thấy không". Từ giai đoạn 3 (quyết định D2): với quiz giáo viên, `published` = **chia sẻ cho giáo viên khác** (đúng ý `isPublic` của thiết kế gốc); học sinh nhận quiz qua bài tập. Với quiz hệ thống, `published` = hiện trên bản đồ.
- Quiz tham chiếu câu hỏi (`questionIds`) thay vì nhúng: sửa câu hỏi một lần là mọi quiz dùng nó được cập nhật.
- `coverEmoji` thay cho ảnh bìa: không cần upload, vẫn sinh động với trẻ em.

## Kiểm thử
e2e nhóm `quizzes`: id câu hỏi không tồn tại → 400, tạo quiz, học sinh liệt kê được, học sinh không xem được bản có đáp án (403), bản nháp ẩn với học sinh (404).

## Hướng mở rộng / còn tồn đọng
- Cấu hình thêm: giới hạn thời gian, số lần làm lại, chỉ lấy N câu ngẫu nhiên.
- Nhân bản quiz (copy quiz hệ thống để chỉnh sửa).
- Giao quiz cho lớp kèm hạn nộp (giai đoạn 3 – `assignments`).
