import { 
    playOpen,
    showPlantModal,
    tradeOpen,
    inventoryOpen,
    configOpen,
    tradeHistoricoOpen,
    tradeSwapOpen,
    tradeHistoricoDepositOpen,
    tradeHistoricoSaqueOpen,
    isPlayGameBoardActive,
    isPlayUtilitarioActive,
    mostrarInventarioUtilitarios
} from './modal-hook.js';

import {
    verifyAndCollectSeed,
    attachSlotClickEvents,
    parseUserPlantTime
} from '../index.js';

import {
    updatePlayBoard,
    updateDisplay
} from './display.js';

import {
    soundInspectPlant
} from './sound.js';

import { 
    fetchItems,
    updatePlayerStatus,
    checkPlantTime
} from '../api.js';

import {
    getWalletAddress
} from '../web3/walletConnect.js';

import {
    initTranslationSystem,
    updateAllTexts
} from '../lang/translate.js';

let walletAddress = getWalletAddress();
const activeIntervals = {}; // Temporazidores
const activePlantIntervals = {}; // Planta Update UI/Crescimento
const raridadeClasses = {
    1: "--incomun-color",
    2: "--comun-color",
    3: "--raro-color",
    4: "--epico-color",
    5: "--lendario-color",
    6: "--mitico-color",
    7: "--desconhecido-color"
};

// Função helper para normalizar o inventário independentemente do formato
export function normalizeInventario(inventario) {
    if (!inventario) return [];

    // Se já é um array no formato antigo ["Vaso:1", "Item:2"]
    if (Array.isArray(inventario)) return inventario;

    // Se é um objeto no formato novo {"Vaso":1, "Item":2}
    if (typeof inventario === 'object') {
        return Object.entries(inventario).map(([itemNome, quantidade]) => `${itemNome}:${quantidade}`);
    }

    // Se é uma string JSON
    if (typeof inventario === 'string') {
        try {
            const parsed = JSON.parse(inventario);
            return Object.entries(parsed).map(([itemNome, quantidade]) => `${itemNome}:${quantidade}`);
        } catch (e) {
            console.warn('Erro ao fazer parse do inventário:', e);
            return [];
        }
    }

    return [];
}



/**
 * Função unificada para carregar e atualizar toda a UI baseada nos dados do usuário
 * Deve ser chamada na conexão inicial e após qualquer operação de escrita no banco
 * @param {string} walletAddress - Endereço da carteira do jogador
 * @param {Object} userData - Dados do usuário (opcional, se não fornecido busca da API)
 * @returns {boolean} Retorna true se os dados foram carregados e atualizados com sucesso
 */
