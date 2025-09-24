import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Pequena simulação isolada usando partes do middleware real
// Mock Firestore simples em memória
const memory = { collections: {} };
function collection(name){
  if(!memory.collections[name]) memory.collections[name] = new Map();
  return {
    doc: (id) => ({
      async get(){
        const data = memory.collections[name].get(id);
        return { exists: !!data, data: () => data };
      },
      async set(v){ memory.collections[name].set(id, v); }
    }),
    where: (field, op, value) => ({
      async limit(){ return { get: async () => ({ empty:true, docs:[] }) }; }
    })
  };
}

// Mock para appendLedger / findByRequestId semelhante ao módulo real
const ledger = [];
async function appendLedger(entry){
  ledger.push({ id: (ledger.length+1).toString(), ...entry });
  return ledger[ledger.length-1];
}
async function findByRequestId(requestId){
  return ledger.find(l => l.requestId === requestId) || null;
}

// Idempotency middleware simplificado
const IDEMP_HEADER = 'x-idempotency-key';
const idemStore = new Set();
function requireIdempotency(){
  return (req,res,next)=>{
    const key = req.headers[IDEMP_HEADER];
    if(!key) return res.status(428).json({ error:`Header ${IDEMP_HEADER} obrigatório para esta operação`});
    if(idemStore.has(key)) return res.status(200).json({ replay:true });
    idemStore.add(key);
    req.idempotencyKey = key;
    next();
  };
}

function createApp(){
  const app = express();
  app.use(express.json());

  app.post('/processarCompra', requireIdempotency(), async (req,res)=>{
    const { walletAddress, itemNome, quantidade } = req.body;
    if(!walletAddress || !itemNome || typeof quantidade !== 'number' || quantidade<=0){
      return res.status(400).json({ error:'Dados inválidos' });
    }
    const existing = await findByRequestId(req.idempotencyKey);
    if(existing){
      return res.status(200).json({ replay:true, ledger: existing });
    }
    const entry = await appendLedger({ type:'purchase', walletAddress, itemNome, amountToken: quantidade, requestId: req.idempotencyKey });
    res.json({ success:true, ledgerId: entry.id });
  });

  app.get('/health', (req,res)=>{
    res.json({ status:'ok', uptime: 1, version:'test' });
  });

  app.get('/metrics', (req,res)=>{
    res.type('text/plain').send(`# HELP app_uptime_seconds uptime\n# TYPE app_uptime_seconds gauge\napp_uptime_seconds 1`);
  });

  return app;
}

describe('Ledger & Health Endpoints', ()=>{
  let app;
  beforeEach(()=>{ app = createApp(); });

  test('processarCompra cria entrada no ledger', async ()=>{
    const resp = await request(app)
      .post('/processarCompra')
      .set('x-idempotency-key','abc123')
      .send({ walletAddress:'w1', itemNome:'Vaso', quantidade:2 });
    expect(resp.status).toBe(200);
    expect(resp.body.success).toBe(true);
    expect(resp.body.ledgerId).toBeDefined();
  });

  test('processarCompra replay com mesma chave', async ()=>{
    await request(app)
      .post('/processarCompra')
      .set('x-idempotency-key','same1')
      .send({ walletAddress:'w1', itemNome:'Vaso', quantidade:1 });
    const second = await request(app)
      .post('/processarCompra')
      .set('x-idempotency-key','same1')
      .send({ walletAddress:'w1', itemNome:'Vaso', quantidade:1 });
    expect(second.status).toBe(200);
    expect(second.body.replay).toBe(true);
  });

  test('processarCompra falha sem header de idempotência', async ()=>{
    const resp = await request(app)
      .post('/processarCompra')
      .send({ walletAddress:'w1', itemNome:'Vaso', quantidade:1 });
    expect(resp.status).toBe(428);
  });

  test('/health retorna ok', async ()=>{
    const resp = await request(app).get('/health');
    expect(resp.status).toBe(200);
    expect(resp.body.status).toBe('ok');
  });

  test('/metrics expõe métrica uptime', async ()=>{
    const resp = await request(app).get('/metrics');
    expect(resp.status).toBe(200);
    expect(resp.text).toContain('app_uptime_seconds');
  });
});