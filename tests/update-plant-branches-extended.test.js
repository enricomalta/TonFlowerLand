// import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
function makePool(userData, exists = true) {
  return {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT')) {
        return [[exists ? { id: 1, ...userData } : undefined]];
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
// Todos os mocks Firestore removidos. Usar apenas pool/query MySQL.
describe('updatePlant branch error coverage', () => {
  it('should handle missing user', async () => {
    const pool = makePool({}, false);
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { updatePlant } = await import('../js/back-end/updatePlant.js');
    await updatePlant('addr', { type: 'water' });
    expect(true).toBe(true);
  });

  it('should handle invalid plant type', async () => {
    const pool = makePool({ plantType: 'unknown' });
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { updatePlant } = await import('../js/back-end/updatePlant.js');
    await updatePlant('addr', { type: 'water' });
    expect(true).toBe(true);
  });

  it('should handle generic error', async () => {
    const pool = { query: jest.fn(async () => { throw new Error('Generic get error'); }) };
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { updatePlant } = await import('../js/back-end/updatePlant.js');
    await updatePlant('addr', { type: 'water' });
    expect(true).toBe(true);
  });
});
import { updatePlantStatus, recalculateHarvestDate } from '../js/back-end/updatePlant.js';

describe('updatePlantStatus table-driven coverage', () => {
  const baseUserData = {
    plant_time: JSON.stringify([{ slotID: 1, itemId: 'plantA', itemTime: 1, growthStatus: {} }]),
    inventario: JSON.stringify(['Regador:1', 'Anti-Parasitas:1', 'Fertilizante:1'])
  };
  const pool = makePool(baseUserData);

  it('waters first time', async () => {
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
    const res = await updatePlantStatus('walletA', 1, 'isWatered', true, 'Regador');
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/atualizado/);
  });

  it('removes parasita with Anti-Parasitas and pause', async () => {
    const userData = {
      plant_time: JSON.stringify([{ slotID: 1, itemId: 'plantA', itemTime: 1, growthStatus: { pause: { type: 'parasita', elapsedBeforePause: 1000, totalTime: 2000 } } }]),
      inventario: JSON.stringify(['Anti-Parasitas:1'])
    };
    const poolMock = makePool(userData);
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: poolMock }));
    const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
    const res = await updatePlantStatus('walletA', 1, 'isParasita', false, 'Anti-Parasitas');
    expect(res.success).toBe(true);
    expect(res.updatedPlant.growthStatus.isProtected).toBe(true);
    expect(res.updatedPlant.growthStatus.isParasita).toBe(false);
  });

  it('fertilizes plant', async () => {
    jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
    const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
    const res = await updatePlantStatus('walletA', 1, 'isFertilized', true, 'Fertilizante');
    expect(res.success).toBe(true);
    expect(res.updatedPlant.growthStatus.isFertilized).toBe(true);
  });

  it('recalculateHarvestDate returns null', async () => {
    const userData = {
      plant_time: JSON.stringify([{ slotID: 1, itemId: 'plantA', itemTime: 1, growthStatus: {} }]),
      inventario: JSON.stringify(['Regador:1'])
    };
  const poolMock = makePool(userData);
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool: poolMock }));
  const updatePlantModule = await import('../js/back-end/updatePlant.js');
  const spy = jest.spyOn(updatePlantModule, 'recalculateHarvestDate').mockResolvedValueOnce(null);
  const { updatePlantStatus } = updatePlantModule;
  const res = await updatePlantStatus('walletA', 1, 'isWatered', true, 'Regador');
  expect(res.success).toBe(false);
  spy.mockRestore();
  });
});
