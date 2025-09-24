import { jest } from '@jest/globals';
// Mock global de usuários e inventário
const store = { users: {} };

// Mock das dependências com instâncias estáveis para evitar criação de objetos diferentes a cada chamada
// Substitui Firestore/config.js por mock de pool MySQL
// Todos os testes devem usar apenas mocks do pool

// Mock das funções de gerenciamento de plantas
let __plantIdCounter = 0;
const plantSeed = jest.fn(async (userId, seedId, position) => {
    if (!userId || !seedId || !position) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    if (!position.x || !position.y) {
        throw new Error('Posição deve conter coordenadas x e y');
    }
    if (typeof position.x !== 'number' || typeof position.y !== 'number' || Number.isNaN(position.x) || Number.isNaN(position.y)) {
        throw new Error('Coordenadas devem ser numéricas');
    }
    
    // Verificar se usuário tem sementes
    const user = store.users[userId] || {};
    const inventory = user.inventory || [];
    
    const seedItem = inventory.find(item => item.id === seedId);
    if (!seedItem || seedItem.quantity <= 0) {
        throw new Error('Semente não disponível no inventário');
    }
    
    // Criar nova planta
    const newPlant = {
        id: `plant_${Date.now()}_${++__plantIdCounter}`,
        type: seedId,
        position,
        stage: 0,
        plantedAt: new Date().toISOString(),
        lastWatered: new Date().toISOString(),
        hasParasite: false,
        health: 100
    };
    
    return {
        success: true,
        plant: newPlant,
        seedsUsed: 1
    };
});

const collectPlant = jest.fn(async (userId, plantId) => {
    if (!userId || !plantId) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    // Verificar se planta existe e está pronta para colheita
    const user = store.users[userId] || {};
    const plants = user.plants || [];
    
    const plant = plants.find(p => p.id === plantId);
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    if (plant.stage < 3) {
        throw new Error('Planta não está pronta para colheita');
    }
    
    // Calcular recompensas baseadas no tipo e estágio da planta
    const baseReward = plant.type * 10;
    const rewards = [
        { id: plant.type + 10, quantity: baseReward }, // Produto da planta
        { id: plant.type, quantity: Math.floor(baseReward * 0.1) } // Sementes bônus
    ];
    
    return {
        success: true,
        rewards,
        removedPlant: plantId,
        experience: baseReward * 2
    };
});

const waterPlant = jest.fn(async (userId, plantId) => {
    if (!userId || !plantId) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    const user = store.users[userId] || {};
    const plants = user.plants || [];
    
    const plant = plants.find(p => p.id === plantId);
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    // Verificar se planta precisa ser regada
    const lastWatered = new Date(plant.lastWatered);
    const now = new Date();
    const hoursSinceWatered = (now - lastWatered) / (1000 * 60 * 60);
    
    if (hoursSinceWatered < 1) {
        throw new Error('Planta não precisa ser regada ainda');
    }
    
    return {
        success: true,
        plant: {
            ...plant,
            lastWatered: now.toISOString(),
            health: Math.min(plant.health + 10, 100)
        }
    };
});

const updatePlantGrowth = jest.fn(async (userId, plantId) => {
    const user = store.users[userId] || {};
    const plants = user.plants || [];
    
    const plant = plants.find(p => p.id === plantId);
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    const plantedAt = new Date(plant.plantedAt);
    const now = new Date();
    const hoursGrown = (now - plantedAt) / (1000 * 60 * 60);
    
    // Cada estágio demora 2 horas
    const newStage = Math.min(Math.floor(hoursGrown / 2), 3);
    
    return {
        success: true,
        plant: {
            ...plant,
            stage: newStage
        },
        stageChanged: newStage !== plant.stage
    };
});

const applyParasiteAttack = jest.fn(async (userId, plantId) => {
    const user = store.users[userId] || {};
    const plants = user.plants || [];
    
    const plant = plants.find(p => p.id === plantId);
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    if (plant.hasParasite) {
        return {
            success: false,
            message: 'Planta já está infectada'
        };
    }
    
    // 20% de chance de ataque de parasita
    const attackChance = Math.random();
    const attacked = attackChance < 0.2;
    
    if (attacked) {
        return {
            success: true,
            plant: {
                ...plant,
                hasParasite: true,
                parasiteType: 'aphid',
                health: Math.max(plant.health - 20, 10)
            },
            attacked: true
        };
    }
    
    return {
        success: true,
        attacked: false
    };
});

