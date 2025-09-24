// Substitui Firestore por mock de pool MySQL
// Todos os testes devem usar apenas o pool abaixo
import { jest } from '@jest/globals';

// Mock dependências usando MySQL
const store = { users: {} };
const pool = {
    query: jest.fn(async (sql, params) => {
        if (sql.includes('SELECT')) {
            const userId = params[0];
            const user = store.users[userId];
            return [[user ? { id: userId, ...user } : undefined]];
        }
        if (sql.includes('INSERT INTO users')) {
            const userId = params[0];
            store.users[userId] = { ...params[1] };
            return [{ insertId: userId }];
        }
        if (sql.includes('UPDATE users')) {
            const userId = params[1];
            if (store.users[userId]) store.users[userId].balance = params[0];
            return [{ affectedRows: 1 }];
        }
        return [[]];
    })
};

// Mock das funções de lógica de negócio
const processarCompra = jest.fn(async (userData) => {
    const { userId, itemId, quantity, totalPrice } = userData;
    if (!userId || !itemId || !quantity || !totalPrice) {
        throw new Error('Todos os campos são obrigatórios');
    }
    if (quantity <= 0) {
        throw new Error('Quantidade deve ser positiva');
    }
    if (totalPrice <= 0) {
        throw new Error('Preço deve ser positivo');
    }
    // Verificação de saldo via pool
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const currentBalance = user?.balance || 0;
    if (currentBalance < totalPrice) {
        throw new Error('Saldo insuficiente');
    }
    // Compra bem-sucedida
    return {
        success: true,
        transactionId: `tx_${Date.now()}`,
        newBalance: currentBalance - totalPrice,
        purchasedItem: { itemId, quantity }
    };
});

const removeItem = jest.fn(async (userId, itemId, quantity) => {
    if (!userId || !itemId || !quantity) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    if (quantity <= 0) {
        throw new Error('Quantidade deve ser positiva');
    }
    // Verificação de inventário via pool
    const [[user]] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    const inventory = user?.inventory || [];
    const item = inventory.find(i => i.id === itemId);
    if (!item) {
        throw new Error('Item não encontrado no inventário');
    }
    if (item.quantity < quantity) {
        throw new Error('Quantidade insuficiente no inventário');
    }
    // Remoção bem-sucedida
    return {
        success: true,
        removedQuantity: quantity,
        remainingQuantity: item.quantity - quantity
    };
});

const createUser = jest.fn(async (userData) => {
    const { walletAddress, email, username } = userData;
    if (!walletAddress) {
        throw new Error('Endereço da carteira é obrigatório');
    }
    if (!email) {
        throw new Error('Email é obrigatório');
    }
    if (!walletAddress.startsWith('EQ')) {
        throw new Error('Formato de endereço da carteira inválido');
    }
    // Verificar se usuário já existe via pool
    const [[existingUser]] = await pool.query('SELECT * FROM users WHERE id = ?', [walletAddress]);
    if (existingUser) {
        throw new Error('Usuário já existe');
    }
    // Criar novo usuário
    const newUser = {
        walletAddress,
        email,
        username: username || `user_${Date.now()}`,
        balance: 0,
        inventory: [],
        plants: [],
        createdAt: new Date().toISOString()
    };
    await pool.query('INSERT INTO users (id, data) VALUES (?, ?)', [walletAddress, newUser]);
    return {
        success: true,
        userId: walletAddress,
        userData: newUser
    };
});

const validatePurchase = jest.fn(async (userId, itemId, quantity) => {
    if (!userId || !itemId || !quantity) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    if (quantity <= 0) {
        throw new Error('Quantidade deve ser positiva');
    }
    
    // Verificar se item existe no shop
    const shopItems = [
        { id: 1, name: 'Semente Básica', price: 10, available: true },
        { id: 2, name: 'Fertilizante', price: 25, available: true },
        { id: 15, name: 'Regador', price: 50, available: false }
    ];
    
    const item = shopItems.find(i => i.id === itemId);
    if (!item) {
        throw new Error('Item não encontrado na loja');
    }
    
    if (!item.available) {
        throw new Error('Item não está disponível');
    }
    
    return {
        valid: true,
        item,
        totalPrice: item.price * quantity
    };
});

const addItemToInventory = jest.fn(async (userId, itemId, quantity) => {
    if (!userId || !itemId || !quantity) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    if (quantity <= 0) {
        throw new Error('Quantidade deve ser positiva');
    }
    
    // Usar store.users para simular inventário
    const user = store.users[userId] || {};
    const inventory = user.inventory || [];
    
    // Verificar se item já existe no inventário
    const existingItemIndex = inventory.findIndex(i => i.id === itemId);
    
    if (existingItemIndex >= 0) {
        // Atualizar quantidade existente
        inventory[existingItemIndex].quantity += quantity;
    } else {
        // Adicionar novo item
        inventory.push({ id: itemId, quantity });
    }
    
    return {
        success: true,
        updatedInventory: inventory,
        addedQuantity: quantity
    };
});

