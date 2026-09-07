import { 
    items, 
    updatePlayerStatus,  
    plantSeed, 
    colectSeed,
    // fetchItems,
    // fetchProfile,
    // checkBalance
    checkPlantTime,
    applyUtilityToPlant,
    onRemoveParasita,
} from './api.js';

import { 
    configOpen, 
    shopOpen, 
    shopMenuOpen, 
    playMenuOpen, 
    tradeOpen, 
    playOpen, 
    inventoryOpen,
    mostrarInventarioUtilitarios,
    mostrarInventarioSementes,
    showInspectModal,
    tradeSwapOpen,
    tradeHistoricoOpen,
    tradeHistoricoDepositOpen,
    tradeHistoricoSaqueOpen,
    // closeAllModals, 
    // addSlotClickListeners,
    // fecharModal,
    // showInspectModal
    // onSlotClick,
    showConfirmationModal
} from './ui/modal-hook.js';

import {
    autoUpdate,
    UpdateUI,
    // limparSlot,
    // getCachedPlayerStatus,
    // updatePlayBoard,
    // updateDisplay,
    // atualizarSlot
} from './ui/hud.js'

import {
    attachVolumeListeners,
    loadVolumeSettings,
    startMusic,
    soundInspectPlant,
    soundRecolherPlanta
} from './ui/sound.js';

import {
    getWalletAddress
} from './web3/walletConnect.js';

// import lang from './lang/translate.json';

let selectedPlantSlot = null; // Armazena a planta do inspecionar
let selectedVaseSlot = null; // Armazena o vaso do inspecionar
let selectPlant = false; // Armazena a planta selecionada
let selectedItemName; // Armazena o nome do item selecionado
let walletAddress = getWalletAddress(); // Armazena a wallet adress

//#region ID Elements

const btnShopOpen = document.getElementById("btnShopOpen");
const btnShopMenu = document.getElementById("btnShopMenu");
const btnPlayMenu = document.getElementById("btnPlayMenu");
const btnInventoryOpen = document.getElementById("btnInventoryOpen");
const menuInventory2 = document.getElementById("menuInventory2");
const btnTradeOpen = document.getElementById("btnTradeOpen");
const btnConfigOpen = document.getElementById("btnConfigOpen");
const btnPlayOpen = document.getElementById("btnPlayOpen");
const btnSwapOpen = document.getElementById("btnSwapOpen");
const btnLiquidityOpen = document.getElementById("btnLiquidityOpen");
const btnHistoricoDepositOpen = document.getElementById("btnHistoricoDepositOpen");
const btnHistoricoSaqueOpen = document.getElementById("btnHistoricoSaqueOpen");

//#endregion


// Word Translante
function getOriginalName(displayedName, currentLang) {
    for (const [original, translations] of Object.entries(lang)) {
      if (currentLang !== 'pt' && translations[currentLang] === displayedName) {
        return original;
      }
      if (currentLang === 'pt' && original === displayedName) {
        return original;
      }
    }
    return null; // não encontrado
}

//#region Plant Functions

// Variável global para controlar o modo do inventário
window.modoInventario = "semente"; // "semente" ou "utilitario"

