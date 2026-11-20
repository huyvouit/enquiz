# Kế hoạch Giai đoạn 3 – Lớp học, bài tập, thống kê, kho câu hỏi

> Trạng thái: **Đã chốt (D1–D11 theo đề xuất) và triển khai** · Lập: 2026-11-16 · Xem [roadmap](roadmap.md)

Bản thiết kế gốc mô tả Giai đoạn 3 là **"Mở rộng chuyên sâu"**: kho câu hỏi phong phú, quản lý lớp học, giao bài tập về nhà và báo cáo chi tiết cho giáo viên.

Bản 2 bổ sung hai nhóm yêu cầu:
- **Quản lý Bài tập về nhà & Hạn chót** → mốc [3.2](#32-bài-tập-về-nhà--hạn-chót-tài-liệu-11)
  - Giao bài theo lớp hoặc nhóm, có hạn cụ thể.
  - Tự phân loại *Đã nộp đúng hạn / Nộp muộn / Chưa nộp*.
  - Nhắc nhở nổi bật trên trang chủ học sinh khi bài sắp đến hạn.
- **Dashboard Thống kê & Phân tích cho giáo viên (Teacher Analytics)** → mốc [3.3](#33-dashboard-thống-kê--phân-tích-teacher-analytics-tài-liệu-12)
  - Bản đồ nhiệt câu hỏi.
  - Báo cáo tiến độ cá nhân.
  - Xuất bảng điểm lớp ra **Excel/PDF**.

Socket.io (đấu trường trực tuyến) là tính năng "nếu muốn" trong thiết kế gốc. Đề xuất tách ra **Giai đoạn 4** (mục 7).

---

## 1. Hiện trạng và khoảng trống

| Vấn đề hiện tại | Hệ quả | Xử lý ở |
| --- | --- | --- |
| Ai cũng tự đăng ký được vai trò **giáo viên** | Người lạ có thể xuất bản quiz lên bản đồ của mọi học sinh cùng khối và xem kết quả của các em | 3.0 |
| Không có lớp học. Quiz giáo viên xuất bản hiện trên bản đồ của **mọi** học sinh cùng khối | Nhiều giáo viên cùng dùng thì bản đồ bị lẫn bài của lớp khác | 3.1, 3.2 |
| Bảng xếp hạng tính trên toàn khối, toàn hệ thống | Trẻ thấy họ tên học sinh trường khác | 3.1 |
| Học sinh 6–8 tuổi phải tự đăng ký | Không thực tế ở lớp 1–2 | 3.1 |
| Không có cách lấy lại mật khẩu | Phải sửa thẳng trong DB | 3.0, 3.1 |
| Không giao được bài, không có hạn nộp | Giáo viên vẫn phải giao bài bằng giấy hoặc tin nhắn | 3.2 |
| Báo cáo chỉ có bảng kết quả theo từng quiz | Không biết em nào chưa làm, câu nào cả lớp sai, em nào cần kèm; không có file nộp nhà trường | 3.3 |
| Chỉ soạn được trắc nghiệm và nối từ; ảnh phải dán URL | Bài học đơn điệu, chưa có kỹ năng nghe | 3.4 |
| Kho câu hỏi hệ thống chỉ có 23 câu demo | Giáo viên chưa "dùng ngay" được | 3.5 |
| Bundle ~600 kB, danh sách quiz không phân trang, `useAsync` không cache | Màn giáo viên sắp tăng gấp đôi | 3.0 |

**Đã có sẵn để tận dụng:**
- `student_progress.assignmentId` đã có trong schema.
- Bộ chấm `fill_in_blank` và `ordering` đã viết xong.
- Mỗi attempt đã lưu chi tiết từng câu (`details[].questionId / studentAnswer / isCorrect`), đủ để vẽ bản đồ nhiệt mà không cần ghi thêm dữ liệu.
- `ProgressionService.gradeMap` đã tính được trạng thái trạm của một học sinh, dùng lại cho báo cáo cá nhân.
- `periodStart` đã xử lý múi giờ Việt Nam.

---

## 2. Quyết định cần chốt trước khi làm

Mỗi quyết định ghi kèm **đề xuất**. Kế hoạch bên dưới viết theo các đề xuất này.

### D1. Bản đồ thử thách gồm những quiz nào?
- **Đề xuất:** bản đồ chỉ gồm **quiz hệ thống** (`createdBy = null`) của khối, do admin sắp thứ tự. Quiz của giáo viên đến với học sinh **qua bài tập** của lớp.
- **Phương án khác:** bản đồ = quiz hệ thống + quiz của giáo viên các lớp em học. Nhược điểm: thứ tự trạm khó đoán, mỗi em một bản đồ khác nhau.
- **Ảnh hưởng dữ liệu cũ:** quiz giáo viên đã xuất bản rời khỏi bản đồ. Cấp và XP đã đạt giữ nguyên. Script migrate liệt kê các quiz này để giáo viên giao lại cho lớp.

### D2. "Xuất bản" với quiz giáo viên
- **Đề xuất:** đổi nghĩa thành **"Chia sẻ cho giáo viên khác"**. Bản nháp vẫn giao được cho lớp của chính mình.

### D3. Bảng xếp hạng
- **Đề xuất:** 2 tab.
  - **Lớp của em:** họ tên đầy đủ.
  - **Toàn khối:** tên rút gọn ("Minh A.").

### D4. Tài khoản học sinh
- **Đề xuất:** giáo viên **tạo hàng loạt** và in thẻ đăng nhập. Học sinh lớn tự đăng ký rồi vào lớp bằng **mã lớp**.
- Giáo viên đặt lại mật khẩu cho học sinh lớp mình; admin đặt lại cho giáo viên.

### D5. Một học sinh ở mấy lớp?
- **Đề xuất:** nhiều lớp. Bài tập, nhóm, bảng xếp hạng và thống kê đều lọc theo từng lớp.

### D6. Duyệt giáo viên
- **Đề xuất:** tài khoản giáo viên mới **chờ admin duyệt** rồi mới tạo được lớp và quiz. Bắt buộc, vì giáo viên sẽ xem được dữ liệu trẻ em.

### D7. Thế nào là "đã nộp", "đúng hạn", "muộn"?
- **Đề xuất:**
  - **Nộp** = hoàn thành bài (bấm nộp và đã chấm), **không cần đạt 60 điểm**.
  - **Trạng thái tính lúc đọc**, không lưu cứng. Giáo viên đổi hạn nộp thì trạng thái tự đúng lại, không cần job chạy nền.

  | Trạng thái | Điều kiện |
  | --- | --- |
  | ✅ **Đúng hạn** (`on_time`) | Có ít nhất 1 lần nộp trước hoặc đúng `dueDate` |
  | 🕒 **Nộp muộn** (`late`) | Chỉ có lần nộp sau `dueDate` |
  | ⏳ **Chưa nộp – còn hạn** (`pending`) | Chưa nộp, chưa tới hạn |
  | ❌ **Chưa nộp – quá hạn** (`missing`) | Chưa nộp, đã quá hạn |

  Giao diện gộp `pending` và `missing` thành "Chưa nộp", tô màu khác nhau.
- **Điểm tính cho bài tập:** điểm cao nhất trong các lần nộp **đúng hạn**. Nếu không có lần nào đúng hạn thì lấy điểm cao nhất trong các lần nộp muộn.
- Quá hạn vẫn làm được (ghi nhận "muộn"). Giáo viên có thể **đóng** bài tập để chặn hẳn việc nộp.

### D8. Giao bài theo nhóm
- **Đề xuất:** mỗi lớp có các **nhóm đặt tên** do giáo viên tạo (ví dụ "Nhóm cần kèm", "Nhóm khá"). Khi giao bài chọn **cả lớp**, **một nhóm**, hoặc **tự chọn vài em** (có thể lưu lựa chọn thành nhóm).
- Bài tập lưu **danh sách học sinh được giao** tại thời điểm giao. Em vào lớp sau đó thì không bị tính "chưa nộp" cho bài cũ.
  - Riêng bài giao cả lớp: em mới vào lớp được thêm vào bài tập nếu bài **chưa quá hạn**.

### D9. Nhắc nhở tự động
- **Đề xuất:** nhắc **ngay trong ứng dụng**, không gửi email hay thông báo đẩy ở giai đoạn này (trẻ không có email; thông báo đẩy và nhắn phụ huynh để Giai đoạn 4).
  - "Sắp đến hạn" = còn **≤ 48 giờ** (cấu hình được).
  - Hạn mặc định là **20:00** ngày được chọn, theo giờ Việt Nam.

### D10. Định dạng xuất báo cáo
- **Đề xuất:** dựng file **ở backend** để dùng chung một chỗ kiểm tra quyền và số liệu:
  - **Excel (.xlsx):** thư viện `exceljs`.
  - **PDF:** thư viện `pdfmake`, dùng font **Roboto** đi kèm `pdfmake` (đủ dấu tiếng Việt, đã kiểm tra khi spike). Khổ A4 ngang.
- Bảng điểm hiện cả **thang 100** và **thang 10** để nộp nhà trường.

### D11. Lưu file ảnh và âm thanh
- **Đề xuất:**
  - **Nghe:** giọng đọc của trình duyệt (Web Speech API).
  - **Ảnh:** upload qua `StorageService`. Dev lưu ra đĩa, production dùng dịch vụ tương thích S3. Tối đa 1 MB, chỉ PNG/JPG/WebP.

---

## 3. Lộ trình

Thứ tự theo phụ thuộc: **3.0 → 3.1 → 3.2 → 3.3**. **3.4** độc lập, làm song song được. **3.5** cần phần schema câu hỏi của 3.4.

Ước lượng cho 1 lập trình viên full-stack đã quen code. Soạn nội dung (3.5) chạy song song, do người khác làm.

| Mốc | Nội dung | Ước lượng | Tài liệu mới/sửa |
| --- | --- | --- | --- |
| 3.0 | Nền tảng & an toàn | 3–4 ngày | 01, README |
| 3.1 | Lớp học, nhóm, tài khoản học sinh | 6 ngày | **10-classes.md**, 08 |
| 3.2 | Bài tập về nhà & hạn chót | 7 ngày | **11-assignments.md**, 03, 04, 07 |
| 3.3 | Dashboard thống kê & phân tích | 8–9 ngày | **12-teacher-analytics.md**, 05 |
| 3.4 | Dạng câu hỏi mới, nghe, ảnh | 6–8 ngày | 02, 04 |
| 3.5 | Kho câu hỏi chuẩn & nhập CSV | 4–5 ngày + soạn nội dung | **13-question-import.md**, 02, 06, 07 |
| | **Tổng** | **~7–8 tuần** | |

---

### 3.0 Nền tảng & an toàn

**Backend**
1. **Duyệt giáo viên (D6):**
   - Thêm `User.status: active | pending | disabled`. Giáo viên tự đăng ký có `status = pending`.
   - Thêm `ActiveAccountGuard` đọc status từ DB (cache 30 giây), vì JWT không chứa status:
     - `pending`: chỉ gọi được `GET /users/me`.
     - `disabled`: nhận 401.
   - Admin:
     - `GET /admin/users?role&status&search&page`
     - `PATCH /admin/users/:id/status`
     - `POST /admin/users/:id/reset-password` (mật khẩu tạm trả về một lần)
2. **Chống dò mật khẩu:** `@nestjs/throttler` cho `/auth/login` và `/auth/register` (10 lần/phút/IP); thêm `helmet`.
3. **Khung migrate:**
   - Tách phần chung của `scripts/migrate-phase2.mjs` ra `scripts/lib.mjs` (kết nối, đọc `.env`, `--dry-run`).
   - Thêm `npm run migrate:phase3` (chi tiết ở mục 4).
4. **Tiện ích múi giờ:** gom `periodStart` và các hàm giờ Việt Nam vào `common/utils/vn-time.ts`. 3.2 cần cho hạn nộp, 3.3 cần cho lọc theo kỳ.

**Frontend**
1. `React.lazy` cho route `/teacher/*` và `/admin/*`.
2. **Chốt TanStack Query** cho màn mới. Thống kê có nhiều bộ lọc và cần làm mới sau khi giao bài, nên lợi ích rõ. Màn cũ chuyển dần.
3. Màn `/admin/users` để duyệt giáo viên. Giáo viên chờ duyệt thấy màn "Đang chờ duyệt".
4. Phân trang danh sách quiz.

**Kiểm thử:** giáo viên pending → 403; duyệt xong dùng được; tài khoản bị khoá → 401; vượt giới hạn → 429.

---

### 3.1 Lớp học & nhóm (tài liệu 10)

**Dữ liệu** – collection `classes` (theo thiết kế gốc, thêm `groups`):
```
name: String                      // "Lớp 3A – Tiếng Anh"
code: String (unique)             // 6 ký tự, bỏ 0/O/1/I/L
teacherId: ObjectId → User
gradeLevel: Number 1–5
studentIds: ObjectId[] → User     // tối đa 60 em
groups: [{                        // tối đa 10 nhóm (D8)
  _id, name: String, studentIds: ObjectId[]   // ⊆ studentIds của lớp
}]
status: active | archived
createdAt, updatedAt
```
- Index: `code` (unique), `teacherId`, `studentIds` (multikey).
- Lớp tối đa 60 em nên nhúng mảng là hợp lý. Thêm/bớt bằng `$addToSet`/`$pull`.
- Em rời lớp thì đồng thời bị `$pull` khỏi mọi nhóm của lớp.

**Backend** – module mới `be/src/modules/classes/`:

| Method | Đường dẫn | Vai trò | Việc |
| --- | --- | --- | --- |
| POST | `/classes` | Teacher | Tạo lớp, sinh mã |
| GET | `/classes` | Teacher/Student | Lớp mình dạy / lớp mình học |
| GET | `/classes/:id` | Chủ lớp/Admin | Chi tiết, học sinh, nhóm |
| PUT | `/classes/:id` | Chủ lớp | Đổi tên, khối, lưu trữ |
| POST | `/classes/:id/code` | Chủ lớp | Đổi mã mời |
| POST | `/classes/join` | Student | Vào lớp bằng `{ code }` |
| POST | `/classes/:id/students/bulk` | Chủ lớp | Tạo hàng loạt → tên đăng nhập + mật khẩu (**trả một lần**) |
| DELETE | `/classes/:id/students/:studentId` | Chủ lớp | Cho em rời lớp |
| POST | `/classes/:id/students/:studentId/reset-password` | Chủ lớp | Mật khẩu tạm |
| POST/PUT/DELETE | `/classes/:id/groups[/:groupId]` | Chủ lớp | Tạo, sửa (tên, thành viên), xoá nhóm |

- Query dùng chung qua `QueryBus`:
  - `ClassMembershipQuery(teacherId, studentId)`: "giáo viên này có dạy em này không".
  - `StudentClassesQuery(studentId)`: lớp của em.
- **Tạo hàng loạt:**
  - Tên đăng nhập sinh từ họ tên bỏ dấu, thêm số nếu trùng.
  - Mật khẩu dạng `tiger42`.
  - Tối đa 60 em mỗi lần; báo lỗi theo từng dòng.
- **Bảng xếp hạng (D3):** `scope=class&classId=…` lọc theo `class.studentIds`; `scope=grade` trả tên rút gọn.

**Frontend** – feature mới `fe/src/features/classes/`:
- Giáo viên:
  - `/teacher/classes`: danh sách lớp.
  - `/teacher/classes/:id`: các tab **Học sinh · Nhóm · Bài tập (3.2) · Thống kê (3.3)**. Hiện mã lớp cỡ lớn để chiếu lên bảng.
  - Thêm học sinh: dán danh sách tên → xem trước → tạo → **in thẻ đăng nhập** (A4, 8 thẻ/trang, kèm mã QR).
  - Tab Nhóm: tạo nhóm, chạm chọn học sinh (không kéo thả).
- Học sinh: ô "Nhập mã lớp" trên trang chủ; tên lớp hiện trên header.
- Bảng xếp hạng thêm tab "Lớp của em".

**Kiểm thử:**
- Unit: mã lớp không trùng.
- Mã sai hoặc lớp đã lưu trữ → 404.
- Giáo viên khác không xem được lớp → 404.
- Thành viên nhóm phải thuộc lớp → nếu không thì 400.
- Rời lớp → bị gỡ khỏi nhóm.
- Bảng xếp hạng lớp chỉ có thành viên của lớp.

---

### 3.2 Bài tập về nhà & hạn chót (tài liệu 11)

**Mục tiêu:** số hoá hoàn toàn việc giao bài về nhà: giao bài → học sinh được nhắc → hệ thống tự phân loại nộp bài → giáo viên xem và xuất báo cáo (3.3).

**Dữ liệu** – collection `assignments` (theo thiết kế gốc, thêm đối tượng giao):
```
classId: ObjectId → Class
quizId: ObjectId → Quiz
teacherId: ObjectId → User
target: { kind: 'class' | 'group' | 'students',
          groupId?: ObjectId, groupName?: String }   // để hiển thị
studentIds: ObjectId[]        // danh sách được giao, chốt lúc giao (D8)
dueDate: Date                 // bắt buộc; mặc định 20:00 giờ VN của ngày chọn
status: active | closed
note?: String                 // lời nhắn của cô/thầy (≤ 200 ký tự)
createdAt, updatedAt
```
- Index: `{classId, dueDate}`, `{studentIds, dueDate}` (bài tập của một em), `{quizId}`.
- `student_progress`: dùng `assignmentId` đã có, thêm index `{assignmentId, studentId, completedAt}`.
- `quiz_sessions`: thêm `assignmentId` (null = chơi bản đồ). Unique index đổi thành `{studentId, quizId, assignmentId}`.
- Không lưu cờ "muộn" trên attempt. Trạng thái tính bằng hàm thuần `assignmentStatus(dueDate, attempts, now)` theo D7, có unit test.

**Backend** – module mới `be/src/modules/assignments/`:

| Method | Đường dẫn | Vai trò | Việc |
| --- | --- | --- | --- |
| POST | `/classes/:id/assignments` | Chủ lớp | Giao quiz cho `class`, `group` hoặc `students` kèm `dueDate` |
| GET | `/classes/:id/assignments?status=active\|closed\|all` | Chủ lớp | Danh sách + đếm `on_time / late / pending / missing` |
| GET | `/assignments/:id` | Chủ lớp | Chi tiết + trạng thái từng em (bảng nộp bài) |
| PATCH | `/assignments/:id` | Chủ lớp | Đổi hạn, lời nhắn; đóng/mở |
| DELETE | `/assignments/:id` | Chủ lớp | Xoá (giữ lịch sử làm bài) |
| GET | `/assignments/mine` | Student | Bài của em ở mọi lớp, kèm trạng thái và điểm |
| GET | `/assignments/mine/reminders` | Student | Gọn nhẹ cho trang chủ: bài **sắp đến hạn**, **quá hạn chưa nộp**, **mới giao** |

- **Quy tắc giao bài:**
  - Quiz phải là quiz giáo viên thấy được (của mình, hệ thống, hoặc được chia sẻ) và đúng khối của lớp (khác khối thì cảnh báo, không chặn).
  - `dueDate` phải ở tương lai và không quá 60 ngày.
  - Giao theo nhóm thì chép `studentIds` của nhóm tại thời điểm giao.
- **Em mới vào lớp:** sự kiện `StudentJoinedClassEvent` → thêm em vào các bài giao `kind: 'class'` còn hạn (D8).
- **Phiên chơi:**
  - `POST /progress/sessions` nhận thêm `assignmentId?`.
  - Kiểm tra em nằm trong `studentIds` của bài tập và bài chưa `closed`.
  - **Bỏ qua khoá trạm** với bài được giao.
  - Attempt lưu `assignmentId`. XP và cấp vẫn theo quy tắc chung.
- **Phạm vi bản đồ (D1, D2):**
  - `gradeMap` chỉ lấy quiz hệ thống, sắp theo `mapOrder` (3.5), sau đó `createdAt`.
  - Quyền xem quiz của học sinh = quiz trên bản đồ ∪ quiz được giao. Thêm `AssignedQuizIdsQuery(studentId)` để `quiz-access.ts` dùng.
- **Sự kiện:** `AssignmentCreatedEvent` ghi log. Đây là chỗ móc thông báo đẩy và tin nhắn phụ huynh ở Giai đoạn 4.

**Nhắc nhở tự động (D9)** – trang chủ học sinh:
- **Băng nhắc nổi bật** phía trên bản đồ, ưu tiên theo thứ tự:
  1. ❌ Quá hạn chưa nộp: nền đỏ nhạt, "Bài *Animals* đã quá hạn – em làm bù nhé!"
  2. ⏰ Sắp đến hạn (≤ 48 giờ): nền vàng, đếm ngược "Còn 5 giờ", nút **Làm ngay**.
  3. 📬 Mới giao: nhãn "Mới", kèm lời nhắn của cô/thầy.
- Cú mèo nói một câu nhắc khi có bài sắp đến hạn. Chuông nhẹ (`playSfx`) **một lần mỗi ngày**, ghi nhớ bằng `localStorage`.
- Header có biểu tượng 📬 kèm **số bài chưa nộp**, có mặt ở mọi trang.
- Em có thể thu gọn băng nhắc trong ngày hôm đó; sang ngày mới nó hiện lại.
- Trang **`/assignments`** ("Bài tập của em"): 3 tab **Cần làm / Đã nộp / Quá hạn**, thẻ bài có đếm ngược, trạng thái và điểm.
- Nhắc nhở tính lúc em mở trang, không cần job nền. Giáo viên đổi hạn thì nhắc nhở tự cập nhật.

**Giao diện giáo viên**
- Tab **Bài tập** trong lớp: danh sách bài, mỗi bài có thanh tiến độ màu ✅ 🕒 ⏳ ❌ và số lượng từng loại.
- Nút **Giao bài**:
  1. Chọn quiz (tìm kiếm, lọc khối).
  2. Chọn đối tượng: Cả lớp / Nhóm / Chọn học sinh.
  3. Chọn hạn: lịch, mặc định 20:00 sau 7 ngày.
  4. Lời nhắn.
- Bấm vào một bài → **bảng nộp bài**: từng em với trạng thái, giờ nộp, điểm, số lần làm. Lọc theo trạng thái.
- Dashboard quiz có nút **"Giao cho lớp…"**. Công tắc "Xuất bản" đổi thành "Chia sẻ cho giáo viên khác" (D2).

**Kiểm thử:**
- Unit `assignmentStatus`: đúng hạn, muộn, có cả lần đúng hạn lẫn lần muộn, nộp đúng giây hạn chót, đổi hạn.
- e2e:
  - Em không được giao không mở được phiên → 404; bài đã đóng → 409.
  - Quiz đang khoá trên bản đồ vẫn chơi được qua bài tập.
  - Giao theo nhóm chỉ đúng các em trong nhóm.
  - Em mới vào lớp được thêm vào bài còn hạn.
  - `reminders` trả đúng bài sắp đến hạn/quá hạn.
  - Phiên bản đồ và phiên bài tập của cùng một quiz tồn tại song song.

---

### 3.3 Dashboard thống kê & phân tích (Teacher Analytics) (tài liệu 12)

**Mục tiêu:** giáo viên nắm nhanh bức tranh học tập của lớp, thấy điểm yếu của từng em để kèm cặp kịp thời, và có file nộp nhà trường.

Mọi báo cáo là **query** CQRS chạy aggregate trên `student_progress`, luôn đi qua kiểm tra lớp của giáo viên (404 nếu không phải lớp mình). Lớp tối đa 60 em nên aggregate trực tiếp là đủ; ngưỡng cần cache ghi ở mục nợ kỹ thuật.

**Quy ước số liệu**
- **Bản đồ nhiệt chỉ tính lần làm đầu tiên** của mỗi em cho mỗi bài. Lần làm lại diễn ra sau khi em đã xem đáp án, nên sẽ làm "đẹp" số liệu một cách giả tạo.
- **Điểm và tiến độ** dùng điểm theo quy tắc D7.
- **Bộ lọc kỳ:** 7 ngày / 30 ngày / học kỳ / tùy chọn, theo giờ Việt Nam.

#### A. Tổng quan lớp
`GET /analytics/classes/:id/overview?from&to`
- Thẻ số liệu: sĩ số; số em hoạt động 7 ngày; điểm TB; **tỉ lệ nộp đúng hạn**; số bài đang mở.
- **"Cần chú ý"**: tối đa 5 em có điểm TB < 60, ≥ 2 bài quá hạn chưa nộp, hoặc không làm bài trong 7 ngày. Mỗi em kèm lý do.
- **"Chủ đề cần giảng lại"**: 3 chủ đề có tỉ lệ đúng thấp nhất (lấy từ B2).

#### B. Bản đồ nhiệt câu hỏi (Question Heatmap)
- **B1. Theo bài tập hoặc quiz:** `GET /analytics/assignments/:id/heatmap` (hoặc `/analytics/classes/:id/quizzes/:quizId/heatmap` cho quiz không giao).
  - Lưới **hàng = học sinh, cột = câu hỏi**. Ô 🟩 đúng / 🟥 sai / ⬜ chưa làm.
  - Đầu cột hiện **% đúng của cả lớp**, tô màu theo dải: < 50% đỏ, 50–79% vàng, ≥ 80% xanh.
  - Bấm vào một cột → nội dung câu, đáp án đúng, **đáp án sai phổ biến nhất** kèm số em chọn. Ví dụ: "12 em chọn *cat* thay vì *dog*".
  - Sắp xếp cột theo thứ tự câu hoặc từ khó đến dễ; hàng theo tên hoặc điểm.
  - **Hành động:** nút **"Giao bài ôn cho các em sai câu này"** tạo sẵn nhóm hoặc chọn sẵn học sinh rồi mở form giao bài (3.2). Từ phát hiện đi thẳng tới việc kèm cặp.
- **B2. Theo chủ đề và kỹ năng của lớp:** `GET /analytics/classes/:id/topics?from&to`
  - Lưới **hàng = chủ đề (Animals, Colors…), cột = kỹ năng (Từ vựng / Ngữ pháp / Nghe)**, ô = % đúng và số câu đã làm.
  - Ô có quá ít dữ liệu (< 10 câu trả lời) hiện mờ, tránh kết luận sai.
- **Cài đặt:** `$match {assignmentId | quizId, studentId ∈ lớp}` → lấy attempt đầu tiên mỗi em (`$sort completedAt` + `$group $first`) → `$unwind details` → `$group` theo `questionId` (và theo `studentAnswer` cho đáp án sai phổ biến) → `$lookup questions` lấy `topic`, `skill`, `questionText`.
  - Quiz đã sửa sau khi có người làm: cột câu đã bị bỏ khỏi quiz vẫn hiện, gắn nhãn "đã gỡ khỏi quiz".

#### C. Báo cáo tiến độ cá nhân (Student Progress Report)
`GET /analytics/classes/:id/students/:studentId?from&to`
- **Hồ sơ:** họ tên, khối, **cấp độ hiện tại**, **tổng XP**, XP trong kỳ.
- **Bản đồ:** **số trạm đã mở / tổng số trạm** của khối, số trạm đã vượt, trạm đang dừng. Dùng lại `ProgressionService.gradeMap` qua query `StudentMapSummaryQuery`.
- **Bài tập trong lớp:**
  - Đếm theo trạng thái ✅ 🕒 ⏳ ❌.
  - **Danh sách bài chưa hoàn thành** (còn hạn và quá hạn), có hạn nộp. Có nút "Gia hạn cho em" (đặt hạn riêng; xem *Hướng mở rộng*).
- **Điểm mạnh/yếu:** % đúng theo chủ đề và kỹ năng của riêng em, đặt cạnh trung bình lớp.
- **Xu hướng:** điểm TB theo tuần trong 8 tuần gần nhất (biểu đồ đường nhỏ).
- **Lịch sử:** các lần làm bài, mở lại được màn xem lại bài (`/attempts/:id` đã có).
- Giáo viên mở từ: hàng trong bản đồ nhiệt, danh sách học sinh, danh sách "Cần chú ý".

#### D. Xuất báo cáo (D10)

| File | Endpoint | Nội dung |
| --- | --- | --- |
| **Bảng điểm lớp** (.xlsx / .pdf) | `GET /analytics/classes/:id/gradebook.{xlsx\|pdf}?from&to` | Hàng = học sinh (STT, họ tên); cột = từng bài tập trong kỳ (điểm + ký hiệu *M* muộn / *–* chưa nộp); cuối hàng: điểm TB (thang 100 và thang 10), số bài đúng hạn/muộn/chưa nộp, cấp, XP. Dòng cuối: TB của từng bài |
| **Kết quả một bài tập** (.xlsx / .pdf) | `GET /analytics/assignments/:id/export.{xlsx\|pdf}` | Bảng nộp bài + tỉ lệ đúng từng câu |
| **Phiếu tiến độ học sinh** (.pdf) | `GET /analytics/classes/:id/students/:studentId/report.pdf` | Báo cáo C trên một trang A4, gửi phụ huynh được |

- **Excel:**
  - Sheet "Bảng điểm" có định dạng sẵn: cố định hàng tiêu đề, tô màu ô muộn/chưa nộp, cột số dạng số để giáo viên tự tính thêm.
  - Sheet "Thông tin" ghi lớp, giáo viên, kỳ báo cáo, ngày xuất.
- **PDF:** A4 ngang. Đầu trang ghi tên trường (giáo viên nhập trong cài đặt lớp, không bắt buộc), lớp, giáo viên, kỳ. Cuối trang có số trang và ô ký tên giáo viên.
- **Cài đặt:**
  - `ReportExportService` trong module analytics. Dữ liệu lấy từ **cùng query** với màn hình, để số liệu trên file và trên màn luôn khớp.
  - Trả về dạng stream; header `Content-Disposition` có tên file bỏ dấu (`bang-diem-lop-3a-2026-11.xlsx`).
  - Font tiếng Việt đặt ở `be/assets/fonts/`.
  - Kiểm tra thư viện chạy được với ESM của dự án trước khi chốt (spike nửa ngày ở đầu mốc).

**Giao diện:** tab **Thống kê** trong lớp, gồm 3 mục con **Tổng quan · Bản đồ nhiệt · Học sinh** và nút **Xuất báo cáo** (chọn kỳ, chọn Excel hoặc PDF).
- Bản đồ nhiệt vẽ bằng lưới CSS: ô cỡ ≥ 28px, cuộn ngang trên máy tính bảng, cố định cột tên.
- Biểu đồ đường và cột vẽ bằng SVG thuần, không thêm thư viện vào bundle học sinh.
- Màu đỏ/vàng/xanh luôn kèm số % và biểu tượng, để không phụ thuộc hoàn toàn vào màu.
- Bảng kết quả theo quiz cũ (`/teacher/quizzes/:id/results`) giữ nguyên, thêm lọc theo lớp.

**Kiểm thử:**
- e2e với bộ dữ liệu cố định (3 em, 1 bài tập, 4 câu, có lần làm lại và lần nộp muộn) → kiểm tra % đúng, đáp án sai phổ biến, chỉ tính lần đầu, trạng thái nộp, số trạm đã mở.
- Giáo viên lớp khác → 404.
- File xlsx đọc lại bằng `exceljs` đúng số liệu; PDF có `Content-Type` đúng và mở được.
- Tên có dấu tiếng Việt hiển thị đúng trong PDF (kiểm tra bằng mắt một lần, chụp lưu vào tài liệu).

---

### 3.4 Dạng câu hỏi mới, nghe, ảnh (cập nhật tài liệu 02, 04)

Một dạng câu được mở cho giáo viên soạn **khi đã có cả form soạn lẫn giao diện chơi** (quy tắc đang ghi trong `question-types.ts`).

| Dạng | Dữ liệu | Cách chơi (chạm, không cần bàn phím) |
| --- | --- | --- |
| **Điền từ** `fill_in_blank` | `questionText` chứa `___`; `correctAnswer`: chuỗi hoặc mảng đáp án; `options?`: ngân hàng từ | Có `options`: chạm chọn từ (lớp 1–3). Không có: ô gõ chữ lớn (lớp 4–5) |
| **Sắp xếp câu** `ordering` | `correctAnswer`: mảng từ đúng thứ tự (2–10) | Thẻ từ xáo trộn; chạm để xếp lên dòng câu, chạm lại để gỡ |

- **Validator:**
  - Điền từ: đúng một `___`; đáp án nằm trong `options` nếu có.
  - Sắp xếp: các từ không được giống hệt nhau.
- **Lúc chơi:** thẻ của dạng sắp xếp được **xáo trộn trước khi gửi**, không để lộ thứ tự đúng.
- **Nghe (D11):**
  - Trường `audioText?` (≤ 200 ký tự), áp dụng cho mọi dạng câu.
  - Nút 🔊 tự đọc một lần khi hiện câu (`rate 0.85`, giọng `en-US` hoặc `en-GB`). Máy không có giọng tiếng Anh thì hiện chữ thay thế.
  - Câu có `audioText` mặc định `skill = listening`, nên tự vào cột "Nghe" của bản đồ nhiệt B2.
- **Ảnh:**
  - `POST /uploads/images` (≤ 1 MB, kiểm tra **magic bytes**).
  - Dùng `@nestjs/storage` (chính chủ NestJS): đĩa `LocalDisk` và `S3Disk`, `uploadToDisk` kiểm tra chữ ký file và giới hạn dung lượng. Biến mới `STORAGE_DRIVER`, `S3_*` thêm vào `.env.example` và `env.validation.ts`.

**Kiểm thử:** unit validator; e2e soạn + chơi từng dạng; upload giả mạo đuôi bị từ chối; file quá cỡ → 413.

---

### 3.5 Kho câu hỏi chuẩn & nhập CSV (tài liệu 13)

- **Dữ liệu:**
  - `questions` thêm `tags[]`, `yleLevel?: starters | movers | flyers`, `unit?`, `externalId?` (để nạp lại nội dung không bị trùng).
  - `quizzes` thêm `mapOrder?`.
- **Nhập CSV:** `POST /questions/import?dryRun=true|false`
  - Mỗi dòng chạy qua cùng validator với form soạn. `dryRun` báo lỗi theo từng dòng.
  - Tối đa 500 dòng; bỏ qua câu trùng.
  - Kèm file mẫu.
- **Giao diện:**
  - `/teacher/questions/import`: xem trước, dòng lỗi tô đỏ.
  - `/admin/map`: chạm hoặc kéo để sắp thứ tự trạm từng khối.
- **Nội dung** (soạn song song từ tuần 1):
  - Mỗi khối 6–8 trạm × 8–10 câu → **~300 câu**, đủ 4 dạng, có câu nghe.
  - Bám danh mục từ Cambridge YLE và chủ đề SGK.
  - ⚠️ Tự soạn câu hỏi, **không chép** đề mẫu Cambridge hay nội dung SGK.
  - Giáo viên tiếng Anh duyệt trước khi nhập.
  - Nạp bằng `npm run seed:content` (idempotent theo `externalId`).
- Gắn `topic`/`skill` cẩn thận vì **bản đồ nhiệt theo chủ đề (3.3-B2) chỉ chính xác khi nhãn đúng**. Dùng danh sách chủ đề chuẩn (`/questions/topics` + gợi ý cố định), tránh "Animal" và "Animals" thành hai chủ đề khác nhau.

**Kiểm thử:** e2e nhập CSV gồm dòng hợp lệ, dòng lỗi và dòng trùng; `dryRun` không ghi DB; bản đồ sắp theo `mapOrder`.

---

## 4. Migrate dữ liệu (`npm run migrate:phase3`)

Script idempotent, có `--dry-run`:
1. `users`: `status: 'active'` cho người dùng hiện có.
2. `quiz_sessions`:
   - Xoá unique index `{studentId, quizId}`, tạo `{studentId, quizId, assignmentId}`.
   - Phiên đang dở đặt `assignmentId: null`.
3. `quizzes`:
   - Quiz hệ thống: gán `mapOrder` theo `createdAt`, để bản đồ không đổi thứ tự.
   - Quiz giáo viên đang `published`: **in ra danh sách** (D1), không tự đổi.
4. `questions`: `tags: []` cho câu cũ; chuẩn hoá `topic` (cắt khoảng trắng, gộp số ít/số nhiều theo danh sách chuẩn, có in ra để kiểm tra).
5. `student_progress`: index `{assignmentId, studentId, completedAt}`.

Cấp độ và XP **không** tính lại.

---

## 5. Quy tắc mới cần thêm vào README

- Mọi dữ liệu học sinh giáo viên xem được (kể cả file xuất) phải đi qua kiểm tra **"giáo viên có dạy em này không"**. Thiếu kiểm tra thì trả 404.
- Họ tên đầy đủ chỉ hiện trong phạm vi lớp; ngoài lớp dùng tên rút gọn.
- Mật khẩu tạm chỉ trả về **một lần**, không ghi log.
- Trạng thái bài tập và mọi số liệu thống kê **tính lúc đọc** từ `student_progress`, không lưu bản sao có thể lệch.
- File xuất và màn hình dùng **cùng một query**.
- Thời gian lưu UTC, hiển thị và nhập theo **giờ Việt Nam** (`common/utils/vn-time.ts`).
- File upload: kiểm tra magic bytes, giới hạn kích thước, không phục vụ HTML/SVG do người dùng tải lên.

---

## 6. Hướng mở rộng (ngoài phạm vi Giai đoạn 3)

- **Gia hạn riêng cho từng em** (`assignment.extensions: [{studentId, dueDate}]`). Thiết kế D7 đã chừa chỗ: hàm `assignmentStatus` nhận hạn của riêng em.
- Thông báo đẩy (Web Push) và tin nhắn cho phụ huynh khi bài sắp đến hạn.
- Đặt lại mật khẩu qua email cho giáo viên.
- Thống kê toàn trường cho admin (so sánh giữa các lớp).
- Upload file âm thanh thật cho câu nghe.

---

## 7. Vì sao tách Socket.io sang Giai đoạn 4

"Đấu trường trực tuyến" kiểu Kahoot là một sản phẩm con riêng, gồm:
- Phòng chơi có màn hình giáo viên điều khiển.
- Đồng hồ đồng bộ, xử lý mất kết nối.
- Chấm điểm theo tốc độ.
- `@nestjs/websockets` + Redis adapter khi chạy nhiều instance.

Ước lượng 2–3 tuần. Tính năng này chỉ có giá trị khi đã có lớp học và đủ câu hỏi. Không thiết kế gì trong Giai đoạn 3 cản trở việc này.

---

## 8. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
| --- | --- | --- |
| **Nội dung** không kịp (~300 câu soạn + duyệt) | Cao | Soạn từ tuần 1, song song với code; 3.5 phát hành được với ít nội dung hơn |
| **Dữ liệu trẻ em** (giáo viên xem báo cáo, xuất file mang ra ngoài hệ thống) | Cao | Duyệt giáo viên (3.0), kiểm tra lớp ở mọi query và mọi file xuất, tên rút gọn ngoài lớp. Xem xét yêu cầu đồng ý của phụ huynh theo Nghị định 13/2023/NĐ-CP trước khi dùng thật ở trường |
| Số liệu thống kê sai làm giáo viên mất niềm tin | Trung bình | Quy ước số liệu ghi rõ trên màn ("chỉ tính lần làm đầu"); bộ dữ liệu e2e cố định; file xuất và màn hình dùng chung query |
| Thư viện xuất PDF/Excel không chạy với ESM hoặc lỗi font tiếng Việt | Trung bình | Spike nửa ngày đầu mốc 3.3. Phương án dự phòng cho PDF: trang in riêng + "Lưu thành PDF" của trình duyệt |
| Lệch múi giờ ở hạn nộp (bài "hạn 20:00" bị tính muộn sai) | Trung bình | Tiện ích `vn-time` dùng chung; unit test cho đúng thời điểm hạn chót và qua nửa đêm |
| Đổi phạm vi bản đồ (D1) làm giáo viên hiện tại bất ngờ | Trung bình | Migrate liệt kê quiz bị ảnh hưởng; nút "Giao cho lớp" ngay trên dashboard |
| Máy tính bảng không có giọng đọc tiếng Anh | Trung bình | Hiện chữ thay thế; cảnh báo khi giáo viên xem thử |
| Tạo tài khoản hàng loạt bị dùng để spam | Thấp | Chỉ giáo viên đã duyệt; tối đa 60 em/lần, 60 em/lớp; rate limit |

---

## 9. Định nghĩa "xong" cho mỗi mốc

- Backend theo đúng CQRS; frontend theo feature-first (README mục 2.4, 2.5).
- `lint`, `test`, `test:e2e` (be) và `build`, `lint` (fe) đều qua; mỗi luồng API mới có e2e; mỗi quy tắc thuần (trạng thái bài tập, giờ VN, sinh mã) có unit test.
- Có tài liệu tính năng trong `docs/features/` (theo `_TEMPLATE.md`); cập nhật README và `roadmap.md`.
- Chạy thử trên trình duyệt ở cỡ máy tính bảng cho cả 3 vai trò. Riêng 3.3: mở file Excel/PDF đã xuất và kiểm tra bằng mắt.
- Script migrate chạy thử `--dry-run` trên bản sao dữ liệu thật.
