/* Bộ kịch bản nghiệp vụ Worker BMB — chạy:   node --no-warnings test/kich-ban.mjs
   Phủ: đăng nhập/quyền, vòng đời sự cố, tải phần thay đổi (delta), Telegram riêng (gồm 2 lỗi thật đã
   gặp 27/09/2026), trao đổi theo sự cố (05/11/2026), kiểm tên action. Mỗi lỗi thật gặp sau này = thêm
   1 kịch bản tái hiện đúng trình tự thật vào đây. */
import { taoMoiTruong, kb, dung, bang, chayTatCa, DUONG_WORKER } from './moi-truong.mjs';
import { kiemTraAction } from './kiem-action.mjs';

const ANH_NHO = 'data:image/jpeg;base64,' + Buffer.from('anh-test-' + 'x'.repeat(200)).toString('base64');
const anhCo = soByte => 'data:image/jpeg;base64,' + Buffer.alloc(soByte, 7).toString('base64');

/** Môi trường + đăng nhập sẵn 5 tài khoản + 1 sự cố của Tây Hòa (CN01) đã giao cho kt1 (đang xử lý). */
async function chuanBi(tuyChon) {
  const m = await taoMoiTruong(tuyChon);
  const tk = {};
  for (const u of ['admin', 'ql01', 'ql02', 'kt1', 'ktm1']) tk[u] = await m.dangNhap(u);
  m.tk = tk;
  m.taoVaGiao = async (moTa = 'Mic phòng 5 rè') => {
    const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa, phong: 'P5' }, tk.ql01);
    dung(t.ok, 'tạo sự cố: ' + t.error);
    bang((await m.goi('suco_tiepnhan', { maSuCo: t.maSuCo, mucDo: 3 }, tk.admin)).ok, true, 'tiếp nhận');
    bang((await m.goi('suco_dieuphoi', { maSuCo: t.maSuCo, kyThuat: 'kt1' }, tk.admin)).ok, true, 'điều phối');
    bang((await m.goi('suco_nhanviec', { maSuCo: t.maSuCo }, tk.kt1)).ok, true, 'nhận việc');
    bang((await m.goi('suco_batdau', { maSuCo: t.maSuCo }, tk.kt1)).ok, true, 'bắt đầu');
    return t.maSuCo;
  };
  return m;
}

console.log('Worker: ' + DUONG_WORKER + '\n');

/* ───────── đăng nhập & quyền ───────── */
kb('Đăng nhập đủ 5 vai trò; sai mật khẩu bị từ chối', async () => {
  const m = await chuanBi();
  dung(Object.values(m.tk).every(Boolean));
  bang((await m.goi('login', { user: 'ql01', hash: 'sai', thietBi: 'x' })).error, 'BAD_LOGIN');
});
kb('Action không có trong Worker → CHUA_HO_TRO (không im lặng)', async () => {
  const m = await chuanBi();
  bang((await m.goi('khong_co_that', {}, m.tk.admin)).error, 'CHUA_HO_TRO');
});

/* ───────── vòng đời sự cố ───────── */
kb('Vòng đời đủ bước: báo → tiếp nhận → điều phối → xử lý → chưa xong → xong → đóng', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  let r = await m.goi('suco_baoxong', { maSuCo: ma, ghiChu: 'Thay dây mic', anh: [ANH_NHO] }, m.tk.kt1);
  dung(r.ok, 'báo xong: ' + r.error);
  dung([...m.ANH._kho.keys()].some(k => k.startsWith('suco/' + ma + '/hoanthanh_')), 'ảnh hoàn thành phải lên R2');
  r = await m.goi('suco_xacnhan', { maSuCo: ma, xong: false, moTaBoSung: 'Vẫn rè' }, m.tk.ql01);
  dung(r.ok);
  bang(m.sql('SELECT so_lan_quay_lai n FROM su_co WHERE ma_su_co=?', ma)[0].n, 1, 'số lần quay lại');
  dung((await m.goi('suco_baoxong', { maSuCo: ma }, m.tk.kt1)).ok);
  dung((await m.goi('suco_xacnhan', { maSuCo: ma, xong: true }, m.tk.ql01)).ok);
  dung((await m.goi('suco_dong', { maSuCo: ma }, m.tk.admin)).ok);
  bang(m.sql('SELECT trang_thai t FROM su_co WHERE ma_su_co=?', ma)[0].t, 'dong');
});
kb('Báo trùng trong 15 phút bị chặn (TRUNG_LAP)', async () => {
  const m = await chuanBi();
  dung((await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa rè', phong: 'P1' }, m.tk.ql01)).ok);
  bang((await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'loa rè ', phong: 'p1' }, m.tk.ql01)).error, 'TRUNG_LAP');
});
kb('Phân quyền: kỹ thuật không tiếp nhận được; chi nhánh khác không xem được', async () => {
  const m = await chuanBi();
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Tivi mất tiếng' }, m.tk.ql01);
  bang((await m.goi('suco_tiepnhan', { maSuCo: t.maSuCo }, m.tk.kt1)).error, 'FORBIDDEN');
  const ds = await m.goi('suco_list', {}, m.tk.ql02);
  dung(!ds.data.some(x => x.maSuCo === t.maSuCo), 'Nguyễn Văn Tăng không được thấy sự cố của Tây Hòa');
  bang((await m.goi('suco_lichsu', { maSuCo: t.maSuCo }, m.tk.ql02)).error, 'FORBIDDEN');
});
kb('Tải phần thay đổi (delta) chỉ trả ticket vừa đổi', async () => {
  const m = await chuanBi();
  const a = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Một' }, m.tk.ql01);
  const ds = await m.goi('suco_list', {}, m.tk.admin);
  await new Promise(r => setTimeout(r, 5));
  const b = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Hai', phong: 'P2' }, m.tk.ql01);
  const d = await m.goi('suco_list', { sau: ds.moc }, m.tk.admin);
  dung(d.delta, 'phải là delta');
  dung(d.data.some(x => x.maSuCo === b.maSuCo), 'có ticket mới');
  dung(a.ok);
});

