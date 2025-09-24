// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool
let store;
import { jest } from '@jest/globals';

// Additional branch coverage focused tests
// We create an isolated in-memory Firestore mock (similar but leaner than the one in backend-modules-augment)
class MockTimestamp {
  constructor(date){ this._date=date; }
  toDate(){ return this._date; }
  static fromDate(d){ return new MockTimestamp(d); }
}

function createMockDb(){
  const store = { user:{}, users:{}, items:{} };
  function makeDoc(col,id){
    return {
      async get(){
        const data = store[col][id];
        function clone(val){
          if (val === null || typeof val !== 'object') return val;
            // Preserve any object that looks like our MockTimestamp (has toDate)
          if (typeof val.toDate === 'function') return val;
          if (Array.isArray(val)) return val.map(clone);
          const out = {};
          for (const k of Object.keys(val)) out[k] = clone(val[k]);
          return out;
        }
        return { exists: !!data, data: () => clone(data||{}) };
      },
      async set(val,opts){ store[col][id] = opts?.merge && store[col][id] ? { ...store[col][id], ...val } : { ...val }; },
      async update(patch){ if(!store[col][id]) throw new Error('not-found'); store[col][id] = { ...store[col][id], ...patch }; }
    };
  }
  return {
    _store: store,
    collection(name){
      return {
        doc(id){ return makeDoc(name,id); },
        where(){ return this; }, // minimal API for processarCompra
        limit(){ return this; },
        async get(){
          const docs = Object.entries(store[name]).map(([id,data])=>({ id, data: () => JSON.parse(JSON.stringify(data)) }));
          return { empty: docs.length===0, docs };
        }
      };
    },
    async runTransaction(fn){
      const tx = { get: (docRef)=>docRef.get(), update: (docRef,patch)=>docRef.update(patch) };
      return fn(tx);
    }
  };
}


