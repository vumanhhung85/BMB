/* ════════════════════════════════════════════════════════════════════════════════════════════════
   MODULE "ĐÁNH GIÁ KHÁCH HÀNG" — cắm vào vỏ admin.html (21/11/2026)

   KIẾN TRÚC "MỘT VỎ, NHIỀU MODULE": admin.html là VỎ (đăng nhập, phiên, menu theo quyền, giao diện sáng/tối,
   toast, hàm gọi máy chủ). Mỗi module là MỘT file JS tự chứa (giao diện + CSS + logic), chỉ được NẠP khi người
   dùng mở tab của nó lần đầu. Module đăng ký vào window.BMB_MOD[<tên>] = { mo(khung, ctx, view), dongKhiBack() }.
   Vỏ gọi mo() mỗi lần vào tab; dongKhiBack() khi bấm Back của điện thoại. ctx là cầu nối duy nhất tới vỏ:
     ctx.api(payload, tuyChon)  ctx.toast(m, kieu)  ctx.phien()  ctx.quyen()  ctx.chiNhanh()  ctx.napXLSX()
     ctx.baoView(view)          ctx.moModalCoBack() ctx.dongModalCoBack()
   Module KHÔNG đụng vào biến/hàm của Bảo trì, Đặt phòng. Mọi id trong module bắt đầu bằng "mdg" để không trùng.

   Gồm 3 view: Tổng quan · Phiếu đánh giá · Mã QR (tạo/in tem/ảnh PNG/link màn TV).
   Quyền lấy từ máy chủ (quyen_cua_toi): DANHGIA.XEM / XULY / XEM_SDT / XUAT / QR_XEM / QR_QUANLY.
   ════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var C = null, K = null, Q = {}, VIEW = '', DUNG = false, DM_XONG = false;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function co(q) { return !!Q[q]; }
  function nhieuCN() { var e = Q['DANHGIA.XEM']; return !!e && (e.tatCa || e.chiNhanh.length > 1); }
  function toast(m, k) { C.toast(m, k || ''); }

  var SAO = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
  var TT_TEN = { moi: 'Mới', da_lien_he: 'Đã liên hệ khách', dang_xu_ly: 'Đang xử lý', da_xong: 'Đã xử lý xong', khong_can: 'Không cần xử lý' };
  var MAU_NHOM = { phuc_vu: '#8b5cf6', ve_sinh: '#0ea5e9', am_thanh: '#f59e0b', wc: '#14b8a6' };
  var LOI = { FORBIDDEN: 'Tài khoản này không có quyền với mục này.', CAN_GHI_CHU: 'Vui lòng ghi chú ngắn (đã liên hệ hay xử lý thế nào).', SERVER_ERROR: 'Máy chủ đang bận, vui lòng thử lại.' };
  function saoHtml(n, lop) { var h = ''; for (var i = 1; i <= 5; i++) h += SAO.replace('<svg', '<svg class="' + (i <= Math.round(n) ? 'bat' : '') + '"'); return '<span class="' + lop + '">' + h + '</span>'; }
  function gio(s) { if (!s) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s); return m ? m[4] + ':' + m[5] + ' · ' + m[3] + '/' + m[2] + '/' + m[1] : s; }
  function gioNgan(s) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || ''); return m ? m[4] + ':' + m[5] + ' ' + m[3] + '/' + m[2] : (s || ''); }
  function ngayDM(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? m[3] + '/' + m[2] : s; }
  function sdtDep(s) { return /^\d{10}$/.test(s) ? s.slice(0, 4) + ' ' + s.slice(4, 7) + ' ' + s.slice(7) : s; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function loiCua(j) { return LOI[j && j.error] || LOI.SERVER_ERROR; }

  /* ───────────────────────── CSS (chỉ áp trong module, dùng biến màu của vỏ → tự theo sáng/tối + bộ màu) ───────────────────────── */
  var CSS = [
    '.mdg [hidden]{display:none!important}',
    '.mdg{animation:mdgLen .35s both}',
    '@keyframes mdgLen{from{opacity:0;transform:translateY(8px)}}',
    '.mdg-hero{position:relative;overflow:hidden;border-radius:22px;padding:18px 18px 14px;margin-bottom:14px;color:var(--hdr-txt);background:var(--hdr);box-shadow:var(--shadow)}',
    '.mdg-hero::before{content:"";position:absolute;right:-50px;top:-70px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,var(--acc) 0%,transparent 66%);opacity:.32;pointer-events:none}',
    '.mdg-hero::after{content:"";position:absolute;left:30%;bottom:-90px;width:260px;height:160px;border-radius:50%;background:radial-gradient(circle,#fff 0%,transparent 70%);opacity:.08;pointer-events:none}',
    '.mdg-hero-t{position:relative;display:flex;align-items:center;gap:12px}',
    '.mdg-ico{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;background:var(--acc);color:var(--on-acc);box-shadow:0 8px 20px -10px var(--acc)}',
    '.mdg-ico svg{width:26px;height:26px;fill:currentColor}',
    '.mdg-hero h2{margin:0;font-family:"Baloo 2","Be Vietnam Pro",sans-serif;font-size:22px;line-height:1.15;font-weight:800;letter-spacing:.01em}',
    '.mdg-hero p{margin:2px 0 0;font-size:13px;opacity:.82}',
    '.mdg-seg{position:relative;display:flex;gap:6px;margin-top:14px;overflow-x:auto;scrollbar-width:none}',
    '.mdg-seg::-webkit-scrollbar{display:none}',
    '.mdg-seg button{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--hdr-line);background:var(--hdr-soft);color:var(--hdr-txt);border-radius:12px;padding:8px 14px;font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap;transition:background .15s,transform .1s}',
    '.mdg-seg button:active{transform:scale(.97)}',
    '.mdg-seg button.bat{background:var(--nav-on);color:var(--nav-on-txt);border-color:transparent;font-weight:800}',
    '.mdg-seg svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2}',
    '.mdg-dem{display:inline-block;min-width:20px;padding:1px 7px;border-radius:999px;background:var(--bad);color:var(--on-sem);font-size:11.5px;font-weight:800;text-align:center}',
    /* bộ lọc */
    '.mdg-loc{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px;margin-bottom:14px;box-shadow:var(--shadow-sm)}',
    '.mdg-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.mdg-chip{border:1px solid var(--line);background:var(--surface2);color:var(--txt);border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}',
    '.mdg-chip.bat{background:var(--pri);border-color:var(--pri);color:var(--on-pri)}',
    '.mdg-hang{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}',
    '.mdg-hang>*{flex:1 1 150px;min-width:0}',
    '.mdg-tuy{display:none;gap:8px;margin-top:10px}.mdg-tuy.hien{display:flex}.mdg-tuy>*{flex:1;min-width:0}',
    '.mdg input[type=date],.mdg input[type=search],.mdg select,.mdg textarea{width:100%;padding:9px 12px;min-height:40px;border-radius:12px;background:var(--input-bg);border:1px solid var(--line);color:var(--txt);font:inherit;font-size:14px;outline:none}',
    '.mdg input:focus,.mdg select:focus,.mdg textarea:focus{border-color:var(--pri);box-shadow:0 0 0 3px var(--sel)}',
    '.mdg-ghichu{font-size:12.5px;color:var(--txt-mute);margin-top:8px}.mdg-ghichu:empty{display:none}',
    /* KPI */
    '.mdg-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px}',
    '.mdg-k{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 14px 12px;box-shadow:var(--shadow-sm);animation:mdgLen .4s both}',
    '.mdg-k::after{content:"";position:absolute;right:-26px;bottom:-34px;width:96px;height:96px;border-radius:50%;background:var(--mau);opacity:.10}',
    '.mdg-k .ic{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--mau);color:#fff;margin-bottom:8px;box-shadow:0 6px 14px -8px var(--mau)}',
    '.mdg-k .ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2.2}',
    '.mdg-k .nh{font-size:12.5px;color:var(--txt-mute);font-weight:600}',
    '.mdg-k .so{font-family:"Baloo 2","Be Vietnam Pro",sans-serif;font-size:30px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--txt)}',
    '.mdg-k .ph{font-size:12px;color:var(--txt-mute);margin-top:2px}',
    '.mdg-k.bam{cursor:pointer}.mdg-k.bam:hover{border-color:var(--mau)}.mdg-k.bam:active{transform:scale(.98)}',
    '.mdg-sao-nho{display:inline-flex;gap:2px;vertical-align:middle}.mdg-sao-nho svg{width:14px;height:14px;fill:var(--line)}.mdg-sao-nho svg.bat{fill:#f5b800}',
    '.mdg-luoi2{display:grid;grid-template-columns:1fr;gap:14px}',
    '@media(min-width:860px){.mdg-luoi2{grid-template-columns:1fr 1fr}.mdg-rong{grid-column:1/-1}}',
    '.mdg-hop{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow-sm);min-width:0;animation:mdgLen .45s both}',
    '.mdg-hop h3{margin:0 0 10px;font-size:15.5px;display:flex;align-items:center;gap:8px}',
    '.mdg-hop h3 small{margin-left:auto;font-weight:500;color:var(--txt-mute);font-size:12px;text-align:right}',
    '.mdg-thanh{display:grid;grid-template-columns:44px 1fr 46px;gap:8px;align-items:center;margin:8px 0;font-size:13px}',
    '.mdg-thanh .t{height:12px;border-radius:99px;background:var(--line-soft);overflow:hidden}',
    '.mdg-thanh .t i{display:block;height:100%;border-radius:99px;background:var(--nhom,var(--pri));transition:width .7s cubic-bezier(.2,.8,.2,1)}',
    '.mdg-thanh .s{text-align:right;font-variant-numeric:tabular-nums;color:var(--txt-mute)}',
    '.mdg-thanh.vd{grid-template-columns:minmax(0,1.4fr) 1fr 36px}.mdg-thanh.vd .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mdg-d1 i{background:linear-gradient(90deg,#ef4444,#f87171)!important}.mdg-d2 i{background:linear-gradient(90deg,#f97316,#fb923c)!important}.mdg-d3 i{background:linear-gradient(90deg,#eab308,#facc15)!important}.mdg-d4 i{background:linear-gradient(90deg,#8b5cf6,#a78bfa)!important}.mdg-d5 i{background:linear-gradient(90deg,#16a34a,#4ade80)!important}',
    '.mdg-bang{width:100%;border-collapse:collapse;font-size:13.5px}',
    '.mdg-bang th{text-align:left;font-size:12px;color:var(--txt-mute);font-weight:600;padding:6px 8px;border-bottom:1.5px solid var(--line)}',
    '.mdg-bang td{padding:9px 8px;border-bottom:1px solid var(--line-soft);vertical-align:middle}',
    '.mdg-bang tr.bam{cursor:pointer}.mdg-bang tr.bam:hover td{background:var(--hover)}',
    '.mdg-bang .so{text-align:right;font-variant-numeric:tabular-nums}',
    '.mdg-diem{display:inline-block;min-width:40px;text-align:center;border-radius:8px;padding:2px 7px;font-weight:700;font-size:13px}',
    '.mdg-dt1,.mdg-dt2{background:var(--bad-bg);color:var(--bad)}.mdg-dt3{background:var(--mid-bg);color:var(--mid)}.mdg-dt4,.mdg-dt5{background:var(--ok-bg);color:var(--ok)}',
    '.mdg-cho,.mdg-trong{padding:36px 10px;text-align:center;color:var(--txt-mute)}',
    '.mdg-quay{width:30px;height:30px;margin:0 auto 10px;border:3px solid var(--line);border-top-color:var(--pri);border-radius:50%;animation:mdgQuay .8s linear infinite}',
    '@keyframes mdgQuay{to{transform:rotate(360deg)}}',
    '.mdg-svg-luoi{stroke:var(--line-soft)}.mdg-svg-chu{fill:var(--txt-mute)}.mdg-svg-cot{fill:var(--sel)}.mdg-svg-duong{stroke:var(--pri)}',
    /* danh sách phiếu */
    '.mdg-demkq{font-size:13px;color:var(--txt-mute);margin:0 2px 10px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
    '.mdg-p{background:var(--surface);border:1px solid var(--line);border-left:5px solid var(--pri);border-radius:16px;padding:14px;margin-bottom:10px;box-shadow:var(--shadow-sm);animation:mdgLen .35s both}',
    '.mdg-p.thap{border-left-color:var(--bad)}.mdg-p.vua{border-left-color:#eab308}.mdg-p.tot{border-left-color:var(--ok)}',
    '.mdg-p .dau{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}',
    '.mdg-p .noi{font-weight:700;font-size:15.5px}',
    '.mdg-p .tg{color:var(--txt-mute);font-size:12.5px}',
    '.mdg-p .phai{margin-left:auto;text-align:right}',
    '.mdg-sao{display:inline-flex;gap:1px}.mdg-sao svg{width:18px;height:18px;fill:var(--line)}.mdg-sao svg.bat{fill:#f5b800}',
    '.mdg-vds{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}',
    '.mdg-vd{font-size:12.5px;padding:4px 10px;border-radius:999px;background:var(--sel);color:var(--txt);font-weight:500}',
    '.mdg-vd.nang{background:var(--bad-bg);color:var(--bad);font-weight:700}',
    '.mdg-loi{margin:8px 0 0;padding:9px 11px;border-radius:12px;background:var(--surface2);border:1px solid var(--line-soft);font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.mdg-loi b{display:block;font-size:11.5px;color:var(--txt-mute);font-weight:600;margin-bottom:2px}',
    '.mdg-anhs{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
    '.mdg-anhs button{padding:0;border:0;border-radius:10px;overflow:hidden;width:76px;height:76px;cursor:zoom-in;background:var(--line-soft)}',
    '.mdg-anhs img{width:100%;height:100%;object-fit:cover;display:block}',
    '.mdg-chan{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}',
    '.mdg-sdt{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:var(--pri);font-weight:700;background:var(--sel);border-radius:10px;padding:7px 12px;font-size:14px}',
    '.mdg-sdt svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2}',
    '.mdg-tt{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}',
    '.mdg-tt-moi{background:var(--warn-bg);color:var(--warn)}.mdg-tt-da_lien_he,.mdg-tt-dang_xu_ly{background:var(--info-bg);color:var(--info)}.mdg-tt-da_xong{background:var(--ok-bg);color:var(--ok)}.mdg-tt-khong_can{background:var(--surface2);color:var(--txt-mute)}',
    '.mdg-co{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--mid-bg);color:var(--mid)}',
    '.mdg-xl{margin-top:10px;padding:9px 11px;border-radius:12px;background:var(--ok-bg);font-size:13.5px}',
    '.mdg-xl small{display:block;color:var(--txt-mute);margin-top:2px}',
    '.mdg-ls{margin-top:8px;font-size:12.5px;color:var(--txt-mute)}',
    '.mdg-ls summary{cursor:pointer;font-weight:600;color:var(--pri)}',
    '.mdg-ls div{padding:5px 0 0 10px;border-left:2px solid var(--line);margin:6px 0 0 4px}',
    '.mdg-them{display:block;margin:6px auto 0;min-width:160px}',
    /* hộp ghi nhận xử lý + xem ảnh (gắn vào body) */
    '.mdg-phu{position:fixed;inset:0;z-index:1500;background:var(--overlay);display:none;align-items:flex-end;justify-content:center}',
    '.mdg-phu.hien{display:flex;animation:mdgMo .2s both}',
    '@keyframes mdgMo{from{opacity:0}}',
    '.mdg-ngan{width:100%;max-width:520px;background:var(--surface);color:var(--txt);border-radius:22px 22px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));animation:mdgKeo .3s cubic-bezier(.2,.9,.3,1) both;max-height:92vh;overflow:auto}',
    '@media(min-width:600px){.mdg-phu{align-items:center}.mdg-ngan{border-radius:22px}}',
    '@keyframes mdgKeo{from{transform:translateY(40px);opacity:0}}',
    '.mdg-ngan h3{margin:0 0 2px;font-size:17px}',
    '.mdg-ngan .nho{color:var(--txt-mute);font-size:13px;margin:0 0 12px}',
    '.mdg-lua{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}',
    '.mdg-lua button{border:1.5px solid var(--line);background:var(--surface2);color:var(--txt);border-radius:12px;padding:10px;text-align:left;cursor:pointer;font-weight:600;font-size:13.5px}',
    '.mdg-lua button.bat{border-color:var(--pri);background:var(--sel);color:var(--pri);font-weight:800}',
    '.mdg-ngan textarea{min-height:90px;resize:vertical}',
    '.mdg-ngan .hang2{display:flex;gap:8px;margin-top:14px}.mdg-ngan .hang2 .btn{flex:1}',
    '.mdg-ngan .loi{color:var(--bad);font-size:13px;margin-top:8px;min-height:18px}',
    '.mdg-anhlon{position:fixed;inset:0;z-index:1600;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;padding:14px}',
    '.mdg-anhlon.hien{display:flex}.mdg-anhlon img{max-width:100%;max-height:100%;border-radius:10px}',
    /* mã QR */
    '.mdg-qrthanh{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px;margin-bottom:16px;box-shadow:var(--shadow-sm)}',
    '.mdg-qrthanh select{max-width:340px;flex:1 1 220px}',
    '.mdg-qrthanh .gian{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}',
    '.mdg-muc{margin-bottom:22px;animation:mdgLen .4s both}',
    '.mdg-muc>h3{margin:0 0 2px;font-size:16.5px;display:flex;align-items:center;gap:8px}',
    '.mdg-muc>h3 .so{font-size:12px;font-weight:700;background:var(--sel);color:var(--pri);border-radius:99px;padding:2px 9px}',
    '.mdg-muc>p{margin:0 0 10px;color:var(--txt-mute);font-size:13.5px}',
    '.mdg-qrluoi{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}',
    '.mdg-qr{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;box-shadow:var(--shadow-sm);text-align:center;min-width:0;transition:transform .15s,box-shadow .15s}',
    '.mdg-qr:hover{transform:translateY(-2px);box-shadow:var(--shadow)}',
    '.mdg-qr .ma{width:100%;max-width:170px;aspect-ratio:1;padding:8px;border-radius:12px;background:#fff;border:1px solid var(--line)}',
    '.mdg-qr .ma svg{width:100%;height:100%;display:block}',
    '.mdg-qr b{font-size:15px}',
    '.mdg-qr small{color:var(--txt-mute);font-size:12px}',
    '.mdg-qr .hanh{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:4px}',
    '.mdg-qr .hanh .btn{padding:5px 9px;min-height:30px;font-size:12px;border-radius:9px}',
    '.mdg-qr.trong{border-style:dashed;background:var(--surface2);justify-content:center;min-height:150px;color:var(--txt-mute)}',
    '.mdg-ghi{background:var(--mid-bg);border:1px solid color-mix(in srgb,var(--mid) 35%,transparent);color:var(--txt);border-radius:12px;padding:10px 12px;font-size:13.5px;margin-bottom:10px}',
    '.mdg-qrlon{width:min(78vw,320px);margin:6px auto;padding:10px;border:1px solid var(--line);border-radius:16px;background:#fff}',
    '.mdg-qrlon svg{width:100%;height:auto;display:block}',
    '@media(max-width:560px){.mdg-pc{display:none}.mdg-qrluoi{grid-template-columns:repeat(2,1fr)}.mdg-hero{padding:14px 12px 12px}.mdg-hero h2{font-size:19px}.mdg-seg{gap:5px}.mdg-seg button{padding:7px 9px;font-size:13px;gap:5px}}',
    /* tem in A4: 3 cột × 4 hàng */
    '#mdgIn{display:none}',
    '.mdg-tem{width:62mm;height:68mm;border:.4mm solid #5b21a6;border-radius:4mm;padding:2.5mm 3mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;break-inside:avoid;background:#fff;color:#22163a;overflow:hidden;font-family:"Be Vietnam Pro",sans-serif}',
    '.mdg-tem .t1{font-weight:700;font-size:3.7mm;letter-spacing:.2mm;color:#5b21a6}',
    '.mdg-tem .q{width:41mm;height:41mm}.mdg-tem .q svg{width:100%;height:100%}',
    '.mdg-tem .t2{font-weight:700;font-size:5mm;line-height:1.1}',
    '.mdg-tem .t3{font-size:3mm;color:#6b5f80;line-height:1.15}',
    '@media print{@page{size:A4;margin:6mm}body.mdg-dang-in{background:#fff!important}body.mdg-dang-in>*:not(#mdgIn){display:none!important}body.mdg-dang-in::before{display:none!important}body.mdg-dang-in #mdgIn{display:grid;grid-template-columns:repeat(3,62mm);gap:3mm 4mm;justify-content:center}.mdg-tem{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
    '@media(prefers-reduced-motion:reduce){.mdg *,.mdg{animation:none!important;transition:none!important}}'
  ].join('\n');

  var IC = {
    sao: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
    tq: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>',
    ds: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    qr: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v1M14 20h1M17 20h4v-3"/></svg>',
    phieu: '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    tb: '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
    vui: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
    canh: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
  };

  /* ───────────────────────── Dựng khung (1 lần) ───────────────────────── */
  function dungKhung() {
    if (!$('mdgCss')) { var st = document.createElement('style'); st.id = 'mdgCss'; st.textContent = CSS; document.head.appendChild(st); }
    K.innerHTML =
      '<div class="mdg">' +
      '<div class="mdg-hero"><div class="mdg-hero-t"><div class="mdg-ico">' + IC.sao + '</div><div><h2>Đánh giá khách hàng</h2><p id="mdgPhamVi"></p></div></div>' +
      '<div class="mdg-seg" id="mdgSeg" role="tablist">' +
      '<button type="button" data-v="tq">' + IC.tq + 'Tổng quan</button>' +
      '<button type="button" data-v="ds">' + IC.ds + 'Phiếu<span class="mdg-pc"> đánh giá</span> <span id="mdgSoXL"></span></button>' +
      '<button type="button" data-v="qr">' + IC.qr + 'Mã QR</button></div></div>' +

      '<section class="mdg-loc" id="mdgLoc">' +
      '<div class="mdg-chips" id="mdgKy"><button class="mdg-chip" data-ky="homnay">Hôm nay</button><button class="mdg-chip" data-ky="7">7 ngày</button><button class="mdg-chip bat" data-ky="30">30 ngày</button><button class="mdg-chip" data-ky="thang">Tháng này</button><button class="mdg-chip" data-ky="tuy">Tuỳ chọn</button><button class="mdg-chip" data-ky="tatca">Tất cả</button></div>' +
      '<div class="mdg-tuy" id="mdgTuy"><input type="date" id="mdgTu" aria-label="Từ ngày"><input type="date" id="mdgDen" aria-label="Đến ngày"></div>' +
      '<div class="mdg-hang">' +
      '<select id="mdgCN" aria-label="Chi nhánh"><option value="">Tất cả chi nhánh</option></select>' +
      '<select id="mdgDiem" aria-label="Điểm" data-chi-ds><option value="">Mọi điểm</option><option value="1-2">1–2 sao (thấp)</option><option value="3-3">3 sao</option><option value="4-5">4–5 sao</option></select>' +
      '<select id="mdgTT" aria-label="Trạng thái xử lý" data-chi-ds><option value="">Mọi trạng thái</option><option value="can_xu_ly">Cần xử lý</option><option value="chua_xong">Chưa xong</option><option value="moi">Mới</option><option value="da_lien_he">Đã liên hệ khách</option><option value="dang_xu_ly">Đang xử lý</option><option value="da_xong">Đã xử lý xong</option><option value="khong_can">Không cần xử lý</option></select>' +
      '<select id="mdgNhom" aria-label="Nhóm vấn đề" data-chi-ds><option value="">Mọi nhóm vấn đề</option><option value="phuc_vu">Phục vụ</option><option value="ve_sinh">Vệ sinh phòng</option><option value="am_thanh">Âm thanh / thiết bị</option><option value="wc">Nhà vệ sinh</option></select>' +
      '<select id="mdgCo" aria-label="Phiếu nghi ngờ" data-chi-ds><option value="">Mọi phiếu</option><option value="khong">Bỏ phiếu nghi ngờ</option><option value="co">Chỉ phiếu nghi ngờ</option></select>' +
      '<input type="search" id="mdgQ" placeholder="Tìm số điện thoại, mã, phòng…" data-chi-ds>' +
      '</div><div class="mdg-ghichu" id="mdgGhiChu"></div></section>' +

      '<section id="mdgTq"><div class="mdg-kpi" id="mdgKpi"></div><div class="mdg-luoi2" id="mdgBieuDo"></div></section>' +
      '<section id="mdgDs" hidden><div class="mdg-demkq"><span id="mdgDemKq"></span><button class="btn btn-ghost btn-sm" id="mdgExcel" type="button">⬇ Xuất Excel</button></div><div id="mdgPhieu"></div><button class="btn btn-ghost btn-sm mdg-them" id="mdgThem" type="button" hidden>Xem thêm</button></section>' +

      '<section id="mdgQr" hidden><div class="mdg-qrthanh"><select id="mdgQrCN" aria-label="Chi nhánh"></select><div class="gian"><button class="btn btn-ghost btn-sm" id="mdgInCN" type="button">🖨 In tem cả chi nhánh</button><button class="btn btn-y btn-sm" id="mdgTaoLoat" type="button" hidden>＋ Tạo mã cho phòng còn thiếu</button></div></div><div id="mdgQrVung"></div></section>' +
      '</div>';

    if (!$('mdgPhuXL')) {
      var phu = document.createElement('div');
      phu.innerHTML =
        '<div class="mdg-phu" id="mdgPhuXL" role="dialog" aria-modal="true"><div class="mdg-ngan mdg">' +
        '<h3>Ghi nhận xử lý</h3><p class="nho" id="mdgXlNho"></p><div class="mdg-lua" id="mdgXlLua"></div>' +
        '<label style="display:block;font-size:13px;font-weight:600;color:var(--txt-mute);margin-bottom:5px" for="mdgXlGhi">Ghi chú (đã làm gì, khách nói gì)</label>' +
        '<textarea id="mdgXlGhi" maxlength="500" placeholder="Ví dụ: Đã gọi khách, xin lỗi và mời lần sau ghé tặng 1 giờ hát…"></textarea>' +
        '<div class="loi" id="mdgXlLoi"></div><div class="hang2"><button class="btn btn-ghost" id="mdgXlHuy" type="button">Đóng</button><button class="btn btn-y" id="mdgXlLuu" type="button">Lưu</button></div></div></div>' +
        '<div class="mdg-phu" id="mdgPhuQR" role="dialog" aria-modal="true"><div class="mdg-ngan mdg" id="mdgQrHop" style="text-align:center"></div></div>' +
        '<div class="mdg-anhlon" id="mdgAnhLon"><img alt="Ảnh khách gửi"></div>' +
        '<div id="mdgIn" aria-hidden="true"></div>';
      while (phu.firstChild) document.body.appendChild(phu.firstChild);
      ganSuKienPhu();
    }
    ganSuKien();
  }

  /* ───────────────────────── Vào module ───────────────────────── */
  function cacView() { var v = []; if (co('DANHGIA.XEM')) v.push('tq', 'ds'); if (co('DANHGIA.QR_XEM')) v.push('qr'); return v; }
  function mo(khung, ctx, view) {
    C = ctx; Q = ctx.quyen() || {};
    var vs = cacView();
    if (!vs.length) { khung.innerHTML = '<div class="empty"><div class="big">🔒</div>Tài khoản này chưa được cấp quyền xem đánh giá khách hàng.</div>'; K = khung; DUNG = false; return; }
    if (!DUNG || K !== khung || !$('mdgSeg')) { K = khung; dungKhung(); DUNG = true; DM_XONG = false; }
    // nút view theo quyền (đặt cả 2 chiều)
    Array.prototype.forEach.call($('mdgSeg').children, function (b) { b.hidden = vs.indexOf(b.dataset.v) < 0; });
    $('mdgSeg').hidden = vs.length < 2;
    var xem = Q['DANHGIA.XEM'] || Q['DANHGIA.QR_XEM'];
    $('mdgPhamVi').textContent = xem.tatCa ? 'Toàn chuỗi' : (xem.chiNhanh.map(function (c) { return c.ten; }).join(', ') || 'Chi nhánh của bạn');
    $('mdgExcel').hidden = !co('DANHGIA.XUAT');
    $('mdgQ').placeholder = co('DANHGIA.XEM_SDT') ? 'Tìm số điện thoại, mã, phòng…' : 'Tìm mã phiếu hoặc phòng';
    chonView(vs.indexOf(view) >= 0 ? view : (vs.indexOf(VIEW) >= 0 ? VIEW : vs[0]), true);
  }

  function chonView(v, vaoLai) {
    var doi = v !== VIEW; VIEW = v;
    Array.prototype.forEach.call($('mdgSeg').children, function (b) { b.classList.toggle('bat', b.dataset.v === v); b.setAttribute('aria-selected', b.dataset.v === v ? 'true' : 'false'); });
    var laQr = v === 'qr';
    $('mdgLoc').hidden = laQr; $('mdgTq').hidden = v !== 'tq'; $('mdgDs').hidden = v !== 'ds'; $('mdgQr').hidden = !laQr;
    Array.prototype.forEach.call(K.querySelectorAll('[data-chi-ds]'), function (e) { e.hidden = v !== 'ds'; });
    $('mdgCN').hidden = !nhieuCN();
    if (C && C.baoView) C.baoView(v);
    if (laQr) { moQr(); return; }
    if (!DM_XONG) { DM_XONG = true; taiDanhMuc(); }
    if (doi || vaoLai) lam();
  }

  /* ───────────────────────── Sự kiện trong khung ───────────────────────── */
  function ganSuKien() {
    $('mdgSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) chonView(b.dataset.v); });
    $('mdgKy').addEventListener('click', function (e) { var c = e.target.closest('.mdg-chip'); if (c) datKy(c.dataset.ky); });
    ['mdgTu', 'mdgDen', 'mdgCN', 'mdgDiem', 'mdgTT', 'mdgNhom', 'mdgCo'].forEach(function (id) { $(id).addEventListener('change', lam); });
    var tQ; $('mdgQ').addEventListener('input', function () { clearTimeout(tQ); tQ = setTimeout(lam, 400); });
    $('mdgThem').addEventListener('click', function () { trang++; taiDs(false); });
    $('mdgPhieu').addEventListener('click', function (e) {
      var a = e.target.closest('[data-anh]'); if (a) { moAnh(a.dataset.anh); return; }
      var x = e.target.closest('[data-xl]'); if (x) moXuLy(x.dataset.xl);
    });
    $('mdgExcel').addEventListener('click', xuatExcel);
    $('mdgQrCN').addEventListener('change', function () { QR_CN = this.value; veQr(); });
    $('mdgQrVung').addEventListener('click', bamQr);
    $('mdgTaoLoat').addEventListener('click', taoLoat);
    $('mdgInCN').addEventListener('click', inCaCN);
  }
  /* Các lớp phủ (gắn vào body 1 lần) — nút Back của điện thoại đóng lớp trên cùng, như các hộp khác của vỏ */
  var MO = null;   // 'xl' | 'qr' | 'anh' | null
  function moPhu(loai) { MO = loai; C.moModalCoBack(); }
  function dongPhu(tuBack) {
    if (!MO) return;
    var l = MO; MO = null;
    if (l === 'xl') $('mdgPhuXL').classList.remove('hien');
    if (l === 'qr') $('mdgPhuQR').classList.remove('hien');
    if (l === 'anh') $('mdgAnhLon').classList.remove('hien');
    if (!tuBack) C.dongModalCoBack();
  }
  function ganSuKienPhu() {
    $('mdgXlLua').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { xlTT = b.dataset.tt; veLua(); } });
    $('mdgXlHuy').addEventListener('click', function () { dongPhu(); });
    $('mdgPhuXL').addEventListener('click', function (e) { if (e.target === $('mdgPhuXL')) dongPhu(); });
    $('mdgXlLuu').addEventListener('click', luuXuLy);
    $('mdgPhuQR').addEventListener('click', function (e) { if (e.target === $('mdgPhuQR')) dongPhu(); });
    $('mdgAnhLon').addEventListener('click', function () { dongPhu(); });
  }
  function moAnh(u) { $('mdgAnhLon').firstElementChild.src = u; $('mdgAnhLon').classList.add('hien'); moPhu('anh'); }

  /* ───────────────────────── Bộ lọc ───────────────────────── */
  var ky = '30', trang = 1, tong = 0, dsHienTai = [], dangTai = 0;
  function khoangNgay() {
    var den = ymd(new Date()), tu = '';
    if (ky === 'homnay') tu = den;
    else if (ky === '7' || ky === '30') { var d = new Date(); d.setDate(d.getDate() - (Number(ky) - 1)); tu = ymd(d); }
    else if (ky === 'thang') tu = den.slice(0, 8) + '01';
    else if (ky === 'tuy') { tu = $('mdgTu').value; den = $('mdgDen').value; }
    else den = '';
    return { tu: tu, den: den };
  }
  function boLoc(chiLoc) {
    var k = khoangNgay(), b = { tu: k.tu, den: k.den, chiNhanhId: nhieuCN() ? $('mdgCN').value : '' };
    if (!chiLoc) return b;
    var d = $('mdgDiem').value.split('-'); if (d[0]) { b.diemTu = Number(d[0]); b.diemDen = Number(d[1]); }
    b.trangThai = $('mdgTT').value; b.nhomMa = $('mdgNhom').value; b.coCo = $('mdgCo').value; b.q = $('mdgQ').value.trim();
    return b;
  }
  function datKy(v) {
    ky = v; Array.prototype.forEach.call($('mdgKy').children, function (c) { c.classList.toggle('bat', c.dataset.ky === v); });
    $('mdgTuy').classList.toggle('hien', v === 'tuy');
    if (v === 'tuy' && !$('mdgTu').value) { var d = new Date(); d.setDate(d.getDate() - 6); $('mdgTu').value = ymd(d); $('mdgDen').value = ymd(new Date()); }
    lam();
  }
  function lam() { if (VIEW === 'tq') taiTongQuan(); else if (VIEW === 'ds') taiDs(true); }

  async function taiDanhMuc() {   // danh sách chi nhánh có đánh giá + số "cần xử lý" (lấy từ thống kê, không cần quyền admin)
    try {
      var j = await C.api({ action: 'dg_thongke', coCo: 'tatca' }, { nen: true });
      if (j && j.ok) {
        var cur = $('mdgCN').value;
        $('mdgCN').innerHTML = '<option value="">Tất cả chi nhánh</option>' + j.theoChiNhanh.slice().sort(function (a, b) { return a.ten.localeCompare(b.ten, 'vi'); }).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.ten) + '</option>'; }).join('');
        $('mdgCN').value = cur;
        capNhatCanXL(j.tong.canXuLy);
      }
    } catch (e) {}
  }
  function capNhatCanXL(n) { $('mdgSoXL').innerHTML = n ? '<span class="mdg-dem">' + n + '</span>' : ''; }

  /* ───────────────────────── Tổng quan ───────────────────────── */
  async function taiTongQuan() {
    var id = ++dangTai;
    $('mdgKpi').innerHTML = ''; $('mdgBieuDo').innerHTML = '<div class="mdg-cho mdg-rong"><div class="mdg-quay"></div>Đang tải số liệu…</div>';
    try {
      var j = await C.api(Object.assign({ action: 'dg_thongke' }, boLoc(false)));
      if (id !== dangTai) return;
      if (!j.ok) { $('mdgBieuDo').innerHTML = '<div class="mdg-trong mdg-rong">' + esc(loiCua(j)) + '</div>'; return; }
      veTongQuan(j);
    } catch (e) { if (id === dangTai) $('mdgBieuDo').innerHTML = '<div class="mdg-trong mdg-rong">Không tải được số liệu. Vui lòng thử lại.</div>'; }
  }
  function kpi(mau, ic, nhan, so, phu, id) { return '<div class="mdg-k' + (id ? ' bam' : '') + '" style="--mau:' + mau + '"' + (id ? ' id="' + id + '"' : '') + '><div class="ic">' + ic + '</div><div class="nh">' + nhan + '</div><div class="so">' + so + '</div><div class="ph">' + phu + '</div></div>'; }
  function veTongQuan(j) {
    var t = j.tong, tot = t.soPhieu ? Math.round(100 * t.soTot / t.soPhieu) : 0;
    $('mdgGhiChu').textContent = t.nghiNgoNgoaiKyThongKe ? 'Số liệu không tính ' + t.nghiNgoNgoaiKyThongKe + ' phiếu bị gắn cờ nghi ngờ (gửi lúc quán đóng cửa, số điện thoại gửi lặp). Xem ở mục Phiếu đánh giá.' : '';
    if (nhieuCN() && !$('mdgCN').value) capNhatCanXL(t.canXuLy);
    $('mdgKpi').innerHTML =
      kpi('var(--pri)', IC.phieu, 'Số phiếu', t.soPhieu, 'trong kỳ đang chọn') +
      kpi('#f5b800', IC.tb, 'Điểm trung bình', t.diemTB == null ? '–' : t.diemTB.toFixed(2), t.diemTB == null ? '&nbsp;' : saoHtml(t.diemTB, 'mdg-sao-nho')) +
      kpi('var(--ok)', IC.vui, 'Hài lòng (4–5 sao)', tot + '%', t.soTot + ' phiếu') +
      kpi('var(--bad)', IC.canh, 'Cần xử lý', t.canXuLy, '≤ 2 sao hoặc có mục nghiêm trọng · bấm để xem', 'mdgKpiXL');
    $('mdgKpiXL').addEventListener('click', function () { $('mdgTT').value = 'can_xu_ly'; chonView('ds'); });
    if (!t.soPhieu) { $('mdgBieuDo').innerHTML = '<div class="mdg-trong mdg-rong">Chưa có đánh giá nào trong kỳ này.</div>'; return; }
    var max = Math.max.apply(null, j.phanBo.map(function (x) { return x.so; })) || 1;
    var pb = j.phanBo.slice().reverse().map(function (x) { return '<div class="mdg-thanh mdg-d' + x.diem + '"><span>' + x.diem + ' ★</span><span class="t"><i style="width:' + Math.round(100 * x.so / max) + '%"></i></span><span class="s">' + x.so + '</span></div>'; }).join('');
    var maxV = Math.max.apply(null, j.topVanDe.map(function (x) { return x.so; })) || 1;
    var vd = j.topVanDe.length ? j.topVanDe.map(function (x) { return '<div class="mdg-thanh vd" style="--nhom:' + (x.nghiemTrong ? '#dc2626' : (MAU_NHOM[x.nhomMa] || '#8b5cf6')) + '"><span class="n" title="' + esc(x.nhom + ': ' + x.ten) + '">' + esc(x.ten) + '</span><span class="t"><i style="width:' + Math.round(100 * x.so / maxV) + '%"></i></span><span class="s">' + x.so + '</span></div>'; }).join('') : '<div class="mdg-trong">Khách chưa nêu vấn đề nào.</div>';
    var cn = '<div style="overflow-x:auto"><table class="mdg-bang"><thead><tr><th>Chi nhánh</th><th class="so">Phiếu</th><th class="so">Điểm TB</th><th class="so">≤2★</th><th class="so">Cần xử lý</th></tr></thead><tbody>' +
      j.theoChiNhanh.map(function (c) { var d = Math.round(c.diemTB); return '<tr class="bam" data-cn="' + esc(c.id) + '"><td>' + esc(c.ten) + '</td><td class="so">' + c.soPhieu + '</td><td class="so"><span class="mdg-diem mdg-dt' + d + '">' + c.diemTB.toFixed(2) + '</span></td><td class="so">' + c.soThap + '</td><td class="so">' + (c.canXuLy ? '<b style="color:var(--bad)">' + c.canXuLy + '</b>' : '0') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $('mdgBieuDo').innerHTML =
      '<div class="mdg-hop"><h3>Phân bố điểm</h3>' + pb + '</div>' +
      '<div class="mdg-hop"><h3>Vấn đề khách nêu nhiều nhất<small>top 15</small></h3>' + vd + '</div>' +
      (nhieuCN() ? '<div class="mdg-hop mdg-rong"><h3>Theo chi nhánh<small>thấp nhất lên đầu · bấm để xem chi tiết</small></h3>' + cn + '</div>' : '') +
      '<div class="mdg-hop mdg-rong"><h3>Diễn biến theo ngày<small>cột = số phiếu · đường = điểm TB</small></h3>' + veXuHuong(j.theoNgay) + '</div>';
    Array.prototype.forEach.call(K.querySelectorAll('tr[data-cn]'), function (r) { r.addEventListener('click', function () { $('mdgCN').value = r.dataset.cn; lam(); window.scrollTo(0, 0); }); });
  }
  function veXuHuong(ds) {
    if (!ds.length) return '<div class="mdg-trong">Không có dữ liệu.</div>';
    var W = 760, H = 190, L = 30, R = 10, T = 12, B = 26, n = ds.length, bw = (W - L - R) / n;
    var maxN = Math.max.apply(null, ds.map(function (d) { return d.soPhieu; })) || 1;
    var y = function (v) { return T + (H - T - B) * (1 - (v - 1) / 4); }, x = function (i) { return L + bw * i + bw / 2; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" role="img" aria-label="Diễn biến điểm trung bình theo ngày">';
    for (var g = 1; g <= 5; g++) s += '<line class="mdg-svg-luoi" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/><text class="mdg-svg-chu" x="' + (L - 6) + '" y="' + (y(g) + 4) + '" font-size="11" text-anchor="end">' + g + '</text>';
    ds.forEach(function (d, i) { var h = (H - T - B) * 0.45 * d.soPhieu / maxN; s += '<rect class="mdg-svg-cot" x="' + (x(i) - Math.max(2, bw * 0.3)) + '" y="' + (H - B - h) + '" width="' + Math.max(4, bw * 0.6) + '" height="' + h + '" rx="3"><title>' + ngayDM(d.ngay) + ': ' + d.soPhieu + ' phiếu</title></rect>'; });
    s += '<polyline class="mdg-svg-duong" fill="none" stroke-width="2.5" stroke-linejoin="round" points="' + ds.map(function (d, i) { return x(i) + ',' + y(d.diemTB); }).join(' ') + '"/>';
    ds.forEach(function (d, i) { s += '<circle cx="' + x(i) + '" cy="' + y(d.diemTB) + '" r="3.5" fill="' + (d.diemTB < 3 ? '#dc2626' : '#f5b800') + '" stroke="#fff" stroke-width="1.5"><title>' + ngayDM(d.ngay) + ': ' + d.diemTB + ' sao</title></circle>'; });
    var buoc = Math.ceil(n / 8);
    ds.forEach(function (d, i) { if (i % buoc === 0 || i === n - 1) s += '<text class="mdg-svg-chu" x="' + x(i) + '" y="' + (H - 8) + '" font-size="11" text-anchor="middle">' + ngayDM(d.ngay) + '</text>'; });
    return s + '</svg>';
  }

  /* ───────────────────────── Danh sách phiếu ───────────────────────── */
  async function taiDs(moi) {
    if (moi) { trang = 1; dsHienTai = []; $('mdgPhieu').innerHTML = '<div class="mdg-cho"><div class="mdg-quay"></div>Đang tải…</div>'; $('mdgThem').hidden = true; }
    var id = ++dangTai;
    try {
      var j = await C.api(Object.assign({ action: 'dg_phieu_list', trang: trang }, boLoc(true)));
      if (id !== dangTai) return;
      if (!j.ok) { $('mdgPhieu').innerHTML = '<div class="mdg-trong">' + esc(loiCua(j)) + '</div>'; return; }
      tong = j.tong; dsHienTai = dsHienTai.concat(j.data); veDs();
    } catch (e) { if (id === dangTai) $('mdgPhieu').innerHTML = '<div class="mdg-trong">Không tải được danh sách. Vui lòng thử lại.</div>'; }
  }
  function veDs() {
    $('mdgDemKq').textContent = tong ? tong + ' phiếu' + (dsHienTai.length < tong ? ' (đang hiện ' + dsHienTai.length + ')' : '') : '';
    $('mdgThem').hidden = dsHienTai.length >= tong;
    if (!dsHienTai.length) { $('mdgPhieu').innerHTML = '<div class="mdg-trong">Không có phiếu nào khớp bộ lọc.</div>'; return; }
    $('mdgPhieu').innerHTML = dsHienTai.map(theHtml).join('');
  }
  function theHtml(p) {
    var m = p.diem <= 2 ? 'thap' : p.diem === 3 ? 'vua' : 'tot';
    var cos = p.coNghiNgo.map(function (c) { return '<span class="mdg-co">⚠ ' + (c === 'ngoai_gio' ? 'Gửi lúc quán đóng cửa' : c === 'sdt_lap' ? 'SĐT gửi lặp' : esc(c)) + '</span>'; }).join('');
    return '<article class="mdg-p ' + m + '" data-ma="' + esc(p.ma) + '">' +
      '<div class="dau"><div><div class="noi">' + esc(p.chiNhanh) + (p.phong ? ' · Phòng ' + esc(p.phong) : '') + '</div><div class="tg">' + gio(p.luc) + ' · ' + esc(p.ma) + '</div></div>' +
      '<div class="phai">' + saoHtml(p.diem, 'mdg-sao') + '<div><span class="mdg-tt mdg-tt-' + p.trangThai + '">' + esc(p.trangThaiTen) + '</span></div></div></div>' +
      (p.vanDe.length ? '<div class="mdg-vds">' + p.vanDe.map(function (v) { return '<span class="mdg-vd' + (v.nghiemTrong ? ' nang' : '') + '">' + esc(v.ten) + (v.nghiemTrong ? ' ❗' : '') + '</span>'; }).join('') + '</div>' : '') +
      (p.chiTiet ? '<div class="mdg-loi"><b>Chi tiết khách ghi</b>' + esc(p.chiTiet) + '</div>' : '') +
      (p.gopY ? '<div class="mdg-loi"><b>Góp ý khác</b>' + esc(p.gopY) + '</div>' : '') +
      (p.anh.length ? '<div class="mdg-anhs">' + p.anh.map(function (u) { return '<button type="button" data-anh="' + esc(u) + '"><img loading="lazy" src="' + esc(u) + '" alt="Ảnh khách gửi"></button>'; }).join('') + '</div>' : '') +
      (p.xuLyBoi && p.trangThai !== 'moi' ? '<div class="mdg-xl"><b>' + esc(p.trangThaiTen) + '</b>' + (p.ghiChuXuLy ? ': ' + esc(p.ghiChuXuLy) : '') + '<small>' + esc(p.xuLyBoi) + ' · ' + gio(p.xuLyLuc) + '</small></div>' : '') +
      (p.lichSu.length > 1 ? '<details class="mdg-ls"><summary>Lịch sử xử lý (' + p.lichSu.length + ')</summary>' + p.lichSu.map(function (l) { return '<div><b>' + esc(l.trangThaiTen) + '</b> — ' + esc(l.nguoi) + ' · ' + gio(l.luc) + (l.ghiChu ? '<br>' + esc(l.ghiChu) : '') + '</div>'; }).join('') + '</details>' : '') +
      '<div class="mdg-chan">' + (/^\d{10}$/.test(p.sdt) ? '<a class="mdg-sdt" href="tel:' + esc(p.sdt) + '"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>' + esc(sdtDep(p.sdt)) + '</a>' : '<span class="mdg-sdt" title="Bạn chưa được cấp quyền xem số điện thoại">' + esc(p.sdt) + '</span>') +
      cos + (p.maSuCo ? '<span class="mdg-tt mdg-tt-da_lien_he">🛠 Sự cố ' + esc(p.maSuCo) + '</span>' : '') +
      (co('DANHGIA.XULY') ? '<button class="btn btn-y btn-sm" style="margin-left:auto" type="button" data-xl="' + esc(p.ma) + '">Ghi nhận xử lý</button>' : '') + '</div></article>';
  }

  /* ───────────────────────── Ghi nhận xử lý ───────────────────────── */
  var xlMa = '', xlTT = '';
  var XL_LUA = [['da_lien_he', 'Đã liên hệ khách'], ['dang_xu_ly', 'Đang xử lý'], ['da_xong', 'Đã xử lý xong'], ['khong_can', 'Không cần xử lý']];
  function moXuLy(ma) {
    var p = dsHienTai.filter(function (x) { return x.ma === ma; })[0]; if (!p) return;
    xlMa = ma; xlTT = p.trangThai === 'moi' ? 'da_lien_he' : p.trangThai;
    $('mdgXlNho').textContent = p.chiNhanh + (p.phong ? ' · Phòng ' + p.phong : '') + ' · ' + p.diem + ' sao · ' + sdtDep(p.sdt);
    $('mdgXlGhi').value = ''; $('mdgXlLoi').textContent = ''; veLua(); $('mdgPhuXL').classList.add('hien'); moPhu('xl');
  }
  function veLua() { $('mdgXlLua').innerHTML = XL_LUA.map(function (l) { return '<button type="button" data-tt="' + l[0] + '" class="' + (xlTT === l[0] ? 'bat' : '') + '">' + l[1] + '</button>'; }).join(''); }
  async function luuXuLy() {
    var ghi = $('mdgXlGhi').value.trim();
    if ((xlTT === 'da_lien_he' || xlTT === 'da_xong') && ghi.length < 3) { $('mdgXlLoi').textContent = LOI.CAN_GHI_CHU; return; }
    $('mdgXlLuu').disabled = true; $('mdgXlLoi').textContent = '';
    try {
      var j = await C.api({ action: 'dg_xuly', ma: xlMa, trangThai: xlTT, ghiChu: ghi });
      if (!j.ok) { $('mdgXlLoi').textContent = LOI[j.error] || 'Không lưu được, vui lòng thử lại.'; return; }
      var p = dsHienTai.filter(function (x) { return x.ma === xlMa; })[0];
      if (p) {
        var s = C.phien() || {}, ten = s.fullName || s.user || '';
        p.trangThai = xlTT; p.trangThaiTen = TT_TEN[xlTT]; p.xuLyBoi = ten; p.xuLyLuc = j.xuLyLuc; if (ghi) p.ghiChuXuLy = ghi;
        p.lichSu.unshift({ luc: j.xuLyLuc, nguoi: ten, trangThai: xlTT, trangThaiTen: TT_TEN[xlTT], ghiChu: ghi });
      }
      dongPhu(); veDs(); toast('Đã lưu xử lý', 'ok');
      taiDanhMuc();
    } catch (e) { $('mdgXlLoi').textContent = 'Mạng đang chập chờn, vui lòng bấm lưu lại.'; }
    finally { $('mdgXlLuu').disabled = false; }
  }

  /* ───────────────────────── Xuất Excel (thư viện nạp lười của vỏ) ───────────────────────── */
  var VIEN = { top: { style: 'thin', color: { rgb: 'D9CCEE' } }, bottom: { style: 'thin', color: { rgb: 'D9CCEE' } }, left: { style: 'thin', color: { rgb: 'D9CCEE' } }, right: { style: 'thin', color: { rgb: 'D9CCEE' } } };
  function oHead(v) { return { v: v, t: 's', s: { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '4B1E78' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: VIEN } }; }
  function oTxt(v, extra) { return { v: v == null ? '' : String(v), t: 's', s: Object.assign({ alignment: { vertical: 'top', wrapText: true }, border: VIEN, font: { sz: 10.5 } }, extra || {}) }; }
  function oSo(v, extra) { return { v: v, t: 'n', s: Object.assign({ alignment: { horizontal: 'center', vertical: 'top' }, border: VIEN, font: { sz: 10.5 } }, extra || {}) }; }
  function nhomTxt(p, ten) { return p.vanDe.filter(function (v) { return v.nhom === ten; }).map(function (v) { return v.ten; }).join('; '); }
  function soDong(txt, rong) { var d = 0; String(txt || '').split('\n').forEach(function (l) { d += Math.max(1, Math.ceil(l.length / Math.max(1, rong))); }); return d; }
  async function xuatExcel() {
    var btn = $('mdgExcel'), goc = btn.textContent; btn.disabled = true; btn.textContent = 'Đang tạo file…';
    try {
      await C.napXLSX();
      var j = await C.api(Object.assign({ action: 'dg_phieu_list', xuat: true }, boLoc(true)));
      if (!j.ok) { toast(loiCua(j), 'bad'); return; }
      if (!j.data.length) { toast('Không có phiếu nào để xuất'); return; }
      var cot = [['Mã phiếu', 13], ['Thời gian', 16], ['Chi nhánh', 18], ['Phòng', 8], ['Điểm', 7], ['Số điện thoại', 14], ['Phục vụ', 28], ['Vệ sinh phòng', 28], ['Âm thanh / thiết bị', 28], ['Nhà vệ sinh', 26],
        ['Chi tiết khách ghi', 40], ['Góp ý khác', 34], ['Số ảnh', 7], ['Phiếu nghi ngờ', 16], ['Trạng thái xử lý', 16], ['Người xử lý', 16], ['Thời gian xử lý', 16], ['Ghi chú xử lý', 38], ['Mã sự cố bảo trì', 16]];
      var rows = [cot.map(function (c) { return oHead(c[0]); })], hs = [{ hpt: 32 }];
      j.data.forEach(function (p) {
        var thap = p.diem <= 2 ? { fill: { fgColor: { rgb: 'FDECEC' } }, font: { bold: true, color: { rgb: 'B91C1C' }, sz: 10.5 } } : null;
        var cells = [oTxt(p.ma), oTxt(gio(p.luc).replace(' · ', ' ')), oTxt(p.chiNhanh), oTxt(p.phong), oSo(p.diem, thap), oTxt(p.sdt),
          oTxt(nhomTxt(p, 'Phục vụ')), oTxt(nhomTxt(p, 'Vệ sinh phòng')), oTxt(nhomTxt(p, 'Âm thanh')), oTxt(nhomTxt(p, 'Nhà vệ sinh')),
          oTxt(p.chiTiet), oTxt(p.gopY), oSo(p.anh.length), oTxt(p.coNghiNgo.map(function (c) { return c === 'ngoai_gio' ? 'Gửi lúc quán đóng cửa' : c === 'sdt_lap' ? 'SĐT gửi lặp' : c; }).join('; ')),
          oTxt(p.trangThai === 'moi' ? 'Mới' : p.trangThaiTen), oTxt(p.xuLyBoi), oTxt(gio(p.xuLyLuc).replace(' · ', ' ')), oTxt(p.ghiChuXuLy), oTxt(p.maSuCo)];
        rows.push(cells);
        var dong = 1; cells.forEach(function (c, i) { dong = Math.max(dong, soDong(c.v, cot[i][1] * 1.05)); });
        hs.push({ hpt: Math.min(dong, 6) * 14.5 + 4 });   // tối đa ~6 dòng mỗi hàng
      });
      var ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = cot.map(function (c) { return { wch: c[1] }; }); ws['!rows'] = hs;
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }; ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: cot.length - 1 } }) };
      var tgop = {}; j.data.forEach(function (p) { if (p.coNghiNgo.length) return; var t = tgop[p.chiNhanh] = tgop[p.chiNhanh] || { n: 0, s: 0, thap: 0 }; t.n++; t.s += p.diem; if (p.diem <= 2) t.thap++; });
      var r2 = [['Chi nhánh', 'Số phiếu', 'Điểm trung bình', 'Số phiếu ≤ 2 sao'].map(oHead)];
      Object.keys(tgop).sort(function (a, b) { return (tgop[a].s / tgop[a].n) - (tgop[b].s / tgop[b].n); }).forEach(function (k) { var t = tgop[k]; r2.push([oTxt(k), oSo(t.n), oSo(Math.round(100 * t.s / t.n) / 100), oSo(t.thap)]); });
      var ws2 = XLSX.utils.aoa_to_sheet(r2); ws2['!cols'] = [{ wch: 26 }, { wch: 11 }, { wch: 16 }, { wch: 18 }]; ws2['!rows'] = [{ hpt: 30 }];
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Đánh giá'); XLSX.utils.book_append_sheet(wb, ws2, 'Theo chi nhánh');
      XLSX.writeFile(wb, 'danh-gia-khach-hang_' + ymd(new Date()) + '.xlsx'); toast('Đã xuất ' + j.data.length + ' phiếu', 'ok');
    } catch (e) { toast('Không xuất được file, vui lòng thử lại', 'bad'); }
    finally { btn.disabled = false; btn.textContent = goc; }
  }

  /* ═══════════════════════════ MÃ QR ĐÁNH GIÁ ═══════════════════════════
     3 loại: theo phòng (tem dán phòng) · theo chi nhánh (quầy/standee, hoặc chi nhánh chưa có danh sách phòng)
     · chung toàn chuỗi (poster/mạng xã hội). Mã do máy chủ sinh ngẫu nhiên; ĐỔI mã làm tem đã in hết dùng. */
  var QR_DS = [], QR_THIEU = [], QR_CN = '', QR_CN_DS = [], _qrLib = null;
  function napQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (_qrLib) return _qrLib;
    _qrLib = new Promise(function (ok, loi) { var s = document.createElement('script'); s.src = 'dg/qrcode.js'; s.onload = function () { ok(); }; s.onerror = function () { _qrLib = null; loi(new Error('QR_LIB')); }; document.head.appendChild(s); });
    return _qrLib;
  }
  function qrDoi(text) { var q = window.qrcode(0, 'Q'); q.addData(text); q.make(); return q; }
  function qrSvg(text) {
    var q = qrDoi(text), n = q.getModuleCount(), d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="Mã QR"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function ql() { return co('DANHGIA.QR_QUANLY'); }
  async function moQr() {
    var xem = Q['DANHGIA.QR_XEM'];
    $('mdgTaoLoat').hidden = !ql();
    if (!QR_CN_DS.length) {
      if (xem.tatCa) QR_CN_DS = (C.chiNhanh() || []).slice();
      if (!QR_CN_DS.length && !xem.tatCa) QR_CN_DS = xem.chiNhanh.slice();
      QR_CN_DS.sort(function (a, b) { return a.ten.localeCompare(b.ten, 'vi'); });
      $('mdgQrCN').innerHTML = QR_CN_DS.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.ten) + '</option>'; }).join('');
      if (!QR_CN && QR_CN_DS.length) QR_CN = QR_CN_DS[0].id;
    }
    $('mdgQrCN').value = QR_CN;
    $('mdgQrVung').innerHTML = '<div class="mdg-cho"><div class="mdg-quay"></div>Đang tải…</div>';
    try { await napQrLib(); } catch (e) { $('mdgQrVung').innerHTML = '<div class="mdg-trong">Không tải được bộ tạo mã QR. Kiểm tra mạng rồi mở lại.</div>'; return; }
    taiQr();
  }
  async function taiQr() {
    try {
      var j = await C.api({ action: 'dg_qr_list' });
      if (!j || !j.ok) { $('mdgQrVung').innerHTML = '<div class="mdg-trong">' + esc(loiCua(j)) + '</div>'; return; }
      QR_DS = j.data; QR_THIEU = j.phongChuaCoMa || [];
      veQr();
    } catch (e) { $('mdgQrVung').innerHTML = '<div class="mdg-trong">Không kết nối được. Vui lòng thử lại.</div>'; }
  }
  function tenQr(x) { return x.loai === 'phong' ? 'Phòng ' + x.phong : x.loai === 'chi_nhanh' ? 'Chi nhánh ' + x.chiNhanh : 'Toàn chuỗi'; }
  function tenTem(x) { return x.loai === 'phong' ? 'Phòng ' + String(x.phong).replace(/^Phòng\s*/i, '') : x.loai === 'chi_nhanh' ? 'Quét mã để đánh giá' : 'Boom Music Box'; }
  function phuTem(x) { return x.loai === 'chung' ? 'Chọn chi nhánh khi quét' : 'Boom Music Box · ' + x.chiNhanh; }
  function thongTin(x) { return x.soLanQuet ? 'Quét ' + x.soLanQuet + ' lần' + (x.quetCuoi ? ' · gần nhất ' + gioNgan(x.quetCuoi) : '') : 'Chưa có lượt quét'; }
  function theQr(x) {
    return '<article class="mdg-qr" data-ma="' + esc(x.ma) + '"><div class="ma">' + qrSvg(x.link) + '</div><b>' + esc(tenQr(x)) + '</b><small>' + esc(thongTin(x)) + '</small><div class="hanh">' +
      '<button class="btn btn-ghost" type="button" data-a="lon">Phóng to</button><button class="btn btn-ghost" type="button" data-a="png">Tải ảnh</button><button class="btn btn-ghost" type="button" data-a="link">Chép link</button><button class="btn btn-ghost" type="button" data-a="tv" title="Link để mở trên màn hình TV">Màn hình TV</button>' +
      (ql() ? '<button class="btn btn-ghost" type="button" data-a="doi">Đổi mã</button><button class="btn btn-bad" type="button" data-a="thu">Thu hồi</button>' : '') + '</div></article>';
  }
  function veQr() {
    if (!window.qrcode) return;
    var tatCa = Q['DANHGIA.QR_XEM'].tatCa, h = '', quanLy = ql();
    var cnTen = (QR_CN_DS.filter(function (c) { return c.id === QR_CN; })[0] || {}).ten || '';
    if (tatCa) {
      var chung = QR_DS.filter(function (x) { return x.loai === 'chung'; });
      h += '<section class="mdg-muc"><h3>🌐 Mã chung toàn chuỗi</h3><p>Một mã cho cả chuỗi — khách tự chọn chi nhánh và phòng. Dùng cho poster, mạng xã hội, màn hình quảng cáo.</p><div class="mdg-qrluoi">' +
        (chung.length ? chung.map(theQr).join('') : '<div class="mdg-qr trong">Chưa có mã chung' + (quanLy ? '<button class="btn btn-y btn-sm" type="button" data-tao="chung">Tạo mã chung</button>' : '') + '</div>') + '</div></section>';
    }
    var cn = QR_DS.filter(function (x) { return x.loai === 'chi_nhanh' && x.chiNhanhId === QR_CN; });
    h += '<section class="mdg-muc"><h3>🏠 Mã chi nhánh — ' + esc(cnTen) + '</h3><p>Một mã cho cả chi nhánh — khách chọn hoặc ghi số phòng. Dùng cho quầy lễ tân, bàn ghế, standee; hoặc chi nhánh chưa có danh sách phòng.</p><div class="mdg-qrluoi">' +
      (cn.length ? cn.map(theQr).join('') : '<div class="mdg-qr trong">Chưa có mã chi nhánh' + (quanLy ? '<button class="btn btn-y btn-sm" type="button" data-tao="chi_nhanh">Tạo mã chi nhánh</button>' : '') + '</div>') + '</div></section>';
    var ph = QR_DS.filter(function (x) { return x.loai === 'phong' && x.chiNhanhId === QR_CN; }).sort(function (a, b) { return String(a.phong).localeCompare(String(b.phong), 'vi', { numeric: true }); });
    var thieu = QR_THIEU.filter(function (x) { return x.chiNhanhId === QR_CN; });
    h += '<section class="mdg-muc"><h3>🚪 Mã theo phòng <span class="so">' + ph.length + ' phòng</span></h3><p>Mỗi phòng một mã — in tem dán tại phòng (hoặc hiển thị trên TV của phòng). Phản hồi biết đúng phòng nào, không cần khách ghi.</p>';
    if (thieu.length) h += '<div class="mdg-ghi">Còn <b>' + thieu.length + '</b> phòng chưa có mã: ' + esc(thieu.map(function (x) { return x.ten; }).join(', ')) + '.' + (quanLy ? ' Bấm “Tạo mã cho phòng còn thiếu”.' : '') + '</div>';
    if (!ph.length && !thieu.length) h += '<div class="mdg-ghi">Chi nhánh này <b>chưa có danh sách phòng</b> trong hệ thống — hãy dùng mã chi nhánh ở trên (khách tự ghi số phòng), hoặc nhờ IT nhập danh sách phòng rồi quay lại đây.</div>';
    h += '<div class="mdg-qrluoi">' + ph.map(theQr).join('') + '</div></section>';
    $('mdgQrVung').innerHTML = h;
    $('mdgInCN').hidden = !ph.length && !cn.length;
    $('mdgTaoLoat').disabled = !thieu.length && !!cn.length;
  }
  function timQr(ma) { return QR_DS.filter(function (x) { return x.ma === ma; })[0]; }
  function linkTv(x) { return new URL('dg/qr.html?hien=' + encodeURIComponent(x.ma) + '&ten=' + encodeURIComponent(x.loai === 'phong' ? 'Phòng ' + x.phong + ' · ' + x.chiNhanh : x.loai === 'chi_nhanh' ? x.chiNhanh : 'Boom Music Box'), location.href).href; }
  function chep(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { toast('Đã chép', 'ok'); }, function () { toast(t); });
    var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); toast('Đã chép', 'ok'); } catch (e) { toast(t); } a.remove();
  }
  async function taoMa(loai, phongId) {
    try {
      var j = await C.api({ action: 'dg_qr_tao', loai: loai, chiNhanhId: loai === 'chung' ? '' : QR_CN, phongId: phongId || '' });
      if (j && j.ok) { toast('Đã tạo mã mới', 'ok'); await taiQr(); } else toast('Không tạo được mã (' + ((j && j.error) || 'lỗi') + ')', 'bad');
    } catch (e) { toast('Không kết nối được', 'bad'); }
  }
  async function bamQr(e) {
    var t = e.target.closest('[data-tao]'); if (t) return taoMa(t.dataset.tao);
    var b = e.target.closest('[data-a]'); if (!b) return;
    var x = timQr(b.closest('.mdg-qr').dataset.ma); if (!x) return; var a = b.dataset.a;
    if (a === 'lon') return phongTo(x);
    if (a === 'png') return taiPng(x);
    if (a === 'link') return chep(x.link);
    if (a === 'tv') return chep(linkTv(x));
    if (a === 'doi') {
      if (!confirm('Đổi mã cho ' + tenQr(x) + '?\n\nTem đã in với mã CŨ sẽ KHÔNG còn dùng được — phải in và dán tem mới.')) return;
      return taoMa(x.loai, x.phongId);
    }
    if (a === 'thu') {
      if (!confirm('Thu hồi mã của ' + tenQr(x) + '?\n\nQuét mã này sẽ báo “mã không còn dùng”. Tem đã in sẽ vô hiệu.')) return;
      try { var j = await C.api({ action: 'dg_qr_thuhoi', ma: x.ma }); if (j && j.ok) { toast('Đã thu hồi', 'ok'); taiQr(); } else toast('Không thu hồi được', 'bad'); } catch (er) { toast('Không kết nối được', 'bad'); }
    }
  }
  async function taoLoat() {
    var btn = $('mdgTaoLoat'); btn.disabled = true;
    try {
      var j = await C.api({ action: 'dg_qr_tao_loat', chiNhanhId: QR_CN });
      if (j && j.ok) { toast('Đã tạo ' + j.soPhong + ' mã phòng' + (j.taoChiNhanh ? ' + mã chi nhánh' : ''), 'ok'); await taiQr(); } else toast('Không tạo được (' + ((j && j.error) || 'lỗi') + ')', 'bad');
    } catch (er) { toast('Không kết nối được', 'bad'); } finally { btn.disabled = false; veQr(); }
  }
  function phongTo(x) {
    $('mdgQrHop').innerHTML = '<div class="mdg-qrlon">' + qrSvg(x.link) + '</div><h3 style="margin:4px 0 0">' + esc(tenQr(x)) + '</h3><p class="nho" style="word-break:break-all">' + esc(x.chiNhanh || '') + '<br>' + esc(x.link) + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px"><button class="btn btn-y btn-sm" type="button" data-k="png">Tải ảnh</button><button class="btn btn-ghost btn-sm" type="button" data-k="in">In tem này</button><button class="btn btn-ghost btn-sm" type="button" data-k="tv">Mở trên TV</button><button class="btn btn-ghost btn-sm" type="button" data-k="dong">Đóng</button></div>';
    $('mdgQrHop').onclick = function (e) {
      var k = e.target.closest('[data-k]'); if (!k) return;
      var a = k.dataset.k;
      if (a === 'dong') dongPhu(); else if (a === 'png') taiPng(x); else if (a === 'in') { dongPhu(); inTem([x]); } else if (a === 'tv') window.open(linkTv(x), '_blank');
    };
    $('mdgPhuQR').classList.add('hien'); moPhu('qr');
  }
  function taiPng(x) {
    var W = 900, H = 1100, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    function rr(px, py, w, h, r) { g.beginPath(); g.moveTo(px + r, py); g.arcTo(px + w, py, px + w, py + h, r); g.arcTo(px + w, py + h, px, py + h, r); g.arcTo(px, py + h, px, py, r); g.arcTo(px, py, px + w, py, r); g.closePath(); }
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.lineWidth = 8; g.strokeStyle = '#5b21a6'; rr(24, 24, W - 48, H - 48, 48); g.stroke();
    g.textAlign = 'center'; g.fillStyle = '#5b21a6'; g.font = '700 58px "Be Vietnam Pro",system-ui,sans-serif'; g.fillText('ĐÁNH GIÁ DỊCH VỤ', W / 2, 120);
    var q = qrDoi(x.link), n = q.getModuleCount(), ce = Math.floor(640 / n), kt = ce * n, ox = Math.round((W - kt) / 2), oy = 170;
    g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect(ox + k * ce, oy + r * ce, ce, ce);
    g.fillStyle = '#22163a'; g.font = '700 84px "Be Vietnam Pro",system-ui,sans-serif'; g.fillText(tenTem(x), W / 2, oy + kt + 130);
    g.fillStyle = '#6b5f80'; g.font = '500 40px "Be Vietnam Pro",system-ui,sans-serif'; g.fillText(phuTem(x), W / 2, oy + kt + 195);
    g.font = '500 34px "Be Vietnam Pro",system-ui,sans-serif'; g.fillText('Quét mã để chấm điểm và góp ý', W / 2, oy + kt + 250);
    c.toBlob(function (bl) {
      var u = URL.createObjectURL(bl), a = document.createElement('a'); a.href = u;
      a.download = 'QR-danh-gia-' + String(x.loai === 'phong' ? x.phong : x.loai === 'chi_nhanh' ? x.chiNhanh : 'chung').replace(/[^\wÀ-ỹ-]+/g, '-') + '.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
    }, 'image/png');
  }
  function inTem(ds) {
    $('mdgIn').innerHTML = ds.map(function (x) {
      return '<div class="mdg-tem"><div class="t1">ĐÁNH GIÁ DỊCH VỤ</div><div class="q">' + qrSvg(x.link) + '</div><div class="t2">' + esc(tenTem(x)) + '</div><div class="t3">' + esc(phuTem(x)) + '<br>Quét mã để chấm điểm và góp ý</div></div>';
    }).join('');
    document.body.classList.add('mdg-dang-in');
    var xong = function () { document.body.classList.remove('mdg-dang-in'); window.removeEventListener('afterprint', xong); };
    window.addEventListener('afterprint', xong);
    try { window.print(); } catch (e) { xong(); toast('Thiết bị này không in trực tiếp được — dùng "Tải ảnh" hoặc in từ máy tính.', 'bad'); }
    setTimeout(function () { if (document.body.classList.contains('mdg-dang-in') && !window.matchMedia('print').matches) xong(); }, 1500);
  }
  function inCaCN() {
    var ds = QR_DS.filter(function (x) { return x.chiNhanhId === QR_CN && (x.loai === 'phong' || x.loai === 'chi_nhanh'); })
      .sort(function (a, b) { return (a.loai === b.loai ? 0 : a.loai === 'phong' ? -1 : 1) || String(a.phong || '').localeCompare(String(b.phong || ''), 'vi', { numeric: true }); });
    if (!ds.length) return toast('Chưa có mã để in');
    inTem(ds);
  }

  /* ───────────────────────── Đăng ký với vỏ ───────────────────────── */
  window.BMB_MOD = window.BMB_MOD || {};
  window.BMB_MOD.danhgia = {
    mo: mo,
    dongKhiBack: function () { if (!MO) return false; dongPhu(true); return true; }   // vỏ gọi khi bấm Back của điện thoại
  };
})();
