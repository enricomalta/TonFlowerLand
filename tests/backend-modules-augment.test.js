import { jest } from '@jest/globals';

// Todos os testes devem usar apenas mocks do pool MySQL
// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool

// Todos os testes devem usar apenas mocks do pool MySQL
function makePool() {
  const store = { user:{}, users:{}, items:{}, ledger:{}, challenges:{} };
  return {
    _store: store,
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT') && sql.includes('FROM users')) {
        const wallet = params[0];
        const user = store.users[wallet];
        return [[user ? { wallet_address: wallet, ...user } : undefined]];
      }
      if (sql.includes('SELECT') && sql.includes('FROM items')) {
        return [Object.values(store.items)];
      }
      if (sql.includes('SELECT') && sql.includes('FROM ledger')) {
        return [Object.values(store.ledger)];
      }
      if (sql.includes('SELECT') && sql.includes('FROM challenges')) {
        const wallet = params[0];
        const challenge = store.challenges[wallet];
        return [[challenge ? { wallet_address: wallet, ...challenge } : undefined]];
      }
      if (sql.includes('INSERT INTO users')) {
        const wallet = params[0];
        store.users[wallet] = { tokenBalance: params[1], inventario: [], plantTime: [], ...params.slice(2) };
        return [{ insertId: wallet }];
      }
      if (sql.includes('INSERT INTO items')) {
        const id = params[0];
        store.items[id] = { itemNome: params[1], itemPreco: params[2], ...params.slice(3) };
        return [{ insertId: id }];
      }
      if (sql.includes('INSERT INTO ledger')) {
        const id = params[0];
        store.ledger[id] = { ...params.slice(1) };
        return [{ insertId: id }];
      }
      if (sql.includes('INSERT INTO challenges')) {
        const wallet = params[0];
        store.challenges[wallet] = { challenge: params[1], createdAt: params[2] };
        return [{ insertId: wallet }];
      }
      if (sql.includes('UPDATE users')) {
        const wallet = params[1];
        if (store.users[wallet]) store.users[wallet].tokenBalance = params[0];
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
await jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: mockPool }));

// Mock axios before importing blockchainDeposit
const mockGet = jest.fn();
await jest.unstable_mockModule('axios', () => ({ default: { get: mockGet } }));

// Import modules under test AFTER mocks
const { createUser } = await import('../js/back-end/createUser.js');
const { processarCompra } = await import('../js/back-end/processarCompra.js');
const { plantSeed } = await import('../js/back-end/plantSeed.js');
const { removeItem } = await import('../js/back-end/removeItem.js');
const { colectSeed } = await import('../js/back-end/colectSeed.js');
const { removeParasita } = await import('../js/back-end/removeParasita.js');
const { updatePlantStatus, recalculateHarvestDate } = await import('../js/back-end/updatePlant.js');
const { monitorDeposits, creditUserBalance, withdrawTokens } = await import('../js/back-end/blockchainDeposit.js');
const { appendLedger, findByRequestId, listRecent } = await import('../js/back-end/ledger.js');
const { metrics, metricsMiddleware, renderAllMetrics } = await import('../js/back-end/metrics.js');
const { verifyToken } = await import('../js/back-end/verifyToken.js');
const { updateTokenBalance } = await import('../js/back-end/updateTokenBalance.js');
const { generateChallenge } = await import('../js/back-end/walletConnect.js');

// Utility to build mock req/res for middleware
function buildReqRes(headers={}, cookies={}){
  const req = { headers, cookies, method: 'GET', originalUrl: '/x', route:{ path:'/x' } };
  const res = { statusCode:200, headers:{}, on(ev,cb){ if(ev==='finish') this._finish=cb; }, status(c){ this.statusCode=c; return this; }, json(obj){ this.body=obj; this._finish && this._finish(); return this; }, getHeader(k){ return this.headers[k.toLowerCase()]; }, setHeader(k,v){ this.headers[k.toLowerCase()]=v; } };
  return { req, res };
}


