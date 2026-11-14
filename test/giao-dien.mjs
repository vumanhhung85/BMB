/* Chạy admin.html THẬT trong Chromium (Playwright), gọi vào Worker chạy trên máy (D1 giả) — không đụng
   hệ thống thật. Kiểm: Kanban (admin), khung Trao đổi gửi chữ + ảnh, số tin trên thẻ, giao diện điện
   thoại của quản lý chi nhánh, không có lỗi JavaScript. Ảnh chụp lưu ở test/anh-chup/ (đã .gitignore).
   Cần Playwright: cài ở thư mục bất kỳ rồi chỉ tới đó, vd
     PLAYWRIGHT_DIR=/duong/dan/co/node_modules node test/giao-dien.mjs
   Chromium dùng bản có sẵn trong máy (PLAYWRIGHT_CHROMIUM, mặc định /opt/pw-browsers/chromium). */
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { taoMoiTruong, kb, dung, bang, chayTatCa } from './moi-truong.mjs';

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANH_CHUP = join(GOC, 'test', 'anh-chup');
mkdirSync(ANH_CHUP, { recursive: true });

let playwright;
try { playwright = await import('playwright'); }
catch (e) { playwright = createRequire(join(process.env.PLAYWRIGHT_DIR || process.cwd(), 'x.js'))('playwright'); }
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';

const API = readFileSync(join(GOC, 'admin.html'), 'utf-8').match(/API:\s*'(https:\/\/[^']+workers\.dev)'/)[1];
const LOAI_FILE = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.js': 'text/javascript' };

/** Ảnh JPEG thật (vẽ bằng canvas trong trình duyệt) để chọn từ "Thư viện". */
async function taoAnhThu(trang) {
  const b64 = await trang.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const g = c.getContext('2d'); g.fillStyle = '#4B1272'; g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#FFD21A'; g.font = 'bold 60px sans-serif'; g.fillText('Dây mic', 150, 260);
    return c.toDataURL('image/jpeg', 0.8).split(',')[1];
  });
  return { name: 'day-mic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') };
}

async function moTrinhDuyet(m, kichThuoc) {
  const trinh = await playwright.chromium.launch({ executablePath: CHROMIUM, headless: true });
  const ctx = await trinh.newContext({ viewport: kichThuoc || { width: 1360, height: 900 }, deviceScaleFactor: 1, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const loiJS = [];
  await ctx.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === 'https://bmb.test') {
      const f = join(GOC, decodeURIComponent(url.pathname));
      if (!existsSync(f)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: LOAI_FILE[extname(f)] || 'application/octet-stream', body: readFileSync(f) });
    }
    if (req.url().startsWith(API)) {        // → Worker chạy trên máy
      const res = await m.worker.fetch(new Request(req.url(), {
        method: req.method(), headers: req.headers(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData()
      }), m.env, { waitUntil: () => {} });
      return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    }
    return route.abort();                    // font/CDN bên ngoài: không cần cho kiểm thử
  });
  const trang = await ctx.newPage();
  trang.on('pageerror', e => loiJS.push(String(e.message || e)));
  return { trinh, trang, loiJS };
}

async function dangNhapUI(trang, user) {
  await trang.goto('https://bmb.test/admin.html');
  await trang.fill('#uUser', user);
  await trang.fill('#uPass', '1234');
  await trang.click('#loginBtn');
  await trang.waitForSelector('#app .main', { state: 'visible', timeout: 15000 });
  await trang.waitForFunction(() => !document.querySelector('#statsSuCo').innerHTML.includes('—') || true);
  await trang.waitForTimeout(800);
}
/** Admin vào trang Sự cố: máy tính bấm thanh bên, điện thoại bấm tab dưới. */
async function moSuCo(trang) {
  const ben = await trang.$('#sideNav .nav-i[data-go="baotri"]');
  if (ben && await ben.isVisible()) await ben.click();
  else await trang.click('.tab[data-t="baotri"]');
  await trang.waitForSelector('#toolbarSuCo', { state: 'visible' });
}

/** Dữ liệu: 4 sự cố ở 4 khâu khác nhau, 1 sự cố đã có 1 tin trao đổi. */
async function duLieu() {
  const m = await taoMoiTruong();
  const tk = {};
  for (const u of ['admin', 'ql01', 'kt1']) tk[u] = await m.dangNhap(u);
  const tao = async (moTa, phong) => (await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa, phong }, tk.ql01)).maSuCo;
  const moi = await tao('Loa phòng 2 mất tiếng', 'P2');
  const tn = await tao('Tivi phòng 3 sọc màn hình', 'P3');
  await m.goi('suco_tiepnhan', { maSuCo: tn }, tk.admin);
  const xl = await tao('Mic tay phải phòng 5 rè', 'P5');
  await m.goi('suco_tiepnhan', { maSuCo: xl }, tk.admin);
  await m.goi('suco_dieuphoi', { maSuCo: xl, kyThuat: 'kt1' }, tk.admin);
  await m.goi('suco_nhanviec', { maSuCo: xl }, tk.kt1);
  await m.goi('suco_batdau', { maSuCo: xl }, tk.kt1);
  await m.goi('suco_traodoi', { maSuCo: xl, noiDung: 'Anh tới khoảng 15 phút nữa nhé' }, tk.kt1);
  const cx = await tao('Máy lạnh phòng 7 chảy nước', 'P7');
  await m.goi('suco_tiepnhan', { maSuCo: cx }, tk.admin);
  await m.goi('suco_dieuphoi', { maSuCo: cx, kyThuat: 'kt1' }, tk.admin);
  await m.goi('suco_nhanviec', { maSuCo: cx }, tk.kt1);
  await m.goi('suco_baoxong', { maSuCo: cx, ghiChu: 'Thông ống thoát nước' }, tk.kt1);
  return { m, ma: { moi, tn, xl, cx } };
}

