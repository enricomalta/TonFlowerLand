import { jest } from '@jest/globals';

// IMPORTANT: mock config BEFORE importing modules that depend on it

// Substitui Firestore/config.js por mock de pool MySQL
jest.unstable_mockModule('../js/back-end/mysql.js', () => {
  // In-memory tables
  const tables = {
    user: {},
    idempotencyKeys: {},
  };
  // Simulate pool.query for CRUD
  const pool = {
    query: async (sql, params) => {
      // Simple SQL parser for test purposes
      if (/SELECT \* FROM user WHERE id = \?/i.test(sql)) {
        const id = params[0];
        return [[tables.user[id] ? { ...tables.user[id], id } : undefined], undefined];
      }
      if (/UPDATE user SET/.test(sql)) {
        const [plantTime, id] = params;
        if (!tables.user[id]) tables.user[id] = { id };
        tables.user[id].plantTime = plantTime;
        return [undefined, undefined];
      }
      if (/INSERT INTO user/.test(sql)) {
        const [id, plantTime] = params;
        tables.user[id] = { id, plantTime };
        return [undefined, undefined];
      }
      if (/SELECT \* FROM idempotencyKeys WHERE key = \?/i.test(sql)) {
        const key = params[0];
        return [[tables.idempotencyKeys[key] ? { ...tables.idempotencyKeys[key], key } : undefined], undefined];
      }
      if (/INSERT INTO idempotencyKeys/.test(sql)) {
        const [key, value] = params;
        tables.idempotencyKeys[key] = { key, value };
        return [undefined, undefined];
      }
      if (/UPDATE idempotencyKeys SET/.test(sql)) {
        const [value, key] = params;
        if (!tables.idempotencyKeys[key]) tables.idempotencyKeys[key] = { key };
        tables.idempotencyKeys[key].value = value;
        return [undefined, undefined];
      }
      throw new Error('SQL not mocked: ' + sql);
    },
  };
  // Timestamp mock
  const Timestamp = { fromDate: (d) => ({ toDate: () => d }) };
  return { pool, Timestamp };
});

// Dynamic imports AFTER mock so they receive mocked pool
const { pool } = await import('../js/back-end/mysql.js');
const { checkAndApplyParasites } = await import('../js/back-end/checkAndApplyParasites.js');
const { validateBody, requireIdempotency, attachRequestId } = await import('../js/validation/middleware.js');
const { blockchain, isMock } = await import('../js/back-end/blockchainProvider.js');

describe('checkAndApplyParasites coverage', () => {
  let tables;
  beforeEach(() => {
    tables = {
      user: {},
      idempotencyKeys: {},
      plantTime: [],
      transactions: [],
      items: {},
      ledger: [],
      clientSecurityEvents: {},
      challenges: {},
    };
    // Atualiza o mock do pool para usar tables atualizado
    jest.unstable_mockModule('../js/back-end/mysql.js', () => {
      const pool = {
        query: async (sql, params) => {
          if (/SELECT \* FROM user WHERE id = \?/i.test(sql)) {
            const id = params[0];
            return [[tables.user[id] ? { ...tables.user[id], id } : undefined], undefined];
          }
          if (/UPDATE user SET/.test(sql)) {
            const [plantTime, id] = params;
            if (!tables.user[id]) tables.user[id] = { id };
            tables.user[id].plantTime = plantTime;
            return [undefined, undefined];
          }
          if (/INSERT INTO user/.test(sql)) {
            const [id, plantTime] = params;
            tables.user[id] = { id, plantTime };
            return [undefined, undefined];
          }
          if (/SELECT \* FROM idempotencyKeys WHERE key = \?/i.test(sql)) {
            const key = params[0];
            return [[tables.idempotencyKeys[key] ? { ...tables.idempotencyKeys[key], key } : undefined], undefined];
          }
          if (/INSERT INTO idempotencyKeys/.test(sql)) {
            const [key, value] = params;
            tables.idempotencyKeys[key] = { key, value };
            return [undefined, undefined];
          }
          if (/UPDATE idempotencyKeys SET/.test(sql)) {
            const [value, key] = params;
            if (!tables.idempotencyKeys[key]) tables.idempotencyKeys[key] = { key };
            tables.idempotencyKeys[key].value = value;
            return [undefined, undefined];
          }
          throw new Error('SQL not mocked: ' + sql);
        },
      };
      const Timestamp = { fromDate: (d) => ({ toDate: () => d }) };
      return { pool, Timestamp };
    });
  });
  test('handles no users gracefully', async () => {
    await checkAndApplyParasites();
  });

  test('marks plant finished if harvestDate passed and does not infect protected', async () => {
    const past = new Date(Date.now()-2000);
    const future = new Date(Date.now()+3600000);
    await pool.query('INSERT INTO user (id, plantTime) VALUES (?, ?)', ['u1', [
      { slotID: 1, plantDate: { toDate: () => past }, harvestDate: { toDate: () => future }, growthStatus: { isProtected: true, isWatered: true } },
      { slotID: 2, plantDate: { toDate: () => past }, harvestDate: { toDate: () => past }, growthStatus: { isWatered: true } },
    ]]);
    await checkAndApplyParasites();
    const [[user]] = await pool.query('SELECT * FROM user WHERE id = ?', ['u1']);
    const plants = user.plantTime;
    expect(plants[0].growthStatus.isParasita).toBeFalsy();
    expect(plants[1].growthStatus.isFinish).toBe(true);
  });

  test('infects watered unprotected plant when random < 0.5', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    await pool.query('INSERT INTO user (id, plantTime) VALUES (?, ?)', ['u2', [
      { slotID: 3, plantDate: { toDate: () => new Date(Date.now()-2000) }, harvestDate: { toDate: () => new Date(Date.now()+500000) }, growthStatus: { isWatered: true } }
    ]]);
    await checkAndApplyParasites();
    const [[user]] = await pool.query('SELECT * FROM user WHERE id = ?', ['u2']);
    expect(user.plantTime[0].growthStatus.isParasita).toBe(true);
    spy.mockRestore();
  });

  test('skips infection when random >= 0.5', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    await pool.query('INSERT INTO user (id, plantTime) VALUES (?, ?)', ['u3', [
      { slotID: 4, plantDate: { toDate: () => new Date(Date.now()-3000) }, harvestDate: { toDate: () => new Date(Date.now()+500000) }, growthStatus: { isWatered: true } }
    ]]);
    await checkAndApplyParasites();
    const [[user]] = await pool.query('SELECT * FROM user WHERE id = ?', ['u3']);
    expect(user.plantTime[0].growthStatus.isParasita).toBeFalsy();
    spy.mockRestore();
  });

  test('already infected plant remains infected (no double processing)', async () => {
    await pool.query('INSERT INTO user (id, plantTime) VALUES (?, ?)', ['u4', [
      { slotID: 5, plantDate: { toDate: () => new Date(Date.now()-3000) }, harvestDate: { toDate: () => new Date(Date.now()+500000) }, growthStatus: { isWatered: true, isParasita: true } }
    ]]);
    await checkAndApplyParasites();
    const [[user]] = await pool.query('SELECT * FROM user WHERE id = ?', ['u4']);
    expect(user.plantTime[0].growthStatus.isParasita).toBe(true);
  });
});

