import { playOpen } from './index.js';
const API_URL = "https://ton-flower-land-back-end.vercel.app"; // URL do seu back-end
// const API_URL = "http://192.168.0.100:3000"
let isProcessing = false; // Variável de controle para evitar múltiplos cliques rápidos
export let items = []; // Inicializando o array de itens

// ESCRITA

// Criar um novo usuário
export async function createUser(walletAddress) {
    const telegramWebApp = window.Telegram.WebApp;
    const telegramUserId = telegramWebApp.initDataUnsafe.user.id;
    console.log("criando usuario...");
    try {
        const response = await fetch(`${API_URL}/createUser`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, telegramUserId }),
            credentials: 'include' // Para enviar o cookie JWT
        });
        const data = await response.json();
        // console.log(data);
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
    }
}

// Adiciona um item do inventario
async function addItem(walletAddress, itemNome, quantidade) {
    console.log("Adicionando item");
    try {
        const response = await fetch(`${API_URL}/addItem`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ walletAddress, itemNome, quantidade }),
            credentials: 'include' // Para enviar o cookie JWT
        });

        // Verifique se a resposta foi bem-sucedida (código 200-299)
        if (!response.ok) {
            throw new Error(`Erro ao adicionar item: ${response.statusText}`);
        }

        // Processa a resposta JSON
        const data = await response.json();
        console.log("Resposta do servidor:", data);
        return data;  // Retorna o resultado para um possível uso posterior
    } catch (error) {
        console.error("Erro ao enviar requisição:", error);
    }
}

// Remover um item do inventario
export  async function removeItem(walletAddress, itemNome, quantidade) {
    console.log("Remover um item");
    try {
        const response = await fetch(`${API_URL}/removeItem`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ walletAddress, itemNome, quantidade }),
            credentials: 'include' // Para enviar o cookie JWT
        });

        // Verifique se a resposta foi bem-sucedida (código 200-299)
        if (!response.ok) {
            throw new Error(`Erro ao Remover item: ${response.statusText}`);
        }

        // Processa a resposta JSON
        const data = await response.json();
        console.log("Resposta do servidor:", data);
        return data;  // Retorna o resultado para um possível uso posterior
    } catch (error) {
        console.error("Erro ao enviar requisição:", error);
    }
}

