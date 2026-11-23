/* ════════════════════════════════════════════════════════════════════════
   MODULE "PHÂN QUYỀN (TICK CHỌN)" — cắm vào vỏ admin.html (22/11/2026)

   Mục đích: admin tick chọn CHỨC NĂNG × PHẠM VI cho từng tài khoản (kiêm nhiệm, quản lý vùng, ngoại lệ) thay vì
   gắn cứng một vai trò. Giao diện chỉ là lớp mỏng trên 3 API đã có của máy chủ:
     quyen_list {taikhoan}  → quyền đã cấp riêng + danh mục chức năng + quyền MẶC ĐỊNH theo vai trò (macDinh)
     quyen_cap  {taikhoan, quyen, phamVi:'TATCA'|<mã chi nhánh>, den?, lyDo?}
     quyen_thu  {id}        (thu hồi = ghi dấu, giữ lịch sử, hiệu lực ngay)
   Danh mục chức năng lấy từ máy chủ (danhMuc) và NHÓM theo tiền tố "MÔ-ĐUN." — sau này thêm mô-đun mới
   (bảo trì, đặt phòng, nhân sự…) chỉ cần máy chủ thêm vào danh mục, giao diện tự có thêm thẻ nhóm.
   Phạm vi 'DV:<đơn vị>' (cây tổ chức, chưa dùng) được giữ nguyên nếu đã có, không làm hỏng khi hiển thị.

   Module KHÔNG nằm trong MODULES của vỏ (không phải một tab) mà được nạp khi bấm "Phân quyền" ở danh sách tài khoản:
     window.BMB_MOD.quyen = { moChoTaiKhoan(ctx, taiKhoan), dongKhiBack() }
   Mọi id/class bắt đầu bằng "mqy" để không trùng với vỏ.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var C = null, TK = null, DATA = null, DRAFT = {}, MD = {}, DM = [], DA_CO = {}, MO = false, LUU = false, PICK = '';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var NHOM_TEN = { DANHGIA: 'Đánh giá khách hàng', BAOTRI: 'Bảo trì · Sự cố', DATPHONG: 'Đặt phòng', NHANSU: 'Nhân sự', KETOAN: 'Kế toán' };
  var NHOM_ICO = { DANHGIA: '⭐', BAOTRI: '🛠', DATPHONG: '📅', NHANSU: '👥', KETOAN: '🧾' };
  /* Quyền phụ thuộc: có quyền bên trái thì phải có quyền bên phải (ở phạm vi bằng hoặc rộng hơn) mới dùng được */
  var CAN = {
    'DANHGIA.XULY': 'DANHGIA.XEM', 'DANHGIA.XEM_SDT': 'DANHGIA.XEM', 'DANHGIA.XUAT': 'DANHGIA.XEM',
    'DANHGIA.QR_QUANLY': 'DANHGIA.QR_XEM'
  };
  var NHAY_CAM = { 'DANHGIA.XEM_SDT': 1, 'DANHGIA.XUAT': 1 };   // dữ liệu cá nhân của khách
  var MAU = [
    { ten: 'Chỉ xem báo cáo', mo: 'Xem số liệu và phiếu, không gọi được khách', q: ['DANHGIA.XEM'] },
    { ten: 'Xử lý khiếu nại', mo: 'Xem, xem số điện thoại, ghi nhận xử lý', q: ['DANHGIA.XEM', 'DANHGIA.XEM_SDT', 'DANHGIA.XULY'] },
    { ten: 'Toàn quyền nghiệp vụ', mo: 'Như giám sát chất lượng (có xuất Excel, xem mã QR)', q: ['DANHGIA.XEM', 'DANHGIA.XULY', 'DANHGIA.XEM_SDT', 'DANHGIA.XUAT', 'DANHGIA.QR_XEM'] }
  ];
  var LOI = {
    FORBIDDEN: 'Chỉ tài khoản quản trị mới được phân quyền.', KHONG_TU_CAP: 'Không thể tự cấp quyền cho chính mình. Hãy nhờ một quản trị khác.',
    DA_CO_QUYEN_NAY: 'Quyền này đã được cấp rồi.', NGAY_HET_HAN_KHONG_HOP_LE: 'Ngày hết hiệu lực phải ở tương lai.',
    KHONG_CO_TAI_KHOAN: 'Không tìm thấy tài khoản.', KHONG_CO_CHI_NHANH: 'Không tìm thấy chi nhánh.', QUYEN_KHONG_HOP_LE: 'Quyền không hợp lệ.',
    SERVER_ERROR: 'Máy chủ đang bận, vui lòng thử lại.'
  };
  function loiCua(j) { return LOI[j && j.error] || LOI.SERVER_ERROR; }
  function toast(m, k) { C.toast(m, k || ''); }
  function tenCN(id) { var l = C.chiNhanh(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].ten; return id; }
  function nhom(q) { return String(q).split('.')[0]; }
  function mapTrong() { var o = {}; DM.forEach(function (q) { o[q] = { tatCa: false, cns: {} }; }); return o; }
  function sao(e) { return { tatCa: e.tatCa, cns: Object.assign({}, e.cns) }; }

  /* ───────── CSS ───────── */
  var CSS = [
    '.mqy-phu{position:fixed;inset:0;z-index:1500;background:var(--overlay);display:none;align-items:flex-end;justify-content:center}',
    '.mqy-phu.hien{display:flex;animation:mqyMo .2s both}',
    '@keyframes mqyMo{from{opacity:0}}@keyframes mqyKeo{from{transform:translateY(40px);opacity:0}}',
    '.mqy-ngan{width:100%;max-width:700px;background:var(--surface);color:var(--txt);border-radius:22px 22px 0 0;display:flex;flex-direction:column;max-height:94vh;animation:mqyKeo .3s cubic-bezier(.2,.9,.3,1) both;overflow:hidden}',
    '@media(min-width:700px){.mqy-phu{align-items:center}.mqy-ngan{border-radius:22px;max-height:90vh}}',
    '.mqy-dau{position:relative;overflow:hidden;flex:none;padding:16px 50px 16px 16px;color:var(--hdr-txt);background:var(--hdr)}',
    '.mqy-dau::before{content:"";position:absolute;right:-40px;top:-60px;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,var(--acc) 0%,transparent 66%);opacity:.3;pointer-events:none}',
    '.mqy-dau-t{position:relative;display:flex;align-items:center;gap:12px}',
    '.mqy-av{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;background:var(--acc);color:var(--on-acc);font:800 19px "Baloo 2","Be Vietnam Pro",sans-serif;box-shadow:0 8px 20px -10px var(--acc)}',
    '.mqy-dau h3{margin:0;font:800 19px/1.2 "Baloo 2","Be Vietnam Pro",sans-serif}',
    '.mqy-dau p{margin:2px 0 0;font-size:12.5px;opacity:.85}',
    '.mqy-dong{position:absolute;right:10px;top:10px;z-index:2;border:0;background:var(--hdr-soft);color:var(--hdr-txt);width:32px;height:32px;border-radius:10px;font-size:16px;cursor:pointer}',
    '.mqy-vt{display:inline-block;margin:4px 0 0 6px;line-height:1.5;padding:1px 9px;border-radius:999px;background:var(--hdr-soft);border:1px solid var(--hdr-line);font-size:11.5px;font-weight:700}',
    '.mqy-than{overflow:auto;padding:14px 14px 6px;-webkit-overflow-scrolling:touch}',
    '.mqy-note{border-radius:12px;padding:9px 12px;font-size:13px;line-height:1.45;margin-bottom:10px}',
    '.mqy-note.canh{background:var(--warn-bg);color:var(--txt);border:1px solid var(--warn)}',
    '.mqy-note.tin{background:var(--sel);color:var(--txt);border:1px solid var(--line)}',
    '.mqy-note.xau{background:var(--bad-bg);color:var(--txt);border:1px solid var(--bad)}',
    '.mqy-mau{background:var(--surface2);border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin-bottom:12px}',
    '.mqy-mau h4{margin:0 0 7px;font-size:13px;color:var(--txt-mute);font-weight:700;letter-spacing:.02em;text-transform:uppercase}',
    '.mqy-mau-hang{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.mqy-mau-hang button.m{border:1.5px solid var(--line);background:var(--surface);color:var(--txt);border-radius:12px;padding:7px 11px;font-size:13px;font-weight:700;cursor:pointer;text-align:left}',
    '.mqy-mau-hang button.m small{display:block;font-weight:500;color:var(--txt-mute);font-size:11.5px;margin-top:1px}',
    '.mqy-mau-hang button.m:active{transform:scale(.97)}',
    '.mqy-ngan input[type=text],.mqy-ngan input[type=date],.mqy-ngan input[type=search],.mqy-ngan select{width:100%;box-sizing:border-box;border:1.5px solid var(--line);background:var(--input-bg,var(--surface));color:var(--txt);border-radius:11px;padding:9px 11px;font:inherit;font-size:13.5px;min-height:40px}',
    '.mqy-ngan input:focus,.mqy-ngan select:focus{outline:2px solid var(--pri);outline-offset:1px}',
    '.mqy-ngan input[type=checkbox]{width:18px;height:18px;min-height:0;margin:0;flex:none;accent-color:var(--pri);padding:0}',
    '.mqy-mau-hang select{width:auto;max-width:220px;padding:7px 9px;font-size:13px;min-height:0}',
    '.mqy-nhom{background:var(--surface);border:1px solid var(--line);border-radius:18px;margin-bottom:12px;box-shadow:var(--shadow-sm);overflow:hidden}',
    '.mqy-nhom>h4{margin:0;padding:11px 14px;font-size:14.5px;background:var(--surface2);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px}',
    '.mqy-hang{padding:11px 14px;border-top:1px solid var(--line-soft)}',
    '.mqy-hang:first-of-type{border-top:0}',
    '.mqy-ten{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-weight:700;font-size:14px}',
    '.mqy-ten code{font-weight:500;font-size:11px;color:var(--txt-mute);background:var(--surface2);border-radius:6px;padding:1px 6px}',
    '.mqy-nc{display:inline-block;font-size:11px;font-weight:800;color:var(--bad);background:var(--bad-bg);border-radius:999px;padding:1px 8px}',
    '.mqy-pv{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}',
    '.mqy-tick{display:inline-flex;align-items:center;gap:7px;border:1.5px solid var(--line);background:var(--surface2);color:var(--txt);border-radius:999px;padding:6px 13px 6px 8px;font-size:13px;font-weight:700;cursor:pointer}',
    '.mqy-tick i{width:18px;height:18px;border-radius:6px;border:2px solid var(--txt-mute);display:grid;place-items:center;font-style:normal;font-size:12px;line-height:1;color:transparent}',
    '.mqy-tick.bat{border-color:var(--pri);background:var(--sel);color:var(--pri)}',
    '.mqy-tick.bat i{background:var(--pri);border-color:var(--pri);color:var(--on-pri)}',
    '.mqy-tick.khoa{cursor:default;opacity:.75}',
    '.mqy-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 6px 5px 11px;font-size:12.5px;font-weight:600;background:var(--sel);color:var(--pri);border:1px solid var(--line)}',
    '.mqy-chip.khoa{padding-right:11px;background:var(--surface2);color:var(--txt-mute)}',
    '.mqy-chip.moi{border-style:dashed}',
    '.mqy-chip button{border:0;background:transparent;color:inherit;cursor:pointer;font-size:14px;line-height:1;padding:0 4px}',
    '.mqy-chip small{font-weight:500;opacity:.8}',
    '.mqy-them{border:1.5px dashed var(--line);background:transparent;color:var(--pri);border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer}',
    '.mqy-pick{margin-top:8px;border:1px solid var(--line);background:var(--surface2);border-radius:14px;padding:8px}',
    '.mqy-pick input{width:100%;margin-bottom:6px}',
    '.mqy-pick-l{max-height:170px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px}',
    '.mqy-pick-l label{display:flex;align-items:center;gap:8px;font-size:13px;padding:6px 8px;border-radius:9px;cursor:pointer;margin:0;line-height:1.25}',
    '.mqy-pick-l label:hover{background:var(--hover)}',
    '.mqy-pick-l label.da{opacity:.5}',
    '.mqy-ls{margin:2px 0 12px;font-size:12.5px;color:var(--txt-mute)}',
    '.mqy-ls summary{cursor:pointer;font-weight:700;color:var(--pri)}',
    '.mqy-ls div{padding:5px 0 0 10px;border-left:2px solid var(--line);margin:6px 0 0 4px;line-height:1.45}',
    '.mqy-chan{border-top:1px solid var(--line);padding:10px 14px calc(12px + env(safe-area-inset-bottom,0px));background:var(--surface)}',
    '.mqy-ghi{display:grid;grid-template-columns:150px 1fr;gap:8px;margin-bottom:8px}',
    '@media(max-width:520px){.mqy-ghi{grid-template-columns:1fr}}',
    '.mqy-ghi label{display:block;font-size:11.5px;color:var(--txt-mute);font-weight:700;margin-bottom:2px}',
    '.mqy-tom{font-size:13px;margin-bottom:8px;min-height:19px}',
    '.mqy-tom b{color:var(--pri)}',
    '.mqy-nut{display:flex;gap:8px}.mqy-nut .btn{flex:1}',
    '.mqy-loi{color:var(--bad);font-size:13px;margin-top:6px;min-height:0}'
  ].join('\n');

  function dungKhung() {
    if ($('mqyPhu')) return;
    var st = document.createElement('style'); st.id = 'mqyCss'; st.textContent = CSS; document.head.appendChild(st);
    var d = document.createElement('div'); d.className = 'mqy-phu'; d.id = 'mqyPhu'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
    d.innerHTML = '<div class="mqy-ngan" id="mqyNgan"></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target === d) dong(); });
    d.addEventListener('click', bam);
    d.addEventListener('change', doi);
    d.addEventListener('input', go);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && MO) dong(); });
  }

  /* ───────── nạp dữ liệu ───────── */
  function moChoTaiKhoan(ctx, tk) {
    C = ctx; TK = tk; dungKhung(); DATA = null; DRAFT = {}; PICK = '';
    $('mqyNgan').innerHTML = veDau() + '<div class="mqy-than"><div class="empty"><div class="big">⏳</div>Đang tải quyền…</div></div>';
    mo();
    C.api({ action: 'quyen_list', taikhoan: tk.taikhoan }).then(function (j) {
      if (!j || !j.ok) { $('mqyNgan').querySelector('.mqy-than').innerHTML = '<div class="empty"><div class="big">📡</div>' + esc(loiCua(j)) + '</div>'; return; }
      DATA = j; DM = Object.keys(j.danhMuc || {});
      MD = mapTrong(); DA_CO = mapTrong();
      ((j.macDinh && j.macDinh.quyen) || []).forEach(function (r) { them(MD, r.quyen, r.phamVi); });
      (j.data || []).filter(function (r) { return r.conHieuLuc; }).forEach(function (r) { them(DA_CO, r.quyen, r.phamVi); });
      DRAFT = {}; DM.forEach(function (q) { DRAFT[q] = sao(DA_CO[q]); });
      ve();
    }).catch(function () { $('mqyNgan').querySelector('.mqy-than').innerHTML = '<div class="empty"><div class="big">📡</div>' + LOI.SERVER_ERROR + '</div>'; });
  }
  function them(m, q, pv) {
    if (!m[q]) return;
    if (pv === 'TATCA') m[q].tatCa = true; else if (String(pv).indexOf('CN:') === 0) m[q].cns[pv.slice(3)] = 1;
  }
  function mo() { if (MO) return; MO = true; $('mqyPhu').classList.add('hien'); C.moModalCoBack(); }
  function dong(tuBack) {
    if (!MO) return; MO = false; $('mqyPhu').classList.remove('hien');
    if (!tuBack) C.dongModalCoBack();
  }

  /* ───────── tính toán thay đổi ───────── */
  /* quyền q đã phủ phạm vi pv ('TATCA' hay mã chi nhánh) chưa — gồm cả mặc định theo vai trò lẫn phần đang tick */
  function phu(q, pv) {
    var a = MD[q] || { tatCa: false, cns: {} }, b = DRAFT[q] || { tatCa: false, cns: {} };
    if (a.tatCa || b.tatCa) return true;
    if (pv === 'TATCA') return false;
    return !!(a.cns[pv] || b.cns[pv]);
  }
  /* danh sách thay đổi so với hiện trạng: {cap:[{quyen,phamVi}], thu:[{id,...}]} */
  function diff() {
    var cap = [], thu = [], dangCo = (DATA.data || []).filter(function (r) { return r.conHieuLuc; });
    DM.forEach(function (q) {
      var d = DRAFT[q], co = DA_CO[q];
      if (d.tatCa && !co.tatCa) cap.push({ quyen: q, phamVi: 'TATCA' });
      Object.keys(d.cns).forEach(function (c) { if (!d.tatCa && !co.cns[c]) cap.push({ quyen: q, phamVi: c }); });
      dangCo.forEach(function (r) {
        if (r.quyen !== q) return;
        var bo = false;
        if (r.phamVi === 'TATCA') bo = !d.tatCa;
        else if (String(r.phamVi).indexOf('CN:') === 0) bo = !d.cns[r.phamVi.slice(3)] || d.tatCa;   // đã có toàn chuỗi → dòng riêng chi nhánh thừa, thu hồi cho gọn
        if (bo) thu.push(r);
      });
    });
    return { cap: cap, thu: thu };
  }

  /* ───────── vẽ ───────── */
  function veDau() {
    var ten = TK.hoten || TK.taikhoan, ro = { admin: 'Quản trị', manager: 'Quản lý chi nhánh', kythuat: 'Kỹ thuật viên', kythuat_mang: 'Kỹ thuật mạng', giamsat: 'Giám sát chất lượng', quay: 'Quầy' };
    return '<div class="mqy-dau"><button class="mqy-dong" type="button" data-a="dong" aria-label="Đóng">✕</button>' +
      '<div class="mqy-dau-t"><div class="mqy-av">' + esc(String(ten).trim().charAt(0).toUpperCase() || '?') + '</div>' +
      '<div style="min-width:0"><h3>Phân quyền · ' + esc(ten) + '</h3><p>@' + esc(TK.taikhoan) + '<span class="mqy-vt">' + esc(ro[TK.vaitro] || TK.vaitro) + (TK.chinhanhTen ? ' · ' + esc(TK.chinhanhTen) : '') + '</span></p></div></div></div>';
  }
  function chipKhoa(pv, ghi) { return '<span class="mqy-chip khoa">🔒 ' + (pv === 'TATCA' ? 'Toàn chuỗi' : esc(tenCN(pv))) + ' <small>' + ghi + '</small></span>'; }
  function veHang(q) {
    var d = DRAFT[q], m = MD[q], tenQ = DATA.danhMuc[q], tuCap = C.phien() && String(C.phien().user).toLowerCase() === TK.taikhoan.toLowerCase();
    var khoaToan = m.tatCa, html = '<div class="mqy-hang" data-q="' + esc(q) + '"><div class="mqy-ten">' + esc(tenQ) + (NHAY_CAM[q] ? ' <span class="mqy-nc">dữ liệu khách</span>' : '') + ' <code>' + esc(q) + '</code></div><div class="mqy-pv">';
    if (khoaToan) html += '<span class="mqy-tick bat khoa"><i>✓</i>Toàn chuỗi</span>' + chipKhoa('TATCA', 'theo vai trò');
    else {
      html += '<button type="button" class="mqy-tick' + (d.tatCa ? ' bat' : '') + '" data-a="tatca"' + (tuCap ? ' disabled' : '') + '><i>✓</i>Toàn chuỗi</button>';
      Object.keys(m.cns).forEach(function (c) { html += chipKhoa(c, 'theo vai trò'); });
      if (!d.tatCa) {
        Object.keys(d.cns).forEach(function (c) {
          var moi = !DA_CO[q].cns[c];
          html += '<span class="mqy-chip' + (moi ? ' moi' : '') + '">' + esc(tenCN(c)) + (moi ? ' <small>mới</small>' : '') + '<button type="button" data-a="bo" data-c="' + esc(c) + '" aria-label="Bỏ">✕</button></span>';
        });
        html += '<button type="button" class="mqy-them" data-a="pick"' + (tuCap ? ' disabled' : '') + '>＋ Chi nhánh</button>';
      }
    }
    html += '</div>';
    if (PICK === q && !khoaToan && !d.tatCa) {
      html += '<div class="mqy-pick"><input type="search" placeholder="Tìm chi nhánh…" data-a="loc" autocomplete="off"><div class="mqy-pick-l">' +
        C.chiNhanh().map(function (b) {
          var da = !!(m.cns[b.id]), on = !!d.cns[b.id] || da;
          return '<label class="' + (da ? 'da' : '') + '" data-ten="' + esc(b.ten.toLowerCase()) + '"><input type="checkbox" data-a="cn" data-c="' + esc(b.id) + '"' + (on ? ' checked' : '') + (da ? ' disabled' : '') + '> ' + esc(b.ten) + '</label>';
        }).join('') + '</div></div>';
    }
    return html + '</div>';
  }
  function ve() {
    var tuCap = String(C.phien().user).toLowerCase() === TK.taikhoan.toLowerCase(), nh = {}, ord = [];
    DM.forEach(function (q) { var g = nhom(q); if (!nh[g]) { nh[g] = []; ord.push(g); } nh[g].push(q); });
    var h = veDau() + '<div class="mqy-than" id="mqyThan">';
    if (tuCap) h += '<div class="mqy-note xau"><b>Đây là tài khoản của chính anh/chị.</b> Hệ thống không cho tự cấp quyền cho mình; chỉ xem được. Hãy nhờ một quản trị khác.</div>';
    if (TK.vaitro === 'admin') h += '<div class="mqy-note canh">⚠ Tài khoản <b>quản trị</b>. Nên tách việc: người xử lý khiếu nại và xem số điện thoại khách dùng tài khoản <b>riêng</b>, không dồn thêm quyền nghiệp vụ vào tài khoản quản trị.</div>';
    else h += '<div class="mqy-note tin">Phần <b>🔒 theo vai trò</b> có sẵn và không sửa ở đây (muốn đổi thì đổi vai trò ở “Sửa” tài khoản). Tick thêm bên dưới để <b>cấp thêm</b> quyền (kiêm nhiệm, quản lý vùng, ngoại lệ). Có hiệu lực ngay khi lưu; thu hồi cũng ngay.</div>';
    if (!tuCap) h += '<div class="mqy-mau"><h4>Chọn nhanh một bộ quyền</h4><div class="mqy-mau-hang">' +
      MAU.map(function (m, i) { return '<button type="button" class="m" data-a="mau" data-i="' + i + '">' + esc(m.ten) + '<small>' + esc(m.mo) + '</small></button>'; }).join('') +
      '</div><div class="mqy-mau-hang" style="margin-top:8px"><span style="font-size:12.5px;color:var(--txt-mute)">Áp cho:</span><select id="mqyMauPv"><option value="TATCA">Toàn chuỗi</option>' +
      C.chiNhanh().map(function (b) { return '<option value="' + esc(b.id) + '">' + esc(b.ten) + '</option>'; }).join('') + '</select></div></div>';
    ord.forEach(function (g) {
      h += '<div class="mqy-nhom"><h4>' + (NHOM_ICO[g] || '▪') + ' ' + esc(NHOM_TEN[g] || g) + '</h4>' + nh[g].map(veHang).join('') + '</div>';
    });
    h += veLichSu() + '</div>' + veChan(tuCap);
    $('mqyNgan').innerHTML = h;
    capNhatTom();
  }
  function veLichSu() {
    var r = (DATA.data || []).filter(function (x) { return !x.conHieuLuc; });
    if (!r.length) return '';
    return '<details class="mqy-ls"><summary>Lịch sử đã thu hồi / hết hạn (' + r.length + ')</summary>' + r.map(function (x) {
      return '<div><b>' + esc(x.quyenTen) + '</b> · ' + esc(x.phamViTen) + '<br>' + (x.thuHoiLuc ? 'Thu hồi ' + dep(x.thuHoiLuc) + ' bởi ' + esc(x.thuHoiBoi) : 'Hết hạn ' + dep(x.denLuc)) +
        ' · cấp bởi ' + esc(x.nguoiCap) + (x.lyDo ? ' · “' + esc(x.lyDo) + '”' : '') + '</div>';
    }).join('') + '</details>';
  }
  function dep(s) { var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || ''); return m ? (m[4] ? m[4] + ':' + m[5] + ' ' : '') + m[3] + '/' + m[2] + '/' + m[1] : (s || ''); }
  function veChan(tuCap) {
    return '<div class="mqy-chan"><div class="mqy-ghi"><div><label for="mqyDen">Hết hiệu lực ngày (tuỳ chọn)</label><input type="date" id="mqyDen"' + (tuCap ? ' disabled' : '') + '></div>' +
      '<div><label for="mqyLyDo">Lý do cấp (ghi vào nhật ký)</label><input type="text" id="mqyLyDo" maxlength="200" placeholder="VD: kiêm giám sát chất lượng vùng Thủ Đức"' + (tuCap ? ' disabled' : '') + '></div></div>' +
      '<div class="mqy-tom" id="mqyTom"></div><div class="mqy-nut"><button type="button" class="btn btn-ghost" data-a="dong">Đóng</button>' +
      '<button type="button" class="btn btn-y" id="mqyLuu" data-a="luu"' + (tuCap ? ' disabled' : '') + '>Lưu thay đổi</button></div><div class="mqy-loi" id="mqyLoi"></div></div>';
  }
  function capNhatTom() {
    if (!$('mqyTom')) return;
    var d = diff(), t = [];
    if (d.cap.length) t.push('cấp thêm <b>' + d.cap.length + '</b>');
    if (d.thu.length) t.push('thu hồi <b>' + d.thu.length + '</b>');
    var nhay = d.cap.some(function (x) { return x.phamVi === 'TATCA' && !/\.QR_/.test(x.quyen); });
    $('mqyTom').innerHTML = t.length ? 'Sẽ ' + t.join(', ') + ' quyền.' + (nhay ? ' <span style="color:var(--warn)">⚠ Quyền ở phạm vi toàn chuỗi sẽ được báo cho chủ hệ thống qua Telegram.</span>' : '') : '<span style="color:var(--txt-mute)">Chưa có thay đổi nào.</span>';
    var b = $('mqyLuu'); if (b && !b.hasAttribute('data-khoa')) b.disabled = !t.length || LUU || String(C.phien().user).toLowerCase() === TK.taikhoan.toLowerCase();
  }
  function veLaiHang(q) {
    var el = $('mqyNgan').querySelector('.mqy-hang[data-q="' + q + '"]'); if (!el) return;
    var t = document.createElement('div'); t.innerHTML = veHang(q); el.replaceWith(t.firstChild);
  }
  function veLaiTatCa() { var y = $('mqyThan') ? $('mqyThan').scrollTop : 0; DM.forEach(veLaiHang); if ($('mqyThan')) $('mqyThan').scrollTop = y; capNhatTom(); }

  /* ───────── thao tác ───────── */
  /* bật quyền q ở phạm vi pv: tự bật thêm quyền phụ thuộc cho cùng phạm vi */
  function bat(q, pv) {
    var d = DRAFT[q];
    if (pv === 'TATCA') { d.tatCa = true; } else if (!MD[q].tatCa) d.cns[pv] = 1;
    var can = CAN[q];
    if (can && !phu(can, pv)) { bat(can, pv); toast('Đã tự chọn thêm “' + DATA.danhMuc[can] + '” vì quyền này cần có nó.', 'ok'); }
  }
  /* bỏ quyền q ở phạm vi pv: bỏ luôn các quyền phụ thuộc đang dựa vào nó */
  function bo(q, pv) {
    var d = DRAFT[q];
    if (pv === 'TATCA') d.tatCa = false; else delete d.cns[pv];
    DM.forEach(function (x) {
      if (CAN[x] === q && DRAFT[x]) {
        var bi = false;
        if (pv === 'TATCA' && DRAFT[x].tatCa) { DRAFT[x].tatCa = false; bi = true; }
        Object.keys(DRAFT[x].cns).forEach(function (c) { if (!phu(q, c)) { delete DRAFT[x].cns[c]; bi = true; } });
        if (bi) toast('Đã bỏ “' + DATA.danhMuc[x] + '” vì cần “' + DATA.danhMuc[q] + '”.', '');
      }
    });
  }
  function bam(e) {
    var n = e.target.closest('[data-a]'); if (!n || n.tagName === 'INPUT' && n.type === 'checkbox' || n.disabled) return;
    var a = n.dataset.a, hang = n.closest('.mqy-hang'), q = hang ? hang.dataset.q : '';
    if (a === 'dong') return dong();
    if (a === 'tatca') {
      if (DRAFT[q].tatCa) bo(q, 'TATCA'); else { DRAFT[q].cns = {}; bat(q, 'TATCA'); }
      PICK = ''; return veLaiTatCa();
    }
    if (a === 'bo') { bo(q, n.dataset.c); return veLaiTatCa(); }
    if (a === 'pick') { var cu = PICK; PICK = (PICK === q) ? '' : q; if (cu) veLaiHang(cu); veLaiHang(q); return; }
    if (a === 'mau') {
      var pv = $('mqyMauPv').value, m = MAU[+n.dataset.i];
      m.q.forEach(function (x) { if (DM.indexOf(x) >= 0) bat(x, pv); });
      return veLaiTatCa();
    }
    if (a === 'luu') return luu();
  }
  function doi(e) {
    var n = e.target; if (!n.dataset || n.dataset.a !== 'cn') return;
    var hang = n.closest('.mqy-hang'), q = hang.dataset.q, c = n.dataset.c;
    if (n.checked) bat(q, c); else bo(q, c);
    // giữ ô tìm kiếm + danh sách đang mở: chỉ vẽ lại hàng này rồi khôi phục
    var loc = hang.querySelector('[data-a="loc"]'), v = loc ? loc.value : '';
    DM.forEach(function (x) { if (x !== q) veLaiHang(x); }); veLaiHang(q);
    var l2 = $('mqyNgan').querySelector('.mqy-hang[data-q="' + q + '"] [data-a="loc"]'); if (l2 && v) { l2.value = v; locDS(l2); }
    capNhatTom();
  }
  function go(e) { var n = e.target; if (n.dataset && n.dataset.a === 'loc') locDS(n); }
  function locDS(inp) {
    var k = inp.value.trim().toLowerCase();
    inp.parentNode.querySelectorAll('.mqy-pick-l label').forEach(function (l) { l.style.display = !k || l.dataset.ten.indexOf(k) >= 0 ? '' : 'none'; });
  }

  function luu() {
    if (LUU) return;
    var d = diff(); if (!d.cap.length && !d.thu.length) return;
    var den = $('mqyDen').value, lyDo = $('mqyLyDo').value.trim(), loi = $('mqyLoi'); loi.textContent = '';
    LUU = true; var b = $('mqyLuu'); b.disabled = true; b.textContent = 'Đang lưu…';
    var viec = [], ok = 0, hong = [];
    d.cap.forEach(function (x) { viec.push({ action: 'quyen_cap', taikhoan: TK.taikhoan, quyen: x.quyen, phamVi: x.phamVi, den: den || undefined, lyDo: lyDo || undefined }); });
    d.thu.forEach(function (x) { viec.push({ action: 'quyen_thu', id: x.id }); });
    /* cấp trước, thu hồi sau → nếu giữa chừng lỗi thì người dùng không bị mất quyền đang có */
    (function lam(i) {
      if (i >= viec.length) return xong();
      var p = viec[i];
      C.api(p).then(function (j) { if (j && j.ok) ok++; else hong.push(loiCua(j)); lam(i + 1); }).catch(function () { hong.push(LOI.SERVER_ERROR); lam(i + 1); });
    })(0);
    function xong() {
      LUU = false;
      if (hong.length) { toast('Đã lưu ' + ok + ' thay đổi, ' + hong.length + ' lỗi: ' + hong[0], 'bad'); }
      else toast('Đã lưu phân quyền cho ' + (TK.hoten || TK.taikhoan) + '.', 'ok');
      C.api({ action: 'quyen_list', taikhoan: TK.taikhoan }).then(function (j) {
        if (j && j.ok) {
          DATA = j; MD = mapTrong(); DA_CO = mapTrong();
          ((j.macDinh && j.macDinh.quyen) || []).forEach(function (r) { them(MD, r.quyen, r.phamVi); });
          (j.data || []).filter(function (r) { return r.conHieuLuc; }).forEach(function (r) { them(DA_CO, r.quyen, r.phamVi); });
          DRAFT = {}; DM.forEach(function (q) { DRAFT[q] = sao(DA_CO[q]); }); PICK = ''; ve();
          if (hong.length) $('mqyLoi').textContent = hong.join(' · ');
        }
      });
    }
  }

  window.BMB_MOD = window.BMB_MOD || {};
  window.BMB_MOD.quyen = {
    moChoTaiKhoan: moChoTaiKhoan,
    dongKhiBack: function () { if (!MO) return false; dong(true); return true; }
  };
})();
