/* ════════════════════════════════════════════════════════════════════════════════════════════════
   MODULE "ĐẶT PHÒNG" — cắm vào vỏ admin.html (24/11/2026), theo kiến trúc "một vỏ, nhiều module" như Đánh giá.

   Phân chia với vỏ:
     - VỎ giữ LỚP DỮ LIỆU + THÔNG BÁO (vì cần cả khi chưa mở tab): mảng đơn DATA, tải định kỳ (loadBookings/taoLichDon),
       số đơn chờ duyệt trên tab + thanh bên + tiêu đề trang, chuông/thông báo đơn mới, Tổng quan, công tắc giữ phòng.
     - MODULE giữ GIAO DIỆN tab Đặt phòng: thanh lọc, số liệu đầu trang, danh sách đơn, báo cáo, xuất Excel (CSV),
       nút Duyệt / Từ chối / Khách đã tới.
   Cầu nối (ctx, xem MOD_CTX ở vỏ): ctx.donPhong() mảng đơn hiện có · ctx.taiDon(tay) tải lại · ctx.donDaDoi() báo vỏ
   cập nhật số đếm · ctx.coQCN(q, cn) / ctx.qNhieuCN(q) hỏi quyền · ctx.api / ctx.toast / ctx.phien.
   Quyền: DATPHONG.XEM (thấy đơn — máy chủ đã lọc đúng chi nhánh) · DATPHONG.DUYET (nút thao tác, theo chi nhánh của đơn).
   Mọi id bắt đầu bằng "mdp" để không trùng vỏ. Giao diện dùng lại lớp CSS chung của vỏ (.stat, .toolbar, .bk, .pill-s…).
   ════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var C = null, K = null, VIEW = 'list', DANG_TAI = false;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  function ds() { return (C && C.donPhong()) || []; }
  var NHAN = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', done: 'Đã tới hát' };

  /* ───────── khung giao diện (dựng 1 lần, giữ nguyên bộ lọc khi qua lại giữa các tab) ───────── */
  function dung() {
    K.innerHTML =
      '<div class="stats" id="mdpStats"></div>' +
      '<div class="toolbar" id="mdpToolbar" style="display:flex">' +
        '<input id="mdpTim" placeholder="Tìm tên, số điện thoại hoặc mã…" style="flex:1;min-width:190px">' +
        '<select id="mdpTT"><option value="">Mọi trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option>' +
          '<option value="done">Đã tới hát</option><option value="rejected">Từ chối</option></select>' +
        '<select id="mdpCN" style="display:none"><option value="">Tất cả chi nhánh</option></select>' +
        '<select id="mdpNgay"><option value="">Mọi ngày</option><option value="today">Hôm nay</option><option value="tomorrow">Ngày mai</option><option value="week">7 ngày tới</option></select>' +
        '<button class="btn btn-y btn-sm" type="button" id="mdpXemDs" data-a="xem" data-v="list">📋 Danh sách</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="mdpXemBc" data-a="xem" data-v="report">📊 Báo cáo</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="mdpLamMoi" data-a="lammoi">🔄 Làm mới</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-a="xuat">⬇️ Xuất Excel</button>' +
      '</div>' +
      '<div class="list" id="mdpList"></div>' +
      '<div id="mdpReport" style="display:none"></div>';
    ['mdpTim'].forEach(function (id) { $(id).addEventListener('input', ve); });
    ['mdpTT', 'mdpCN', 'mdpNgay'].forEach(function (id) { $(id).addEventListener('change', ve); });
    K.addEventListener('click', bam);
  }

  function bam(e) {
    var n = e.target.closest('[data-a]'); if (!n || !K.contains(n)) return;
    var a = n.dataset.a;
    if (a === 'xem') doiView(n.dataset.v);
    else if (a === 'lammoi') lamMoi();
    else if (a === 'xuat') xuat();
    else if (a === 'duyet' || a === 'tuchoi' || a === 'toi') thaoTac(n, n.dataset.ma, { duyet: 'approved', tuchoi: 'rejected', toi: 'done' }[a]);
  }

  function doiView(v) {
    VIEW = v;
    $('mdpXemDs').className = 'btn btn-sm ' + (v === 'list' ? 'btn-y' : 'btn-ghost');
    $('mdpXemBc').className = 'btn btn-sm ' + (v === 'report' ? 'btn-y' : 'btn-ghost');
    $('mdpList').style.display = v === 'report' ? 'none' : '';
    $('mdpReport').style.display = v === 'report' ? '' : 'none';
    ve();
  }

  async function lamMoi() {
    if (DANG_TAI) return;
    var b = $('mdpLamMoi');
    DANG_TAI = true; b.disabled = true; b.innerHTML = '<span class="spin"></span>';
    $('mdpList').innerHTML = '<div class="sk"></div><div class="sk"></div><div class="sk"></div>';
    try { await C.taiDon(true); }
    finally { DANG_TAI = false; b.disabled = false; b.textContent = '🔄 Làm mới'; ve(); }
  }

  /* Ô lọc chi nhánh: chỉ khi được xem đơn của NHIỀU chi nhánh; dựng từ chính dữ liệu đơn (giữ lựa chọn đang có). */
  function dungLocCN() {
    var el = $('mdpCN'), nhieu = C.qNhieuCN('DATPHONG.XEM');
    el.style.display = nhieu ? '' : 'none';
    if (!nhieu) { el.value = ''; return; }
    var cu = el.value, bs = [];
    ds().forEach(function (d) { if (bs.indexOf(d.branchName) < 0) bs.push(d.branchName); });
    bs.sort();
    el.innerHTML = '<option value="">Tất cả chi nhánh</option>' + bs.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('');
    if (cu && bs.indexOf(cu) >= 0) el.value = cu;
  }

  function locDon() {
    var q = norm($('mdpTim').value.trim()), fs = $('mdpTT').value, fb = $('mdpCN').value, fd = $('mdpNgay').value;
    var today = new Date().toISOString().slice(0, 10);
    var tmr = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    var wk = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    return ds().filter(function (d) {
      if (fs && d.status !== fs) return false;
      if (fb && d.branchName !== fb) return false;
      if (fd === 'today' && d.date !== today) return false;
      if (fd === 'tomorrow' && d.date !== tmr) return false;
      if (fd === 'week' && !(d.date >= today && d.date <= wk)) return false;
      if (q && !norm(d.name + ' ' + d.phone + ' ' + d.code + ' ' + d.branchName).includes(q)) return false;
      return true;
    }).sort(function (a, b) { return (a.date + a.startTime).localeCompare(b.date + b.startTime); });
  }

  function veSoLieu() {
    var D = ds(), nP = D.filter(function (d) { return d.status === 'pending'; }).length;
    var today = new Date().toISOString().slice(0, 10), tD = D.filter(function (d) { return d.date === today; });
    $('mdpStats').innerHTML =
      '<div class="stat r"><div class="k">Chờ duyệt</div><div class="v">' + nP + '</div></div>' +
      '<div class="stat y"><div class="k">Đơn hôm nay</div><div class="v">' + tD.length + '</div></div>' +
      '<div class="stat g"><div class="k">Đã duyệt hôm nay</div><div class="v">' + tD.filter(function (d) { return d.status === 'approved'; }).length + '</div></div>' +
      '<div class="stat"><div class="k">Khách hôm nay</div><div class="v">' + tD.filter(function (d) { return d.status !== 'rejected'; }).reduce(function (s, d) { return s + (+d.guests || 0); }, 0) + '</div></div>';
  }

  function ve() {
    if (!K || !$('mdpList')) return;
    dungLocCN();
    veSoLieu();
    if (VIEW === 'report') return veBaoCao();
    var fs = $('mdpTT').value, rows = locDon();
    $('mdpList').innerHTML = rows.length ? rows.map(theDon).join('') :
      '<div class="empty"><div class="big">' + (fs === 'pending' ? '✅' : '📭') + '</div>' +
      '<b style="font-family:\'Baloo 2\';font-size:19px;display:block;margin-bottom:6px">' +
      (fs === 'pending' ? 'Không còn đơn nào chờ duyệt' : 'Chưa có đơn nào ở mục này') + '</b><p>' +
      (fs === 'pending' ? 'Đơn mới sẽ hiện ở đây và trang tự làm mới mỗi phút.' : 'Thử đổi bộ lọc ngày hoặc xoá từ khoá tìm kiếm.') + '</p></div>';
  }

  function theDon(d) {
    var day = new Date(d.date + 'T00:00:00');
    var label = NHAN[d.status] || d.status;
    var duyet = C.coQCN('DATPHONG.DUYET', d.branchId);
    var smsOK = encodeURIComponent('Boom Music Box xac nhan giu phong ' + d.code + ': ' + d.date + ' ' + d.startTime + '-' + d.endTime + ', ' + d.guests + ' nguoi. Hen gap ban!');
    var smsNo = encodeURIComponent('Boom Music Box: rat tiec khung gio ' + d.date + ' ' + d.startTime + ' da kin. Ban chon gio khac giup minh nhe!');
    var nut = function (a, cls, chu) { return '<button class="btn ' + cls + ' btn-sm" type="button" data-a="' + a + '" data-ma="' + esc(d.code) + '">' + chu + '</button>'; };
    return '<article class="bk" data-s="' + esc(d.status) + '" id="mdp-' + esc(d.code) + '">' +
      '<div class="bk-top"><div>' +
        '<div class="bk-name">' + esc(d.name) + ' <span class="pill-s ' + esc(d.status) + '">' + label + '</span></div>' +
        '<div style="font-size:13px;color:var(--txt-mute)">' + esc(d.branchName) + ' · gửi lúc ' + esc(String(d.createdAt || '').replace('T', ' ').slice(0, 16)) + '</div>' +
      '</div><span class="bk-code">' + esc(d.code) + '</span></div>' +
      '<div class="bk-grid">' +
        '<div class="r"><i>Ngày</i><b>' + day.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '</b></div>' +
        '<div class="r"><i>Giờ</i><b>' + esc(d.startTime) + ' → ' + esc(d.endTime) + '</b></div>' +
        '<div class="r"><i>Số người</i><b>' + esc(d.guests) + '</b></div>' +
        '<div class="r"><i>Điện thoại</i><b><a href="tel:' + esc(d.phone) + '" style="color:var(--yellow)">' + esc(d.phone) + '</a></b></div>' +
        (d.email ? '<div class="r"><i>Email</i><b style="font-weight:500;font-size:12.5px">' + esc(d.email) + '</b></div>' : '') +
      '</div>' +
      (d.note ? '<div class="bk-note">💬 ' + esc(d.note) + '</div>' : '') +
      (d.handledBy ? '<div style="font-size:12.5px;color:var(--txt-mute);margin-bottom:10px">Xử lý bởi ' + esc(d.handledBy) + ' · ' + esc(String(d.handledAt || '').replace('T', ' ').slice(0, 16)) + '</div>' : '') +
      '<div class="bk-act">' +
        '<a class="btn btn-ghost btn-sm" href="tel:' + esc(d.phone) + '">📞 Gọi khách</a>' +
        (d.status === 'pending' && duyet ? nut('duyet', 'btn-ok', '✓ Duyệt') + nut('tuchoi', 'btn-bad', '✕ Từ chối') : '') +
        (d.status === 'approved' ? '<a class="btn btn-y btn-sm" href="sms:' + esc(d.phone) + '?body=' + smsOK + '">💬 Nhắn xác nhận</a>' +
          (duyet ? nut('toi', 'btn-ghost', '🎤 Khách đã tới') : '') : '') +
        (d.status === 'rejected' ? '<a class="btn btn-ghost btn-sm" href="sms:' + esc(d.phone) + '?body=' + smsNo + '">💬 Nhắn xin lỗi</a>' : '') +
        '<a class="btn btn-ghost btn-sm" href="https://zalo.me/' + esc(d.phone) + '" target="_blank" rel="noopener">Zalo</a>' +
      '</div></article>';
  }

  /* Duyệt / từ chối / khách đã tới — cập nhật lạc quan rồi gửi máy chủ; lỗi thì trả lại như cũ. Chặn bấm kép. */
  async function thaoTac(btn, code, status) {
    if (!btn || btn.disabled) return;
    var d = ds().find(function (x) { return x.code === code; }); if (!d) return;
    var reason = '';
    if (status === 'rejected') {
      reason = prompt('Lý do từ chối (khách sẽ thấy trong email):', 'Khung giờ này đã kín phòng');
      if (reason === null) return;
    }
    var cu = { status: d.status, handledBy: d.handledBy, handledAt: d.handledAt }, p = C.phien() || {};
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Đang xử lý…';
    d.status = status; d.handledBy = p.fullName || p.user; d.handledAt = new Date().toISOString();
    C.donDaDoi();                                    // số đếm trên tab + vẽ lại ngay (lạc quan)
    try {
      var j = await C.api({ action: 'update', code: code, status: status, reason: reason });
      if (!j.ok) throw new Error(j.error || 'FAIL');
      C.toast(status === 'approved' ? 'Đã duyệt và gửi thông báo cho khách.'
        : status === 'rejected' ? 'Đã từ chối và báo lại cho khách.' : 'Đã ghi nhận khách tới hát.', 'ok');
    } catch (e) {
      d.status = cu.status; d.handledBy = cu.handledBy; d.handledAt = cu.handledAt;
      C.donDaDoi();
      C.toast(e && e.message === 'FORBIDDEN' ? 'Tài khoản này không được duyệt đơn của chi nhánh này.' : 'Không lưu được lên máy chủ. Kiểm tra kết nối rồi thử lại.', 'bad');
    }
  }

  /* ───────── Báo cáo ───────── */
  function veBaoCao() {
    var D = ds(), byBranch = {}, byDay = {}, byStatus = { pending: 0, approved: 0, rejected: 0, done: 0 };
    D.forEach(function (d) {
      var b = byBranch[d.branchName] = byBranch[d.branchName] || { t: 0, a: 0, g: 0 };
      b.t++;
      if (d.status === 'approved' || d.status === 'done') { b.a++; b.g += (+d.guests || 0); }
      byDay[d.date] = (byDay[d.date] || 0) + 1;
      byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    });
    var rows = Object.entries(byBranch).sort(function (a, b) { return b[1].t - a[1].t; });
    var days = Object.entries(byDay).sort().slice(-14);
    var maxD = Math.max.apply(null, [1].concat(days.map(function (d) { return d[1]; })));
    var total = D.length || 1;
    $('mdpReport').innerHTML =
      '<div class="stats" style="margin-bottom:24px">' +
        '<div class="stat"><div class="k">Tổng đơn</div><div class="v">' + D.length + '</div></div>' +
        '<div class="stat g"><div class="k">Tỉ lệ duyệt</div><div class="v">' + Math.round((byStatus.approved + byStatus.done) / total * 100) + '%</div></div>' +
        '<div class="stat y"><div class="k">Tổng lượt khách</div><div class="v">' + D.filter(function (d) { return d.status !== 'rejected'; }).reduce(function (s, d) { return s + (+d.guests || 0); }, 0) + '</div></div>' +
        '<div class="stat r"><div class="k">Bị từ chối</div><div class="v">' + byStatus.rejected + '</div></div>' +
      '</div>' +
      '<h3 style="font-size:19px;margin-bottom:12px">Đơn theo ngày (14 ngày gần nhất)</h3>' +
      '<div style="display:flex;gap:5px;align-items:flex-end;height:140px;background:var(--surface2);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:26px;overflow-x:auto">' +
        (days.length ? days.map(function (e) {
          var d = e[0], n = e[1];
          return '<div style="flex:1;min-width:26px;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end">' +
            '<b style="font-size:11.5px;color:var(--yellow)">' + n + '</b>' +
            '<div style="width:100%;height:' + Math.max(6, n / maxD * 82) + '%;border-radius:5px 5px 0 0;background:linear-gradient(180deg,var(--yellow),var(--gold))" title="' + d + ': ' + n + ' đơn"></div>' +
            '<span style="font-size:10px;color:var(--txt-mute);white-space:nowrap">' + d.slice(8) + '/' + d.slice(5, 7) + '</span></div>';
        }).join('') : '<span style="color:var(--txt-mute);font-size:13.5px">Chưa có dữ liệu.</span>') +
      '</div>' +
      '<h3 style="font-size:19px;margin-bottom:12px">Xếp hạng chi nhánh</h3>' +
      '<div class="tblwrap"><table><thead><tr><th>#</th><th>Chi nhánh</th><th>Tổng đơn</th><th>Đã duyệt</th><th>Lượt khách</th><th>Tỉ lệ duyệt</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (e, i) {
          var b = e[0], v = e[1], pct = Math.round(v.a / v.t * 100);
          return '<tr><td><b style="color:var(--yellow)">' + (i + 1) + '</b></td><td><b>' + esc(b) + '</b></td>' +
            '<td>' + v.t + '</td><td>' + v.a + '</td><td>' + v.g + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:8px">' +
            '<div style="flex:1;min-width:56px;height:6px;background:var(--line);border-radius:99px;overflow:hidden">' +
            '<div style="width:' + pct + '%;height:100%;background:var(--ok)"></div></div><span>' + pct + '%</span></div></td></tr>';
        }).join('') : '<tr><td colspan="6" style="color:var(--txt-mute);padding:24px;text-align:center">Chưa có dữ liệu.</td></tr>') +
      '</tbody></table></div>';
  }

  /* ───────── Xuất CSV (Excel mở được, có BOM UTF-8) — đúng các đơn đang lọc ───────── */
  function xuat() {
    var rows = locDon();
    if (!rows.length) return C.toast('Không có dòng nào để xuất.', 'bad');
    var cols = ['code', 'branchName', 'date', 'startTime', 'endTime', 'duration', 'guests', 'name', 'phone', 'email', 'note', 'status', 'handledBy', 'handledAt', 'createdAt'];
    var head = ['Mã', 'Chi nhánh', 'Ngày', 'Bắt đầu', 'Kết thúc', 'Số giờ', 'Số người', 'Khách', 'Điện thoại', 'Email', 'Ghi chú', 'Trạng thái', 'Người xử lý', 'Lúc xử lý', 'Lúc đặt'];
    var csv = '﻿' + [head.join(',')].concat(rows.map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"'; }).join(',');
    })).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'boom-donphong-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    C.toast('Đã xuất ' + rows.length + ' dòng.', 'ok');
  }

  /* ───────── giao tiếp với vỏ ───────── */
  function mo(khung, ctx, view) {
    C = ctx;
    if (K !== khung || !$('mdpList')) { K = khung; dung(); }
    if (view === 'report' || view === 'list') doiView(view); else ve();
  }
  window.BMB_MOD = window.BMB_MOD || {};
  window.BMB_MOD['dat-phong'] = {
    mo: mo,
    veLai: ve,                                     // vỏ gọi khi dữ liệu đơn vừa đổi (tải định kỳ, đơn mới) và đang ở tab này
    dongKhiBack: function () { return false; }     // tab này không có lớp phủ riêng (Duyệt dùng hộp thoại sẵn của trình duyệt)
  };
})();