// Função helper para fazer parse seguro do plant_time vindo do MySQL
export function parseUserPlantTime(plantTimeData) {
    if (!plantTimeData) return [];

    // Se já é um array
    if (Array.isArray(plantTimeData)) return plantTimeData;

    // Se é uma string JSON, faz o parse
    if (typeof plantTimeData === 'string') {
        try {
            const parsed = JSON.parse(plantTimeData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Erro ao fazer parse do plant_time:', e);
            return [];
        }
    }

    return [];
}

// Função para alternar o modo do inventário
export function setModoInventario(modo) {
    window.modoInventario = modo;
}

export async function plantVaso() {
    document.querySelectorAll(".playInvetorySlot").forEach(slot => {
        // Remover todos os eventos anteriores
        const newSlot = slot.cloneNode(true);
        slot.parentNode.replaceChild(newSlot, slot);

        newSlot.addEventListener("click", async (event) => {
            if (!selectedVaseSlot) {
                console.error("Nenhum vaso selecionado para plantar!");
                return;
            }
            const slotId = newSlot.id.replace("playInvetorySlot", "");
            const seedTitleElement = document.querySelector(`#titleInvetorySlot${slotId}`);
            if (!seedTitleElement) {
                console.error("Não foi possível encontrar o nome do item!");
                return;
            }

            const selectedItemName = seedTitleElement.textContent.trim();

            // Verificar se a variável `items` está carregada corretamente
            if (!Array.isArray(items) || items.length === 0) {
                console.error("Itens não carregados corretamente. Verifique a função fetchItems.");
                return;
            }

            // Procurar no array `items` o nome do item selecionado
            const selectedItem = items.find(item => item.itemNome.trim() === selectedItemName.trim());
            if (!selectedItem) {
                console.error(`Erro: Item com nome '${selectedItemName}' não encontrado.`);
                return;
            }



            // Verificar status atual do vaso
            const vaseData = await checkVaseStatus(selectedVaseSlot);

            // Definir se o item é utilitário ou semente
            const isUtility = ["Regador", "Fertilizante", "Anti-Parasita"].includes(selectedItemName || "");
            if (isUtility) {
                if (!vaseData) {
                    // Permite aplicar utilitário apenas se houver planta no slot
                    console.warn(`Não é possível aplicar utilitário: slot ${selectedVaseSlot} está vazio após colheita.`);
                    return;
                }
                
                const addressToUse = userData?.walletAddress || walletAddress;
                if (!addressToUse) {
                    console.error("Erro: Não foi possível determinar o endereço da carteira");
                    return;
                }
            
                await applyUtilityToPlant(addressToUse, selectedVaseSlot, selectedItem, vaseData);
                return; // Finaliza aqui
            } else {
                // Permite plantar mesmo se vaseData for null (slot vazio)
                const confirmMessage = vaseData
                    ? `Deseja substituir a planta atual por "${selectedItemName}"?`
                    : `Deseja plantar "${selectedItemName}" neste vaso?`;

                const userConfirmed = await showConfirmationModal(confirmMessage);

                if (userConfirmed) {
                    const addressToUse = userData?.walletAddress || walletAddress;
                    if (!addressToUse) {
                        console.error("Erro: Não foi possível determinar o endereço da carteira");
                        return;
                    }
                    await plantSeed(addressToUse, selectedVaseSlot, selectedItem.itemId);
                    if (window.atualizarDadosLocaisAposAcao) {
                        UpdateUI(addressToUse);
                    }
                    playOpen();
                } else {
                    // console.log("Usuário cancelou o plantio.");
                }
            }

            // Resetar seleção e fechar modal
            document.querySelectorAll(".playInvetorySlot").forEach(slot => slot.classList.remove("pointer"));
            selectedVaseSlot = null;
        });
    });

}

// Evento para mouse click vaso/planta/timer
export function attachSlotClickEvents(quantityVasos) {
    document.querySelectorAll(".slotVasos").forEach(slot => {
        const menuInventory2 = document.getElementById("menuInventory2");
        const slotIndex = parseInt(slot.id.replace("slotVasos", ""), 10);
        const vasoPhoto = slot.querySelector(".vasoPhoto");
        const plantPhoto = slot.querySelector(".plantPhoto");
        const plantTimerElement = document.getElementById(`plantTimer${slotIndex}`);

        if (vasoPhoto) {
            const vasoSrc = vasoPhoto.getAttribute("src");

            if ((vasoSrc.includes("0.png") || vasoSrc.includes("00.png")) && slotIndex <= quantityVasos) {
                vasoPhoto.style.cursor = "url('../img/cursor/colher.png') 16 16, auto";
                vasoPhoto.addEventListener("click", () => {
                    selectedVaseSlot = slotIndex;

                    inventoryOpen();
                    mostrarInventarioSementes();
                    menuInventory2.style.display = "flex";
                    selectPlant = true;
                    document.querySelectorAll(".playInvetorySlot").forEach(slot => slot.classList.toggle("pointer", selectPlant));
                    selectPlant = false;
                });
            } else {
                vasoPhoto.style.cursor = "default";
            }
        }
        if (plantPhoto) {
            plantPhoto.addEventListener("mouseover", () => {
                const plantSrc = plantPhoto.getAttribute("src"); // Captura o src atualizado

                if (plantSrc && plantSrc.includes("/img/plant/") && slotIndex <= quantityVasos) {
                    plantPhoto.style.cursor = "url('../img/cursor/lupa.png') 16 16, auto";
                }
            });

            plantPhoto.addEventListener("click", () => {
                const plantSrc = plantPhoto.getAttribute("src"); // Obtém a imagem
                selectedPlantSlot = slotIndex;

                // Extrair o número da planta do src
                const plantIdMatch = plantSrc.match(/\/img\/plant\/(\d+)\.png/);
                if (!plantIdMatch) {
                    console.error("Erro ao extrair o ID da planta!");
                    return;
                }

                const plantId = plantIdMatch[1]; // Pega apenas o número da planta

                // Buscar os dados no userData
                if (!window.userData || !Array.isArray(window.userData.items)) {
                    console.error("Dados do usuário não carregados corretamente!");
                    return;
                }

                const plantData = window.userData.items.find(plant => plant.itemId === plantId);
                
                // Parse do plant_time para encontrar dados da planta
                const plantTimes = parseUserPlantTime(window.userData.plant_time);
                const plantTime = plantTimes.find(plant => Number(plant.slotID) === Number(slotIndex));

                if (!plantData) {
                    console.error("Planta não encontrada no banco de dados!");
                    return;
                }

                // Monta a mensagem para o modal
                const plantInfo = `
                        Nome: ${plantData.itemNome} 🌿
                        LvL Raridade: ${plantData.raridade} 🌟
                        Pagamento: ${plantData.itemPay} 💰
                        Tempo: ${plantData.itemTime} ⏳
                        Protegido: ${plantTime?.growthStatus?.isProtected ? "Sim" : "Não"} 🔒
                        Regado: ${plantTime?.growthStatus?.isWatered ? "Sim" : "Não"} 💦
                        Fertilizado: ${plantTime?.growthStatus?.isFertilized ? "Sim" : "Não"} ☢️
                    `;

                // Exibe o modal com informações da planta
                soundInspectPlant();
                showInspectModal(plantInfo);
            });


        }
        // ✅ NOVO: Evento de clique no plantTimer quando estiver "Pronta para colheita!"
        if (plantTimerElement) {
            plantTimerElement.addEventListener("click", () => {
                // Verifica se o texto é "Pronta para colheita!"
                if (plantTimerElement.innerText.trim() === "Pronta para colheita!") {
                    const walletAddress = getWalletAddress();
                    if (!walletAddress) {
                        console.error("Wallet address não encontrado!");
                        return;
                    }

                    console.log(`Coletando planta do slot ${slotIndex}...`);
                    
                    // Chama a função de coleta
                    verifyAndCollectSeed(walletAddress, slotIndex);
                }
                if (plantTimerElement.innerText.trim() === "Vaso com parasitas") {
                    const walletAddress = getWalletAddress();
                    if (!walletAddress) {
                        console.error("Wallet address não encontrado!");
                        return;
                    }
                    console.log(`Removendo parasitas do slot ${slotIndex}...`);
                    // Chama a função de remoção de parasita
                    onRemoveParasita(walletAddress, slotIndex);
                }
            });

            // Adiciona estilo de cursor quando estiver pronta para colheita
            const updateTimerCursor = () => {
                if (plantTimerElement.innerText.trim() === "Pronta para colheita!") {
                    plantTimerElement.style.cursor = "url('../img/cursor/coletar.png') 16 16, auto";
                } else {
                    plantTimerElement.style.cursor = "default";
                }
                if (plantTimerElement.innerText.trim() === "Vaso com parasitas") {
                    plantTimerElement.style.cursor = "url('../img/cursor/remover.png') 16 16, auto";
                } else {
                    plantTimerElement.style.cursor = "default";
                }
            };

            // Atualiza o cursor periodicamente
            setInterval(updateTimerCursor, 1000);
            updateTimerCursor(); // Executa imediatamente
        }

    });
}
// Função para verificar a coletar da planta
export async function verifyAndCollectSeed(walletAddress, slotID) {
    try {
        if (!walletAddress) {
            console.error("Erro: walletAddress não fornecido na chamada da função!");
            return;
        }

        // ✅ CORREÇÃO: Busca dados das NOVAS TABELAS
        const plantTimes = await checkPlantTime(walletAddress);

        if (!plantTimes || !Array.isArray(plantTimes)) {
            console.error("Erro: não foi possível buscar os dados das plantas!");
            return;
        }

        // ✅ CORREÇÃO: Busca a planta nas novas tabelas
        const plant = plantTimes.find(p => Number(p.slotID) === Number(slotID));

        if (!plant) {
            console.warn(`Nenhuma planta encontrada para o slot ${slotID}`);
            return;
        }

        // ✅ Verifica se a planta está realmente pronta para colheita
        const harvestTimestamp = new Date(plant.harvestDate).getTime();
        const currentTimestamp = Date.now();
        
        if (currentTimestamp < harvestTimestamp) {
            console.warn(`Planta no slot ${slotID} ainda não está pronta para colheita`);
            // showNotification('A planta ainda não está pronta para colheita!', 'warning');
            return;
        }


        // Chama a API de coleta
        const data = await colectSeed(walletAddress, slotID);

        // Verifica se a API retornou um erro
        if (!data || data.error) {
            console.error("Erro ao coletar planta:", data?.error || "Resposta inválida da API.");
            return;
        }

        // Atualiza a UI indicando que foi colhido
        const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
        const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
        const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);

        if (plantTimerElement) {
            plantTimerElement.innerText = "Colhido!";
            soundRecolherPlanta();

            // Resetar o estado do vaso para vazio
            if (vasoPhotoElement) {
                vasoPhotoElement.src = "/img/play/0.png"; // Sprite inicial do vaso vazio
            }
            if (plantPhotoElement) {
                plantPhotoElement.style.display = "none"; // Esconde a planta
            }

            // Atualizar UI
            await UpdateUI(walletAddress);
            // showNotification('Planta coletada com sucesso! 🌟', 'success');
        }
    } catch (error) {
        console.error("Erro ao verificar e coletar a planta:", error);
    }
}

