import { jest } from '@jest/globals';
import request from 'supertest';


// Mock pool/query for MySQL
function makePool() {
  const store = { user:{}, items:{}, challenges:{}, clientSecurityEvents:{}, idempotencyKeys:{} };
  return {
    _store: store,
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT') && sql.includes('FROM users')) {
        const wallet = params[0];
        const user = store.user[wallet];
        return [[user ? { wallet_address: wallet, ...user } : undefined]];
      }
      if (sql.includes('SELECT') && sql.includes('FROM items')) {
        return [Object.values(store.items)];
      }
      if (sql.includes('SELECT') && sql.includes('FROM challenges')) {
        const wallet = params[0];
        const challenge = store.challenges[wallet];
        return [[challenge ? { wallet_address: wallet, ...challenge } : undefined]];
      }
      if (sql.includes('INSERT INTO users')) {
        const wallet = params[0];
        store.user[wallet] = { tokenBalance: params[1], inventario: [], plantTime: [], ...params.slice(2) };
        return [{ insertId: wallet }];
      }
      if (sql.includes('INSERT INTO items')) {
        const id = params[0];
        store.items[id] = { itemNome: params[1], itemPreco: params[2], ...params.slice(3) };
        return [{ insertId: id }];
      }
      if (sql.includes('INSERT INTO challenges')) {
        const wallet = params[0];
        store.challenges[wallet] = { challenge: params[1], createdAt: params[2] };
        return [{ insertId: wallet }];
      }
      if (sql.includes('UPDATE users')) {
        const wallet = params[1];
        if (store.user[wallet]) store.user[wallet].tokenBalance = params[0];
        return [{ affectedRows: 1 }];
      }
      // ...simular outras queries conforme necessário
      return [[]];
    }),
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      query: jest.fn(),
      release: () => {}
    })
  };
}
const mockPool = makePool();

// Simple in-memory ledger storage
const ledgerEntries = [];
await jest.unstable_mockModule('../js/back-end/ledger.js', () => ({
  appendLedger: async (entry) => {
    ledgerEntries.push(entry);
    if(entry.requestId === 'force-ledger-error' || entry.metadata?.forceError) {
      throw new Error('forced ledger error');
    }
  },
  findByRequestId: async (id) => ledgerEntries.find(l => l.requestId === id)
}));

// Mock metrics (minimal interface used in server)
await jest.unstable_mockModule('../js/back-end/metrics.js', () => ({
  metricsMiddleware: (req,res,next)=>next(),
  metrics: { requests:{ inc: ()=>{} }, securityEvents:{ inc: ()=>{} }, ledgerWrites:{ inc: ()=>{} }, eventLoopLag: { observe: ()=>{} } },
  renderAllMetrics: ()=> 'metrics'
}));

// Mock blockchain provider & send message path
await jest.unstable_mockModule('../js/back-end/blockchainProvider.js', () => ({
  blockchain: { sendMessage: jest.fn(async ({ toAddress, amountTon }) => ({ to: toAddress, amount: amountTon })) },
  isMock: () => true
}));

// Removido mock do firebase-admin/app e global.admin. Apenas MySQL.

// Mock config to inject our pool
await jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: mockPool }));

// Import server AFTER mocks
const { server } = await import('../server.js');

const agent = request.agent(server);

function setUser(wallet, data = {}) { mockPool._store.user[wallet] = { tokenBalance: 100, inventario: [], plantTime: [], ...data }; }
function setItem(id, data = {}) { mockPool._store.items[id] = { itemNome: 'Semente', itemPreco: '10.00', itemPay: '5', xp: '2', ...data }; }

