CREATE DATABASE nft_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nft_db;

-- Tabela de Usuários
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(128) UNIQUE NOT NULL,
  token_balance DECIMAL(18,2) DEFAULT 0,
  cripto_balance DECIMAL(18,2) DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  history_deposit JSON DEFAULT (JSON_ARRAY()),
  history_withdrawn JSON DEFAULT (JSON_ARRAY()),
  plant_time JSON DEFAULT (JSON_ARRAY()),
  inventario JSON DEFAULT (JSON_ARRAY()),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Itens
CREATE TABLE items (
  item_id VARCHAR(16) PRIMARY KEY,
  item_nome VARCHAR(64) NOT NULL,
  item_pay DECIMAL(18,2) DEFAULT 0,
  item_pay_porcentage VARCHAR(8),
  item_preco DECIMAL(18,2) DEFAULT 0,
  item_time VARCHAR(16),
  item_validade VARCHAR(16),
  raridade VARCHAR(8),
  rating VARCHAR(8),
  xp INT DEFAULT 0
);

-- Inventário do Usuário
CREATE TABLE inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id VARCHAR(16) NOT NULL,
  quantity INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(item_id)
);

-- Ledger de Transações
CREATE TABLE ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type VARCHAR(32) NOT NULL, -- ex: 'deposit', 'withdraw', 'purchase'
  amount DECIMAL(18,2) NOT NULL,
  request_id VARCHAR(64),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Controle de Idempotência
CREATE TABLE idempotency_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_value VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
