import { 
    playOpen,
    showPlantModal,
    tradeOpen,
    // inventoryOpen,
    isPlayGameBoardActive
} from './modal-hook.js';

import {
    verifyAndCollectSeed,
    attachSlotClickEvents
} from '../index.js';

// import {
//     soundInspectPlant
// } from './sound.js';

import { 
    fetchItems,
    updatePlayerStatus
} from '../api.js';

import {
    getWalletAddress
} from '../web3/walletConnect.js';

let walletAddress = getWalletAddress();
const activeIntervals = {}; // Temporazidores
const activePlantIntervals = {}; // Planta Update UI/Crescimento
const input = document.querySelector(".coinNumber input");


export async function carregarDadosDoJogador(walletAddress) {
    try {
        if (!walletAddress) {
            walletAddress = getWalletAddress();
        }

        if (!walletAddress) {
            console.error("Endereço da wallet não encontrado.");
            return false;
        }

        const userData = await updatePlayerStatus(walletAddress);
        const items = await fetchItems();

        if (!userData || !items) {
            console.error("Erro ao obter dados do jogador ou da loja.");
            return false;
        }

        userData.items = items;
        window.userData = userData;
        // Salva quantidade de vasos e estrelas globalmente
        let quantityVasos = 0;
        let quantityStar = 0;
        userData.inventario?.forEach(item => {
            const [itemNome, quantidade] = item.split(":").map(x => x.trim());
            if (itemNome === "Vaso") quantityVasos = parseInt(quantidade) || 0;
            if (itemNome === "Estrela") quantityStar = parseInt(quantidade) || 0;
        });
        window.quantityVasos = quantityVasos;
        window.quantityStar = quantityStar;

        return true;
    } catch (err) {
        console.error("Erro ao carregar dados do jogador:", err);
        return false;
    }
}


