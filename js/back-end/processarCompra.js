import { pool } from "./mysql.js";


async function processarCompra(walletAddress, itemNome, quantidade = 1) {
    if (!walletAddress || !itemNome || quantidade !== 1) {
        return { error: "Parâmetros inválidos" };
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // 1. Buscar usuário
        const [userRows] = await conn.query('SELECT * FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            return { error: "Usuário não encontrado" };
        }
        const userData = userRows[0];
        // 2. Buscar item
        const [itemRows] = await conn.query('SELECT * FROM items WHERE item_nome = ? LIMIT 1', [itemNome]);
        if (itemRows.length === 0) {
            await conn.rollback();
            return { error: "Item não encontrado" };
        }
        const itemData = itemRows[0];
        // 3. Verificar dados
        const tokenBalance = parseFloat(userData.token_balance || "0.00");
        const itemPreco = parseFloat(itemData.item_preco);
        if (isNaN(tokenBalance) || isNaN(itemPreco)) {
            await conn.rollback();
            return { error: "Erro nos dados de saldo ou preço" };
        }
        // 4. Verificar saldo
        if (tokenBalance < itemPreco) {
            await conn.rollback();
            return { error: "Saldo insuficiente" };
        }
        // 5. Atualizar inventário
        // Busca o id do usuário e do item
        const userId = userData.id;
        const itemId = itemData.item_id;
        // Atualiza ou insere no inventário
        await conn.query(
            'INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?',
            [userId, itemId, quantidade, quantidade]
        );
        // 6. Calcular novo saldo
        const novoSaldo = (tokenBalance - itemPreco).toFixed(2);
        await conn.query(
            'UPDATE users SET token_balance = ? WHERE id = ?',
            [novoSaldo, userId]
        );
        await conn.commit();
        // 7. Retornar dados atualizados
        return {
            success: `Item ${itemNome} comprado com sucesso!`,
            userData: {
                ...userData,
                token_balance: novoSaldo
            }
        };
    } catch (error) {
        await conn.rollback();
        console.error("Erro na transação:", error);
        return { error: "Erro ao processar a compra: " + error.message };
    } finally {
        conn.release();
    }
}

export { processarCompra };