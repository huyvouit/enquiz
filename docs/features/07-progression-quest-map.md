# 07 – Cấp độ, XP & mở khoá bản đồ

> Giai đoạn: 2, 3 · Trạng thái: Xong · Cập nhật: 2026-11-16

## Mục tiêu
Tạo động lực "vượt ải": mỗi khối lớp có một bản đồ gồm nhiều trạm (quiz). **Vượt qua trạm thì lên cấp và mở trạm kế tiếp.** XP ghi nhận công sức để xếp hạng (tài liệu [08](08-leaderboard.md)).

## Luật chơi (`be/src/modules/progress/progression/progression.rules.ts`)
| Khái niệm | Luật |
| --- | --- |
| **Vượt trạm** | Điểm một lượt `≥ PASS_SCORE = 60` |
| **Cấp độ** | `1 + số trạm khác nhau đã vượt` (mọi lớp). Không bao giờ giảm |
| **Lên cấp** | Lần **đầu tiên** vượt một trạm → +1 cấp |
| **XP của một lượt** | `max(0, điểm − điểm cao nhất trước đó của bài này)` → tổng XP = tổng điểm cao nhất của mọi bài; chơi lại chỉ được XP khi **phá kỷ lục** |
| **Trạm trên bản đồ** | Chỉ **quiz hệ thống** (`createdBy = null`) **đã xuất bản** của khối (giai đoạn 3, quyết định D1) |
| **Thứ tự trạm** | `mapOrder` do admin sắp; hoà thì theo `createdAt`, rồi `_id` |
| **Trạm mở** | Trạm đầu tiên; **hoặc** trạm đã vượt; **hoặc** trạm ngay trước nó đã vượt |
| **Trạm khoá** | Các trường hợp còn lại |

- Bản đồ mỗi khối **độc lập**: trạm đầu của khối nào cũng mở; học sinh xem được bản đồ mọi khối.
- **Quiz do admin tạo là quiz hệ thống** và được thêm vào **cuối** bản đồ khối đó (`mapOrder = lớn nhất + 1`). Nội dung chuẩn nạp bằng `npm run seed:content` cũng thành trạm hệ thống (tài liệu [13](13-question-import.md)).
- **Quiz của giáo viên không nằm trên bản đồ.** Học sinh nhận chúng dưới dạng **bài tập** của lớp (tài liệu [11](11-assignments.md)). "Xuất bản" một quiz giáo viên nghĩa là **chia sẻ cho giáo viên khác** (quyết định D2).
- **Bài tập không bao giờ bị khoá:** quiz được giao chơi được dù trạm tương ứng trên bản đồ còn khoá. `isUnlocked` trả `true` nếu quiz nằm trong `AssignedQuizIdsQuery`; phiên chơi mở bằng `assignmentId` bỏ qua kiểm tra khoá. Điểm bài tập vẫn tính XP và cấp theo luật chung.
- Đổi thứ tự hoặc chèn trạm **không khoá lại** các trạm đã vượt.
- Giáo viên/admin không bị khoá (để xem thử).

## Luồng chính
1. `/home`: thẻ **🏅 Cấp N · ⚡ XP**, thanh tiến độ "x/y trạm" của lớp, cú mèo gợi ý trạm tiếp theo và điểm cần đạt.
2. Trạm khoá màu xám + 🔒; chạm vào thì rung, kêu "cạch", cú mèo giải thích cần vượt trạm trước. Trạm kế tiếp nhún nhảy với nhãn **▶ Chơi ngay**. Trạm đã vượt có ✓ và số sao đánh giá cao nhất.
3. Vượt trạm → màn kết quả **LÊN CẤP** + nút **🔓 Trạm mới** (tài liệu 05) → về bản đồ thấy trạm mới đã mở.

## Backend
| Method | Đường dẫn | Vai trò | Mô tả |
| --- | --- | --- | --- |
| GET | `/progress/map?gradeLevel=` | Student | Bản đồ một khối (mặc định khối của học sinh) |
| GET | `/quizzes/map-order?gradeLevel=` | Admin | Mọi quiz hệ thống của khối (cả nháp) theo thứ tự bản đồ |
| PUT | `/quizzes/map-order` | Admin | `{ gradeLevel, quizIds }`: đặt `mapOrder` = 1..n theo thứ tự gửi lên; quiz hệ thống không có trong danh sách xếp cuối. Id không phải quiz hệ thống của khối → 400 |

```json
{
  "gradeLevel": 1, "level": 2, "xp": 83, "passScore": 60,
  "stations": [
    { "id": "…", "title": "Khám phá sở thú", "topic": "Animals", "coverEmoji": "🦁", "questionCount": 6, "status": "passed", "bestScore": 83 },
    { "id": "…", "title": "Thế giới màu sắc", "coverEmoji": "🌈", "status": "unlocked", "bestScore": null },
    { "id": "…", "title": "Đếm số vui nhộn", "coverEmoji": "🔢", "status": "locked", "bestScore": null }
  ]
}
```

