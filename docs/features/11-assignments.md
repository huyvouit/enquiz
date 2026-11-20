# 11 – Bài tập về nhà & hạn chót

> Giai đoạn: 3 (mốc 3.2) · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Số hoá việc giao bài về nhà của giáo viên tiểu học: giao một quiz cho cả lớp, một nhóm hoặc vài em kèm hạn nộp; hệ thống tự phân loại **Đúng hạn / Nộp muộn / Chưa nộp** và nhắc học sinh ngay trên trang chủ.

## Luồng chính
1. **Giáo viên** mở lớp → tab **Bài tập** → **📬 Giao bài**:
   - chọn quiz (tìm theo tên, lọc khối; quiz của mình kể cả nháp, quiz hệ thống, quiz được chia sẻ);
   - chọn đối tượng: **Cả lớp / Một nhóm / Chọn học sinh** (chạm để chọn);
   - chọn hạn: ngày + giờ theo **giờ Việt Nam**, mặc định **20:00 sau 7 ngày**; hạn phải ở tương lai, tối đa 60 ngày;
   - lời nhắn (≤ 200 ký tự).
2. Danh sách bài của lớp hiện thanh tiến độ ✅ 🕒 ⏳ ❌, điểm TB, đếm ngược. Mỗi bài: **Xem kết quả** (bảng nộp bài, tài liệu 12), **Gia hạn**, **Đóng / Mở lại**, **Xoá**.
3. **Học sinh** thấy trên trang chủ băng nhắc (ưu tiên: quá hạn → sắp đến hạn ≤ 48 giờ → mới giao), cú mèo nhắc một câu, chuông nhẹ tối đa 1 lần/ngày; trên header có 📬 kèm số bài chưa nộp.
4. Học sinh bấm **Làm ngay / Làm bù / Làm lại** → `/play/:quizId?assignment=:id`. Phiên chơi gắn với bài tập nên bài được giao **luôn chơi được**, kể cả quiz không nằm trên bản đồ hoặc trạm đang khoá.
5. Trang **📬 Bài tập của em** (`/assignments`): tab Cần làm / Quá hạn / Đã nộp.

## Backend
- Module: `be/src/modules/assignments/`

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| POST | `/classes/:classId/assignments` | Chủ lớp/Admin | Giao bài `{ quizId, target: { kind: class\|group\|students, groupId?, studentIds? }, dueDate, note? }` |
| GET | `/classes/:classId/assignments?status=active\|closed\|all` | Chủ lớp/Admin | Danh sách + `counts` + `averageScore` |
| GET | `/assignments/:id` | Chủ lớp/Admin | Bảng nộp bài từng em |
| PATCH | `/assignments/:id` | Chủ lớp/Admin | Đổi hạn, lời nhắn; `status: closed\|active` |
| DELETE | `/assignments/:id` | Chủ lớp/Admin | Xoá (lịch sử làm bài giữ nguyên) |
| GET | `/assignments/mine` | Student | Bài của em ở mọi lớp, kèm trạng thái |
| GET | `/assignments/mine/reminders` | Student | `{ pendingCount, overdue, dueSoon, fresh }` (tối đa 5 mỗi loại) |
| POST | `/progress/sessions` `{ quizId, assignmentId }` | Student | Mở phiên chơi cho bài tập (bỏ qua khoá trạm) |

- Command: `CreateAssignmentCommand`, `UpdateAssignmentCommand`, `DeleteAssignmentCommand`.
- Query: `ListClassAssignmentsQuery`, `GetAssignmentDetailQuery`, `MyAssignmentsQuery`, `MyRemindersQuery`; dùng qua QueryBus bởi module khác: `AssignedQuizIdsQuery` (quyền xem quiz), `AssignmentPlayAccessQuery` (mở phiên).
- Event: `AssignmentCreatedEvent` (ghi log, chỗ móc thông báo ở giai đoạn 4). Command do module lớp gọi và `await`: `AddJoinersToAssignmentsCommand` (thêm em mới vào bài **cả lớp** còn hạn) và `RemoveLeaverFromAssignmentsCommand` (gỡ em khỏi mọi bài của lớp).
- Collection `assignments`: `classId`, `quizId`, `teacherId`, `target { kind, groupId?, groupName? }`, `studentIds` (chốt lúc giao), `dueDate`, `status: active|closed`, `note?`. Index `{classId, dueDate}`, `{studentIds, dueDate}`, `{quizId}`.
- `student_progress.assignmentId` + index `{assignmentId, studentId, completedAt}`; `quiz_sessions` unique `{studentId, quizId, assignmentId}`.
- Quy tắc trạng thái (`assignment-status.ts`, hàm thuần có unit test):

| Trạng thái | Điều kiện |
| --- | --- |
| ✅ `on_time` | Có ≥ 1 lần nộp trước hoặc đúng `dueDate` |
| 🕒 `late` | Chỉ có lần nộp sau `dueDate` |
| ⏳ `pending` | Chưa nộp, còn hạn |
| ❌ `missing` | Chưa nộp, quá hạn |

  - "Nộp" = hoàn thành bài, **không cần đạt 60 điểm**.
  - Điểm tính cho bài: điểm cao nhất trong các lần **đúng hạn**; không có thì cao nhất trong các lần muộn.
  - Trạng thái **tính lúc đọc**, không lưu: đổi hạn nộp thì mọi thứ tự đúng lại.
  - Quá hạn vẫn làm được (ghi nhận muộn); bài **đã đóng** thì mở phiên trả 409.

