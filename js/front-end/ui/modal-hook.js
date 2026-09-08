import { 
    fetchItems,
    checkBalance,
    onRemoveParasita
} from '../api.js';

import {
    UpdateUI,
    UpdateTime,
    limparSlot,
    atualizarSlot
} from './hud.js';

import {
    setupPagination
} from './display.js';

import {
    soundInspectPlant
} from './sound.js';

import {
    mascoteBallon
} from './swapScreen.js';

import {
    plantVaso, 
    setModoInventario,
    aplicarUtilitario
} from '../index.js';

import {
    getWalletAddress
} from '../web3/walletConnect.js';

// Modal
export let isPlayGameBoardActive = false; // Variável de controle
export let isPlayUtilitarioActive = false; // ✅ KILL-SWITCH: Controla se menu de utilitários está ativo
const arrow = document.getElementsByClassName("arrow-next");

// Evento click slot/shop walletAddress usuario
export function addSlotClickListeners(walletAddress) {
    walletAddress = getWalletAddress();

    // Verifica se walletAddress é válido
    if (!walletAddress || typeof walletAddress !== 'string') {
        console.error("Erro: walletAddress inválido:", walletAddress);
        return;
    }

    for (let i = 1; i <= 22; i++) {
        const slotElement = document.getElementById(`shopSlot${i}`);
        if (slotElement) {
            if (!slotElement.dataset.listenerAdded) {
                // Cria um closure para garantir que walletAddress será preservado
                const walletAddressCopy = walletAddress;
                slotElement.addEventListener('click', () => onSlotClick(i, walletAddressCopy));
                slotElement.dataset.listenerAdded = "true";
            }
        } else {
            console.warn(`Elemento shopSlot${i} não encontrado`);
        }
    }
}

// Check Item Slot Click
export async function onSlotClick(slotId, walletAddress) {

    try {
        // Usa o endereço passado ou recorre ao global
        walletAddress = walletAddress || getWalletAddress();

        if (!walletAddress) {
            console.error("Erro: Nenhum endereço de carteira disponível");
            return;
        }

        const items = await fetchItems();
        if (!items || items.length === 0) {
            console.error("Nenhum item encontrado ou a resposta dos itens está vazia.");
            return;
        }

        const item = items.find(item => item.itemId === String(slotId) || 
                                      (slotId >= 19 && slotId <= 22 && item.itemId === `u${slotId - 18}`));

        if (!item) {
            console.error(`Item com ID ${slotId} não encontrado`);
            return;
        }

        const resultado = await checkBalance(item, walletAddress);
        if (!resultado) {
            console.error("Erro ao processar compra: resposta indefinida da API.");
            return;
        }
        if (resultado.error) {
            console.error("Erro ao processar compra:", resultado.error);
            return;
        }

    } catch (error) {
        console.error("Erro ao processar clique no slot:", error.message);
    } finally {
        // Libera cliques após um curto período
        setTimeout(() => {
        }, 1000);
    }
}






