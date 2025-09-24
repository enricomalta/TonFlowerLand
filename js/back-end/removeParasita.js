import { pool } from "./mysql.js";

export async function removeParasita(walletAddress, slotId) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [userRows] = await conn.query('SELECT id, plant_time FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            return { success: false, message: "Usuário não encontrado." };
        }
        const userId = userRows[0].id;
        let plantTimeArray = JSON.parse(userRows[0].plant_time || '[]');
        let plantIndex = plantTimeArray.findIndex(plant => plant.slotID == slotId);
        if (plantIndex === -1) {
            await conn.rollback();
            return { success: false, message: "Vaso não encontrado." };
        }
        let plant = plantTimeArray[plantIndex];
        if (plant.growthStatus && plant.growthStatus.isParasita) {
            if (plant.growthStatus.pause?.type === "parasita") {
                const pause = plant.growthStatus.pause;
                const totalDuration = plant.harvestDate?.getTime ? plant.harvestDate.getTime() - plant.plantDate.getTime() : 0;
                const remaining = totalDuration - (pause.elapsedBeforePause || 0);
                plant.plantDate = new Date();
                plant.harvestDate = new Date(Date.now() + remaining);
            }
            plant.growthStatus.isParasita = false;
            console.log(`Parasita removido da planta no slot ${slotId}`);
        } else {
            await conn.rollback();
            return { success: false, message: "A planta não está com parasita." };
        }
        plantTimeArray[plantIndex] = plant;
        await conn.query('UPDATE users SET plant_time = ? WHERE id = ?', [JSON.stringify(plantTimeArray), userId]);
        await conn.commit();
        return { success: true, message: "Parasita removido com sucesso.", updatedPlant: plant };
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao remover parasita:", error);
        return { success: false, message: "Erro interno ao remover parasita." };
    } finally {
        conn.release();
    }
}