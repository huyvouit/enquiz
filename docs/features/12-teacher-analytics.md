# 12 – Thống kê & phân tích cho giáo viên (Teacher Analytics)

> Giai đoạn: 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Giúp giáo viên nắm nhanh tình hình học tập của cả lớp, thấy điểm yếu của từng em để kèm cặp kịp thời, và có file bảng điểm (Excel/PDF) để nộp nhà trường. Chỉ giáo viên của lớp và admin xem được.

## Luồng chính
1. Giáo viên mở lớp → tab **Thống kê** → chọn kỳ: 7 ngày / 30 ngày (mặc định) / Học kỳ / Tùy chọn.
2. **Tổng quan**: sĩ số, số em hoạt động 7 ngày, điểm TB, tỉ lệ nộp đúng hạn, số bài đang mở.
   - "Cần chú ý": tối đa 5 em, kèm lý do. Bấm vào để mở báo cáo của em đó.
   - "Chủ đề cần giảng lại": 3 cặp chủ đề–kỹ năng có tỉ lệ đúng thấp nhất.
3. **Bản đồ nhiệt chủ đề**: lưới chủ đề × kỹ năng (Từ vựng / Ngữ pháp / Nghe). Mỗi ô ghi % đúng và số câu trả lời. Ô có ít hơn 10 câu trả lời hiện mờ.
4. **Bảng điểm**: xem trước đúng bảng sẽ xuất. Nút **📗 Xuất bảng điểm Excel** / **📄 Xuất bảng điểm PDF** dùng kỳ đang chọn.
5. Bấm một bài tập → trang **kết quả bài tập**:
   - Thống kê nộp bài, bảng nộp bài từng em, **bản đồ nhiệt câu hỏi**.
   - Bấm một cột câu hỏi → đáp án đúng, đáp án sai phổ biến nhất ("12 em chọn cat") và nút **🎯 Giao bài ôn cho các em sai câu này**.
6. Bấm tên một em → **báo cáo tiến độ cá nhân**: cấp, XP, trạm đã mở, bài chưa hoàn thành, điểm mạnh/yếu so với lớp, biểu đồ 8 tuần, lịch sử. Nút **📄 Phiếu tiến độ** xuất PDF một trang, gửi được cho phụ huynh.

## Backend
- Module: `be/src/modules/analytics/`. Chỉ có **query** (đọc), không ghi gì. Đi qua `ClassAccessQuery(mode: 'manage')`, nên lớp của giáo viên khác trả **404**, học sinh gọi nhận **403**.

| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/analytics/classes/:id/overview?from&to` | Teacher/Admin | Tổng quan lớp |
| GET | `/analytics/classes/:id/topics?from&to` | Teacher/Admin | Bản đồ nhiệt chủ đề × kỹ năng |
| GET | `/analytics/classes/:id/gradebook?from&to` | Teacher/Admin | Bảng điểm (JSON, giống file xuất) |
| GET | `/analytics/classes/:id/students/:studentId?from&to` | Teacher/Admin | Báo cáo tiến độ một em |
| GET | `/analytics/classes/:id/quizzes/:quizId/heatmap` | Teacher/Admin | Bản đồ nhiệt một quiz mà lớp đã làm (bản đồ hoặc bài tập) |
| GET | `/analytics/assignments/:id/heatmap` | Teacher/Admin | Bản đồ nhiệt một bài tập |
| GET | `/analytics/classes/:id/gradebook/export?format=xlsx\|pdf&from&to` | Teacher/Admin | Tải bảng điểm |
| GET | `/analytics/assignments/:id/export?format=xlsx\|pdf` | Teacher/Admin | Tải kết quả bài tập (sheet "Nộp bài" + "Từng câu") |
| GET | `/analytics/classes/:id/students/:studentId/export?from&to` | Teacher/Admin | Tải phiếu tiến độ PDF |

- Query: `ClassOverviewQuery`, `TopicHeatmapQuery`, `AssignmentHeatmapQuery`, `ClassQuizHeatmapQuery`, `StudentReportQuery`, `GradebookQuery`, `ExportGradebookQuery`, `ExportAssignmentQuery`, `ExportStudentReportQuery`. Logic tính ở `AnalyticsService`, quy tắc thuần ở `analytics-rules.ts` (có unit test).
- Không có collection riêng: mọi số liệu tính lúc đọc từ `student_progress` (index `{assignmentId, studentId, completedAt}`), `assignments`, `questions`, `quizzes`.
- Quy tắc số liệu:
  - **Bản đồ nhiệt (câu hỏi và chủ đề) chỉ tính lần làm đầu tiên** của mỗi em với mỗi quiz. Lần làm lại diễn ra sau khi em đã xem đáp án, nên sẽ làm tỉ lệ đúng đẹp hơn thực tế. Câu bỏ trống tính là "đã làm, không đúng".
  - Trạng thái bài tập theo quyết định D7 (`assignment-status.ts`), tính lúc đọc:
    - ✅ `on_time`: có lần nộp trước hoặc đúng hạn.
    - 🕒 `late`: chỉ có lần nộp sau hạn.
    - ⏳ `pending`: chưa nộp, còn hạn.
    - ❌ `missing`: chưa nộp, quá hạn.
    - Điểm tính cho bài tập = điểm cao nhất trong các lần nộp đúng hạn (không có thì lấy điểm cao nhất của các lần muộn).
  - Điểm TB tổng quan = trung bình mọi lượt làm trong kỳ. "Nộp đúng hạn" chỉ tính các bài **đã hết hạn** trong kỳ.
  - "Cần chú ý": điểm TB trong kỳ < 60, hoặc ≥ 2 bài quá hạn chưa nộp, hoặc không làm bài 7 ngày.
  - Bảng điểm gồm các bài tập có hạn **từ đầu kỳ** và **được giao trước khi kỳ kết thúc**, nên bài còn hạn cũng có mặt. TB chỉ tính bài đã nộp. Thang 10 = thang 100 / 10, một chữ số thập phân.
  - Kỳ mặc định: 30 ngày gần nhất (theo ngày giờ Việt Nam); tối đa 400 ngày.
- File xuất (`export/report-export.service.ts`):
  - **Excel** dùng `exceljs`. Sheet "Bảng điểm": cố định tiêu đề và cột tên; ô cam = muộn, ô hồng = quá hạn chưa nộp, "–" = chưa nộp, ô trống = không giao; dòng TB từng bài. Sheet "Thông tin" ghi lớp, giáo viên, kỳ, ngày xuất.
  - **PDF** dùng `pdfmake`, A4 ngang cho bảng điểm, có số trang và ô ký tên giáo viên. Font **Roboto** đi kèm `pdfmake` (`node_modules/pdfmake/fonts/Roboto`) đủ dấu tiếng Việt, nên không cần tải font riêng. `pdfmake` bị chặn tải mọi tài nguyên ngoài thư mục font đó.
  - File và màn hình gọi **cùng một query**, nên số liệu luôn khớp. Tên file bỏ dấu, ví dụ `bang-diem-lop-3a-2026-11-16.xlsx`.

## Frontend
- Feature: `fe/src/features/analytics/` (TanStack Query, key bắt đầu bằng `['analytics', ...]`).
- Màn hình:
  - `ClassAnalyticsTab`: tab "Thống kê" trong trang lớp, nhận `ClassTabProps` do router truyền vào.
  - `/teacher/assignments/:assignmentId` → `AssignmentReportPage`.
  - `/teacher/classes/:classId/students/:studentId` → `StudentReportPage`.
- Chọn kỳ (`lib/range.ts`):
  - 7/30 ngày tính theo ngày Việt Nam, đến thời điểm hiện tại.
  - **Học kỳ** bắt đầu từ ngày 1/9 hoặc 1/1, lấy mốc gần nhất đã qua. Đây là quy tắc đơn giản; học kỳ thật của từng trường có thể lệch vài tuần, khi đó dùng "Tùy chọn".
  - "Tùy chọn" lấy trọn ngày cuối.
- Biểu đồ và bản đồ nhiệt vẽ bằng CSS/SVG thuần, không thêm thư viện nào vào bundle.
  - Màu theo dải: dưới 50% đỏ, 50–79% vàng, từ 80% xanh. Ô nào cũng có **số % và biểu tượng**, không chỉ dựa vào màu.
  - Bảng có cột tên cố định khi cuộn ngang, ô ≥ 28px để chạm được trên máy tính bảng.
- "Giao bài ôn" không import feature `assignments`. Nút chỉ điều hướng tới `/teacher/classes/:classId?tab=assignments&assignQuiz=<quizId>&assignStudents=<id,id>`, và tab Bài tập mở sẵn hộp thoại giao bài đã điền.
- Tải file qua `downloadFile()` (`shared/api/http.ts`): gắn token, lưu theo tên server gợi ý, đọc được câu báo lỗi JSON khi tải thất bại.

## Quyết định thiết kế
- **Tính lúc đọc, không lưu bảng tổng hợp.** Lớp tối đa 60 em nên aggregate trực tiếp vẫn nhanh. Số liệu luôn đúng ngay cả khi giáo viên đổi hạn nộp hoặc sửa quiz.
- **Câu đã gỡ khỏi quiz vẫn hiện** (cột viền đứt, "đã gỡ khỏi quiz"), vì các lần làm cũ vẫn chứa câu đó.
- **File dựng ở backend** (quyết định D10): một chỗ kiểm tra quyền, cùng số liệu với màn hình, không làm nặng bundle học sinh.

## Kiểm thử
- Unit: `analytics-rules.spec.ts` gồm kỳ mặc định theo giờ Việt Nam, định dạng đáp án, thang 10 và lý do "cần chú ý".
- E2E (`test/phase3.e2e-spec.ts`, nhóm "teacher analytics"), dữ liệu cố định 3 em, 4 câu, có làm lại và bỏ trống:
  - % đúng từng câu và đáp án sai phổ biến.
  - Chỉ tính lần đầu.
  - Tổng quan, "cần chú ý", báo cáo cá nhân, bảng điểm.
  - Đọc lại file Excel; các PDF bắt đầu bằng `%PDF-`.
  - Giáo viên lớp khác nhận 404, học sinh nhận 403.

## Hướng mở rộng / còn tồn đọng
- Gia hạn riêng cho từng em (`assignmentStatus` đã nhận được hạn của từng em).
- Thống kê toàn trường cho admin (so sánh giữa các lớp).
- Cache hoặc bảng tổng hợp khi một trường có hàng nghìn học sinh.
- Màn hình chưa dùng `GET /analytics/classes/:id/quizzes/:quizId/heatmap`. Có thể gắn vào trang kết quả quiz cũ (`/teacher/quizzes/:id/results`) kèm bộ lọc lớp.
