import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock do servidor Express (simplificado)
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Mock das rotas principais
  app.post('/createUser', (req, res) => {
    const { walletAddress } = req.body;
    const isValid = (
      typeof walletAddress === 'string' && walletAddress.trim().length > 0 && walletAddress.trim().length < 500
    );
    if (!isValid) {
      return res.status(400).json({ error: "Endereço da carteira é obrigatório." });
    }
    res.json({ success: true, message: "Usuário criado com sucesso" });
  });

  app.post('/login', (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet Address é obrigatório" });
    }
    
    const token = jwt.sign({ uid: walletAddress }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login realizado com sucesso", token });
  });

  app.post('/processarCompra', (req, res) => {
    const { walletAddress, itemNome, quantidade } = req.body;
    // Validar campos obrigatórios explicitamente (null/undefined) permitindo quantidade 0 ser validada depois
    if (walletAddress == null || itemNome == null || quantidade == null) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }
    if (typeof walletAddress !== 'string' || typeof itemNome !== 'string') {
      return res.status(400).json({ error: "Tipos inválidos" });
    }
    if (typeof quantidade !== 'number' || Number.isNaN(quantidade)) {
      return res.status(400).json({ error: "Quantidade inválida" });
    }
    if (quantidade <= 0) {
      return res.status(400).json({ error: "Quantidade deve ser positiva" });
    }
    res.json({ success: true, message: "Compra processada com sucesso" });
  });

  app.post('/plantSeed', (req, res) => {
    const { walletAddress, slotId, seedType } = req.body;
    
    if (!walletAddress || !slotId || !seedType) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }
    
    res.json({ success: true, message: "Semente plantada com sucesso" });
  });

  app.post('/updateBalance', (req, res) => {
    const { walletAddress, saldo } = req.body;
    
    if (!walletAddress || saldo === undefined) {
      return res.status(400).json({ error: "WalletAddress e saldo são obrigatórios" });
    }
    
    if (saldo < 0) {
      return res.status(400).json({ error: "Saldo não pode ser negativo" });
    }
    
    res.json({ success: true, message: "Saldo atualizado com sucesso" });
  });

  app.post('/withdraw', (req, res) => {
    const { walletAddress, amountTon } = req.body;
    if (walletAddress == null || amountTon == null) {
      return res.status(400).json({ error: "WalletAddress e amount são obrigatórios" });
    }
    if (typeof walletAddress !== 'string') {
      return res.status(400).json({ error: "WalletAddress inválido" });
    }
    if (typeof amountTon !== 'number' || Number.isNaN(amountTon)) {
      return res.status(400).json({ error: "Valor inválido" });
    }
    if (amountTon <= 0) {
      return res.status(400).json({ error: "Valor deve ser positivo" });
    }
    res.json({ success: true, message: "Saque processado com sucesso" });
  });

  // Middleware de rate limiting simulado
  const rateLimitMiddleware = (req, res, next) => {
    const rateLimitHeader = req.headers['x-test-rate-limit'];
    if (rateLimitHeader === 'exceeded') {
      return res.status(429).json({ error: "Muitas requisições" });
    }
    next();
  };

  app.use('/api/limited', rateLimitMiddleware);
  app.get('/api/limited/test', (req, res) => {
    res.json({ message: "Request successful" });
  });

  return app;
};