kb('Admin: Kanban chia đúng 6 cột, đếm đúng, thẻ có nút hành động', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    await dangNhapUI(trang, 'admin');
    await moSuCo(trang);
    await trang.click('#btnBtKanbanView');
    await trang.waitForSelector('#viewSuCoKanban .kb-cot');
    const cot = await trang.$$eval('.kb-cot', ds => ds.map(c => ({ ma: c.dataset.cot, n: c.querySelectorAll('.kb-the').length })));
    bang(cot.length, 6, 'số cột');
    const n = Object.fromEntries(cot.map(c => [c.ma, c.n]));
    bang(n.moi, 1, 'Mới báo'); bang(n.tiepnhan, 1, 'Đã tiếp nhận'); bang(n.xuly, 1, 'Đang xử lý'); bang(n.xacnhan, 1, 'Chờ xác nhận');
    dung(await trang.$('#kb-' + ma.moi + ' button:has-text("Tiếp nhận")'), 'thẻ Mới có nút Tiếp nhận');
    dung(await trang.$('#kb-' + ma.tn + ' button:has-text("Điều phối")'), 'thẻ Đã tiếp nhận có nút Điều phối');
    bang((await trang.textContent('#kb-' + ma.xl + ' .td-dem')).trim(), '1', 'thẻ hiện 1 tin trao đổi');
    // lọc bằng ô tìm kiếm chung
    await trang.fill('#qSuCo', 'may lanh');
    await trang.waitForTimeout(200);
    bang(await trang.$$eval('.kb-the', d => d.length), 1, 'tìm "may lanh" (không dấu) còn 1 thẻ');
    await trang.fill('#qSuCo', '');
    await trang.waitForTimeout(200);
    // bấm Tiếp nhận ngay trên thẻ → thẻ chuyển cột
    trang.once('dialog', d => d.accept('2'));     // hộp hỏi xác nhận mức độ (prompt sẵn có của app)
    await trang.click('#kb-' + ma.moi + ' button:has-text("Tiếp nhận")');
    await trang.waitForFunction(id => document.querySelector('.kb-cot[data-cot="tiepnhan"] #kb-' + id), ma.moi, { timeout: 8000 });
    await trang.screenshot({ path: join(ANH_CHUP, '1-admin-kanban.png'), fullPage: false });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Admin: Kanban ghim chi nhánh — huy hiệu 🔗 +N, tô sáng mọi cột (không ẩn), tự bỏ ghim khi hết phiếu', async () => {
  const m = await taoMoiTruong();
  const tk = {};
  for (const u of ['admin', 'ql01', 'ql02']) tk[u] = await m.dangNhap(u);
  const tao = async (u, moTa, phong) => (await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa, phong }, tk[u])).maSuCo;
  const a1 = await tao('ql01', 'Loa phòng 2 mất tiếng', 'P2');
  const a2 = await tao('ql01', 'Tivi phòng 3 sọc', 'P3');
  await m.goi('suco_tiepnhan', { maSuCo: a2 }, tk.admin);
  const b1 = await tao('ql02', 'Mic phòng 1 rè', 'P1');
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    await dangNhapUI(trang, 'admin');
    await moSuCo(trang);
    await trang.click('#btnBtKanbanView');
    await trang.waitForSelector('#viewSuCoKanban .kb-cot');
    bang((await trang.textContent('#kb-' + a1 + ' .kb-lk')).trim(), '🔗 +1', 'phiếu A1 có huy hiệu +1');
    bang((await trang.textContent('#kb-' + a2 + ' .kb-lk')).trim(), '🔗 +1', 'phiếu A2 có huy hiệu +1');
    bang(await trang.$('#kb-' + b1 + ' .kb-lk'), null, 'chi nhánh chỉ có 1 phiếu thì không có huy hiệu');
    dung((await trang.getAttribute('#kb-' + a1 + ' .kb-lk', 'title')).includes('Mới báo ×1'), 'rê chuột hiện phân bố theo cột');
    // bấm huy hiệu: ghim, KHÔNG mở Lịch sử
    await trang.click('#kb-' + a1 + ' .kb-lk');
    bang(await trang.$$eval('.kb-the.cung', d => d.length), 2, '2 phiếu cùng chi nhánh được tô sáng');
    bang(await trang.$$eval('.kb-the', d => d.length), 3, 'không phiếu nào bị ẩn');
    dung(await trang.$eval('#kanbanCot', e => e.classList.contains('ghim')), 'khung Kanban vào chế độ ghim');
    await trang.waitForTimeout(350);   // chờ hết hiệu ứng chuyển mờ
    dung(await trang.$eval('#kb-' + b1, e => Number(getComputedStyle(e).opacity) < 0.6), 'phiếu chi nhánh khác bị mờ đi');
    bang(await trang.$eval('#modalOverlay', e => getComputedStyle(e).display), 'none', 'bấm huy hiệu không mở Lịch sử');
    const bar = await trang.textContent('#kbGhimBar');
    dung(bar.includes('2 phiếu') && bar.includes('Mới báo ×1') && bar.includes('Đã tiếp nhận ×1'), 'thanh ghim tóm tắt: ' + bar);
    await trang.click('#kbGhimBar .kb-gc >> nth=1');           // nhảy tới phiếu ở cột Đã tiếp nhận (không lỗi)
    // vẽ lại (như lần tự cập nhật mỗi phút) vẫn giữ ghim
    await trang.evaluate(() => drawSuCoKanban()); await trang.waitForTimeout(150);
    bang(await trang.$$eval('.kb-the.cung', d => d.length), 2, 'ghim còn nguyên sau khi vẽ lại');
    // bấm tên chi nhánh trên thẻ cũng bỏ ghim (bấm lần nữa)
    await trang.click('#kb-' + a2 + ' .kb-cn-b');
    bang(await trang.$$eval('.kb-the.cung', d => d.length), 0, 'bấm lại tên chi nhánh = bỏ ghim');
    dung(!(await trang.$eval('#kanbanCot', e => e.classList.contains('ghim'))), 'khung hết chế độ ghim');
    // ghim lại, rồi nút "Bỏ ghim"
    await trang.click('#kb-' + a2 + ' .kb-lk');
    await trang.click('#kbGhimBar .kb-bo');
    bang(await trang.$$eval('.kb-the.cung', d => d.length), 0, 'nút Bỏ ghim hoạt động');
    // ghim rồi tìm chữ không khớp phiếu nào của chi nhánh → tự bỏ ghim
    await trang.click('#kb-' + a1 + ' .kb-lk');
    await trang.fill('#qSuCo', b1); await trang.waitForTimeout(250);
    dung(!(await trang.$eval('#kanbanCot', e => e.classList.contains('ghim'))), 'chi nhánh không còn phiếu hiện → tự bỏ ghim');
    await trang.fill('#qSuCo', ''); await trang.waitForTimeout(200);
    // bấm vào thân thẻ vẫn mở Lịch sử như cũ
    await trang.click('#kb-' + a1 + ' .kb-phu');
    await trang.waitForFunction(() => getComputedStyle(document.getElementById('modalOverlay')).display !== 'none', null, { timeout: 5000 });
    await trang.click('#modalOverlay button:has-text("✕")');
    // ảnh chụp để xem bằng mắt
    await trang.click('#kb-' + a1 + ' .kb-lk');
    await trang.screenshot({ path: join(ANH_CHUP, '1b-admin-kanban-ghim.png'), fullPage: false });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Admin: mở 💬 trên thẻ Kanban, gửi chữ + ảnh từ thư viện → lịch sử có bong bóng + ảnh, D1 có dòng', async () => {
  const { m, ma } = await duLieu();
  m.noiTG('kt1', 900);
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    await dangNhapUI(trang, 'admin');
    await moSuCo(trang);
    await trang.click('#btnBtKanbanView');
    await trang.click('#kb-' + ma.xl + ' button:has-text("💬")');
    await trang.waitForSelector('#tdKhung textarea');
    dung((await trang.textContent('#tdKhung .td-mo')).includes('Kỹ thuật Một'), 'ghi rõ người nhận');
    await trang.fill('#tdNoiDung', 'Nhớ mang dây mic dự phòng\nvà pin AA');
    await trang.setInputFiles('#tdAnhLib', await taoAnhThu(trang));
    await trang.waitForSelector('#tdPhotoBox .th img');
    m.xoaTin();
    await trang.click('#tdGui');
    await trang.waitForFunction(() => document.querySelectorAll('#lsBody .ls-item.td').length === 2, null, { timeout: 8000 });
    const bong = await trang.$$eval('#lsBody .ls-item.td .td-bong', d => d.map(x => x.textContent));
    dung(bong[1].includes('Nhớ mang dây mic dự phòng'), 'bong bóng tin mới');
    bang(await trang.$$eval('#lsBody .ls-item.td:last-child .td-bong img', d => d.length), 1, '1 ảnh trong bong bóng');
    bang(await trang.$eval('#tdNoiDung', e => e.value), '', 'ô nhập đã xoá sau khi gửi');
    bang(await trang.$$eval('#tdPhotoBox .th', d => d.length), 0, 'ảnh chờ đã xoá');
    const dong = m.sql("SELECT ghi_chu, anh FROM lich_su_xu_ly WHERE ma_su_co=? AND hanh_dong='TRAO_DOI' ORDER BY id DESC", ma.xl)[0];
    bang(dong.ghi_chu, 'Nhớ mang dây mic dự phòng\nvà pin AA', 'D1 lưu nguyên văn');
    bang(JSON.parse(dong.anh).length, 1, 'D1 lưu 1 ảnh');
    const kh = JSON.parse(dong.anh)[0];
    dung(m.ANH._kho.get(kh).body.length < 400 * 1024, 'ảnh đã nén nhỏ (' + m.ANH._kho.get(kh).body.length + ' byte)');
    bang(m.tin(900).length, 1, 'kỹ thuật nhận Telegram');
    // bấm ảnh → mở khung xem ảnh trong app (không mở tab mới)
    await trang.click('#lsBody .ls-item.td:last-child .td-bong img');
    await trang.waitForSelector('#anhXemModal.show');
    await trang.keyboard.press('Escape');
    await trang.screenshot({ path: join(ANH_CHUP, '2-admin-trao-doi.png') });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Quản lý chi nhánh (điện thoại 390px): nút 💬 có số tin, khung nhắn ghi đúng người nhận, không có Kanban', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'ql01');
    bang(await trang.$eval('#btnBtKanbanView', b => getComputedStyle(b).display), 'none', 'quản lý không thấy nút Kanban');
    const nut = await trang.waitForSelector('#sc-' + ma.xl + ' button:has-text("Trao đổi")');
    bang((await nut.textContent()).replace(/\s+/g, ' ').trim(), '💬 Trao đổi 1', 'nút có số tin');
    await nut.click();
    await trang.waitForSelector('#tdKhung');
    dung((await trang.textContent('#tdKhung .td-mo')).includes('kỹ thuật đang phụ trách'), 'người nhận là kỹ thuật');
    const rong = await trang.evaluate(() => document.documentElement.scrollWidth);
    dung(rong <= 390, 'không tràn ngang trên điện thoại (' + rong + 'px)');
    await trang.fill('#tdNoiDung', 'Khách đổi sang phòng 6 rồi, anh cứ sửa');
    await trang.click('#tdGui');
    await trang.waitForFunction(() => document.querySelectorAll('#lsBody .ls-item.td').length === 2, null, { timeout: 8000 });
    await trang.screenshot({ path: join(ANH_CHUP, '3-quanly-dien-thoai.png') });
    // ticket đã đóng/chưa giao: sự cố "Mới" chưa có kỹ thuật → người nhận là admin
    await trang.click('#modalOverlay button:has-text("✕")');
    await trang.click('#sc-' + ma.moi + ' button:has-text("Trao đổi")');
    await trang.waitForSelector('#tdKhung');
    dung((await trang.textContent('#tdKhung .td-mo')).includes('admin'), 'chưa giao → người nhận là admin');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Kỹ thuật: chỉ thấy 💬 trên việc được giao; bấm nút trên tin Telegram (?ticket=…&traodoi=1) mở thẳng khung nhắn', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 412, height: 900 });
  try {
    await dangNhapUI(trang, 'kt1');
    await trang.click('#btnBtListView');
    await trang.waitForSelector('#sc-' + ma.xl + ' button:has-text("Trao đổi")');
    await trang.goto('https://bmb.test/admin.html?ticket=' + ma.xl + '&traodoi=1');
    await trang.waitForSelector('#tdKhung', { timeout: 15000 });
    dung((await trang.textContent('#tdKhung .td-mo')).includes('Tây Hòa'), 'người nhận: quản lý chi nhánh Tây Hòa');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Giao diện: chọn Bạc Hà + Tối trong Tài khoản → tải lại vẫn giữ, màn đăng nhập cũng theo; nút đổi nhanh xoay vòng', async () => {
  const { m } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'kt1');
    bang(await trang.evaluate(() => document.documentElement.dataset.themeMode), 'auto', 'mặc định theo máy');
    bang(await trang.evaluate(() => document.documentElement.hasAttribute('data-palette')), false, 'mặc định Boom Tím Vàng');
    await trang.click('.tab[data-t="caidat"]');
    await trang.click('#gdBoMau .pal-opt:has-text("Bạc Hà")');
    await trang.click('#gdCheDoNut button[data-m="dark"]');
    bang(await trang.evaluate(() => [document.documentElement.dataset.palette, document.documentElement.dataset.theme].join('/')), 'bacha/dark', 'áp dụng ngay');
    bang(await trang.$eval('#metaTheme', e => e.content), '#0B3B37', 'màu thanh trạng thái điện thoại');
    await trang.evaluate(() => logout());
    await trang.waitForSelector('#login', { state: 'visible' });
    bang(await trang.evaluate(() => [document.documentElement.dataset.palette, document.documentElement.dataset.theme].join('/')), 'bacha/dark', 'màn đăng nhập giữ lựa chọn');
    const nen = await trang.$eval('.loginbox', e => getComputedStyle(e).backgroundColor);
    bang(nen, 'rgb(18, 48, 44)', 'hộp đăng nhập màu Bạc Hà tối');
    await trang.click('#btnThemeLogin');              // Tối → Theo máy
    bang(await trang.evaluate(() => document.documentElement.dataset.themeMode), 'auto', 'xoay vòng sang Theo máy');
    await trang.click('#btnThemeLogin');              // Theo máy → Sáng
    bang(await trang.evaluate(() => document.documentElement.dataset.theme), 'light', 'xoay vòng sang Sáng');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Admin Tổng quan: mở đầu ở Tổng quan, số đúng, "Cần làm ngay" có Tiếp nhận / Điều phối; thanh bên mở đúng mục Cài đặt', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    await dangNhapUI(trang, 'admin');
    await trang.waitForSelector('#tongquan', { state: 'visible' });
    const so = await trang.$$eval('#tqKpi .stat', d => d.map(x => x.querySelector('.k').textContent + '=' + x.querySelector('.v').textContent));
    dung(so.includes('Chờ tiếp nhận=1') && so.includes('Chờ điều phối=1') && so.includes('Kỹ thuật đang xử lý=1') && so.includes('Chờ xác nhận / đóng=1'), 'KPI: ' + so.join(', '));
    bang(await trang.$$eval('#tqCanLam .q-row', d => d.length), 2, '2 việc chờ admin');
    dung(await trang.$('#tqCanLam .q-row:has-text("Chờ tiếp nhận") button:has-text("Tiếp nhận")'), 'dòng tiếp nhận');
    dung((await trang.textContent('#tqKyThuat')).includes(ma.xl), 'kỹ thuật đang xử lý đúng phiếu');
    await trang.screenshot({ path: join(ANH_CHUP, '4-admin-tong-quan.png') });
    await trang.click('#tqCanLam .q-row:has-text("Chờ điều phối") button');
    await trang.waitForSelector('#formDieuPhoi', { state: 'visible' });
    dung((await trang.textContent('#dpTicketInfo')).includes(ma.tn), 'form điều phối đúng phiếu');
    // thanh bên → Danh mục / Chi nhánh: chỉ hiện thẻ Quản lý chi nhánh
    await trang.click('#sideNav .nav-i[data-go="cd:chinhanh"]');
    const the = await trang.$$eval('#caidat [data-nhom]', d => d.filter(x => x.offsetParent !== null).map(x => x.querySelector('h3').textContent.trim()));
    bang(the.join('|'), 'Quản lý chi nhánh', 'chỉ thẻ Chi nhánh');
    bang((await trang.textContent('#hPage')).trim(), 'Chi nhánh', 'tiêu đề trang');
    await trang.click('#sideNav .nav-i[data-go="cd:canhan"]');
    const the2 = await trang.$$eval('#caidat [data-nhom]', d => d.filter(x => x.offsetParent !== null).length);
    bang(the2, 3, 'Tài khoản của tôi: Giao diện + Thông báo + Đổi mật khẩu');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Kỹ thuật (điện thoại): Việc của tôi chia nhóm, việc đang xử lý có nút to "Báo xong", thanh dưới 2–3 tab', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'kt1');
    await trang.click('#btnBtListView');     // mặc định của kỹ thuật là Bảng → chuyển sang Danh sách
    const nhom = await trang.$$eval('#listSuCoChuaXuLy .nhom-h', d => d.map(x => x.firstChild.textContent.trim()));
    bang(nhom[0], 'Đang làm', 'nhóm đầu là Đang làm (' + nhom.join(', ') + ')');
    dung(await trang.$('#sc-' + ma.xl + ' .sc-chinh button.btn-lg:has-text("Báo xong")'), 'nút to Báo xong');
    bang(await trang.$$eval('#sc-' + ma.xl + ' .sc-buoc .steps i.on', d => d.length), 2, 'thanh tiến độ ở bước 2');
    const tab = await trang.$$eval('.tabs .tab', d => d.filter(x => getComputedStyle(x).display !== 'none').map(x => x.textContent.trim()));
    dung(tab[0].startsWith('Việc của tôi') && tab[tab.length - 1] === 'Tài khoản', 'tab dưới: ' + tab.join(' · '));
    const vt = await trang.$eval('.tabs', e => { const r = e.getBoundingClientRect(); return [getComputedStyle(e).position, Math.round(r.bottom)]; });
    bang(vt.join(','), 'fixed,844', 'thanh tab nằm sát đáy');
    const rong = await trang.evaluate(() => document.documentElement.scrollWidth);
    dung(rong <= 390, 'không tràn ngang (' + rong + 'px)');
    await trang.screenshot({ path: join(ANH_CHUP, '5-kythuat-viec-cua-toi.png') });
    await trang.click('#sc-' + ma.xl + ' .sc-chinh button');
    await trang.waitForSelector('#formBaoXong', { state: 'visible' });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Quản lý (điện thoại): nút to Báo sự cố mới, nhóm "Cần anh/chị xác nhận" đứng đầu, bấm Đã xong → phiếu sang Chờ đóng', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'ql01');
    dung(await trang.isVisible('#ctaBaoSuCo'), 'có nút to Báo sự cố mới');
    const nhom = await trang.$$eval('#listSuCoChuaXuLy .nhom-h', d => d.map(x => x.firstChild.textContent.trim()));
    bang(nhom[0], 'Cần anh/chị xác nhận', 'nhóm đầu (' + nhom.join(', ') + ')');
    await trang.screenshot({ path: join(ANH_CHUP, '6-quanly-su-co.png') });
    await trang.click('#sc-' + ma.cx + ' .sc-chinh button:has-text("Đã xong")');
    await trang.waitForFunction(() => [...document.querySelectorAll('#listSuCoChuaXuLy .nhom-h')].some(x => x.textContent.includes('Chờ đóng')), null, { timeout: 8000 });
    bang(m.sql('SELECT trang_thai FROM su_co WHERE ma_su_co=?', ma.cx)[0].trang_thai, 'cho_dong', 'D1: chờ đóng');
    await trang.click('#ctaBaoSuCo');
    await trang.waitForSelector('#formTaoSuCo', { state: 'visible' });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Kiểu xem Sự cố: admin mặc định Kanban, kỹ thuật mặc định Bảng; kỹ thuật có đủ 4 kiểu và làm việc được ngay trên Bảng/Kanban; đổi mặc định trong Giao diện thì tải lại vẫn giữ', async () => {
  const { m, ma } = await duLieu();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    // ── admin
    await dangNhapUI(trang, 'admin');
    await moSuCo(trang);
    dung(await trang.isVisible('#viewSuCoKanban'), 'admin mở Sự cố → Kanban');
    dung(await trang.isVisible('#btnBtTableView') && await trang.isVisible('#btnBtListView'), 'admin có đủ nút kiểu xem');
    await trang.evaluate(() => localStorage.removeItem(CFG.PREFIX + 's'));   // đăng xuất kiểu nhẹ, tránh va với location.reload() của logout()
    // ── kỹ thuật
    await dangNhapUI(trang, 'kt1');
    dung(await trang.isVisible('#viewSuCoTable'), 'kỹ thuật mở → Bảng');
    for (const id of ['#btnBtTableView', '#btnBtKanbanView', '#btnBtMapView', '#btnBtListView'])
      dung(await trang.isVisible(id), 'kỹ thuật thấy nút ' + id);
    dung(!(await trang.isVisible('button:has-text("Đã xoá")')), 'kỹ thuật không thấy "Đã xoá"');
    // Bảng: nút Báo xong trên phiếu đang xử lý
    const dong = trang.locator('#bangSuCoBody tr', { hasText: 'Mic tay phải' });
    dung(await dong.locator('button:has-text("Báo xong")').count() === 1, 'Bảng có nút Báo xong');
    dung(await trang.locator('#bangSuCoBody button:has-text("Tiếp nhận")').count() === 0, 'Bảng không có nút của admin');
    await trang.screenshot({ path: join(ANH_CHUP, '7-kythuat-bang.png') });
    // Kanban: 4 cột, nút Báo xong trong thẻ
    await trang.click('#btnBtKanbanView');
    await trang.waitForSelector('#kanbanCot .kb-cot');
    bang(await trang.$$eval('.kb-cot', d => d.length), 4, 'Kanban của kỹ thuật có 4 cột');
    dung(await trang.$('.kb-cot[data-cot="xuly"] .kb-the button:has-text("Báo xong")'), 'thẻ Đang xử lý có nút Báo xong');
    await trang.screenshot({ path: join(ANH_CHUP, '8-kythuat-kanban.png') });
    // Bản đồ mở được (không lỗi JS)
    await trang.click('#btnBtMapView');
    await trang.waitForSelector('#mapBaoTri', { state: 'visible' });
    // bấm Báo xong ngay trên Bảng
    await trang.click('#btnBtTableView');
    await trang.locator('#bangSuCoBody tr', { hasText: 'Mic tay phải' }).locator('button:has-text("Báo xong")').click();
    await trang.waitForSelector('#formBaoXong', { state: 'visible' });
    // đổi mặc định sang Danh sách trong Cài đặt → tải lại vẫn giữ
    await trang.click('.tab[data-t="caidat"]');
    await trang.click('#gdXemSuCoNut button:has-text("Danh sách")');
    await trang.reload();
    await trang.waitForSelector('#app .main', { state: 'visible', timeout: 15000 });
    await trang.waitForSelector('#viewSuCoList', { state: 'visible' });
    bang(await trang.isVisible('#viewSuCoTable'), false, 'tải lại: không còn Bảng');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Điện thoại 360px, tên chi nhánh/phòng/loại dài như thật: không màn nào của 3 vai trò bị tràn ngang', async () => {
  const m = await taoMoiTruong();
  const tk = {}; for (const u of ['admin', 'ql01', 'kt1']) tk[u] = await m.dangNhap(u);
  m.sql("update chi_nhanh set ten='Boom Music Box – Chi nhánh Nguyễn Thị Minh Khai (Quận 1)', ten_ngan='Tây Hòa Phước Long B'");
  m.sql("update loai_su_co set ten='Âm thanh / micro / loa / dàn máy karaoke' where ma='am_thanh'");
  for (let i = 0; i < 9; i++) {
    const r = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa subwoofer phòng VIP bị rè, mất tiếng bass khi mở nhạc lớn, khách phản ánh nhiều lần #' + i, phong: 'Phòng VIP số ' + (100 + i) + ' (tầng 3, khu B)' }, tk.ql01);
    if (i % 3 === 0) await m.goi('suco_tiepnhan', { maSuCo: r.maSuCo }, tk.admin);
    if (i % 3 === 1) { await m.goi('suco_tiepnhan', { maSuCo: r.maSuCo }, tk.admin); await m.goi('suco_dieuphoi', { maSuCo: r.maSuCo, kyThuat: 'kt1' }, tk.admin); }
  }
  m.sql('update su_co set tao_luc = tao_luc - 3*86400000, cap_nhat_luc = cap_nhat_luc - 3*86400000');
  const MAN = [["diToi('tongquan')", 'admin'], ["diToi('baotri','list')"], ["diToi('baotri','table')"], ["diToi('baotri','kanban')"], ["diToi('dat-phong')"], ["diToi('caidat')"]];
  for (const u of ['admin', 'ql01', 'kt1']) {
    const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 360, height: 780 });
    try {
      await dangNhapUI(trang, u);
      for (const [js, chiVai] of MAN) {
        if (chiVai && chiVai !== u) continue;
        await trang.evaluate(js); await trang.waitForTimeout(300);
        const kq = await trang.evaluate(() => ({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
        dung(kq.sw <= kq.W + 1, `${u} ${js}: trang rộng ${kq.sw}px trên màn ${kq.W}px`);
      }
      bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
    } finally { await trinh.close(); }
  }
});