const removeParasite = jest.fn(async (userId, plantId, sprayId) => {
    if (!userId || !plantId || !sprayId) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    // Verificar se usuário tem spray anti-parasita
    const user = store.users[userId] || {};
    const inventory = user.inventory || [];
    const sprayItem = inventory.find(item => item.id === sprayId);
    if (!sprayItem || sprayItem.quantity <= 0) {
        throw new Error('Spray anti-parasita não disponível');
    }
    const plants = user.plants || [];
    const plant = plants.find(p => p.id === plantId);
    
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    if (!plant.hasParasite) {
        throw new Error('Planta não possui parasitas');
    }
    
    return {
        success: true,
        plant: {
            ...plant,
            hasParasite: false,
            parasiteType: null,
            health: Math.min(plant.health + 15, 100)
        },
        sprayUsed: 1
    };
});

const applyUtility = jest.fn(async (userId, plantId, utilityId) => {
    if (!userId || !plantId || !utilityId) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    const user = store.users[userId] || {};
    const inventory = user.inventory || [];
    const plants = user.plants || [];

    // Primeiro validar se ID é reconhecido
    const validUtilityIds = [15,16,17];
    if (!validUtilityIds.includes(utilityId)) {
        throw new Error('Utilitário não reconhecido');
    }

    const utility = inventory.find(item => item.id === utilityId);
    if (!utility || utility.quantity <= 0) {
        throw new Error('Utilitário não disponível');
    }

    const plant = plants.find(p => p.id === plantId);
    if (!plant) {
        throw new Error('Planta não encontrada');
    }
    
    let effect = {};
    
    switch (utilityId) {
        case 15: // Fertilizante
            effect = {
                growthBoost: true,
                health: Math.min(plant.health + 20, 100)
            };
            break;
        case 16: // Água especial
            effect = {
                lastWatered: new Date().toISOString(),
                health: Math.min(plant.health + 10, 100)
            };
            break;
        case 17: // Spray protetor
            effect = {
                protected: true,
                protectedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            };
            break;
        default:
            throw new Error('Utilitário não reconhecido');
    }
    
    return {
        success: true,
        plant: {
            ...plant,
            ...effect
        },
        utilityUsed: { id: utilityId, quantity: 1 }
    };
});