// Rota para atualizar o saldo
async function updateTokenBalance(walletAddress, novoSaldo) {
    console.log("Update tokenBalance");
    try {
        const response = await fetch(`${API_URL}/updateBalance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ walletAddress, novoSaldo }),
            credentials: 'include' // Para enviar o cookie JWT
        });

        if (response.ok) {
            const result = await response.json();
            // console.log("Saldo atualizado com sucesso:", result);
        } else {
            throw new Error("Erro ao atualizar saldo no Firebase");
        }
    } catch (error) {
        console.error("Erro ao debitar saldo:", error);
    }
}

// Função para plantar
export async function plantSeed(walletAddress, selectedVaseSlot, selectedSeed, itemTime, isFertilized, isProtect, isWater) {
    try {
        console.log("Iniciando processo de plantio");
        
        // Verificação inicial do walletAddress
        if (!walletAddress) {
            console.error("walletAddress não fornecido para plantSeed");
            // Tenta recuperar do userData global
            if (window.userData && window.userData.walletAddress) {
                walletAddress = window.userData.walletAddress;
                console.log("Usando walletAddress do userData global:", walletAddress);
            } else {
                console.error("Não foi possível obter walletAddress de nenhuma fonte");
                return { success: false, error: "Endereço de carteira não encontrado" };
            }
        }
        
        // Buscar o item com base no selectedSeed (ID único)
        const selectedItem = items.find(item => item.itemId === selectedSeed);
        if (!selectedItem) {
            console.error(`Erro: item com ID ${selectedSeed} não encontrado.`);
            return { success: false, error: "Item não encontrado" };
        }
        
        // Verificar se o itemTime está presente e válido
        const selectedItemTime = parseFloat(selectedItem.itemTime) || 0;  // Converte para número ou 0 se inválido
        console.log(`Tempo do item para plantio (em horas): ${selectedItemTime}`);
        if (selectedItemTime <= 0) {
            console.error(`Erro: item com ID ${selectedSeed} não tem tempo de plantio válido.`);
            return { success: false, error: "Tempo de plantio inválido" };
        }
        
        // Calcular o tempo de colheita
        const now = new Date();
        const plantDate = now.toISOString();
        
        // Definir o status de crescimento
        const growthStatus = {
            isWatered: isWater ?? false,
            isParasita: false,  // Inicialmente sem parasitas
            isProtected: isProtect ?? false,
            isFertilized: isFertilized ?? false,
            lastUpdated: now.toISOString(),
            elapsedTime: 0, // Tempo já decorrido em milissegundos
            totalTime: selectedItemTime * 60 * 60 * 1000 // Tempo total em milissegundos
        };
        
        // Calcular a data de colheita com base nos status
        let harvestDate;
        if (isWater && isProtect) {
            // Planta regada e protegida cresce normalmente
            harvestDate = new Date(now.getTime() + selectedItemTime * 60 * 60 * 1000).toISOString();
        } else if (isWater && !isParasita) {
            // Planta regada e sem parasitas cresce normalmente
            harvestDate = new Date(now.getTime() + selectedItemTime * 60 * 60 * 1000).toISOString();
        } else {
            // Planta não está crescendo ativamente
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 20); // Data 20 anos no futuro
            harvestDate = futureDate.toISOString();
        }
        
        // Atualizar status do jogador
        const userStatus = await updatePlayerStatus(walletAddress);
        if (!userStatus || !userStatus.walletAddress) {
            console.error("Erro: walletAddress não encontrada ou inválida no status do usuário.");
            return { success: false, error: "Status do jogador não encontrado" };
        }
        
        // Usar a wallet address confirmada
        walletAddress = userStatus.walletAddress;
        console.log(`walletAddress confirmada: ${walletAddress}`);
        
        // Preparar payload para a API
        const requestPayload = {
            walletAddress,
            slotID: selectedVaseSlot,
            itemNome: selectedItem.itemNome,
            itemTime: selectedItemTime,
            itemId: selectedItem.itemId,
            raridade: selectedItem.raridade,
            plantDate,
            harvestDate,
            growthStatus
        };
        
        console.log("Enviando dados para a API:", requestPayload);
        
        // Enviar requisição para a API
        const response = await fetch(`${API_URL}/plantSeed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestPayload),
            credentials: 'include' // Para enviar o cookie JWT
        });
        
        // Processar resposta
        const data = await response.json();
        
        if (response.ok) {
            console.log("Plantio realizado com sucesso:", data);
            return { 
                success: true, 
                message: `Semente plantada com sucesso!`,
                data: data
            };
        } else {
            console.error("Erro na resposta da API:", data.error || 'Erro desconhecido');
            return { 
                success: false, 
                error: data.error || "Erro ao realizar o plantio" 
            };
        }
    } catch (error) {
        console.error("Erro ao enviar dados de plantio:", error);
        return { 
            success: false, 
            error: error.message || "Erro inesperado durante o plantio" 
        };
    }
}

// Função atualizar status da planta
export async function updatePlantStatus(walletAddress, slotId, statusField, newValue, utilityName) {
    try {
        console.log(`Enviando requisição para atualizar ${statusField} no vaso ${slotId} usando ${utilityName}`);
        
        // Corrija a URL para apontar para o servidor Node.js na porta 3000 (sem /api/)
        const response = await fetch(`${API_URL}/updatePlantStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                walletAddress,
                slotId,
                statusField,
                newValue,
                utilityName // Adicione o nome do utilitário para verificação no backend
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Erro na API: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }
        
        console.log(`Status ${statusField} atualizado para ${newValue} no vaso ${slotId}`);
        return data;
        
    } catch (error) {
        console.error("Erro ao atualizar status da planta:", error);
        throw error;
    }
}

// Função aplicando utilitario na planta API
export async function applyUtilityToPlant(slotId, utility, vaseData) {
    try {
        console.log("vaseData:", vaseData);
        console.log("Utility recebido:", utility);
        console.log("Nome do utilitário:", utility.itemNome);
        
        // Obter o status atual da planta
        let statusField = "";
        let newValue = true;
        
        // Determinar qual campo atualizar com base no utilitário
        switch (utility.itemNome) {
            case "Fertilizante":
                statusField = "isFertilized";
                newValue = true;
                break;
            case "Regador":
                statusField = "isWatered";
                newValue = true;
                break;
            case "Protetor":
                statusField = "isProtected";
                newValue = true;
                break;
            case "Anti-Parasitas":
                statusField = "isParasita";
                newValue = false; // Note que aqui é false para remover parasitas
                break;
            default:
                throw new Error(`Utilitário desconhecido: ${utility.itemNome}`);
        }
        
        // Chamar a API com os parâmetros corretos, incluindo o nome do utilitário
        const result = await updatePlantStatus(
            userData.walletAddress, 
            slotId, 
            statusField, 
            newValue, 
            utility.itemNome
        );
        
        // Se chegou aqui, a API foi bem-sucedida
        // Atualizar a interface do usuário
        if (result.updatedPlant) {
            const event = new Event('updateUI');
            window.dispatchEvent(event);
            playOpen();
        }
    
        
    } catch (error) {
        console.error("Erro ao aplicar utilitário:", error);
    }
}


// Função para coletar
export async function colectSeed(walletAddress, slotID) {
    try {
        console.log("Verificando walletAddress antes da coleta:", walletAddress);
        console.log("Verificando slotID antes da coleta:", slotID);

        // Verifique se a walletAddress está presente
        if (!walletAddress) {
            console.error("Erro: walletAddress não encontrado!");
            return;
        }

        // Verifique se o slotID está presente
        if (slotID === undefined || slotID === null) {
            console.error("Erro: slotID inválido!");
            return { error: "slotID ausente ou inválido" };
        }

        // Envia dados para Back-End
        console.log("Enviando para API:", { walletAddress, slotID }); // Debug
        const response = await fetch(`${API_URL}/colectSeed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ walletAddress, slotID }),
            credentials: 'include' // Para enviar o cookie JWT
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro ao coletar a planta.");
        }

        return data;
    } catch (error) {
        console.error("Erro na API:", error.message);
        return { error: error.message };
    }
}