// Abre modal configurações
export function configOpen() {
    const configModal = document.getElementById("configModal");
    const falaMascoteText = document.getElementById("falaMascoteBallon");
    const falaMascoteText2 = document.getElementById("falaMascoteBallon2");

    if (configModal) {
        if (configModal.style.display === 'flex') {
            configModal.style.display = 'none';
            falaMascoteText.style.display = "block";
            falaMascoteText2.style.display = "block";

            document.getElementById("playInvetoryContent").style.display = "flex";
        } else {
            configModal.style.display = 'flex';
            document.getElementById("playInvetoryContent").style.display = "none";
            falaMascoteText.style.display = "none";
            falaMascoteText2.style.display = "none";
        }
    }
}
// Abre modal shop
export function shopOpen(walletAddress) {
    closeAllModals();
    document.getElementById("shopModal").style.display = "flex";
    document.getElementById("subShopModal").style.display = "flex";
    
    // Usa o endereço passado ou recorre ao global
    walletAddress = getWalletAddress();
    
    if (!walletAddress) {
        console.error("Erro: Nenhum endereço de carteira disponível");
        alert("Por favor, conecte sua carteira antes de acessar a loja.");
        return;
    }
    
    addSlotClickListeners(walletAddress);
    setupPagination("shopModal", "shopArrowNext", "shopArrowLast", ".shopLayoutSlot", 3);
}
// Abre modal Shop Menu
export function shopMenuOpen() {
    closeAllModals();
    // document.getElementById("playMenuOpen").style.display = "flex";
    document.getElementById("shopModal").style.display = "flex";
    document.getElementById("shopMenuModal").style.display = "flex";
    for (let i = 0; i < arrow.length; i++) {
        arrow[i].style.display = "flex";
    }
};
// Abre modal Play Menu
export function playMenuOpen() {
    closeAllModals();
    document.getElementById("playMenuOpen").style.display = "flex";
    document.getElementById("playModal").style.display = "flex";
    document.getElementById("playInvetoryContent").style.display = "flex";
};
// Abre modal trade
export function tradeOpen() {
    closeAllModals();
    document.getElementById("tradeModal").style.display = "flex";
    document.getElementById("tradeMenuOpen").style.display = "flex";
    document.getElementById("tradeSwap").style.display = "none";
    document.getElementById("tradeHistorico").style.display = "none";
    mascoteBallon("falaMascoteTextGnomo", "falaMascoteTextGnomo");
    mascoteBallon("falaMascoteTextPlanta", "falaMascoteTextPlanta");
}
export function tradeSwapOpen() {
    console.log("tradeSwapOpen called");
    document.getElementById("tradeMenuOpen").style.display = "none";
    document.getElementById("tradeSwap").style.display = "flex";
    document.getElementById("tradeHistorico").style.display = "none";
    mascoteBallon("falaMascoteTextGnomo", "falaMascoteTextGnomo");
    mascoteBallon("falaMascoteTextPlanta", "falaMascoteTextPlanta");
}
export function tradeHistoricoOpen() {
    document.getElementById("tradeMenuOpen").style.display = "none";
    console.log("tradeHistoricoOpen called");
    document.getElementById("tradeSwap").style.display = "none";
    document.getElementById("tradeHistorico").style.display = "flex";
    document.getElementById("historicoMenuOpen").style.display = "flex";
    document.getElementById("historyCryptoToken").style.display = "none";
    document.getElementById("historyTokenCrypto").style.display = "none";

}
export function tradeHistoricoDepositOpen() {
    document.getElementById("tradeMenuOpen").style.display = "none";
    document.getElementById("tradeSwap").style.display = "none";
    document.getElementById("historicoMenuOpen").style.display = "none";
    // document.getElementById("historyTokenCrypto ").style.display = "none";
    document.getElementById("tradeHistorico").style.display = "flex";
    document.getElementById("historyCryptoToken").style.display = "flex";
    mascoteBallon("falaMascoteTextGnomo", "falaMascoteTextGnomo");
    mascoteBallon("falaMascoteTextPlanta", "falaMascoteTextPlanta");
}
export function tradeHistoricoSaqueOpen() {
    document.getElementById("tradeMenuOpen").style.display = "none";
    document.getElementById("tradeSwap").style.display = "none";
    document.getElementById("historicoMenuOpen").style.display = "none";
    document.getElementById("historyCryptoToken").style.display = "none";
    document.getElementById("tradeHistorico").style.display = "flex";
    document.getElementById("historicoListToken").style.display = "flex";
    document.getElementById("historyTokenCrypto").style.display = "flex";
}



// Abre modal play
export function playOpen() {
    closeAllModals();
    document.getElementById("playModal").style.display = "flex";
    document.getElementById("playGameBoard").style.display = "flex";
    isPlayGameBoardActive = true;
    // ✅ KILL-SWITCH: Reset quando sai do inventário para vasos
    isPlayUtilitarioActive = false;
    UpdateUI(getWalletAddress());
    for (let i = 0; i < arrow.length; i++) {
        arrow[i].style.display = "flex";
    }
};
// Abre modal Inventario
export function inventoryOpen() {

    let walletAddress = getWalletAddress();

    closeAllModals();

    document.getElementById("menuInventory2").style.display = "none";
    document.getElementById("playInvetory").style.display = "flex";
    document.getElementById("playModal").style.display = "flex";
    document.getElementById("playInvetoryContent").style.display = "flex";

    setupPagination(
        "playInvetory",
        "playArrowNextInventory",
        "playArrowLastInventory",
        ".playInvetorySlots",
        4
    );

    // Remove 'pointer' de todos os slots antes de abrir o inventário
    const allSlots = document.querySelectorAll(".playInvetorySlot");

    allSlots.forEach(slot => {
        slot.classList.remove("pointer");
    });

    // ✅ KILL-SWITCH:
    // Garante que o inventário normal não seja tratado como utilitário
    isPlayUtilitarioActive = false;

    // ✅ LIMPA TODOS OS SLOTS antes de carregar as sementes
    for (let i = 1; i <= 24; i++) {
        limparSlot(i);
    }

    // Mostra as setas da paginação
    for (let i = 0; i < arrow.length; i++) {
        arrow[i].style.display = "flex";
    }

    // Agora carrega novamente o inventário normal (sementes)
    UpdateUI(walletAddress);
}
// Fecha todos Modais
export function closeAllModals() {
    ["configModal",
        "shopModal",
        "shopMenuModal",
        "subShopModal",
        "playModal",
        "tradeModal",
        "playMenuOpen",
        "playGameBoard",
        "playInvetoryContent",
        "playInvetory"].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = "none";
        });

        isPlayGameBoardActive = false;
        // ✅ KILL-SWITCH: Reset quando todos os modais são fechados
        isPlayUtilitarioActive = false;
}




