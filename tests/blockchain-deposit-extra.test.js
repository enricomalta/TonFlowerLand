import { jest } from '@jest/globals';

// Mock config BEFORE importing module under test

const store = { users: {} };
const pool = {
  query: jest.fn(async (sql, params) => {
    if (sql.includes('SELECT')) {
      const wallet = params[0];
      const user = store.users[wallet];
      return [[user ? { wallet_address: wallet, ...user } : undefined]];
    }
    if (sql.includes('INSERT INTO users')) {
      const wallet = params[0];
      store.users[wallet] = { tokenBalance: params[1], criptoBalance: params[2] };
      return [{ insertId: wallet }];
    }
    if (sql.includes('UPDATE users')) {
      const wallet = params[1];
      if (store.users[wallet]) store.users[wallet].tokenBalance = params[0];
      return [{ affectedRows: 1 }];
    }
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
jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool })); // Apenas MySQL

// Mock axios to control responses and throw errors
jest.unstable_mockModule('axios', () => ({
  default: { get: jest.fn() }
}));

const axios = (await import('axios')).default;
const { monitorDeposits, creditUserBalance, withdrawTokens } = await import('../js/back-end/blockchainDeposit.js');

describe('blockchainDeposit extra coverage', () => {
  test('creditUserBalance creates new user and sums balance; withdraw remains insufficient (tokenBalance unaffected)', async () => {
    await creditUserBalance('addr1', 1.25);
    await creditUserBalance('addr1', 0.75); // total criptoBalance 2.00 but tokenBalance still undefined => 0
    const res = await withdrawTokens('addr1', 1);
    expect(res.error).toMatch(/Saldo insuficiente/);
  });

  test('monitorDeposits processes transactions with positive value', async () => {
    axios.get.mockResolvedValueOnce({ data: { transactions: [ { in_msg: { value: 10, source: 'addr2' } }, { in_msg: { value: 0, source: 'skip' } } ] } });
    await monitorDeposits();
    const res = await withdrawTokens('addr2', 11); // should fail insufficient confirming credit executed
    expect(res.error).toMatch(/Saldo insuficiente/);
  });

  test('monitorDeposits handles error path', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));
    await monitorDeposits(); // should not throw
  });

  test('withdrawTokens user not found', async () => {
    const res = await withdrawTokens('missing', 5);
    expect(res.error).toMatch(/Usuário não encontrado/);
  });
});
