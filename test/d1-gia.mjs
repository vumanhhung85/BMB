/* D1 giả bằng node:sqlite (Node 22+) — đủ cho Worker BMB: prepare/bind/first/all/run, batch (trong 1
   giao dịch, lỗi thì rollback như D1 thật), exec. Không cần tài khoản Cloudflare để chạy thử.
   Lưu ý node:sqlite: không nhận undefined/boolean khi bind → đổi sang null/0/1; lastInsertRowid là
   BigInt → ép Number. */
import { DatabaseSync } from 'node:sqlite';

const chuanHoa = a => a.map(v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
const laDoc = sql => /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
const thuong = r => (r ? { ...r } : r);

export function taoD1(schemaSql) {
  const db = new DatabaseSync(':memory:');
  db.exec(schemaSql);
  const dem = { doc: 0, ghi: 0 };   // đếm lượt gọi — test hiệu năng có thể xem

  const stmt = (sql, args = []) => ({
    _sql: sql, _args: args,
    bind: (...a) => stmt(sql, chuanHoa(a)),
    first: async col => {
      dem.doc++;
      const r = db.prepare(sql).get(...args);
      if (!r) return null;
      return col ? r[col] : thuong(r);
    },
    all: async () => {
      dem.doc++;
      return { results: db.prepare(sql).all(...args).map(thuong), success: true, meta: {} };
    },
    run: async () => {
      dem.ghi++;
      if (laDoc(sql)) { const rs = db.prepare(sql).all(...args).map(thuong); return { results: rs, success: true, meta: { changes: 0 } }; }
      const i = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } };
    }
  });

  return {
    prepare: sql => stmt(sql),
    exec: async sql => { db.exec(sql); return { count: 1 }; },
    batch: async list => {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(laDoc(s._sql) ? await s.all() : await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    _db: db,
    _dem: dem
  };
}

/** R2 giả: put/get/delete giữ trong bộ nhớ. */
export function taoR2() {
  const kho = new Map();
  return {
    put: async (key, body, opts = {}) => { kho.set(key, { body, httpMetadata: opts.httpMetadata || {} }); return { key }; },
    get: async key => {
      const v = kho.get(key);
      if (!v) return null;
      return { body: v.body, httpMetadata: v.httpMetadata, arrayBuffer: async () => v.body };
    },
    delete: async key => { kho.delete(key); },
    _kho: kho
  };
}