- `ProgressionService` (`progression/progression.service.ts`):
  - `gradeMap(user, grade)`: lấy trạm bằng `questMapFilter(grade)` (`quizzes/quiz-access.ts`), sắp theo `mapOrder`, rồi tính trạng thái từ điểm cao nhất mỗi bài (aggregate `$max` trên `student_progress`).
  - `isUnlocked(user, quiz)`: dùng cho `GET /quizzes/:id/play` (qua `IsQuizUnlockedQuery` trên QueryBus, để module Quizzes không phụ thuộc luật) và `POST /progress/sessions`. Trạm khoá → **403**.
  - `recordAttempt(...)`: khi nộp bài, tính `passed`, `xpEarned`, `leveledUp`, `levelAfter`, lưu lượt làm, cập nhật `users.studentProfile` (`$inc xp`, `$max level` — chạy song song cũng không làm tụt cấp), tìm trạm vừa mở.
- `users.studentProfile`: `{ gradeLevel, level, xp }` (đã bỏ `stars`, `diamonds`, `inventory`, `avatarUrl`).
- Query: `GetQuestMapQuery`, `IsQuizUnlockedQuery`, `MapOrderQuery` · Command: `ReorderMapCommand` (`quizzes/map-order.ts`).
- `quizzes.mapOrder?: number` (chỉ quiz hệ thống). Index `{ createdBy, status, gradeLevel, mapOrder }`.

## Frontend
- `fe/src/features/quizzes/pages/StudentHomePage.tsx` + `components/QuestMapNode.tsx` (dùng `progressApi.map`).
- Header (`app/AppLayout.tsx`) hiện `🏅 Cấp · ⚡ XP` từ profile; profile được làm mới sau mỗi lần nộp bài.
- `PASS_SCORE` ở `features/progress/types.ts` phải khớp backend (API map cũng trả `passScore`).
- **Admin sắp thứ tự trạm:** `/admin/map` (`fe/src/features/admin/pages/MapOrderPage.tsx`).
  - Chọn khối 1–5. Kéo thả (Framer Motion `Reorder`) hoặc bấm ↑/↓, rồi **💾 Lưu thứ tự**.
  - Mỗi trạm hiện số trạm học sinh thấy; quiz nháp hiện "–" và mờ, vì không lên bản đồ.
  - Trang có ghi chú giải thích: chỉ quiz hệ thống đã xuất bản lên bản đồ, còn quiz giáo viên đến với học sinh qua bài tập.

## Dữ liệu cũ (giai đoạn 2 → 3)
`npm run migrate:phase3` gán `mapOrder` cho quiz hệ thống theo `createdAt` hiện tại (bản đồ giữ nguyên thứ tự). Script cũng **liệt kê** các quiz giáo viên đã xuất bản: chúng rời khỏi bản đồ, giáo viên cần giao lại cho lớp dưới dạng bài tập. Cấp và XP đã đạt giữ nguyên.

## Dữ liệu cũ (giai đoạn 1 → 2)
`npm run migrate:phase2` (thư mục `be/`): xoá các trường sao/kim cương/avatar/vật phẩm/`rewardConfig`, **tính lại** `passed`, `xpEarned`, `leveledUp`, `levelAfter` cho từng lượt làm theo thứ tự thời gian và lưu cấp/XP cho từng học sinh. Chạy lại nhiều lần vẫn an toàn.

## Quyết định thiết kế
- Cấp = số trạm đã vượt (không dùng ngưỡng XP) để **lên cấp gắn trực tiếp với mở bản đồ** — trẻ hiểu ngay "vượt trạm = lên cấp = mở trạm mới".
- XP theo **cải thiện điểm** thay vì cộng mỗi lượt: chơi lại có ý nghĩa (phá kỷ lục) mà không "cày" được, bảng xếp hạng công bằng.
- Không lưu bảng "trạm đã mở" riêng: trạng thái tính lại từ `student_progress` mỗi lần → không lệch dữ liệu khi admin thêm/xoá/sắp lại trạm.
- **Bản đồ chỉ gồm quiz hệ thống** (D1): mọi em cùng khối thấy cùng một bản đồ ổn định, giáo viên không chen bài vào bản đồ của lớp khác. Quiz riêng của giáo viên đi qua bài tập, nơi đã có lớp, hạn nộp và báo cáo.

## Kiểm thử
- Unit: `progression/progression.rules.spec.ts` (ngưỡng đạt, XP, cấp, trạng thái trạm kể cả khi chèn trạm, mốc tuần/tháng giờ Việt Nam).
- e2e (`app.e2e-spec.ts`): trạm 2 khoá (play 403, session 403), giáo viên không bị khoá, dưới 60 điểm không lên cấp, vượt trạm → cấp 2 + mở trạm 2, chơi lại không thêm XP, profile `{ level: 2, xp: 100 }`. Quiz giáo viên không hiện với học sinh (play 404).
- e2e (`phase3.e2e-spec.ts`): quiz giáo viên chỉ chơi được qua bài tập (không có `assignmentId` → 404); admin đảo thứ tự trạm → bản đồ học sinh đổi theo; id quiz giáo viên → 400; giáo viên gọi `map-order` → 403.

## Hướng mở rộng
- Mở bản đồ lớp trên khi hoàn thành lớp dưới; huy hiệu khi hoàn thành cả bản đồ.