export async function UpdateUI(walletAddress, userData = null) {
    try {
        const resolvedWalletAddress = walletAddress || getWalletAddress();
        if (!resolvedWalletAddress) {
            console.error("Endereço da wallet não encontrado.");
            return false;
        }

        // Se userData não foi fornecido, busca da API
        let userDataResolved = userData;
        if (!userDataResolved) {
            userDataResolved = await updatePlayerStatus(resolvedWalletAddress);
        }

        const items = await fetchItems();

        if (!userDataResolved || !items || items.length === 0) {
            console.error("Erro ao obter dados do jogador ou da loja.");
            return false;
        }


        // Adiciona os itens da loja aos dados do usuário
        userDataResolved.items = items;

        // 1. Normaliza inventário
        const inventarioNormalizado = normalizeInventario(
            userDataResolved.inventario
        );

        userDataResolved.inventario = inventarioNormalizado;

        // 2. Extrai quantidades importantes do inventário
        let quantityVasos = 0;
        let quantityStar = 0;
        let quantityRegador = 0;
        let quantityFertilizante = 0;
        let quantityAntiParasita = 0;
        
        inventarioNormalizado.forEach(item => {
            const [itemNome, quantidade] = item.split(":").map(x => x.trim());
            const qtd = parseInt(quantidade) || 0;
            
            switch (itemNome) {
                case "Vaso": quantityVasos = qtd; break;
                case "Estrela": quantityStar = qtd; break;
                case "Regador": quantityRegador = qtd; break;
                case "Fertilizante": quantityFertilizante = qtd; break;
                case "Anti-Parasitas": quantityAntiParasita = qtd; break;
            }
        });
        
        // Atualiza variáveis globais
        window.quantityVasos = quantityVasos;
        window.quantityStar = quantityStar;
        

        // ========== ATUALIZAÇÃO DA UI ==========
        
        // 3. Atualiza os saldos
        const criptoBalanceElement = document.getElementById("criptoBalance");
        const tokenBalanceElement = document.getElementById("tokenBalance");
        if (criptoBalanceElement) {
            const cripto = parseFloat(userDataResolved.cripto_balance || 0);
            criptoBalanceElement.value = cripto.toFixed(2);
        }
        if (tokenBalanceElement) {
            const token = parseFloat(userDataResolved.token_balance || 0);
            tokenBalanceElement.value = token.toFixed(2);
        }

        // 4. Atualiza contadores da UI
        const elementosUI = {
            "quantityVasos": quantityVasos > 0 ? `${quantityVasos}/100` : "0/100",
            "quantityAgua": quantityRegador.toString(),
            "quantityFertilize": quantityFertilizante.toString(),
            "quantityAntiParasita": quantityAntiParasita.toString(),
            "quantityStar": quantityStar > 0 ? `${quantityStar}/100` : "0/100"
        };
        
        Object.entries(elementosUI).forEach(([elementId, valor]) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.value = valor;
            }
        });

        // 5. Busca plant_time das NOVAS TABELAS (✅ UMA VEZ SÓ)
        const plantTimes = await checkPlantTime(resolvedWalletAddress);
        userDataResolved.plant_time = plantTimes;
        
        // 6. Salva dados globais PRIMEIRO
        window.userData = userDataResolved;
        
        // 7. Atualiza o board de jogo e eventos
        updatePlayBoard(quantityVasos);
        attachSlotClickEvents(quantityVasos);
        
        // 8. ✅ CORREÇÃO: Chama UpdateTime em vez das funções antigas
        await UpdateTime(userDataResolved);

        // 9. Atualiza os itens da loja na UI
        
        if (Array.isArray(userDataResolved.items)) {
            userDataResolved.items.forEach((item, index) => {
                const slotIndex = index + 1;
                const titleElement = document.querySelector(`#titleShopSlot${slotIndex} h1`);
                const imgElement = document.querySelector(`#imgSlotShop${slotIndex}`);
                const priceElement = document.querySelector(`#priceSlotShop${slotIndex}`);
                const slotElement = document.querySelector(`#titleShopSlot${slotIndex}`);

                if (titleElement) titleElement.textContent = item.itemNome;
                if (imgElement) imgElement.src = `img/shop/${item.itemId}.png`;
                if (priceElement) priceElement.textContent = item.price || "0.00";
                if (slotElement) {
                    const raridadeVar = raridadeClasses[item.raridade] || "--incomun-color";
                    slotElement.style.backgroundColor = `var(${raridadeVar})`;
                    if (item.raridade === "7") {
                        titleElement.style.color = `var(--txt-text)`;
                    }
                }
            });
        }

        // 10. Atualiza inventário visual (slots)
        const itemMap = {
            "Vaso": "quantityVasos",
            "Regador": "quantityAgua", 
            "Fertilizante": "quantityFertilize",
            "Anti-Parasitas": "quantityAntiParasita",
            "Estrela": "quantityStar",
        };

        const remainingItems = userDataResolved.inventario.filter(item => {
            const [itemNome] = item.split(":");
            return !itemMap[itemNome.trim()];
        });

        remainingItems.forEach((item, index) => {
            const [itemNome, quantidade] = item.split(":").map(x => x.trim());
            const matchingItem = Array.isArray(userDataResolved.items)
                ? userDataResolved.items.find(i => i.itemNome === itemNome)
                : null;
            if (!matchingItem) return;

            const slotIndex = index + 1;
            const titleElement = document.querySelector(`#titleInvetorySlot${slotIndex}`);
            const imgElement = document.querySelector(`#imgSlotInventory${slotIndex}`);
            const quantityElement = document.querySelector(`#quantityItemInventory${slotIndex}`);

            if (titleElement) {
                titleElement.textContent = itemNome;
                titleElement.style.backgroundColor = `var(${raridadeClasses[matchingItem.raridade]})`;
                if (matchingItem.raridade === "7") {
                    titleElement.style.color = `var(--txt-text)`;
                }
            }
            if (imgElement) imgElement.src = `img/shop/${matchingItem.itemId}.png`;
            if (quantityElement) quantityElement.textContent = quantidade;
        });

        // 11. Reseta slots vazios
        // const plantTimeSlots = plantTimes.map(p => Number(p.slotID));
        for (let slotID = 1; slotID <= quantityVasos; slotID++) {
            const plantObj = plantTimes.find(p => Number(p.slotID) === slotID);
            const isSlotVazio = !plantObj || !plantObj.itemId || !plantObj.itemNome;
            
            if (isSlotVazio) {
                const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
                const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);
                const plantNameElement = document.getElementById(`plantName${slotID}`);
                const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
                
                if (vasoPhotoElement) vasoPhotoElement.src = "/img/play/0.png";
                if (plantPhotoElement) plantPhotoElement.style.display = "none";
                if (plantNameElement) plantNameElement.innerText = "Vazio";
                if (plantTimerElement) plantTimerElement.innerText = "";
            }
        }

        // ✅ KILL-SWITCH: Reabre menu de utilitários se estava ativo antes da atualização
        if (isPlayUtilitarioActive) {
            setTimeout(() => {
                mostrarInventarioUtilitarios();
            }, 100);
        }

        return true;
        
    } catch (error) {
        console.error("Erro ao carregar e atualizar UI:", error);
        return false;
    }
}

