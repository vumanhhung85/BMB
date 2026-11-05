/* Môi trường chạy thử Worker BMB trên máy, không cần Cloudflare:
   - D1 giả (node:sqlite) nạp schema + dữ liệu mẫu 2 chi nhánh, 5 tài khoản đủ vai trò.
   - R2 giả trong bộ nhớ.
   - Chặn mọi lời gọi mạng ra ngoài (Telegram, Resend, bmb.id.vn) → ghi lại để kiểm nội dung.
   - Mỗi môi trường nạp Worker thành 1 bản module MỚI (biến cache cấp module như _daKiemTgRieng không
     dính từ môi trường trước sang).
   Mã nguồn Worker + schema KHÔNG nằm trong git (repo công khai) — xem test/README.md cách lấy về
   test/.nguon/ (thư mục này đã nằm trong .gitignore). */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';
import { taoD1, taoR2 } from './d1-gia.mjs';

const THU_MUC = dirname(fileURLToPath(import.meta.url));
const thamSo = ten => { const i = process.argv.indexOf('--' + ten); return i > 0 ? process.argv[i + 1] : ''; };
export const DUONG_WORKER = resolve(thamSo('worker') || join(THU_MUC, '.nguon', 'worker.js'));
export const DUONG_SCHEMA = resolve(thamSo('schema') || join(THU_MUC, '.nguon', 'schema.sql'));

const SECRET = 'bi-mat-chi-de-test', LEGACY = 'legacy-test';
const sha256 = s => createHash('sha256').update(s).digest('hex');
export const MAT_KHAU = '1234';

/* Dữ liệu mẫu — tên thật cho dễ đọc kết quả, KHÔNG phải dữ liệu thật của hệ thống. */
const CHI_NHANH = [['CN01', 'Boom Music Box Tây Hòa', 'Tây Hòa', 10.85, 106.77], ['CN02', 'Boom Music Box Nguyễn Văn Tăng', 'Nguyễn Văn Tăng', 10.84, 106.81]];
const TAI_KHOAN = [
  ['admin', 'Quản trị', 'admin', null, 1],
  ['ql01', 'Quản lý Tây Hòa', 'manager', 'CN01', 0],
  ['ql02', 'Quản lý Nguyễn Văn Tăng', 'manager', 'CN02', 0],
  ['kt1', 'Kỹ thuật Một', 'kythuat', 'CN01', 0],
  ['ktm1', 'Kỹ thuật Mạng', 'kythuat_mang', 'CN02', 0]
];
const LOAI = [['am_thanh', 'Âm thanh / micro', 3, 'chung'], ['mang', 'Mạng / wifi', 2, 'mang']];

let demModule = 0;