// Função para verificar o status de plantio do vaso selecionado
async function checkVaseStatus(vaseSlotId) {
    const addressToUse = userData?.walletAddress || walletAddress;
    if (!addressToUse) {
        console.error("Erro: Não foi possível determinar o endereço da carteira");
        return null;
    }
    try {
        const userDoc = await updatePlayerStatus(addressToUse);
        if (!userDoc) {
            return null;
        }
        
        // Parse do plant_time que vem do MySQL como JSON string
        const plantTimes = parseUserPlantTime(userDoc.plant_time);
        
        if (!Array.isArray(plantTimes) || plantTimes.length === 0) {
            return null;
        }
        
        // Encontrar o vaso pelo slotID
        const vaseData = plantTimes.find(plant => Number(plant.slotID) === Number(vaseSlotId));
        // Se não encontrar, retorna null (slot vazio)
        return vaseData || null;
    } catch (error) {
        console.error("Erro ao verificar status do vaso:", error);
        return null;
    }
}

// Função auxiliar para aplicar utilitários corretamente com async/await
export async function aplicarUtilitario(utilitario) {
    if (selectedVaseSlot === null || selectedVaseSlot === undefined) {
        console.error("Nenhum vaso selecionado.");
        return;
    }

    let walletAddress = getWalletAddress();
    if (!walletAddress) {
        console.error("Erro: walletAddress não está definido.");
        return;
    }

    try {
        // ✅ CORREÇÃO: Busca dados das NOVAS TABELAS em vez do JSON
        const plantTimes = await checkPlantTime(walletAddress);
        
        const vaseData = plantTimes.find(plant => Number(plant.slotID) === Number(selectedVaseSlot));

        if (!vaseData) {
            console.error("Dados do vaso não encontrados para o slot:", selectedVaseSlot);
            return;
        }

        // ✅ CORREÇÃO: Chama a função atualizada para aplicar utilitário
        await applyUtilityToPlant(walletAddress, selectedVaseSlot, utilitario, vaseData);

        // RESETAR seleção para permitir o plantio novamente
        selectedItemName = null;
        selectedVaseSlot = null;

        // Fechar inventário de utilitários e abrir a tela do jogo
        playOpen();
        mostrarInventarioSementes(); // ← volta a mostrar as sementes corretamente
        
        // ✅ CORREÇÃO: Atualiza a UI com os dados mais recentes
        await UpdateUI(walletAddress);

    } catch (error) {
        console.error("Erro ao aplicar utilitário:", error);
    }
}