/**
 * Atualiza o tempo restante e seta foto da planta do vaso/planta
 * Atualiza o progresso visual do vaso e planta
 * Atualiza o contador de tempo restante
 * Atualiza o nome e a cor do título da planta
 * Atualiza o texto do timer conforme o estado da planta
 * @param {Object} userData - Os dados do usuário
 * @returns {Promise<boolean>} - Retorna true se a atualização for bem-sucedida, caso contrário false
 */ 

export async function UpdateTime(userData) {
    try {
        // Valida userData
        const resolvedUserData = userData || window.userData;
        if (!resolvedUserData) {
            console.warn("UpdateTime: Nenhum userData disponível");
            return;
        }

        // Verifica se o playGameBoard está visível
        const playGameBoard = document.getElementById("playGameBoard");
        if (!playGameBoard || playGameBoard.style.display !== "flex") {
            console.log("UpdateTime: Play board não está visível");
            return;
        }

        // Extrai plant_time
        const plantTimes = parseUserPlantTime(resolvedUserData.plant_time);
        if (!Array.isArray(plantTimes) || plantTimes.length === 0) {
            console.log("UpdateTime: Nenhuma planta encontrada");
            return;
        }


        console.log("UpdateTime: Atualizando", plantTimes.length, "plantas");

        // Limpa intervals anteriores
        if (activeIntervals) {
            Object.values(activeIntervals).forEach(interval => {
                if (interval) clearInterval(interval);
            });
        }

        // Função para atualizar cada contador individualmente
        const updatePlantCounter = (plant) => {
            const { slotID, itemNome, itemId, raridade, plantDate, harvestDate, growthStatus, status } = plant;
            // console.log('ESTRUTURA COMPLETA DO PLANT:', JSON.stringify(plant, null, 2));
    
            // Valida dados da planta
            if (!growthStatus) {
                console.warn(`Slot ${slotID}: growthStatus não encontrado`);
                return;
            }

            // Seleciona elementos do DOM
            const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
            const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);
            const plantNameElement = document.getElementById(`plantName${slotID}`);
            const plantSlotNameElement = document.getElementById(`plantSlotName${slotID}`);
            
            // Adiciona o data-translate dinamicamente
            plantNameElement.setAttribute('data-translate', itemNome);
            
            updateAllTexts(); // Atualiza o texto traduzido
            
            if (!plantTimerElement || !plantPhotoElement || !plantNameElement || !plantSlotNameElement) {
                console.warn(`UpdateTime: Elementos do slot ${slotID} não encontrados`);
                return;
            }

            // Configura nome e cor
            plantNameElement.innerText = itemNome;
            const raridadeVar = raridadeClasses[raridade] || "--incomun-color";
            plantSlotNameElement.style.backgroundColor = `var(${raridadeVar})`;

            // Atualiza a imagem inicial
            plantPhotoElement.style.display = "none";
            plantPhotoElement.src = `/img/plant/${itemId}.png`;

            // Status da planta
            const isParasita = growthStatus.isParasita;
            const isWatered = growthStatus.isWatered;
            const isFertilized = growthStatus.isFertilized;
            const elapsedTime = growthStatus.elapsedTime;
            const totalTime = growthStatus.totalTime;

            // ✅ CORREÇÃO: Verificação de pausa
            const isPaused = status === "paused" || (isParasita && elapsedTime > 0);

            // Limpa interval anterior para este slot
            if (activeIntervals[slotID]) {
                clearInterval(activeIntervals[slotID]);
            }

            // ✅ CORREÇÃO: Lógica separada para plantas PAUSADAS
            if (isPaused) {
                console.log(`Slot ${slotID}: Configurando planta PAUSADA - elapsed_time: ${elapsedTime}, total_time: ${totalTime}`);
                
                // Para plantas pausadas, calculamos o progresso baseado no elapsed_time do banco
                const progressPaused = Math.min(elapsedTime / totalTime, 1);

                console.log(`Slot ${slotID}: Progresso na pausa = ${(progressPaused * 100).toFixed(1)}%`);

                // Para plantas pausadas (com parasita), mantém os sprites corretos
                const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
                if (vasoPhotoElement) {
                    if (isFertilized) {
                        // Fertilizadas mantêm o sprite verde
                        vasoPhotoElement.src = "/img/play/002.png";
                        plantPhotoElement.style.display = "block";
                    } else {
                        // Não fertilizadas: sprite baseado no progresso congelado
                        if (progressPaused >= 0.5) {
                            vasoPhotoElement.src = "/img/play/02.png";
                            plantPhotoElement.style.display = "block";
                        } else if (progressPaused >= 0.1) {
                            vasoPhotoElement.src = "/img/play/01.png";
                            plantPhotoElement.style.display = "none";
                        } else {
                            vasoPhotoElement.src = "/img/play/0.png";
                            plantPhotoElement.style.display = "none";
                        }
                    }
                }
                
                // Timer mostra mensagem de parasita
                plantTimerElement.innerText = "Vaso com parasitas";
                
                // Não cria interval para plantas pausadas
                return;
            }

            // ✅ LÓGICA ORIGINAL apenas para plantas NÃO pausadas
            // Calcula timestamps e durações (apenas para plantas não pausadas)
            const harvestTimestamp = new Date(harvestDate).getTime();
            const plantTimestamp = new Date(plantDate).getTime();
            const fullGrowDuration = harvestTimestamp - plantTimestamp;


            // Função para atualizar o progresso e o timer
            const updateProgress = () => {
                const currentTimestamp = Date.now();
                const timeElapsed = currentTimestamp - plantTimestamp;
                const progress = Math.min(timeElapsed / fullGrowDuration, 1);
                const timeRemaining = harvestTimestamp - currentTimestamp;

                // Define os estágios de sprite
                const spriteInicial = 0.10; // 10% para o primeiro estágio Mudinha
                const spriteFinal = 0.50; // 50% para o estágio final Planta Crescida



                // Tempo igual ou maior que o tempo de colheita
                if (progress >= 1 || timeRemaining <= 0 ) {
                    console.log(`Slot ${slotID}: Planta pronta para colheita`);
                    plantPhotoElement.style.display = "block";
                    const vasoElement = document.getElementById(`vasoPhoto${slotID}`);
                    if (vasoElement) {
                        vasoElement.src = isFertilized ? "/img/play/002.png" : "/img/play/02.png";
                    }
                    
                    // Atualiza o texto do timer
                    plantTimerElement.innerText = "Pronta para colheita!";

                    // Caso tenha parasita mude o texto
                    if (isParasita) {
                        plantTimerElement.innerText = "Vaso com parasitas";
                    }
                    
                    if (activeIntervals[slotID]) {
                        clearInterval(activeIntervals[slotID]);
                        delete activeIntervals[slotID];
                    }
                } else {
                    // Planta ainda em crescimento
                    const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
                    if (!vasoPhotoElement) return;

                    
                    if (isFertilized) {
                        // FERTILIZADA: Mostra instantaneamente
                        plantPhotoElement.style.display = "block";
                        vasoPhotoElement.src = "/img/play/002.png";
                        
                        // Atualiza contador mesmo quando fertilizada
                        if (isParasita) {
                            plantTimerElement.innerText = "Vaso com parasitas";
                        } else if (!isWatered) {
                            plantTimerElement.innerText = "Precisa de água";
                        } else {
                            const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
                            
                            if (days > 0) {
                                plantTimerElement.innerText = `${days}d ${hours}h ${minutes}m`;
                            } else if (hours > 0) {
                                plantTimerElement.innerText = `${hours}h ${minutes}m ${seconds}s`;
                            } else {
                                plantTimerElement.innerText = `${minutes}m ${seconds}s`;
                            }
                        }
                    } else {
                        // NORMAL: Progressão gradual
                        if (progress >= spriteFinal) {
                            vasoPhotoElement.src = "/img/play/02.png";
                        } else if (progress >= spriteInicial) {
                            vasoPhotoElement.src = "/img/play/01.png";
                        } else {
                            vasoPhotoElement.src = "/img/play/0.png";
                        }

                        plantPhotoElement.style.display = progress >= spriteFinal ? "block" : "none";

                        // Atualiza contador
                        if (isParasita) {
                            plantTimerElement.innerText = "Vaso com parasitas";
                        } else if (!isWatered) {
                            plantTimerElement.innerText = "Precisa de água";
                        } else {
                            const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
                            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
                            
                            if (days > 0) {
                                plantTimerElement.innerText = `${days}d ${hours}h ${minutes}m`;
                            } else if (hours > 0) {
                                plantTimerElement.innerText = `${hours}h ${minutes}m ${seconds}s`;
                            } else {
                                plantTimerElement.innerText = `${minutes}m ${seconds}s`;
                            }
                        }
                    }
                }
            };


            updateProgress();
            activeIntervals[slotID] = setInterval(updateProgress, 1000);
        };

        plantTimes.forEach(updatePlantCounter);

        console.log("UpdateTime: Concluído com sucesso");

    } catch (error) {
        console.error("Erro ao atualizar os timers das plantas:", error);
    }
}