// Função para mostrar inventário de sementes após usar utilitário
export function mostrarInventarioSementes() {
    // ✅ KILL-SWITCH: Reset quando volta para sementes após usar utilitário
    isPlayUtilitarioActive = false;

    // Esconde/limpa TODOS os slots antes de carregar as sementes
    for (let i = 1; i <= 24; i++) {
        limparSlot(i);
    }

    // Atualiza os dados da carteira
    UpdateUI(getWalletAddress());

    // Define o modo para semente
    setModoInventario("semente");

    // Reatribui os listeners de plantio
    if (typeof plantVaso === "function") {
        plantVaso();
    }

    // Mostra as setas da paginação
    for (let i = 0; i < arrow.length; i++) {
        arrow[i].style.display = "flex";
    }

    // Atualiza o inventário de sementes
    atualizarSlot();
}


// Função para mostrar apenas utilitários no inventário
export async function mostrarInventarioUtilitarios() {
    // ✅ KILL-SWITCH: Define que o menu de utilitários está ativo
    isPlayUtilitarioActive = true;

    setupPagination(
        "playInvetory",
        "playArrowNextInventory",
        "playArrowLastInventory",
        ".playInvetorySlots",
        2
    );

    const menuInventory2 = document.getElementById("menuInventory2");

    for (let i = 0; i < arrow.length; i++) {
        arrow[i].style.display = "none";
    }

    if (menuInventory2) {
        menuInventory2.style.display = "none";
    }

    try {
        if (!window.userData || !Array.isArray(window.userData.inventario)) {
            console.error("Dados do usuário ou inventário não disponíveis.");
            return;
        }

        const itemMap = {
            "Regador": "quantityAgua",
            "Fertilizante": "quantityFertilize",
            "Anti-Parasitas": "quantityAntiParasita",
        };

        const itensUtilitarios = window.userData.inventario
            .filter(item => {
                const [itemNome] = item.split(":").map(part => part.trim());
                return itemMap[itemNome] !== undefined;
            })
            .slice(0, 4);

        // Limpa TODOS os slots antes de carregar os utilitários
        for (let i = 1; i <= 24; i++) {
            limparSlot(i);
        }

        itensUtilitarios.forEach((item, index) => {
            const [itemNome, quantidade] = item
                .split(":")
                .map(part => part.trim());

            const slotIndex = index + 1;

            const matchingItem = window.userData.items.find(
                i => i.itemNome === itemNome
            );

            if (!matchingItem) {
                console.warn(`Item '${itemNome}' não encontrado na loja.`);
                return;
            }

            atualizarSlot(
                slotIndex,
                itemNome,
                matchingItem.itemId,
                quantidade
            );

            const slotElement = document.querySelector(
                `#playInvetorySlot${slotIndex}`
            );

            if (slotElement) {
                const newSlotElement = slotElement.cloneNode(true);

                slotElement.parentNode.replaceChild(
                    newSlotElement,
                    slotElement
                );

                newSlotElement.addEventListener("click", () => {
                    aplicarUtilitario(matchingItem);
                });
            } else {
                console.error(
                    `Slot #playInvetorySlot${slotIndex} não encontrado!`
                );
            }
        });

    } catch (error) {
        console.error(
            "Erro ao mostrar inventário de utilitários:",
            error
        );
    }
}




