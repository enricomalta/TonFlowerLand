import { pool } from "./mysql.js";
import { removeItem } from "./removeItem.js";

// Função para adicionar planta ao plantTime usando MySQL
async function plantSeed(walletAddress, slotID, itemNome, itemTime, itemId, raridade, plantDate, harvestDate, isWatered, isParasita, isProtect, isFertilized) {
    itemTime = parseFloat(itemTime);
    if (isNaN(itemTime) || itemTime <= 0) {
        console.error("Erro: itemTime deve ser um número válido.");
        return { error: "Tempo de plantio inválido." };
    }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Busca usuário e inventário
        const [userRows] = await conn.query('SELECT id, inventario, plant_time FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            throw new Error("Usuário não encontrado.");
        }
        let inventario = JSON.parse(userRows[0].inventario || '[]');
        let itemIndex = inventario.findIndex(item => item.startsWith(`${itemNome}:`));
        if (itemIndex === -1) {
            await conn.rollback();
            throw new Error("O jogador não possui esse item no inventário.");
        }
        let [_, quantidade] = inventario[itemIndex].split(":");
        quantidade = parseInt(quantidade);
        if (quantidade <= 0) {
            await conn.rollback();
            throw new Error("O jogador não tem quantidade suficiente desse item.");
        }
        // Atualiza ou adiciona planta no plantTime
        let plantTime = JSON.parse(userRows[0].plant_time || '[]');
        plantTime = plantTime.filter(plant => typeof plant === "object" && plant.slotID);
        const existingIndex = plantTime.findIndex(plant => plant.slotID === slotID);
    const now = new Date();
    const plantDateTimestamp = now;
        isWatered = isWatered ?? false;
        isParasita = isParasita ?? false;
        isProtect = isProtect ?? false;
        isFertilized = isFertilized ?? false;
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 20);
    const harvestDateTimestamp = futureDate;
        let growthStatus = {
            isWatered,
            isParasita,
            isProtected: isProtect,
            isFertilized,
            lastUpdated: now,
            elapsedTime: 0,
            totalTime: itemTime * 60 * 60 * 1000
        };
        const plantData = {
            slotID,
            itemNome,
            plantDate: plantDateTimestamp,
            itemTime,
            harvestDate: harvestDateTimestamp,
            itemId,
            raridade,
            growthStatus
        };
        if (existingIndex !== -1) {
            plantTime[existingIndex] = plantData;
        } else {
            plantTime.push(plantData);
        }
        // Atualiza plant_time no banco
        await conn.query('UPDATE users SET plant_time = ? WHERE id = ?', [JSON.stringify(plantTime), userRows[0].id]);
        await conn.commit();
        // Remove item do inventário (fora da transação, pois removeItem já faz controle)
        await removeItem(walletAddress, itemNome, 1);
        return plantData;
    } catch (error) {
        await conn.rollback();
        return { error: error.message || "Erro ao salvar dados no banco." };
    } finally {
        conn.release();
    }

        let growthStatus = {
            isWatered: false,
            isParasita: false,
            isProtected: false,
            isFertilized: false,
            lastUpdated: now,
            elapsedTime: 0,
            totalTime: itemTime * 60 * 60 * 1000
        };

        const plantData = {
            slotID,
            itemNome,
            plantDate: plantDateTimestamp,
            itemTime,
            harvestDate: harvestDateTimestamp,
            itemId,
            raridade,
            growthStatus
        };

        if (existingIndex !== -1) {
            plantTime[existingIndex] = plantData;
        } else {
            plantTime.push(plantData);
        }
        // Atualiza plant_time no banco
        await conn.query('UPDATE users SET plant_time = ? WHERE id = ?', [JSON.stringify(plantTime), userRows[0].id]);
        await conn.commit();
        // Remove item do inventário (fora da transação, pois removeItem já faz controle)
        await removeItem(walletAddress, itemNome, 1);
        return plantData;
    }

export { plantSeed };