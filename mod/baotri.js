/* ════════════════════════════════════════════════════════════════════════════════════════════════
   MODULE "BẢO TRÌ · SỰ CỐ" — tách khỏi admin.html ngày 24/11/2026 (đợt 4), kiến trúc "một vỏ, nhiều module".

   Phân chia với vỏ (admin.html):
     - VỎ giữ: dữ liệu sự cố SUCO + tải định kỳ/delta (loadSuCo, xuLySuCoSauKhiTai), số đếm trên tab, chuông & thông
       báo, vị trí GPS kỹ thuật (chạy nền), bộ tiện ích DÙNG CHUNG: nén ảnh, camera trong app, xem ảnh, nút Back
       điện thoại (moModalCoBack…), khung modal Lịch sử (#modalOverlay). Tổng quan (admin) cũng ở vỏ.
     - MODULE giữ: giao diện trang Sự cố (HTML + CSS dưới đây), danh sách / Bảng / Kanban / Bản đồ, báo & sửa sự cố,
       lịch sử & trao đổi, tiếp nhận / điều phối / nhận việc / báo xong / xác nhận / đóng / xoá / khôi phục,
       xuất CSV/Excel, lọc chi nhánh cho kỹ thuật.
   KHÁC module Đánh giá/Đặt phòng: file này là SCRIPT THƯỜNG (không bọc IIFE) — các hàm vẫn là hàm toàn cục như khi
   còn nằm trong admin.html, vì nút trong HTML gọi thẳng tên hàm (onclick="tiepNhan(...)"), Tổng quan và link
   Telegram (?ticket=) của vỏ cũng gọi vào. Vỏ NẠP file này NGAY KHI ĐĂNG NHẬP nếu tài khoản thấy được Bảo trì
   (kỹ thuật hoặc quyền BAOTRI.XEM) — trước khi vẽ gì; tài khoản không có quyền (vd giám sát) không bao giờ tải.
   Vỏ chỉ gọi hàm module khi coModBaoTri() = true. Sửa file này nhớ tăng MOD_VER trong admin.html.
   ════════════════════════════════════════════════════════════════════════════════════════════════ */