/* ───────── Telegram riêng ───────── */
kb('Kết nối Telegram qua link /start; secret sai bị chặn 403', async () => {
  const m = await chuanBi();
  const r = await m.goi('tg_tao_ma', {}, m.tk.kt1);
  dung(r.ok, 'tạo mã: ' + r.error);
  const ma = r.link.split('start=')[1];
  bang(await m.webhook({ message: { chat: { id: 555, type: 'private' }, from: { username: 'kt1tg' }, text: '/start ' + ma } }, true), 403);
  bang(await m.webhook({ message: { chat: { id: 555, type: 'private' }, from: { username: 'kt1tg' }, text: '/start ' + ma } }), 200);
  bang((await m.goi('tg_trang_thai', {}, m.tk.kt1)).ketNoi, true);
});
kb('Lỗi thật 27/09: app tạo sẵn mã thứ 2 — mã thứ 1 vẫn dùng được', async () => {
  const m = await chuanBi();
  const ma1 = (await m.goi('tg_tao_ma', {}, m.tk.ql01)).link.split('start=')[1];
  await m.goi('tg_tao_ma', {}, m.tk.ql01);            // app tự tạo mã "lần sau" ~1,5 giây sau cú bấm
  await m.webhook({ message: { chat: { id: 777, type: 'private' }, text: '/start ' + ma1 } });
  bang((await m.goi('tg_trang_thai', {}, m.tk.ql01)).ketNoi, true, 'mã đầu phải còn hiệu lực');
});
kb('Tạm dừng thì không nhận; người dùng chặn bot (403) thì tự gỡ kết nối', async () => {
  const m = await chuanBi();
  await m.noiTG('kt1', 900); await m.noiTG('ql01', 901);
  await m.goi('tg_tam_dung', { bat: true }, m.tk.kt1);
  m.chanTG.add('901');
  m.xoaTin();
  await m.taoVaGiao();
  bang(m.tin(900).length, 0, 'kt1 đang tạm dừng');
  bang(m.sql("SELECT tg_chat_id c FROM tai_khoan WHERE username='ql01'")[0].c, '', 'ql01 chặn bot → đã gỡ');
});

