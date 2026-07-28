# Boom Music Box — hướng dẫn triển khai

Toàn bộ hệ thống chạy trên **GitHub Pages + Google Apps Script + Google Sheets + Google Drive**. Không có máy chủ, không phí hàng tháng.

```
Khách  →  index.html (GitHub Pages)  →  Apps Script Web App  →  Google Sheet
                                              ↓
                                    Gmail + Telegram (báo đơn mới)
                                              ↓
Quản lý chi nhánh  →  admin.html  →  duyệt / từ chối
```

---

## Phần A — Google Sheet + Apps Script (làm trước)

### A1. Tạo Sheet
1. Vào [sheets.new](https://sheets.new), đặt tên **Boom Music Box — Dữ liệu**
2. Menu **Tiện ích mở rộng → Apps Script**
3. Xoá hết code mẫu, dán toàn bộ `Code.gs` vào

### A2. Sửa cấu hình
Ở đầu `Code.gs`, sửa khối `CONFIG`:

```js
SECRET: 'chuoi-ngau-nhien-cua-rieng-ban-abc123xyz',   // BẮT BUỘC đổi
ADMIN_EMAIL: 'email-cua-ban@gmail.com',
TG_TOKEN: '',    // điền sau, xem phần C
TG_CHAT: '',
```

> `SECRET` là khoá ký phiên đăng nhập. Đổi nó rồi **giữ kín**. Nếu đổi sau khi đã tạo tài khoản, tất cả mật khẩu sẽ hỏng và phải chạy lại `doiMatKhau()`.

### A3. Chạy setup
1. Chọn hàm `setup` trên thanh công cụ → **Chạy**
2. Google hỏi quyền → **Xem lại quyền → chọn tài khoản → Nâng cao → Chuyển đến … (không an toàn) → Cho phép**
   (cảnh báo này là bình thường với script tự viết)
3. Xong sẽ có 4 sheet: `DonPhong`, `TaiKhoan`, `ChiNhanh`, `NhatKy`

### A4. Nạp 28 chi nhánh
1. Mở sheet **ChiNhanh**
2. **Tệp → Nhập → Tải lên** → chọn `ChiNhanh.csv`
3. Chọn **Thay thế trang tính hiện tại** → Nhập dữ liệu

### A5. Đổi mật khẩu (làm ngay)
Trong Apps Script, mở hàm `doiMatKhau()`, sửa 2 dòng rồi bấm Chạy:

```js
var USER = 'admin';
var PASS = 'MatKhauManhCuaBan';
```

Sau đó chạy `taoTaiKhoanChoTatCaChiNhanh()` để tạo tài khoản cho cả 28 chi nhánh. Mở **Nhật ký thực thi** để xem danh sách `tài khoản / mật khẩu` vừa tạo, gửi riêng cho từng quản lý và nhắc họ báo lại để bạn đổi.

### A6. Triển khai Web App
**Triển khai → Tuỳ chọn triển khai mới → Ứng dụng web**

| Mục | Chọn |
|---|---|
| Mô tả | `v1` |
| Thực thi với tư cách | **Tôi** |
| Ai có quyền truy cập | **Bất kỳ ai** |

Copy URL dạng `https://script.google.com/macros/s/AKfy…/exec`.

> ⚠️ **Mỗi lần sửa `Code.gs`, phải tạo phiên bản triển khai mới**: Triển khai → Quản lý triển khai → biểu tượng bút chì → Phiên bản: **Mới** → Triển khai. Chỉ bấm Lưu là URL vẫn chạy code cũ.

---

## Phần B — GitHub Pages

### B1. Tạo repo
1. [github.com/new](https://github.com/new) → tên `boommusicbox` → **Public** → Create

### B2. Tải file lên
Kéo thả tất cả file vào repo:

```
index.html
admin.html
manifest.webmanifest
robots.txt
assets/logo_boombox.jpg
```

### B3. Dán URL Apps Script
Sửa trực tiếp trên GitHub (bấm vào file → biểu tượng bút chì):

- Trong `index.html`, tìm `API: ''` (khoảng dòng 20 của khối `<script>`) → dán URL vào
- Trong `admin.html`, làm y hệt

```js
API: 'https://script.google.com/macros/s/AKfy.../exec',
```

Hai file phải dùng **cùng một URL**.

### B4. Bật Pages
**Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**

Sau 1–2 phút site chạy tại `https://<tên-github>.github.io/boommusicbox/`

### B5. Gắn tên miền boommusicbox.com
1. Settings → Pages → Custom domain → nhập `boommusicbox.com` → Save
2. Tại nhà cung cấp tên miền, thêm bản ghi DNS:

| Loại | Tên | Giá trị |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<tên-github>.github.io` |

3. Đợi DNS (15 phút đến vài giờ) → tick **Enforce HTTPS**

---

## Phần C — Thông báo miễn phí

### Email (đã sẵn sàng)
`MailApp` của Apps Script gửi miễn phí **100 thư/ngày** với Gmail thường. Với 30 chi nhánh, mỗi đơn tốn 2 thư (1 cho quản lý, 1 cho khách) → khoảng 50 đơn/ngày là chạm trần.

Khi vượt: nâng Google Workspace (~$7/tháng, được 1.500 thư/ngày và có luôn email `@boommusicbox.com`), hoặc dùng Brevo (300 thư/ngày miễn phí vĩnh viễn).

### Telegram (khuyên dùng — tức thì, không giới hạn)
1. Chat với **@BotFather** trên Telegram → `/newbot` → đặt tên → copy token
2. Tạo group "Boom — Đơn mới", thêm bot vào, gửi một tin bất kỳ
3. Mở `https://api.telegram.org/bot<TOKEN>/getUpdates` → tìm `"chat":{"id":-100…}`
4. Dán token và chat id vào `CONFIG.TG_TOKEN`, `CONFIG.TG_CHAT` → **triển khai lại**

Quản lý chi nhánh cài Telegram là có chuông báo đơn mới ngay lập tức.

### SMS — nói thẳng: không có SMS tự động miễn phí
Ở Việt Nam mọi cổng SMS đều tính phí (~250–800đ/tin, và tin quảng cáo còn cần đăng ký brandname). Hệ thống này thay thế bằng cách **miễn phí hoàn toàn**:

- Nút **"Nhắn tin cho chi nhánh"** ở màn hình đặt phòng thành công — mở sẵn app tin nhắn của khách với nội dung điền đủ, khách chỉ bấm gửi
- Nút **"Nhắn xác nhận"** trong trang quản lý — mở app tin nhắn của nhân viên với nội dung xác nhận điền sẵn
- Nút **Zalo** — mở chat Zalo với số điện thoại đó

Cách này tốn 1 cú chạm nhưng không mất đồng nào và tỉ lệ đọc cao hơn email. Khi có ngân sách, nối eSMS.vn hoặc Twilio vào hàm `notifyCustomer()` là xong.

---

## Phần D — Vận hành hằng ngày

### Quản lý chi nhánh
1. Vào `boommusicbox.com/admin.html`
2. Đăng nhập bằng tài khoản chi nhánh → chỉ thấy đơn của chi nhánh mình
3. Tab **Chờ duyệt** → bấm **Duyệt** hoặc **Từ chối**
4. Trang tự làm mới mỗi phút, tiêu đề tab hiện số đơn đang chờ

### Tài khoản admin
Thấy toàn bộ 28 chi nhánh, có thêm bộ lọc chi nhánh và tab **Báo cáo** (biểu đồ 14 ngày, xếp hạng chi nhánh, tỉ lệ duyệt).

### Thêm chi nhánh mới
Chỉ cần thêm một dòng vào sheet **ChiNhanh** rồi tải lại web. Không phải sửa code.

Cột bắt buộc: `id`, `name`, `short`, `address`, `region`, `phone`, `lat`, `lng`, `price`, `priority`, `active`.
Lấy `lat`/`lng`: mở Google Maps → chuột phải vào điểm → bấm vào cặp số hiện ra để copy.

### Thêm ảnh chi nhánh
Điền cột `photo` bằng URL ảnh. Cách miễn phí: tải ảnh lên chính repo GitHub (thư mục `assets/branches/`) rồi điền `assets/branches/tayhoa.jpg`. Chưa có ảnh thì site tự hiện ô gradient tím-vàng kèm chữ viết tắt tên chi nhánh — vẫn gọn gàng, không vỡ layout.

### Trigger tự động (không bắt buộc)
Trong Apps Script → **Trình kích hoạt** → Thêm:
- `baoCaoHangNgay` — theo ngày, 7–8h → email tổng hợp lịch trong ngày
- `luuTruDonCu` — theo tháng → chuyển đơn cũ hơn 180 ngày sang Drive cho sheet nhẹ

---

## Phần E — Bảo mật đã có sẵn

| Lớp | Cách làm |
|---|---|
| Mật khẩu | Băm SHA-256 ở trình duyệt trước khi gửi, băm lần hai kèm `SECRET` ở máy chủ. Sheet không bao giờ chứa mật khẩu thô |
| Phiên đăng nhập | Token có chữ ký HMAC, hết hạn sau 8 giờ, lưu ở `sessionStorage` (đóng tab là mất) |
| Chống dò mật khẩu | Sai 5 lần → khoá tài khoản 15 phút |
| Tự đăng xuất | 20 phút không thao tác |
| Phân quyền | Máy chủ tự lọc theo `branchId` trong token. Quản lý chi nhánh A **không thể** đọc hay sửa đơn của chi nhánh B kể cả khi sửa code trình duyệt |
| Chống spam đặt phòng | Honeypot ẩn + tối đa 3 đơn/10 phút mỗi thiết bị + tối đa 5 đơn/ngày mỗi số điện thoại |
| Chống XSS | Mọi dữ liệu người dùng nhập đều escape trước khi hiển thị |
| Kiểm tra hai lớp | Số điện thoại, ngày, giờ được validate cả ở trình duyệt lẫn máy chủ |
| Nhật ký | Sheet `NhatKy` ghi mọi lần đăng nhập, đăng nhập sai, đặt phòng, duyệt đơn |
| Ẩn khỏi Google | `admin.html` có `noindex` và bị chặn trong `robots.txt` |

### Việc bạn cần làm để bảo mật thật sự
1. Đổi `SECRET` thành chuỗi ngẫu nhiên dài, đừng dùng chuỗi mẫu
2. Đổi mật khẩu `admin` ngay sau khi setup
3. Mỗi chi nhánh một tài khoản riêng, **không dùng chung**
4. Sheet dữ liệu chỉ chia sẻ cho người thật sự cần
5. Nhân sự nghỉ việc → đổi cột `kichhoat` sang `N` trong sheet `TaiKhoan`

---

## Ghi chú về dữ liệu

- **Toạ độ bản đồ**: chỉ Tây Hòa và Nguyễn Văn Tăng có toạ độ chính xác lấy từ link Google Maps trong file bạn gửi. 26 chi nhánh còn lại là **ước lượng theo địa chỉ** — ghim trên bản đồ có thể lệch vài trăm mét. Nút "Chỉ đường" vẫn luôn đúng vì nó gửi địa chỉ dạng chữ sang Google Maps. Sửa dần cột `lat`/`lng` trong sheet khi rảnh; chi nhánh nào chưa chính xác sẽ hiện dòng chú thích nhỏ trong phần chi tiết.
- **Bản đồ dùng Leaflet + OpenStreetMap**, không cần API key và không tính phí. Google Maps JavaScript API yêu cầu gắn thẻ thanh toán nên tôi tránh.
- **Site chạy được ngay cả khi chưa có Apps Script**: 28 chi nhánh đã nhúng sẵn trong `index.html` làm bản dự phòng. Khi có API, dữ liệu từ Sheet sẽ ghi đè. Đặt phòng lúc chưa có API vẫn ra mã và nút nhắn tin, chỉ là không lưu lên Sheet.
- **2 chi nhánh còn thiếu**: file bạn gửi có 28 dòng, hệ thống ghi nhận 30 chi nhánh. Thêm 2 dòng vào sheet `ChiNhanh` khi có thông tin.
