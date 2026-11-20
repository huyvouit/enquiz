# 09 – Âm thanh & hiệu ứng

> Giai đoạn: 2 · Trạng thái: Xong · Cập nhật: 2026-11-15

## Mục tiêu
Phản hồi vui tai, vui mắt cho trẻ: "ting-ting" khi đúng, âm nhẹ nhàng (không gây nản) khi sai, nhạc mừng khi lên cấp, pháo giấy, nhạc nền du dương có thể tắt.

## Âm thanh (`fe/src/shared/sound/`)
- **Tổng hợp bằng Web Audio API** (`sound.ts`) – không có file âm thanh, không lo bản quyền, không tải thêm.

| Hiệu ứng | Khi nào |
| --- | --- |
| `correct` – "ting-ting" (C6→E6) | Trả lời đúng |
| `wrong` – "boop-boop" trầm, nhỏ | Trả lời sai |
| `tap` | Chạm ô nối từ, mở trạm |
| `locked` | Chạm trạm đang khoá |
| `finish` – hợp âm rải ngắn | Nộp bài (không lên cấp) |
| `levelUp` – hợp âm + lấp lánh | Lên cấp |

- **Nhạc nền**: giai điệu ngũ cung Đô trưởng lặp lại, âm sine nhỏ (`startMusic` / `stopMusic`).
- Cài đặt (`sound.store.ts`, Zustand `persist` key `enquiz-sound`): `effectsOn` (mặc định **bật**), `musicOn` (mặc định **tắt** để không làm ồn lớp học).
- Nút 🔊 / 🎵 trên header (`SoundControls`). Mọi nơi gọi `playSfx('correct')` → tự kiểm tra cài đặt.
- Trình duyệt chỉ cho phát âm thanh sau thao tác của người dùng: nếu nhạc nền đang bật mà tải lại trang, nhạc bắt đầu ở lần chạm đầu tiên (`unlockAudioOnFirstGesture`).

## Hiệu ứng hình ảnh
- Pháo giấy (`fe/src/shared/lib/celebrate.ts`, thư viện `canvas-confetti`): `confettiShower()` khi lên cấp, `confettiBurst()` khi đạt ≥ 90 điểm.
- Framer Motion: ô đúng phóng to, ô sai rung lắc, banner phản hồi bật lên, trạm kế tiếp nhún nhảy, trạm khoá rung khi chạm, chuỗi 🔥.
- Tôn trọng `prefers-reduced-motion`: CSS tắt chuyển động, pháo giấy không chạy.

## Quy tắc
- Âm sai phải **nhẹ và ngắn hơn** âm đúng; lời nhắn khi sai luôn động viên ("Gần đúng rồi đó! 💪"), không bao giờ trách.
- Hiệu ứng mới: thêm vào `sfx` trong `sound.ts`, gọi qua `playSfx` — không gọi `sfx` trực tiếp (bỏ qua cài đặt tắt tiếng).

## Hướng mở rộng
- Phát âm từ vựng tiếng Anh (Web Speech API `speechSynthesis`) cho câu hỏi nghe.
- Cho chọn nhiều bài nhạc nền, chỉnh âm lượng.
