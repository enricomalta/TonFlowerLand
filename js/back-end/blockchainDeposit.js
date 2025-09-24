import axios from 'axios';
import { pool } from './mysql.js';

const TON_CONTRACT_ADDRESS = process.env.TON_CONTRACT_ADDRESS;
const TON_API_URL = process.env.TON_API_URL; // Ex: https://tonapi.io ou https://toncenter.com/api/v2
const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;

/**
 * Função para creditar saldo do usuário no MySQL.
 * Se o usuário já possuir criptoBalance, soma o valor depositado.
 * O saldo é formatado para 2 casas decimais.
 */
async function creditUserBalance(address, amount) {
  try {
    // Consulta saldo atual do usuário
    const [[user]] = await pool.query('SELECT criptoBalance FROM users WHERE wallet_address = ?', [address]);
    let currentBalance = 0;
    if (user && user.criptoBalance !== undefined) {
      currentBalance = parseFloat(user.criptoBalance) || 0;
    }
    // Converte o valor depositado para número e formata com 2 casas decimais
    const deposit = parseFloat(amount) || 0;
    const newBalance = (currentBalance + deposit).toFixed(2);

    // Atualiza saldo no banco
    await pool.query('UPDATE users SET criptoBalance = ? WHERE wallet_address = ?', [newBalance, address]);

    console.log(`Crédito de ${deposit} para ${address}. Novo saldo cripto: ${newBalance}`);
  } catch (error) {
    console.error(`Erro ao creditar saldo para ${address}:`, error.message);
  }
}

/**
 * Função para monitorar depósitos no contrato TON.
 * Utiliza a API do TON (TonAPI ou Toncenter) para obter as últimas transações.
 * Para cada transação com valor positivo, chama a função de crédito.
 */
async function monitorDeposits() {
    try {
        console.log("Monitorando depósitos...");
        const response = await axios.get(`${TON_API_URL}/blockchain/getTransactions`, {
            params: {
                account: TON_CONTRACT_ADDRESS,
                limit: 10,
            },
        });

        const transactions = response.data.transactions || [];
        for (const tx of transactions) {
            if (tx.in_msg && tx.in_msg.value > 0) {
                const sender = tx.in_msg.source;
                const amount = tx.in_msg.value;
                console.log(`Depósito detectado: remetente ${sender}, valor ${amount}`);
                // Atualiza o criptoBalance do usuário no MySQL
                await creditUserBalance(sender, amount);
            }
        }
    } catch (error) {
        console.error('Erro ao monitorar depósitos:', error.message);
    }
}

// Consulta saldo do usuário
export async function getUserBalance(walletAddress) {
  const [rows] = await pool.query(
    'SELECT token_balance FROM users WHERE wallet_address = ?',
    [walletAddress]
  );
  if (rows.length === 0) return { error: 'Usuário não encontrado' };
  return { tokenBalance: rows[0].token_balance };
}

// Saque de tokens
async function withdrawTokens(walletAddress, amount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT token_balance FROM users WHERE wallet_address = ? FOR UPDATE',
      [walletAddress]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return { error: 'Usuário não encontrado' };
    }
    const balance = parseFloat(rows[0].token_balance);
    if (balance < amount) {
      await conn.rollback();
      return { error: 'Saldo insuficiente' };
    }
    await conn.query(
      'UPDATE users SET token_balance = token_balance - ? WHERE wallet_address = ?',
      [amount, walletAddress]
    );
    await conn.commit();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    return { error: err.message };
  } finally {
    conn.release();
  }
}

// Depósito de tokens
export async function depositTokens(walletAddress, amount) {
  const [result] = await pool.query(
    'UPDATE users SET token_balance = token_balance + ? WHERE wallet_address = ?',
    [amount, walletAddress]
  );
  if (result.affectedRows === 0) return { error: 'Usuário não encontrado' };
  return { success: true };
}

// Exporta funções, caso sejam necessárias em outras partes do back-end
export { monitorDeposits, creditUserBalance, withdrawTokens };
