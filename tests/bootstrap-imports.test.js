// import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
// Todos os testes devem usar apenas mocks do pool MySQL
// Teste de bootstrap: força import dos módulos principais para garantir que Jest os instrumente
import '../server.js';
import '../js/back-end/ledger.js';
import '../js/back-end/blockchainProvider.js';
import '../js/back-end/metrics.js';

describe('Bootstrap Imports', () => {
  it('should load core modules without throwing', () => {
    expect(true).toBe(true);
  });
    // Todos os testes devem usar apenas mocks do pool MySQL
});