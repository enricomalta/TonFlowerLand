import { 
    updateUIAndInventory,
    atualizarDadosLocais
} from './ui/hud.js';

import {
    playOpen,
} from './ui/modal-hook.js';

// const API_URL = "https://ton-flower-land-back-end.vercel.app"; // URL do seu back-end
const API_URL = "https://192.168.56.1:443"
export let items = []; // Inicializando o array de itens

//#region USER FUNCTIONS

// Criar um novo usuário
export async function createUser(walletAddress) {
    const telegramWebApp = window.Telegram.WebApp;
    const telegramUserId = telegramWebApp.initDataUnsafe.user.id;
    try {
        const response = await fetch(`${API_URL}/createUser`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, telegramUserId }),
            credentials: 'include' // Para enviar o cookie JWT
        });
        const data = await response.json();
    } catch (error) {
        console.error("Erro ao criar usuário:", error);
    }
}

// Player Request API
export async function updatePlayerStatus(walletAddress) {
    if (!walletAddress) {
        console.error("Erro: walletAddress não fornecido para updatePlayerStatus.");
        return null;
    }
    console.log("Atualizando status do jogador...");
    try {
        const response = await fetch(`${API_URL}/user/${walletAddress}`, {
            credentials: 'include' // Para enviar o cookie JWT
        });

        if (response.status === 404) {
            console.warn("Usuário não encontrado. Criando um novo...");
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
            return data.userData; // Retorna os dados do novo usuário
        } else if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            console.error(`Erro inesperado: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error("Erro ao buscar status do jogador:", error);
        return null;
    }
}

// Shop Request API
export async function fetchItems() {
    console.log("Chamando Items...");

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

// Obter dados do usuário
export async function fetchProfile(walletAddress) {
    try {
        const response = await fetch(`${API_URL}/user/${walletAddress}`, {
            method: "GET",
            credentials: 'include' // Importante para enviar cookies
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar perfil: ${response.status}`);
        }

        const profileData = await response.json();
        // console.log("Dados do perfil:", profileData);
        
        // Atualizar UI com os dados do perfil
        // updateProfileUI(profileData);
        
        return profileData;
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
    }
}

// JWT Telegram
export async function getProfile() {
    const token = localStorage.getItem("jwt"); // Pegamos o token armazenado

    if (!token) {
        console.error("⚠️ Nenhum token encontrado!");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/getProfile`, {
            method: "GET",
            credentials: 'include',
            headers: {
                "Authorization": `Bearer ${token}`, // Enviamos o token no cabeçalho
                "Content-Type": "application/json"
            }
            
        });

        const data = await response.json();
        // console.log("Perfil do usuário:", data);
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
    }
}

//#endregion



//#region PLANTAR FUNCTIONS

// Função para plantar
export async function plantSeed(walletAddress, selectedVaseSlot, selectedSeed, itemTime, isFertilized, isProtect, isWater) {
    try {
        console.log("Iniciando processo de plantio");

        if (!walletAddress) {
            console.error("walletAddress não fornecido para plantSeed");
            return { success: false, error: "Endereço de carteira não encontrado" };
        }

        const selectedItem = items.find(item => item.itemId === selectedSeed);
        if (!selectedItem) {
            console.error(`Erro: item com ID ${selectedSeed} não encontrado.`);
            return { success: false, error: "Item não encontrado" };
        }

        const selectedItemTime = parseFloat(selectedItem.itemTime) || 0;
        if (selectedItemTime <= 0) {
            console.error(`Erro: item com ID ${selectedSeed} não tem tempo de plantio válido.`);
            return { success: false, error: "Tempo de plantio inválido" };
        }

        const now = new Date();
        const plantDate = now.toISOString();

        const growthStatus = {
            isWatered: isWater ?? false,
            isParasita: false,
            isProtected: isProtect ?? false,
            isFertilized: isFertilized ?? false,
            lastUpdated: now.toISOString(),
            elapsedTime: 0,
            totalTime: selectedItemTime * 60 * 60 * 1000
        };

        const harvestDate = new Date(now.getTime() + selectedItemTime * 60 * 60 * 1000).toISOString();

        const payload = {
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

        // console.log("Enviando dados para a API:", payload);
        
        // Enviar requisição para a API
        const response = await fetch(`${API_URL}/plantSeed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            credentials: 'include' // Para enviar o cookie JWT
        });
        
        // Processar resposta
        const data = await response.json();
        
        if (response.ok) {
            // console.log("Plantio realizado com sucesso:", data);
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
        
        // console.log(`Status ${statusField} atualizado para ${newValue} no vaso ${slotId}`);
        return data;
        
    } catch (error) {
        console.error("Erro ao atualizar status da planta:", error);
        throw error;
    }
}