// Atualiza a UI quando a wallet está conectada
export function updateUIForConnectedWallet(wallet) {
    const top = document.getElementById("top");
    const down = document.getElementById("down");
    const middle = document.getElementById("middle");
    const walletModal = document.getElementById("walletModal");

    top.style.display = "flex";
    down.style.display = "flex";
    walletModal.style.display = "none";
    middle.style.height = "100%";
    walletModal.style.height = "559px";

    tradeModal.style.display = "flex";
     playOpen();
    // tradeOpen();
    // inventoryOpen(); // debug inventario
    // configOpen();
    // tradeOpen(); // debug trade
    
    // tradeSwapOpen();
    // tradeHistoricoOpen();
    // tradeHistoricoDepositOpen();
    //tradeHistoricoSaqueOpen();

}

// Atualiza a UI quando a wallet está desconectada
export function updateUIForDisconnectedWallet() {
    const top = document.getElementById("top");
    const down = document.getElementById("down");
    const middle = document.getElementById("middle");
    const walletModal = document.getElementById("walletModal");
    const playModal = document.getElementById("playModal");
    const startScreen = document.getElementById("startScreen");

    top.style.display = "none";
    down.style.display = "none";
    walletModal.style.display = "flex";
    middle.style.height = "86%";
    // walletModal.style.height = "86vh";
    playModal.style.display = "flex";
}