// LEITURA


// Shop Request API
export async function fetchItems() {
    console.log("Chamando fetchItems...");

    try {
        const response = await fetch(`${API_URL}/items`); // Única rota para tudo
        const data = await response.json();

        // Verifica se a resposta da API tem a estrutura esperada
        if (!data.items || !Array.isArray(data.items)) {
            console.error('Formato de dados inválido:', data);
            return [];
        }

        // Mapeamento das classes CSS conforme a raridade
        const raridadeClasses = {
            1: "--incomun-color",
            2: "--comun-color",
            3: "--raro-color",
            4: "--epico-color",
            5: "--lendario-color",
            6: "--mitico-color",
            7: "--desconhecido-color"
        };

        // Atualiza a variável `items` global com os dados recebidos
        items = data.items;  // Aqui atribuímos os dados retornados à variável `items`

        // Atualiza os slots na interface com os dados recebidos
        data.items.forEach(item => {
            let slotIndex;
            const isUtilitario = item.itemId.startsWith('u'); // Verifica se começa com 'u'

            if (isUtilitario) {
                slotIndex = 18 + parseInt(item.itemId.replace('u', ''), 10); // u1 → 19, u2 → 20...
            } else {
                slotIndex = parseInt(item.itemId, 10); // Mantém ID como slot para sementes
            }

            const titleElement = document.getElementById(`titleSlotName${slotIndex}`);
            const priceElement = document.getElementById(`priceSlotValue${slotIndex}`);
            const shopSlotElement = document.getElementById(`shopSlot${slotIndex}`);
            const titleColorElement = document.getElementById(`titleSlot${slotIndex}`);

            if (titleElement) {
                titleElement.textContent = ` ${item.itemNome}`;
            }

            if (priceElement) {
                priceElement.textContent = item.itemPreco;
            }

            if (shopSlotElement) {
                const imgElement = document.createElement('img');
                imgElement.className = 'shopImg';
                imgElement.src = `img/shop/${item.itemId}.png`;

                shopSlotElement.innerHTML = ''; // Limpa antes de adicionar
                shopSlotElement.appendChild(imgElement);
            }

            if (titleColorElement) {
                const raridade = isUtilitario ? 1 : parseInt(item.raridade.trim(), 10) || 1;
                const raridadeVar = raridadeClasses[raridade] || "--incomun-color"; // Padrão: Incomum

                titleColorElement.style.backgroundColor = `var(${raridadeVar})`;

                if (raridade === 7) {
                    titleElement.style.color = "var(--txt-text)";
                }
            }
        });

         // Disparar evento indicando que os itens foram carregados
         document.dispatchEvent(new Event("itemsLoaded"));

        return data.items; // Retorna os itens para quem chamou
    } catch (error) {
        console.error('Erro ao buscar os itens:', error);
        return [];
    }
}