// Função aplicando utilitario na planta API
export async function applyUtilityToPlant(slotId, utility, vaseData) {
    try {
        if (!userData || !userData.walletAddress) {
            console.error("Erro: userData ou walletAddress não está definido.");
            return;
        }

        let statusField = "";
        let newValue = true;

        switch (utility.itemNome) {
            case "Fertilizante":
                statusField = "isFertilized";
                break;
            case "Regador":
                statusField = "isWatered";
                break;
            case "Protetor":
                statusField = "isProtected";
                break;
            case "Anti-Parasitas":
                statusField = "isParasita";
                newValue = false;
                break;
            default:
                throw new Error(`Utilitário desconhecido: ${utility.itemNome}`);
        }

        const result = await updatePlantStatus(
            userData.walletAddress,
            slotId,
            statusField,
            newValue,
            utility.itemNome
        );

        if (result.updatedPlant) {
            // Atualiza dados locais e UI após aplicar utilitário
            if (window.atualizarDadosLocaisAposAcao) {
                await window.atualizarDadosLocaisAposAcao(userData.walletAddress);
            } else if (window.updateUIAndInventory) {
                await window.updateUIAndInventory(userData.walletAddress);
            }
            playOpen();
        }
    } catch (error) {
        console.error("Erro ao aplicar utilitário:", error);
    }
}

// Função para remover parasita
export async function onRemoveParasita(walletAddress, slotId) {
    try {
        const response = await fetch(`${API_URL}/removeParasita`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ walletAddress, slotId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Erro ao remover parasita.");
        return data;
    } catch (error) {
        console.error("Erro ao remover parasita:", error);
        return { success: false, message: error.message };
    }
}

// Função para coletar
export async function colectSeed(walletAddress, slotID) {
    try {
        console.log("Iniciando Coleta:", walletAddress);

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
        // console.log("Enviando para API:", { walletAddress, slotID }); // Debug
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



//#endregion



//#region COMPRAR FUNCTIONS

// Adiciona um item do inventario
export async function processarCompra(walletAddress, itemNome, quantidade) {
    console.log("Chamando API de Compra");
    try {
        const payload = {
            walletAddress,
            itemNome,
            quantidade
        };

        
        const response = await fetch(`${API_URL}/processarCompra`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            credentials: "include" // Inclui cookies na requisição (como sessão)
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Erro ao enviar requisição:", error.message);
        throw error; // Propaga o erro para ser tratado pelo chamador
    }
}

// Check o saldo antes de enviar para API
export async function checkBalance(item, walletAddress) {
    console.log("Check balance");

    // Validação de entradas
    if (!walletAddress || typeof walletAddress !== 'string') {
        console.error("Erro: walletAddress inválido ou não definido!");
        return { error: "Endereço de carteira inválido" };
    }

    if (!item || typeof item !== 'object' || !item.itemNome || !item.itemPreco) {
        console.error("Erro: Item inválido ou não definido.");
        return { error: "Item inválido" };
    }

    // Validação adicional do preço do item
    const itemPrice = parseFloat(item.itemPreco);
    if (isNaN(itemPrice) || itemPrice < 0) {
        console.error("Erro: Preço do item inválido");
        return { error: "Preço do item inválido" };
    }

    // Chamada para o backend para processar a compra
    try {
        const resultado = await processarCompra(walletAddress, item.itemNome, 1); // Quantidade padrão: 1

        if (!resultado.error) {
            // Atualiza dados do usuário e toda a UI (contadores, inventário, etc)
            const userData = await updatePlayerStatus(walletAddress);
            const items = await fetchItems();
            userData.items = items;
            window.userData = userData;
            atualizarDadosLocais(userData); // Isso já chama atualizarUIComDadosLocais()
        }

        return resultado;
    } catch (error) {
        console.error("Erro ao processar compra:", error.message);
        return { error: error.message }; // Retorna o erro para ser tratado pelo chamador
    }
}

//#endregion

// Só use updatePlayerStatus após ações de escrita (compra, plantar, colher, etc)
// Para renderização normal, use window.userData