/* ───────── TRAO ĐỔI THEO SỰ CỐ (mới 05/11/2026) ───────── */
kb('Trao đổi: chi nhánh nhắn → chỉ kỹ thuật được giao nhận tin (không tự báo mình, không ồn nhóm)', async () => {
  const m = await chuanBi();
  await m.noiTG('kt1', 900); await m.noiTG('ql01', 901);
  const ma = await m.taoVaGiao();
  m.xoaTin();
  const r = await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Mic tay phải rè, tay trái ổn' }, m.tk.ql01);
  dung(r.ok, 'gửi: ' + r.error);
  bang(r.muc.hanhDong, 'TRAO_DOI');
  bang(m.tin(900).length, 1, 'kt1 nhận 1 tin');
  dung(m.tin(900)[0].text.includes('Mic tay phải rè'), 'tin có nội dung');
  const nut = m.tin(900)[0].reply_markup.inline_keyboard[0][0];
  dung(nut.url.includes('?ticket=' + ma) && nut.url.endsWith('&traodoi=1'), 'nút mở thẳng khung trao đổi: ' + nut.url);
  bang(m.tin(901).length, 0, 'người gửi không nhận lại tin của mình');
  bang(m.tin('-100nhom').length, 0, 'đã có kỹ thuật phụ trách → không báo nhóm chung');
});
kb('Trao đổi: kỹ thuật trả lời kèm ảnh → quản lý chi nhánh nhận; lịch sử có ảnh; đếm số tin', async () => {
  const m = await chuanBi();
  await m.noiTG('kt1', 900); await m.noiTG('ql01', 901);
  const ma = await m.taoVaGiao();
  await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Hỏi: phòng mấy?' }, m.tk.ql01);
  m.xoaTin();
  const r = await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Đã tới, gửi ảnh dây', anh: [ANH_NHO, ANH_NHO] }, m.tk.kt1);
  dung(r.ok, r.error);
  bang(r.muc.anh.length, 2);
  dung(m.tin(901).length === 1 && m.tin(901)[0].text.includes('Kèm 2 ảnh'), 'ql01 nhận tin kèm số ảnh');
  dung([...m.ANH._kho.keys()].filter(k => k.includes('/traodoi_')).length === 2, '2 ảnh lên R2');
  const ls = await m.goi('suco_lichsu', { maSuCo: ma }, m.tk.ql01);
  const td = ls.data.filter(l => l.hanhDong === 'TRAO_DOI');
  bang(td.length, 2, 'lịch sử có 2 dòng trao đổi');
  bang(td[1].anh.length, 2, 'dòng sau có 2 ảnh');
  bang(td[1].tenNguoi, 'Kỹ thuật Một', 'lịch sử trả họ tên người nhắn');
  const ds = await m.goi('suco_list', {}, m.tk.admin);
  bang(ds.data.find(x => x.maSuCo === ma).soTraoDoi, 2, 'soTraoDoi');
});
kb('Trao đổi: chi nhánh khác / kỹ thuật không được giao → FORBIDDEN', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  bang((await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'x' }, m.tk.ql02)).error, 'FORBIDDEN');
  bang((await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'x' }, m.tk.ktm1)).error, 'FORBIDDEN');
  dung((await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Admin nhắc' }, m.tk.admin)).ok, 'admin luôn được');
});
kb('Trao đổi: chặn nội dung rỗng, ảnh sai định dạng, ảnh quá 3MB, quá 6 ảnh', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  const g = b => m.goi('suco_traodoi', { maSuCo: ma, ...b }, m.tk.ql01);
  bang((await g({ noiDung: '   ' })).error, 'CAN_NOI_DUNG');
  bang((await g({ noiDung: 'a', anh: ['data:image/svg+xml;base64,PHN2Zz4='] })).error, 'ANH_LOI');
  bang((await g({ noiDung: 'a', anh: 'khong-phai-mang' })).error, 'ANH_LOI');
  bang((await g({ anh: [anhCo(3 * 1024 * 1024 + 10)] })).error, 'ANH_QUA_LON');
  bang((await g({ anh: Array(7).fill(ANH_NHO) })).error, 'QUA_NHIEU_ANH');
  bang(m.sql("SELECT COUNT(*) n FROM lich_su_xu_ly WHERE hanh_dong='TRAO_DOI'")[0].n, 0, 'không ghi gì khi bị chặn');
  dung((await g({ anh: [anhCo(500 * 1024)] })).ok, 'ảnh 500KB (cỡ thật sau khi nén) phải qua');
});
kb('Trao đổi khi CHƯA có kỹ thuật phụ trách → báo nhóm chung để admin trả lời', async () => {
  const m = await chuanBi();
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Máy lạnh chảy nước' }, m.tk.ql01);
  m.xoaTin();
  dung((await m.goi('suco_traodoi', { maSuCo: t.maSuCo, noiDung: 'Gấp, khách đang phàn nàn' }, m.tk.ql01)).ok);
  dung(m.tin('-100nhom').length === 1 && m.tin('-100nhom')[0].text.includes('Gấp, khách'), 'nhóm chung nhận');
  m.xoaTin();
  dung((await m.goi('suco_traodoi', { maSuCo: t.maSuCo, noiDung: 'Đã biết, đang sắp xếp' }, m.tk.admin)).ok);
  bang(m.tin('-100nhom').length, 0, 'admin tự trả lời thì không báo lại nhóm');
});
kb('Trao đổi trên ticket đã đóng → DA_DONG; lịch sử ticket đã đóng vẫn xem được', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  await m.goi('suco_baoxong', { maSuCo: ma }, m.tk.kt1);
  await m.goi('suco_xacnhan', { maSuCo: ma, xong: true }, m.tk.ql01);
  await m.goi('suco_dong', { maSuCo: ma }, m.tk.admin);
  bang((await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'x' }, m.tk.ql01)).error, 'DA_DONG');
  dung((await m.goi('suco_lichsu', { maSuCo: ma }, m.tk.ql01)).ok);
});
kb('Trao đổi làm máy khác thấy ngay qua delta (cap_nhat_luc được cập nhật)', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  const moc = (await m.goi('suco_list', {}, m.tk.kt1)).moc;
  await new Promise(r => setTimeout(r, 5));
  m.sql('UPDATE su_co SET cap_nhat_luc=? WHERE ma_su_co=?', moc - 60000, ma);   // giả như ticket không đổi từ lâu
  await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Mới nhắn' }, m.tk.ql01);
  const d = await m.goi('suco_list', { sau: moc }, m.tk.kt1);
  dung(d.delta && d.data.some(x => x.maSuCo === ma && x.soTraoDoi === 1), 'kỹ thuật thấy số tin mới');
});
kb('Trao đổi: chữ đặc biệt (< > &) không phá tin Telegram; giữ xuống dòng', async () => {
  const m = await chuanBi();
  await m.noiTG('kt1', 900);
  const ma = await m.taoVaGiao();
  m.xoaTin();
  const r = await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Dây <b>đỏ</b> & xanh\nDòng 2' }, m.tk.ql01);
  dung(r.ok);
  const t = m.tin(900)[0].text;
  dung(t.includes('&lt;b&gt;đỏ&lt;/b&gt; &amp; xanh'), 'phải escape HTML');
  bang(r.muc.ghiChu, 'Dây <b>đỏ</b> & xanh\nDòng 2', 'lưu nguyên văn kèm xuống dòng');
});
kb('Trao đổi trong giờ yên lặng → tin vẫn tới nhưng không kêu', async () => {
  const m = await chuanBi({ caiDat: { yen_lang_bat: 'Y', yen_lang_tu: 0, yen_lang_den: 23 } });
  await m.noiTG('kt1', 900);
  const ma = await m.taoVaGiao();
  m.xoaTin();
  await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'Đêm khuya' }, m.tk.ql01);
  const gioVN = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  bang(m.tin(900)[0].disable_notification, gioVN < 23, 'im lặng đúng khung giờ');
});
kb('DB cũ chưa có cột trao đổi: lịch sử vẫn đọc được, lần nhắn đầu tự thêm cột', async () => {
  const m = await chuanBi();
  const ma = await m.taoVaGiao();
  const truoc = m.sql('PRAGMA table_info(lich_su_xu_ly)').map(c => c.name);
  dung(!truoc.includes('anh'), 'schema thật hiện chưa có cột anh');
  const ls = await m.goi('suco_lichsu', { maSuCo: ma }, m.tk.ql01);
  dung(ls.ok && ls.data.every(l => Array.isArray(l.anh)), 'dòng cũ trả anh = []');
  dung((await m.goi('suco_traodoi', { maSuCo: ma, noiDung: 'x' }, m.tk.ql01)).ok);
  dung(m.sql('PRAGMA table_info(su_co)').some(c => c.name === 'so_trao_doi'), 'đã thêm su_co.so_trao_doi');
  dung(m.sql("SELECT 1 FROM nhat_ky WHERE loai='MIGRATE' AND noi_dung LIKE '%trao đổi%'").length === 1, 'ghi nhật ký MIGRATE');
});

