import { pool } from "./mysql.js";


async function colectSeed(walletAddress, slotID) {
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
        return { error: "Endereço de carteira inválido" };
    }
    const slot = parseInt(slotID);
    if (isNaN(slot) || slot < 0) {
        return { error: "ID do slot inválido. Deve ser um número inteiro positivo." };
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Buscar usuário
        const [userRows] = await conn.query('SELECT * FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            throw new Error("Usuário não encontrado.");
        }
        const userId = userRows[0].id;
        let plantTimeArray = JSON.parse(userRows[0].plant_time || '[]');
        let inventario = JSON.parse(userRows[0].inventario || '[]');
        // Buscar planta no slot
        const plant = plantTimeArray.find(p => p.slotID === slot);
        if (!plant) {
            await conn.rollback();
            throw new Error("Nenhuma planta encontrada nesse slot.");
        }
        // Validar tempo de colheita
        const currentTime = Date.now();
        const harvestTimeMs = plant.harvestDate?._seconds * 1000 + (plant.harvestDate?._nanoseconds || 0) / 1000000;
        if (currentTime < harvestTimeMs) {
            await conn.rollback();
            throw new Error("A planta ainda não está pronta para colheita.");
        }
        // Buscar item
        const [itemRows] = await conn.query('SELECT * FROM items WHERE item_id = ? LIMIT 1', [plant.itemId]);
        if (itemRows.length === 0) {
            await conn.rollback();
            throw new Error("Item não encontrado no banco de dados.");
        }
        const itemData = itemRows[0];
        const itemPay = Number(itemData.item_pay) || 0;
        const itemXp = Number(itemData.xp) || 0;
        // Calcular novo saldo
        const currentTokenBalance = parseFloat(userRows[0].token_balance || "0");
        if (isNaN(currentTokenBalance)) {
            await conn.rollback();
            throw new Error("Saldo atual inválido.");
        }
        const newTokenBalance = (currentTokenBalance + itemPay).toFixed(2);
        // Atualizar inventário
        let estrelaIndex = inventario.findIndex(item => item.startsWith("Estrela:"));
        if (estrelaIndex !== -1) {
            let [nome, quantidadeAtual] = inventario[estrelaIndex].split(":");
            let novaQuantidade = parseInt(quantidadeAtual) || 0;
            novaQuantidade += itemXp;
            inventario[estrelaIndex] = `${nome}:${novaQuantidade}`;
        } else {
            inventario.push("Estrela:0");
        }
        // Remover planta do slot
        plantTimeArray = plantTimeArray.filter(p => p.slotID !== slot);
        // Atualizar dados no MySQL
        await conn.query('UPDATE users SET plant_time = ?, token_balance = ?, inventario = ? WHERE id = ?', [JSON.stringify(plantTimeArray), newTokenBalance, JSON.stringify(inventario), userId]);
        await conn.commit();
        return {
            message: "Planta coletada com sucesso!",
            tokensGained: itemPay,
            newBalance: newTokenBalance,
            slotID: slot,
            plantName: plant.itemNome,
            estrelasGained: itemXp
        };
    } catch (error) {
        await conn.rollback();
        return { error: error.message };
    } finally {
        conn.release();
    }
}

export { colectSeed };