export async function taoMoiTruong(tuyChon = {}) {
  const schema = readFileSync(DUONG_SCHEMA, 'utf-8');
  const DB = taoD1(schema), ANH = taoR2();
  const now = Date.now();
  const d = DB._db;
  for (const [id, ten, ngan, lat, lng] of CHI_NHANH)
    d.prepare('INSERT INTO chi_nhanh (id, ten, ten_ngan, lat, lng, toa_do_chinh_xac, sdt) VALUES (?,?,?,?,?,1,?)').run(id, ten, ngan, lat, lng, '0900000000');
  for (const [u, ten, vt, cn, sieu] of TAI_KHOAN) {
    const dauVao = sha256(u + '::' + MAT_KHAU + '::boom');
    d.prepare('INSERT INTO tai_khoan (username, mat_khau_hash, ho_ten, vai_tro, chi_nhanh_id, sieu_admin, tao_luc) VALUES (?,?,?,?,?,?,?)')
      .run(u, 'legacy_sha256$' + sha256(dauVao + LEGACY), ten, vt, cn, sieu, now);
  }
  for (const [ma, ten, md, kt] of LOAI) d.prepare('INSERT INTO loai_su_co (ma, ten, muc_do, loai_kt) VALUES (?,?,?,?)').run(ma, ten, md, kt);
  const caiDat = { tg_bot_token: '123:TEST', tg_chat_id: '-100nhom', yen_lang_bat: 'N', tg_bot_username: 'BoomTestBot', tg_bot_username_token: '123:TEST'.slice(-10), ...(tuyChon.caiDat || {}) };
  for (const [k, v] of Object.entries(caiDat)) d.prepare('INSERT INTO cai_dat (khoa, gia_tri) VALUES (?,?)').run(k, String(v));

  // Nạp Worker thành bản module riêng cho môi trường này
  const tam = mkdtempSync(join(tmpdir(), 'bmb-wk-'));
  const file = join(tam, 'worker.mjs');
  writeFileSync(file, readFileSync(DUONG_WORKER, 'utf-8'));
  const worker = (await import(pathToFileURL(file).href + '?v=' + (++demModule))).default;

  const env = { DB, ANH, SECRET, LEGACY_SECRET: LEGACY, TG_BAT: '1', ...(tuyChon.env || {}) };

  /* ─ chặn mạng ─ */
  const goiRa = [];                  // mọi lời gọi ra ngoài
  const chanTG = new Set();          // chat_id giả lập "đã chặn bot" → Telegram trả 403
  globalThis.fetch = async (url, opt = {}) => {
    url = String(url);
    let body = {}; try { body = JSON.parse(opt.body || '{}'); } catch (e) {}
    goiRa.push({ url, body });
    const tl = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('api.telegram.org')) {
      if (body.chat_id && chanTG.has(String(body.chat_id))) return tl({ ok: false, description: 'Forbidden: bot was blocked by the user' }, 403);
      if (url.endsWith('/getMe')) return tl({ ok: true, result: { username: 'BoomTestBot' } });
      return tl({ ok: true, result: { message_id: goiRa.length } });
    }
    return tl({ ok: true });
  };

  const goi = async (action, body = {}, token) => {
    const res = await worker.fetch(new Request('https://bmb-test.local/', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...body, ...(token ? { token } : {}) })
    }), env, { waitUntil: () => {} });
    return res.json();
  };
  const dangNhap = async (user, matKhau = MAT_KHAU) => {
    const j = await goi('login', { user, hash: sha256(user + '::' + matKhau + '::boom'), thietBi: 'may_test_' + user });
    if (!j.ok) throw new Error('Đăng nhập ' + user + ' lỗi: ' + j.error);
    return j.session.token;
  };
  const webhook = async (update, sai = false) => {
    const bm = createHmac('sha256', SECRET).update('tg-webhook-rieng').digest('hex').slice(0, 48);
    const res = await worker.fetch(new Request('https://bmb-test.local/tg-webhook', {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-Telegram-Bot-Api-Secret-Token': sai ? 'sai' : bm },
      body: JSON.stringify(update)
    }), env, { waitUntil: () => {} });
    return res.status;
  };
  /** Gắn Telegram riêng thẳng vào D1 (nhanh) — kịch bản kết nối thật dùng webhook ở trên. */
  const noiTG = async (user, chatId) => {
    const cot = new Set(d.prepare('PRAGMA table_info(tai_khoan)').all().map(c => c.name));
    if (!cot.has('tg_chat_id')) throw new Error('schema thiếu cột tg_chat_id');
    d.prepare('UPDATE tai_khoan SET tg_chat_id=?, tg_ket_noi_luc=?, tg_tam_dung=0 WHERE username=?').run(String(chatId), Date.now(), user);
  };
  /** Tin Telegram đã gửi (sendMessage), lọc theo chat nếu cần. Mỗi lần đọc xong nên gọi xoaTin(). */
  const tin = chat => goiRa.filter(g => g.url.endsWith('/sendMessage') && (chat == null || String(g.body.chat_id) === String(chat))).map(g => g.body);
  const xoaTin = () => { goiRa.length = 0; };
  const sql = (q, ...a) => d.prepare(q).all(...a);

  return { env, worker, DB, ANH, goi, dangNhap, webhook, noiTG, tin, xoaTin, sql, chanTG, goiRa };
}

/* ─ trình chạy kịch bản tối giản ─ */
const KQ = [];
export function kb(ten, fn) { KQ.push({ ten, fn }); }
export function dung(dk, moTa) { if (!dk) throw new Error(moTa || 'điều kiện sai'); }
export function bang(a, b, moTa) { if (a !== b) throw new Error((moTa || 'khác nhau') + ': mong ' + JSON.stringify(b) + ', được ' + JSON.stringify(a)); }
export async function chayTatCa() {
  let dat = 0;
  const loi = [];
  for (const { ten, fn } of KQ) {
    try { await fn(); dat++; console.log('  ✅ ' + ten); }
    catch (e) { loi.push(ten); console.log('  ❌ ' + ten + '\n     → ' + (e && e.message || e)); }
  }
  console.log('\n' + dat + '/' + KQ.length + ' kịch bản đạt' + (loi.length ? ' — HỎNG: ' + loi.join(' | ') : ''));
  process.exitCode = loi.length ? 1 : 0;
  return loi.length === 0;
}
