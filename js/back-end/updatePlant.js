import { pool } from "./mysql.js";

// Função para atualizar o status da planta usando MySQL
async function updatePlantStatus(walletAddress, slotId, statusField, newValue, utilityName) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // 0. Busca os dados do usuário
        const [userRows] = await conn.query('SELECT * FROM users WHERE wallet_address = ? FOR UPDATE', [walletAddress]);
        if (userRows.length === 0) {
            await conn.rollback();
            throw new Error("Usuário não encontrado.");
        }
        const userId = userRows[0].id;
        // 1. Busca plantTime (supondo campo JSON na tabela users)
        let plantTimeArray = JSON.parse(userRows[0].plant_time || '[]');
        let inventario = JSON.parse(userRows[0].inventario || '[]');
        // 2. Encontrar a planta no slot clicado
        let plantIndex = plantTimeArray.findIndex(plant => plant.slotID == slotId);
        if (plantIndex === -1) {
            await conn.rollback();
            throw new Error(`Vaso com ID ${slotId} não encontrado!`);
        }
        let plant = plantTimeArray[plantIndex];
        if (!plant.itemId) {
            await conn.rollback();
            throw new Error(`Não há planta no vaso ${slotId}.`);
        }
        if (!plant.growthStatus) {
            plant.growthStatus = {};
        }
        // 3. Verificar se o usuário possui o item no inventário
        let itemIndex = inventario.findIndex(item => {
            let [nome, quantidade] = item.split(":");
            return nome === utilityName && parseInt(quantidade) > 0;
        });
        if (itemIndex === -1) {
            await conn.rollback();
            throw new Error(`Item ${utilityName} não encontrado no inventário ou quantidade insuficiente.`);
        }
        // 4. Atualizações de status da planta
        if (statusField === "isWatered" && newValue === true && !plant.growthStatus._wasWatered) {
            const now = new Date();
            plant.plantDate = now;
            const tempoCrescimentoMs = (plant.itemTime || 0) * 60 * 60 * 1000;
            plant.harvestDate = new Date(now.getTime() + tempoCrescimentoMs);
            plant.growthStatus._wasWatered = true;
        }
        
        if (utilityName === "Anti-Parasitas" || (statusField === "isParasita" && newValue === false)) {
            if (plant.growthStatus.pause?.type === "parasita") {
                const pause = plant.growthStatus.pause;
                const totalTime = pause.totalTime || plant.growthStatus.totalTime || (plant.itemTime || 0) * 60 * 60 * 1000;
                const elapsedBeforePause = pause.elapsedBeforePause || 0;
                const remaining = totalTime - elapsedBeforePause;
                plant.plantDate = new Date();
                plant.harvestDate = new Date(Date.now() + remaining);
                delete plant.growthStatus.pause;
            }
            plant.growthStatus.isParasita = false;
            if (utilityName === "Anti-Parasitas") {
                plant.growthStatus.isProtected = true;
            }
        } else {
            plant.growthStatus[statusField] = newValue;
        }

        // 12. Se a planta estiver com parasitas, reiniciar o tempo de crescimento
        // if (plant.growthStatus.pause?.type === "parasita") {
        //     const pause = plant.growthStatus.pause;
        //     const totalDuration = plant.harvestDate.toDate() - plant.plantDate.toDate();
        //     const remaining = totalDuration - pause.elapsedBeforePause;

        //     plant.plantDate = new Date();
        //     plant.harvestDate = new Date(Date.now() + remaining);

        //     delete plant.growthStatus.pause;
        //     plant.growthStatus.isParasita = false;
        // }

    plant.growthStatus.lastUpdated = new Date();
        plantTimeArray[plantIndex] = plant;
        const newHarvestDate = await recalculateHarvestDate(plant);
        if (!newHarvestDate) {
            await conn.rollback();
            throw new Error("Falha ao calcular nova data de colheita.");
        }
        plant.harvestDate = newHarvestDate;
        plantTimeArray[plantIndex] = plant;
        inventario = inventario.map(item => {
            let [nome, quantidade] = item.split(":");
            if (nome === utilityName) {
                let novaQtd = Math.max(0, parseInt(quantidade) - 1);
                return `${nome}:${novaQtd}`;
            }
            return item;
        }).filter(item => {
            let [_, quantidade] = item.split(":");
            return parseInt(quantidade) > 0;
        });
        // Atualiza no MySQL
        await conn.query('UPDATE users SET plant_time = ?, inventario = ? WHERE id = ?', [JSON.stringify(plantTimeArray), JSON.stringify(inventario), userId]);
        await conn.commit();
        return {
            success: true,
            message: `Status ${statusField} atualizado para ${newValue} no vaso ${slotId}.`,
            updatedPlant: plant
        };
    } catch (error) {
        await conn.rollback();
        console.error("Erro ao atualizar status da planta:", error);
        return { success: false, message: error.message || "Erro interno do servidor." };
    } finally {
        conn.release();
    }
}


// Função para recalcular a data de colheita considerando tempo decorrido
async function recalculateHarvestDate(plant) {
    try {

        // Pegando timestamps relevantes
        const now = new Date();
        const plantDate = plant.plantDate?.toDate ? plant.plantDate.toDate() : new Date(); // Garantir que existe uma data válida
        const itemTimeMs = (plant.itemTime || 0) * 60 * 60 * 1000; // Converter itemTime para milissegundos, garantindo que não seja undefined

        // Calcular tempo já decorrido desde o plantio
        const elapsedTimeMs = now - plantDate;

        // Calcular tempo restante considerando rega e fertilizante
        let remainingTimeMs = itemTimeMs - elapsedTimeMs;

        // Certificar que o status da planta existe
        if (!plant.growthStatus) {
            plant.growthStatus = {};
        }
        

        const isWatered = plant.growthStatus.isWatered || false;
        const isFertilized = plant.growthStatus.isFertilized || false;
        const isParasita = plant.growthStatus.isParasita || false;

        // Debugging: log dos status atuais
        // console.log(`Status antes do cálculo:`);
        // console.log(`  isWatered: ${isWatered}`);
        // console.log(`  isFertilized: ${isFertilized}`);
        // console.log(`  isParasita: ${isParasita}`);

        // Ajustar tempo restante com base nos status
        if (isWatered && isFertilized) {
            remainingTimeMs /= 2; // Metade do tempo se regado e fertilizado
        } else if (isWatered && !isParasita) {
            // Tempo normal se apenas regado e sem parasitas
        } else if (!isWatered || isParasita) {
            // Penalização de 20 anos apenas se a planta ainda tiver parasitas ou não for regada
            remainingTimeMs = 20 * 365 * 24 * 60 * 60 * 1000;
        }

        // Nova data de colheita, garantindo que nunca será undefined
        let newHarvestDate = new Date(now.getTime() + remainingTimeMs);
        if (isNaN(newHarvestDate.getTime())) {
            console.warn("newHarvestDate gerou um valor inválido, atribuindo data padrão.");
            newHarvestDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Padrão: +1 dia
        }


        return newHarvestDate;
    } catch (error) {
        console.error("Erro ao recalcular a data de colheita:", error);
        return null;
    }
}


export { updatePlantStatus , recalculateHarvestDate }