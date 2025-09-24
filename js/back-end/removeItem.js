import { pool } from "./mysql.js";


// Função para remover item do inventário usando MySQL
async function removeItem(walletAddress, itemNome, quantidade = 1) {
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
        return { error: "Endereço de carteira inválido" };
    }
    if (!itemNome || typeof itemNome !== 'string' || itemNome.trim() === '') {
        return { error: "Nome do item inválido" };
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
        return { error: "Quantidade inválida" };
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Buscar usuário
        const [userRows] = await conn.query('SELECT * FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            console.error("Usuário não encontrado!");
            return { error: "Usuário não encontrado!" };
        }
        const userId = userRows[0].id;
        // Buscar item
        const [itemRows] = await conn.query('SELECT * FROM items WHERE item_nome = ? LIMIT 1', [itemNome]);
        if (itemRows.length === 0) {
            await conn.rollback();
            console.error(`Item ${itemNome} não encontrado no banco de dados!`);
            return { error: `Item ${itemNome} não encontrado no inventário!` };
        }
        const itemId = itemRows[0].item_id;
        // Buscar inventário
        const [invRows] = await conn.query('SELECT * FROM inventory WHERE user_id = ? AND item_id = ? FOR UPDATE', [userId, itemId]);
        if (invRows.length === 0) {
            await conn.rollback();
            console.error(`Item ${itemNome} não encontrado no inventário!`);
            return { error: `Item ${itemNome} não encontrado no inventário!` };
        }
        const quantidadeAtual = invRows[0].quantity;
        const novaQuantidade = quantidadeAtual - quantidade;
        if (novaQuantidade < 0) {
            await conn.rollback();
            console.error(`A quantidade mínima do item ${itemNome} é 1.`);
            return { error: `A quantidade mínima do item ${itemNome} é 1.` };
        }
        if (novaQuantidade === 0) {
            await conn.query('DELETE FROM inventory WHERE user_id = ? AND item_id = ?', [userId, itemId]);
        } else {
            await conn.query('UPDATE inventory SET quantity = ? WHERE user_id = ? AND item_id = ?', [novaQuantidade, userId, itemId]);
        }
        await conn.commit();
        return {
            success: `Item ${itemNome} removido com sucesso! Nova quantidade: ${novaQuantidade}`
        };
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao remover item:", error);
        return { error: "Erro ao remover item: " + error.message };
    } finally {
        conn.release();
    }
}

export { removeItem };