// Função para limpar um slot do inventário
export function limparSlot(slotIndex) {
    const titleElement = document.querySelector(`#titleInvetorySlot${slotIndex}`);
    const imgElement = document.querySelector(`#imgSlotInventory${slotIndex}`);
    const quantityElement = document.querySelector(`#quantityItemInventory${slotIndex}`);

    if (titleElement) titleElement.textContent = "";
    if (titleElement) titleElement.style.backgroundColor = "var(--incomun-color)";
    if (imgElement) imgElement.src = "";
    if (quantityElement) quantityElement.textContent = "";
}

// Função para atualizar um slot com um item específico
export function atualizarSlot(slotIndex, nome, imagemId, quantidade) {
    const titleElement = document.querySelector(`#titleInvetorySlot${slotIndex}`);
    const imgElement = document.querySelector(`#imgSlotInventory${slotIndex}`);
    const quantityElement = document.querySelector(`#quantityItemInventory${slotIndex}`);
    


    if (titleElement) titleElement.textContent = nome;
    if (titleElement) titleElement.style.backgroundColor = "var(--incomun-color)";
    if (imgElement) imgElement.src = `img/shop/${imagemId}.png`;
    if (quantityElement) quantityElement.textContent = quantidade;
}





// Força update sempre apos o evento de autoUpdate
export function autoUpdate() {
    const agora = new Date();
    const segundos = agora.getSeconds();
    const delay = (60 - segundos) * 1000 + 1000; // 3600 = 1h + 10s de margem

    setTimeout(() => {
        UpdateUI(walletAddress); // Sua função de atualização
        autoUpdate(); // Reagenda o próximo update
    }, delay);
}










