# 08 – Bảng xếp hạng

> Giai đoạn: 2–3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Khích lệ thi đua lành mạnh trong **lớp của em** hoặc cùng **khối** theo **tuần / tháng / mọi lúc**.

## Luật
- Xếp theo **XP** (tài liệu [07](07-progression-quest-map.md)): XP chỉ tăng khi phá kỷ lục điểm của một bài.
- **Tuần này / Tháng này**: tổng `xpEarned` của các lượt làm từ **00:00 thứ Hai / ngày 1, giờ Việt Nam (UTC+7)**. **Mọi lúc**: `studentProfile.xp`.
- Phạm vi (`scope`, quyết định D3 của giai đoạn 3):
  - `class`: thành viên **một lớp** (tài liệu [10](10-classes.md)), hiện **họ tên đầy đủ**. Chỉ học sinh trong lớp, giáo viên của lớp và admin xem được (người khác → 404).
  - `grade` (mặc định của API): mọi học sinh **cùng khối**, có thể khác trường, nên tên được **viết gọn**: tên gọi + chữ cái đầu của họ (“Nguyễn Minh Anh” → “Anh N.”, hàm `shortName`). Riêng dòng của chính em vẫn hiện tên đầy đủ.
- Chỉ liệt kê học sinh có XP > 0 trong kỳ. Bằng XP thì đồng hạng (1, 2, 2, 4); trong cùng hạng xếp theo tên.
- Hiển thị tên (đầy đủ hoặc viết gọn như trên) và cấp, **không bao giờ** hiển thị username của trẻ khác.

## Luồng chính
- Học sinh: menu **🏆 Xếp hạng**. Nếu em đã vào lớp: mặc định tab **🏫 Lớp của em** (học nhiều lớp thì có ô chọn lớp); tab **🌏 Toàn khối** chọn khối. Chưa vào lớp: chỉ có bảng toàn khối của khối em. Bục 🥇🥈🥉 cho top 3, danh sách tới hạng 20; dòng của mình được tô màu; nếu ngoài top 20 thì hiện "Vị trí của em".
- Giáo viên/admin: tab **🏫 Lớp của tôi** (chọn một lớp mình dạy) và **🌏 Toàn khối** (chọn khối).

## Backend
| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/progress/leaderboard?period=week\|month\|all&scope=grade&gradeLevel=` | Mọi vai trò | Mặc định `week`, `scope=grade`, khối của học sinh (giáo viên: khối 1) |
| GET | `/progress/leaderboard?period=…&scope=class&classId=` | Thành viên lớp, giáo viên của lớp, admin | Xếp hạng trong một lớp; thiếu `classId` → 400 |

```json
{
  "period": "week", "scope": "class", "gradeLevel": 1, "classId": "…", "className": "Lớp 1A",
  "since": "2026-11-15T17:00:00.000Z",
  "entries": [{ "rank": 1, "studentId": "…", "fullName": "Bé An", "level": 2, "xp": 83 }],
  "me": { "rank": 1, "studentId": "…", "fullName": "Bé An", "level": 2, "xp": 83 }
}
```
- Query `GetLeaderboardQuery` (`queries/handlers/get-leaderboard.handler.ts`):
  - Theo kỳ: aggregate `student_progress` (`completedAt ≥ since`, `xpEarned > 0`; với lớp: `studentId ∈ class.studentIds`) → `$group` theo học sinh → `$lookup users` → lọc khối (scope grade).
  - Mọi lúc: đọc `users` (index `{ role, studentProfile.gradeLevel, studentProfile.xp }`; với lớp: `_id ∈ class.studentIds`).
  - Quyền xem lớp kiểm tra qua `ClassAccessQuery(mode: 'view')` của module classes.
- `periodStart()` trong `progression.rules.ts` (có unit test).

## Frontend
- `fe/src/features/progress/pages/LeaderboardPage.tsx`, route `/leaderboard` (mọi vai trò), có trong menu cả học sinh và giáo viên. Danh sách lớp lấy từ `useMyClasses()` / `useTeachingClasses()` của feature classes; dữ liệu bảng qua TanStack Query (key `['leaderboard', period, scope, classId|grade]`).

## Kiểm thử
- e2e `app.e2e-spec.ts`: 3 kỳ đều xếp đúng (100 XP hạng 1, 50 XP hạng 2), tên của chính em đầy đủ còn bạn khác viết gọn (“Lan B.”), `me` đúng, giáo viên xem theo khối (`me = null`), `period` sai → 400.
- e2e `phase3.e2e-spec.ts` › class leaderboard: chỉ thành viên lớp, tên đầy đủ; học sinh đã rời lớp → 404; thiếu `classId` → 400; giáo viên của lớp xem được.

## Hướng mở rộng
- Phạm vi theo trường; cache kết quả khi số học sinh lớn; cho phép giáo viên tắt bảng xếp hạng với lớp nhỏ tuổi.
