//#region Modal
const walletModal = document.getElementById("walletModal");
const playModal = document.getElementById("playModal");
const btnShopOpen = document.getElementById("btnShopOpen");
const btnShopMenu = document.getElementById("btnShopMenu");
const btnPlayMenu = document.getElementById("btnPlayMenu");
const btnInventoryOpen = document.getElementById("btnInventoryOpen");
const btnTradeOpen = document.getElementById("btnTradeOpen");
const btnConfigOpen = document.getElementById("btnConfigOpen");
const btnPlayOpen = document.getElementById("btnPlayOpen");
const web3AdressInput = document.getElementById("adressInput");
//#endregion

//#region Button Config Mode
btnConfigOpen.addEventListener("click", configOpen);
// Button Shop Menu Mode
btnShopOpen.addEventListener("click", shopOpen);
// Button Shop Store
btnShopMenu.addEventListener("click", shopMenuOpen);
// Button Play Mode
btnPlayMenu.addEventListener("click", playMenuOpen);
// Button Inventory
btnInventoryOpen.addEventListener("click", inventoryOpen);
// Button Play Game Mode
btnPlayOpen.addEventListener("click", playOpen);
// Button Exchange/Trade
btnTradeOpen.addEventListener("click", tradeOpen);
//#endregion

//#region Modal Funcion //
// Abre modal configurações
function configOpen() {
    const configModal = document.getElementById("configModal");

    if (configModal) {
        if (configModal.style.display === 'flex') {
            configModal.style.display = 'none';
        } else {
            configModal.style.display = 'flex';
        }
    }
}
// Abre modal shop
function shopOpen(walletAddress) {
    closeAllModals();
    document.getElementById("shopModal").style.display = "flex";
    document.getElementById("subShopModal").style.display = "flex";
    addSlotClickListeners(walletAddress);
}
// Abre modal Shop Menu
function shopMenuOpen() {
    closeAllModals();
    // document.getElementById("playMenuOpen").style.display = "flex";
    document.getElementById("shopModal").style.display = "flex";
    document.getElementById("shopMenuModal").style.display = "flex";

};
// Abre modal Play Menu
function playMenuOpen() {
    closeAllModals();
    document.getElementById("playMenuOpen").style.display = "flex";
    document.getElementById("playModal").style.display = "flex";

};
// Abre modal trade
function tradeOpen() {
    closeAllModals();
    document.getElementById("tradeModal").style.display = "flex";
}
//#endregion

//#region Exports

// Fecha todos Modais
function closeAllModals() {
    ["configModal",
        "shopModal",
        "shopMenuModal",
        "subShopModal",
        "playModal",
        "tradeModal",
        "playMenuOpen",
        "playGameBoard",
        "playInvetory"].forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = "none";
        });
}

// Abre modal play
function playOpen() {
    closeAllModals();
    document.getElementById("playModal").style.display = "flex";
    document.getElementById("playGameBoard").style.display = "flex";
};

// Abre modal Inventario
function inventoryOpen() {
    closeAllModals();
    document.getElementById("playInvetory").style.display = "flex";
    document.getElementById("playModal").style.display = "flex";
    // updateUIAndInventory();
}

// Função para atualizar a exibição das linhas
function updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage) {
    let lastPage = null; // Variável para rastrear a última página renderizada
    if (!rows || rows.length === 0) {
        console.warn("Nenhum slot encontrado para atualizar.");
        return;
    }

    // Evita atualizar se a página não mudou
    if (currentPage === lastPage) return;
    lastPage = currentPage;

    console.log(`Atualizando exibição: ${rows.length} slots encontrados.`);

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
function setupPagination(modalId, arrowNextId, arrowLastId, rowClass, itemsPerPage) {
    let currentPage = 1;
    const rows = document.querySelectorAll(rowClass);  // Seleciona as linhas (playInvetorySlots)
    if (rows.length === 0) {
        console.error(`Erro: Nenhum elemento encontrado para ${rowClass}`);
        return;
    }
    const totalPages = Math.ceil(rows.length / itemsPerPage);  // Calcula o total de páginas
    const arrowNext = document.getElementById(arrowNextId);
    const arrowLast = document.getElementById(arrowLastId);

    const modal = document.getElementById(modalId);

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
                updateDisplay();
            }
        });
    }

    if (arrowLast) {
        arrowLast.addEventListener("click", function () {
            if (currentPage > 1) {
                currentPage--;
                updateDisplay();
            }
        });
    }

    // Inicializa a exibição do modal
    initializePagination();
}

document.addEventListener("itemsLoaded", () => {
    console.log("📦 Itens carregados! Iniciando paginação...");

    setupPagination("shopModal", "shopArrowNext", "shopArrowLast", ".shopLayoutSlot", 3);
    setupPagination("playInventory", "playArrowNextInventory", "playArrowLastInventory", ".playInvetorySlots", 4);
    setupPagination("playGameBoard", "playArrowNextGame", "playArrowLastGame", ".slotVasos", 4);
});

//#endregion