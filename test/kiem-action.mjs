/* Kiểm tên action: mọi action mà admin.html / index.html gọi phải có trong Worker.
   Lý do: frontend gọi một action Worker chưa có → máy chủ trả CHUA_HO_TRO, nút bấm "im lặng" không
   làm gì (đúng loại lỗi qlcv gọi là unknown_action). Hay gặp nhất khi thay admin.html TRƯỚC khi deploy
   Worker mới. Chạy trước khi giao file:   node test/kiem-action.mjs
   (tuỳ chọn --worker <đường dẫn>, mặc định test/.nguon/worker.js)
   Kết quả: liệt kê action thiếu (lỗi, thoát mã 1) và action Worker có mà frontend không gọi (chỉ để biết). */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUONG_WORKER } from './moi-truong.mjs';

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Chỗ thiếu ĐÃ BIẾT, đang chờ anh Hưng quyết cách làm — vẫn in cảnh báo mỗi lần chạy, nhưng không làm
   hỏng lượt kiểm. Sửa xong thì xoá khỏi danh sách này.
   (13/11/2026: đã làm quenmk_gui / quenmk_doi — danh sách trống.) */
const DA_BIET = {};

/** Lấy các khoá cấp 1 của object literal `const <ten> = { ... }` — bỏ qua chuỗi, comment, khoá lồng bên trong. */
function khoaCap1(nguon, ten) {
  const dau = nguon.indexOf('const ' + ten + ' = {');
  if (dau < 0) return [];
  let i = nguon.indexOf('{', dau), sau = 0, truoc = '{';
  const khoa = [];
  for (; i < nguon.length; i++) {
    const c = nguon[i], c2 = nguon.slice(i, i + 2);
    if (c2 === '//') { i = nguon.indexOf('\n', i); continue; }
    if (c2 === '/*') { i = nguon.indexOf('*/', i) + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {           // bỏ qua chuỗi (đơn giản: không lồng ${} phức tạp)
      for (i++; i < nguon.length && nguon[i] !== c; i++) if (nguon[i] === '\\') i++;
      truoc = 'x'; continue;
    }
    if ('{[('.includes(c)) { sau++; truoc = c; continue; }
    if ('}])'.includes(c)) { sau--; truoc = c; if (sau === 0) break; continue; }
    if (sau === 1 && (truoc === '{' || truoc === ',') && /[A-Za-z_]/.test(c)) {
      const m = nguon.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (m) khoa.push(m[1]);
      truoc = 'x'; continue;
    }
    if (!/\s/.test(c)) truoc = c;
  }
  return khoa;
}

export function kiemTraAction(duongWorker = DUONG_WORKER) {
  const w = readFileSync(duongWorker, 'utf-8');
  const coPost = new Set([
    ...khoaCap1(w, 'CAN_DANG_NHAP'),
    ...[...w.matchAll(/body\.action === '([a-z_0-9]+)'/g)].map(m => m[1])
  ]);
  const coGet = new Set([...w.matchAll(/\ba === '([a-z_0-9]+)'/g)].map(m => m[1]));

  const thieu = [], dung = new Set();
  for (const file of ['admin.html', 'index.html']) {
    const h = readFileSync(join(GOC, file), 'utf-8');
    // action:'x' nằm trong URLSearchParams({...}) là lời gọi GET (vd trang chủ gọi ?action=trangchu)
    const post = new Set(), get = new Set([...h.matchAll(/[?&]action=([a-z_0-9]+)/g)].map(m => m[1]));
    for (const m of h.matchAll(/action\s*:\s*['"]([a-z_0-9]+)['"]/g))
      (/URLSearchParams\(\s*\{[^}]*$/.test(h.slice(Math.max(0, m.index - 120), m.index)) ? get : post).add(m[1]);
    for (const a of post) { dung.add(a); if (!coPost.has(a)) thieu.push(file + ' → POST ' + a); }
    for (const a of get) { dung.add(a); if (!coGet.has(a)) thieu.push(file + ' → GET ?action=' + a); }
  }
  const khongDung = [...coPost].filter(a => !dung.has(a));
  const daBiet = thieu.filter(t => DA_BIET[t]);
  return { thieu: thieu.filter(t => !DA_BIET[t]), daBiet, khongDung, soPost: coPost.size, soGet: coGet.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { thieu, daBiet, khongDung, soPost, soGet } = kiemTraAction();
  console.log('Worker có ' + soPost + ' action POST, ' + soGet + ' action GET.');
  if (khongDung.length) console.log('ℹ️  Worker có nhưng admin.html/index.html không gọi trực tiếp (có thể gọi qua biến, hoặc app khác dùng): ' + khongDung.join(', '));
  for (const t of daBiet) console.log('⚠️  Đã biết, chưa sửa: ' + t + ' (' + DA_BIET[t] + ')');
  if (thieu.length) {
    console.log('❌ Frontend gọi action Worker CHƯA có (bấm sẽ báo "chưa hỗ trợ"):\n   ' + thieu.join('\n   '));
    process.exitCode = 1;
  } else console.log('✅ Mọi action frontend gọi đều có trong Worker.');
}