describe('server.js full coverage targeted tests', () => {
  beforeEach(()=>{
    // reset selective state but keep ledger for replay test
      mockPool._store.users = {};
      mockPool._store.user = {};
      mockPool._store.items = {};
      mockPool._store.clientSecurityEvents = {};
      mockPool._store.challenges = {};
      mockPool._store.idempotencyKeys = {};
      mockPool._store.plantTime = [];
      mockPool._store.transactions = [];
      mockPool._store.ledger = [];
  });

  test('POST /generate-challenge stores challenge', async () => {
    const res = await agent.post('/generate-challenge').send({ walletAddress: 'wallet-chan1' });
    expect(res.status).toBe(200);
  expect(mockPool._store.challenges['wallet-chan1'].challenge).toMatch(/TON Login Challenge/);
  });

  test('POST /client-security-event success with batch', async () => {
    const payload = { events: [ { type:'openDevTools' }, { type:'pasteWarning', len: 5 } ] };
    const res = await agent.post('/client-security-event').send(payload);
    expect([202,200]).toContain(res.status);
    // Ensure events stored
  const stored = Object.values(mockPool._store.clientSecurityEvents);
    expect(stored.length).toBe(2);
  });

  test('POST /client-security-event error path (batch.commit throws)', async () => {
    // Monkey patch batch to throw
  const origBatch = mockPool.batch;
  mockPool.batch = () => ({ set: ()=>{}, commit: async ()=>{ throw new Error('boom'); } });
    const res = await agent.post('/client-security-event').send({ events:[{ type:'x' }]});
    expect(res.status).toBe(500);
  mockPool.batch = origBatch;
  });

  test('POST /login success sets cookie & returns token', async () => {
    setUser('wallet-login1');
    const res = await agent.post('/login').send({ walletAddress: 'wallet-login1' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.token).toBeTruthy();
  });

  test('POST /withdraw success path and ledger append', async () => {
    setUser('wallet-with1', { tokenBalance: 200 });
    const reqId = 'idemp-1';
    const res = await agent.post('/withdraw').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-with1', amountTon: 50 });
    expect(res.status).toBe(200);
    const ledger = ledgerEntries.find(l=>l.requestId===reqId);
    expect(ledger).toBeTruthy();
  });

  test('POST /withdraw replay path returns replay flag', async () => {
    setUser('wallet-with2', { tokenBalance: 200 });
    const reqId = 'idemp-2';
    // First call
    await agent.post('/withdraw').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-with2', amountTon: 10 });
    // Second call
    const res2 = await agent.post('/withdraw').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-with2', amountTon: 10 });
    expect(res2.body.replay).toBe(true);
  });

  test('POST /processarCompra success + ledger record', async () => {
    setUser('wallet-buy01', { tokenBalance: 500 });
    setItem('it1', { itemNome: 'Fertilizante', itemPreco: '10.00' });
    const reqId = 'idemp-3';
    const res = await agent.post('/processarCompra').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-buy01', itemNome: 'Fertilizante', quantidade: 1 });
    expect(res.status).toBe(200);
  });

  test('POST /processarCompra replay path', async () => {
    setUser('wallet-buy02', { tokenBalance: 500 });
    setItem('it2', { itemNome: 'Fertilizante', itemPreco: '10.00' });
    const reqId = 'idemp-4';
    await agent.post('/processarCompra').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-buy02', itemNome: 'Fertilizante', quantidade: 1 });
    const res2 = await agent.post('/processarCompra').set('x-idempotency-key', reqId).send({ walletAddress: 'wallet-buy02', itemNome: 'Fertilizante', quantidade: 1 });
    expect(res2.body.replay).toBe(true);
  });

  test('POST /withdraw insufficient balance branch', async () => {
    setUser('wallet-lowbal', { tokenBalance: 10 });
    const res = await agent.post('/withdraw').set('x-idempotency-key','idemp-low').send({ walletAddress: 'wallet-lowbal', amountTon: 50 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Saldo insuficiente/);
  });

  test('POST /withdraw ledger append error swallowed', async () => {
    setUser('wallet-ledgererr', { tokenBalance: 300 });
    const res = await agent.post('/withdraw').set('x-idempotency-key','force-ledger-error').send({ walletAddress: 'wallet-ledgererr', amountTon: 20 });
    // Even with ledger error, route should still return 200 success
    expect(res.status).toBe(200);
  });

  test('POST /processarCompra ledger append error swallowed', async () => {
    setUser('wallet-buyerr', { tokenBalance: 500 });
    setItem('it3', { itemNome: 'Fertilizante', itemPreco: '10.00' });
    const res = await agent.post('/processarCompra').set('x-idempotency-key','force-ledger-error').send({ walletAddress: 'wallet-buyerr', itemNome: 'Fertilizante', quantidade: 1 });
    expect(res.status).toBe(200);
  });

  test('POST /renew-token success refreshes JWT', async () => {
    // Need a valid login first to set cookie
    setUser('wallet-renew1');
    await agent.post('/login').send({ walletAddress: 'wallet-renew1' });
    const renew = await agent.post('/renew-token');
    expect(renew.status).toBe(200);
    expect(renew.body.token).toBeTruthy();
  });

  test('GET /user/:walletAddress unauthorized access forbidden', async () => {
    setUser('wallet-owner1');
    // login as wallet-owner1 to get cookie
    await agent.post('/login').send({ walletAddress: 'wallet-owner1' });
    // attempt to request different user
    const res = await agent.get('/user/other-user');
    expect(res.status).toBe(403);
  });

  test('GET /user/:walletAddress success', async () => {
    setUser('wallet-self1');
    await agent.post('/login').send({ walletAddress: 'wallet-self1' });
    const res = await agent.get('/user/wallet-self1');
    expect(res.status).toBe(200);
    expect(res.body.tokenBalance).toBeDefined();
  });

  test('GET /items empty returns []', async () => {
    const res = await agent.get('/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('GET /items non-empty', async () => {
    setItem('shop1', { itemNome: 'Regador' });
    const res = await agent.get('/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  test('GET /session/check success', async () => {
    setUser('wallet-sess1');
    await agent.post('/login').send({ walletAddress: 'wallet-sess1' });
    const res = await agent.get('/session/check');
    expect(res.status).toBe(200);
    expect(res.body.walletAddress).toBe('wallet-sess1');
  });

  test('GET /session/check user not found', async () => {
    // login with user then delete underlying doc
    setUser('wallet-miss1');
    await agent.post('/login').send({ walletAddress: 'wallet-miss1' });
  delete mockPool._store.user['wallet-miss1'];
    const res = await agent.get('/session/check');
    expect(res.status).toBe(404);
  });

  test('POST /logout revokes token then middleware blocks', async () => {
    setUser('wallet-out01');
    await agent.post('/login').send({ walletAddress: 'wallet-out01' });
    const out = await agent.post('/logout');
    expect(out.status).toBe(200);
    // Try session check with revoked cookie
    const res = await agent.get('/session/check');
    expect([401,403]).toContain(res.status); // token revogado -> 401
  });
});
