import { jest } from '@jest/globals';

// Precisamos limpar o cache entre modos

async function importWithMode(mode){
  process.env.BLOCKCHAIN_MODE = mode;
  // mock TonWeb apenas quando for 'ton'
  if(mode === 'ton'){
    // Mock TonWeb com wallet e métodos esperados
    const getSeqno = jest.fn().mockResolvedValue(42);
    const transfer = jest.fn().mockResolvedValue({ id: 'transfer-abc', any:true });
    const wallet = { getSeqno, transfer };
    const TonWebMock = function(){ return { wallet:{ create: ()=> wallet } }; };
    TonWebMock.utils = { toNano: (v)=> `NANO(${v})` }; // static util
    await jest.unstable_mockModule('tonweb', ()=>({ default: TonWebMock }));
  } else {
    await jest.unstable_mockModule('tonweb', ()=>({ default: function(){ return {}; }, utils:{ toNano:(v)=>v } }));
  }
  const mod = await import('../js/back-end/blockchainProvider.js');
  return mod;
}

describe('blockchainProvider coverage', ()=>{
  beforeEach(()=>{ jest.resetModules(); });

  test('mock mode sendMessage & listRecent', async ()=>{
    const { blockchain, isMock } = await importWithMode('mock');
    expect(isMock()).toBe(true);
    const tx1 = await blockchain.sendMessage({ toAddress:'addr1', amountTon:1 });
    const tx2 = await blockchain.sendMessage({ toAddress:'addr2', amountTon:2, payload:'X' });
    expect(tx1.txId).toBeDefined();
    const recent = await blockchain.listRecent(5);
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].txId).toBe(tx2.txId); // ordem reversa
  });

  test('ton mode sendMessage usa wallet e toNano', async ()=>{
    const { blockchain, isMock } = await importWithMode('ton');
    expect(isMock()).toBe(false);
    const res = await blockchain.sendMessage({ toAddress:'addr-real', amountTon:3, payload:'PAY' });
    expect(res.txId).toContain('transfer-abc');
    const list = await blockchain.listRecent();
    expect(Array.isArray(list)).toBe(true);
  });
});