kb('Quên mật khẩu Admin (màn đăng nhập): gửi mã → nhập mã + mật khẩu mới → đăng nhập được; báo lỗi rõ khi sai mã / chưa khai kênh; thẻ cứu hộ trong Cài đặt', async () => {
  const m = await taoMoiTruong({ caiDat: { khoiphuc_tg_chat_id: '777001' } });
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await trang.goto('https://bmb.test/admin.html');
    dung(!(await trang.isVisible('#qmLinkBox')), 'MẶC ĐỊNH ẨN: không có link "Quên mật khẩu Admin?"');
    dung(/Liên hệ Admin để cấp lại mật khẩu/.test(await trang.textContent('#login')), 'chỉ còn dòng hướng dẫn liên hệ Admin');
    await trang.evaluate(() => { KHOIPHUC_HIEN = true; apDungKhoiPhuc(); });   // bật lại tính năng (đang tạm ẩn)
    await trang.fill('#uUser', 'admin');
    await trang.click('text=Quên mật khẩu Admin?');
    dung(await trang.isVisible('#qmPanel'), 'mở khung quên mật khẩu');
    bang(await trang.inputValue('#qmUser'), 'admin', 'điền sẵn tài khoản đã gõ');
    dung(!(await trang.isVisible('#qmBuoc2')), 'chưa gửi mã thì chưa hiện ô mã');
    m.xoaTin();
    await trang.click('#qmGuiBtn');
    await trang.waitForSelector('#qmBuoc2', { state: 'visible' });
    const ma = ((m.tin('777001').pop() || {}).text || '').match(/<code>(\d{8})<\/code>/)[1];
    await trang.fill('#qmMa', '00000000'); await trang.fill('#qmMk', 'MoiMoi123'); await trang.fill('#qmMk2', 'MoiMoi123');
    await trang.click('#qmDoiBtn');
    await trang.waitForFunction(() => /Mã sai/.test(document.querySelector('#qmMsgTxt').textContent));
    await trang.fill('#qmMa', ma); await trang.fill('#qmMk2', 'khac');
    await trang.click('#qmDoiBtn');
    await trang.waitForFunction(() => /chưa giống/.test(document.querySelector('#qmMsgTxt').textContent));
    await trang.fill('#qmMk2', 'MoiMoi123');
    await trang.click('#qmDoiBtn');
    await trang.waitForFunction(() => /Đã đặt lại/.test(document.querySelector('#loginMsgTxt').textContent));
    dung(!(await trang.isVisible('#qmPanel')), 'đóng khung sau khi xong');
    await trang.fill('#uPass', 'MoiMoi123'); await trang.click('#loginBtn');
    await trang.waitForSelector('#app .main', { state: 'visible', timeout: 15000 });
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
  // chưa khai kênh → thông báo rõ
  const m0 = await taoMoiTruong();
  const b = await moTrinhDuyet(m0, { width: 390, height: 844 });
  try {
    await b.trang.goto('https://bmb.test/admin.html');
    await b.trang.evaluate(() => { KHOIPHUC_HIEN = true; apDungKhoiPhuc(); });
    await b.trang.click('text=Quên mật khẩu Admin?');
    await b.trang.fill('#qmUser', 'admin'); await b.trang.click('#qmGuiBtn');
    await b.trang.waitForFunction(() => /chưa khai kênh/.test(document.querySelector('#qmMsgTxt').textContent));
    await b.trang.close();
  } finally { await b.trinh.close(); }
  // thẻ trạng thái cho admin
  for (const [caiDat, mong] of [[{ khoiphuc_tg_chat_id: '777001' }, /Đã khai kênh cứu hộ \(chat …001\)/], [{}, /Chưa khai/]]) {
    const mm = await taoMoiTruong({ caiDat });
    const c = await moTrinhDuyet(mm);
    try {
      await dangNhapUI(c.trang, 'admin');
      await c.trang.evaluate(() => { KHOIPHUC_HIEN = true; return taiKhoiPhucTrangThai(); });
      await c.trang.waitForFunction(() => !/Đang kiểm tra/.test(document.querySelector('#khoiPhucTrangThai').textContent));
      dung(mong.test(await c.trang.textContent('#khoiPhucTrangThai')), 'trạng thái: ' + await c.trang.textContent('#khoiPhucTrangThai'));
    } finally { await c.trinh.close(); }
  }
});

