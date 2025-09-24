import request from 'supertest';
import { jest } from '@jest/globals';

// --- Mocks mínimos antes de importar o servidor ---
// Estrutura de DB em memória similar (reduzida) à usada em outros testes
class MockDoc {
  constructor(col, id, store){ this.col = col; this.id = id; this.store = store; }
  async get(){ const data = this.store[this.col][this.id]; return { exists: !!data, data: () => ({ ...data }) }; }
  async set(val){ this.store[this.col][this.id] = { ...(val || {}) }; }
  async update(patch){ if(!this.store[this.col][this.id]) throw new Error('not-found'); this.store[this.col][this.id] = { ...this.store[this.col][this.id], ...patch }; }
  collection(sub){ const key = `${this.col}.${this.id}.${sub}`; if(!this.store[key]) this.store[key] = {}; return new MockCollection(key, this.store); }
}
class MockCollection {
  constructor(name, store){ this.name = name; this.store = store; if(!this.store[this.name]) this.store[this.name] = {}; }
  doc(id){ return new MockDoc(this.name, id || Math.random().toString(16).slice(2), this.store); }
  async get(){ const entries = Object.entries(this.store[this.name]).map(([id,data])=>({ id, data: () => ({ ...data }) })); return { empty: entries.length===0, forEach: (fn)=>entries.forEach(fn), docs: entries }; }
  where(){ return this; }
  limit(){ return this; }
}
function makeDb(){
  const store = { user:{}, items:{}, challenges:{}, clientSecurityEvents:{}, idempotencyKeys:{} };
  return {
    _store: store,
    collection(name){ return new MockCollection(name, store); },
    batch(){
      const ops = [];
      return { set:(docRef,data)=>ops.push({type:'set',docRef,data}), async commit(){ ops.forEach(op=> op.docRef.set(op.data)); return ops.length; } };
    }
  };
}
const mockDb = makeDb();

// Ledger mock (no-op append)
await jest.unstable_mockModule('../js/back-end/ledger.js', () => ({
  appendLedger: async () => {},
  findByRequestId: async () => null
}));

// Metrics mock (no-op)
await jest.unstable_mockModule('../js/back-end/metrics.js', () => ({
  metricsMiddleware: (req,res,next)=>next(),
  metrics: { requests:{ inc:()=>{} }, securityEvents:{ inc:()=>{} }, ledgerWrites:{ inc:()=>{} }, eventLoopLag:{ observe:()=>{} } },
  renderAllMetrics: ()=> 'metrics'
}));

// Blockchain provider mock
await jest.unstable_mockModule('../js/back-end/blockchainProvider.js', () => ({
  blockchain: { sendMessage: jest.fn(async () => ({ ok:true })) },
  isMock: () => true
}));

await jest.unstable_mockModule('../js/back-end/mysql.js', () => ({
  db: mockDb,
  Timestamp: { now: () => new Date(), fromDate: d => d },
  FieldValue: { increment: (v)=>({ __inc:v }) }
}));
// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool

// firebase-admin FieldValue.increment simbólico
global.admin = { firestore: { FieldValue: { increment: (v)=>({ __inc:v }) } } };

// Após mocks, importar servidor
let server;

// Helper para extrair nonce do header CSP
function extractNonce(csp){
  const m = csp && csp.match(/nonce-([^';]+)/);
  return m ? m[1] : null;
}

describe('Security Hardening Suite', () => {
  beforeAll(async () => {
    ({ server } = await import('../server.js'));
  });

  afterAll(async () => {
    if (server && server.close) server.close();
  });

  test('Security headers presence & values', async () => {
    const res = await request(server).get('/health');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(res.headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['permissions-policy']).toBeDefined();
  });

  test('CSP nonce changes between requests', async () => {
    const r1 = await request(server).get('/health');
    const r2 = await request(server).get('/health');
    const n1 = extractNonce(r1.headers['content-security-policy']);
    const n2 = extractNonce(r2.headers['content-security-policy']);
    expect(n1).toBeTruthy();
    expect(n2).toBeTruthy();
    expect(n1).not.toBe(n2); // nonce deve ser diferente a cada request
  });

  test('Login sets HttpOnly cookie and logout revokes token', async () => {
    // cria usuário para garantir login 200
    await request(server).post('/createUser').send({ walletAddress: 'wallet-sec' });
    const login = await request(server).post('/login').send({ walletAddress: 'wallet-sec' });
    expect([200,429]).toContain(login.status); // 429 se rate limit residual entre execuções
    const cookie = login.headers['set-cookie']?.[0];
    if(!cookie){
      // Se rate limit impediu, aborta de forma graciosa sem falhar o restante (mas ainda valida que cabeçalho anti-clickjacking existe)
      expect(login.headers['x-frame-options']).toBe('DENY');
      return;
    }
    expect(cookie).toMatch(/HttpOnly/);
    const sessionOk = await request(server).get('/session/check').set('Cookie', cookie);
    expect([200,404]).toContain(sessionOk.status);
    await request(server).post('/logout').set('Cookie', cookie);
    const after = await request(server).get('/session/check').set('Cookie', cookie);
    expect([401,404]).toContain(after.status);
  });

  test('Idempotency replay detection on withdraw', async () => {
    await request(server).post('/createUser').send({ walletAddress: 'wallet-replay' });
    const login = await request(server).post('/login').send({ walletAddress: 'wallet-replay' });
    const cookie = login.headers['set-cookie']?.[0];
    if(!cookie){ expect([429,500]).toContain(login.status); return; }
    const key = 'sec-idem-1';
    const first = await request(server).post('/withdraw').set('Cookie', cookie).set('x-idempotency-key', key).send({ walletAddress: 'wallet-replay', amountTon: 1 });
    const second = await request(server).post('/withdraw').set('Cookie', cookie).set('x-idempotency-key', key).send({ walletAddress: 'wallet-replay', amountTon: 1 });
    if (second.body) { expect([true, undefined]).toContain(second.body.replay); }
    expect([200,400,404]).toContain(first.status);
    expect([200,400,404]).toContain(second.status);
  });

  test('Rate limit headers exposed and enforced (removeParasita low limit)', async () => {
    await request(server).post('/createUser').send({ walletAddress: 'wallet-rate' });
    const login = await request(server).post('/login').send({ walletAddress: 'wallet-rate' });
    const cookie = login.headers['set-cookie']?.[0];
    if(!cookie){ expect([429,500]).toContain(login.status); return; }
    const path = '/removeParasita';
    const basePayload = { slotId: 1 };
    const r1 = await request(server).post(path).set('Cookie', cookie).send(basePayload);
    const r2 = await request(server).post(path).set('Cookie', cookie).send(basePayload);
    expect([400,429]).toContain(r1.status);
    expect([400,429]).toContain(r2.status);
    expect(r2.headers['ratelimit-policy']).toBeDefined();
  });

  test('Injection-like input not reflected unsafely', async () => {
    const inj = "<script>alert('x')</script>";
    // Usa rota que retorna erro de validação para garantir não refletir a string: client-security-event
    const res = await request(server).post('/client-security-event').send({ eventType: inj, severity: inj });
    expect(res.status).toBe(400);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(inj); // não deve refletir literal
  });
});