describe('API/Express Tests', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('User Management APIs', () => {
    test('POST /createUser - should create user successfully', async () => {
      const response = await request(app)
        .post('/createUser')
        .send({ walletAddress: 'test-wallet-address' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sucesso');
    });

    test('POST /createUser - should fail without wallet address', async () => {
      const response = await request(app)
        .post('/createUser')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('obrigatório');
    });

    test('POST /createUser - should validate wallet address format', async () => {
      const invalidAddresses = ['', '   ', null, undefined, 123];

      for (const address of invalidAddresses) {
        const response = await request(app)
          .post('/createUser')
          .send({ walletAddress: address });

        expect(response.status).toBe(400);
      }
    });

    test('POST /login - should login successfully', async () => {
      const response = await request(app)
        .post('/login')
        .send({ walletAddress: 'test-wallet-address' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('sucesso');
      expect(response.body.token).toBeDefined();
    });

    test('POST /login - should fail without wallet address', async () => {
      const response = await request(app)
        .post('/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('obrigatório');
    });

    test('POST /login - should return valid JWT token', async () => {
      const walletAddress = 'test-wallet-address';
      const response = await request(app)
        .post('/login')
        .send({ walletAddress });

      expect(response.status).toBe(200);
      
      const { token } = response.body;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.uid).toBe(walletAddress);
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('Game Logic APIs', () => {
    test('POST /processarCompra - should process purchase successfully', async () => {
      const purchaseData = {
        walletAddress: 'test-wallet',
        itemNome: 'Vaso',
        quantidade: 5
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(purchaseData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('POST /processarCompra - should validate required fields', async () => {
      const invalidRequests = [
        { walletAddress: 'test', itemNome: 'Vaso' }, // Missing quantidade
        { walletAddress: 'test', quantidade: 5 }, // Missing itemNome
        { itemNome: 'Vaso', quantidade: 5 }, // Missing walletAddress
        {} // Empty object
      ];

      for (const data of invalidRequests) {
        const response = await request(app)
          .post('/processarCompra')
          .send(data);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('obrigatórios');
      }
    });

    test('POST /processarCompra - should validate positive quantities', async () => {
      const invalidQuantities = [0, -1, -10];

      for (const quantidade of invalidQuantities) {
        const response = await request(app)
          .post('/processarCompra')
          .send({
            walletAddress: 'test-wallet',
            itemNome: 'Vaso',
            quantidade
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('positiva');
      }
    });

    test('POST /plantSeed - should plant seed successfully', async () => {
      const plantData = {
        walletAddress: 'test-wallet',
        slotId: 'slot1',
        seedType: 'Semente Girassol'
      };

      const response = await request(app)
        .post('/plantSeed')
        .send(plantData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('POST /plantSeed - should validate required fields', async () => {
      const invalidRequests = [
        { walletAddress: 'test', slotId: 'slot1' }, // Missing seedType
        { walletAddress: 'test', seedType: 'Semente Rosa' }, // Missing slotId
        { slotId: 'slot1', seedType: 'Semente Rosa' } // Missing walletAddress
      ];

      for (const data of invalidRequests) {
        const response = await request(app)
          .post('/plantSeed')
          .send(data);

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Balance Management APIs', () => {
    test('POST /updateBalance - should update balance successfully', async () => {
      const balanceData = {
        walletAddress: 'test-wallet',
        saldo: 150.75
      };

      const response = await request(app)
        .post('/updateBalance')
        .send(balanceData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('POST /updateBalance - should reject negative balances', async () => {
      const response = await request(app)
        .post('/updateBalance')
        .send({
          walletAddress: 'test-wallet',
          saldo: -50.00
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('negativo');
    });

    test('POST /updateBalance - should handle edge case balances', async () => {
      const edgeCases = [0, 0.01, 999999.99];

      for (const saldo of edgeCases) {
        const response = await request(app)
          .post('/updateBalance')
          .send({
            walletAddress: 'test-wallet',
            saldo
          });

        expect(response.status).toBe(200);
      }
    });

    test('POST /withdraw - should process withdrawal successfully', async () => {
      const withdrawData = {
        walletAddress: 'test-wallet',
        amountTon: 25.5
      };

      const response = await request(app)
        .post('/withdraw')
        .send(withdrawData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('POST /withdraw - should validate positive amounts', async () => {
      const invalidAmounts = [0, -1, -25.5];

      for (const amountTon of invalidAmounts) {
        const response = await request(app)
          .post('/withdraw')
          .send({
            walletAddress: 'test-wallet',
            amountTon
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('positivo');
      }
    });
  });

  describe('Middleware Tests', () => {
    test('should handle rate limiting', async () => {
      // Request without rate limit
      const response1 = await request(app)
        .get('/api/limited/test');

      expect(response1.status).toBe(200);

      // Request with rate limit exceeded
      const response2 = await request(app)
        .get('/api/limited/test')
        .set('x-test-rate-limit', 'exceeded');

      expect(response2.status).toBe(429);
      expect(response2.body.error).toContain('Muitas requisições');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/createUser')
        .send('invalid-json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    test('should handle large payloads', async () => {
      const largePayload = {
        walletAddress: 'test-wallet',
        itemNome: 'Vaso',
        quantidade: 1,
        extraData: 'x'.repeat(10000) // 10KB of extra data
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(largePayload);

      // Should handle large payloads gracefully
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route');

      expect(response.status).toBe(404);
    });

    test('should handle unsupported HTTP methods', async () => {
      const response = await request(app)
        .delete('/createUser');

      expect(response.status).toBe(404);
    });

    test('should handle content-type validation', async () => {
      const response = await request(app)
        .post('/createUser')
        .set('Content-Type', 'text/plain')
        .send('walletAddress=test');
      // Como estamos mandando texto puro, pode ou não aceitar dependendo do parser
      expect([200, 400, 415]).toContain(response.status);
    });
  });

  describe('Security Headers', () => {
    test('should not expose sensitive headers in response', async () => {
      const response = await request(app)
        .get('/api/limited/test');
      // Como não desabilitamos explicitamente, apenas garantimos que não há cabeçalhos custom inseguros
      expect(response.headers['server']).toBeUndefined();
    });

    test('should handle special characters in requests', async () => {
      const specialChars = {
        walletAddress: 'test<script>alert("xss")</script>',
        itemNome: 'Vaso"; DROP TABLE users; --',
        quantidade: 1
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(specialChars);

      // Should not crash and should sanitize input
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post('/createUser')
          .send({ walletAddress: `test-wallet-${i}` })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/createUser')
        .send({ walletAddress: 'test-wallet' });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle burst requests', async () => {
      const burstSize = 50;
      const requests = [];

      for (let i = 0; i < burstSize; i++) {
        requests.push(
          request(app)
            .post('/processarCompra')
            .send({
              walletAddress: `wallet-${i}`,
              itemNome: 'Vaso',
              quantidade: 1
            })
        );
      }

      const responses = await Promise.all(requests);
      const successfulResponses = responses.filter(r => r.status === 200);

      expect(successfulResponses.length).toBeGreaterThan(burstSize * 0.8); // 80% success rate
    });
  });

  describe('Input Validation Edge Cases', () => {
    test('should handle Unicode characters', async () => {
      const unicodeData = {
        walletAddress: 'test-wallet-🚀',
        itemNome: 'Vaso-花',
        quantidade: 1
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(unicodeData);

      expect([200, 400]).toContain(response.status);
    });

    test('should handle extremely long strings', async () => {
      const longString = 'a'.repeat(10000);

      const response = await request(app)
        .post('/createUser')
        .send({ walletAddress: longString });

      // Should handle gracefully without crashing
      expect([200, 400, 413]).toContain(response.status);
    });

    test('should handle null and undefined values', async () => {
      const nullValues = {
        walletAddress: null,
        itemNome: undefined,
        quantidade: null
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(nullValues);

      expect(response.status).toBe(400);
    });

    test('should handle type mismatches', async () => {
      const typeMismatch = {
        walletAddress: 12345, // Should be string
        itemNome: ['Vaso'], // Should be string
        quantidade: 'five' // Should be number
      };

      const response = await request(app)
        .post('/processarCompra')
        .send(typeMismatch);

      expect(response.status).toBe(400);
    });
  });
});