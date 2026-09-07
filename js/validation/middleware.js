import { idempotentHeader } from './schemas.js';
import { pool } from '../back-end/mysql.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Erro de validação',
        issues: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    req.validated = parseResult.data;
    next();
  };
}

// Idempotência persistente em Firestore com TTL (default 15 min)
const IDEMP_COLLECTION = 'idempotencyKeys';
const TTL_MS = 15 * 60 * 1000;
export function requireIdempotency() {
  return async (req, res, next) => {
    try {
  // Suporta header novo (x-idempotency-key) e legado (x-request-id) para compatibilidade.
  const id = req.headers[idempotentHeader] || req.headers['x-request-id'];
      if (!id) return res.status(428).json({ error: `Header ${idempotentHeader} obrigatório para esta operação` });
      req.idempotencyKey = id;
      // Migrar para MySQL: exemplo de consulta
      const [rows] = await pool.query(`SELECT * FROM ${IDEMP_COLLECTION} WHERE id = ?`, [id]);
      const snap = await ref.get();
      const now = Date.now();
      if (snap.exists) {
        const data = snap.data();
        if (!data.expiresAt || data.expiresAt > now) {
          return res.status(200).json({ replay: true, message: 'Operação já processada (idempotente)' });
        }
      }
      await ref.set({ createdAt: now, expiresAt: now + TTL_MS }, { merge: true });
      next();
    } catch (e) {
      console.error('Erro idempotency middleware', e);
      return res.status(500).json({ error: 'Falha de idempotência' });
    }
  };
}

// Request ID para logs futuros
export function attachRequestId() {
  return (req, _res, next) => {
    req.requestId = req.headers['x-request-id'] || cryptoRandom();
    next();
  };
}

function cryptoRandom() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
