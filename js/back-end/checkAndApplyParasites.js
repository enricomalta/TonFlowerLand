import { pool } from "./mysql.js";
// Removido dependência do Firebase. Usar Date nativo JS.

async function checkAndApplyParasites() {
    try {
        const [users] = await pool.query('SELECT id, plant_time FROM users');
        for (const user of users) {
            let plantTimeArray = [];
            try {
                plantTimeArray = JSON.parse(user.plant_time || '[]');
            } catch (e) {
                plantTimeArray = [];
            }
            let updated = false;
            plantTimeArray.forEach((plant) => {
                if (!plant.growthStatus) {
                    plant.growthStatus = {};
                }
                const now = new Date();
                let harvestDate = plant.harvestDate;
                if (harvestDate && typeof harvestDate.toDate === "function") {
                    harvestDate = harvestDate.toDate();
                }
                if (harvestDate && now >= harvestDate) {
                    plant.growthStatus.isFinish = true;
                }
                const isProtected = plant.growthStatus.isProtected || false;
                const isParasita = plant.growthStatus.isParasita || false;
                const isWatered = plant.growthStatus.isWatered || false;
                const isFinish = plant.growthStatus.isFinish || false;
                if (!isFinish && !isProtected && !isParasita && isWatered) {
                    console.log("Plantas com criterios batidos", plant.slotID);
                    if (Math.random() < 0.5) {
                        console.log(`Parasita ativado para planta no slot ${plant.slotID}`);
                        plant.growthStatus.isParasita = true;
                        plant.growthStatus.pausedTimeMs = Date.now() - (plant.plantDate?.getTime ? plant.plantDate.getTime() : new Date().getTime());
                        updated = true;
                        const now = new Date();
                        const tempoDesdeUltimoPlantDate = now - (plant.plantDate?.getTime ? plant.plantDate.getTime() : new Date().getTime());
                        const elapsedBeforePauseAnterior = plant.growthStatus.pause?.elapsedBeforePause || 0;
                        plant.growthStatus.pause = {
                            type: "parasita",
                            start: Timestamp.fromDate(now),
                            elapsedBeforePause: elapsedBeforePauseAnterior + tempoDesdeUltimoPlantDate,
                            totalTime: plant.growthStatus.totalTime
                        };
                    }
                }
            });
            if (updated) {
                await pool.query('UPDATE users SET plant_time = ? WHERE id = ?', [JSON.stringify(plantTimeArray), user.id]);
            }
        }
    } catch (error) {
        console.error("Erro ao verificar parasitas:", error);
    }
}

// Observação: Nenhuma alteração necessária para o sistema de dados locais do front-end.
// O back-end permanece responsável apenas por atualizar o banco de dados quando solicitado.
// O front-end deve buscar os dados uma vez ao conectar e atualizar localmente após operações de escrita.

export { checkAndApplyParasites };