/* ───────── khôi phục mật khẩu admin qua Telegram chủ hệ thống (13/11/2026) ───────── */
const CHU = '777001';
const maTrongTin = tin => (String((tin[tin.length - 1] || {}).text || '').match(/<code>(\d{8})<\/code>/) || [])[1];
const doiGio = (m, soPhutLui) => m.sql(`UPDATE nhat_ky SET luc = luc - ? WHERE loai='QUENMK_GUI'`, soPhutLui * 60e3);

kb('Quên mật khẩu admin: mã về Telegram chủ → đặt lại → vào bằng mật khẩu mới, cũ mất, phiên cũ bị đá, hết khoá', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  for (let i = 0; i < 5; i++) await m.goi('login', { user: 'admin', hash: 'sai', thietBi: 'x' });
  bang((await m.goi('login', { user: 'admin', hash: 'sai', thietBi: 'x' })).error, 'LOCKED', 'đang bị khoá');
  m.xoaTin();
  bang((await m.goi('quenmk_gui', { user: 'admin' })).ok, true);
  const ma = maTrongTin(m.tin(CHU));
  dung(ma && ma.length === 8, 'mã 8 số tới đúng chat chủ hệ thống');
  bang(m.tin(CHU).length, 1, 'chỉ 1 tin');
  bang(m.tin('-100nhom').length, 0, 'KHÔNG lộ mã vào nhóm chung');
  bang((await m.goi('quenmk_doi', { user: 'admin', ma: '00000000', matkhauMoi: 'MoiMoi123' })).error, 'MA_SAI');
  bang((await m.goi('quenmk_doi', { user: 'admin', ma, matkhauMoi: 'ab' })).error, 'BAD_PASS', 'mật khẩu quá ngắn');
  const r = await m.goi('quenmk_doi', { user: 'admin', ma, matkhauMoi: 'MoiMoi123' });
  dung(r.ok, 'đặt lại: ' + r.error);
  bang((await m.goi('quenmk_doi', { user: 'admin', ma, matkhauMoi: 'KhacKhac1' })).error, 'MA_SAI', 'mã dùng 1 lần');
  bang((await m.goi('login', { user: 'admin', hash: (await import('node:crypto')).createHash('sha256').update('admin::1234::boom').digest('hex'), thietBi: 'y' })).ok, false, 'mật khẩu cũ hết tác dụng');
  const h = (await import('node:crypto')).createHash('sha256').update('admin::MoiMoi123::boom').digest('hex');
  dung((await m.goi('login', { user: 'admin', hash: h, thietBi: 'z' })).ok, 'mật khẩu mới vào được (kể cả khi trước đó bị khoá)');
  bang((await m.goi('khoi_dong', {}, m.tk.admin)).error, 'BAD_TOKEN', 'phiên cũ bị đá');
  dung(m.tin(CHU).some(t => /vừa được đặt lại/.test(t.text)), 'chủ hệ thống được báo đã đặt lại');
  bang(m.sql('SELECT COUNT(*) n FROM khoi_phuc_mk')[0].n, 0, 'mã đã xoá');
});
kb('Quên mật khẩu: tài khoản không phải admin / không tồn tại → trả lời y hệt, KHÔNG gửi mã, KHÔNG đổi gì', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  m.xoaTin();
  const a = await m.goi('quenmk_gui', { user: 'ql01' }), b = await m.goi('quenmk_gui', { user: 'khongcothat' }), c = await m.goi('quenmk_gui', { user: 'admin' });
  bang(JSON.stringify(a), JSON.stringify(b), 'quản lý & tài khoản ma trả lời giống nhau');
  bang(JSON.stringify(a), JSON.stringify(c), 'admin thật cũng trả lời giống (không dò được)');
  bang(m.tin(CHU).length, 1, 'chỉ admin thật mới có tin');
  bang(m.sql('SELECT COUNT(*) n FROM khoi_phuc_mk WHERE username IN (?,?)', 'ql01', 'khongcothat')[0].n, 0);
  bang((await m.goi('quenmk_doi', { user: 'ql01', ma: '12345678', matkhauMoi: 'XxXxXx1' })).error, 'MA_SAI');
});
kb('Quên mật khẩu: chưa khai chủ hệ thống → CHUA_CAU_HINH; gửi dồn → THU_LAI_SAU; mã hết hạn / sai 5 lần → huỷ', async () => {
  const m0 = await chuanBi();
  bang((await m0.goi('quenmk_gui', { user: 'admin' })).error, 'CHUA_CAU_HINH');
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  dung((await m.goi('quenmk_gui', { user: 'admin' })).ok);
  bang((await m.goi('quenmk_gui', { user: 'admin' })).error, 'THU_LAI_SAU', 'trong 60 giây');
  const ma1 = maTrongTin(m.tin(CHU));
  doiGio(m, 2);
  dung((await m.goi('quenmk_gui', { user: 'admin' })).ok, 'qua 60 giây gửi lại được');
  const ma2 = maTrongTin(m.tin(CHU));
  bang((await m.goi('quenmk_doi', { user: 'admin', ma: ma1 === ma2 ? '11111111' : ma1, matkhauMoi: 'MoiMoi123' })).error, 'MA_SAI', 'mã cũ vô hiệu khi có mã mới');
  m.sql('UPDATE khoi_phuc_mk SET het_han=? WHERE username=?', Date.now() - 1, 'admin');
  bang((await m.goi('quenmk_doi', { user: 'admin', ma: ma2, matkhauMoi: 'MoiMoi123' })).error, 'MA_SAI', 'mã hết hạn');
  doiGio(m, 2); dung((await m.goi('quenmk_gui', { user: 'admin' })).ok);
  const ma3 = maTrongTin(m.tin(CHU));
  for (let i = 0; i < 5; i++) await m.goi('quenmk_doi', { user: 'admin', ma: ma3 === '99999999' ? '11111111' : '99999999', matkhauMoi: 'MoiMoi123' });
  bang((await m.goi('quenmk_doi', { user: 'admin', ma: ma3, matkhauMoi: 'MoiMoi123' })).error, 'MA_SAI', 'sai 5 lần → mã đúng cũng bị huỷ');
});
kb('Giới hạn gửi: tối đa 5 mã/giờ cho mỗi tài khoản', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  let ok = 0, chan = 0;
  for (let i = 0; i < 8; i++) { const r = await m.goi('quenmk_gui', { user: 'admin' }); r.ok ? ok++ : chan++; doiGio(m, 2); }
  bang(ok, 5, 'đúng 5 mã được gửi'); bang(chan, 3);
});
kb('App/phiên admin KHÔNG sửa được kênh cứu hộ (khoiphuc_*); khoá thường vẫn sửa được', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  bang((await m.goi('settings_set', { key: 'khoiphuc_tg_chat_id', value: '999' }, m.tk.admin)).error, 'KHOA_BI_CHAN');
  bang((await m.goi('settings_set', { key: 'KHOIPHUC_moi', value: '1' }, m.tk.admin)).error, 'KHOA_BI_CHAN', 'không phân biệt hoa thường');
  bang(m.sql(`SELECT gia_tri v FROM cai_dat WHERE khoa='khoiphuc_tg_chat_id'`)[0].v, CHU, 'giá trị giữ nguyên');
  dung((await m.goi('settings_set', { key: 'tondong_gio', value: '9' }, m.tk.admin)).ok, 'khoá thường vẫn sửa');
  dung(m.sql(`SELECT 1 FROM nhat_ky WHERE loai='SETTING_BI_CHAN'`).length >= 1, 'có ghi nhật ký cố sửa');
});
kb('sadmin (siêu admin thứ hai): tạo → chủ hệ thống được báo; hai bên đổi được mật khẩu của nhau; mỗi lần đều báo', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  m.xoaTin();
  const t = await m.goi('taikhoan_them', { taikhoan: 'sadmin', hoten: 'Siêu admin', vaitro: 'admin', sieuAdmin: true, matkhau: 'Tam12345' }, m.tk.admin);
  dung(t.ok, 'tạo sadmin: ' + t.error);
  dung(m.tin(CHU).some(x => /ADMIN<\/b> mới.*sadmin/s.test(x.text) && /siêu admin/.test(x.text)), 'báo chủ hệ thống khi có admin mới');
  bang(m.sql(`SELECT sieu_admin s FROM tai_khoan WHERE username='sadmin'`)[0].s, 1);
  const tokS = await m.dangNhap('sadmin', 'Tam12345');
  m.xoaTin();
  dung((await m.goi('taikhoan_doimk', { taikhoan: 'admin', matkhauMoi: 'DoiBoi_S1' }, tokS)).ok, 'sadmin đổi mật khẩu admin');
  dung(m.tin(CHU).some(x => /ĐẶT LẠI MẬT KHẨU.*admin/s.test(x.text)), 'báo khi admin bị đổi mật khẩu');
  const tokA = await m.dangNhap('admin', 'DoiBoi_S1');
  m.xoaTin();
  dung((await m.goi('taikhoan_doimk', { taikhoan: 'sadmin', matkhauMoi: 'DoiBoi_A1' }, tokA)).ok, 'admin đổi mật khẩu sadmin');
  bang(m.tin(CHU).length, 1);
  m.xoaTin();
  dung((await m.goi('taikhoan_doimk', { taikhoan: 'ql01', matkhauMoi: 'QlMoi1234' }, tokA)).ok);
  bang(m.tin(CHU).length, 0, 'đổi mật khẩu quản lý thường: KHÔNG báo (tránh ồn)');
  const sua = await m.goi('taikhoan_sua', { taikhoan: 'ql02', hoten: 'Quản lý', vaitro: 'admin', sieuAdmin: false }, tokA);
  dung(sua.ok, 'nâng ql02 lên admin: ' + sua.error);
  dung(m.tin(CHU).some(x => /quyền admin/i.test(x.text)), 'báo khi nâng quyền admin');
});
kb('/chatid riêng: bot trả đúng số chat để khai kênh cứu hộ (kể cả khi chưa kết nối tài khoản nào)', async () => {
  const m = await chuanBi();
  m.xoaTin();
  await m.webhook({ update_id: 1, message: { message_id: 1, chat: { id: 424242, type: 'private' }, from: { id: 424242 }, text: '/chatid' } });
  dung(m.tin(424242).some(t => /<code>424242<\/code>/.test(t.text)), 'trả Chat ID');
});
kb('Trạng thái/tin thử kênh cứu hộ: chỉ admin; chưa khai thì báo rõ', async () => {
  const m = await chuanBi({ caiDat: { khoiphuc_tg_chat_id: CHU } });
  bang((await m.goi('khoiphuc_tg_trangthai', {}, m.tk.ql01)).error, 'FORBIDDEN');
  const t = await m.goi('khoiphuc_tg_trangthai', {}, m.tk.admin);
  dung(t.ok && t.daCauHinh && t.duoi === '…001', 'chỉ lộ đuôi số');
  m.xoaTin();
  dung((await m.goi('khoiphuc_tg_thu', {}, m.tk.admin)).ok);
  dung(m.tin(CHU).some(x => /Tin thử/.test(x.text)));
  const m0 = await chuanBi();
  bang((await m0.goi('khoiphuc_tg_trangthai', {}, m0.tk.admin)).daCauHinh, false);
  bang((await m0.goi('khoiphuc_tg_thu', {}, m0.tk.admin)).error, 'CHUA_CAU_HINH');
});