### Chế độ Kiểm tra (4.2, tài liệu 14)
- `assignments` có thêm `mode` (`classic` | `exam`, thiếu = `classic`), `timeLimitSec` (chỉ exam, 60–5400 giây) và `reveal` (`after_submit` | `after_due`).
- Giao bài: `mode`, `timeLimitSec`, `reveal` là tuỳ chọn. Exam thiếu `timeLimitSec` thì lấy `quiz.settings.timeLimitSec`, không có thì 15 phút.
- `PATCH /assignments/:id`: `reveal` đổi lúc nào cũng được; `mode` và `timeLimitSec` chỉ đổi được khi chưa em nào làm (409).
- Bài kiểm tra **không** mở được bằng `POST /progress/sessions` (409), và không nằm trong `AssignedQuizIdsQuery` (học sinh không xem trước đề của quiz giáo viên).
- Danh sách và bảng nộp bài trả thêm `mode`, `timeLimitSec`, `reveal`. Mỗi em có thêm `isAutoSubmit` và `inProgress: { deadlineAt }`. `/assignments/mine` có thêm `exam: { state, sessionId, deadlineAt }`.
- Trước khi đọc trạng thái nộp bài, `AssignmentSubmissionsService.attempts()` gọi `FinalizeExpiredExamsCommand` (có `await`) để chốt các phiên thi quá giờ (E5). Analytics cũng làm vậy trước khi tính bản đồ nhiệt.
- Học sinh: thẻ bài có nhãn "📝 Kiểm tra · N phút"; nút "Làm bài kiểm tra" / "Làm tiếp ⏱" / "Xem kết quả" dẫn tới `/exam/:assignmentId`.
- Giáo viên: hộp giao bài có Chế độ, Thời gian, Cho xem đáp án. Bảng nộp bài có nhãn "✍️ Đang làm" và "⏱ Tự nộp".

## Frontend
- Feature: `fe/src/features/assignments/` (TanStack Query, key `['assignments', ...]`).
- Route: `/assignments` (`MyAssignmentsPage`, học sinh).
- Thành phần dùng ở nơi khác:
  - `ClassAssignmentsTab` – tab Bài tập trong trang lớp (props `ClassTabProps`).
  - `AssignDialog` – hộp thoại giao bài; dùng ở tab trên và nút "Giao cho lớp…" ở dashboard quiz (không truyền lớp → chọn lớp trước).
  - `SubmissionTable` – bảng nộp bài có lọc theo trạng thái (trang kết quả bài tập).
  - `ReminderBanner` (trang chủ học sinh), `AssignmentsBadge` (header), `useReminders`.
- **Hợp đồng URL**: `/teacher/classes/:classId?tab=assignments&assignQuiz=<quizId>&assignStudents=<id,id>` mở sẵn hộp thoại giao bài với quiz và học sinh đó (nút "Giao bài ôn" ở bản đồ nhiệt); tham số bị xoá khi đóng hộp thoại.
- Giờ: `lib/vn-time.ts` đọc/ghi ngày giờ theo UTC+7 bất kể múi giờ của trình duyệt; gửi ISO lên server.
- Chơi bài tập: `PlayPage` đọc `?assignment=` → `StudentGame` gọi `playApi.startSession(quizId, assignmentId)`; sau khi nộp làm mới mọi query `['assignments']` (badge, nhắc nhở cập nhật ngay). Lỗi 404/409 hiện đúng thông báo của server kèm nút "Về bài tập".
- `localStorage` (bọc try/catch, chỉ là tiện ích): `enquiz-reminders-hidden-day` (thu gọn băng nhắc đến hết ngày), `enquiz-reminders-chimed-day` (chuông 1 lần/ngày).

## Quyết định thiết kế
- **Không lưu cờ "muộn"** trên bài làm: trạng thái suy ra từ `completedAt` và `dueDate` lúc đọc, nên gia hạn không cần sửa dữ liệu cũ.
- **Danh sách học sinh chốt lúc giao**: em vào lớp sau không bị tính "chưa nộp" cho bài cũ; riêng bài giao cả lớp còn hạn thì em mới được thêm vào.
- **Nhắc nhở trong ứng dụng**, không email/đẩy (trẻ không có email) – D9 của kế hoạch.
- Hạn mặc định 20:00: giờ học sinh tiểu học thường làm bài tối ở nhà.
- Tab "Cần làm" chỉ gồm bài còn hạn; bài quá hạn chưa nộp nằm ở tab "Quá hạn" (nút **Làm bù**) để không lẫn hai loại.

## Kiểm thử
- Unit: `be/src/modules/assignments/assignment-status.spec.ts` (đúng hạn, muộn, đúng giây hạn chót, đổi hạn, đếm trạng thái, 48 giờ).
- E2E `be/test/phase3.e2e-spec.ts` nhóm `homework`: giao nhóm/cả lớp, hạn trong quá khứ → 400, giáo viên khác → 404, nhắc nhở, chơi qua bài tập (không qua bản đồ), phân loại đúng hạn/muộn/quá hạn khi đổi hạn, gia hạn/đóng/mở, em vào sau & em rời lớp.

## Hướng mở rộng / còn tồn đọng
- Gia hạn riêng cho từng em (`extensions`), thông báo đẩy và tin nhắn phụ huynh (giai đoạn 4).
- Lặp lại bài tập theo tuần, giao một lúc cho nhiều lớp.