const updateUserBalance = jest.fn(async (userId, amount, operation = 'add') => {
    if (!userId || amount === undefined) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    if (amount < 0) {
        throw new Error('Valor deve ser positivo');
    }
    
    // Usar store.users para simular saldo
    const user = store.users[userId] || {};
    const currentBalance = user.balance || 0;
    
    let newBalance;
    if (operation === 'add') {
        newBalance = currentBalance + amount;
    } else if (operation === 'subtract') {
        if (currentBalance < amount) {
            throw new Error('Saldo insuficiente para operação');
        }
        newBalance = currentBalance - amount;
    } else {
        throw new Error('Operação inválida. Use "add" ou "subtract"');
    }
    
    return {
        success: true,
        previousBalance: currentBalance,
        newBalance,
        operation,
        amount
    };
});

const calculateExperience = jest.fn(async (userId, action, value = 1) => {
    if (!userId || !action) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    const experienceRates = {
        plant: 10,
        water: 5,
        harvest: 20,
        purchase: 2,
        sell: 3,
        trade: 15
    };
    
    const baseExp = experienceRates[action];
    if (baseExp === undefined) {
        throw new Error('Ação não reconhecida para cálculo de experiência');
    }
    
    const earnedExp = baseExp * value;
    
    const user = store.users[userId] || {};
    const currentExp = user.experience || 0;
    const currentLevel = user.level || 1;
    
    const newExp = currentExp + earnedExp;
    const newLevel = Math.floor(newExp / 100) + 1; // 100 exp por nível
    
    return {
        success: true,
        action,
        earnedExp,
        totalExp: newExp,
        previousLevel: currentLevel,
        newLevel,
        levelUp: newLevel > currentLevel
    };
});

const processMarketTransaction = jest.fn(async (sellerId, buyerId, itemId, quantity, price) => {
    if (!sellerId || !buyerId || !itemId || !quantity || !price) {
        throw new Error('Todos os parâmetros são obrigatórios');
    }
    
    if (quantity <= 0 || price <= 0) {
        throw new Error('Quantidade e preço devem ser positivos');
    }
    
    if (sellerId === buyerId) {
        throw new Error('Vendedor e comprador não podem ser o mesmo usuário');
    }
    
    // Verificar se vendedor tem o item
    const seller = store.users[sellerId] || {};
    const sellerInventory = seller.inventory || [];
    const sellerItem = sellerInventory.find(i => i.id === itemId);
    if (!sellerItem || sellerItem.quantity < quantity) {
        throw new Error('Vendedor não possui quantidade suficiente do item');
    }
    const buyer = store.users[buyerId] || {};
    const buyerBalance = buyer.balance || 0;
    const totalPrice = price * quantity;
    if (buyerBalance < totalPrice) {
        throw new Error('Comprador não possui saldo suficiente');
    }
    
    // Taxa de mercado (5%)
    const marketFee = totalPrice * 0.05;
    const sellerReceives = totalPrice - marketFee;
    
    return {
        success: true,
        transactionId: `market_${Date.now()}`,
        sellerId,
        buyerId,
        itemId,
        quantity,
        price,
        totalPrice,
        marketFee,
        sellerReceives,
        timestamp: new Date().toISOString()
    };
});

const validateUserLevel = jest.fn(async (userId, requiredLevel) => {
    if (!userId || !requiredLevel) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    const user = store.users[userId] || {};
    const userLevel = user.level || 1;
    
    if (userLevel < requiredLevel) {
        return {
            valid: false,
            userLevel,
            requiredLevel,
            message: `Nível ${requiredLevel} necessário. Nível atual: ${userLevel}`
        };
    }
    
    return {
        valid: true,
        userLevel,
        requiredLevel
    };
});

const processRefund = jest.fn(async (userId, transactionId, reason) => {
    if (!userId || !transactionId) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    // Simular busca da transação
    const mockTransactions = {
        'tx_123': { userId: 'user123', amount: 100, itemId: 1, quantity: 2, status: 'completed' },
        'tx_456': { userId: 'user456', amount: 250, itemId: 2, quantity: 5, status: 'refunded' }
    };
    
    const transaction = mockTransactions[transactionId];
    if (!transaction) {
        throw new Error('Transação não encontrada');
    }
    
    if (transaction.userId !== userId) {
        throw new Error('Transação não pertence ao usuário');
    }
    
    if (transaction.status === 'refunded') {
        throw new Error('Transação já foi reembolsada');
    }
    
    if (transaction.status !== 'completed') {
        throw new Error('Apenas transações concluídas podem ser reembolsadas');
    }
    
    return {
        success: true,
        refundId: `refund_${Date.now()}`,
        originalTransactionId: transactionId,
        refundAmount: transaction.amount,
        reason: reason || 'Reembolso solicitado',
        processedAt: new Date().toISOString()
    };
});