// Função para exibir o modal e esperar a resposta do usuário.
export function showConfirmationModal(message) {
    return new Promise((resolve) => {
        // Atualizar o texto do modal
        document.getElementById("modalMessage").innerText = message;

        // Exibir modal
        document.getElementById("overlay").style.display = "block";
        document.getElementById("modalInformation").style.display = "block";

        // Evento para o botão "Sim"
        document.querySelector(".btn-sim").onclick = () => {
            fecharModal();
            resolve(true); // Confirma ação
        };

        // Evento para o botão "Não"
        document.querySelector(".btn-nao").onclick = () => {
            fecharModal();
            resolve(false); // Cancela ação
            playOpen();
        };
    });
}
// Função para exibir o modal e esperar a resposta do usuário.
export function showInspectModal(message) {
    return new Promise((resolve) => {
        // soundInspectPlant();

        // Atrasar a exibição do modal para sincronizar com o áudio (100ms)
        setTimeout(() => {
            // Atualizar o texto do modal
            document.getElementById("modalMessageInspect").innerText = message;

            // Exibir modal
            document.getElementById("overlay").style.display = "block";
            document.getElementById("modalInformationInspect").style.display = "block";

            // Evento para o botão "X" (fechar)
            document.querySelector(".btn-x-inspect").onclick = () => {
                fecharModal();
                resolve(true); // Confirma ação
            };
        }, 200); // Atraso de 200ms
    });
}
// Modal HandleClicks
export function showPlantModal(message, options = {}) {
    return new Promise((resolve) => {
        soundInspectPlant();

        // Atrasar a exibição do modal para sincronizar com o áudio (100ms)
        setTimeout(() => {
            // Atualizar o texto do modal
            document.getElementById("modalMessageVaso").innerText = message;

            // Exibir modal
            document.getElementById("overlay").style.display = "block";
            document.getElementById("modalInformationVaso").style.display = "block";
            document.getElementById("modalInformationVaso").style.height = "140px";

            // Limpa e monta os botões na div mãe
            const actionsDiv = document.getElementById("modalVasoActions");
            actionsDiv.innerHTML = "";

            // Remove input antigo se existir
            const oldInput = document.getElementById("inputTempoRestante");
            if (oldInput) oldInput.remove();

            // Adiciona o input de tempo restante
            if (options.showRemoveParasita && options.tempoRestante) {
                const inputTempo = document.createElement("input");
                inputTempo.type = "text";
                inputTempo.readOnly = true;
                inputTempo.value = `Tempo restante: ${options.tempoRestante}`;
                inputTempo.className = "input-tempo-restante center-x";
                inputTempo.id = "inputTempoRestante";
                // Insere logo após o modalMessageVaso
                const msgElem = document.getElementById("modalMessageVaso");
                msgElem.parentNode.insertBefore(inputTempo, actionsDiv);
            }

            // Evento para o botão "Sim"
            if (options.showRemoveParasita) {
                const btnRemove = document.createElement("button");
                btnRemove.id = "btnRemoveParasita";
                btnRemove.textContent = "Remover Parasita";
                btnRemove.className = "btn-remove-parasita pointer";
                btnRemove.onclick = async () => {
                    if (options.onRemoveParasita) await options.onRemoveParasita();
                    await onRemoveParasita(getWalletAddress(), options.slotID);
                    await UpdateUI(getWalletAddress()); // <-- Atualiza HUD
                    document.getElementById("modalInformationVaso").style.display = "none";
                    document.getElementById("overlay").style.display = "none";
                    resolve(true);
                };
                actionsDiv.appendChild(btnRemove);
            }

            const btnClose = document.createElement("button");
            btnClose.className = "btn-x-vaso pointer";
            btnClose.textContent = "X";
            btnClose.onclick = () => {
                fecharModal();
                resolve(false);
            };
            actionsDiv.appendChild(btnClose);
        }, 200); // Atraso de 100ms
    });
}

export function showModalInformationUtility(message) {
    return new Promise((resolve) => {
        // Atualizar o texto do modal
        document.getElementById("modalMessageUtility").innerText = message;

        // Exibir modal
        document.getElementById("overlay").style.display = "block";
        document.getElementById("modalInformationUtility").style.display = "block"; 

        // Evento para o botão "X" (fechar)
        document.querySelector(".btn-x-inspect2").onclick = () => {
            fecharModal();
            resolve(true); // Confirma ação
        };
    }, 200); // Atraso de 200ms
}
//Função para fechar o modal
export function fecharModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("modalInformation").style.display = "none";
    document.getElementById("modalInformationInspect").style.display = "none";
    document.getElementById("modalInformationVaso").style.display = "none";
    document.getElementById("modalInformationUtility").style.display = "none";
}