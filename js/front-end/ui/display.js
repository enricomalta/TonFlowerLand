// Atualizar dinamicamente a quantidade de paginas com base 
// no numero de vasos do jogador (quantityVasos)
// Cada página contém exatamente 4 slots (grid 2x2)
// Se houver mais de 4 vasos, cria novas páginas automaticamente
// Exemplo: 1-4 vasos = 1 página, 5-8 vasos = 2 páginas, etc.
// Vasos está no inventario do jogador { "Vaso:4" }
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

