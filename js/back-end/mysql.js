import dotenv from "dotenv";
dotenv.config();

// js/back-end/mysql.js
import mysql from 'mysql2/promise';


// MockPool para testes
const mockPool = {
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
  query: async (sql, params) => {
    // Simulação básica para SELECT/INSERT/UPDATE/DELETE
    if (/SELECT \* FROM users/.test(sql)) {
      // Retorna array de usuários
      if (params && params[0]) {
        const user = mockPool._store.users[params[0]];
        return [[user ? user : undefined], {}];
      }
      return [Object.values(mockPool._store.users), {}];
    }
    if (/SELECT \* FROM items/.test(sql)) {
      return [Object.values(mockPool._store.items), {}];
    }
    if (/SELECT \* FROM transactions/.test(sql)) {
      return [mockPool._store.transactions, {}];
    }
    if (/INSERT INTO users/.test(sql)) {
      const wallet = params[0];
      mockPool._store.users[wallet] = { walletAddress: wallet, tokenBalance: 0, inventario: [], plantTime: [], criptoBalance: '0.00' };
      return [[{ insertId: wallet }], {}];
    }
    if (/UPDATE users SET tokenBalance/.test(sql)) {
      const balance = params[0];
      const wallet = params[1];
      if (mockPool._store.users[wallet]) mockPool._store.users[wallet].tokenBalance = balance;
      return [[{ affectedRows: 1 }], {}];
    }
    if (/UPDATE users SET inventario/.test(sql)) {
      const inventario = params[0];
      const wallet = params[1];
      if (mockPool._store.users[wallet]) mockPool._store.users[wallet].inventario = inventario;
      return [[{ affectedRows: 1 }], {}];
    }
    if (/DELETE FROM users/.test(sql)) {
      const wallet = params[0];
      delete mockPool._store.users[wallet];
      return [[{ affectedRows: 1 }], {}];
    }
    if (/INSERT INTO transactions/.test(sql)) {
      // Compatível com testes que esperam plantType, slotId, reward, hasParasite
      const tx = {
        type: params[0],
        plantType: params[1],
        slotId: params[2],
        reward: params[3],
        timestamp: params[4],
        hasParasite: params[5],
      };
      mockPool._store.transactions.push(tx);
      return [[{ insertId: mockPool._store.transactions.length }], {}];
    }
    // Default: retorna array vazio
    return [[], {}];
  },
  getConnection: async () => ({
    ...mockPool,
    release: () => {},
    rollback: async () => {},
    commit: async () => {},
  }),
};

let pool;
if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
  pool = mockPool;
} else {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    connectionLimit: 10,
    queueLimit: 0
  });
}
export { pool, mockPool };