/* ── Giao diện: CSS + khung HTML trang Sự cố (chuyển nguyên văn từ admin.html), gắn vào khung #baotri của vỏ ── */
const BT_CSS = "/* ── BẢO TRÌ ── */\n.pri{padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;vertical-align:middle;white-space:nowrap;display:inline-block}\n.pri-1{background:var(--bad-bg);color:var(--bad)}\n.pri-2{background:var(--warn-bg);color:var(--warn)}\n.pri-3{background:var(--mid-bg);color:var(--mid)}\n.pri-4{background:var(--ok-bg);color:var(--ok)}\n.pri-btn{padding:9px 16px;min-height:42px;border-radius:12px;font-size:13.5px;font-weight:700;cursor:pointer;\n  background:var(--surface);transition:transform .12s ease,box-shadow .12s ease,opacity .12s ease;white-space:nowrap}\n.pri-btn:not(.on){opacity:.6}\n.pri-btn.on{opacity:1;transform:scale(1.05);box-shadow:0 8px 18px -10px rgba(0,0,0,.5);color:var(--on-sem)}\n.pri-btn-1{border:1.5px solid var(--bad);color:var(--bad)} .pri-btn-1.on{background:var(--bad)}\n.pri-btn-2{border:1.5px solid var(--warn);color:var(--warn)} .pri-btn-2.on{background:var(--warn)}\n.pri-btn-3{border:1.5px solid var(--mid);color:var(--mid)} .pri-btn-3.on{background:var(--mid)}\n.pri-btn-4{border:1.5px solid var(--ok);color:var(--ok)} .pri-btn-4.on{background:var(--ok)}\n.st-pill{padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;background:var(--surface2);\n  color:var(--txt-dim);border:1px solid var(--line);white-space:nowrap;display:inline-block}\n.sc{background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);\n  border-radius:16px;padding:15px 17px 15px 19px;position:relative;overflow:hidden;margin-bottom:11px}\n.sc::before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--txt-mute)}\n.sc[data-p=\"1\"]::before{background:var(--bad)} .sc[data-p=\"2\"]::before{background:var(--warn)}\n.sc[data-p=\"3\"]::before{background:var(--mid)} .sc[data-p=\"4\"]::before{background:var(--ok)}\n.sc.sc-highlight{outline:2px solid var(--pri);box-shadow:0 0 0 6px var(--sel)}\n.sc-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-bottom:9px}\n.sc-name{font-family:'Baloo 2','Be Vietnam Pro',sans-serif;font-size:17px;font-weight:700;line-height:1.35}\n.sc-grid{display:grid;gap:6px 20px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));font-size:13.5px;margin-bottom:10px}\n.sc-grid .r{display:flex;gap:7px} .sc-grid .r i{font-style:normal;color:var(--txt-mute);min-width:70px}\n.sc-photos{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:11px}\n/* Kỹ thuật (14/11/2026): mô tả + ảnh nhỏ ngay trên Bảng/Kanban/Bản đồ để cân nhắc có tự nhận được không */\n.ct-mt{font-size:12.5px;line-height:1.4;color:var(--txt-mute);margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}\n.ct-anh{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}\n.ct-anh img,.ct-anh .ct-them{width:46px;height:46px;border-radius:8px;border:1px solid var(--line);flex:none}\n.ct-anh img{object-fit:cover;cursor:pointer;display:block}\n.ct-anh .ct-them{display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--txt-mute);background:var(--surface2)}\n#viewSuCoTable .bs-ct .ct-mt{display:none}\n.sc-photos a img,.sc-photos img{width:74px;height:74px;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block;cursor:pointer}\n.sc-act{display:flex;gap:8px;flex-wrap:wrap}\n.sc-flag{font-size:12px;color:var(--bad);font-weight:700;margin-bottom:8px}\n/* bước kế tiếp nổi bật (kỹ thuật / quản lý): 1 nút to + thanh 3 bước */\n.sc-buoc{display:flex;flex-direction:column;gap:6px;margin:2px 0 12px}\n.sc-buoc .steps{display:flex;gap:4px}\n.sc-buoc .steps i{flex:1;height:6px;border-radius:6px;background:var(--line)}\n.sc-buoc .steps i.on{background:var(--pri)}\n.sc-buoc .lbl{display:flex;justify-content:space-between;font-size:11.5px;color:var(--txt-mute);font-weight:600}\n.sc-chinh{margin-bottom:10px;max-width:560px}\n.sc-chinh .btn{width:100%}\n.nhom-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-mute);margin:6px 2px 10px}\n.nhom-h:not(:first-child){margin-top:20px}\n.nhom-h .st-pill{text-transform:none;letter-spacing:0}\n/* hộp \"Báo sự cố mới\" to cho quản lý chi nhánh */\n.cta-bao{display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;margin-bottom:16px;border-radius:18px;border:0;cursor:pointer;\n  background:var(--hdr);color:var(--hdr-txt);text-align:left;box-shadow:var(--shadow)}\n.cta-bao .ic{width:46px;height:46px;border-radius:14px;background:var(--acc);color:var(--on-acc);display:grid;place-items:center;flex:none}\n.cta-bao b{display:block;font-size:17px;font-family:'Baloo 2','Be Vietnam Pro',sans-serif}\n.cta-bao span{font-size:12.5px;opacity:.85}\n:root[data-palette=\"troi\"]:not([data-theme=\"dark\"]) .cta-bao{background:var(--pri);color:var(--on-pri)}\n/* Trao đổi theo sự cố */\n.td-dem{display:inline-block;min-width:18px;padding:0 6px;margin-left:2px;border-radius:999px;background:var(--acc);color:var(--on-acc);font-size:11px;font-weight:800;line-height:18px;text-align:center}\n.ls-item.td .ls-dot{background:var(--ok)}\n.td-bong{margin-top:4px;padding:8px 11px;border-radius:12px;background:var(--ok-bg);border:1px solid color-mix(in srgb,var(--ok) 30%,transparent);font-size:13px;white-space:pre-wrap;word-break:break-word}\n.td-bong .sc-photos{margin:8px 0 0}\n.td-khung{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}\n.td-khung textarea{width:100%;padding:11px 13px;border-radius:12px;background:var(--input-bg);border:1.5px solid var(--line);color:inherit;font:inherit;font-size:14px;resize:vertical}\n.td-khung textarea:focus{border-color:var(--pri);outline:none}\n.td-khung .td-mo{font-size:12px;color:var(--txt-mute);margin:2px 0 8px;line-height:1.5}\n/* Kanban (admin) */\n.kb-wrap{display:flex;align-items:stretch;gap:12px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;\n  height:max(440px,calc(100vh - 120px));height:max(440px,calc(100dvh - 120px))}   /* cao gần hết màn hình: không còn khoảng trống dưới bảng */\n.kb-cot{flex:1 1 290px;min-width:260px;scroll-snap-align:start;background:var(--surface2);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;min-height:0}\n.kb-top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-bottom:12px}\n.kb-top h3{font-size:17px}\n.kb-top .toolbar{margin:0;flex:1 1 auto;min-width:0}\n/* Chế độ Kanban: dùng hết bề ngang, bỏ khung thẻ lồng nhau (cột đã có khung riêng) */\nbody.kb-mode .wrap.panel{max-width:min(2600px,100%)}\n#viewSuCoKanban>.form-card{background:none;border:0;box-shadow:none;border-radius:0;padding:0;margin:0}\n@media(max-width:767px){\n  .kb-wrap{margin-inline:-16px;padding-inline:16px;scroll-padding-inline:16px;height:max(420px,calc(100vh - 170px - env(safe-area-inset-bottom,0px)));height:max(420px,calc(100dvh - 170px - env(safe-area-inset-bottom,0px)))}\n  .kb-cot{flex:0 0 min(86vw,340px)}\n}\n.kb-cot>header{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px;margin-bottom:4px}\n.kb-goiy{font-size:11.5px;color:var(--txt-mute);margin-bottom:8px}\n.kb-ds{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:9px;padding-right:2px}\n.kb-trong{color:var(--txt-mute);font-size:12.5px;text-align:center;padding:14px 0}\n.kb-the{position:relative;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--txt-mute);border-radius:12px;padding:10px 11px;font-size:12.5px;cursor:pointer;box-shadow:var(--shadow-sm)}\n.kb-the[data-p=\"1\"]{border-left-color:var(--bad)} .kb-the[data-p=\"2\"]{border-left-color:var(--warn)}\n.kb-the[data-p=\"3\"]{border-left-color:var(--mid)} .kb-the[data-p=\"4\"]{border-left-color:var(--ok)}\n.kb-the:hover{border-color:var(--pri)}\n.kb-dau{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px}\n.kb-cn{font-weight:700;font-size:13.5px}\n.kb-phu{color:var(--txt-dim);margin-top:2px}\n.kb-tg{color:var(--txt-mute);margin-top:5px;display:flex;flex-wrap:wrap;gap:5px;align-items:center}\n.kb-act{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}\n.kb-act .btn{padding:5px 10px;min-height:32px;font-size:12px}\n/* Ghim chi nhánh (12/11/2026): tô sáng mọi phiếu cùng chi nhánh ở TẤT CẢ các cột, phiếu khác chỉ mờ đi (không ẩn → không sót) */\n.kb-cn-b{border-bottom:1px dashed var(--txt-mute);cursor:pointer}\n.kb-cn-b:hover{color:var(--pri);border-bottom-color:var(--pri)}\n.kb-lk{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 8px;border-radius:99px;border:1px solid var(--line);background:var(--surface2);color:var(--pri);font:700 11.5px/1.5 inherit;cursor:pointer;vertical-align:1px}\n.kb-lk:hover{border-color:var(--pri)}\n.kb-ghim{display:none;align-items:center;flex-wrap:wrap;gap:6px 8px;margin:-2px 0 10px;padding:7px 10px;border:1px solid var(--pri);border-radius:12px;background:var(--surface);font-size:12.5px}\n.kb-ghim b{font-size:13.5px}\n.kb-ghim .kb-gc{padding:2px 9px;border-radius:99px;border:1px solid var(--line);background:var(--surface2);color:var(--txt);font:600 12px/1.5 inherit;cursor:pointer}\n.kb-ghim .kb-gc:hover{border-color:var(--pri);color:var(--pri)}\n.kb-ghim .kb-bo{margin-left:auto;padding:2px 10px;border-radius:99px;border:1px solid var(--line);background:none;color:var(--txt-mute);font:600 12px/1.5 inherit;cursor:pointer}\n#viewSuCoKanban.co-ghim .kb-ghim{display:flex}\n#viewSuCoKanban.co-ghim .kb-wrap{height:max(400px,calc(100vh - 168px));height:max(400px,calc(100dvh - 168px))}\n.kb-wrap.ghim .kb-the{opacity:.4;transition:opacity .15s}\n.kb-wrap.ghim .kb-the.cung{opacity:1;outline:2px solid var(--pri);outline-offset:1px;box-shadow:0 0 0 4px color-mix(in srgb,var(--pri) 18%,transparent)}\n@media(max-width:767px){\n  #viewSuCoKanban.co-ghim .kb-wrap{height:max(380px,calc(100vh - 218px - env(safe-area-inset-bottom,0px)));height:max(380px,calc(100dvh - 218px - env(safe-area-inset-bottom,0px)))}\n}\n/* điện thoại: Bảng chỉ giữ cột chính (Trạng thái · Chi nhánh · Lỗi · Hành động; mức độ xem ở Danh sách/Kanban) cho khỏi cuộn ngang nhiều */\n@media(max-width:600px){\n  #viewSuCoTable :is(th,td):is(:nth-child(1),:nth-child(2),:nth-child(3),:nth-child(7),:nth-child(8)){display:none}\n  #viewSuCoTable td .st-pill{white-space:normal;display:inline-block;padding:4px 8px;font-size:11px;line-height:1.25;border-radius:12px;text-align:center}\n  #viewSuCoTable .tblwrap{padding:2px 6px}\n  #viewSuCoTable :is(th,td){padding:9px 6px;font-size:12.5px}\n  #viewSuCoTable th{font-size:10.5px;letter-spacing:.02em}\n  #viewSuCoTable td .btn-sm{padding:6px 9px;min-height:34px;font-size:12px}\n  #viewSuCoTable .bs-ct .ct-mt{display:-webkit-box}\n}";
const BT_HTML = "    <button type=\"button\" class=\"cta-bao\" id=\"ctaBaoSuCo\" style=\"display:none\" onclick=\"openTaoSuCo()\">\n      <span class=\"ic\"><svg class=\"i\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg></span>\n      <span><b>Báo sự cố mới</b><span>Chụp ảnh, chọn loại lỗi — kỹ thuật nhận ngay</span></span>\n    </button>\n    <div class=\"stats\" id=\"statsSuCo\"></div>\n    <div class=\"toolbar\" id=\"toolbarSuCo\" style=\"display:none\">\n      <input id=\"qSuCo\" placeholder=\"Tìm mã, chi nhánh, mô tả…\" style=\"flex:1;min-width:190px\" oninput=\"drawSuCo()\">\n      <button class=\"btn btn-y btn-sm\" id=\"btnBtTableView\" onclick=\"toggleBaoTriView('table')\" style=\"display:none\">📊 Bảng</button>\n      <button class=\"btn btn-ghost btn-sm\" id=\"btnBtKanbanView\" onclick=\"toggleBaoTriView('kanban')\" style=\"display:none\">🗂️ Kanban</button>\n      <button class=\"btn btn-ghost btn-sm\" id=\"btnBtMapView\" onclick=\"toggleBaoTriView('map')\" style=\"display:none\">🗺️ Bản đồ</button>\n      <button class=\"btn btn-ghost btn-sm\" id=\"btnBtListView\" onclick=\"toggleBaoTriView('list')\" style=\"display:none\">📋 Danh sách</button>\n      <button class=\"btn btn-y btn-sm\" onclick=\"openTaoSuCo()\" id=\"btnTaoSuCo\" style=\"display:none\">+ Báo sự cố</button>\n      <button class=\"btn btn-ghost btn-sm\" onclick=\"loadSuCo(true)\" id=\"refreshSuCoBtn\">🔄 Làm mới</button>\n    </div>\n    <!-- Kỹ thuật: lọc theo chi nhánh cần xử lý (14/11/2026) — dùng chung cho Bảng, Kanban, Danh sách, Bản đồ -->\n    <div class=\"loc-cn-kt\" id=\"locCNKT\" style=\"display:none\">\n      <label for=\"fCNKT\">🏢 Chi nhánh</label>\n      <select id=\"fCNKT\" onchange=\"datLocCNKT(this.value)\" aria-label=\"Lọc theo chi nhánh\"></select>\n      <button class=\"btn btn-ghost btn-sm\" id=\"locCNKTBo\" onclick=\"datLocCNKT('')\" style=\"display:none\">✕ Bỏ lọc</button>\n      <span class=\"loc-cn-info\" id=\"locCNKTInfo\" role=\"status\"></span>\n    </div>\n\n    <div class=\"form-card\" id=\"formTaoSuCo\" style=\"display:none\">\n      <h3 id=\"scFormTieuDe\" style=\"font-size:18px;margin-bottom:14px\">Báo sự cố mới</h3>\n      <div class=\"field\" id=\"fldChiNhanhSuCo\" style=\"display:none\">\n        <label for=\"scChiNhanh\">Chi nhánh <span class=\"req\" style=\"color:var(--bad)\">*</span></label>\n        <select id=\"scChiNhanh\"><option value=\"\">— Chọn chi nhánh —</option></select>\n      </div>\n      <div class=\"row2\">\n        <div class=\"field\">\n          <label for=\"scLoai\">Loại sự cố <span class=\"req\" style=\"color:var(--bad)\">*</span></label>\n          <select id=\"scLoai\" onchange=\"onLoaiSuCoChange()\"></select>\n        </div>\n        <div class=\"field\">\n          <label for=\"scPhong\">Phòng / Khu vực / Vị trí (nếu có)</label>\n          <input id=\"scPhong\" placeholder=\"vd: Phòng 3, VIP2, sảnh, bãi xe, nhà kho…\" maxlength=\"40\">\n        </div>\n      </div>\n      <div class=\"field\">\n        <label>Mức độ ưu tiên</label>\n        <div id=\"scMucDoPick\" style=\"display:flex;gap:8px;flex-wrap:wrap\"></div>\n      </div>\n      <div class=\"field\">\n        <label for=\"scMoTa\">Mô tả chi tiết <span class=\"req\" style=\"color:var(--bad)\">*</span></label>\n        <textarea id=\"scMoTa\" rows=\"3\" maxlength=\"500\" placeholder=\"Mô tả cụ thể tình trạng…\" ></textarea>\n      </div>\n      <div class=\"field\">\n        <label>Ảnh đính kèm (tối đa 6 ảnh)</label>\n        <div class=\"photo-pick-row\">\n          <button type=\"button\" class=\"btn btn-ghost btn-sm\" onclick=\"moCamera({boxId:'scPhotoBox', storeVar:'SC_ANH', inputDuPhong:'scAnhCam'})\">📷 Chụp ảnh</button>\n          <button type=\"button\" class=\"btn btn-ghost btn-sm\" onclick=\"$('scAnhLib').click()\">🖼️ Chọn từ thư viện</button>\n        </div>\n        <input type=\"file\" id=\"scAnhCam\" accept=\"image/*\" capture=\"environment\" style=\"display:none\" onchange=\"onPickAnh(this,'scPhotoBox','SC_ANH')\">\n        <input type=\"file\" id=\"scAnhLib\" accept=\"image/*\" multiple style=\"display:none\" onchange=\"onPickAnh(this,'scPhotoBox','SC_ANH')\">\n        <div class=\"photobox\" id=\"scPhotoBox\"></div>\n        <div id=\"scGhiChuSua\" style=\"display:none;font-size:12px;color:var(--txt-mute);margin-top:6px\">Ảnh cũ đã gửi vẫn được giữ nguyên — ảnh chọn thêm ở đây sẽ được cộng thêm vào, không thay thế.</div>\n      </div>\n      <div class=\"bk-act\" style=\"margin-top:6px\">\n        <button class=\"btn btn-y\" id=\"scSubmit\" onclick=\"submitSuCo()\">Gửi báo cáo</button>\n        <button class=\"btn btn-ghost\" onclick=\"closeTaoSuCo()\">Huỷ</button>\n      </div>\n    </div>\n\n    <div class=\"form-card\" id=\"formDieuPhoi\" style=\"display:none\">\n      <h3 style=\"font-size:18px;margin-bottom:4px\">Điều phối kỹ thuật</h3>\n      <p style=\"color:var(--txt-mute);font-size:13px;margin-bottom:14px\" id=\"dpTicketInfo\"></p>\n      <div class=\"field\">\n        <label for=\"dpKyThuat\">Chọn kỹ thuật viên (sắp xếp theo khoảng cách gần nhất)</label>\n        <select id=\"dpKyThuat\"></select>\n      </div>\n      <div class=\"bk-act\" style=\"margin-top:6px\">\n        <button class=\"btn btn-y\" id=\"dpSubmit\" onclick=\"chanBamKep(this,submitDieuPhoi)\">Xác nhận điều phối</button>\n        <button class=\"btn btn-ghost\" onclick=\"$('formDieuPhoi').style.display='none'\">Huỷ</button>\n      </div>\n    </div>\n\n    <div class=\"form-card\" id=\"formBaoXong\" style=\"display:none\">\n      <h3 style=\"font-size:18px;margin-bottom:4px\">Báo đã xử lý xong</h3>\n      <p style=\"color:var(--txt-mute);font-size:13px;margin-bottom:14px\" id=\"bxTicketInfo\"></p>\n      <div class=\"field\">\n        <label for=\"bxGhiChu\">Ghi chú xử lý (nếu có)</label>\n        <textarea id=\"bxGhiChu\" rows=\"2\" maxlength=\"300\" placeholder=\"Đã thay linh kiện gì, xử lý ra sao…\" ></textarea>\n      </div>\n      <div class=\"field\">\n        <label>Ảnh sau khi xử lý (nên chụp, không bắt buộc — tối đa 6 ảnh)</label>\n        <div class=\"photo-pick-row\">\n          <button type=\"button\" class=\"btn btn-ghost btn-sm\" onclick=\"moCamera({boxId:'bxPhotoBox', storeVar:'SC_ANH_XONG', inputDuPhong:'bxAnhCam'})\">📷 Chụp ảnh</button>\n          <button type=\"button\" class=\"btn btn-ghost btn-sm\" onclick=\"$('bxAnhLib').click()\">🖼️ Chọn từ thư viện</button>\n        </div>\n        <input type=\"file\" id=\"bxAnhCam\" accept=\"image/*\" capture=\"environment\" style=\"display:none\" onchange=\"onPickAnh(this,'bxPhotoBox','SC_ANH_XONG')\">\n        <input type=\"file\" id=\"bxAnhLib\" accept=\"image/*\" multiple style=\"display:none\" onchange=\"onPickAnh(this,'bxPhotoBox','SC_ANH_XONG')\">\n        <div class=\"photobox\" id=\"bxPhotoBox\"></div>\n      </div>\n      <div class=\"bk-act\" style=\"margin-top:6px\">\n        <button class=\"btn btn-ok\" id=\"bxSubmit\" onclick=\"submitBaoXong()\">Xác nhận đã xong</button>\n        <button class=\"btn btn-ghost\" onclick=\"$('formBaoXong').style.display='none'\">Huỷ</button>\n      </div>\n    </div>\n\n    <div id=\"viewSuCoList\">\n      <div class=\"form-card\">\n        <div style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px\">\n          <h3 style=\"font-size:17px\"><span id=\"tdChuaXuLy\">🔧 Sự cố chưa xử lý</span> <span class=\"st-pill\" id=\"demChuaXuLy\">0</span></h3>\n        </div>\n        <div class=\"toolbar\" style=\"margin-bottom:12px\">\n          <select id=\"fMoiMuc\" onchange=\"drawSuCo()\">\n            <option value=\"\">Mọi mức độ</option>\n            <option value=\"1\">🔴 Khẩn cấp</option>\n            <option value=\"2\">🟠 Cao</option>\n            <option value=\"3\">🟡 Trung bình</option>\n            <option value=\"4\">🟢 Thấp</option>\n          </select>\n          <select id=\"fMoiKT\" onchange=\"drawSuCo()\" style=\"display:none\"><option value=\"\">Mọi kỹ thuật viên</option></select>\n          <select id=\"fMoiCN\" onchange=\"drawSuCo()\" style=\"display:none\"><option value=\"\">Tất cả chi nhánh</option></select>\n          <!-- Mặc định \"Mới nhất trước\" (24/09/2026, theo yêu cầu) — \"Mức độ trước\" vẫn chọn được, chỉ\n               không còn là ưu tiên mặc định, nên xếp sau trong danh sách lựa chọn. -->\n          <select id=\"fMoiSapXep\" onchange=\"doiSapXepSuCo()\" title=\"Cách sắp xếp khung Sự cố chưa xử lý\">\n            <option value=\"moinhat\">🆕 Mới nhất trước</option>\n            <option value=\"mucdo\">↕ Mức độ trước</option>\n          </select>\n        </div>\n        <div class=\"list\" id=\"listSuCoChuaXuLy\"></div>\n      </div>\n\n      <div class=\"form-card\" style=\"margin-top:18px\">\n        <div style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px\">\n          <h3 style=\"font-size:17px\">✅ Sự cố đã xử lý xong <span class=\"st-pill\" id=\"demDaXong\">0</span></h3>\n        </div>\n        <div class=\"toolbar\" style=\"margin-bottom:12px\">\n          <select id=\"fXongMuc\" onchange=\"drawSuCo()\">\n            <option value=\"\">Mọi mức độ</option>\n            <option value=\"1\">🔴 Khẩn cấp</option>\n            <option value=\"2\">🟠 Cao</option>\n            <option value=\"3\">🟡 Trung bình</option>\n            <option value=\"4\">🟢 Thấp</option>\n          </select>\n          <select id=\"fXongKT\" onchange=\"drawSuCo()\" style=\"display:none\"><option value=\"\">Mọi kỹ thuật viên</option></select>\n          <select id=\"fXongCN\" onchange=\"drawSuCo()\" style=\"display:none\"><option value=\"\">Tất cả chi nhánh</option></select>\n        </div>\n        <div class=\"list\" id=\"listSuCoDaXong\"></div>\n        <button class=\"btn btn-ghost btn-sm\" id=\"btnXemTiepDaXong\" onclick=\"taoNhieuDaXong()\" style=\"display:none;margin-top:12px\">Xem thêm</button>\n      </div>\n    </div>\n\n    <div id=\"mapBaoTri\" style=\"display:none;height:520px;border-radius:16px;overflow:hidden;border:1px solid var(--line-soft)\"></div>\n    <div id=\"mapChuThich\" style=\"display:none;margin-top:10px;font-size:12px;color:var(--txt-mute);gap:14px;flex-wrap:wrap\">\n      <span>🔴 Khẩn cấp</span><span>🟠 Cao</span><span>🟡 Trung bình</span><span>🟢 Thấp</span><span>👷 Kỹ thuật viên</span>\n    </div>\n\n    <div id=\"viewSuCoTable\" style=\"display:none\">\n      <div class=\"form-card\">\n        <div style=\"display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px\">\n          <h3 style=\"font-size:17px\">📊 Bảng theo dõi sự cố <span class=\"st-pill\" id=\"demBangSuCo\">0</span></h3>\n          <div style=\"display:flex;gap:8px;flex-wrap:wrap\">\n            <button class=\"btn btn-ghost btn-sm caidat-admin-only\" onclick=\"xemSuCoDaXoa()\">🗑️ Đã xoá</button>\n            <button class=\"btn btn-y btn-sm\" onclick=\"xuatExcelSuCo()\">📊 Xuất Excel</button>\n            <button class=\"btn btn-ghost btn-sm\" onclick=\"xuatCSVSuCo()\">⬇️ Xuất CSV</button>\n          </div>\n        </div>\n        <div class=\"toolbar\" style=\"margin-bottom:12px\">\n          <input id=\"qBangSuCo\" placeholder=\"Tìm mã, chi nhánh, mô tả…\" style=\"flex:1;min-width:190px\" oninput=\"drawSuCoTable()\">\n          <select id=\"fBangTrangThai\" onchange=\"drawSuCoTable()\">\n            <option value=\"\">Mọi trạng thái</option>\n            <option value=\"moi\">Mới báo</option>\n            <option value=\"da_tiep_nhan\">Đã tiếp nhận</option>\n            <option value=\"da_dieu_phoi\">Đã điều phối</option>\n            <option value=\"da_nhan\">Kỹ thuật đã nhận</option>\n            <option value=\"dang_xu_ly\">Đang xử lý</option>\n            <option value=\"cho_xac_nhan\">Chờ chi nhánh xác nhận</option>\n            <option value=\"cho_dong\">Chờ đóng ticket</option>\n            <option value=\"dong\">Đã đóng</option>\n          </select>\n          <select id=\"fBangMuc\" onchange=\"drawSuCoTable()\">\n            <option value=\"\">Mọi mức độ</option>\n            <option value=\"1\">🔴 Khẩn cấp</option>\n            <option value=\"2\">🟠 Cao</option>\n            <option value=\"3\">🟡 Trung bình</option>\n            <option value=\"4\">🟢 Thấp</option>\n          </select>\n          <select id=\"fBangCN\" onchange=\"drawSuCoTable()\" style=\"display:none\"><option value=\"\">Tất cả chi nhánh</option></select>\n        </div>\n        <div class=\"tblwrap\">\n          <table>\n            <thead><tr><th>No</th><th>Mã sự cố</th><th>Ngày tạo yêu cầu</th><th>Trạng thái</th><th>Chi nhánh</th><th>Lỗi</th><th>Thông tin chi tiết</th><th>Mức độ ưu tiên</th><th>Hành động</th></tr></thead>\n            <tbody id=\"bangSuCoBody\"></tbody>\n          </table>\n        </div>\n      </div>\n    </div>\n\n    <!-- Kanban (05/11/2026, chỉ admin): sự cố ĐANG MỞ chia cột theo trạng thái — nhìn 1 lần là biết\n         phiếu đang kẹt ở khâu nào. Bấm vào thẻ = mở Lịch sử & trao đổi. -->\n    <div id=\"viewSuCoKanban\" style=\"display:none\">\n      <div class=\"form-card\">\n        <div class=\"kb-top\">\n          <h3>🗂️ Sự cố đang mở theo trạng thái <span class=\"st-pill\" id=\"demKanban\">0</span></h3>\n        <div class=\"toolbar\">\n          <select id=\"fKbMuc\" onchange=\"drawSuCoKanban()\">\n            <option value=\"\">Mọi mức độ</option>\n            <option value=\"1\">🔴 Khẩn cấp</option>\n            <option value=\"2\">🟠 Cao</option>\n            <option value=\"3\">🟡 Trung bình</option>\n            <option value=\"4\">🟢 Thấp</option>\n          </select>\n          <select id=\"fKbKT\" onchange=\"drawSuCoKanban()\" style=\"display:none\"><option value=\"\">Mọi kỹ thuật viên</option></select>\n          <select id=\"fKbCN\" onchange=\"drawSuCoKanban()\" style=\"display:none\"><option value=\"\">Tất cả chi nhánh</option></select>\n        </div>\n        </div>\n        <div class=\"kb-ghim\" id=\"kbGhimBar\" role=\"status\"></div>\n        <div class=\"kb-wrap\" id=\"kanbanCot\"></div>\n      </div>\n    </div>";
(function(){
  const st = document.createElement('style'); st.id = 'modBaoTriCss'; st.textContent = BT_CSS; document.head.appendChild(st);
  document.getElementById('baotri').innerHTML = BT_HTML;
})();