// Player Request API
export async function updatePlayerStatus(walletAddress) {
    console.log('Update player status');
    try {
        // Primeiramente tenta buscar o status do usuário
        const response = await fetch(`${API_URL}/user/${walletAddress}`, {
            credentials: 'include' // Para enviar o cookie JWT
        });

        if (response.status === 404) {
            // Se não encontrar o usuário, cria um novo
            // console.log("Usuário não encontrado. Criando novo usuário...");
            const createResponse = await fetch(`${API_URL}/createUser`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ walletAddress }),
                credentials: 'include' // Para enviar o cookie JWT
            });

            if (!createResponse.ok) {
                throw new Error("Erro ao criar o usuário");
            }

            const data = await createResponse.json();
            return data.userData;  // Retorna os dados do novo usuário
        } else if (response.ok) {
            // Se o usuário for encontrado, retorna os dados dele
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error("Erro ao buscar status do jogador:", error);
        return null;
    }
}


// Check o saldo/comprar API
async function checkBalance(item, walletAddress) {
    console.log("Check balance");
    // Verificar se walletAddress está definido
    if (!walletAddress) {
        console.error("Erro: walletAddress não foi definido!");
        return;
    }

    // Passo 1: Identificar o item baseado no parâmetro `item`
    if (!item) {
        console.error("Item não encontrado.");
        return;
    }

    // Passo 2: Obter as informações do item
    const itemName = item.itemNome;
    const itemPrice = item.itemPreco;

    console.log(`Item selecionado: ${itemName} | Preço: ${itemPrice}`);

    // Passo 3: Verificar o saldo do jogador
    try {
        const userStatus = await updatePlayerStatus(userData.walletAddress); // Função que retorna o saldo de tokens do jogador


        
        if (!userStatus) {
            console.error("Erro ao obter o status do jogador.");
            return;
        }

        let tokenBalance = userStatus.tokenBalance || "0.00"; // Garantir que o tokenBalance seja uma string com 2 casas decimais
        tokenBalance = parseFloat(tokenBalance).toFixed(2); // Forçar a formatação para 2 casas decimais

        // console.log(`Saldo de Tokens: ${tokenBalance}`);

        // Passo 4: Verificar se o saldo é suficiente para a compra
        if (parseFloat(tokenBalance) >= parseFloat(itemPrice)) {
            // console.log(`Saldo suficiente para comprar o item: ${itemName}`);

            // Passo 5: Adicionar o item ao inventário
            try {
                const quantidade = 1; // Supondo que estamos comprando 1 unidade
                await addItem(userData.walletAddress, itemName, quantidade); // Função para adicionar item ao inventário

                // Passo 6: Debitar o valor do saldo do jogador
                let novoSaldo = (parseFloat(tokenBalance) - parseFloat(itemPrice)).toFixed(2); // Garantir que o novo saldo seja também formatado com 2 casas decimais

                // Aqui você deve fazer a atualização do saldo no Firebase.
                await updateTokenBalance(walletAddress, novoSaldo); // Atualiza o saldo de tokens no Firebase

                // console.log(`Compra realizada com sucesso! Novo saldo: ${novoSaldo}`);


                // Busca novamente os dados atualizados do jogador
                const updatedUserStatus = await updatePlayerStatus(walletAddress);
                
                // Emitir evento para atualização da UI
                const event = new CustomEvent('updateUI', { detail: updatedUserStatus });
                window.dispatchEvent(event);

            } catch (error) {
                console.error("Erro ao adicionar item ao inventário ou debitar tokens:", error);
            }
        } else {
            // console.log(`Saldo insuficiente para comprar ${itemName}.`);
        }
    } catch (error) {
        console.error("Erro ao verificar o saldo do jogador:", error);
    }
}

// Check Item Slot Click
export async function onSlotClick(slotId, walletAddress) {
    if (isProcessing) {
        return;
    }

    // Bloqueia novos cliques enquanto processa
    isProcessing = true;

    // Usa o endereço passado ou recorre ao global
    const addressToUse = userData.walletAddress;
    
    if (!addressToUse) {
        console.error("Erro: Nenhum endereço de carteira disponível");
        isProcessing = false;
        return;
    }

    const items = await fetchItems();

    if (!items || items.length === 0) {
        console.error("Nenhum item encontrado ou a resposta dos itens está vazia.");
        isProcessing = false;
        return;
    }

    const item = items.find(item => item.itemId === String(slotId) || 
                                  (slotId >= 19 && slotId <= 22 && item.itemId === `u${slotId - 18}`));

    if (!item) {
        console.error(`Item com ID ${slotId} não encontrado`);
        isProcessing = false;
        return;
    }

    await checkBalance(item, addressToUse);

    setTimeout(() => { // Libera cliques após um curto período
        isProcessing = false;
    }, 1000);
}