export function atualizarUIComDadosLocais() {
    const userData = window.userData;
    if (!userData) {
        console.warn("Sem dados locais encontrados.");
        return;
    }

    // Atualiza os saldos
    const criptoBalanceElement = document.getElementById("criptoBalance");
    const tokenBalanceElement = document.getElementById("tokenBalance");
    if (criptoBalanceElement) criptoBalanceElement.value = userData.criptoBalance || "0.00";
    if (tokenBalanceElement) tokenBalanceElement.value = userData.tokenBalance || "0.00";

    // Atualiza inventário (quantidades)
    const itemMap = {
        "Vaso": "quantityVasos",
        "Regador": "quantityAgua",
        "Fertilizante": "quantityFertilize",
        "Anti-Parasitas": "quantityAntiParasita",
        "Estrela": "quantityStar",
    };

    userData.inventario?.forEach(item => {
        const [itemNome, quantidade] = item.split(":").map(x => x.trim());
        const elementId = itemMap[itemNome];
        const element = document.getElementById(elementId);
        if (element) {
            element.value = (itemNome === "Vaso" || itemNome === "Estrela")
                ? `${quantidade}/100` : quantidade || "0";
        }
    });

    // Atualiza loja e UI visual
    updatePlayBoard(window.quantityVasos || 0);
    attachSlotClickEvents(window.quantityVasos || 0);
    updateVasosUI(userData);
    updateVasoAndPlantImages(userData.walletAddress);

    // Atualiza os itens da loja na UI
    const raridadeClasses = {
        1: "--incomun-color",
        2: "--comun-color",
        3: "--raro-color",
        4: "--epico-color",
        5: "--lendario-color",
        6: "--mitico-color",
        7: "--desconhecido-color"
    };
    // Corrige: só faz o forEach se items existir e for array
    if (Array.isArray(userData.items)) {
        userData.items.forEach((item, index) => {
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

    // Atualiza inventário visual (slots)
    // Corrige: só faz o filter/map se items existir e for array
    const remainingItems = Array.isArray(userData.inventario)
        ? userData.inventario.filter(item => {
            const [itemNome] = item.split(":");
            return !itemMap[itemNome.trim()];
        })
        : [];

    remainingItems.forEach((item, index) => {
        const [itemNome, quantidade] = item.split(":").map(x => x.trim());
        // Corrige: só faz find se items existir e for array
        const matchingItem = Array.isArray(userData.items)
            ? userData.items.find(i => i.itemNome === itemNome)
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

    // --- CORREÇÃO DO SPRITE DO VASO APÓS COLHER (slot a slot) ---
    // Reseta apenas os slots que não estão em uso (não presentes em plantTime)
    const plantTimeSlots = Array.isArray(userData.plantTime)
        ? userData.plantTime.map(p => Number(p.slotID))
        : [];
    for (let slotID = 1; slotID <= (window.quantityVasos || 0); slotID++) {
        // Aqui, além de verificar se o slotID não está em plantTime,
        // também verifica se existe um objeto plantTime "vazio" (sem itemId ou itemNome)
        const plantObj = Array.isArray(userData.plantTime)
            ? userData.plantTime.find(p => Number(p.slotID) === slotID)
            : null;
        const isSlotVazio = !plantObj || !plantObj.itemId || !plantObj.itemNome;
        if (!plantTimeSlots.includes(slotID) || isSlotVazio) {
            const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
            const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);
            const plantNameElement = document.getElementById(`plantName${slotID}`);
            if (vasoPhotoElement) vasoPhotoElement.src = "/img/play/0.png";
            if (plantPhotoElement) plantPhotoElement.style.display = "none";
            if (plantNameElement) plantNameElement.innerText = "Vazio";
        }
    }
}




// Atualizar UI (Contadores, Inventário e Loja)
export function updateUIAndInventory() {
    const userData = window.userData;
    if (!userData) {
        console.warn("Sem dados locais encontrados.");
        return;
    }

    // Atualiza os saldos
    const criptoBalanceElement = document.getElementById("criptoBalance");
    const tokenBalanceElement = document.getElementById("tokenBalance");
    if (criptoBalanceElement) criptoBalanceElement.value = userData.criptoBalance || "0.00";
    if (tokenBalanceElement) tokenBalanceElement.value = userData.tokenBalance || "0.00";

    // Atualiza inventário (quantidades)
    const itemMap = {
        "Vaso": "quantityVasos",
        "Regador": "quantityAgua",
        "Fertilizante": "quantityFertilize",
        "Anti-Parasitas": "quantityAntiParasita",
        "Estrela": "quantityStar",
    };

    userData.inventario?.forEach(item => {
        const [itemNome, quantidade] = item.split(":").map(x => x.trim());
        const elementId = itemMap[itemNome];
        const element = document.getElementById(elementId);
        if (element) {
            element.value = (itemNome === "Vaso" || itemNome === "Estrela")
                ? `${quantidade}/100` : quantidade || "0";
        }
    });

    // Atualiza loja e UI visual
    updatePlayBoard(window.quantityVasos || 0);
    attachSlotClickEvents(window.quantityVasos || 0);
    updateVasosUI(userData);

    // Atualiza os itens da loja na UI
    const raridadeClasses = {
        1: "--incomun-color",
        2: "--comun-color",
        3: "--raro-color",
        4: "--epico-color",
        5: "--lendario-color",
        6: "--mitico-color",
        7: "--desconhecido-color"
    };
    // Corrige: só faz o forEach se items existir e for array
    if (Array.isArray(userData.items)) {
        userData.items.forEach((item, index) => {
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

    // Atualiza inventário visual (slots)
    // Corrige: só faz o filter/map se items existir e for array
    const remainingItems = Array.isArray(userData.inventario)
        ? userData.inventario.filter(item => {
            const [itemNome] = item.split(":");
            return !itemMap[itemNome.trim()];
        })
        : [];

    remainingItems.forEach((item, index) => {
        const [itemNome, quantidade] = item.split(":").map(x => x.trim());
        // Corrige: só faz find se items existir e for array
        const matchingItem = Array.isArray(userData.items)
            ? userData.items.find(i => i.itemNome === itemNome)
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
}

// Atualizar dinamicamente a quantidade de paginas com base no numero de vasos do jogaor
export function updatePlayBoard(quantityVasos) {
    const boardContainer = document.getElementById("gameBoardFarm");
    boardContainer.innerHTML = ""; // Limpa os slots existentes

    const slotsPerPage = 4; // Cada página contém exatamente 4 slots (grid 2x2)
    let totalPages = Math.ceil(quantityVasos / slotsPerPage) || 1; // Garante pelo menos uma página

    let slotIndex = 1; // Índice global para os slots

    for (let i = 0; i < totalPages; i++) {
        const pageContainer = document.createElement("div");
        pageContainer.classList.add("pageContainer");
        pageContainer.style.display = i === 0 ? "flex" : "none"; // Exibe a primeira página e oculta as outras

        const vasosLayout = document.createElement("div");
        vasosLayout.classList.add("vasosLayout", "grid"); // Usando grid para manter 2x2

        for (let j = 0; j < slotsPerPage; j++) { // Criando os 4 slots da página
            const slot = document.createElement("div");
            slot.classList.add("slotVasos", "column");
            slot.id = `slotVasos${slotIndex}`;

            const plantSlot = document.createElement("div");
            plantSlot.classList.add("plantSlot");
            plantSlot.id = `plantSlot${slotIndex}`;

            // Estrutura para plantName, seguindo o exemplo do site
            const plantName = document.createElement("div");
            plantName.classList.add("plantName");
            plantName.id = `plantSlotName${slotIndex}`; // Atribuindo o id único plantSlotName{slotID}

            // Aqui, atribuímos o ID de plantSlotName corretamente para seguir o modelo do seu site
            plantName.innerHTML = `<h1 id="plantName${slotIndex}">Vazio</h1>`;

            const slotPhoto = document.createElement("div");
            slotPhoto.classList.add("slotPhoto");

            // Criando a imagem do vaso
            const vasoPhoto = document.createElement("img");
            vasoPhoto.classList.add("vasoPhoto", "pointer2");
            vasoPhoto.id = `vasoPhoto${slotIndex}`;
            vasoPhoto.src = slotIndex <= quantityVasos ? "/img/play/0.png" : "/img/play/x.png"; // Mostra o vaso se o slot for desbloqueado

            // Criando a imagem da planta
            const plantPhoto = document.createElement("img");
            plantPhoto.style.display = "none";
            plantPhoto.classList.add("plantPhoto", "pointer2");
            plantPhoto.id = `plantPhoto${slotIndex}`;
            plantPhoto.src = "/img/plant/0.png"; // Sempre placeholder

            // Adiciona as imagens ao slotPhoto
            slotPhoto.appendChild(plantPhoto);
            slotPhoto.appendChild(vasoPhoto);

            const plantTimer = document.createElement("div");
            plantTimer.classList.add("plantTimer");
            plantTimer.id = `plantTimer${slotIndex}`;


            // Montando o slot
            plantSlot.appendChild(plantName); // Adicionando o plantSlotName ao plantSlot
            plantSlot.appendChild(slotPhoto); // Adiciona as fotos da planta e do vaso
            slot.appendChild(plantSlot); // Adiciona o plantSlot ao slot
            slot.appendChild(plantTimer); // Adiciona o timer da planta ao slot
            vasosLayout.appendChild(slot); // Adiciona o slot ao layout

            // Se o slotIndex for maior que quantityVasos, bloqueia o slot
            if (slotIndex > quantityVasos) {
                slot.classList.add("lockedSlot"); // Marca o slot como bloqueado
            }

            slotIndex++; // Incrementa o índice global dos slots
        }

        pageContainer.appendChild(vasosLayout);
        boardContainer.appendChild(pageContainer);
    }

    // Chama a função setupPagination para garantir a navegação entre as páginas
    setTimeout(() => {
        setupPagination("playGameBoard", "playArrowNextGame", "playArrowLastGame", ".pageContainer", 1);
    }, 100); // Pequeno delay para garantir que os slots sejam renderizados antes da paginação
}

// Atualiza tempo restante e seta foto da planta do vaso
export async function updateVasosUI(userData) {
    try {
        walletAddress = walletAddress || localStorage.getItem("walletAddress");

        // Verifica se userData está definido
        if (!userData || !userData.walletAddress) {
            return;
        }
        // Verifica se o estilo do elemento playGameBoard é flex
        const playGameBoard = document.getElementById("playGameBoard");
        if (!playGameBoard || playGameBoard.style.display !== "flex" || !isPlayGameBoardActive) {
            return;
        }

        const plantTimes = userData.plantTime;
        if (!Array.isArray(plantTimes) || plantTimes.length === 0) {
            // console.warn("Nenhum tempo de plantio encontrado.");
            return;
        }
        
        // Define activeIntervals se não existir
        if (typeof activeIntervals === 'undefined') {
            window.activeIntervals = {};
        }
        
        // Função para atualizar o contador e adicionar o evento de clique

        const updatePlantCounter = (slotID, plant) => {
            const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
            if (!plantTimerElement) return;

            // Remove event listener anterior (evita duplicação)
            plantTimerElement.onclick = null;

            // Pega os valores corretos dentro de growthStatus
            const isWater = plant.growthStatus?.isWatered;
            const isProtect = plant.growthStatus?.isProtected;
            const isFertilized = plant.growthStatus?.isFertilized;
            const isParasita = plant.growthStatus?.isParasita;
            const harvestDate = plant.harvestDate;

            // Pega o timestamp da data de colheita
            const harvestTimestamp = (harvestDate._seconds * 1000) + (harvestDate._nanoseconds / 1000000);

            // Corrigido: timestamp atualizado no clique
            plantTimerElement.addEventListener("click", async () => {
                const currentTimestamp = Date.now(); // <-- Atualiza aqui!
                if (isWater && !isParasita && currentTimestamp >= harvestTimestamp) {
                    walletAddress = walletAddress || localStorage.getItem("walletAddress");
                    if (!walletAddress) {
                        console.error("Erro: walletAddress não disponível. Usuário precisa estar logado.");
                        return;
                    }
                    try {
                        await onColherPlanta(walletAddress, slotID);
                        plantTimerElement.innerText = "Colhido!";
                        clearInterval(activeIntervals[slotID]);
                        delete activeIntervals[slotID];
                    } catch (error) {
                        console.error("Erro ao coletar planta:", error);
                    }
                } else {
                    if (!isWater) {
                        const confirmMessage = `Slot ${slotID} precisa ser regado para começar a crescer.`;
                        const plantModal = await showPlantModal(confirmMessage);
                    } else if (isParasita) {
                        const confirmMessage = `Slot ${slotID} está com Parasitas. Remova para continuar o crescimento.`;

                        // Calcula o tempo restante pausa
                        const pause = plant.growthStatus.pause;
                        const totalTime = pause.totalTime || plant.growthStatus.totalTime || 0; // ms
                        const elapsedBeforePause = pause.elapsedBeforePause || 0; // ms

                        let tempoRestanteMs = totalTime - elapsedBeforePause;
                        if (tempoRestanteMs < 0) tempoRestanteMs = 0;

                        // Converter para minutos e segundos
                        const minutos = Math.floor(tempoRestanteMs / 60000);
                        const segundos = Math.floor((tempoRestanteMs % 60000) / 1000);
                        const tempoRestanteStr = `${minutos}m ${segundos}s`;



                        // Cria o modal manualmente com botão extra
                        const plantModal = await showPlantModal(confirmMessage, {
                            showRemoveParasita: true,
                            slotID: slotID,
                            tempoRestante: tempoRestanteStr,
                            onRemoveParasita: async () => {

                                // Atualize a UI após remover
                                // await atualizarDadosLocaisAposAcao(walletAddress);
                            }
                        });
                    } else {
                        const confirmMessage = `Slot ${slotID} ainda não está pronto para colher.`;
                        const plantModal = await showPlantModal(confirmMessage);
                    }
                }
            });

            // Se já existir um contador para esse slot, limpa antes de criar um novo
            if (activeIntervals[slotID]) {
                clearInterval(activeIntervals[slotID]);
            }

            activeIntervals[slotID] = setInterval(() => {
                const currentTimestamp = Date.now();

                if (!isWater) {
                    plantTimerElement.innerText = "Precisa de água";
                    return;
                }

                if (isParasita) {
                    plantTimerElement.innerText = "Vaso com parasitas";
                    return;
                }

                const timeRemaining = harvestTimestamp - currentTimestamp;
                if (timeRemaining <= 0) {
                    plantTimerElement.innerText = "Pronto para Colher";
                    clearInterval(activeIntervals[slotID]);
                    delete activeIntervals[slotID];
                } else {
                    const secondsRemaining = Math.floor((timeRemaining / 1000) % 60);
                    const minutesRemaining = Math.floor((timeRemaining / 1000 / 60) % 60);
                    const hoursRemaining = Math.floor((timeRemaining / 1000 / 60 / 60) % 24);
                    const daysRemaining = Math.floor(timeRemaining / 1000 / 60 / 60 / 24);
                    let timeString = "";
                    if (daysRemaining > 0) timeString += `${daysRemaining}d `;
                    if (hoursRemaining > 0 || daysRemaining > 0) timeString += `${hoursRemaining}h `;
                    if (minutesRemaining > 0 || hoursRemaining > 0 || daysRemaining > 0) timeString += `${minutesRemaining}m `;
                    timeString += `${secondsRemaining}s`;
                    plantTimerElement.innerText = timeString;
                }
            }, 1000);
        };


        for (const plant of plantTimes) {
            const { slotID, itemNome, itemId, raridade } = plant;
            if (!itemId) {
                console.warn(`itemId não encontrado para a planta no slot ${slotID}.`);
                continue;
            }
            
            updatePlantCounter(slotID, plant);
            
            const plantNameElement = document.getElementById(`plantName${slotID}`);
            if (plantNameElement) {
                plantNameElement.innerText = itemNome;
            }
            
            const raridadeClasses = {
                1: "--incomun-color",
                2: "--comun-color",
                3: "--raro-color",
                4: "--epico-color",
                5: "--lendario-color",
                6: "--mitico-color",
                7: "--desconhecido-color"
            };
            
            const raridadeVar = raridadeClasses[raridade] || "--incomun-color";
            const plantSlotNameElement = document.getElementById(`plantSlotName${slotID}`);
            if (plantSlotNameElement) {
                plantSlotNameElement.style.backgroundColor = `var(${raridadeVar})`;
            }
            
            const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);
            if (plantPhotoElement) {
                plantPhotoElement.style.display = `none`;
                plantPhotoElement.src = `/img/plant/${itemId}.png`;
            }
        }
    } catch (error) {
        console.error("Erro ao atualizar os timers das plantas:", error);
    }
}

// Função para atualizar os vasos e plantas conforme o tempo
export const updateVasoAndPlantImages = (walletAddress) => {
    // Usa window.userData ao invés de chamar updatePlayerStatus
    const userStatus = window.userData;
    if (!userStatus || !userStatus.plantTime || userStatus.plantTime.length === 0) {
        // console.warn("Nenhuma planta ativa encontrada para o jogador.");
        return;
    }

    userStatus.plantTime.forEach((plant) => {
        const { slotID, plantDate, harvestDate, itemTime, growthStatus } = plant;
        if (!slotID || !plantDate || !harvestDate || !itemTime) {
            console.warn(`Dados incompletos para o slot ${slotID}, pulando...`);
            return;
        }

        if (!growthStatus) {
            console.warn(`GrowthStatus ausente para o slot ${slotID}.`);
            return;
        }

        const isFertilized = growthStatus?.isFertilized || false;

        const harvestTimestamp = (harvestDate._seconds * 1000) + (harvestDate._nanoseconds / 1000000);
        const plantTimestamp = (plantDate._seconds * 1000) + (plantDate._nanoseconds / 1000000);
        const fullGrowDuration = harvestTimestamp - plantTimestamp;

        if (activePlantIntervals[slotID]) {
            clearInterval(activePlantIntervals[slotID]);
        }

        const updateProgress = () => {
            const currentTimestamp = Date.now();
            const timeElapsed = currentTimestamp - plantTimestamp;
            const progress = Math.min(timeElapsed / fullGrowDuration, 1); // Valor de 0 a 1

            const spriteInicial = 0.10;
            const spriteFinal = 0.50;
            const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
            const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);

            if (!vasoPhotoElement || !plantPhotoElement) {
                console.warn(`Elementos do slot ${slotID} não encontrados.`);
                return;
            }

            if (progress >= 1) {
                // Planta completamente crescida
                vasoPhotoElement.src = isFertilized ? "/img/play/002.png" : "/img/play/02.png";
                plantPhotoElement.style.display = "block";
                clearInterval(activePlantIntervals[slotID]);
                delete activePlantIntervals[slotID];
            } else {
                // Atualizar vaso com base no progresso
                if (progress >= spriteFinal) {
                    vasoPhotoElement.src = isFertilized ? "/img/play/002.png" : "/img/play/02.png";
                } else if (progress >= spriteInicial) {
                    vasoPhotoElement.src = isFertilized ? "/img/play/001.png" : "/img/play/01.png";
                } else {
                    vasoPhotoElement.src = isFertilized ? "/img/play/00.png" : "/img/play/0.png";
                }

                plantPhotoElement.style.display = progress >= spriteFinal ? "block" : "none";
            }
        };

        updateProgress();
        activePlantIntervals[slotID] = setInterval(updateProgress, 1000);
    });
};


// Função para atualizar a exibição das linhas
export function updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage) {

    // Verifica se 'rows' está definido e se tem elementos
    if (!rows || rows.length === 0) {
        // console.error("Erro: Nenhum slot encontrado para exibição.");
        return;
    }

    rows.forEach(row => row.style.display = 'none'); // Esconde todos os slots

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    for (let i = startIndex; i < endIndex && i < rows.length; i++) {
        rows[i].style.display = 'flex'; // Exibe os slots da página atual
    }

    // Atualiza visibilidade das setas
    arrowLast.style.visibility = currentPage === 1 ? "hidden" : "visible";
    arrowNext.style.visibility = currentPage === totalPages ? "hidden" : "visible";
}

// Page Shop/Inventario/Game Dinamicos
export function setupPagination(modalId, arrowNextId, arrowLastId, rowClass, itemsPerPage) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Erro: Modal com ID ${modalId} não encontrado.`);
        return;
    }

    let currentPage = 1;
    const rows = document.querySelectorAll(rowClass);  // Seleciona as linhas (playInvetorySlots)

    if (!rows || rows.length === 0) {
        console.error(`Erro: Nenhum slot encontrado com a classe ${rowClass}.`);
        return;
    }

    const totalPages = Math.ceil(rows.length / itemsPerPage);  // Calcula o total de páginas
    const arrowNext = document.getElementById(arrowNextId);
    const arrowLast = document.getElementById(arrowLastId);
    


    // Inicializa o modal
    if (modal) {
        modal.style.display = "relative";
        modal.style.overflow = "hidden";
    }

    // Função para inicializar a exibição corretamente ao abrir o modal
    function initializePagination() {
        updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage);
    }

    // Aciona a inicialização quando o modal termina a transição
    if (modal) {
        modal.addEventListener('transitionend', initializePagination);
    }

    // Ações das setas de navegação
    if (arrowNext) {
        arrowNext.addEventListener("click", function () {
            if (currentPage < totalPages) {
                currentPage++;
                updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage);
            }
        });
    }

    if (arrowLast) {
        arrowLast.addEventListener("click", function () {
            if (currentPage > 1) {
                currentPage--;
                updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage);
            }
        });
    }

    // Inicializa a exibição do modal
    initializePagination();
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

// // Função para limpar um slot do inventário
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

/**
 * Atualiza os dados locais do usuário após uma operação de escrita no banco.
 * Use sempre que receber dados atualizados do back-end após comprar, plantar, colher, etc.
 */
export function atualizarDadosLocais(novoUserData) {
    if (!novoUserData) return;
    window.userData = novoUserData;
    // Atualiza quantidades globais
    let quantityVasos = 0;
    let quantityStar = 0;
    novoUserData.inventario?.forEach(item => {
        const [itemNome, quantidade] = item.split(":").map(x => x.trim());
        if (itemNome === "Vaso") quantityVasos = parseInt(quantidade) || 0;
        if (itemNome === "Estrela") quantityStar = parseInt(quantidade) || 0;
    });
    window.quantityVasos = quantityVasos;
    window.quantityStar = quantityStar;
    // Atualiza UI imediatamente
    atualizarUIComDadosLocais();
}

/**
 * Atualiza os dados locais após qualquer ação (plantar, colher, utilitário).
 * Chame esta função após o sucesso da ação, passando o walletAddress.
 */
export async function atualizarDadosLocaisAposAcao(walletAddress) {
    const novoUserData = await updatePlayerStatus(walletAddress);
    // Garante que userData.items sempre exista
    let items = [];
    try {
        items = await fetchItems();
    } catch (e) {
        console.error("Erro ao buscar itens da loja:", e);
    }
    if (novoUserData) {
        novoUserData.items = items;
        atualizarDadosLocais(novoUserData);
    }
}
window.atualizarDadosLocaisAposAcao = atualizarDadosLocaisAposAcao;

// Função para colher planta (corrige erro de referência e atualiza dados locais)
export async function onColherPlanta(walletAddress, slotID) {
    try {
        // Supondo que verifyAndCollectSeed retorna { success, userData }
        const resposta = await verifyAndCollectSeed(walletAddress, slotID);
        if (resposta && resposta.userData) {
            atualizarDadosLocais(resposta.userData);
        } else {
            // fallback: força atualização dos dados locais
            await atualizarDadosLocaisAposAcao(walletAddress);
        }
        // Remova o reset manual do sprite aqui!
        // A UI será atualizada corretamente por atualizarUIComDadosLocais
    } catch (error) {
        console.error("Erro ao coletar planta:", error);
    }
}

// Função para aplicar utilitário (regar, fertilizar, anti-parasitas)
export async function onAplicarUtilitario(walletAddress, slotID, tipoUtilitario, applyUtilityToPlant) {
    try {
        // apiFunc é a função que faz a chamada para o back-end (ex: regar, fertilizar, etc)
        const resposta = await applyUtilityToPlant(walletAddress, slotID, tipoUtilitario);
        if (resposta && resposta.userData) {
            atualizarDadosLocais(resposta.userData);
        } else {
            await atualizarDadosLocaisAposAcao(walletAddress);
        }
    } catch (error) {
        console.error("Erro ao aplicar utilitário:", error);
    }
}

// Força update sempre apos o evento de autoUpdate
export function autoUpdate() {
    const agora = new Date();
    const segundos = agora.getSeconds();
    const delay = (60 - segundos) * 1000 + 3000; // 3s de margem

    setTimeout(() => {
        atualizarDadosLocaisAposAcao(walletAddress); // Sua função de atualização
        setInterval(() => {
            atualizarDadosLocaisAposAcao(walletAddress);
        }, 60 * 1000); // Atualiza a cada minuto
    }, delay);
}

// Evento UI
window.addEventListener('updateUI', function (e) {
    updateDisplay();
    updateUIAndInventory();
    updatePlayBoard();
    updateVasosUI();
    updateVasoAndPlantImages();
});

// Evento Impedir modificação de input
input.addEventListener("input", function () {
    let value = input.value.replace(/\D/g, "");
    input.value = new Intl.NumberFormat("pt-BR").format(value);
});

// Variáveis para controlar timeouts das falas
let falaMascoteTimeouts = {};

export function typeMascoteTextFromHtml(elementId, falasArray, speed = 40, delayStart = 100) {
    if (!falasArray || !Array.isArray(falasArray) || falasArray.length === 0) return; // <-- proteção extra
    const el = document.getElementById(elementId);
    if (!el || el.offsetParent === null) return;

    // Limpa timeout anterior se existir
    if (falaMascoteTimeouts[elementId]) {
        clearTimeout(falaMascoteTimeouts[elementId]);
    }

    // Sempre sorteia uma fala, mesmo se não houver data-text
    let ultimaFala = el.dataset.text || "";
    let novaFala = ultimaFala;

    // Sorteia uma fala diferente da anterior, ou qualquer uma se não houver anterior
    if (falasArray.length > 1) {
        while (novaFala === ultimaFala) {
            novaFala = falasArray[Math.floor(Math.random() * falasArray.length)];
        }
    } else {
        novaFala = falasArray[0];
    }

    falaMascoteTimeouts[elementId] = setTimeout(() => {
        el.dataset.text = novaFala;
        el.textContent = "";

        let i = 0;
        function type() {
            if (i < novaFala.length) {
                el.textContent += novaFala.charAt(i);
                i++;
                falaMascoteTimeouts[elementId] = setTimeout(type, speed);
            }
        }
        type();
    }, delayStart);
}

// Arrays de falas
const falas = {
    falaMascoteTextPlanta: [
        "Deposite com sabedoria, jovem fazendeiro!",
        "Semeie seus sonhos aqui e colha recompensas mágicas!",
        "Use só carteiras oficiais e fique longe de links suspeitos!",
        "Guarde suas sementes... digo, chaves privadas com cuidado!",
        "É hora de florescer! Bora cultivar tokens e aventuras!",
        "Oiê! Lembre-se: não regue seus tokens com lágrimas, só com fé!",
        "Carteira fria é boa, carteira quente... só se for no verão!",
        "Já vi uma abelha cair em golpe. Imagina você sem atenção!",
        "Não confie em link suspeito. Nem em inseto com terno.",
        "Não compartilha sua seed nem se a borboleta pedir chorando!",
        "Fiquei offline um dia e virei adubo... se proteja, viu?",
        "Essa flor aqui já floresceu... agora quero ver você crescer!",
        "Seus tokens merecem amor e um lugar seguro. Tipo eu no vaso!"
    ],
    falaMascoteTextGnomo: [
        "Bem-vindo, jovem negociante. O ouro sorri para quem sabe negociar!",
        "Jamais confie em gnomos estranhos fora daqui. Só eu sou o banqueiro oficial!",
        "Desconfie de lucros fáceis. Se for bom demais, pode ser cilada, meu jovem.",
        "Verifique o contrato antes de assinar qualquer transação.",
        "O mercado pode ser cruel... mas comigo, você troca com sabedoria!",
        "Se prometer lucro fácil e não tiver barba... desconfie!",
        "Meu cofre é mais seguro que coração de ex: ninguém entra!",
        "Já vi gente trocando ouro por feijão. Não seja esse gnomo.",
        "Chave privada não é senha de Wi-Fi, jovem... guarda com zelo!",
        "A única mineração boa é a de tokens. A de carvão só suja a roupa!",
        "Prefere guardar tokens debaixo do colchão? Boa sorte com os ratos.",
        "Quer ganhar muito e rápido? Vai plantar florzinha, não token!",
        "Eu era um gnomo normal, até trocar tudo por um JPEG... viva os NFTs!"
    ],
    falaMascoteTextPlantaDeposit: [
        "Regou bem? Agora é hora de plantar seus tokens!",
        "Deposita direitinho que logo você vai florir fortuna!",
        "A terra tá fértil! Joga esses tokens aqui que eu cuido!",
        "Hmm… sinto o cheiro de uma boa colheita chegando!",
        "Você tá confiando em mim? Que fofura! Deposita aí 🌱",
        "Pode deixar comigo! Seu depósito tá em boas mãos e bolsos.",
        "Ahn… um depósito? Deixe-me conferir se é ouro de verdade!",
        "Ah, que beleza! Mais moedas para a montanha do gnomo!",
        "Dinheiro parado é dinheiro triste. Aqui ele rende!",
        "Confia no velho gnomo. Ele guarda melhor que cofre de banco!"
    ],
    falaMascoteTextGnomoSaque: [
        "Quer sacar, é? Só não gasta tudo em poções inúteis!",
        "Tá aqui seu saque. Mas ó… invista com sabedoria!",
        "Saque realizado! Mas lembra: guardar também é estratégia!",
        "Epa! Tá tirando moedas? Espero que saiba o que faz!",
        "Riqueza vai, riqueza vem... mas um gnomo sempre mantém!",
        "Olhaaa, já vai colher? Espero que seja suculento!",
        "Tira com jeitinho! Não puxa a raiz, só o token!",
        "A colheita foi boa, hein? Aproveita com sabedoria!",
        "Até parece mágica... planta token e colhe grana 🌼"
    ]
};

// Exemplo de uso para todos mascotes com balão de fala
document.addEventListener("DOMContentLoaded", function() {
    // Falas padrão ao carregar
    typeMascoteTextFromHtml("falaMascoteTextGnomo", falas.falaMascoteTextGnomo);
    typeMascoteTextFromHtml("falaMascoteTextPlanta", falas.falaMascoteTextPlanta);

    // Input de depósito (planta)
    const inputDeposit = document.getElementById("walletBalanceCryptoDeposit");
    if (inputDeposit) {
        inputDeposit.addEventListener("input", function () {
            if (inputDeposit.value.trim()) {
                typeMascoteTextFromHtml("falaMascoteTextPlanta", falas.falaMascoteTextPlantaDeposit);
            } else {
                // Limpa timeout e volta para fala padrão imediatamente
                if (falaMascoteTimeouts["falaMascoteTextPlanta"]) {
                    clearTimeout(falaMascoteTimeouts["falaMascoteTextPlanta"]);
                }
                typeMascoteTextFromHtml("falaMascoteTextPlanta", falas.falaMascoteTextPlanta, 40, 0);
            }
        });
        inputDeposit.addEventListener("blur", function () {
            if (falaMascoteTimeouts["falaMascoteTextPlanta"]) {
                clearTimeout(falaMascoteTimeouts["falaMascoteTextPlanta"]);
            }
            typeMascoteTextFromHtml("falaMascoteTextPlanta", falas.falaMascoteTextPlanta, 40, 0);
        });
    }

    // Input de saque (gnomo)
    const inputSaque = document.getElementById("walletBalanceCryptoSaque");
    if (inputSaque) {
        inputSaque.addEventListener("input", function () {
            if (inputSaque.value.trim()) {
                typeMascoteTextFromHtml("falaMascoteTextGnomo", falas.falaMascoteTextGnomoSaque);
            } else {
                if (falaMascoteTimeouts["falaMascoteTextGnomo"]) {
                    clearTimeout(falaMascoteTimeouts["falaMascoteTextGnomo"]);
                }
                typeMascoteTextFromHtml("falaMascoteTextGnomo", falas.falaMascoteTextGnomo, 40, 0);
            }
        });
        inputSaque.addEventListener("blur", function () {
            if (falaMascoteTimeouts["falaMascoteTextGnomo"]) {
                clearTimeout(falaMascoteTimeouts["falaMascoteTextGnomo"]);
            }
            typeMascoteTextFromHtml("falaMascoteTextGnomo", falas.falaMascoteTextGnomo, 40, 0);
        });
    }
});