# Bộ chạy thử app quản lý BMB

Chạy thử Worker `bmb-quanly-worker` ngay trên máy, không đụng tới hệ thống thật. Dùng trước mỗi lần giao file `admin.html` / Worker.

## Mã nguồn Worker không nằm trong repo

Repo này công khai (GitHub Pages), nên **mã Worker và cấu trúc D1 không được đưa lên đây**. Trước khi chạy, lấy 2 file về thư mục `test/.nguon/` (đã nằm trong `.gitignore`, không bao giờ bị commit):

| File | Lấy ở đâu |
| --- | --- |
| `test/.nguon/worker.js` | Mã Worker đang chạy: Cloudflare MCP `workers_get_worker_code` với `bmb-quanly-worker` (kết quả có dạng multipart, lấy phần `worker.js`), hoặc chép từ Dashboard → Workers → bmb-quanly-worker → Edit code. Nếu đang sửa, đặt bản đang sửa vào đây. |
| `test/.nguon/schema.sql` | D1 `bmb_data`: `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'` rồi nối các câu bằng `;`. Chỉ cần các bảng của app quản lý (`su_co`, `lich_su_xu_ly`, `tai_khoan`, `chi_nhanh`, `cai_dat`…). |

Có thể chỉ đường khác bằng `--worker <file>` và `--schema <file>`.

## Lệnh chạy (Node 22 trở lên)

```bash
node --no-warnings test/kich-ban.mjs      # các kịch bản nghiệp vụ (D1 giả, R2 giả, chặn mọi gọi Telegram)
node --no-warnings test/kiem-action.mjs   # đối chiếu action admin.html/index.html gọi ↔ action Worker có
node test/giao-dien.mjs                   # chạy admin.html thật trong Chromium (Playwright), chụp ảnh màn hình
```

- `kich-ban.mjs` phải xanh hết rồi mới giao file. Thoát mã 1 nếu có kịch bản hỏng.
- `kiem-action.mjs` bắt đúng lỗi "nút bấm im lặng": admin.html gọi một action mà Worker chưa có thì máy chủ trả `CHUA_HO_TRO`. Chỗ thiếu đã biết nhưng chưa sửa nằm trong danh sách `DA_BIET` (vẫn in cảnh báo).
- Dữ liệu mẫu (2 chi nhánh Tây Hòa và Nguyễn Văn Tăng, 5 tài khoản `admin`, `ql01`, `ql02`, `kt1`, `ktm1`, mật khẩu `1234`) chỉ để test, không phải dữ liệu thật.

## Thứ tự triển khai khi sửa cả Worker lẫn admin.html

1. Chạy `kich-ban.mjs` + `kiem-action.mjs` với Worker MỚI → xanh.
2. **Deploy Worker mới trước** (dán vào Dashboard → Deploy). Worker mới phải chạy được với cả admin.html cũ.
3. Rồi mới thay `admin.html` (push repo — hỏi anh Hưng trước khi push).

Làm ngược lại (admin.html trước), trong khoảng chờ các nút mới sẽ báo "máy chủ chưa có chức năng này".

## Thêm kịch bản

Mỗi lỗi thật gặp phải → thêm một `kb('...', async () => {...})` vào `kich-ban.mjs` tái hiện **đúng trình tự thật** (ví dụ lỗi mã kết nối Telegram 27/09/2026 chỉ lộ ra khi app tự tạo sẵn mã thứ hai). Sau khi viết, thử làm hỏng chỗ vừa sửa trong Worker xem kịch bản có đỏ không — đỏ mới là kịch bản có tác dụng.