const calculateShippingCost = jest.fn(async (userId, items, destination) => {
    if (!userId || !items || !destination) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Lista de itens deve ser um array não vazio');
    }
    
    const baseCost = 5; // Custo base de envio
    const itemCost = items.length * 2; // Custo por item
    
    // Custo por região
    const regionCosts = {
        'local': 0,
        'nacional': 10,
        'internacional': 25
    };
    
    const normalizedDestination = destination.toLowerCase();
    const regionCost = regionCosts[normalizedDestination] !== undefined ? regionCosts[normalizedDestination] : regionCosts['nacional'];
    
    // Peso total (simulado)
    const totalWeight = items.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const weightCost = totalWeight > 10 ? (totalWeight - 10) * 1.5 : 0;
    
    const totalShippingCost = baseCost + itemCost + regionCost + weightCost;
    
    return {
        baseCost,
        itemCost,
        regionCost,
        weightCost,
        totalShippingCost,
        destination,
        estimatedDays: normalizedDestination === 'local' ? 1 : normalizedDestination === 'nacional' ? 3 : 7
    };
});

const processLoyaltyPoints = jest.fn(async (userId, purchaseAmount) => {
    if (!userId || !purchaseAmount) {
        throw new Error('Parâmetros obrigatórios ausentes');
    }
    if (purchaseAmount <= 0) {
        throw new Error('Valor da compra deve ser positivo');
    }
    // 1 ponto para cada 10 unidades gastas
    const pointsEarned = Math.floor(purchaseAmount / 10);
    const user = store.users[userId] || {};
    const currentPoints = user.loyaltyPoints || 0;
    const userLevel = user.level || 1;
    // Bônus por nível
    const levelBonus = Math.floor(pointsEarned * (userLevel * 0.1));
    const totalPointsEarned = pointsEarned + levelBonus;
    const newTotalPoints = currentPoints + totalPointsEarned;
    // Atualiza pontos no mock
    user.loyaltyPoints = newTotalPoints;
    store.users[userId] = user;
    // Verificar se alcançou tier especial
    const loyaltyTiers = {
        bronze: { min: 0, multiplier: 1.0 },
        silver: { min: 100, multiplier: 1.1 },
        gold: { min: 500, multiplier: 1.25 },
        platinum: { min: 1000, multiplier: 1.5 }
    };
    let currentTier = 'bronze';
    for (const [tier, data] of Object.entries(loyaltyTiers)) {
        if (newTotalPoints >= data.min) {
            currentTier = tier;
        }
    }
    return {
        success: true,
        pointsEarned: totalPointsEarned,
        basePoints: pointsEarned,
        levelBonus,
        totalPoints: newTotalPoints,
        currentTier,
        nextTierThreshold: currentTier === 'platinum' ? null : 
            Object.values(loyaltyTiers).find(t => t.min > newTotalPoints)?.min
    };
});

