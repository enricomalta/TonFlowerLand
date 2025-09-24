import { jest } from '@jest/globals';

function basePlant(overrides={}){
  return {
    slotID: 1,
    itemNome: 'Seed',
    itemTime: 1, // 1h
    plantDate: { toDate: () => new Date(Date.now() - 30*60*1000) }, // 30 min atrás
    harvestDate: { toDate: () => new Date(Date.now() + 30*60*1000) },
    itemId: 'p1',
    raridade: 'comum',
    growthStatus: { ...overrides.growthStatus },
    ...overrides
  };
}


function makePool(userData) {
  return {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT')) {
        // Simula busca do usuário
        return [[{ id: 1, ...userData }]];
      }
      if (sql.includes('UPDATE')) {
        // Simula update
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

describe('updatePlantStatus & recalculateHarvestDate branches', () => {
  beforeEach(() => jest.resetModules());

  test('error missing item in inventory', async () => {
  const plant = basePlant();
  const pool = makePool({ plant_time: JSON.stringify([plant]), inventario: JSON.stringify(['Agua:0']) });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
  const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
  const res = await updatePlantStatus('w1', 1, 'isWatered', true, 'Regador');
  expect(res.success).toBe(false);
  expect(res.message).toMatch(/Item Regador não encontrado/);
  });

  test('first watering sets dates and harvest recalculated', async () => {
  const plant = basePlant({ growthStatus: {} });
  const pool = makePool({ plant_time: JSON.stringify([plant]), inventario: JSON.stringify(['Regador:2']) });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
  const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
  const res = await updatePlantStatus('w1', 1, 'isWatered', true, 'Regador');
  expect(res.success).toBe(true);
  expect(res.updatedPlant.growthStatus._wasWatered).toBe(true);
  });

  test('anti-parasitas clears pause and sets protected', async () => {
  const plant = basePlant({ growthStatus: { pause: { type: 'parasita', elapsedBeforePause: 1000, totalTime: 3600000 }, isParasita: true } });
  const pool = makePool({ plant_time: JSON.stringify([plant]), inventario: JSON.stringify(['Anti-Parasitas:1']) });
  jest.unstable_mockModule('../js/back-end/mysql.js', () => ({ pool }));
  const { updatePlantStatus } = await import('../js/back-end/updatePlant.js');
  const res = await updatePlantStatus('w1', 1, 'isParasita', false, 'Anti-Parasitas');
  expect(res.success).toBe(true);
  expect(res.updatedPlant.growthStatus.isParasita).toBe(false);
  expect(res.updatedPlant.growthStatus.isProtected).toBe(true);
  });

  test('recalculateHarvestDate watered+fertilized halves remaining', async () => {
    const { recalculateHarvestDate } = await import('../js/back-end/updatePlant.js');
    const plant = basePlant({ growthStatus: { isWatered: true, isFertilized: true } });
    const before = Date.now();
    const newDate = await recalculateHarvestDate(plant);
    const remaining = newDate.getTime() - before;
    // restante deve ser aproximadamente <= 30 min (metade de 1h - 30min já passados -> 30min /2 = 15min)
    expect(remaining).toBeLessThanOrEqual(20*60*1000); // tolerância
  });

  test('recalculateHarvestDate penalty path (not watered)', async () => {
    const { recalculateHarvestDate } = await import('../js/back-end/updatePlant.js');
    const plant = basePlant({ growthStatus: { isWatered: false, isParasita: false } });
    const newDate = await recalculateHarvestDate(plant);
    // penalidade 20 anos ~ > 10 anos em ms
    expect(newDate.getFullYear()).toBeGreaterThan(new Date().getFullYear() + 9);
  });

  test('recalculateHarvestDate penalty path (parasita)', async () => {
    const { recalculateHarvestDate } = await import('../js/back-end/updatePlant.js');
    const plant = basePlant({ growthStatus: { isWatered: true, isParasita: true } });
    const newDate = await recalculateHarvestDate(plant);
    expect(newDate.getFullYear()).toBeGreaterThan(new Date().getFullYear() + 9);
  });
});
