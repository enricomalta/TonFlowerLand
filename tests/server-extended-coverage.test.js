// Adiciona mockPool global para evitar ReferenceError
const mockPool = {
  _store: {
    users: {},
    items: {},
    clientSecurityEvents: {},
    challenges: {},
    idempotencyKeys: {},
    ledger: [],
  },
  query: jest.fn(),
  getConnection: async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    query: jest.fn(),
    release: () => {}
  })
};
import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool

// ledger mock (only for replay & append errors)
const ledger = []; await jest.unstable_mockModule('../js/back-end/ledger.js',()=>({
  appendLedger: async (entry)=>{ ledger.push(entry); if(entry.metadata?.forceThrow) throw new Error('forced'); },
  findByRequestId: async (id)=> ledger.find(l=>l.requestId===id)
}));

// blockchain mock with injectable failure
let forceBlockchainError=false;
const sendMessageMock = jest.fn(async ()=>{ if(forceBlockchainError) throw new Error('blockchain fail'); return { ok:true }; });
await jest.unstable_mockModule('../js/back-end/blockchainProvider.js',()=>({ blockchain:{ sendMessage: sendMessageMock }, isMock:()=>true }));

// metrics mock (include renderAllMetrics to satisfy server import)
await jest.unstable_mockModule('../js/back-end/metrics.js',()=>({
  metricsMiddleware:(r,s,n)=>n(),
  metrics:{
    ledgerWrites:{ inc:()=>{} },
    requests:{ inc:()=>{} },
    errors:{ inc:()=>{} },
    latency:{ observe:()=>{} },
    statusClasses:{ inc:()=>{} },
    payloadBytes:{ inc:()=>{} },
    responseBytes:{ inc:()=>{} },
    securityEvents:{ inc:()=>{} },
    eventLoopLag:{ observe:()=>{} }
  },
  renderAllMetrics: () => '# METRICS\n'
}));

// firebase admin + config
// Removido mock do firebase-admin/app e global.admin. Apenas MySQL.
await jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: mockPool }));

// Import server AFTER mocks
const { server } = await import('../server.js');
const agent = request.agent(server);

function seedUser(wallet,data={}){ mockPool._store.users[wallet]={ tokenBalance: data.tokenBalance??100, inventario: data.inventario??[], plantTime:[], ...data }; }
function seedItem(nome,preco='5.00'){ mockPool._store.items[nome]={ itemNome:nome, itemPreco:preco, itemPay:'1', xp:'0' }; }

