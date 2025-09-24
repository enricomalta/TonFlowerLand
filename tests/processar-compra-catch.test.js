// import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool
import { processarCompra } from '../js/back-end/processarCompra.js';

describe('processarCompra catch coverage', () => {
  it('should handle exception and return error', async () => {
    // Mock db.runTransaction to throw inside callback
    const originalRunTransaction = processarCompra.__proto__.db?.runTransaction;
    const db = {
      runTransaction: async (cb) => {
        throw new Error('Mocked transaction error');
      }
    };
    // Patch processarCompra to use mocked db
    const patched = async (...args) => {
      const oldDb = processarCompra.__proto__.db;
      processarCompra.__proto__.db = db;
      const result = await processarCompra(...args);
      processarCompra.__proto__.db = oldDb;
      return result;
    };
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({
      pool: {
        query: jest.fn(async (sql, params) => {
          // Simula SELECT retornando objeto vazio
          if (/SELECT/.test(sql)) return [[{}]];
          // Simula INSERT/UPDATE sem erro
          return [{}];
        }),
        getConnection: async () => ({
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {},
          query: jest.fn(),
          release: () => {}
        })
      }
    }));
    const res = await patched('wallet1', 'itemA', 1);
    expect(res.error).toMatch(/Erro ao processar a compra:/);
  });
});