// Nút Back của Android khi đang mở camera → đóng camera (không hỏi thoát app): camera mượn 1 nấc lịch
// sử qua moModalCoBack() như các modal khác, xem dongModalTrenCungKhiBack().

/* ─── tạo sự cố ─── */
function buildScChiNhanhSelect(){
  // Ô chọn chi nhánh khi báo sự cố: chỉ khi được báo cho NHIỀU chi nhánh; liệt kê đúng các chi nhánh có quyền BAOTRI.BAO.
  if(SESSION && qNhieuCN('BAOTRI.BAO')){
    $('scChiNhanh').innerHTML = '<option value="">— Chọn chi nhánh —</option>' +
      cnTheoQuyen('BAOTRI.BAO').sort((a,b)=>a.short.localeCompare(b.short)).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.short)+'</option>').join('');
  }
}
let scMucDoChon = null;
let scDangSuaMa = null;   // null = đang tạo mới; có giá trị = đang sửa đúng ticket này (mới, 11/09/2026)
function openTaoSuCo(){
  scDangSuaMa = null;
  SC_ANH = []; $('scPhotoBox').innerHTML = '';
  $('scPhong').value=''; $('scMoTa').value='';
  $('fldChiNhanhSuCo').style.display = qNhieuCN('BAOTRI.BAO') ? '' : 'none';
  if(qNhieuCN('BAOTRI.BAO')) $('scChiNhanh').value='';
  // KHÔNG để loại sự cố mặc định chọn sẵn dòng đầu tiên — bắt buộc người báo tự chọn, tránh báo nhầm
  // loại lỗi do lười đổi (mới, 11/09/2026, theo phản hồi thực tế "để mặc định toàn bị báo nhầm").
  $('scLoai').innerHTML = '<option value="">— Chọn loại sự cố —</option>' +
    LOAI_SUCO_LIST.filter(l=>l.active).map(l=>'<option value="'+l.ma+'">'+esc(l.ten)+'</option>').join('');
  onLoaiSuCoChange();
  $('scFormTieuDe').textContent = 'Báo sự cố mới';
  $('scSubmit').textContent = 'Gửi báo cáo';
  $('scGhiChuSua').style.display = 'none';
  $('formTaoSuCo').style.display='block';
  requestAnimationFrame(()=>$('formTaoSuCo').scrollIntoView({behavior:'smooth',block:'start'}));
}
/** Chính người đã tạo ticket tự sửa lại nội dung — CHỈ khi ticket còn ở trạng thái 'moi' (nút này chỉ
 *  hiện ra trong sucoHTML() đúng lúc đó, xem ghi chú ở suaSuCo() bên Code.gs). Tái dùng nguyên form
 *  "Báo sự cố mới" — chỉ đổi tiêu đề/nút và khoá ô chi nhánh lại (không cho đổi chi nhánh khi sửa,
 *  xem đúng lý do trong suaSuCo() bên Code.gs), mới, 11/09/2026. */
function openSuaSuCo(maSuCo){
  const t = SUCO.find(x=>x.maSuCo===maSuCo);
  if(!t) return toast('Không tìm thấy ticket.','bad');
  scDangSuaMa = maSuCo;
  SC_ANH = []; $('scPhotoBox').innerHTML = '';
  $('fldChiNhanhSuCo').style.display = 'none';   // không cho đổi chi nhánh khi sửa
  $('scPhong').value = t.phong || '';
  $('scMoTa').value = t.moTa || '';
  $('scLoai').innerHTML = '<option value="">— Chọn loại sự cố —</option>' +
    LOAI_SUCO_LIST.filter(l=>l.active || l.ma===t.loaiLoi).map(l=>'<option value="'+l.ma+'"'+(l.ma===t.loaiLoi?' selected':'')+'>'+esc(l.ten)+'</option>').join('');
  onLoaiSuCoChange();
  scMucDoChon = t.mucDo;
  renderMucDoPick();
  $('scFormTieuDe').textContent = 'Sửa báo cáo — '+maSuCo;
  $('scSubmit').textContent = 'Lưu thay đổi';
  $('scGhiChuSua').style.display = '';
  $('formTaoSuCo').style.display='block';
  requestAnimationFrame(()=>$('formTaoSuCo').scrollIntoView({behavior:'smooth',block:'start'}));
}
function closeTaoSuCo(){ $('formTaoSuCo').style.display='none'; scDangSuaMa = null; }
function onLoaiSuCoChange(){
  // Lấy mức độ gợi ý trực tiếp từ LOAI_SUCO_LIST (danh mục thật admin đang quản lý trong Cài đặt),
  // không dùng LOAI_LOI tĩnh trong code — để cả loại sự cố admin tự thêm sau này cũng có gợi ý đúng,
  // không chỉ 16 loại có sẵn từ đầu.
  const loai = LOAI_SUCO_LIST.find(l=>l.ma===$('scLoai').value);
  scMucDoChon = loai ? loai.mucDo : null;
  renderMucDoPick();
}
function renderMucDoPick(){
  // Chưa chọn loại sự cố thì chưa có gì để gợi ý — không tự chọn sẵn 1 mức nào cả, tránh admin/chi
  // nhánh vô tình để nguyên mức mặc định mà không để ý (mới, 11/09/2026).
  if(!$('scLoai').value){
    $('scMucDoPick').innerHTML = '<p style="color:var(--txt-mute);font-size:13px;margin:0">Chọn loại sự cố trước để thấy gợi ý mức độ ưu tiên.</p>';
    return;
  }
  $('scMucDoPick').innerHTML = [1,2,3,4].map(m=>{
    const on = m===scMucDoChon;
    return '<button type="button" class="pri-btn pri-btn-'+m+(on?' on':'')+'" onclick="pickMucDo('+m+')">'+(on?'✓ ':'')+MUC_DO_LABEL[m]+'</button>';
  }).join('');
}
function pickMucDo(m){ scMucDoChon = m; renderMucDoPick(); }

async function submitSuCo(guiTrung){
  const loaiCode = $('scLoai').value;
  const moTa = $('scMoTa').value.trim();
  if(!scDangSuaMa && qNhieuCN('BAOTRI.BAO') && !$('scChiNhanh').value) return toast('Chọn chi nhánh trước đã nhé.','bad');
  if(!loaiCode) return toast('Chọn loại sự cố trước đã nhé.','bad');
  if(!scMucDoChon) return toast('Chưa xác định được mức độ ưu tiên — chọn lại loại sự cố hoặc bấm chọn mức độ.','bad');
  if(!moTa) return toast('Nhập mô tả chi tiết — giúp admin/kỹ thuật điều phối đúng người, đúng việc.','bad');
  if(!guiTrung && !scDangSuaMa && !SC_ANH.length && !confirm('Bạn chưa đính kèm ảnh nào. Một số lỗi (vd sự cố mạng, cấu hình phần mềm…) không cần ảnh vẫn báo được — vẫn gửi báo cáo không kèm ảnh chứ?')) return;
  $('scSubmit').disabled = true; $('scSubmit').innerHTML = '<span class="spin"></span> Đang gửi…';
  try{
    let j;
    if(scDangSuaMa){
      j = await api({
        action:'suco_sua', maSuCo:scDangSuaMa, loaiLoi:loaiCode, mucDo:scMucDoChon,
        phong:$('scPhong').value.trim(), moTa:moTa, anh: SC_ANH.length ? SC_ANH : undefined
      });
    }else{
      j = await api({
        action:'suco_tao', loaiLoi:loaiCode, mucDo:scMucDoChon,
        phong:$('scPhong').value.trim(), moTa:moTa,
        chinhanhId: qNhieuCN('BAOTRI.BAO') ? $('scChiNhanh').value : undefined,
        anh: SC_ANH, buaTrung: guiTrung===true
      });
    }
    if(j.error === 'TRUNG_LAP'){
      $('scSubmit').disabled = false; $('scSubmit').textContent = 'Gửi báo cáo';
      if(confirm('Có vẻ trùng với ticket '+j.maSuCoTrung+' — cùng chi nhánh, cùng loại lỗi, cùng phòng, cùng mô tả, mới báo gần đây và chưa đóng.\n\nBấm OK nếu đây thật sự là 2 sự cố khác nhau và vẫn muốn gửi thêm; bấm Huỷ nếu chỉ là báo nhầm/báo lại (ticket cũ vẫn đang được xử lý bình thường).')){
        return submitSuCo(true);
      }
      return;
    }
    if(!j.ok) throw new Error(j.error||'FAIL');
    toast(scDangSuaMa ? 'Đã lưu thay đổi.' : 'Đã gửi báo cáo sự cố '+j.maSuCo+'.','ok');
    closeTaoSuCo();
    loadSuCo(true);
  }catch(e){
    const map = {BAD_BRANCH:'Chưa chọn đúng chi nhánh.', CAN_LOAI:'Chọn loại sự cố trước đã nhé.', CAN_MOTA:'Nhập mô tả chi tiết trước đã nhé.',
      DA_XU_LY_KHONG_SUA_DUOC:'Sự cố đã được tiếp nhận/xử lý, không tự sửa được nữa — gọi điện hoặc nhắn Zalo cho quản trị hệ thống nếu cần điều chỉnh.'};
    toast(map[e.message] || 'Không gửi được. Kiểm tra kết nối rồi thử lại.','bad');
  }finally{
    $('scSubmit').disabled = false; $('scSubmit').textContent = scDangSuaMa ? 'Lưu thay đổi' : 'Gửi báo cáo';
  }
}

/* Đổ dropdown "theo kỹ thuật" cho 1 khung, dựa trên chính dữ liệu SUCO đang có (đã được server lọc
   đúng quyền xem của từng vai trò) — không cần gọi thêm API riêng. Kỹ thuật viên tự ẩn dropdown này
   vì với họ luôn chỉ có đúng 1 giá trị khả dĩ (chính họ), lọc theo nó là vô nghĩa. */
function capNhatDsKyThuatLoc(selectId){
  const el = $(selectId);
  if(isKyThuat()){ el.style.display='none'; return; }
  const daChon = el.value;
  const ten = {};
  SUCO.forEach(t=>{ if(t.kyThuatDuocGiao) ten[t.kyThuatDuocGiao] = t.kyThuatTen || t.kyThuatDuocGiao; });
  const ds = Object.keys(ten).sort((a,b)=>ten[a].localeCompare(ten[b]));
  el.innerHTML = '<option value="">Mọi kỹ thuật viên</option>' + ds.map(u=>'<option value="'+esc(u)+'"'+(u===daChon?' selected':'')+'>'+esc(ten[u])+'</option>').join('');
  el.style.display = ds.length ? '' : 'none';
}

/* ── Lọc theo chi nhánh dành cho kỹ thuật (14/11/2026). Một bộ lọc dùng chung cho cả 4 kiểu xem; không
   lưu lại (mở lại app là về "Tất cả chi nhánh" để khỏi sót việc). Danh sách chi nhánh lấy từ chính SUCO
   mà server đã lọc đúng quyền → chỉ gồm chi nhánh kỹ thuật này có việc. ── */
let CN_KT_LOC = '';
function locCNKTHienTai(){ return isKyThuat() ? CN_KT_LOC : ''; }
function capNhatLocCNKT(){
  const box = $('locCNKT'); if(!box) return;
  if(!isKyThuat()){ box.style.display='none'; CN_KT_LOC=''; return; }
  const cn = {};
  SUCO.forEach(t=>{
    if(!t.chinhanhId) return;
    const o = cn[t.chinhanhId] || (cn[t.chinhanhId] = {ten:t.chinhanhTen||t.chinhanhId, mo:0, xong:0});
    if(t.trangThai==='dong') o.xong++; else o.mo++;
  });
  const ids = Object.keys(cn);
  if(CN_KT_LOC && !cn[CN_KT_LOC]) CN_KT_LOC = '';          // chi nhánh đã hết việc → tự về "Tất cả"
  // Ít hơn 2 chi nhánh thì lọc vô nghĩa: ẩn cho gọn
  if(ids.length<2){ box.style.display='none'; CN_KT_LOC=''; return; }
  const theoTen = (a,b)=>cn[a].ten.localeCompare(cn[b].ten,'vi');
  const dangMo = ids.filter(i=>cn[i].mo).sort(theoTen), chiXong = ids.filter(i=>!cn[i].mo).sort(theoTen);
  const tongMo = SUCO.filter(t=>t.trangThai!=='dong').length;
  const opt = (i,nhan)=>'<option value="'+esc(i)+'"'+(i===CN_KT_LOC?' selected':'')+'>'+esc(cn[i].ten)+nhan+'</option>';
  $('fCNKT').innerHTML = '<option value="">Tất cả chi nhánh ('+dangMo.length+' có việc đang mở)</option>'+
    (dangMo.length ? '<optgroup label="Đang có việc mở">'+dangMo.map(i=>opt(i,' — '+cn[i].mo+' việc')).join('')+'</optgroup>' : '')+
    (chiXong.length ? '<optgroup label="Chỉ có việc đã xong">'+chiXong.map(i=>opt(i,' — '+cn[i].xong+' đã xong')).join('')+'</optgroup>' : '');
  $('fCNKT').value = CN_KT_LOC;
  box.style.display = '';
  box.classList.toggle('dang-loc', !!CN_KT_LOC);
  $('locCNKTBo').style.display = CN_KT_LOC ? '' : 'none';
  $('locCNKTInfo').textContent = CN_KT_LOC
    ? 'Đang lọc: '+cn[CN_KT_LOC].ten+' · '+cn[CN_KT_LOC].mo+'/'+tongMo+' việc đang mở'+(cn[CN_KT_LOC].xong?' · '+cn[CN_KT_LOC].xong+' đã xong':'')
    : '';
}
function datLocCNKT(id){
  CN_KT_LOC = id || '';
  capNhatLocCNKT();
  drawSuCo();
  if($('viewSuCoTable').style.display!=='none') drawSuCoTable();
  if($('mapBaoTri').style.display!=='none') veBanDoBaoTri();
}

function locSuCo(list, fMuc, fKT, fCN, q){
  fCN = fCN || locCNKTHienTai();
  return list.filter(t=>{
    if(fMuc && String(t.mucDo)!==fMuc) return false;
    if(fKT && t.kyThuatDuocGiao!==fKT) return false;
    if(fCN && t.chinhanhId!==fCN) return false;
    if(q && !norm(t.maSuCo+' '+t.chinhanhTen+' '+t.moTa+' '+(LOAI_LOI[t.loaiLoi]||{}).ten).includes(q)) return false;
    return true;
  });
}

let daXongHien = 40;   // số lượng "đã xử lý xong" hiện ra, bấm "Xem thêm" để mở rộng dần theo lượt 40

