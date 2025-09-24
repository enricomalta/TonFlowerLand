// Configuração global para testes (ESM). Apenas variáveis de ambiente e timeout.

// Mock das variáveis de ambiente para testes
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.NODE_ENV = 'test';
process.env.CONTRACT = 'test_contract_address';
process.env.PORT = '3001';
process.env.TON_CONTRACT_ADDRESS = 'test_ton_contract';
process.env.TON_API_URL = 'https://testnet.toncenter.com/api/v2';
process.env.ADMIN_ADDRESS = 'test_admin_address';
process.env.SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: "service_account",
  project_id: "test-project",
  private_key_id: "test-key-id",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST_KEY\n-----END PRIVATE KEY-----\n",
  client_email: "test@test-project.iam.gserviceaccount.com",
  client_id: "123456789",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/test%40test-project.iam.gserviceaccount.com"
});


// Configuração de timeout global
import { jest } from '@jest/globals';
jest.setTimeout(10000);