// Função utilitária para inicializar o estado do mockPool
async function seedBase() {
  mockPool._store.users = {};
  mockPool._store.items = {};
  mockPool._store.ledger = {};
  mockPool._store.challenges = {};
  // Usuários padrão com todos os campos esperados
  mockPool._store.users['user1'] = { tokenBalance: '50.00', inventario: ['Semente:5'], plantTime: [], criptoBalance: '0.00' };
  mockPool._store.users['walletA'] = { tokenBalance: '100.00', inventario: ['Seed:2'], plantTime: [], criptoBalance: '0.00' };
  mockPool._store.users['walletB'] = { tokenBalance: '50.00', inventario: ['Seed:1'], plantTime: [], criptoBalance: '0.00' };
  mockPool._store.users['walletY'] = { tokenBalance: '0.00', inventario: [], plantTime: [], criptoBalance: '0.00' };
  mockPool._store.users['seller123'] = { inventory: [{ id: 1, quantity: 10 }], tokenBalance: '0.00', inventario: [], plantTime: [], criptoBalance: '0.00' };
  mockPool._store.users['buyer456'] = { balance: 1000, tokenBalance: '0.00', inventario: [], plantTime: [], criptoBalance: '0.00' };
  // Itens padrão
  mockPool._store.items['Seed'] = { itemNome: 'Semente', itemPreco: '10.00', item_id: 'Seed' };
  mockPool._store.items['itemNew'] = { itemNome: 'Novo', itemPreco: '20.00', item_id: 'itemNew' };
  mockPool._store.items['Regador'] = { itemNome: 'Regador', itemPreco: '5.00', item_id: 'Regador' };
  mockPool._store.items['Anti-Parasitas'] = { itemNome: 'Anti-Parasitas', itemPreco: '15.00', item_id: 'Anti-Parasitas' };
}

beforeEach(async () => {
  // reset store
  mockPool._store.user = {};
  mockPool._store.items = {};
  mockPool._store.ledger = {};
  mockPool._store.challenges = {};
  await seedBase();
  // Garante que todos os campos esperados estejam presentes para todos os usuários
  mockPool._store.users = {
    user1: {
      inventario: ['Semente'],
      criptoBalance: '50.00',
      plantTime: [],
      tokenBalance: '50.00',
      growthStatus: { isParasita: false, isFinish: false },
    }
  };
  mockPool._store.user = {};
  mockPool._store.items = { Semente: { itemNome: 'Semente', itemPreco: '10.00' } };
  mockPool._store.transactions = [];
  mockPool._store.plantTime = [];
  mockPool._store.ledger = [];
  mockPool._store.clientSecurityEvents = {};
  mockPool._store.challenges = {};
  mockPool._store.idempotencyKeys = {};
  // Inicializar inventario, plantTime, criptoBalance para todos os usuários
  Object.values(mockPool._store.users).forEach(u => {
    if (!u.inventario) u.inventario = [];
    if (!u.plantTime) u.plantTime = [];
    if (!u.growthStatus) u.growthStatus = { isParasita: false, isFinish: false };
    if (!u.criptoBalance) u.criptoBalance = '0.00';
    if (!u.tokenBalance) u.tokenBalance = '0.00';
  });
});

// --- createUser ---

test('createUser - creates new user when not exists', async () => {
  const result = await createUser('newWallet');
  expect(result.userData.walletAddress).toBe('newWallet');
});

test('createUser - returns existing user path', async () => {
  const first = await createUser('existing');
  const second = await createUser('existing');
  expect(second.message).toMatch(/Login/);
});

// --- processarCompra ---

test('processarCompra - sucesso e saldo decrementado', async () => {
  const outcome = await processarCompra('user1','Semente',1);
  expect(outcome.success).toBeTruthy();
  expect(outcome.userData.tokenBalance).toBe('40.00');
});

test('processarCompra - item não encontrado', async () => {
  const out = await processarCompra('user1','XItem',1);
  expect(out.error).toMatch(/Item não encontrado/);
});

// --- plantSeed ---

test('plantSeed - erro itemTime inválido', async () => {
  const r = await plantSeed('user1',1,'Semente','abc','flowerA','Rara');
  expect(r.error).toBeTruthy();
});

test('plantSeed - sucesso plantio', async () => {
  // ensure user has item in inventario
  const r = await plantSeed('user1',1,'Semente',1,'flowerA','Rara');
  expect(r.slotID).toBe(1);
});

// --- removeItem ---

test('removeItem - item não encontrado', async () => {
  const out = await removeItem('user1','Inexistente',1);
  expect(out.error).toMatch(/não encontrado/);
});

test('removeItem - sucesso remove e zera', async () => {
  // add item with quantity 1 then remove
  mockPool._store.users['user1'].inventario.push('Temp:1');
  const out = await removeItem('user1','Temp',1);
  expect(out.success).toMatch(/Temp/);
});

// --- colectSeed ---

test('colectSeed - planta não pronta', async () => {
  // plant with future harvest (default logic uses +20y) so not ready
  await plantSeed('user1',2,'Semente',1,'flowerA','Rara');
  const out = await colectSeed('user1',2);
  expect(out.error).toMatch(/ainda não/);
});

test('colectSeed - sucesso após ajustar harvestDate', async () => {
  await plantSeed('user1',3,'Semente',1,'flowerA','Rara');
  // Manually set harvestDate in past
  const plant = mockPool._store.users['user1'].plantTime.find(p=>p.slotID===3);
  plant.harvestDate = new Date(Date.now() - 10000);
  const out = await colectSeed('user1',3);
  expect(out.message).toMatch(/sucesso/);
});

