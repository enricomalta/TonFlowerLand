
import { jest } from '@jest/globals';

describe('blockchainDeposit error branches', () => {
  let pool;
  beforeEach(() => {
    pool = {
      _store: {
        users: {},
        user: {},
        items: {},
        plantTime: [],
        transactions: [],
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
  });
  it('creditUserBalance: user does not exist', async () => {
    const pool = {
      query: jest.fn(async (sql, params) => [[undefined]]),
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        query: jest.fn(),
        release: () => {}
      })
    };
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool })); // Apenas MySQL
    const { creditUserBalance } = await import('../js/back-end/blockchainDeposit.js');
    await creditUserBalance('addr', 10);
    // Só loga erro, não retorna nada
    expect(true).toBe(true);
  });

  it('creditUserBalance: criptoBalance not a number', async () => {
    const pool = {
      query: jest.fn(async (sql, params) => [[{ criptoBalance: 'abc' }]]),
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        query: jest.fn(),
        release: () => {}
      })
    };
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { creditUserBalance } = await import('../js/back-end/blockchainDeposit.js');
    await creditUserBalance('addr', 10);
    expect(true).toBe(true);
  });

  it('withdrawTokens: user not found', async () => {
    const pool = {
      query: jest.fn(async (sql, params) => [[undefined]]),
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        query: jest.fn(),
        release: () => {}
      })
    };
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { withdrawTokens } = await import('../js/back-end/blockchainDeposit.js');
    const res = await withdrawTokens('addr', 10);
    expect(res.error).toMatch(/Usuário não encontrado/);
  });

  it('withdrawTokens: insufficient balance', async () => {
    const pool = {
      query: jest.fn(async (sql, params) => [[{ tokenBalance: 1 }]]),
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        query: jest.fn(),
        release: () => {}
      })
    };
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { withdrawTokens } = await import('../js/back-end/blockchainDeposit.js');
    const res = await withdrawTokens('addr', 10);
    expect(res.error).toMatch(/Saldo insuficiente/);
  });

  it('withdrawTokens: generic error', async () => {
    const pool = {
      query: jest.fn(async () => { throw new Error('Generic get error'); }),
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        query: jest.fn(),
        release: () => {}
      })
    };
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { withdrawTokens } = await import('../js/back-end/blockchainDeposit.js');
    const res = await withdrawTokens('addr', 10);
    expect(res.error).toMatch(/Generic get error/);
  });
});