function makePool() {
  store = { user:{}, users:{}, items:{} };
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

// Import target modules AFTER mocks
// store agora é global e usado por seedUser/seedItem
const { removeParasita } = await import('../js/back-end/removeParasita.js');
const { removeItem } = await import('../js/back-end/removeItem.js');
const { processarCompra } = await import('../js/back-end/processarCompra.js');
const { updateTokenBalance } = await import('../js/back-end/updateTokenBalance.js');
const { colectSeed } = await import('../js/back-end/colectSeed.js');

// Inicialização dos dados globais para todos os testes
beforeEach(() => {
  // Limpa e inicializa store global
  store.users = {};
  store.items = {};
  store.user = {};
  // Usuário padrão
  store.users['w1'] = {
    tokenBalance: '50.00',
    inventario: ['Semente:2','Regador:1','Anti-Parasitas:1'],
    plantTime: []
  };
  store.users['poor'] = {
    tokenBalance: '5.00',
    inventario: ['Semente:1'],
    plantTime: []
  };
  store.users['corrupt'] = {
    tokenBalance: 'abc',
    inventario: ['Semente:1'],
    plantTime: []
  };
  store.users['nouser'] = {};
  store.items['Seed'] = {
    itemNome: 'Semente',
    itemPreco: '10.00',
    item_id: 'Seed'
  };
  store.items['Temp'] = {
    itemNome: 'Temp',
    itemPreco: '5.00',
    item_id: 'Temp'
  };
  store.items['it1'] = {
    itemNome: 'Seed',
    itemPreco: '10.00',
    item_id: 'it1'
  };
  store.items['it2'] = {
    itemNome: 'Semente',
    itemPreco: '10.00',
    item_id: 'it2'
  };
  store.items['it3'] = {
    itemNome: 'Semente',
    itemPreco: '10.00',
    item_id: 'it3'
  };
});

// Helper seed utilities
async function seedUser(id, data){
  store.users[id] = {
    tokenBalance: '50.00',
    inventario: ['Semente:2','Regador:1','Anti-Parasitas:1'],
    ...data
  };
}

async function seedItem(id, nome, preco = '5.00'){
  store.items[id] = {
    itemNome: nome,
    itemPreco: preco
  };
}

// --- removeItem branches ---

test('removeItem - endereço inválido', async () => {
  const out = await removeItem('', 'X', 1);
  expect(out.error).toMatch(/Endereço de carteira inválido/);
});

test('removeItem - nome item inválido', async () => {
  const out = await removeItem('w1', '', 1);
  expect(out.error).toMatch(/Nome do item inválido/);
});

test('removeItem - quantidade inválida (zero)', async () => {
  const out = await removeItem('w1', 'Semente', 0);
  expect(out.error).toMatch(/Quantidade inválida/);
});

test('removeItem - usuário não encontrado', async () => {
  await seedUser('nouser', {});
  const out = await removeItem('nouser','Semente',1);
  expect(out.error).toMatch(/Usuário não encontrado/);
});

test('removeItem - quantidade resultante negativa', async () => {
  await seedUser('u3',{ inventario: ['Temp:1'] });
  const out = await removeItem('u3','Temp',2);
  expect(out.error).toMatch(/quantidade mínima/);
});

// --- processarCompra branches ---

test('processarCompra - parâmetros inválidos (quantidade !=1)', async () => {
  const out = await processarCompra('w1','Seed',2);
  expect(out.error).toMatch(/Parâmetros inválidos/);
});

test('processarCompra - usuário não encontrado', async () => {
  // item exists but user missing
  await seedItem('it1','Seed');
  await seedUser('missing', {});
  const out = await processarCompra('missing','Seed',1);
  expect(out.error).toMatch(/Usuário não encontrado/);
});

test('processarCompra - saldo insuficiente', async () => {
  await seedUser('poor',{ tokenBalance: '5.00' });
  await seedItem('it2','Semente','10.00');
  const out = await processarCompra('poor','Semente',1);
  expect(out.error).toMatch(/Saldo insuficiente/);
});

test('processarCompra - erro nos dados de saldo', async () => {
  await seedUser('corrupt',{ tokenBalance: 'abc' });
  await seedItem('it3','Semente','10.00');
  const out = await processarCompra('corrupt','Semente',1);
  expect(out.error).toMatch(/Erro nos dados/);
});

// --- updateTokenBalance error branches ---

test('updateTokenBalance - endereço inválido lança erro', async () => {
  await expect(updateTokenBalance(null, 10)).rejects.toThrow(/Endereço de carteira inválido/);
});

test('updateTokenBalance - saldo inválido negativo lança erro', async () => {
  await expect(updateTokenBalance('w2', -5)).rejects.toThrow(/Valor de saldo inválido/);
});

// --- colectSeed error branches ---

test('colectSeed - endereço de carteira inválido', async () => {
  const out = await colectSeed('',1);
  expect(out.error).toMatch(/Endereço de carteira inválido/);
});

test('colectSeed - slot inválido', async () => {
  const out = await colectSeed('w1','-1');
  expect(out.error).toMatch(/ID do slot inválido/);
});

test('colectSeed - usuário não encontrado', async () => {
  const out = await colectSeed('nouser',1);
  expect(out.error).toMatch(/Usuário não encontrado/);
});

test('colectSeed - planta inexistente no slot', async () => {
  await seedUser('u4',{ plantTime: [] });
  const out = await colectSeed('u4',5);
  expect(out.error).toMatch(/Nenhuma planta/);
});

test('colectSeed - item não encontrado no banco', async () => {
  // seed plant with past harvest to trigger success flow until item fetch
  const past = { _seconds: Math.floor(Date.now()/1000)-10, _nanoseconds:0 };
  await seedUser('u5',{ plantTime: [ { slotID: 2, harvestDate: past, itemId: 'missing', itemNome:'Semente' } ], inventario: [] });      
  const out = await colectSeed('u5',2);
  expect(out.error).toMatch(/Item não encontrado/);
});

test('colectSeed - saldo atual inválido', async () => {
  const past = { _seconds: Math.floor(Date.now()/1000)-10, _nanoseconds:0 };
  await seedUser('u6',{ tokenBalance: 'abc', plantTime: [ { slotID: 3, harvestDate: past, itemId: 'itX', itemNome:'Semente' } ] });
  await seedItem('itX','Semente','10.00');
  await seedUser('u6', {});
  const out = await colectSeed('u6',3);
  expect(out.error).toMatch(/Saldo atual inválido/);
});