//#endregion




// Main Structure Starts --------------------------------
plantVaso(); // Adiciona evento de click para plantar no vaso
startMusic();
attachVolumeListeners();
loadVolumeSettings();
autoUpdate(); // Inicia o auto-update da UI

//#region Button Events
// Aguardar o carregamento do DOM para inicializar a funcionalidade
document.addEventListener('DOMContentLoaded', () => {
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    btnConfigOpen.addEventListener("click", configOpen);
    // Button Shop Menu Mode
    btnShopOpen.addEventListener("click", shopOpen);
    // Button Shop Store
    btnShopMenu.addEventListener("click", shopMenuOpen);
    // Button Play Mode
    btnPlayMenu.addEventListener("click", playMenuOpen);
    // Button Inventory
    btnInventoryOpen.addEventListener("click", inventoryOpen);

    // Button Trade/Exchange
    btnSwapOpen.addEventListener("click", tradeSwapOpen);
    // Button Trade/Historico Select Menu
    btnLiquidityOpen.addEventListener("click", tradeHistoricoOpen);
    // Button Trade/Historico Deposit
    btnHistoricoDepositOpen.addEventListener("click", tradeHistoricoDepositOpen);
    // Button Trade/Historico Saque
    btnHistoricoSaqueOpen.addEventListener("click", tradeHistoricoSaqueOpen);

    // Utilitarios Menu Inventory
    menuInventory2.addEventListener("click", mostrarInventarioUtilitarios);
    // Button Play Game Mode
    btnPlayOpen.addEventListener("click", playOpen);
    // Button Exchange/Trade
    btnTradeOpen.addEventListener("click", tradeOpen);
});
//#endregion