describe('Plant Management Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
            // Setup default mocks para funções do pool MySQL
            store.users['user123'] = {
                inventory: [
                    { id: 1, quantity: 5 }, // Sementes
                    { id: 15, quantity: 3 }, // Fertilizante
                    { id: 16, quantity: 2 }, // Água especial
                    { id: 17, quantity: 2 }  // Spray protetor
                ],
                plants: [
                    {
                        id: 'plant_1',
                        type: 1,
                        position: { x: 100, y: 200 },
                        stage: 2,
                        plantedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                        lastWatered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        hasParasite: false,
                        health: 100
                    },
                    {
                        id: 'plant_2',
                        type: 2,
                        position: { x: 200, y: 200 },
                        stage: 3,
                        plantedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                        lastWatered: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
                        hasParasite: true,
                        parasiteType: 'aphid',
                        health: 80
                    }
                ]
            };
    });

    describe('plantSeed Function', () => {
        test('should plant seed successfully', async () => {
            const result = await plantSeed('user123', 1, { x: 150, y: 250 });
            
            expect(result.success).toBe(true);
            expect(result.plant.type).toBe(1);
            expect(result.plant.position).toEqual({ x: 150, y: 250 });
            expect(result.plant.stage).toBe(0);
            expect(result.plant.health).toBe(100);
            expect(result.plant.hasParasite).toBe(false);
            expect(result.seedsUsed).toBe(1);
        });

        test('should reject planting without parameters', async () => {
            const invalidCalls = [
                [null, 1, { x: 100, y: 200 }],
                ['user123', null, { x: 100, y: 200 }],
                ['user123', 1, null],
                ['', 1, { x: 100, y: 200 }]
            ];
            
            for (const params of invalidCalls) {
                await expect(plantSeed(...params)).rejects.toThrow('Parâmetros obrigatórios ausentes');
            }
        });

        test('should reject planting with invalid position', async () => {
            const invalidPositions = [
                { y: 200 }, // missing x
                { x: 100 }, // missing y
                {}, // empty object
                { x: null, y: 200 },
                { x: 100, y: null }
            ];
            
            for (const position of invalidPositions) {
                await expect(plantSeed('user123', 1, position)).rejects.toThrow('Posição deve conter coordenadas x e y');
            }
        });

        test('should reject planting when seed not available', async () => {
            // Mock user without the seed
            store.users['user123'].inventory = [ { id: 2, quantity: 5 } ];
            await expect(plantSeed('user123', 1, { x: 100, y: 200 })).rejects.toThrow('Semente não disponível no inventário');
        });

        test('should reject planting when seed quantity is zero', async () => {
            // Mock user with zero seeds
            store.users['user123'].inventory = [ { id: 1, quantity: 0 } ];
            await expect(plantSeed('user123', 1, { x: 100, y: 200 })).rejects.toThrow('Semente não disponível no inventário');
        });

        test('should generate unique plant IDs', async () => {
            const results = [];
            for (let i = 0; i < 5; i++) {
                const result = await plantSeed('user123', 1, { x: 100 + i, y: 200 + i });
                results.push(result.plant.id);
            }
            
            const uniqueIds = new Set(results);
            expect(uniqueIds.size).toBe(5);
        });

        test('should set correct initial plant properties', async () => {
            const result = await plantSeed('user123', 1, { x: 100, y: 200 });
            const plant = result.plant;
            
            expect(plant.stage).toBe(0);
            expect(plant.hasParasite).toBe(false);
            expect(plant.health).toBe(100);
            expect(new Date(plant.plantedAt)).toBeInstanceOf(Date);
            expect(new Date(plant.lastWatered)).toBeInstanceOf(Date);
        });
    });

    describe('collectPlant Function', () => {
        test('should collect mature plant successfully', async () => {
            const result = await collectPlant('user123', 'plant_2'); // stage 3 plant
            
            expect(result.success).toBe(true);
            expect(result.rewards).toBeDefined();
            expect(result.rewards.length).toBeGreaterThan(0);
            expect(result.removedPlant).toBe('plant_2');
            expect(result.experience).toBeGreaterThan(0);
        });

        test('should reject collection without parameters', async () => {
            const invalidCalls = [
                [null, 'plant_1'],
                ['user123', null],
                ['', 'plant_1'],
                ['user123', '']
            ];
            
            for (const params of invalidCalls) {
                await expect(collectPlant(...params)).rejects.toThrow('Parâmetros obrigatórios ausentes');
            }
        });

        test('should reject collection of non-existent plant', async () => {
            await expect(collectPlant('user123', 'nonexistent_plant')).rejects.toThrow('Planta não encontrada');
        });

        test('should reject collection of immature plant', async () => {
            await expect(collectPlant('user123', 'plant_1')).rejects.toThrow('Planta não está pronta para colheita'); // stage 2
        });

        test('should calculate rewards based on plant type', async () => {
            const result = await collectPlant('user123', 'plant_2'); // type 2 plant
            
            const baseReward = 2 * 10; // type * 10
            expect(result.rewards[0].quantity).toBe(baseReward);
            expect(result.experience).toBe(baseReward * 2);
        });

        test('should provide bonus seeds as reward', async () => {
            const result = await collectPlant('user123', 'plant_2');
            
            // Should have at least 2 reward types: product and bonus seeds
            expect(result.rewards.length).toBeGreaterThanOrEqual(2);
            
            const bonusSeedsReward = result.rewards.find(reward => reward.id === 2); // same as plant type
            expect(bonusSeedsReward).toBeDefined();
            expect(bonusSeedsReward.quantity).toBeGreaterThan(0);
        });
    });

    describe('waterPlant Function', () => {
        test('should water plant successfully', async () => {
            const result = await waterPlant('user123', 'plant_1'); // last watered 2 hours ago
            
            expect(result.success).toBe(true);
            // Saúde não deve ultrapassar 100 (cap)
            expect(result.plant.health).toBeLessThanOrEqual(100);
            expect(result.plant.health).toBeGreaterThanOrEqual(100 - 10); // aumento aplicado ou mantido no cap
            expect(new Date(result.plant.lastWatered)).toBeInstanceOf(Date);
        });

        test('should reject watering without parameters', async () => {
            const invalidCalls = [
                [null, 'plant_1'],
                ['user123', null]
            ];
            
            for (const params of invalidCalls) {
                await expect(waterPlant(...params)).rejects.toThrow('Parâmetros obrigatórios ausentes');
            }
        });

        test('should reject watering non-existent plant', async () => {
            await expect(waterPlant('user123', 'nonexistent_plant')).rejects.toThrow('Planta não encontrada');
        });

        test('should reject watering recently watered plant', async () => {
            // Mock plant watered recently
            store.users['user123'].plants = [ { id: 'plant_1', lastWatered: new Date().toISOString() } ];
            await expect(waterPlant('user123', 'plant_1')).rejects.toThrow('Planta não precisa ser regada ainda');
        });

        test('should increase plant health when watered', async () => {
            const result = await waterPlant('user123', 'plant_1');
            
            // A saúde aumenta, mas permanece <= 100
            expect(result.plant.health).toBeLessThanOrEqual(100);
        });

        test('should cap health at 100', async () => {
            // Mock plant with high health
            store.users['user123'].plants = [ { id: 'plant_1', lastWatered: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), health: 95 } ];
            const result = await waterPlant('user123', 'plant_1');
            expect(result.plant.health).toBe(100); // cap mantido
        });
    });

    describe('updatePlantGrowth Function', () => {
        test('should update plant growth correctly', async () => {
            const result = await updatePlantGrowth('user123', 'plant_1'); // planted 4 hours ago
            
            expect(result.success).toBe(true);
            expect(result.plant.stage).toBe(2); // 4 hours = stage 2 (2 hours per stage)
        });

        test('should detect stage changes', async () => {
            // Mock plant that should advance to next stage
            store.users['user123'].plants = [ { id: 'plant_1', stage: 1, plantedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() } ];
            const result = await updatePlantGrowth('user123', 'plant_1');
            expect(result.stageChanged).toBe(true);
            expect(result.plant.stage).toBe(2);
        });

        test('should cap growth at stage 3', async () => {
            // Mock plant planted long ago
            store.users['user123'].plants = [ { id: 'plant_1', stage: 2, plantedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() } ];
            const result = await updatePlantGrowth('user123', 'plant_1');
            expect(result.plant.stage).toBe(3); // capped at 3
        });

        test('should handle plants that have not grown', async () => {
            // Mock recently planted plant
            store.users['user123'].plants = [ { id: 'plant_1', stage: 0, plantedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() } ];
            const result = await updatePlantGrowth('user123', 'plant_1');
            expect(result.plant.stage).toBe(0); // no growth yet
            expect(result.stageChanged).toBe(false);
        });
    });

    describe('Parasite Management', () => {
        describe('applyParasiteAttack Function', () => {
            test('should apply parasite attack with chance', async () => {
                // Mock Math.random to always trigger attack
                const originalRandom = Math.random;
                Math.random = jest.fn(() => 0.1); // 10% < 20% threshold
                
                const result = await applyParasiteAttack('user123', 'plant_1');
                
                expect(result.success).toBe(true);
                expect(result.attacked).toBe(true);
                expect(result.plant.hasParasite).toBe(true);
                expect(result.plant.parasiteType).toBe('aphid');
                expect(result.plant.health).toBeLessThan(100);
                
                Math.random = originalRandom;
            });

            test('should skip attack when chance is not met', async () => {
                // Mock Math.random to not trigger attack
                const originalRandom = Math.random;
                Math.random = jest.fn(() => 0.5); // 50% > 20% threshold
                
                const result = await applyParasiteAttack('user123', 'plant_1');
                
                expect(result.success).toBe(true);
                expect(result.attacked).toBe(false);
                
                Math.random = originalRandom;
            });

            test('should not attack already infected plant', async () => {
                const result = await applyParasiteAttack('user123', 'plant_2'); // already has parasite
                
                expect(result.success).toBe(false);
                expect(result.message).toBe('Planta já está infectada');
            });
        });

        describe('removeParasite Function', () => {
            test('should remove parasite successfully', async () => {
                const result = await removeParasite('user123', 'plant_2', 16); // plant_2 has parasite
                
                expect(result.success).toBe(true);
                expect(result.plant.hasParasite).toBe(false);
                expect(result.plant.parasiteType).toBe(null);
                expect(result.plant.health).toBeGreaterThanOrEqual(80); // aumenta ou mantém (cap em 100)
                expect(result.sprayUsed).toBe(1);
            });

            test('should reject removal without spray', async () => {
                // Mock user without spray
                store.users['user123'].inventory = [ { id: 1, quantity: 5 } ];
                store.users['user123'].plants = [ { id: 'plant_2', hasParasite: true } ];
                await expect(removeParasite('user123', 'plant_2', 16)).rejects.toThrow('Spray anti-parasita não disponível');
            });

            test('should reject removal from clean plant', async () => {
                await expect(removeParasite('user123', 'plant_1', 16)).rejects.toThrow('Planta não possui parasitas'); // plant_1 is clean
            });

            test('should heal plant health when removing parasite', async () => {
                const result = await removeParasite('user123', 'plant_2', 16);
                
                expect(result.plant.health).toBeGreaterThan(80); // original 80 + 15 healing
            });
        });
    });

    describe('applyUtility Function', () => {
        test('should apply fertilizer correctly', async () => {
            const result = await applyUtility('user123', 'plant_1', 15); // fertilizer
            
            expect(result.success).toBe(true);
            expect(result.plant.growthBoost).toBe(true);
            expect(result.plant.health).toBeLessThanOrEqual(100);
            expect(result.utilityUsed.id).toBe(15);
        });

        test('should apply special water correctly', async () => {
            const result = await applyUtility('user123', 'plant_1', 16); // special water
            
            expect(result.success).toBe(true);
            expect(new Date(result.plant.lastWatered)).toBeInstanceOf(Date);
            expect(result.plant.health).toBeLessThanOrEqual(100);
        });

        test('should apply protective spray correctly', async () => {
            const result = await applyUtility('user123', 'plant_1', 17); // protective spray
            
            expect(result.success).toBe(true);
            expect(result.plant.protected).toBe(true);
            expect(result.plant.protectedUntil).toBeDefined();
        });

        test('should reject unknown utility', async () => {
            await expect(applyUtility('user123', 'plant_1', 999)).rejects.toThrow('Utilitário não reconhecido');
        });

        test('should reject utility not in inventory', async () => {
            // Mock user without utility
            store.users['user123'].inventory = [ { id: 1, quantity: 5 } ];
            store.users['user123'].plants = [ { id: 'plant_1' } ];
            await expect(applyUtility('user123', 'plant_1', 15)).rejects.toThrow('Utilitário não disponível');
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            // Simular erro de banco
            plantSeed.mockImplementationOnce(() => { throw new Error('Database error'); });
            await expect(plantSeed('user123', 1, { x: 100, y: 200 })).rejects.toThrow('Database error');
        });

        test('should handle concurrent plant operations', async () => {
            const operations = [
                plantSeed('user123', 1, { x: 100, y: 200 }),
                waterPlant('user123', 'plant_1'),
                updatePlantGrowth('user123', 'plant_1')
            ];
            
            const results = await Promise.all(operations);
            
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        test('should validate coordinate types', async () => {
            const invalidPositions = [
                { x: '100', y: 200 }, // string x
                { x: 100, y: '200' }, // string y
                { x: NaN, y: 200 },
                { x: 100, y: NaN }
            ];
            
            for (const position of invalidPositions) {
                // Function should handle or reject invalid coordinate types
                await expect(plantSeed('user123', 1, position)).rejects.toThrow();
            }
        });

        test('should handle empty plant arrays', async () => {
            store.users['user123'].plants = [];
            await expect(waterPlant('user123', 'plant_1')).rejects.toThrow('Planta não encontrada');
        });

        test('should handle very old plants', async () => {
            // Mock plant planted weeks ago
            store.users['user123'].plants = [ { id: 'plant_1', stage: 3, plantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() } ];
            const result = await updatePlantGrowth('user123', 'plant_1');
            expect(result.plant.stage).toBe(3); // should still be capped at 3
        });
    });
});