// --- removeParasita ---

test('removeParasita - planta não tem parasita', async () => {
  await plantSeed('user1',4,'Semente',1,'flowerA','Rara');
  const out = await removeParasita('user1',4);
  expect(out.message).toMatch(/não está com parasita/);
});

test('removeParasita - sucesso remove simples', async () => {
  await plantSeed('user1',5,'Semente',1,'flowerA','Rara');
  const plant = mockPool._store.users['user1'].plantTime.find(p=>p.slotID===5);
  plant.growthStatus.isParasita = true; // sem pause para evitar erros de timestamp
  const out = await removeParasita('user1',5);
  expect(out.success).toBe(true);
});

// --- updatePlantStatus & recalculateHarvestDate ---

test('updatePlantStatus - falta item inventário', async () => {
  mockPool._store.users['user1'].inventario = ['Outra:1'];
  const out = await updatePlantStatus('user1',99,'isWatered',true,'Regador');
  expect(out.success).toBe(false);
});

test('recalculateHarvestDate - diferentes estados', async () => {
  await plantSeed('user1',6,'Semente',1,'flowerA','Rara');
  const plant = mockPool._store.users['user1'].plantTime.find(p=>p.slotID===6);
  plant.growthStatus.isWatered = true;
  plant.growthStatus.isFertilized = true;
  const half = await recalculateHarvestDate(plant);
  expect(half instanceof Date).toBe(true);
  plant.growthStatus.isWatered = false; plant.growthStatus.isParasita = true; plant.growthStatus.isFertilized=false;
  const penalized = await recalculateHarvestDate(plant);
  expect(penalized.getFullYear() - new Date().getFullYear()).toBeGreaterThan(5); // 20y penalty roughly
});

// --- blockchainDeposit functions ---

test('creditUserBalance - soma valores', async () => {
  await creditUserBalance('user1', 10);
  expect(mockPool._store.users['user1'].criptoBalance).toBe('10.00');
});

test('withdrawTokens - saldo insuficiente', async () => {
  const result = await withdrawTokens('user1', 999999);
  expect(result.error).toMatch(/Saldo insuficiente/);
});

test('monitorDeposits - processa transações', async () => {
  mockGet.mockResolvedValueOnce({ data: { transactions: [ { in_msg: { value: 7, source: 'user1' } } ] }});
  await monitorDeposits();
  expect(mockPool._store.users['user1'].criptoBalance).toBe('7.00');
});

// --- ledger ---

test('ledger append/find/list', async () => {
  const entry = await appendLedger({ type:'purchase', walletAddress:'user1', amountToken:5, requestId:'abc' });
  expect(entry.id).toBeTruthy();
  const found = await findByRequestId('abc');
  const recent = await listRecent(5);
  expect(found.id).toBe(entry.id);
  expect(recent.length).toBeGreaterThan(0);
});

// --- metrics ---

test('metrics middleware & render', () => {
  const { req, res } = buildReqRes();
  metricsMiddleware(req,res,()=>{ res.status(200).json({ ok:true }); });
  const output = renderAllMetrics();
  expect(output).toMatch(/app_requests_total/);
});

// --- verifyToken ---
import jwt from 'jsonwebtoken';

test('verifyToken - token ausente', async () => {
  const { req, res } = buildReqRes();
  await verifyToken(req,res,()=>{}); // should short-circuit
  expect(res.body.error).toMatch(/Token não fornecido/);
});

// success path for watering then applying anti-parasitas (protection)
test('updatePlantStatus - rega e protege', async () => {
  await plantSeed('user1',7,'Semente',1,'flowerA','Rara');
  const water = await updatePlantStatus('user1',7,'isWatered',true,'Regador');
  expect(water.success).toBe(true);
  const protect = await updatePlantStatus('user1',7,'isParasita',false,'Anti-Parasitas');
  expect(protect.success).toBe(true);
});

// --- updateTokenBalance ---
test('updateTokenBalance - sucesso', async () => {
  await updateTokenBalance('user1', 123.456);
  expect(mockPool._store.users['user1'].tokenBalance).toBe('123.46');
});

// --- walletConnect generateChallenge ---
test('generateChallenge - sucesso', async () => {
  const req = { body: { walletAddress: 'user1' } };
  const res = { json(obj){ this.body=obj; } };
  await generateChallenge(req,res);
  expect(res.body.challenge).toMatch(/TON Login Challenge/);
});

test('verifyToken - token válido em cookie', async () => {
  const token = jwt.sign({ uid:'u1' }, process.env.JWT_SECRET || 'testsecret');
  const { req, res } = buildReqRes({}, { jwt: token });
  await new Promise(resolve => verifyToken(req,res,resolve));
  // middleware should call next without changing res.body
  expect(res.body).toBeUndefined();
});
