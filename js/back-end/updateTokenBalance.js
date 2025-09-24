import { pool } from './mysql.js';

// Atualiza saldo do player - função utilitária apenas para uso interno
async function updateTokenBalance(walletAddress, novoSaldo) {
    if (!walletAddress || typeof walletAddress !== 'string') {
        throw new Error("Endereço de carteira inválido");
    }
    const saldo = parseFloat(novoSaldo);
    if (isNaN(saldo) || saldo < 0) {
        throw new Error("Valor de saldo inválido");
    }
    const saldoFormatado = saldo.toFixed(2);
    const [result] = await pool.query('UPDATE users SET token_balance = ? WHERE wallet_address = ?', [saldoFormatado, walletAddress]);
    if (result.affectedRows === 0) {
        throw new Error("Usuário não encontrado");
    }
    return { success: 'Saldo atualizado com sucesso!' };
}

export { updateTokenBalance };