function drawSuCo(){
  capNhatLocCNKT();
  const open = SUCO.filter(t=>t.trangThai!=='dong');
  const p1 = open.filter(t=>t.mucDo===1).length;
  const demTT = tt => SUCO.filter(t=>tt.includes(t.trangThai)).length;
  const o = (cls,k,v) => '<div class="stat '+cls+'"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>';
  // Số liệu đầu trang theo đúng việc của từng vai trò (12/11/2026)
  if(isKyThuat()){
    const moiGiao = demTT(['da_dieu_phoi']);
    $('statsSuCo').innerHTML = o('y','Đang làm',demTT(['da_nhan','dang_xu_ly']))+o(moiGiao?'r':'','Mới giao cho bạn',moiGiao)+
      o('g','Chờ chi nhánh xác nhận',demTT(['cho_xac_nhan','cho_dong']))+o('','Đã xong',demTT(['dong']));
  } else if(laChiNhanh()){
    const canXN = demTT(['cho_xac_nhan']);
    // Người chỉ theo dõi (không có quyền xác nhận, vd giám sát được cấp xem) → nhãn trung tính, không "Cần bạn…"
    $('statsSuCo').innerHTML = o(canXN && coQ('BAOTRI.XACNHAN')?'r':'',coQ('BAOTRI.XACNHAN')?'Cần bạn xác nhận':'Chờ chi nhánh xác nhận',canXN)+o('y','Kỹ thuật đang xử lý',demTT(['da_dieu_phoi','da_nhan','dang_xu_ly']))+
      o('w','Chờ tiếp nhận',demTT(['moi','da_tiep_nhan']))+o('','Đã đóng',demTT(['dong']));
  } else {
    $('statsSuCo').innerHTML = o('r','Khẩn cấp đang mở',p1)+o('y','Đang mở',open.length)+
      o('g','Chờ chi nhánh xác nhận',demTT(['cho_xac_nhan']))+o('','Đã đóng',demTT(['dong']));
  }
  $('tdChuaXuLy').textContent = isKyThuat() ? '🔧 Việc của tôi' : laChiNhanh() ? '🔧 Sự cố của chi nhánh' : '🔧 Sự cố chưa xử lý';

  capNhatDsKyThuatLoc('fMoiKT');
  capNhatDsKyThuatLoc('fXongKT');

  const q = norm($('qSuCo').value.trim());

  /* ── khung 1: sự cố CHƯA xử lý (mọi trạng thái khác "đã đóng") — mức độ nghiêm trọng trước, cùng
     mức thì mới báo lên trên. Riêng kỹ thuật viên: mức độ trước, cùng mức thì ưu tiên GẦN MÌNH nhất —
     dùng vị trí GPS thật (VITRI_HIEN_TAI_KT, mới nhất lần lấy trong phiên này, xem guiViTriHienTai())
     nếu đã có; nếu chưa lấy được GPS lần nào (vd vừa mở lại tab, chưa mở bản đồ hay bấm hành động nào)
     thì tạm dùng chi nhánh xuất phát gắn với tài khoản làm điểm tham chiếu, như cách cũ. ── */
  let chuaXuLy = locSuCo(open, $('fMoiMuc').value, $('fMoiKT').value, $('fMoiCN').value, q);
  /* Cách sắp xếp do người dùng chọn (mới, 19/09/2026) — "Mới nhất trước" bỏ qua mức độ lẫn khoảng
     cách, xếp thuần theo lúc báo giống view Bảng, để ticket vừa phát sinh không bị chìm dưới hàng
     loạt ticket Khẩn cấp cũ. "Mức độ trước" (mặc định) giữ nguyên logic cũ bên dưới. */
  $('fMoiSapXep').value = cheDoSapXepSuCo();
  if(cheDoSapXepSuCo()==='moinhat'){
    chuaXuLy = chuaXuLy.sort((a,b)=> String(b.taoLuc).localeCompare(String(a.taoLuc)));
  } else if(isKyThuat()){
    const goc = VITRI_HIEN_TAI_KT || branchCoord(SESSION.branchId);
    chuaXuLy = chuaXuLy.sort((a,b)=>{
      if(a.mucDo!==b.mucDo) return a.mucDo-b.mucDo;
      const ca = branchCoord(a.chinhanhId), cb = branchCoord(b.chinhanhId);
      if(!goc || !ca || !cb) return 0;
      return haversine(goc.lat,goc.lng,ca.lat,ca.lng) - haversine(goc.lat,goc.lng,cb.lat,cb.lng);
    });
  } else {
    chuaXuLy = chuaXuLy.sort((a,b)=> a.mucDo-b.mucDo || String(b.taoLuc).localeCompare(String(a.taoLuc)));
  }
  $('demChuaXuLy').textContent = chuaXuLy.length;
  /* Kỹ thuật & quản lý: chia nhóm theo việc cần làm (12/11/2026) — nhóm cần hành động lên đầu, trong
     nhóm giữ đúng thứ tự sắp xếp đã chọn ở trên. Admin giữ 1 danh sách như cũ. */
  const NHOM = isKyThuat() ? [
      {ten:'Đang làm', tt:['da_nhan','dang_xu_ly']},
      {ten:'Mới giao cho bạn', tt:['da_dieu_phoi']},
      {ten:'Có thể tự nhận', tt:['da_tiep_nhan']},
      {ten:'Chờ chi nhánh xác nhận', tt:['cho_xac_nhan','cho_dong']}
    ] : laChiNhanh() ? [
      {ten: coQ('BAOTRI.XACNHAN') ? 'Cần anh/chị xác nhận' : 'Chờ chi nhánh xác nhận', tt:['cho_xac_nhan']},
      {ten:'Kỹ thuật đang xử lý', tt:['da_dieu_phoi','da_nhan','dang_xu_ly']},
      {ten:'Mới báo — chờ tiếp nhận', tt:['moi','da_tiep_nhan']},
      {ten:'Chờ đóng', tt:['cho_dong']}
    ] : null;
  let htmlChua = '';
  if(NHOM){
    const daXep = new Set();
    NHOM.forEach(n=>{
      const ds = chuaXuLy.filter(t=>n.tt.includes(t.trangThai));
      ds.forEach(t=>daXep.add(t));
      if(ds.length) htmlChua += '<div class="nhom-h">'+n.ten+' <span class="st-pill">'+ds.length+'</span></div>'+ds.map(sucoHTML).join('');
    });
    const conLai = chuaXuLy.filter(t=>!daXep.has(t));
    if(conLai.length) htmlChua += '<div class="nhom-h">Khác <span class="st-pill">'+conLai.length+'</span></div>'+conLai.map(sucoHTML).join('');
  } else htmlChua = chuaXuLy.map(sucoHTML).join('');
  $('listSuCoChuaXuLy').innerHTML = chuaXuLy.length ? htmlChua :
    '<div class="empty" style="padding:36px 0"><div class="big">✅</div><p>'+(isKyThuat() ? 'Chưa có việc nào — nghỉ tay chút nhé!' : 'Không có sự cố nào khớp bộ lọc.')+'</p></div>';

  /* ── khung 2: sự cố ĐÃ xử lý xong (đã đóng) — mới nhất lên trên, KHÔNG phân biệt mức độ nghiêm
     trọng như báo cáo cũ nữa (đúng theo yêu cầu, vì đã xong việc thì mức độ không còn ý nghĩa ưu
     tiên xem). Sắp theo lúc đóng ticket, nếu thiếu thì theo lúc báo xong hoặc lúc tạo. ── */
  const dong = SUCO.filter(t=>t.trangThai==='dong');
  let daXong = locSuCo(dong, $('fXongMuc').value, $('fXongKT').value, $('fXongCN').value, q);
  daXong = daXong.sort((a,b)=> String(b.dongLuc||b.xongLuc||b.taoLuc).localeCompare(String(a.dongLuc||a.xongLuc||a.taoLuc)));
  $('demDaXong').textContent = daXong.length;
  const hienThi = daXong.slice(0, daXongHien);
  $('listSuCoDaXong').innerHTML = hienThi.length ? hienThi.map(sucoHTML).join('') :
    '<div class="empty" style="padding:36px 0"><div class="big">🗄️</div><p>Chưa có sự cố nào khớp bộ lọc.</p></div>';
  $('btnXemTiepDaXong').style.display = daXong.length > daXongHien ? '' : 'none';
  if($('viewSuCoKanban').style.display!=='none') drawSuCoKanban();
}
function taoNhieuDaXong(){ daXongHien += 40; drawSuCo(); }

/** Ghi nhớ cách sắp xếp khung "Sự cố chưa xử lý" trên thiết bị này (mới, 19/09/2026; đổi mặc định
 *  24/09/2026: "Mới nhất trước" thay cho "Mức độ trước" — khớp đúng view Bảng vốn đã luôn xếp mới
 *  nhất lên trên; mức độ vẫn chọn được, chỉ không còn là mặc định). Chỉ là tuỳ chọn hiển thị, không
 *  liên quan phiên đăng nhập — lưu localStorage để đăng xuất/đăng nhập lại vẫn giữ. Ai đã từng TỰ chọn
 *  "Mức độ trước" trước ngày đổi mặc định thì vẫn giữ đúng lựa chọn đó, không bị đổi ngược lại. Bọc
 *  try/catch vì một số trình duyệt chế độ riêng tư chặn localStorage. */
function cheDoSapXepSuCo(){
  try{ return localStorage.getItem(CFG.PREFIX+'sx_suco')==='mucdo' ? 'mucdo' : 'moinhat'; }
  catch(e){ return 'moinhat'; }
}
function doiSapXepSuCo(){
  try{ localStorage.setItem(CFG.PREFIX+'sx_suco', $('fMoiSapXep').value==='moinhat' ? 'moinhat' : 'mucdo'); }catch(e){}
  drawSuCo();
}

/** Chỉ đường Google Maps tới chi nhánh (mới, 18/08/2026) — dùng chuẩn URL chính thức của Google, không
 *  cần API key, mở được app Google Maps trên điện thoại hoặc web trên máy tính. CỐ TÌNH không tự điền
 *  điểm xuất phát (origin) — để trống thì Google Maps tự dùng vị trí GPS hiện tại ngay lúc mở, chính
 *  xác hơn nhiều so với việc tự lấy toạ độ đã lưu (VITRI_HIEN_TAI_KT) rồi nhét vào, vì đó có thể là
 *  bản cache vài phút trước. Chi nhánh chưa có toạ độ chính xác (lat/lng trống) → chỉ đường theo địa
 *  chỉ dạng chữ thay vì ẩn nút — vẫn dùng được, chỉ kém chính xác hơn 1 chút. */
function chiDuongUrl(t){
  const br = branchCoord(t.chinhanhId);
  if(br) return 'https://www.google.com/maps/dir/?api=1&destination='+br.lat+','+br.lng+'&travelmode=driving';
  const bAny = BRANCHES.find(b=>b.id===t.chinhanhId);
  const diaChi = (bAny && bAny.address) ? bAny.address : (t.chinhanhTen || '');
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(diaChi)+'&travelmode=driving';
}
function chiDuong(maSuCo){
  const t = SUCO.find(x=>x.maSuCo===maSuCo);
  if(!t) return;
  window.open(chiDuongUrl(t), '_blank');
}

