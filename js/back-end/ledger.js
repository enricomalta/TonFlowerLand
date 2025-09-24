// Simple append-only ledger abstraction for financial and economic events
// Each entry: { id, type, walletAddress, amountTon?, amountToken?, itemNome?, direction?, status, requestId, timestamp, metadata }
import { pool } from './mysql.js';

// Ledger table: ledger


export async function appendLedger(entry) {
  const now = new Date().toISOString();
  const base = { status: 'committed', timestamp: now, ...entry };
  const [result] = await pool.query(
    'INSERT INTO ledger (user_id, type, amountTon, amountToken, itemNome, direction, status, request_id, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      base.userId || null,
      base.type || null,
      base.amountTon || null,
      base.amountToken || null,
      base.itemNome || null,
      base.direction || null,
      base.status,
      base.requestId || null,
      base.timestamp,
      base.metadata ? JSON.stringify(base.metadata) : null
    ]
  );
  return { id: result.insertId, ...base };
}


export async function findByRequestId(requestId) {
  if (!requestId) return null;
  const [rows] = await pool.query('SELECT * FROM ledger WHERE request_id = ? LIMIT 1', [requestId]);
  if (rows.length === 0) return null;
  const doc = rows[0];
  return { id: doc.id, ...doc };
}


export async function listRecent(limit = 20) {
  const [rows] = await pool.query('SELECT * FROM ledger ORDER BY timestamp DESC LIMIT ?', [limit]);
  return rows.map(d => ({ id: d.id, ...d }));
}