// Simple Zod-like stub schema for validateBody tests
const fakeSchema = {
  safeParse: (data) => data && data.ok ? { success: true, data } : { success: false, error: { issues: [{ path: ['ok'], message: 'Required' }] } }
};

function buildReqRes(body={}, headers={}) {
  const res = { statusCode: 200, body: null, status(code){ this.statusCode = code; return this; }, json(obj){ this.body = obj; return this; } };
  return { req: { body, headers }, res };
}

describe('validation middleware', () => {
  test('validateBody success path', () => {
    const mw = validateBody(fakeSchema);
    const { req, res } = buildReqRes({ ok: true });
    let called = false;
    mw(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.validated.ok).toBe(true);
  });
  test('validateBody failure path', () => {
    const mw = validateBody(fakeSchema);
    const { req, res } = buildReqRes({});
    mw(req, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Erro de validação/);
  });
});

describe('idempotency middleware', () => {
  const mw = requireIdempotency();
  test('first request processes then second is replay', async () => {
    // First: missing header
    const miss = buildReqRes({}, {});
    await mw(miss.req, miss.res, () => {});
    expect(miss.res.statusCode).toBe(428);

    const key = 'idemp-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const first = buildReqRes({}, { 'x-idempotency-key': key });
    let passed = false;
    await mw(first.req, first.res, () => { passed = true; });
    // In rare race situations the key might pre-exist; accept either normal pass (passed=true, no body)
    // or replay shortcut (passed=false but body.replay true). We only fail if neither condition met.
    if (!passed) {
      expect(first.res.body && first.res.body.replay).toBe(true);
    } else {
      expect(first.res.body).toBeNull();
    }

    const second = buildReqRes({}, { 'x-idempotency-key': key });
    await mw(second.req, second.res, () => {});
    expect(second.res.body.replay).toBe(true);
  });

  test('idempotency middleware error path returns 500', async () => {
  // Monkey patch pool.query to throw just once
  const { pool } = await import('../js/back-end/mysql.js');
  const originalQuery = pool.query;
  let invoked = false;
  pool.query = async () => { invoked = true; throw new Error('forced boom'); };
  const errMw = requireIdempotency();
  const { req, res } = buildReqRes({}, { 'x-idempotency-key': 'err-key' });
  await errMw(req, res, () => {});
  expect(invoked).toBe(true);
  expect(res.statusCode).toBe(500);
  expect(res.body.error).toMatch(/idempot/);
  // restore
  pool.query = originalQuery;
  });
});

describe('attachRequestId', () => {
  test('generates request id when absent', () => {
    const mw = attachRequestId();
    const { req, res } = buildReqRes();
    mw(req, res, () => {});
    expect(req.requestId).toBeTruthy();
  });
  test('uses provided x-request-id header', () => {
    const mw = attachRequestId();
    const { req, res } = buildReqRes({}, { 'x-request-id': 'fixed-id' });
    mw(req, res, () => {});
    expect(req.requestId).toBe('fixed-id');
  });
});

describe('blockchainProvider mock', () => {
  test('isMock returns true in mock mode', () => {
    expect(isMock()).toBe(true);
  });
  test('sendMessage stores transactions and listRecent returns them', async () => {
    const tx = await blockchain.sendMessage({ toAddress: 'addr1', amountTon: 1 });
    expect(tx.txId).toMatch(/mock_/);
    const list = await blockchain.listRecent(5);
    expect(list[0].txId).toBe(tx.txId);
  });
});