kb('Quên mật khẩu qua Telegram TẠM ẨN: thẻ 🛟 trong Cài đặt không hiện; admin vẫn kết nối Telegram riêng bình thường', async () => {
  const m = await taoMoiTruong();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m);
  try {
    await dangNhapUI(trang, 'admin');
    await trang.evaluate(() => { diToi('cd:ketnoi'); const c = [...document.querySelectorAll('.form-card')].find(f => f.textContent.includes('Cấu hình Telegram (chung')); c.classList.add('open'); return loadTelegramInfo(); });
    await trang.waitForTimeout(500);
    dung(!(await trang.isVisible('#khoiPhucCard')), 'thẻ cứu hộ ẩn');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});
kb('Thẻ Cấu hình Telegram (điện thoại 360px): đường link getUpdates dài tự xuống dòng, không tràn ngang', async () => {
  const m = await taoMoiTruong();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 360, height: 800 });
  try {
    await dangNhapUI(trang, 'admin');
    await trang.evaluate(() => diToi('cd:ketnoi'));
    await trang.waitForTimeout(300);
    await trang.evaluate(() => { const c = [...document.querySelectorAll('.form-card')].find(f => f.textContent.includes('Cấu hình Telegram (chung')); c.classList.add('open'); c.scrollIntoView(); });
    await trang.waitForTimeout(400);
    const r = await trang.evaluate(() => {
      const code = [...document.querySelectorAll('.ff-body code')].find(c => c.textContent.includes('getUpdates'));
      const card = code.closest('.form-card').getBoundingClientRect(), cr = code.getBoundingClientRect();
      if (!cr.width) return { an: true };
      return { phai: Math.round(cr.right), theRight: Math.round(card.right), docW: document.documentElement.scrollWidth, vw: innerWidth };
    });
    dung(!r.an, 'thẻ Telegram phải đang hiển thị khi đo');
    dung(r.phai <= r.theRight + 1, 'link không vượt mép thẻ: ' + JSON.stringify(r));
    bang(r.docW, r.vw, 'trang không tràn ngang');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Admin tự kết nối Telegram riêng (Tài khoản của tôi): có nút Kết nối + mô tả tin admin nhận; kết nối rồi thì hiện trạng thái; không tràn ngang 360px', async () => {
  const m = await taoMoiTruong();
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 360, height: 800 });
  try {
    await dangNhapUI(trang, 'admin');
    await trang.evaluate(() => diToi('cd:canhan'));
    await trang.waitForSelector('#tbKhoiTelegram', { state: 'visible' });
    await trang.waitForSelector('#tgKetNoiBtn', { timeout: 8000 });
    dung(/Sẽ nhận riêng: sự cố mới/.test(await trang.textContent('#tbTgMoTa')), 'mô tả tin admin nhận');
    dung(await trang.isVisible('#tbKhoiAdminNhom'), 'ghi chú: nhóm chung vẫn nhận');
    bang(await trang.evaluate(() => document.documentElement.scrollWidth), 360, 'không tràn ngang');
    await m.noiTG('admin', 5001);
    await trang.evaluate(() => capNhatUITelegramId());
    await trang.waitForFunction(() => /Đã kết nối/.test(document.querySelector('#tbTgTrangThai').textContent));
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

kb('Kỹ thuật lọc theo chi nhánh: một ô dùng chung cho Bảng/Kanban/Danh sách/Bản đồ, có số việc, có "Bỏ lọc"; admin/quản lý không thấy', async () => {
  const { m, ma } = await duLieu();
  const tkQl2 = await m.dangNhap('ql02'), tkAd = await m.dangNhap('admin');
  const maCN2 = (await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa sân khấu chi nhánh hai rè', phong: 'P9' }, tkQl2)).maSuCo;
  await m.goi('suco_tiepnhan', { maSuCo: maCN2 }, tkAd);
  await m.goi('suco_dieuphoi', { maSuCo: maCN2, kyThuat: 'kt1' }, tkAd);     // kỹ thuật chỉ thấy phiếu được giao cho mình
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'kt1');
    await moSuCo(trang);
    await trang.waitForSelector('#locCNKT', { state: 'visible' });
    const opts = await trang.$$eval('#fCNKT option', d => d.map(o => ({ v: o.value, t: o.textContent.trim() })));
    dung(opts.length === 3 && opts[0].v === '', 'có "Tất cả" + 2 chi nhánh: ' + opts.map(o => o.t).join(' | '));
    dung(opts.some(o => /Tây Hòa|Tay Hoa/i.test(o.t) && /\d+ việc/.test(o.t)), 'mỗi chi nhánh kèm số việc đang mở');
    const idCN2 = opts.find(o => o.v && o.t.includes('Nguyễn Văn Tăng') || (o.v && !/Tây Hòa/.test(o.t))).v;
    const idCN1 = opts.find(o => o.v && o.v !== idCN2).v;
    const soBang = () => trang.$$eval('#bangSuCoBody tr', d => d.filter(r => r.children.length > 3).length);
    const tong = await soBang();
    bang(tong, 3, 'Bảng chưa lọc có đủ việc của cả hai chi nhánh (' + tong + ')');
    // lọc ở Bảng
    await trang.selectOption('#fCNKT', idCN2);
    bang(await soBang(), 1, 'Bảng: chỉ còn việc của chi nhánh đã chọn');
    dung((await trang.textContent('#bangSuCoBody')).includes('Loa sân khấu'), 'Bảng: đúng phiếu');
    dung(await trang.isVisible('#locCNKTBo'), 'hiện nút Bỏ lọc');
    dung((await trang.textContent('#locCNKTInfo')).includes('Đang lọc'), 'hiện dòng "Đang lọc…": ' + await trang.textContent('#locCNKTInfo'));
    const rong = await trang.evaluate(() => document.documentElement.scrollWidth);
    dung(rong <= 390, 'không tràn ngang (' + rong + 'px)');
    await trang.screenshot({ path: join(ANH_CHUP, '9-kythuat-loc-chi-nhanh.png') });
    // chuyển sang Kanban: bộ lọc giữ nguyên
    await trang.click('#btnBtKanbanView');
    await trang.waitForSelector('#kanbanCot .kb-cot');
    bang(await trang.$$eval('.kb-the', d => d.length), 1, 'Kanban: lọc giữ nguyên, 1 thẻ');
    bang(await trang.$eval('#fCNKT', e => e.value), idCN2, 'ô lọc vẫn đang chọn chi nhánh đó');
    // Danh sách
    await trang.click('#btnBtListView');
    dung((await trang.textContent('#listSuCoChuaXuLy')).includes('Loa sân khấu'), 'Danh sách có phiếu chi nhánh đã chọn');
    dung(!(await trang.textContent('#listSuCoChuaXuLy')).includes('Mic tay phải'), 'Danh sách: không lẫn việc chi nhánh khác');
    // Bỏ lọc
    await trang.click('#locCNKTBo');
    bang(await trang.$eval('#fCNKT', e => e.value), '', 'Bỏ lọc → Tất cả');
    dung((await trang.textContent('#listSuCoChuaXuLy')).includes('Mic tay phải') && (await trang.textContent('#listSuCoChuaXuLy')).includes('Loa sân khấu'), 'Danh sách đủ lại cả hai chi nhánh');
    dung(!(await trang.isVisible('#locCNKTBo')), 'ẩn nút Bỏ lọc');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
  // quản lý chi nhánh và admin không có ô này
  for (const u of ['ql01', 'admin']) {
    const t2 = await moTrinhDuyet(m, { width: 1360, height: 900 });
    try {
      await dangNhapUI(t2.trang, u);
      await moSuCo(t2.trang);
      dung(!(await t2.trang.isVisible('#locCNKT')), u + ' không thấy ô lọc chi nhánh của kỹ thuật');
    } finally { await t2.trinh.close(); }
  }
});

kb('Kỹ thuật thấy mô tả + ảnh ngay trên Bảng/Kanban của phiếu chờ tự nhận, và mở được lịch sử (không báo "Không tải được lịch sử")', async () => {
  const { m } = await duLieu();
  const tkQl2 = await m.dangNhap('ql02'), tkAd = await m.dangNhap('admin');
  for (const k of ['kythuat_xem_bando', 'kythuat_tu_nhan_viec']) m.sql(`INSERT OR REPLACE INTO cai_dat (khoa, gia_tri) VALUES (?, 'Y')`, k);
  const anh = 'data:image/jpeg;base64,' + Buffer.from('anh-test-' + 'x'.repeat(300)).toString('base64');
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Camera sân khấu mất hình từ tối qua', phong: 'P9', anh: [anh, anh, anh, anh] }, tkQl2);
  dung(t.ok, 'tạo phiếu có ảnh: ' + t.error);
  await m.goi('suco_tiepnhan', { maSuCo: t.maSuCo }, tkAd);                    // chưa giao ai → kỹ thuật tự nhận được
  const { trinh, trang, loiJS } = await moTrinhDuyet(m, { width: 390, height: 844 });
  try {
    await dangNhapUI(trang, 'kt1');
    await moSuCo(trang);
    const dong = trang.locator('#bangSuCoBody tr', { hasText: 'Camera sân khấu' });
    bang(await dong.count(), 1, 'Bảng có đúng 1 dòng phiếu camera chờ tự nhận');
    dung(await dong.locator('button:has-text("Tự nhận")').count() === 1, 'dòng có nút Tự nhận');
    dung(await dong.locator('.ct-mt').isVisible(), 'Bảng (điện thoại): hiện mô tả của phiếu');
    dung((await dong.locator('.ct-mt').textContent()).includes('Camera sân khấu mất hình'), 'mô tả đúng');
    bang(await dong.locator('.ct-anh img').count(), 3, 'tối đa 3 ảnh nhỏ');
    bang((await dong.locator('.ct-them').textContent()).trim(), '+1', 'ảnh dư hiện +1');
    await trang.screenshot({ path: join(ANH_CHUP, '10-kythuat-bang-mo-ta-anh.png') });
    // bấm 🕘 → lịch sử mở được, có mô tả + ảnh
    await dong.locator('button[title^="Lịch sử"]').click();
    await trang.waitForSelector('#lsBody .sc-note', { timeout: 8000 });
    dung(!(await trang.textContent('#lsBody')).includes('Không tải được'), 'lịch sử tải được');
    dung((await trang.textContent('#lsBody')).includes('Camera sân khấu mất hình'), 'lịch sử có mô tả');
    bang(await trang.$$eval('#lsBody .sc-photos img', d => d.length), 4, 'lịch sử có đủ 4 ảnh báo lỗi');
    dung(!(await trang.$('#tdKhung')), 'chưa nhận việc thì không có khung nhắn tin');
    await trang.screenshot({ path: join(ANH_CHUP, '11-kythuat-lich-su-phieu-cho-nhan.png') });
    await trang.keyboard.press('Escape');
    await trang.evaluate(() => { const o = document.getElementById('modalOverlay'); if (o) o.style.display = 'none'; });
    // Kanban
    await trang.click('#btnBtKanbanView');
    await trang.waitForSelector('#kanbanCot .kb-the');
    const the = trang.locator('.kb-the', { hasText: 'Camera sân khấu' });
    bang(await the.count(), 1, 'Kanban có thẻ phiếu chờ nhận');
    bang(await the.locator('.ct-anh img').count(), 3, 'Kanban: 3 ảnh nhỏ');
    await trang.screenshot({ path: join(ANH_CHUP, '12-kythuat-kanban-mo-ta-anh.png') });
    const rong = await trang.evaluate(() => document.documentElement.scrollWidth);
    dung(rong <= 390, 'không tràn ngang (' + rong + 'px)');
    bang(loiJS.length, 0, 'lỗi JS: ' + loiJS.join(' | '));
  } finally { await trinh.close(); }
});

await chayTatCa();
console.log('Ảnh chụp: ' + ANH_CHUP);