/* ───────── admin tự kết nối Telegram riêng: bản sao các tin cần admin xử lý (13/11/2026) ───────── */
const NHOM = '-100nhom';
async function chuanBiAdminTG(tuyChon) {
  const m = await chuanBi(tuyChon);
  // admin thứ hai (sadmin) để kiểm "không tự báo cho mình" và "chưa kết nối thì không nhận"
  dung((await m.goi('taikhoan_them', { taikhoan: 'sadmin', hoten: 'Siêu admin', vaitro: 'admin', sieuAdmin: true, matkhau: 'Tam12345' }, m.tk.admin)).ok);
  m.tk.sadmin = await m.dangNhap('sadmin', 'Tam12345');
  await m.noiTG('admin', 5001);
  m.xoaTin();
  return m;
}
kb('Admin kết nối Telegram riêng: nhận bản sao sự cố mới + chi nhánh xác nhận/báo chưa xong; nhóm chung vẫn nhận; admin chưa kết nối / đang tạm dừng thì không', async () => {
  const m = await chuanBiAdminTG();
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa rè', phong: 'P1' }, m.tk.ql01);
  dung(t.ok);
  dung(m.tin(NHOM).some(x => /SỰ CỐ MỚI/.test(x.text)), 'nhóm chung vẫn nhận');
  const rieng = m.tin(5001).find(x => /Sự cố mới/.test(x.text));
  dung(rieng, 'admin nhận bản sao riêng');
  dung(/ticket=/.test(JSON.stringify(rieng.reply_markup)), 'có nút mở đúng ticket trong app');
  bang(m.tin(5002).length, 0);
  // chưa ai kết nối thêm → quản lý/kỹ thuật không bị lẫn
  m.xoaTin();
  await m.goi('suco_tiepnhan', { maSuCo: t.maSuCo, mucDo: 3 }, m.tk.admin);
  await m.goi('suco_dieuphoi', { maSuCo: t.maSuCo, kyThuat: 'kt1' }, m.tk.admin);
  await m.goi('suco_nhanviec', { maSuCo: t.maSuCo }, m.tk.kt1); await m.goi('suco_batdau', { maSuCo: t.maSuCo }, m.tk.kt1);
  await m.goi('suco_baoxong', { maSuCo: t.maSuCo, ghiChu: 'xong' }, m.tk.kt1);
  bang(m.tin(5001).length, 0, 'tin tiến độ thường (điều phối, báo xong…) KHÔNG nhân bản cho admin');
  dung((await m.goi('suco_xacnhan', { maSuCo: t.maSuCo, xong: false, moTaBoSung: 'Vẫn rè' }, m.tk.ql01)).ok);
  dung(m.tin(5001).some(x => /CHƯA XONG/.test(x.text) && /Vẫn rè/.test(x.text)), 'chưa xong → admin nhận');
  await m.goi('suco_baoxong', { maSuCo: t.maSuCo }, m.tk.kt1);
  m.xoaTin();
  dung((await m.goi('suco_xacnhan', { maSuCo: t.maSuCo, xong: true }, m.tk.ql01)).ok);
  dung(m.tin(5001).some(x => /đã xác nhận xong/i.test(x.text) && /đóng/.test(x.text)), 'xác nhận xong → admin nhận (chờ đóng)');
  dung(m.tin(NHOM).some(x => /ĐÃ XÁC NHẬN XONG/.test(x.text)), 'nhóm vẫn nhận');
  // tạm dừng → không nhận
  m.sql('UPDATE tai_khoan SET tg_tam_dung=1 WHERE username=?', 'admin'); m.xoaTin();
  await m.goi('suco_tao', { loaiLoi: 'mang', moTa: 'Wifi yếu', phong: 'P2' }, m.tk.ql01);
  bang(m.tin(5001).length, 0, 'đang tạm dừng thì im');
  dung(m.tin(NHOM).length >= 1, 'nhóm vẫn nhận');
});
kb('Admin tự tạo sự cố → không nhận bản sao của chính mình; admin khác đã kết nối vẫn nhận', async () => {
  const m = await chuanBiAdminTG();
  await m.noiTG('sadmin', 5002);
  m.xoaTin();
  dung((await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Mic hỏng', phong: 'P3', chinhanhId: 'CN01' }, m.tk.admin)).ok);
  bang(m.tin(5001).length, 0, 'admin tạo thì không tự nhận');
  dung(m.tin(5002).some(x => /Sự cố mới/.test(x.text)), 'sadmin nhận');
});
kb('Trao đổi khi CHƯA có kỹ thuật: admin nhận riêng; đã có kỹ thuật phụ trách thì admin không bị làm phiền', async () => {
  const m = await chuanBiAdminTG();
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa rè', phong: 'P1' }, m.tk.ql01);
  m.xoaTin();
  dung((await m.goi('suco_traodoi', { maSuCo: t.maSuCo, noiDung: 'Gấp giúp chi nhánh' }, m.tk.ql01)).ok);
  dung(m.tin(5001).some(x => /Trao đổi/.test(x.text) && /Gấp giúp/.test(x.text)), 'admin nhận trao đổi (chưa có kỹ thuật)');
  dung(/traodoi=1/.test(JSON.stringify(m.tin(5001)[0].reply_markup)), 'nút mở thẳng khung trao đổi');
  await m.goi('suco_tiepnhan', { maSuCo: t.maSuCo, mucDo: 3 }, m.tk.admin);
  await m.goi('suco_dieuphoi', { maSuCo: t.maSuCo, kyThuat: 'kt1' }, m.tk.admin);
  m.xoaTin();
  await m.goi('suco_traodoi', { maSuCo: t.maSuCo, noiDung: 'Đã có kỹ thuật rồi' }, m.tk.ql01);
  bang(m.tin(5001).length, 0, 'đã giao kỹ thuật → không báo admin');
});
kb('Đơn giữ phòng mới (khách đặt) + quá hạn tiếp nhận (SLA): admin kết nối riêng nhận 1 bản sao; nhóm vẫn nhận', async () => {
  const m = await chuanBiAdminTG({ caiDat: { sla_m3_tiepnhan_phut: 1 } });
  const ngay = new Date(Date.now() + 2 * 864e5 + 7 * 3600e3).toISOString().slice(0, 10);
  const r = await m.goi('book', { branchId: 'CN01', date: ngay, startTime: '19:00', endTime: '21:00', duration: 2, name: 'Khách Lan', phone: '0901234567', guests: 6 });
  dung(r.ok, 'đặt phòng: ' + r.error);
  dung(m.tin(5001).some(x => /Đơn giữ phòng mới/.test(x.text) && /Khách Lan/.test(x.text)), 'admin nhận đơn mới');
  dung(m.tin(NHOM).some(x => /ĐƠN GIỮ PHÒNG MỚI/.test(x.text)), 'nhóm vẫn nhận');
  const t = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'Loa rè', phong: 'P1' }, m.tk.ql01);
  m.sql('UPDATE su_co SET tao_luc=?, muc_do=3 WHERE ma_su_co=?', Date.now() - 30 * 60e3, t.maSuCo);
  m.xoaTin();
  const q = await m.goi('sla_kiemtra', {}, m.tk.admin);
  dung(q.ok !== false, 'quét SLA: ' + JSON.stringify(q));
  dung(m.tin(NHOM).some(x => /QUÁ HẠN TIẾP NHẬN/.test(x.text)), 'nhóm nhận cảnh báo quá hạn');
  dung(m.tin(5001).some(x => /Quá hạn tiếp nhận/.test(x.text) && x.text.includes(t.maSuCo)), 'admin nhận bản sao riêng cảnh báo quá hạn');
});
kb('Bot: admin kết nối qua /start → lời chào đúng vai trò; /viec cho admin tóm tắt theo trạng thái + đơn chờ duyệt', async () => {
  const m = await chuanBi();
  const tao = await m.goi('tg_tao_ma', {}, m.tk.admin);
  dung(tao.ok, 'admin tạo được mã kết nối: ' + tao.error);
  const ma = tao.link.split('start=')[1];
  m.xoaTin();
  await m.webhook({ update_id: 1, message: { message_id: 1, chat: { id: 6001, type: 'private' }, from: { id: 6001, username: 'chuhe' }, text: '/start ' + ma } });
  dung(m.tin(6001).some(x => /Đã kết nối với tài khoản/.test(x.text) && /một bản sao/.test(x.text) && /Nhóm chung vẫn nhận/.test(x.text)), 'lời chào nói rõ admin nhận gì');
  bang(m.sql("SELECT tg_chat_id c FROM tai_khoan WHERE username='admin'")[0].c, '6001');
  const t1 = await m.goi('suco_tao', { loaiLoi: 'am_thanh', moTa: 'A', phong: 'P1' }, m.tk.ql01);
  await m.goi('suco_tiepnhan', { maSuCo: t1.maSuCo, mucDo: 3 }, m.tk.admin);
  await m.goi('suco_tao', { loaiLoi: 'mang', moTa: 'B', phong: 'P2' }, m.tk.ql02);
  m.xoaTin();
  await m.webhook({ update_id: 2, message: { message_id: 2, chat: { id: 6001, type: 'private' }, from: { id: 6001 }, text: '/viec' } });
  const v = (m.tin(6001)[0] || {}).text || '';
  dung(/2 sự cố chưa đóng/.test(v) && /Mới báo[^\n]*<b>1<\/b>/.test(v) && /Đã tiếp nhận[^\n]*<b>1<\/b>/.test(v), '/viec admin: ' + v);
});

/* ───────── kiểm tên action ───────── */
kb('Mọi action admin.html / index.html gọi đều có trong Worker', async () => {
  const { thieu } = kiemTraAction();
  bang(thieu.length, 0, 'thiếu: ' + thieu.join(', '));
});

await chayTatCa();