function sucoHTML(t){
  const loai = LOAI_LOI[t.loaiLoi] || LOAI_LOI.khac || {ten:"Khác"};
  const created = fmtVN(t.taoLuc);
  const sla = slaTrangThai(t);
  const slaCls = {ok:4, warn:2, bad:1}[sla&&sla.cls] || 3;
  const slaBadge = (sla && sla.text) ? ' <span class="pri pri-'+slaCls+'">'+sla.text+'</span>' : '';
  let acts = '';

  // Nút điều phối theo QUYỀN ở đúng chi nhánh của phiếu (24/11/2026) — admin có đủ toàn chuỗi như trước
  if(!isKyThuat()){
    if(t.trangThai==='moi' && coQCN('BAOTRI.TIEPNHAN', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="chanBamKep(this,tiepNhan,\''+t.maSuCo+'\','+t.mucDo+')">✓ Tiếp nhận</button>';
    if(['da_tiep_nhan','da_dieu_phoi'].includes(t.trangThai) && coQCN('BAOTRI.DIEUPHOI', t.chinhanhId)) acts += '<button class="btn btn-y btn-sm" onclick="openDieuPhoi(\''+t.maSuCo+'\')">📍 '+(t.trangThai==='da_dieu_phoi'?'Đổi kỹ thuật':'Điều phối')+'</button>';
    if(t.trangThai==='cho_dong' && coQCN('BAOTRI.DONG', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="chanBamKep(this,dongTicket,\''+t.maSuCo+'\')">🔒 Đóng ticket</button>';
  }
  /* Kỹ thuật & quản lý (12/11/2026): bước kế tiếp là 1 nút TO đầy ngang (chinh) + thanh tiến độ các bước,
     các nút phụ (chỉ đường, trao đổi, lịch sử…) xếp nhỏ bên dưới. Cùng hàm/action như trước. */
  let chinh = '', buoc = null;
  if(isKyThuat()){
    if(t.trangThai==='da_tiep_nhan' && !t.kyThuatDuocGiao && PUBLIC_SETTINGS.kythuatTuNhanViec) chinh = '<button class="btn btn-y btn-lg" onclick="chanBamKep(this,tuNhanViec,\''+t.maSuCo+'\')">🙋 Tự nhận việc</button>';
    if(t.trangThai==='da_dieu_phoi') chinh = '<button class="btn btn-y btn-lg" onclick="chanBamKep(this,nhanViec,\''+t.maSuCo+'\')">👷 Nhận việc</button>';
    if(t.trangThai==='da_nhan') chinh = '<button class="btn btn-y btn-lg" onclick="chanBamKep(this,batDauXuLy,\''+t.maSuCo+'\')">🔧 Bắt đầu xử lý</button>';
    if(t.trangThai==='dang_xu_ly') chinh = '<button class="btn btn-ok btn-lg" onclick="openBaoXong(\''+t.maSuCo+'\')">✓ Báo xong</button>';
    if(['da_nhan','dang_xu_ly'].includes(t.trangThai)){
      acts += '<button class="btn btn-ghost btn-sm" onclick="chiDuong(\''+t.maSuCo+'\')">🧭 Chỉ đường</button>';
      if(t.trangThai==='da_nhan') acts += '<button class="btn btn-ghost btn-sm" onclick="openBaoXong(\''+t.maSuCo+'\')">✓ Báo xong</button>';
    }
    if(t.trangThai!=='dong') buoc = {ten:['Nhận việc','Đang xử lý','Báo xong'],
      n:{da_tiep_nhan:0, da_dieu_phoi:0, da_nhan:1, dang_xu_ly:2, cho_xac_nhan:3, cho_dong:3}[t.trangThai] ?? 0};
  }
  if(laChiNhanh()){
    if(t.trangThai==='cho_xac_nhan' && coQCN('BAOTRI.XACNHAN', t.chinhanhId))
      chinh = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">'+
        '<button class="btn btn-ok btn-lg" onclick="chanBamKep(this,xacNhan,\''+t.maSuCo+'\',true)">✅ Đã xong</button>'+
        '<button class="btn btn-bad btn-lg" onclick="chanBamKep(this,xacNhan,\''+t.maSuCo+'\',false)">❌ Chưa xong</button></div>';
    if(t.trangThai!=='dong') buoc = {ten:['Đã báo','Tiếp nhận','Đang sửa','Xác nhận'],
      n:{moi:1, da_tiep_nhan:2, da_dieu_phoi:2, da_nhan:3, dang_xu_ly:3, cho_xac_nhan:3, cho_dong:4}[t.trangThai] ?? 1};
  }
  // Chính người đã tạo ticket (chi nhánh tự báo, hoặc admin báo hộ) tự sửa/xoá được — CHỈ khi còn
  // ở trạng thái 'moi' (chưa ai tiếp nhận). Qua khỏi mốc này phải nhờ admin xử lý qua kênh ngoài
  // (gọi điện/Zalo) để đảm bảo hệ thống sạch, không cho sửa/xoá ngầm sau khi đã có người để mắt tới
  // (mới, 11/09/2026).
  if(t.nguoiTao===SESSION.user && t.trangThai==='moi'){
    acts += '<button class="btn btn-y btn-sm" onclick="openSuaSuCo(\''+t.maSuCo+'\')">✏️ Sửa</button>'+
            '<button class="btn btn-bad btn-sm" onclick="chanBamKep(this,xoaSuCo,\''+t.maSuCo+'\')">🗑️ Xoá báo cáo</button>';
  }
  // Trao đổi (05/11/2026): ai được nhắn thì thấy nút 💬 (kèm số tin); ticket đã đóng/không được nhắn thì
  // số tin hiện ngay trên nút Lịch sử để vẫn biết là có trao đổi.
  const demTD = t.soTraoDoi ? ' <span class="td-dem">'+t.soTraoDoi+'</span>' : '';
  if(coTheTraoDoi(t)) acts += '<button class="btn btn-ghost btn-sm" onclick="xemLichSu(\''+t.maSuCo+'\',true)">💬 Trao đổi'+demTD+'</button>';
  acts += '<button class="btn btn-ghost btn-sm" onclick="xemLichSu(\''+t.maSuCo+'\')">🕘 Lịch sử'+(coTheTraoDoi(t)?'':demTD)+'</button>';
  if(SESSION.sieuAdmin) acts += '<button class="btn btn-bad btn-sm" onclick="chanBamKep(this,xoaSuCo,\''+t.maSuCo+'\')">🗑️ Xoá</button>';

  const photos = (imgs, label) => imgs.length ? '<div class="sc-photos">'+imgs.map((u,i)=>'<img src="'+esc(driveImgUrl(u))+'" alt="'+label+'" loading="lazy" onclick=\''+esc('openXemAnh('+JSON.stringify(imgs.map(x=>driveImgUrl(x,2000)))+','+i+')')+'\'>').join('')+'</div>' : '';

  // Mốc thời gian xử lý xong + chi nhánh xác nhận — hiện cả 2 kèm khoảng cách giữa chúng để thấy
  // ngay chi nhánh xác nhận chậm hay nhanh sau khi kỹ thuật báo xong, không cần mở Lịch sử mới biết.
  const moc = (t.xongLuc || t.xacNhanLuc) ? '<div class="sc-grid">'+
      (t.xongLuc ? '<div class="r"><i>Xử lý xong</i><b>'+fmtVN(t.xongLuc)+'</b></div>' : '')+
      (t.xacNhanLuc ? '<div class="r"><i>Chi nhánh xác nhận</i><b>'+fmtVN(t.xacNhanLuc)+
        (fmtKhoangCach(t.xongLuc,t.xacNhanLuc) ? ' <span style="font-weight:500;color:var(--txt-mute)">(sau '+fmtKhoangCach(t.xongLuc,t.xacNhanLuc)+')</span>' : '')+
        '</b></div>' : '')+
    '</div>' : '';

  return '<article class="sc" id="sc-'+esc(t.maSuCo)+'" data-p="'+t.mucDo+'">'+
    '<div class="sc-top"><div>'+
      '<div class="sc-name">'+esc(loai.ten)+' <span class="pri pri-'+t.mucDo+'">'+MUC_DO_LABEL[t.mucDo]+'</span> <span class="st-pill">'+(TRANG_THAI_LABEL[t.trangThai]||t.trangThai)+'</span>'+slaBadge+'</div>'+
      '<div style="font-size:13px;color:var(--txt-mute)">'+esc(t.chinhanhTen)+(t.phong?' · '+esc(t.phong):'')+' · báo lúc '+created+'</div>'+
    '</div><span class="sc-code">'+esc(t.maSuCo)+'</span></div>'+
    (t.soLanQuayLai>0 ? '<div class="sc-flag">🚩 Đã quay lại xử lý '+t.soLanQuayLai+' lần</div>' : '') +
    (t.moTa ? '<div class="sc-note">💬 '+esc(t.moTa)+'</div>' : '') +
    photos(t.anhBaoLoi,'ảnh báo lỗi') +
    (t.kyThuatTen ? '<div class="sc-grid"><div class="r"><i>Kỹ thuật</i><b>'+esc(t.kyThuatTen)+'</b></div></div>' : '') +
    (t.moTaBoSung ? '<div class="sc-note">↩️ Chi nhánh báo chưa xong: '+esc(t.moTaBoSung)+'</div>' : '') +
    photos(t.anhHoanThanh,'ảnh hoàn thành') +
    moc +
    (buoc ? '<div class="sc-buoc"><div class="steps">'+buoc.ten.map((x,i)=>'<i class="'+(i<buoc.n?'on':'')+'"></i>').join('')+'</div>'+
      '<div class="lbl">'+buoc.ten.map(x=>'<span>'+x+'</span>').join('')+'</div></div>' : '') +
    (chinh ? '<div class="sc-chinh">'+chinh+'</div>' : '') +
    '<div class="sc-act">'+acts+'</div>' +
    '</article>';
}

/* ─── xem lịch sử xử lý đầy đủ (mốc thời gian từng bước + ảnh) ─── */
const HANHDONG_LABEL = {
  TAO:'📝 Tạo ticket', TIEP_NHAN:'✓ Admin tiếp nhận', DIEU_PHOI:'📍 Điều phối kỹ thuật',
  NHAN_VIEC:'👷 Kỹ thuật nhận việc', BAT_DAU_XU_LY:'🔧 Bắt đầu xử lý', BAO_XONG:'✅ Kỹ thuật báo xong',
  XAC_NHAN_XONG:'✅ Chi nhánh xác nhận xong', CHUA_XONG:'↩️ Chi nhánh báo chưa xong', DONG:'🔒 Đóng ticket',
  TU_NHAN:'🙋 Kỹ thuật tự nhận việc', SUA:'✏️ Sửa báo cáo', XOA:'🗑️ Xoá', KHOIPHUC:'↩️ Khôi phục', TRAO_DOI:'💬 Trao đổi'
};
/* ─── TRAO ĐỔI THEO SỰ CỐ (05/11/2026) ───
   Chi nhánh ↔ kỹ thuật ↔ admin nhắn qua lại (chữ + ảnh) ngay trong modal Lịch sử — lưu cùng phiếu, khỏi
   phải hỏi nhau qua Zalo rồi mất dấu. Ai được nhắn = đúng luật ở Worker (coTheTraoDoi): admin; quản lý
   của chính chi nhánh; kỹ thuật đang được giao. Ticket đã đóng thì chỉ xem. Ảnh dùng CHUNG bộ hàm chụp
   ảnh/thư viện với form báo sự cố & báo xong (moCamera / onPickAnh / drawPhotoBox) — 1 nguồn duy nhất. */
function coTheTraoDoi(t){
  if(!t || !SESSION || t.trangThai==='dong') return false;
  if(coQCN('BAOTRI.BAO', t.chinhanhId)) return true;     // quyền Báo & trao đổi ở chi nhánh của phiếu (giống Worker)
  if(isKyThuat()) return t.kyThuatDuocGiao===SESSION.user;
  return false;
}
function nguoiNhanTraoDoi(t){
  if(laChiNhanh()) return t.kyThuatDuocGiao ? 'kỹ thuật đang phụ trách ('+esc(t.kyThuatTen||t.kyThuatDuocGiao)+')' : 'admin (chưa có kỹ thuật phụ trách)';
  if(isKyThuat()) return 'quản lý chi nhánh '+esc(t.chinhanhTen);
  return 'quản lý chi nhánh'+(t.kyThuatDuocGiao ? ' và kỹ thuật '+esc(t.kyThuatTen||t.kyThuatDuocGiao) : '');
}
const LOI_TRAO_DOI = {
  CAN_NOI_DUNG:'Nhập nội dung hoặc kèm ảnh trước khi gửi.', DA_DONG:'Sự cố đã đóng — không trao đổi thêm. Lỗi lại thì báo sự cố mới.',
  FORBIDDEN:'Bạn không được trao đổi trên sự cố này.', ANH_QUA_LON:'Có ảnh quá lớn — xoá ảnh đó rồi chụp/chọn lại.',
  QUA_NHIEU_ANH:'Tối đa '+SO_ANH_TOI_DA+' ảnh mỗi lần gửi.', ANH_LOI:'Ảnh không đúng định dạng — chọn ảnh khác.', NOT_FOUND:'Không tìm thấy sự cố (có thể đã bị xoá).'
};
/** Mở modal Lịch sử & trao đổi. moKhung = true → cuộn tới khung nhắn tin và đặt con trỏ sẵn. */
async function xemLichSu(maSuCo, moKhung){
  LS_MA_DANG_MO = maSuCo;
  TD_ANH = [];
  $('lsTieuDe').textContent = 'Lịch sử & trao đổi — '+maSuCo;
  $('lsBody').innerHTML = '<div class="sk" style="height:70px"></div><div class="sk" style="height:70px"></div>';
  $('modalOverlay').style.display='flex';
  moModalCoBack();
  await veLichSu(maSuCo, moKhung);
}
async function veLichSu(maSuCo, moKhung){
  const t = SUCO.find(x=>x.maSuCo===maSuCo);
  try{
    const j = await api({action:'suco_lichsu', maSuCo});
    if(!j.ok) throw new Error(j.error);
    if(LS_MA_DANG_MO !== maSuCo) return;   // người dùng đã đóng / mở phiếu khác trong lúc chờ
    const anhNho = ds => '<div class="sc-photos">'+ds.map((u,i)=>'<img src="'+esc(driveImgUrl(u))+'" loading="lazy" onclick=\''+esc('openXemAnh('+JSON.stringify(ds.map(x=>driveImgUrl(x,2000)))+','+i+')')+'\'>').join('')+'</div>';
    const timeline = j.data.length ? '<div class="ls-timeline">'+j.data.map(l=>{
      const laTD = l.hanhDong==='TRAO_DOI';
      const ten = esc(l.tenNguoi || l.nguoiThucHien) + (l.nguoiThucHien===SESSION.user ? ' (bạn)' : '');
      return '<div class="ls-item'+(laTD?' td':'')+'"><div class="ls-dot"></div><div>'+
        '<div style="font-weight:700;font-size:13.5px">'+(HANHDONG_LABEL[l.hanhDong]||esc(l.hanhDong))+'</div>'+
        '<div style="font-size:12px;color:var(--txt-mute)">'+fmtVN(l.luc)+' · '+ten+'</div>'+
        (laTD ? '<div class="td-bong">'+(l.ghiChu?esc(l.ghiChu):'<i style="color:var(--txt-mute)">(chỉ gửi ảnh)</i>')+((l.anh&&l.anh.length)?anhNho(l.anh):'')+'</div>'
              : (l.ghiChu?'<div style="font-size:12.5px;margin-top:3px">'+esc(l.ghiChu)+'</div>':''))+
      '</div></div>';
    }).join('')+'</div>' : '<div class="empty" style="padding:24px 0">Chưa có lịch sử.</div>';

    const khungTD = coTheTraoDoi(t) ? '<div class="td-khung" id="tdKhung">'+
        '<h4 style="font-size:13.5px;margin:0 0 2px">💬 Nhắn về sự cố này</h4>'+
        '<div class="td-mo">Tin gửi tới '+nguoiNhanTraoDoi(t)+' qua Telegram riêng (nếu đã kết nối) và lưu luôn vào lịch sử. Kèm ảnh nếu cần, tối đa '+SO_ANH_TOI_DA+' ảnh.</div>'+
        '<textarea id="tdNoiDung" rows="3" maxlength="500" placeholder="Vd: mic tay nào rè, đã thử gì, cần chuẩn bị linh kiện gì…"></textarea>'+
        '<div class="photo-pick-row">'+
          '<button type="button" class="btn btn-ghost btn-sm" onclick="moCamera({boxId:\'tdPhotoBox\', storeVar:\'TD_ANH\', inputDuPhong:\'tdAnhCam\'})">📷 Chụp ảnh</button>'+
          '<button type="button" class="btn btn-ghost btn-sm" onclick="$(\'tdAnhLib\').click()">🖼️ Thư viện</button>'+
          '<button type="button" class="btn btn-y btn-sm" id="tdGui" style="margin-left:auto" onclick="chanBamKep(this,guiTraoDoi,\''+esc(maSuCo)+'\')">Gửi</button>'+
        '</div>'+
        '<input type="file" id="tdAnhCam" accept="image/*" capture="environment" style="display:none" onchange="onPickAnh(this,\'tdPhotoBox\',\'TD_ANH\')">'+
        '<input type="file" id="tdAnhLib" accept="image/*" multiple style="display:none" onchange="onPickAnh(this,\'tdPhotoBox\',\'TD_ANH\')">'+
        '<div class="photobox" id="tdPhotoBox"></div>'+
      '</div>' : '';

    const anhBaoLoi = '<h4 style="font-size:13.5px;margin:16px 0 8px">📷 Ảnh báo lỗi</h4>' +
      ((t && t.anhBaoLoi && t.anhBaoLoi.length) ?
        '<div class="sc-photos">'+t.anhBaoLoi.map((u,i)=>'<img src="'+esc(driveImgUrl(u))+'" loading="lazy" onclick=\''+esc('openXemAnh('+JSON.stringify(t.anhBaoLoi.map(x=>driveImgUrl(x,2000)))+','+i+')')+'\'>').join('')+'</div>' :
        '<div style="font-size:12.5px;color:var(--txt-mute)">Không có ảnh đính kèm.</div>');
    const anhXong = '<h4 style="font-size:13.5px;margin:16px 0 8px">📷 Ảnh hoàn thành</h4>' +
      ((t && t.anhHoanThanh && t.anhHoanThanh.length) ?
        '<div class="sc-photos">'+t.anhHoanThanh.map((u,i)=>'<img src="'+esc(driveImgUrl(u))+'" loading="lazy" onclick=\''+esc('openXemAnh('+JSON.stringify(t.anhHoanThanh.map(x=>driveImgUrl(x,2000)))+','+i+')')+'\'>').join('')+'</div>' :
        '<div style="font-size:12.5px;color:var(--txt-mute)">Kỹ thuật chưa đính kèm ảnh khi báo xong.</div>');

    const moTaDau = (t && t.moTa) ? '<div class="sc-note" style="margin-bottom:12px">💬 '+esc(t.moTa)+'</div>' : '';
    $('lsBody').innerHTML = moTaDau + timeline + khungTD + anhBaoLoi + anhXong;
    if(TD_ANH.length) drawPhotoBox('tdPhotoBox','TD_ANH');
    if(moKhung && $('tdKhung')){
      $('tdKhung').scrollIntoView({block:'center'});
      // Không tự bật bàn phím trên điện thoại (che mất lịch sử) — chỉ đặt con trỏ sẵn trên máy tính
      if(window.matchMedia && window.matchMedia('(pointer:fine)').matches) $('tdNoiDung').focus();
    }
  }catch(e){
    if(LS_MA_DANG_MO === maSuCo) $('lsBody').innerHTML = '<div class="empty" style="padding:24px 0">Không tải được lịch sử.</div>';
  }
}
async function guiTraoDoi(maSuCo){
  const nd = ($('tdNoiDung') ? $('tdNoiDung').value : '').trim();
  if(!nd && !TD_ANH.length) return toast(LOI_TRAO_DOI.CAN_NOI_DUNG,'bad');
  try{
    const j = await api({action:'suco_traodoi', maSuCo, noiDung:nd, anh: TD_ANH.length ? TD_ANH : undefined});
    if(!j.ok) return toast(LOI_TRAO_DOI[j.error] || ('Không gửi được: '+j.error),'bad');
    TD_ANH = [];
    toast('Đã gửi.','ok');
    const t = SUCO.find(x=>x.maSuCo===maSuCo);
    if(t){ t.soTraoDoi = (t.soTraoDoi||0) + 1; if(TAB==='baotri') drawSuCo(); }
    await veLichSu(maSuCo, true);
  }catch(e){
    // Action GHI không tự gửi lại (tránh gửi trùng) — báo rõ để người dùng xem lịch sử rồi mới gửi lại.
    toast(['QUA_HAN','MAT_MANG','MAY_CHU_LOI'].includes(e.message)
      ? moTaLoiKetNoi(e)+' Tin có thể đã tới hoặc chưa — đóng mở lại Lịch sử để kiểm tra trước khi gửi lại.'
      : e.message, 'bad');
  }
}

/** Xem lại danh sách ticket ĐÃ XOÁ — siêu admin có thêm nút Khôi phục (mới, 20/09/2026; trước đây
 *  cố tình không có nút này, xem lịch sử ghi chú ở layDanhSachSuCoDaXoa bên Code.gs — nay đổi theo
 *  yêu cầu "lỡ xoá nhầm thì khôi phục lại được"). Tái dùng đúng modal "Lịch sử" có sẵn thay vì dựng
 *  modal riêng, vì chỉ 1 modal hiện tại 1 lúc, không xung đột (mới, 11/09/2026). */
async function xemSuCoDaXoa(){
  $('lsTieuDe').textContent = '🗑️ Sự cố đã xoá';
  $('lsBody').innerHTML = '<div class="sk" style="height:70px"></div><div class="sk" style="height:70px"></div>';
  $('modalOverlay').style.display='flex';
  moModalCoBack();
  try{
    const j = await api({action:'suco_list_da_xoa'});
    if(!j.ok) throw new Error(j.error);
    $('lsBody').innerHTML = j.data.length ? j.data.map(t=>{
      const loai = LOAI_LOI[t.loaiLoi] || {ten:'Khác'};
      return '<div style="padding:12px 0;border-bottom:1px solid var(--line-soft)">'+
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
        '<div style="font-weight:700;font-size:14px">'+esc(t.maSuCo)+' — '+esc(t.chinhanhTen)+(t.phong?' / '+esc(t.phong):'')+'</div>'+
        (SESSION.sieuAdmin ? '<button class="btn btn-ok btn-sm" style="flex:none" onclick="chanBamKep(this,khoiPhucSuCo,\''+t.maSuCo+'\')">↩️ Khôi phục</button>' : '')+
        '</div>'+
        '<div style="font-size:12.5px;color:var(--txt-mute);margin-top:2px">'+esc(loai.ten)+' · Báo lúc '+fmtVN(t.taoLuc)+'</div>'+
        (t.moTa?'<div style="font-size:13px;margin-top:4px">'+esc(t.moTa)+'</div>':'')+
        '<div style="font-size:12.5px;color:var(--bad);margin-top:6px">🗑️ Xoá bởi '+esc(t.xoaBoi)+' lúc '+fmtVN(t.xoaLuc)+'</div>'+
        (t.lyDoXoa?'<div style="font-size:12.5px;color:var(--txt-mute)">Lý do: '+esc(t.lyDoXoa)+'</div>':'')+
      '</div>';
    }).join('') : '<div class="empty" style="padding:24px 0">Chưa có sự cố nào bị xoá.</div>';
  }catch(e){ $('lsBody').innerHTML = '<div class="empty" style="padding:24px 0">Không tải được danh sách.</div>'; }
}

/** Khôi phục 1 ticket đã xoá nhầm — chỉ siêu admin thấy nút này (kiểm tra lại quyền ở server, nút ẩn
 *  chỉ là lớp che ở UI, giống hệt xoaSuCo() bên dưới). Ticket trở lại y nguyên trạng thái trước khi bị
 *  xoá, hiện lại ở mọi danh sách/bảng/bản đồ (mới, 20/09/2026). */
async function khoiPhucSuCo(maSuCo){
  if(!confirm('Khôi phục ticket '+maSuCo+'? Ticket sẽ hiện lại bình thường ở mọi danh sách.')) return;
  try{
    const j = await api({action:'suco_khoiphuc', maSuCo});
    if(!j.ok) throw new Error(j.error);
    toast('Đã khôi phục ticket '+maSuCo+'.','ok');
    xemSuCoDaXoa();   // vẽ lại khung "đã xoá" cho mất dòng vừa khôi phục
    loadSuCo(true);   // và cho ticket hiện lại ngay ở khung chính, không cần đợi tới chu kỳ tự làm mới
  }catch(e){
    toast(e.message==='FORBIDDEN' ? 'Bạn không có quyền khôi phục.' : 'Không khôi phục được, thử lại.','bad');
  }
}

/** Xoá (ẩn) 1 ticket báo nhầm/trùng lặp — chỉ siêu admin thấy nút này (kiểm tra lại quyền ở server,
 *  nút ẩn chỉ là lớp che ở UI). KHÔNG xoá thật khỏi sheet — server chỉ đánh dấu daXoa=Y, ticket biến
 *  mất khỏi mọi danh sách/bảng/xuất file nhưng dữ liệu gốc vẫn còn để đối chiếu sau này nếu cần. Bắt
 *  buộc nhập lý do (prompt, không phải confirm 1 cú bấm) để tránh xoá nhầm/xoá cho vui, và để lại vết
 *  rõ ràng hơn trong lịch sử (mới, 11/09/2026). */
async function xoaSuCo(maSuCo){
  const lyDo = prompt('Vì sao xoá ticket '+maSuCo+'? (bắt buộc nhập — vd "báo trùng với SCxxxx", "báo nhầm chi nhánh"). Ticket sẽ biến mất khỏi mọi danh sách, dữ liệu gốc vẫn được giữ lại để đối chiếu sau này nếu cần.');
  if(lyDo===null) return;
  if(!lyDo.trim()) return toast('Phải nhập lý do mới xoá được.','bad');
  try{
    const j = await api({action:'suco_xoa', maSuCo, lyDo:lyDo.trim()});
    if(!j.ok) throw new Error(j.error);
    toast('Đã xoá ticket '+maSuCo+'.','ok');
    loadSuCo(true);
  }catch(e){
    const map = {FORBIDDEN:'Bạn không có quyền xoá.',
      DA_XU_LY_KHONG_XOA_DUOC:'Sự cố đã được tiếp nhận/xử lý, không tự xoá được nữa — gọi điện hoặc nhắn Zalo cho quản trị hệ thống nếu cần huỷ.'};
    toast(map[e.message] || 'Không xoá được, thử lại.','bad');
  }
}

/* ─── các hành động chuyển trạng thái ─── */
async function tiepNhan(maSuCo, mucDoHienTai){
  const v = prompt('Xác nhận mức độ ưu tiên (1=Khẩn cấp, 2=Cao, 3=Trung bình, 4=Thấp):', mucDoHienTai);
  if(v===null) return;
  const mucDo = Number(v); if(![1,2,3,4].includes(mucDo)) return toast('Nhập số từ 1 đến 4.','bad');
  try{
    const j = await api({action:'suco_tiepnhan', maSuCo, mucDo});
    if(!j.ok) throw new Error(j.error);
    toast('Đã tiếp nhận '+maSuCo+'.','ok'); loadSuCo(true);
  }catch(e){ toast('Không thực hiện được.','bad'); }
}

let dpMaSuCo = null;
function openDieuPhoi(maSuCo){
  dpMaSuCo = maSuCo;
  const t = SUCO.find(x=>x.maSuCo===maSuCo); if(!t) return;
  $('dpTicketInfo').textContent = maSuCo+' — '+t.chinhanhTen+(t.phong?' / '+t.phong:'');
  const list = KYTHUAT.filter(k=>k.vaitro === (t.loaiKT==='mang'?'kythuat_mang':'kythuat'));
  const withDist = list.map(k=>{
    const a = branchCoord(k.chinhanhGoc), b = branchCoord(t.chinhanhId);
    const km = (a&&b) ? haversine(a.lat,a.lng,b.lat,b.lng) : null;
    return {...k, km};
  }).sort((a,b)=> (a.km??999)-(b.km??999));
  $('dpKyThuat').innerHTML = withDist.length ? withDist.map(k=>
    '<option value="'+esc(k.user)+'">'+esc(k.hoten)+(k.km!=null?' — cách ~'+k.km.toFixed(1)+'km':'')+'</option>'
  ).join('') : '<option value="">Chưa có kỹ thuật viên phù hợp — tạo tài khoản vai trò kythuat/kythuat_mang trước</option>';
  $('formDieuPhoi').style.display='block';
  requestAnimationFrame(()=>$('formDieuPhoi').scrollIntoView({behavior:'smooth',block:'start'}));
}
async function submitDieuPhoi(){
  const kt = $('dpKyThuat').value;
  if(!kt) return toast('Chưa có kỹ thuật viên để chọn.','bad');
  try{
    const j = await api({action:'suco_dieuphoi', maSuCo:dpMaSuCo, kyThuat:kt});
    if(!j.ok) throw new Error(j.error);
    toast('Đã điều phối '+dpMaSuCo+'.','ok');
    $('formDieuPhoi').style.display='none';
    loadSuCo(true);
  }catch(e){ toast('Không điều phối được.','bad'); }
}

/* ─── bản đồ điều phối — ticket đang mở theo mức độ + vị trí ước lượng kỹ thuật viên. Admin luôn
   xem được; kỹ thuật viên xem được khi admin bật cờ kythuat_xem_bando (xem enterApp() và Cài đặt) ─── */
let banDoBT = null, lopTicketBT = null, lopKTBT = null;
const MAU_MUC_DO = {1:'#FF5C7A', 2:'#FFB020', 3:'#FFD21A', 4:'#3DDC97'};
const NGUON_VITRI_LABEL = {gps:'📍 Vị trí GPS thật', dang_xu_ly:'🔧 Đang xử lý tại', vua_xong:'✅ Vừa xử lý xong tại', mac_dinh:'🏠 Chi nhánh xuất phát (chưa có dữ liệu vị trí thật)'};

function toggleBaoTriView(view){
  if(!kieuXemDuocPhep().includes(view)) view = 'list';   // quản lý chi nhánh chỉ có Danh sách
  const isMap = view==='map', isTable = view==='table', isKanban = view==='kanban';
  $('btnBtListView').className = 'btn btn-sm ' + (view==='list'?'btn-y':'btn-ghost');
  $('btnBtMapView').className = 'btn btn-sm ' + (isMap?'btn-y':'btn-ghost');
  $('btnBtTableView').className = 'btn btn-sm ' + (isTable?'btn-y':'btn-ghost');
  $('btnBtKanbanView').className = 'btn btn-sm ' + (isKanban?'btn-y':'btn-ghost');
  $('viewSuCoList').style.display = (isMap||isTable||isKanban) ? 'none' : '';
  $('mapBaoTri').style.display = isMap?'block':'none';
  $('mapChuThich').style.display = isMap?'flex':'none';
  $('viewSuCoTable').style.display = isTable?'':'none';
  $('viewSuCoKanban').style.display = isKanban?'':'none';
  document.body.classList.toggle('kb-mode', isKanban && TAB==='baotri');   // Kanban: bề ngang tối đa
  if(isMap) veBanDoBaoTri();
  if(isTable) drawSuCoTable();
  if(isKanban) drawSuCoKanban();
  // Kỹ thuật: tab "Bản đồ" ở thanh dưới sáng khi đang xem bản đồ, ngược lại sáng "Việc của tôi"
  if(TAB==='baotri' && isKyThuat() && $('tabBanDo').style.display!=='none'){
    $('tabBanDo').setAttribute('aria-selected', isMap ? 'true' : 'false');
    document.querySelector('.tab[data-t="baotri"]').setAttribute('aria-selected', isMap ? 'false' : 'true');
  }
}

/* ─── KANBAN (05/11/2026, chỉ admin) ───
   Gom sự cố ĐANG MỞ thành 6 cột theo khâu đang chờ — thấy ngay phiếu kẹt ở đâu (chưa tiếp nhận, chưa
   điều phối, kỹ thuật chưa bắt đầu, chờ chi nhánh xác nhận…). Dùng chung ô tìm kiếm trên cùng và đúng
   cách sắp xếp người dùng đã chọn ở khung Danh sách (mặc định mới nhất trước). Nút trên thẻ = đúng các
   hành động admin sẵn có (tiepNhan/openDieuPhoi/dongTicket), không thêm logic mới. */
const COT_KANBAN = [
  { ma:'moi',      ten:'🆕 Mới báo',                tt:['moi'],                      goiY:'Chờ tiếp nhận' },
  { ma:'tiepnhan', ten:'📥 Đã tiếp nhận',           tt:['da_tiep_nhan'],             goiY:'Chờ điều phối kỹ thuật' },
  { ma:'giao',     ten:'👷 Đã giao kỹ thuật',       tt:['da_dieu_phoi','da_nhan'],   goiY:'Kỹ thuật chưa bắt đầu xử lý' },
  { ma:'xuly',     ten:'🔧 Đang xử lý',             tt:['dang_xu_ly'],               goiY:'' },
  { ma:'xacnhan',  ten:'⏳ Chờ chi nhánh xác nhận', tt:['cho_xac_nhan'],             goiY:'Kỹ thuật đã báo xong' },
  { ma:'chodong',  ten:'🔒 Chờ đóng',               tt:['cho_dong'],                 goiY:'Chi nhánh đã xác nhận xong' }
];
/* Kỹ thuật viên chỉ có 4 cột — phiếu của họ không bao giờ ở "Mới báo" (12/11/2026) */
const COT_KANBAN_KT = [
  { ma:'tiepnhan', ten:'🙋 Có thể tự nhận',          tt:['da_tiep_nhan'],             goiY:'Chưa giao cho ai' },
  { ma:'giao',     ten:'👷 Mới giao cho bạn',        tt:['da_dieu_phoi','da_nhan'],   goiY:'Nhận việc rồi bắt đầu xử lý' },
  { ma:'xuly',     ten:'🔧 Đang xử lý',              tt:['dang_xu_ly'],               goiY:'' },
  { ma:'xacnhan',  ten:'⏳ Chờ chi nhánh xác nhận',  tt:['cho_xac_nhan','cho_dong'],  goiY:'Bạn đã báo xong' }
];
/* Ghim chi nhánh trên Kanban (12/11/2026) — nhớ trong phiên, vẽ lại (tự cập nhật mỗi phút) vẫn giữ. */
let KB_GHIM = null;
function ghimChiNhanhKanban(id){
  KB_GHIM = (KB_GHIM===id) ? null : id;
  apDungGhimKanban();
}
function apDungGhimKanban(){
  const v = $('viewSuCoKanban'), w = $('kanbanCot'), bar = $('kbGhimBar');
  if(!v || !w || !bar) return;
  const the = KB_GHIM ? [...w.querySelectorAll('.kb-the')].filter(e=>e.dataset.cn===KB_GHIM) : [];
  if(KB_GHIM && !the.length) KB_GHIM = null;   // chi nhánh không còn phiếu nào đang hiện → tự bỏ ghim
  w.classList.toggle('ghim', !!KB_GHIM);
  v.classList.toggle('co-ghim', !!KB_GHIM);
  w.querySelectorAll('.kb-the').forEach(e=>e.classList.toggle('cung', !!KB_GHIM && e.dataset.cn===KB_GHIM));
  if(!KB_GHIM){ bar.innerHTML = ''; return; }
  const phanBo = [...w.querySelectorAll('.kb-cot')].map(c=>({
    ma:c.dataset.cot, ten:c.querySelector('header b').textContent.replace(/^\S+\s/,''),
    n:c.querySelectorAll('.kb-the.cung').length })).filter(x=>x.n);
  bar.innerHTML = '<span>📌</span><b>'+esc(the[0].dataset.ten)+'</b><span>'+the.length+' phiếu đang mở:</span>'+
    phanBo.map(x=>'<button type="button" class="kb-gc" onclick="nhayToiPhieuGhim(\''+x.ma+'\')" title="Cuộn tới phiếu đầu tiên trong cột này">'+esc(x.ten)+' ×'+x.n+'</button>').join('')+
    '<button type="button" class="kb-bo" onclick="ghimChiNhanhKanban(KB_GHIM)">✕ Bỏ ghim</button>';
}
function nhayToiPhieuGhim(cot){
  const e = document.querySelector('#kanbanCot .kb-cot[data-cot="'+cot+'"] .kb-the.cung');
  if(e) e.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
}
function drawSuCoKanban(){
  if(!$('viewSuCoKanban')) return;
  capNhatLocCNKT();
  capNhatDsKyThuatLoc('fKbKT');
  const q = norm(($('qSuCo').value||'').trim());
  let ds = locSuCo(SUCO.filter(t=>t.trangThai!=='dong'), $('fKbMuc').value, $('fKbKT').value, $('fKbCN').value, q);
  ds = cheDoSapXepSuCo()==='moinhat'
    ? ds.sort((a,b)=> String(b.taoLuc).localeCompare(String(a.taoLuc)))
    : ds.sort((a,b)=> a.mucDo-b.mucDo || String(b.taoLuc).localeCompare(String(a.taoLuc)));
  $('demKanban').textContent = ds.length;
  const COT = isKyThuat() ? COT_KANBAN_KT : COT_KANBAN;
  // Mỗi chi nhánh có bao nhiêu phiếu đang hiện, nằm ở cột nào → huy hiệu "🔗 +N" trên thẻ
  const demCN = {};
  ds.forEach(t=>{
    const c = COT.find(x=>x.tt.includes(t.trangThai)); if(!c) return;
    const d = demCN[t.chinhanhId] || (demCN[t.chinhanhId] = {n:0, cot:{}});
    d.n++; d.cot[c.ten.replace(/^\S+\s/,'')] = (d.cot[c.ten.replace(/^\S+\s/,'')]||0)+1;
  });
  $('kanbanCot').innerHTML = COT.map(c=>{
    const the = ds.filter(t=>c.tt.includes(t.trangThai));
    return '<section class="kb-cot" data-cot="'+c.ma+'"><header><b>'+c.ten+'</b><span class="st-pill">'+the.length+'</span></header>'+
      (c.goiY ? '<div class="kb-goiy">'+c.goiY+'</div>' : '')+
      '<div class="kb-ds">'+(the.length ? the.map(t=>theKanbanHTML(t, demCN[t.chinhanhId])).join('') : '<div class="kb-trong">Không có</div>')+'</div></section>';
  }).join('');
  apDungGhimKanban();
}
/** Mô tả (cắt 3 dòng) + tối đa 3 ảnh báo lỗi nhỏ, bấm ảnh để phóng to — dành cho KỸ THUẬT trên Bảng/Kanban.
 *  dung = true: chặn sự kiện nổi bọt (thẻ Kanban bấm cả thẻ để mở lịch sử). */
function chiTietNhanhHTML(t, dung){
  const anh = t.anhBaoLoi || [];
  if(!t.moTa && !anh.length) return '';
  const sp = dung ? 'event.stopPropagation();' : '';
  const to = anh.map(x=>driveImgUrl(x,2000));
  return '<div class="bs-ct">'+(t.moTa ? '<div class="ct-mt">💬 '+esc(t.moTa)+'</div>' : '')+
    (anh.length ? '<div class="ct-anh">'+anh.slice(0,3).map((u,i)=>'<img src="'+esc(driveImgUrl(u))+'" alt="ảnh báo lỗi" loading="lazy" onclick=\''+esc(sp+'openXemAnh('+JSON.stringify(to)+','+i+')')+'\'>').join('')+
      (anh.length>3 ? '<span class="ct-them">+'+(anh.length-3)+'</span>' : '')+'</div>' : '')+'</div>';
}
function theKanbanHTML(t, dem){
  const loai = LOAI_LOI[t.loaiLoi] || {ten:'Khác'};
  const sla = slaTrangThai(t);
  const slaCls = {ok:4, warn:2, bad:1}[sla&&sla.cls] || 3;
  const ma = esc(t.maSuCo);
  let acts = isKyThuat() ? nutKyThuat(t, true) : '';
  if(!isKyThuat() && t.trangThai==='moi' && coQCN('BAOTRI.TIEPNHAN', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="event.stopPropagation();chanBamKep(this,tiepNhan,\''+ma+'\','+t.mucDo+')">✓ Tiếp nhận</button>';
  if(!isKyThuat() && ['da_tiep_nhan','da_dieu_phoi'].includes(t.trangThai) && coQCN('BAOTRI.DIEUPHOI', t.chinhanhId)) acts += '<button class="btn btn-y btn-sm" onclick="event.stopPropagation();openDieuPhoi(\''+ma+'\')">📍 '+(t.trangThai==='da_dieu_phoi'?'Đổi KT':'Điều phối')+'</button>';
  if(!isKyThuat() && t.trangThai==='cho_dong' && coQCN('BAOTRI.DONG', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="event.stopPropagation();chanBamKep(this,dongTicket,\''+ma+'\')">🔒 Đóng</button>';
  acts += '<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();xemLichSu(\''+ma+'\',true)">💬'+(t.soTraoDoi?' <span class="td-dem">'+t.soTraoDoi+'</span>':'')+'</button>';
  return '<article class="kb-the" data-p="'+t.mucDo+'" data-cn="'+esc(t.chinhanhId)+'" data-ten="'+esc(t.chinhanhTen)+'" id="kb-'+ma+'" onclick="xemLichSu(\''+ma+'\')" title="Bấm để xem lịch sử & trao đổi">'+
    '<div class="kb-dau"><span class="sc-code">'+ma+'</span><span class="pri pri-'+t.mucDo+'">'+MUC_DO_LABEL[t.mucDo]+'</span></div>'+
    '<div class="kb-cn">'+(dem && dem.n>1
        ? '<span class="kb-cn-b" onclick="event.stopPropagation();ghimChiNhanhKanban(\''+esc(t.chinhanhId)+'\')" title="Bấm để ghim: tô sáng mọi phiếu của chi nhánh này ở các cột">'+esc(t.chinhanhTen)+'</span>'
        : esc(t.chinhanhTen))+(t.phong?' · '+esc(t.phong):'')+
      (dem && dem.n>1 ? '<button type="button" class="kb-lk" onclick="event.stopPropagation();ghimChiNhanhKanban(\''+esc(t.chinhanhId)+'\')" title="'+esc('Chi nhánh này có '+dem.n+' phiếu đang mở: '+Object.entries(dem.cot).map(([k,v])=>k+' ×'+v).join(' · ')+'. Bấm để ghim và tô sáng.')+'">🔗 +'+(dem.n-1)+'</button>' : '')+'</div>'+
    '<div class="kb-phu">'+esc(loai.ten)+(t.kyThuatTen?' · 👷 '+esc(t.kyThuatTen):'')+'</div>'+
    (isKyThuat() ? chiTietNhanhHTML(t, true) : '')+
    '<div class="kb-tg">'+(fmtKhoangCach(t.taoLuc, isoGioVNHienTai()) ? 'báo cách đây '+fmtKhoangCach(t.taoLuc, isoGioVNHienTai()) : 'vừa báo')+
      (sla && sla.text ? ' <span class="pri pri-'+slaCls+'">'+esc(sla.text)+'</span>' : '')+
      (t.soLanQuayLai>0 ? ' <span class="pri pri-1">🚩 quay lại '+t.soLanQuayLai+'</span>' : '')+'</div>'+
    '<div class="kb-act">'+acts+'</div></article>';
}

/** Nút hành động chính của KỸ THUẬT VIÊN theo trạng thái phiếu, dùng cho view Bảng và Kanban (12/11/2026) —
 *  cùng hàm/action như khung Danh sách. dung = true: chặn sự kiện nổi bọt (thẻ Kanban bấm cả thẻ mở lịch sử). */
function nutKyThuat(t, dung){
  const sp = dung ? 'event.stopPropagation();' : '';
  const ma = esc(t.maSuCo);
  let h = '';
  if(t.trangThai==='da_tiep_nhan' && !t.kyThuatDuocGiao && PUBLIC_SETTINGS.kythuatTuNhanViec) h += '<button class="btn btn-ok btn-sm" onclick="'+sp+'chanBamKep(this,tuNhanViec,\''+ma+'\')">🙋 Tự nhận</button>';
  if(t.trangThai==='da_dieu_phoi') h += '<button class="btn btn-y btn-sm" onclick="'+sp+'chanBamKep(this,nhanViec,\''+ma+'\')">👷 Nhận việc</button>';
  if(t.trangThai==='da_nhan') h += '<button class="btn btn-y btn-sm" onclick="'+sp+'chanBamKep(this,batDauXuLy,\''+ma+'\')">🔧 Bắt đầu</button>';
  if(t.trangThai==='dang_xu_ly') h += '<button class="btn btn-ok btn-sm" onclick="'+sp+'openBaoXong(\''+ma+'\')">✓ Báo xong</button>';
  if(['da_nhan','dang_xu_ly'].includes(t.trangThai)) h += '<button class="btn btn-ghost btn-sm" onclick="'+sp+'chiDuong(\''+ma+'\')" title="Chỉ đường">🧭</button>';
  return h;
}

/** Danh sách sự cố đã lọc theo bộ lọc riêng của view Bảng (mới, 08/09/2026) — dùng chung cho cả vẽ
 *  bảng (drawSuCoTable) lẫn xuất CSV (xuatCSVSuCo), giống đúng cách filtered() dùng chung cho
 *  draw()/exportCSV() ở tab Đặt phòng. Không tách "chưa xử lý"/"đã xử lý" thành 2 khung như card
 *  view — đây là bảng TỔNG HỢP 1 dòng/ticket theo đúng yêu cầu của khách hàng (xem ảnh mẫu), mới
 *  nhất lên trên để dễ theo dõi ticket vừa phát sinh. */
function filteredBangSuCo(){
  const q = norm($('qBangSuCo').value.trim());
  const fTT = $('fBangTrangThai').value, fMuc = $('fBangMuc').value, fCN = $('fBangCN').value || locCNKTHienTai();
  return SUCO.filter(t=>{
    if(fTT && t.trangThai!==fTT) return false;
    if(fMuc && String(t.mucDo)!==fMuc) return false;
    if(fCN && t.chinhanhId!==fCN) return false;
    if(q && !norm(t.maSuCo+' '+t.chinhanhTen+' '+t.moTa+' '+(LOAI_LOI[t.loaiLoi]||{}).ten).includes(q)) return false;
    return true;
  }).sort((a,b)=> String(b.taoLuc).localeCompare(String(a.taoLuc)));
}
function drawSuCoTable(){
  capNhatLocCNKT();
  const list = filteredBangSuCo();
  $('demBangSuCo').textContent = list.length;
  $('bangSuCoBody').innerHTML = list.length ? list.map((t,i)=>{
    const loai = LOAI_LOI[t.loaiLoi] || {ten:'Khác'};
    // Cùng đúng 3 hành động của admin bên khung Danh sách (sucoHTML) — tái dùng y hệt hàm cũ
    // (tiepNhan/openDieuPhoi/dongTicket), không viết logic mới, không thêm action nào ở Code.gs.
    let acts = isKyThuat() ? nutKyThuat(t, false) : '';
    if(!isKyThuat() && t.trangThai==='moi' && coQCN('BAOTRI.TIEPNHAN', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="chanBamKep(this,tiepNhan,\''+t.maSuCo+'\','+t.mucDo+')">✓ Tiếp nhận</button>';
    if(!isKyThuat() && ['da_tiep_nhan','da_dieu_phoi'].includes(t.trangThai) && coQCN('BAOTRI.DIEUPHOI', t.chinhanhId)) acts += '<button class="btn btn-y btn-sm" onclick="openDieuPhoi(\''+t.maSuCo+'\')">📍 '+(t.trangThai==='da_dieu_phoi'?'Đổi KT':'Điều phối')+'</button>';
    if(!isKyThuat() && t.trangThai==='cho_dong' && coQCN('BAOTRI.DONG', t.chinhanhId)) acts += '<button class="btn btn-ok btn-sm" onclick="chanBamKep(this,dongTicket,\''+t.maSuCo+'\')">🔒 Đóng</button>';
    acts += '<button class="btn btn-ghost btn-sm" onclick="xemLichSu(\''+t.maSuCo+'\','+(t.trangThai!=='dong')+')" title="Lịch sử & trao đổi">🕘'+(t.soTraoDoi?' <span class="td-dem">'+t.soTraoDoi+'</span>':'')+'</button>';
    if(SESSION.sieuAdmin) acts += '<button class="btn btn-bad btn-sm" onclick="chanBamKep(this,xoaSuCo,\''+t.maSuCo+'\')">🗑️</button>';
    return '<tr>'+
      '<td>'+(i+1)+'</td>'+
      '<td style="white-space:nowrap;font-weight:600">'+esc(t.maSuCo)+'</td>'+
      '<td style="white-space:nowrap">'+fmtVN(t.taoLuc)+'</td>'+
      '<td><span class="st-pill">'+(TRANG_THAI_LABEL[t.trangThai]||t.trangThai)+'</span></td>'+
      '<td>'+esc(t.chinhanhTen)+(t.phong?' / '+esc(t.phong):'')+'</td>'+
      '<td>'+esc(loai.ten)+(isKyThuat() && t.trangThai!=='dong' ? chiTietNhanhHTML(t, false) : '')+'</td>'+
      '<td>'+esc(t.moTa || '—')+'</td>'+
      '<td><span class="pri pri-'+t.mucDo+'">'+MUC_DO_LABEL[t.mucDo]+'</span></td>'+
      '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'+acts+'</div></td>'+
    '</tr>';
  }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--txt-mute);padding:24px">Chưa có dữ liệu.</td></tr>';
}
function xuatCSVSuCo(){
  const rows = filteredBangSuCo();
  if(!rows.length) return toast('Không có dòng nào để xuất.','bad');
  const head = ['No','Ngày tạo yêu cầu','Trạng thái','Chi nhánh','Lỗi','Thông tin chi tiết','Mức độ ưu tiên'];
  const body = rows.map((t,i)=>{
    const loai = LOAI_LOI[t.loaiLoi] || {ten:'Khác'};
    return [i+1, fmtVN(t.taoLuc), TRANG_THAI_LABEL[t.trangThai]||t.trangThai,
      t.chinhanhTen+(t.phong?' / '+t.phong:''), loai.ten, t.moTa||'', MUC_DO_LABEL[t.mucDo]||t.mucDo];
  });
  const csv = '\uFEFF' + [head.join(',')].concat(
    body.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(','))
  ).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = 'boom-baotri-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Đã xuất ' + rows.length + ' dòng.','ok');
}

/** Viền mỏng đồng màu cho cả 4 cạnh 1 ô — dùng chung khi dựng bảng Excel trang trí (xuatExcelSuCo). */
function vienMongO(mauHex){
  const b = { style:'thin', color:{ rgb: mauHex } };
  return { top:b, bottom:b, left:b, right:b };
}

/** Xuất file Excel (.xlsx) có trang trí như 1 bảng báo cáo thật (tiêu đề công ty, tiêu đề cột tô màu
 *  thương hiệu, viền lưới, màu xen kẽ theo dòng, mức độ ưu tiên tô màu theo đúng mức khẩn cấp/cao/
 *  trung bình/thấp) — khác hẳn "Xuất CSV" (chỉ là dữ liệu thô không định dạng). Dùng thư viện
 *  xlsx-js-style (nạp qua thẻ script ở đầu file) vì bản "xlsx" gốc của SheetJS miễn phí KHÔNG ghi
 *  được màu/kiểu chữ khi xuất — chỉ đọc được, không xuất được, nên phải dùng đúng bản fork này.
 *  (mới, 08/09/2026, theo yêu cầu khách hàng cần bảng dễ nhìn để theo dõi.) */
async function xuatExcelSuCo(){
  if(!await canXLSX()) return;
  const rows = filteredBangSuCo();
  if(!rows.length) return toast('Không có dòng nào để xuất.','bad');

  const TIEU_DE = ['No','Ngày tạo yêu cầu','Trạng thái','Chi nhánh','Lỗi','Thông tin chi tiết','Mức độ ưu tiên'];
  const SO_COT = TIEU_DE.length;
  const HANG_TIEU_DE = 4;          // dòng tiêu đề cột (0-based) — sau 3 dòng tiêu đề lớn + 1 dòng trống
  const HANG_BAT_DAU_DU_LIEU = HANG_TIEU_DE + 1;

  const trong7 = new Array(SO_COT).fill('');
  const aoa = [
    ['BOOM MUSIC BOX', ...trong7.slice(1)],
    ['Bảng theo dõi sự cố bảo trì', ...trong7.slice(1)],
    ['Xuất lúc: ' + fmtVN(new Date()), ...trong7.slice(1)],
    trong7,
    TIEU_DE
  ];
  rows.forEach((t,i)=>{
    const loai = LOAI_LOI[t.loaiLoi] || { ten: 'Khác' };
    aoa.push([
      i + 1,
      fmtVNNgay(t.taoLuc),
      TRANG_THAI_LABEL[t.trangThai] || t.trangThai,
      t.chinhanhTen + (t.phong ? ' / ' + t.phong : ''),
      loai.ten,
      t.moTa || '—',
      { 1: 'Khẩn cấp', 2: 'Cao', 3: 'Trung bình', 4: 'Thấp' }[t.mucDo] || t.mucDo
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const hangCuoi = HANG_BAT_DAU_DU_LIEU + rows.length - 1;

  ws['!cols'] = [{wch:5},{wch:12},{wch:22},{wch:30},{wch:24},{wch:45},{wch:14}];
  ws['!merges'] = [0,1,2].map(r => ({ s:{r,c:0}, e:{r,c:SO_COT-1} }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s:{r:HANG_TIEU_DE,c:0}, e:{r:hangCuoi,c:SO_COT-1} }) };
  ws['!rows'] = [];
  ws['!rows'][HANG_TIEU_DE] = { hpx: 30 };
  for(let r=HANG_BAT_DAU_DU_LIEU; r<=hangCuoi; r++) ws['!rows'][r] = { hpx: 32 };

  const dat = (r,c,style) => {
    const dc = XLSX.utils.encode_cell({r,c});
    if(!ws[dc]) ws[dc] = { t:'s', v:'' };
    ws[dc].s = style;
  };

  // 3 dòng tiêu đề lớn — nền tím thương hiệu, chữ vàng, giống đúng màu header các sheet trong Code.gs
  [0,1,2].forEach(r => { for(let c=0;c<SO_COT;c++) dat(r,c,{
    font:{ bold:r===0, italic:r===2, sz:r===0?16:(r===1?12:10), color:{ rgb: r===2?'E3C9F5':'FFD21A' } },
    fill:{ fgColor:{ rgb:'4B1272' } },
    alignment:{ horizontal:'center', vertical:'center' }
  }); });

  // Dòng tiêu đề cột
  for(let c=0;c<SO_COT;c++) dat(HANG_TIEU_DE, c, {
    font:{ bold:true, color:{ rgb:'FFD21A' }, sz:11 },
    fill:{ fgColor:{ rgb:'4B1272' } },
    alignment:{ horizontal:'center', vertical:'center', wrapText:true },
    border: vienMongO('B08FD1')
  });

  // Dữ liệu — màu xen kẽ theo dòng cho dễ đọc, mức độ ưu tiên tô màu riêng theo đúng mức
  const MAU_NEN_MUC = { 1:'FADBD8', 2:'FDEBD0', 3:'FCF3CF', 4:'D5F5E3' };
  const MAU_CHU_MUC = { 1:'C0392B', 2:'AF601A', 3:'9A7D0A', 4:'1E8449' };
  rows.forEach((t,i)=>{
    const r = HANG_BAT_DAU_DU_LIEU + i;
    const nenXen = i % 2 === 1 ? 'F3EAFB' : 'FFFFFF';
    for(let c=0;c<SO_COT;c++) dat(r,c,{
      font:{ sz:10.5, color:{ rgb:'2B1400' } },
      fill:{ fgColor:{ rgb:nenXen } },
      alignment:{ vertical:'center', wrapText:c===5, horizontal:(c===0||c===6)?'center':'left' },
      border: vienMongO('E4D9F0')
    });
    dat(r, 6, {
      font:{ bold:true, sz:10.5, color:{ rgb: MAU_CHU_MUC[t.mucDo]||'2B1400' } },
      fill:{ fgColor:{ rgb: MAU_NEN_MUC[t.mucDo]||'FFFFFF' } },
      alignment:{ horizontal:'center', vertical:'center' },
      border: vienMongO('E4D9F0')
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bao cao su co');
  XLSX.writeFile(wb, 'BoomMusicBox-BaoTri-' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast('Đã xuất ' + rows.length + ' dòng ra Excel.','ok');
}

async function veBanDoBaoTri(){
  // Thư viện bản đồ (Leaflet) tải từ mạng ngoài — mất mạng/bị chặn thì báo nhẹ, không làm hỏng cả trang
  // (quan trọng từ 12/11/2026: Bản đồ có thể là kiểu xem mặc định của người dùng).
  if(typeof L === 'undefined'){ $('mapChuThich').style.display='flex'; toast('Chưa tải được bản đồ (kiểm tra mạng rồi thử lại).','bad'); return; }
  if(!banDoBT){
    banDoBT = L.map('mapBaoTri', {zoomControl:true}).setView([10.7626,106.6602], 11);
    // OpenStreetMap trực tiếp (tile.openstreetmap.org) đã CHẶN truy cập từ web này (10/09/2026) —
    // máy chủ chạy bằng quyên góp, tự động chặn web thương mại/traffic lớn không báo trước. Đổi sang
    // CARTO (key lấy tại carto.com/basemaps/apikey, đã cấp cho anh Hưng, đổi ở đây nếu key khác).
    L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3fkd_1_4c34c31f6750de7022a35b5f', {maxZoom:19, attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(banDoBT);
    lopTicketBT = L.layerGroup().addTo(banDoBT);
    lopKTBT = L.layerGroup().addTo(banDoBT);
  }
  lopTicketBT.clearLayers(); lopKTBT.clearLayers();
  const diem = [];

  // Ticket đang mở (chưa đóng), lấy toạ độ theo chi nhánh từ BRANCHES đã tải sẵn
  capNhatLocCNKT();
  const cnLoc = locCNKTHienTai();
  SUCO.filter(t=>t.trangThai!=='dong' && (!cnLoc || t.chinhanhId===cnLoc)).forEach(t=>{
    const br = BRANCHES.find(b=>b.id===t.chinhanhId);
    if(!br || !br.lat) return;
    const loai = LOAI_LOI[t.loaiLoi] || LOAI_LOI.khac || {ten:"Khác"};
    const m = L.circleMarker([br.lat,br.lng], {radius:11, weight:2, color:'#fff', fillColor:MAU_MUC_DO[t.mucDo]||'#8B7BA5', fillOpacity:.92}).addTo(lopTicketBT);
    // Ticket chưa ai phụ trách + kỹ thuật viên đang xem + tính năng tự nhận đang bật → thêm nút tự
    // nhận thẳng trong popup, không cần quay lại khung Danh sách mới bấm được.
    const coTheTuNhan = isKyThuat() && PUBLIC_SETTINGS.kythuatTuNhanViec && t.trangThai==='da_tiep_nhan' && !t.kyThuatDuocGiao;
    m.bindPopup('<b>'+esc(t.maSuCo)+'</b> — '+esc(loai.ten)+'<br>'+esc(br.name)+(t.phong?' · '+esc(t.phong):'')+
      '<br>'+(TRANG_THAI_LABEL[t.trangThai]||t.trangThai)+(t.kyThuatTen?' · '+esc(t.kyThuatTen):'')+
      (isKyThuat() ? chiTietNhanhHTML(t, false) : '')+
      (coTheTuNhan ? '<br><button class="btn btn-ok btn-sm" style="margin-top:6px" onclick="chanBamKep(this,tuNhanViec,\''+t.maSuCo+'\')">🙋 Tự nhận việc</button>' : ''));
    diem.push([br.lat,br.lng]);
  });

  // Vị trí kỹ thuật viên — admin luôn xem được; kỹ thuật viên chỉ xem được lẫn nhau khi admin đã bật
  // riêng cờ "Cho xem vị trí đồng nghiệp" (cờ này TÁCH RIÊNG khỏi 2 cờ kia, xem readPublicSettings).
  if(coQ('BAOTRI.DIEUPHOI') || (isKyThuat() && PUBLIC_SETTINGS.kythuatXemViTriDongNghiep)) try{
    const j = await api({action:'kythuat_vitri_list'});
    if(j.ok) j.data.forEach(v=>{
      const icon = L.divIcon({html:'👷', className:'kt-marker', iconSize:[30,30]});
      const m = L.marker([v.lat,v.lng], {icon}).addTo(lopKTBT);
      const nhan = NGUON_VITRI_LABEL[v.nguon] || v.nguon;
      m.bindPopup('<b>'+esc(v.hoten)+'</b><br>'+nhan+(v.chinhanhTen?' '+esc(v.chinhanhTen):'')+
        (v.luc?'<br><span style="color:var(--txt-mute);font-size:12px">'+fmtVN(v.luc)+'</span>':''));
      diem.push([v.lat,v.lng]);
    });
  }catch(e){}

  // Ưu tiên vị trí HIỆN TẠI của kỹ thuật viên khi họ mở bản đồ (mới, 17/08/2026) — để mở lên là thấy
  // ngay sự cố GẦN MÌNH nhất, không phải tự kéo/tìm giữa toàn bộ chi nhánh cả nước. Chủ động xin vị
  // trí MỚI ngay lúc này (không chỉ dùng bản lưu từ lượt gửi định kỳ trước, có thể đã cũ tới 5 phút).
  // Nếu bị từ chối quyền hoặc không lấy được, lặng lẽ rơi về cách cũ (fit vừa toàn bộ điểm đang có).
  let viTriToi = null;
  if(isKyThuat()){
    viTriToi = await guiViTriHienTai();
    if(viTriToi){
      const iconToi = L.divIcon({html:'🔵', className:'kt-marker-toi', iconSize:[26,26]});
      L.marker([viTriToi.lat, viTriToi.lng], {icon:iconToi, zIndexOffset:1000}).addTo(lopKTBT)
        .bindPopup('<b>📍 Vị trí của bạn</b>');
    }
  }

  if(viTriToi){
    banDoBT.setView([viTriToi.lat, viTriToi.lng], 13);
  } else if(diem.length){
    banDoBT.fitBounds(diem, {padding:[30,30], maxZoom:15});
  }
  setTimeout(()=>banDoBT.invalidateSize(), 200);
}

async function nhanViec(maSuCo){
  guiViTriHienTai();
  try{ const j = await api({action:'suco_nhanviec', maSuCo}); if(!j.ok) throw 0; toast('Đã nhận việc '+maSuCo+'.','ok'); loadSuCo(true); }
  catch(e){ toast('Không thực hiện được.','bad'); }
}
/* Tự nhận 1 ticket chưa ai điều phối (mới, 17/08/2026) — khác nhanViec() ở chỗ ticket này CHƯA được
   admin giao cho ai, nên có thể bị người khác nhận mất giữa lúc mình đang xem — luôn tải lại danh
   sách sau khi thử, kể cả khi lỗi, để thấy ngay trạng thái mới nhất thay vì tưởng nhầm là còn trống. */
async function tuNhanViec(maSuCo){
  guiViTriHienTai();
  try{
    const j = await api({action:'suco_tunhan', maSuCo});
    if(!j.ok) throw new Error(j.error);
    toast('Đã tự nhận '+maSuCo+'. Chúc bạn xử lý thuận lợi!','ok');
  }catch(e){
    const msg = {DA_CO_NGUOI_NHAN:'Chậm một chút — đã có người khác nhận ticket này trước rồi.',
      BAD_STATE:'Ticket không còn ở trạng thái chờ nhận nữa.',
      SAI_LOAI_KY_THUAT:'Ticket này cần đúng loại kỹ thuật khác (chung/mạng), không dành cho bạn.',
      TINH_NANG_DANG_TAT:'Tính năng tự nhận việc đang tắt.'}[e.message] || 'Không nhận được, thử lại.';
    toast(msg,'bad');
  }
  loadSuCo(true);
}
async function batDauXuLy(maSuCo){
  guiViTriHienTai();
  try{ const j = await api({action:'suco_batdau', maSuCo}); if(!j.ok) throw 0; toast('Đã chuyển sang đang xử lý.','ok'); loadSuCo(true); }
  catch(e){ toast('Không thực hiện được.','bad'); }
}

let bxMaSuCo = null;
function openBaoXong(maSuCo){
  bxMaSuCo = maSuCo; SC_ANH_XONG = []; $('bxPhotoBox').innerHTML=''; $('bxGhiChu').value='';
  const t = SUCO.find(x=>x.maSuCo===maSuCo);
  $('bxTicketInfo').textContent = maSuCo + (t?' — '+t.chinhanhTen+(t.phong?' / '+t.phong:''):'');
  $('formBaoXong').style.display='block';
  requestAnimationFrame(()=>$('formBaoXong').scrollIntoView({behavior:'smooth',block:'start'}));
}
async function submitBaoXong(){
  // Không còn bắt buộc ảnh (đổi 17/08/2026) — chỉ NHẮC, vì có những lỗi không chụp được gì (sự cố
  // mạng, cấu hình phần mềm, tư vấn qua điện thoại…). Cùng cách nhắc như khung "Báo sự cố" phía trên.
  if(!SC_ANH_XONG.length && !confirm('Bạn chưa đính kèm ảnh kết quả xử lý. Một số lỗi (vd sự cố mạng, cấu hình phần mềm…) không có gì để chụp vẫn báo xong được — vẫn gửi không kèm ảnh chứ?')) return;
  guiViTriHienTai();
  $('bxSubmit').disabled=true; $('bxSubmit').innerHTML='<span class="spin"></span> Đang gửi…';
  try{
    const j = await api({action:'suco_baoxong', maSuCo:bxMaSuCo, ghiChu:$('bxGhiChu').value.trim(), anh:SC_ANH_XONG});
    if(!j.ok){ const err = new Error(j.error); err.chiTiet = j.chiTiet; throw err; }
    toast('Đã báo xong '+bxMaSuCo+'. Chờ chi nhánh xác nhận.','ok');
    $('formBaoXong').style.display='none';
    loadSuCo(true);
  }catch(e){
    toast(e.message==='ANH_LOI' ? ('Ảnh tải lên thất bại'+(e.chiTiet?' — '+e.chiTiet:'')+'. Báo admin kiểm tra dung lượng Google Drive nếu lặp lại.') : 'Không gửi được.', 'bad');
  }
  finally{ $('bxSubmit').disabled=false; $('bxSubmit').textContent='Xác nhận đã xong'; }
}

async function xacNhan(maSuCo, xong){
  let moTaBoSung = '';
  if(!xong){
    moTaBoSung = prompt('Mô tả ngắn gọn phần còn chưa xử lý xong:','');
    if(moTaBoSung===null) return;
    if(!moTaBoSung.trim()) return toast('Cần mô tả để kỹ thuật biết xử lý tiếp phần nào.','bad');
  }
  try{
    const j = await api({action:'suco_xacnhan', maSuCo, xong, moTaBoSung});
    if(!j.ok) throw new Error(j.error);
    toast(xong?'Đã xác nhận hoàn thành. Chờ admin đóng ticket.':'Đã báo lại cho kỹ thuật xử lý tiếp.','ok');
    loadSuCo(true);
  }catch(e){ toast('Không thực hiện được.','bad'); }
}

async function dongTicket(maSuCo){
  try{ const j = await api({action:'suco_dong', maSuCo}); if(!j.ok) throw 0; toast('Đã đóng '+maSuCo+'.','ok'); loadSuCo(true); }
  catch(e){ toast('Không thực hiện được.','bad'); }
}


/* ── Đăng ký với vỏ — vỏ dùng làm cờ "module Bảo trì đã sẵn sàng" (coModBaoTri) ── */
window.BMB_MOD = window.BMB_MOD || {};
window.BMB_MOD.baotri = {
  sanSang: true,
  dongKhiBack: function(){ return false; }   // các hộp thoại Bảo trì dùng chung cơ chế Back của vỏ (moModalCoBack)
};
