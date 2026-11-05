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

/* ───────── kiểm tên action ───────── */
kb('Mọi action admin.html / index.html gọi đều có trong Worker', async () => {
  const { thieu } = kiemTraAction();
  bang(thieu.length, 0, 'thiếu: ' + thieu.join(', '));
});

await chayTatCa();
