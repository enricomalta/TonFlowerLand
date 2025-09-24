import { jest } from '@jest/globals';

// Vamos mockar config e removeItem antes de importar plantSeed
const removeItemMock = jest.fn(async () => ({ success: true }));

// Cenários de DB variáveis via factory

function makePool(overrides = {}) {
  // Garante que inventario e plant_time sejam arrays válidos
  const userData = overrides.userData || { inventario: ["Seed:2"], plant_time: JSON.stringify([]) };
  if (!Array.isArray(userData.inventario)) userData.inventario = ["Seed:2"];
  if (typeof userData.plant_time !== 'string') userData.plant_time = JSON.stringify([]);
  return {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT')) {
        return [[userData]];
      }
      if (sql.includes('UPDATE')) {
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
}

describe('plantSeed branches', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('db not initialized', async () => {
  const pool = makePool();
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletX', 0, 'Seed', '2', 'itemId1', 'comum');
    expect(res.error).toMatch(/Erro interno/);
  });

  test('invalid itemTime', async () => {
  const pool = makePool();
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletX', 0, 'Seed', '-1', 'itemId1', 'comum');
    expect(res.error).toMatch(/Tempo de plantio inválido/);
  });

  test('user not found', async () => {
  const pool = makePool({ userData: null });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletNF', 0, 'Seed', '1', 'itemId1', 'comum');
    expect(res.error).toMatch(/Usuário não encontrado/);
  });

  test('inventory missing item', async () => {
  const pool = makePool({ userData: { inventario: ["Outra:1"], plant_time: JSON.stringify([]) } });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletY', 0, 'Seed', '1', 'itemId1', 'comum');
    expect(res.error).toMatch(/não possui esse item/);
  });

  test('inventory zero quantity', async () => {
  const pool = makePool({ userData: { inventario: ["Seed:0"], plant_time: JSON.stringify([]) } });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletY', 0, 'Seed', '1', 'itemId1', 'comum');
    expect(res.error).toMatch(/quantidade suficiente/);
  });

  test('success new slot', async () => {
  const pool = makePool({ userData: { inventario: ["Seed:2"], plant_time: JSON.stringify([]) } });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletA', 1, 'Seed', '0.5', 'itemId1', 'rara');
    expect(res.slotID).toBe(1);
    expect(removeItemMock).toHaveBeenCalled();
  });

  test('success replace existing slot', async () => {
  const existingPlant = { slotID: 2, itemNome: 'Old', itemTime: 1, plantDate: new Date(), harvestDate: new Date(), itemId: 'old', raridade: 'comum', growthStatus: {} };
  const pool = makePool({ userData: { inventario: ["Seed:3"], plant_time: JSON.stringify([existingPlant]) } });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    jest.unstable_mockModule('../js/back-end/removeItem.js', () => ({ removeItem: removeItemMock }));
    const { plantSeed } = await import('../js/back-end/plantSeed.js');
    const res = await plantSeed('walletB', 2, 'Seed', '1', 'itemNew', 'épica');
    expect(res.itemId).toBe('itemNew');
  });
});