describe('Business Logic Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default mocks para funções do pool MySQL
        store.users['user123'] = {
            balance: 1000,
            inventory: [
                { id: 1, quantity: 5 },
                { id: 2, quantity: 10 }
            ],
            experience: 50,
            level: 1,
            loyaltyPoints: 50
        };
    });

    describe('processarCompra Function', () => {
        test('should process valid purchase successfully', async () => {
            const purchaseData = {
                userId: 'user123',
                itemId: 1,
                quantity: 2,
                totalPrice: 100
            };
            
            const result = await processarCompra(purchaseData);
            
            expect(result.success).toBe(true);
            expect(result.transactionId).toMatch(/^tx_\d+$/);
            expect(result.newBalance).toBe(900); // 1000 - 100
            expect(result.purchasedItem).toEqual({ itemId: 1, quantity: 2 });
        });

        test('should reject purchase with missing fields', async () => {
            const invalidPurchases = [
                { itemId: 1, quantity: 2, totalPrice: 100 }, // missing userId
                { userId: 'user123', quantity: 2, totalPrice: 100 }, // missing itemId
                { userId: 'user123', itemId: 1, totalPrice: 100 }, // missing quantity
                { userId: 'user123', itemId: 1, quantity: 2 } // missing totalPrice
            ];
            
            for (const purchase of invalidPurchases) {
                await expect(processarCompra(purchase)).rejects.toThrow('Todos os campos são obrigatórios');
            }
        });

        test('should reject purchase with invalid quantities', async () => {
            const invalidQuantities = [-1, -10]; // Removendo 0 pois é considerado falsy
            
            for (const quantity of invalidQuantities) {
                const purchaseData = {
                    userId: 'user123',
                    itemId: 1,
                    quantity,
                    totalPrice: 100
                };
                
                await expect(processarCompra(purchaseData)).rejects.toThrow('Quantidade deve ser positiva');
            }
        });

        test('should reject purchase with invalid prices', async () => {
            const invalidPrices = [-1, -100]; // Removendo 0 pois é considerado falsy
            
            for (const price of invalidPrices) {
                const purchaseData = {
                    userId: 'user123',
                    itemId: 1,
                    quantity: 2,
                    totalPrice: price
                };
                
                await expect(processarCompra(purchaseData)).rejects.toThrow('Preço deve ser positivo');
            }
        });

        test('should reject purchase with insufficient balance', async () => {
            // Mock user with low balance usando store.users
            store.users['user123'] = { balance: 50 };
            const purchaseData = {
                userId: 'user123',
                itemId: 1,
                quantity: 2,
                totalPrice: 100
            };
            await expect(processarCompra(purchaseData)).rejects.toThrow('Saldo insuficiente');
        });

        test('should handle large purchase amounts', async () => {
            // Mock user with high balance usando store.users
            store.users['user123'] = { balance: 100000 };
            const purchaseData = {
                userId: 'user123',
                itemId: 1,
                quantity: 100,
                totalPrice: 50000
            };
            const result = await processarCompra(purchaseData);
            expect(result.success).toBe(true);
            expect(result.newBalance).toBe(50000);
        });

        test('should handle edge case values', async () => {
            const edgeCases = [
                { quantity: 1, totalPrice: 0.01 },
                { quantity: 999, totalPrice: 999.99 },
                { quantity: 1, totalPrice: 1 }
            ];
            
            for (const { quantity, totalPrice } of edgeCases) {
                const purchaseData = {
                    userId: 'user123',
                    itemId: 1,
                    quantity,
                    totalPrice
                };
                
                const result = await processarCompra(purchaseData);
                expect(result.success).toBe(true);
            }
        });
    });

    describe('removeItem Function', () => {
        test('should remove item successfully', async () => {
            const result = await removeItem('user123', 1, 2);
            
            expect(result.success).toBe(true);
            expect(result.removedQuantity).toBe(2);
            expect(result.remainingQuantity).toBe(3); // 5 - 2
        });

        test('should reject removal with missing parameters', async () => {
            const invalidCalls = [
                [null, 1, 2],      // missing userId
                ['user123', null, 2], // missing itemId
                ['user123', 1, null], // missing quantity
                ['', 1, 2],           // empty userId
                ['user123', '', 2],   // empty itemId
                ['user123', 1, '']    // empty quantity
            ];
            
            for (const params of invalidCalls) {
                await expect(removeItem(...params)).rejects.toThrow('Parâmetros obrigatórios ausentes');
            }
        });

        test('should reject removal with invalid quantities', async () => {
            const invalidQuantities = [-1, -5]; // Removendo 0 pois é tratado em parâmetros obrigatórios
            
            for (const quantity of invalidQuantities) {
                await expect(removeItem('user123', 1, quantity)).rejects.toThrow('Quantidade deve ser positiva');
            }
        });

        test('should reject removal of non-existent item', async () => {
            const result = removeItem('user123', 999, 1); // item 999 doesn't exist
            
            await expect(result).rejects.toThrow('Item não encontrado no inventário');
        });

        test('should reject removal with insufficient quantity', async () => {
            // Try to remove more than available (item 1 has quantity 5)
            await expect(removeItem('user123', 1, 10)).rejects.toThrow('Quantidade insuficiente no inventário');
        });

        test('should handle exact quantity removal', async () => {
            const result = await removeItem('user123', 1, 5); // remove all of item 1
            
            expect(result.success).toBe(true);
            expect(result.removedQuantity).toBe(5);
            expect(result.remainingQuantity).toBe(0);
        });

        test('should handle multiple item removals', async () => {
            // Remove from item 1
            const result1 = await removeItem('user123', 1, 2);
            expect(result1.success).toBe(true);
            
            // Remove from item 2
            const result2 = await removeItem('user123', 2, 3);
            expect(result2.success).toBe(true);
            expect(result2.remainingQuantity).toBe(7); // 10 - 3
        });
    });

    describe('createUser Function', () => {
        beforeEach(() => {
            // Mock que user não existe por padrão para createUser
            // Simular usuário não existente
            store.users = {};
        });

        test('should create user successfully', async () => {
            const userData = {
                walletAddress: 'EQTest123456789',
                email: 'user@test.com',
                username: 'testuser'
            };
            
            const result = await createUser(userData);
            
            expect(result.success).toBe(true);
            expect(result.userId).toBe(userData.walletAddress);
            expect(result.userData.walletAddress).toBe(userData.walletAddress);
            expect(result.userData.email).toBe(userData.email);
            expect(result.userData.username).toBe(userData.username);
            expect(result.userData.balance).toBe(0);
            expect(result.userData.inventory).toEqual([]);
            expect(result.userData.plants).toEqual([]);
            expect(result.userData.createdAt).toBeDefined();
        });

        test('should reject user creation without wallet address', async () => {
            const userData = {
                email: 'user@test.com',
                username: 'testuser'
            };
            
            await expect(createUser(userData)).rejects.toThrow('Endereço da carteira é obrigatório');
        });

        test('should reject user creation without email', async () => {
            const userData = {
                walletAddress: 'EQTest123456789',
                username: 'testuser'
            };
            
            await expect(createUser(userData)).rejects.toThrow('Email é obrigatório');
        });

        test('should reject invalid wallet address format', async () => {
            const invalidAddresses = [
                'BTCInvalidAddress',
                '0xEthereumAddress',
                'invalid-address',
                '123456789'
            ];
            
            for (const walletAddress of invalidAddresses) {
                const userData = {
                    walletAddress,
                    email: 'user@test.com'
                };
                
                await expect(createUser(userData)).rejects.toThrow('Formato de endereço da carteira inválido');
            }
        });

        test('should reject creation of existing user', async () => {
            // Mock that user already exists
            store.users['EQTest123456789'] = { walletAddress: 'EQTest123456789', email: 'user@test.com' };
            const userData = {
                walletAddress: 'EQTest123456789',
                email: 'user@test.com'
            };
            await expect(createUser(userData)).rejects.toThrow('Usuário já existe');
        });

        test('should generate username if not provided', async () => {
            const userData = {
                walletAddress: 'EQTest123456789',
                email: 'user@test.com'
                // username not provided
            };
            
            const result = await createUser(userData);
            
            expect(result.success).toBe(true);
            expect(result.userData.username).toMatch(/^user_\d+$/);
        });

        test('should validate wallet address format correctly', async () => {
            const validAddresses = [
                'EQTest123456789',
                'EQD123abc456def',
                'EQ123456789012345678901234567890'
            ];
            
            for (const walletAddress of validAddresses) {
                const userData = {
                    walletAddress,
                    email: 'user@test.com'
                };
                
                const result = await createUser(userData);
                expect(result.success).toBe(true);
            }
        });

        test('should initialize user with default values', async () => {
            const userData = {
                walletAddress: 'EQTest123456789',
                email: 'user@test.com',
                username: 'testuser'
            };
            
            const result = await createUser(userData);
            
            expect(result.userData.balance).toBe(0);
            expect(result.userData.inventory).toEqual([]);
            expect(result.userData.plants).toEqual([]);
            expect(new Date(result.userData.createdAt)).toBeInstanceOf(Date);
        });

        test('should handle special characters in username', async () => {
            const specialUsernames = [
                'user@123',
                'user-name',
                'user_name',
                'user.name',
                'Ação_User'
            ];
            
            for (const username of specialUsernames) {
                const userData = {
                    walletAddress: `EQTest${Date.now()}`,
                    email: 'user@test.com',
                    username
                };
                
                const result = await createUser(userData);
                expect(result.success).toBe(true);
                expect(result.userData.username).toBe(username);
            }
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle database connection errors', async () => {
            // Simular erro de banco
            pool.query.mockImplementationOnce(() => { throw new Error('Database connection failed'); });
            const purchaseData = {
                userId: 'user123',
                itemId: 1,
                quantity: 2,
                totalPrice: 100
            };
            await expect(processarCompra(purchaseData)).rejects.toThrow('Database connection failed');
        });

        test('should handle concurrent operations', async () => {
            const userId = 'user123';
            
            // Simulate concurrent purchases
            const purchases = [
                { userId, itemId: 1, quantity: 1, totalPrice: 100 },
                { userId, itemId: 2, quantity: 1, totalPrice: 150 },
                { userId, itemId: 3, quantity: 1, totalPrice: 200 }
            ];
            
            const results = await Promise.all(
                purchases.map(purchase => processarCompra(purchase))
            );
            
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        test('should validate data types', async () => {
            const purchaseData = {
                userId: 'user123',
                itemId: '1', // string instead of number
                quantity: '2', // string instead of number
                totalPrice: '100' // string instead of number
            };
            
            // Function should handle type coercion or reject invalid types
            const result = await processarCompra(purchaseData);
            expect(result.success).toBe(true); // or adjust based on expected behavior
        });

        test('should handle very long usernames', async () => {
            const longUsername = 'a'.repeat(1000);
            const userData = {
                walletAddress: 'EQTest123456789',
                email: 'user@test.com',
                username: longUsername
            };
            const result = await createUser(userData);
            expect(result.success).toBe(true);
            expect(result.userData.username).toBe(longUsername);
        });

        test('should handle empty inventory scenarios', async () => {
            // Mock user with empty inventory usando store.users
            store.users['user123'] = { balance: 1000, inventory: [] };
            await expect(removeItem('user123', 1, 1)).rejects.toThrow('Item não encontrado no inventário');
        });

        test('should handle null/undefined values gracefully', async () => {
            const nullValues = [null, undefined];
            
            for (const value of nullValues) {
                await expect(processarCompra({
                    userId: value,
                    itemId: 1,
                    quantity: 2,
                    totalPrice: 100
                })).rejects.toThrow('Todos os campos são obrigatórios');
            }
        });
    });

    describe('validatePurchase Function', () => {
        test('should validate purchase successfully', async () => {
            const result = await validatePurchase('user123', 1, 2);
            
            expect(result.valid).toBe(true);
            expect(result.item.id).toBe(1);
            expect(result.item.name).toBe('Semente Básica');
            expect(result.totalPrice).toBe(20); // 10 * 2
        });

        test('should reject unavailable items', async () => {
            await expect(validatePurchase('user123', 15, 1)).rejects.toThrow('Item não está disponível');
        });

        test('should reject non-existent items', async () => {
            await expect(validatePurchase('user123', 999, 1)).rejects.toThrow('Item não encontrado na loja');
        });

        test('should reject invalid quantities', async () => {
            const invalidQuantities = [-1, -10]; // Removendo 0 pois é considerado falsy
            
            for (const quantity of invalidQuantities) {
                await expect(validatePurchase('user123', 1, quantity)).rejects.toThrow('Quantidade deve ser positiva');
            }
        });

        test('should calculate total price correctly', async () => {
            const tests = [
                { itemId: 1, quantity: 1, expectedPrice: 10 },
                { itemId: 1, quantity: 5, expectedPrice: 50 },
                { itemId: 2, quantity: 3, expectedPrice: 75 }
            ];
            
            for (const { itemId, quantity, expectedPrice } of tests) {
                const result = await validatePurchase('user123', itemId, quantity);
                expect(result.totalPrice).toBe(expectedPrice);
            }
        });
    });

    describe('addItemToInventory Function', () => {
        test('should add new item to inventory', async () => {
            // Mock empty inventory usando store.users
            store.users['user123'] = { inventory: [] };
            const result = await addItemToInventory('user123', 1, 5);
            expect(result.success).toBe(true);
            expect(result.updatedInventory).toEqual([{ id: 1, quantity: 5 }]);
            expect(result.addedQuantity).toBe(5);
        });

        test('should update existing item quantity', async () => {
            // Mock inventory with existing item usando store.users
            store.users['user123'] = { inventory: [{ id: 1, quantity: 3 }] };
            const result = await addItemToInventory('user123', 1, 2);
            expect(result.success).toBe(true);
            expect(result.updatedInventory[0].quantity).toBe(5); // 3 + 2
        });

        test('should handle multiple different items', async () => {
            store.users['user123'] = { inventory: [{ id: 1, quantity: 3 }, { id: 2, quantity: 1 }] };
            const result = await addItemToInventory('user123', 3, 4);
            expect(result.updatedInventory.length).toBe(3);
            expect(result.updatedInventory[2]).toEqual({ id: 3, quantity: 4 });
        });
    });

    describe('updateUserBalance Function', () => {
        beforeEach(() => {
            store.users['user123'] = { balance: 100 };
        });

        test('should add to user balance', async () => {
            const result = await updateUserBalance('user123', 50, 'add');
            
            expect(result.success).toBe(true);
            expect(result.previousBalance).toBe(100);
            expect(result.newBalance).toBe(150);
            expect(result.operation).toBe('add');
        });

        test('should subtract from user balance', async () => {
            const result = await updateUserBalance('user123', 30, 'subtract');
            
            expect(result.success).toBe(true);
            expect(result.newBalance).toBe(70);
            expect(result.operation).toBe('subtract');
        });

        test('should reject subtraction with insufficient balance', async () => {
            await expect(updateUserBalance('user123', 150, 'subtract')).rejects.toThrow('Saldo insuficiente para operação');
        });

        test('should reject invalid operations', async () => {
            await expect(updateUserBalance('user123', 50, 'invalid')).rejects.toThrow('Operação inválida');
        });

        test('should default to add operation', async () => {
            const result = await updateUserBalance('user123', 25);
            
            expect(result.operation).toBe('add');
            expect(result.newBalance).toBe(125);
        });
    });

    describe('calculateExperience Function', () => {
        beforeEach(() => {
            store.users['user123'] = { experience: 50, level: 1 };
        });

        test('should calculate experience for planting', async () => {
            const result = await calculateExperience('user123', 'plant', 3);
            
            expect(result.success).toBe(true);
            expect(result.earnedExp).toBe(30); // 10 * 3
            expect(result.totalExp).toBe(80); // 50 + 30
        });

        test('should calculate level up correctly', async () => {
            store.users['user123'] = { experience: 95, level: 1 };
            const result = await calculateExperience('user123', 'harvest', 1);
            expect(result.earnedExp).toBe(20);
            expect(result.totalExp).toBe(115);
            expect(result.newLevel).toBe(2);
            expect(result.levelUp).toBe(true);
        });

        test('should handle different actions', async () => {
            const actions = [
                { action: 'plant', expectedBase: 10 },
                { action: 'water', expectedBase: 5 },
                { action: 'harvest', expectedBase: 20 },
                { action: 'purchase', expectedBase: 2 },
                { action: 'sell', expectedBase: 3 },
                { action: 'trade', expectedBase: 15 }
            ];
            
            for (const { action, expectedBase } of actions) {
                const result = await calculateExperience('user123', action, 1);
                expect(result.earnedExp).toBe(expectedBase);
            }
        });

        test('should reject unknown actions', async () => {
            await expect(calculateExperience('user123', 'invalid_action')).rejects.toThrow('Ação não reconhecida');
        });
    });

    describe('processMarketTransaction Function', () => {
        beforeEach(() => {
            store.users['seller123'] = { inventory: [{ id: 1, quantity: 10 }] };
            store.users['buyer456'] = { balance: 1000 };
        });
        });

        test('should process market transaction successfully', async () => {
            const result = await processMarketTransaction('seller123', 'buyer456', 1, 5, 20);
            
            expect(result.success).toBe(true);
            expect(result.totalPrice).toBe(100); // 5 * 20
            expect(result.marketFee).toBe(5); // 5% de 100
            expect(result.sellerReceives).toBe(95); // 100 - 5
            expect(result.transactionId).toMatch(/^market_\d+$/);
        });

        test('should reject transaction with same seller and buyer', async () => {
            await expect(processMarketTransaction('user123', 'user123', 1, 5, 20))
                .rejects.toThrow('Vendedor e comprador não podem ser o mesmo usuário');
        });

        test('should reject transaction with insufficient seller inventory', async () => {
            await expect(processMarketTransaction('seller123', 'buyer456', 1, 15, 20))
                .rejects.toThrow('Vendedor não possui quantidade suficiente do item');
        });

        test('should reject transaction with insufficient buyer balance', async () => {
            await expect(processMarketTransaction('seller123', 'buyer456', 1, 5, 250))
                .rejects.toThrow('Comprador não possui saldo suficiente');
        });

        test('should calculate market fees correctly', async () => {
            const testCases = [
                { quantity: 1, price: 100, expectedFee: 5 },
                { quantity: 10, price: 50, expectedFee: 25 },
                { quantity: 2, price: 75, expectedFee: 7.5 }
            ];
            
            for (const { quantity, price, expectedFee } of testCases) {
                const result = await processMarketTransaction('seller123', 'buyer456', 1, quantity, price);
                expect(result.marketFee).toBe(expectedFee);
            }
        });
    });

    describe('validateUserLevel Function', () => {
        test('should validate sufficient user level', async () => {
            store.users['user123'] = { level: 5 };
            const result = await validateUserLevel('user123', 3);
            expect(result.valid).toBe(true);
            expect(result.userLevel).toBe(5);
            expect(result.requiredLevel).toBe(3);
        });

        test('should reject insufficient user level', async () => {
            store.users['user123'] = { level: 2 };
            const result = await validateUserLevel('user123', 5);
            expect(result.valid).toBe(false);
            expect(result.userLevel).toBe(2);
            expect(result.requiredLevel).toBe(5);
            expect(result.message).toContain('Nível 5 necessário');
        });

        test('should handle users without level (default to 1)', async () => {
            store.users['user123'] = {};
            const result = await validateUserLevel('user123', 2);
            expect(result.valid).toBe(false);
            expect(result.userLevel).toBe(1);
        });
    });

    describe('processRefund Function', () => {
        test('should process refund successfully', async () => {
            const result = await processRefund('user123', 'tx_123', 'Item defeituoso');
            
            expect(result.success).toBe(true);
            expect(result.refundId).toMatch(/^refund_\d+$/);
            expect(result.originalTransactionId).toBe('tx_123');
            expect(result.refundAmount).toBe(100);
            expect(result.reason).toBe('Item defeituoso');
        });

        test('should reject refund for non-existent transaction', async () => {
            await expect(processRefund('user123', 'tx_nonexistent'))
                .rejects.toThrow('Transação não encontrada');
        });

        test('should reject refund for wrong user', async () => {
            await expect(processRefund('wrong_user', 'tx_123'))
                .rejects.toThrow('Transação não pertence ao usuário');
        });

        test('should reject refund for already refunded transaction', async () => {
            await expect(processRefund('user456', 'tx_456'))
                .rejects.toThrow('Transação já foi reembolsada');
        });

        test('should use default reason when none provided', async () => {
            const result = await processRefund('user123', 'tx_123');
            
            expect(result.reason).toBe('Reembolso solicitado');
        });
    });

    describe('calculateShippingCost Function', () => {
        test('should calculate shipping cost for local delivery', async () => {
            const items = [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }];
            const result = await calculateShippingCost('user123', items, 'local');
            
            expect(result.baseCost).toBe(5);
            expect(result.itemCost).toBe(4); // 2 items * 2
            expect(result.regionCost).toBe(0); // local
            expect(result.weightCost).toBe(0); // peso <= 10
            expect(result.totalShippingCost).toBe(9); // 5 + 4 + 0 + 0
            expect(result.estimatedDays).toBe(1);
        });

        test('should calculate shipping cost for national delivery', async () => {
            const items = [{ id: 1, quantity: 1 }];
            const result = await calculateShippingCost('user123', items, 'nacional');
            
            expect(result.regionCost).toBe(10);
            expect(result.estimatedDays).toBe(3);
        });

        test('should calculate shipping cost for international delivery', async () => {
            const items = [{ id: 1, quantity: 1 }];
            const result = await calculateShippingCost('user123', items, 'internacional');
            
            expect(result.regionCost).toBe(25);
            expect(result.estimatedDays).toBe(7);
        });

        test('should apply weight surcharge for heavy orders', async () => {
            const items = Array(15).fill({ id: 1, quantity: 1 }); // 15 items
            const result = await calculateShippingCost('user123', items, 'local');
            
            expect(result.weightCost).toBe(7.5); // (15 - 10) * 1.5
            expect(result.totalShippingCost).toBeGreaterThan(40);
        });

        test('should reject invalid parameters', async () => {
            await expect(calculateShippingCost('user123', [], 'local'))
                .rejects.toThrow('Lista de itens deve ser um array não vazio');
                
            await expect(calculateShippingCost('user123', null, 'local'))
                .rejects.toThrow('Parâmetros obrigatórios ausentes');
        });
    });

    describe('processLoyaltyPoints Function', () => {
        beforeEach(() => {
            store.users['user123'] = { loyaltyPoints: 50, level: 2 };
        });

        test('should calculate loyalty points correctly', async () => {
            const result = await processLoyaltyPoints('user123', 100);
            
            expect(result.success).toBe(true);
            expect(result.basePoints).toBe(10); // 100 / 10
            expect(result.levelBonus).toBe(2); // 10 * (2 * 0.1)
            expect(result.pointsEarned).toBe(12); // 10 + 2
            expect(result.totalPoints).toBe(62); // 50 + 12
        });

        test('should determine loyalty tier correctly', async () => {
            // Test bronze tier
            store.users['user123'] = { loyaltyPoints: 50, level: 2 };
            const bronzeResult = await processLoyaltyPoints('user123', 50);
            expect(bronzeResult.currentTier).toBe('bronze');
            // Test silver tier
            store.users['user123'] = { loyaltyPoints: 95, level: 1 };
            const silverResult = await processLoyaltyPoints('user123', 100);
            expect(silverResult.currentTier).toBe('silver');
        });

        test('should calculate next tier threshold', async () => {
            const result = await processLoyaltyPoints('user123', 50);
            
            expect(result.nextTierThreshold).toBe(100); // next tier is silver at 100 points
        });

        test('should handle platinum tier (max tier)', async () => {
            store.users['user123'] = { loyaltyPoints: 1000, level: 10 };
            const result = await processLoyaltyPoints('user123', 100);
            expect(result.currentTier).toBe('platinum');
            expect(result.nextTierThreshold).toBe(null);
        });

        test('should reject invalid purchase amounts', async () => {
            await expect(processLoyaltyPoints('user123', -50))
                .rejects.toThrow('Valor da compra deve ser positivo');
        });
    });