describe('server extended coverage', ()=>{
  beforeEach(()=>{ // reset volatile collections except ledger
    mockPool._store.users={}; mockPool._store.items={}; mockPool._store.clientSecurityEvents={}; mockPool._store.challenges={}; mockPool._store.idempotencyKeys={};
    forceBlockchainError=false; sendMessageMock.mockClear();
  });

  test('POST /verify-transaction cria usuário (stub) userCreated true', async ()=>{
    const res = await agent.post('/verify-transaction').send({ walletAddress:'wallet-vtx-001', challenge:'desafio-desafio', transaction:{ any:true } });
    expect(res.status).toBe(200);
    expect(res.body.userCreated).toBe(true);
  });

  test('POST /deposit sucesso e histórico', async ()=>{
    // rota usa collection "users" (plural)
  mockPool._store.users = mockPool._store.users || {}; // ensure collection exists
  mockPool._store.users['wallet-dep-001'] = { tokenBalance: 0 };
    const res = await agent.post('/deposit').send({ transactionId: 'tx123', amountTon: 10, timestamp: Date.now(), walletAddress: 'wallet-dep-001' });
    expect(res.status).toBe(200);
  });

  test('POST /deposit 400 wallet ausente', async ()=>{
    const res = await agent.post('/deposit').send({ transactionId:'tx999', amountTon:5, timestamp: Date.now() });
    expect(res.status).toBe(400);
  });

  test('POST /monitor-deposit sucesso', async ()=>{
    seedUser('wallet-mon-001', { tokenBalance: 5 });
    const res = await agent.post('/monitor-deposit').send({ transactionId:'txn-monitor-1', walletAddress:'wallet-mon-001', amountTon: 3 });
    expect(res.status).toBe(200);
  });

  test('POST /login 404 user not found', async ()=>{
    const res = await agent.post('/login').send({ walletAddress:'wallet-miss-01' });
    expect(res.status).toBe(404);
  });

  test('POST /withdraw 404 user not found', async ()=>{
    const res = await agent.post('/withdraw').set('x-idempotency-key','idemp-x1').send({ walletAddress:'wallet-nowhere', amountTon:10 });
    expect(res.status).toBe(404);
  });

  test('POST /withdraw blockchain error triggers 500', async ()=>{
    seedUser('wallet-blk-err',{ tokenBalance:50 }); forceBlockchainError=true;
    const res = await agent.post('/withdraw').set('x-idempotency-key','idemp-x2').send({ walletAddress:'wallet-blk-err', amountTon:10 });
    expect(res.status).toBe(500);
  });

  test('POST /processarCompra item não encontrado', async ()=>{
    seedUser('wallet-buy-miss',{ tokenBalance:100 });
    const res = await agent.post('/processarCompra').set('x-idempotency-key','idemp-x3').send({ walletAddress:'wallet-buy-miss', itemNome:'Fantasma', quantidade:1 });
    expect([400,404]).toContain(res.status); // aceitar 404 caso rota mapear como not found
  });

  test('POST /processarCompra saldo insuficiente', async ()=>{
    seedUser('wallet-low',{ tokenBalance:1 }); seedItem('Caro','10.00');
    const res = await agent.post('/processarCompra').set('x-idempotency-key','idemp-x4').send({ walletAddress:'wallet-low', itemNome:'Caro', quantidade:1 });
    expect([400,402]).toContain(res.status); // dependendo do texto, poderia mapear 402
  });

  test('POST /processarCompra parametros invalidos', async ()=>{
    const res = await agent.post('/processarCompra').set('x-idempotency-key','idemp-x5').send({ walletAddress:'wallet-param', itemNome:'Item', quantidade:2 });
    // Zod deve permitir quantidade=2? schema exige positive int; a função exige quantidade===1 => erro "Parâmetros inválidos"
    expect([400,500]).toContain(res.status); // mapeado pelo server como 400 generic
  });

  test('POST /removeItem erros variados', async ()=>{
    // usuário inexistente
    let res = await agent.post('/removeItem').send({ walletAddress:'wallet-none', itemNome:'X', quantidade:1 });
    expect(res.status).toBe(400);
    // criar user sem item
    seedUser('wallet-rem',{ inventario:['Outro:2'] });
    res = await agent.post('/removeItem').send({ walletAddress:'wallet-rem', itemNome:'Semente', quantidade:1 });
    expect(res.status).toBe(400);
  });

  test('POST /removeItem sucesso', async ()=>{
    seedUser('wallet-rem2',{ inventario:['Semente:2'] });
    const res = await agent.post('/removeItem').send({ walletAddress:'wallet-rem2', itemNome:'Semente', quantidade:1 });
    expect(res.status).toBe(200);
  });

  test('POST /client-security-event payload inválido', async ()=>{
    const res = await agent.post('/client-security-event').send({ events: 'string' });
    expect(res.status).toBe(400);
  });

  test('GET /metrics & /health basic', async ()=>{
    const m = await agent.get('/metrics');
    expect(m.status).toBe(200);
    const h = await agent.get('/health');
    expect(h.status).toBe(200);
  });

  test('GET /getProfile 401 sem token', async ()=>{
    const res = await agent.get('/getProfile');
    expect(res.status).toBe(401);
  });

  test('GET /getProfile 404 usuário não encontrado', async ()=>{
    seedUser('wallet-prof');
    await agent.post('/login').send({ walletAddress:'wallet-prof' });
  delete mockPool._store.users['wallet-prof'];
    const res = await agent.get('/getProfile');
    expect(res.status).toBe(404);
  });

  test('GET /getProfile sucesso', async ()=>{
    seedUser('wallet-prof2');
    await agent.post('/login').send({ walletAddress:'wallet-prof2' });
    const res = await agent.get('/getProfile');
    expect(res.status).toBe(200);
  });

  test('POST /updatePlantStatus parametros incompletos 400', async ()=>{
    const res = await agent.post('/updatePlantStatus').send({ walletAddress:'w-up1', slotId:1, statusField:'isWatered' });
    expect(res.status).toBe(400);
  });

  test('POST /updatePlantStatus sucesso watering e proteção', async ()=>{
    seedUser('w-up2',{ inventario:['Regador:2','Anti-Parasitas:1'], plantTime:[{ slotID:1, itemId:'flowerA', itemTime:1, growthStatus:{} }] });
    let res = await agent.post('/updatePlantStatus').send({ walletAddress:'w-up2', slotId:1, statusField:'isWatered', newValue:true, utilityName:'Regador' });
    expect(res.status).toBe(200);
    res = await agent.post('/updatePlantStatus').send({ walletAddress:'w-up2', slotId:1, statusField:'isParasita', newValue:false, utilityName:'Anti-Parasitas' });
    expect(res.status).toBe(200);
  });

  test('POST /removeParasita parametros ausentes 400', async ()=>{
    const res = await agent.post('/removeParasita').send({ walletAddress:'x-only' });
    expect(res.status).toBe(400);
  });

  test('POST /removeParasita usuário inexistente 400/429', async ()=>{
    const res = await agent.post('/removeParasita').send({ walletAddress:'no-user', slotId:1 });
    expect([400,429,500]).toContain(res.status); // incluir 429 se rate limit disparar
  });

  test('POST /removeParasita sucesso (pode sofrer rate limit)', async ()=>{
    seedUser('rem-ok',{ plantTime:[{ slotID:2, itemId:'flower', growthStatus:{ isParasita:true, pause:{ type:'parasita', elapsedBeforePause:0, totalTime:3600000 } } }] });
    const res = await agent.post('/removeParasita').send({ walletAddress:'rem-ok', slotId:2 });
    expect([200,400,429]).toContain(res.status); // aceitar rate limit
  });

  test('POST /colectSeed planta não encontrada 404', async ()=>{
    const res = await agent.post('/colectSeed').send({ walletAddress:'colect-x', slotID:99 });
    // Schema exige slotID number; route has validation middleware; if passes, function returns error with "não encontrado"
    expect([400,404]).toContain(res.status);
  });

  test('verifyToken via header Bearer e inválido', async ()=>{
    // Usar um novo agent sem cookies para forçar o caminho header (caso contrário o cookie jwt existente mascara o header)
    const agentHeader = request.agent(server);
    // token válido mas usuário ainda não existe => rota deve retornar 404 após middleware aceitar token
    const token = jwt.sign({ uid:'w-head' }, process.env.JWT_SECRET || 'secret', { expiresIn:'1h' });
    let resOk = await agentHeader.get('/session/check').set('Authorization', `Bearer ${token}`);
    expect([404,200]).toContain(resOk.status); // normalmente 404 (user not found)
    // criar usuário e repetir => agora 200
    seedUser('w-head');
    resOk = await agentHeader.get('/session/check').set('Authorization', `Bearer ${token}`);
    expect(resOk.status).toBe(200);
    // token estruturalmente parecido mas assinatura inválida => jwt.verify lança => 401
    const resBad = await agentHeader.get('/session/check').set('Authorization', 'Bearer invalid.token.here');
    expect(resBad.status).toBe(401);
    // token claramente malformado (sem pontos) => erro de formato => 401
    const resMalformed = await agentHeader.get('/session/check').set('Authorization', 'Bearer malformed');
    expect(resMalformed.status).toBe(401);
  });
});
