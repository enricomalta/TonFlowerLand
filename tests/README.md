# TonFlower Land - Test Suite

## Overview
Esta é a suíte de testes abrangente para o projeto TonFlower Land, um jogo P2E (Play-to-Earn) baseado em blockchain TON.

## Estrutura dos Testes

### 📁 Arquivos de Teste

#### `jest.config.js`
- **Propósito**: Configuração principal do Jest
- **Features**: Cobertura de código com thresholds de 70%, mapeamento de módulos ES6
- **Ambiente**: Node.js com transformação Babel

#### `tests/setup.js`
- **Propósito**: Setup global com mocks para Firebase, TonWeb, axios
- **Mocks**: Firebase Admin, TonWeb, variáveis de ambiente
- **Uso**: Executado antes de todos os testes

#### `tests/auth.test.js` (127 testes)
- **Foco**: Sistema de autenticação JWT
- **Cobertura**: Verificação de tokens, cookies, headers, expiração
- **Cenários**: Tokens válidos/inválidos, middleware de segurança

#### `tests/business-logic.test.js` (89 testes)
- **Foco**: Lógica de negócio do jogo
- **Cobertura**: Compras, remoção de itens, criação de usuários
- **Cenários**: Validações, transações, gestão de inventário

#### `tests/plant-management.test.js` (107 testes)
- **Foco**: Sistema de plantas e gameplay
- **Cobertura**: Plantar, coletar, crescimento, parasitas
- **Cenários**: Ciclo completo de vida das plantas, aplicação de utilitários

#### `tests/database.test.js` (93 testes)
- **Foco**: Operações Firebase Firestore
- **Cobertura**: CRUD operations, queries, performance
- **Cenários**: Operações concorrentes, integridade de dados

#### `tests/blockchain.test.js` (89 testes)
- **Foco**: Integração blockchain TON
- **Cobertura**: Depósitos, saques, verificação de transações
- **Cenários**: Validação de carteiras, fees, confirmações

#### `tests/api.test.js` (103 testes)
- **Foco**: Endpoints REST API
- **Cobertura**: Rotas de usuário, jogo, middleware
- **Cenários**: Autenticação, validação, rate limiting

#### `tests/utilities.test.js` (81 testes)
- **Foco**: Funções utilitárias
- **Cobertura**: Validações, formatação, manipulação de dados
- **Cenários**: Edge cases, sanitização, conversões

#### `tests/smart-contract.test.js` (45 testes)
- **Foco**: Contratos inteligentes TON
- **Cobertura**: Deploy, depósitos, saques, segurança
- **Cenários**: Gas usage, concorrência, edge cases

#### `tests/integration.test.js` (35+ cenários)
- **Foco**: Testes end-to-end
- **Cobertura**: Fluxos completos de usuário
- **Cenários**: Registro → gameplay → blockchain → economia

## Como Executar

### Instalação
```bash
npm install
```

### Executar Todos os Testes
```bash
npm test
```

### Executar Testes Específicos
```bash
# Testes de autenticação
npm test auth.test.js

# Testes de blockchain
npm test blockchain.test.js

# Testes de integração
npm test integration.test.js
```

### Cobertura de Código
```bash
npm run test:coverage
```

### Modo Watch (desenvolvimento)
```bash
npm run test:watch
```

## Configuração de Ambiente

### Variáveis de Ambiente Necessárias
```env
NODE_ENV=test
FIREBASE_PROJECT_ID=your-project-id
JWT_SECRET=your-jwt-secret
TON_API_KEY=your-ton-api-key
ENCRYPTION_KEY=your-encryption-key
```

### Dependências de Teste
- `jest`: Framework de testes
- `@babel/preset-env`: Transformação ES6
- `supertest`: Testes de API HTTP
- `@ton/sandbox`: Testes de smart contracts
- `@ton/test-utils`: Utilitários TON

## Mocks e Simulações

### Firebase Admin
- Mock completo do Firestore
- Simulação de operações CRUD
- Emulação de queries e transações

### TonWeb
- Mock de operações blockchain
- Simulação de transações TON
- Emulação de smart contracts

### Axios
- Mock de requisições HTTP
- Simulação de respostas de APIs externas
- Controle de timeouts e erros

## Thresholds de Cobertura

| Métrica | Threshold |
|---------|-----------|
| Statements | 70% |
| Branches | 70% |
| Functions | 70% |
| Lines | 70% |

## Relatórios

### Cobertura HTML
Após executar `npm run test:coverage`, acesse:
```
./coverage/lcov-report/index.html
```

### Logs de Teste
Logs detalhados são salvos em:
```
./test-results/
```

## Cenários de Teste Cobertos

### 🔐 Autenticação
- JWT token validation
- Cookie authentication
- Bearer token handling
- Token expiration
- Security middleware

### 🎮 Gameplay
- Plant lifecycle (plant → grow → harvest)
- Inventory management
- Shop purchases
- Item usage
- Parasite management

### 💰 Economia
- Balance management
- Transaction processing
- Purchase validation
- Reward distribution
- Fee calculation

### ⛓️ Blockchain
- TON deposits
- Withdrawal processing
- Transaction verification
- Smart contract interaction
- Gas optimization

### 🗄️ Database
- User data management
- Plant state persistence
- Transaction history
- Concurrent operations
- Data integrity

### 🌐 API
- REST endpoint testing
- Input validation
- Error handling
- Rate limiting
- Response formatting

### 🔧 Utilities
- Data validation
- String sanitization
- Time calculations
- Currency formatting
- ID generation

## Debugging

### Test Debugging
```bash
# Executar teste específico com logs
npm test -- --testNamePattern="should plant seed successfully" --verbose

# Debug com Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand auth.test.js
```

### Mock Debugging
```javascript
// Verificar chamadas de mock
expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
expect(mockFunction).toHaveBeenCalledTimes(expectedCount);
```

## Contribuição

### Adicionando Novos Testes
1. Crie o arquivo na pasta `tests/`
2. Importe os mocks necessários do `setup.js`
3. Siga a estrutura existente (describe → test)
4. Mantenha cobertura acima de 70%

### Convenções
- Nomes descritivos para testes
- Setup/teardown adequado
- Mocks isolados por teste
- Assertions claras e específicas

## Troubleshooting

### Problemas Comuns

#### Erro: "Cannot resolve module"
```bash
# Limpar cache do Jest
npm test -- --clearCache
```

#### Erro: "Firebase not initialized"
Verifique se o `setup.js` está sendo executado:
```javascript
// jest.config.js
setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
```

#### Erro: "Timeout"
Aumente o timeout para testes lentos:
```javascript
test('slow test', async () => {
  // ...
}, 10000); // 10 segundos
```

## Performance

### Otimizações
- Mocks evitam chamadas reais para APIs
- Tests paralelos quando possível
- Setup reutilizável entre testes
- Cleanup automático de recursos

### Métricas
- **Total de testes**: 769+
- **Tempo médio**: < 30 segundos
- **Cobertura alvo**: 70%+
- **Falsos positivos**: < 1%

## Roadmap

### Próximas Funcionalidades
- [ ] Visual regression testing
- [ ] Load testing com Artillery
- [ ] E2E testing com Playwright
- [ ] Contract fuzzing testing
- [ ] Performance benchmarking

### Melhorias
- [ ] Parallel test execution
- [ ] Test result caching
- [ ] Custom jest matchers
- [ ] Test data factories
- [ ] Advanced mocking strategies