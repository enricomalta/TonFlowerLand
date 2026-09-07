import { 
    autoUpdate,
    UpdateUI
} from './ui/hud.js';

import {
    playOpen,
    showModalInformationUtility,
} from './ui/modal-hook.js';

// const API_URL = "https://localhost:443"

export const API_URL = "https://ton-flower-land-back-end.vercel.app"
export let items = {}; // Inicializando o objeto de itens

// Função helper para normalizar propriedades dos itens vindos da API
function normalizeItem(item) {
    if (!item) return null;
    
    return {
        itemId: item.itemId || item.item_id || '',
        itemNome: item.itemNome || item.item_nome || '',
        itemPreco: item.itemPreco || item.item_preco || '0',
        itemTime: item.itemTime || item.item_time || '0',
        itemPay: item.itemPay || item.item_pay || '0',
        itemPayPorcentage: item.itemPayPorcentage || item.item_pay_porcentage || '0%',
        itemValidade: item.itemValidade || item.item_validade || '0',
        raridade: item.raridade || '1',
        rating: item.rating || '0%',
        xp: item.xp || 0
    };
}

//#region USER FUNCTIONS

// Criar um novo usuário
export async function createUser(walletAddress) {
    const telegramWebApp = window.Telegram.WebApp;
    const telegramUserId = telegramWebApp.initDataUnsafe.user.id;
    try {
        const idempotencyKey = generateIdempotencyKey();
        const response = await fetch(`${API_URL}/createUser`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-idempotency-key": idempotencyKey
            },
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
            const idempotencyKey = generateIdempotencyKey();
            const createResponse = await fetch(`${API_URL}/createUser`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-idempotency-key": idempotencyKey
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

        // Normaliza e atualiza a variável `items` global
        items = data.items.map(normalizeItem).filter(item => item !== null);

        // Atualiza os slots na interface com os dados recebidos
        items.forEach(item => {
            let slotIndex;
            const isUtilitario = typeof item.itemId === 'string' && item.itemId.startsWith('u'); // Verifica se começa com 'u'

            if (isUtilitario) {
                const utilityNum = parseInt(item.itemId.replace('u', ''), 10);
                slotIndex = 18 + utilityNum; // u1 → 19, u2 → 20...
            } else {
                slotIndex = parseInt(item.itemId, 10); // Mantém ID como slot para sementes
            }

            // Verifica se slotIndex é um número válido
            if (isNaN(slotIndex) || slotIndex < 1) {
                console.warn('SlotIndex inválido para item:', item, 'itemId:', item.itemId, 'slotIndex:', slotIndex);
                return;
            }

            const titleElement = document.getElementById(`titleSlotName${slotIndex}`);
            const priceElement = document.getElementById(`priceSlotValue${slotIndex}`);
            const shopSlotElement = document.getElementById(`shopSlot${slotIndex}`);
            const titleColorElement = document.getElementById(`titleSlot${slotIndex}`);

            // Adiciona o data-translate dinamicamente
            titleElement.setAttribute('data-translate', item.itemNome);


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
                const raridade = isUtilitario ? 1 : parseInt(String(item.raridade).trim(), 10) || 1;
                const raridadeVar = raridadeClasses[raridade] || "--incomun-color"; // Padrão: Incomum

                titleColorElement.style.backgroundColor = `var(${raridadeVar})`;

                if (raridade === 7) {
                    titleElement.style.color = "var(--txt-text)";
                }
            }
        });

         // Disparar evento indicando que os itens foram carregados
         document.dispatchEvent(new Event("itemsLoaded"));

        return items; // Retorna os itens normalizados para quem chamou
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
        console.error("Nenhum token encontrado!");
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
        const idempotencyKey = generateIdempotencyKey();
        const response = await fetch(`${API_URL}/plantSeed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-idempotency-key": idempotencyKey
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

// Função no frontend para a nova rota
export async function checkPlantTime(walletAddress) {
    try {
        if (!walletAddress) {
            console.error("Erro: walletAddress não fornecido para checkPlantTime.");
            return [];
        }
        const response = await fetch(`${API_URL}/checkPlantTime/${walletAddress}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',

            },
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const plantTimes = await response.json();
        return plantTimes;
        
    } catch (error) {
        console.error('Erro ao buscar plant_time:', error);
        return [];
    }
}

// Função atualizar status da planta
export async function updatePlantStatus(walletAddress, slotId, statusField, newValue, utilityName) {
    try {
        console.log(`Enviando requisição para atualizar ${statusField} no vaso ${slotId} usando ${utilityName}`);
        
        // Força sincronização dos dados antes de atualizar status
        const userData = await updatePlayerStatus(walletAddress);
        if (!userData) {
            throw new Error("Não foi possível obter dados do usuário");
        }
        
        // Corrija a URL para apontar para o servidor Node.js na porta 3000 (sem /api/)
        const payload = {
            walletAddress,
            slotId,
            statusField,
            newValue,
            utilityName // Adicione o nome do utilitário para verificação no backend
        };
        
        console.log("Enviando para updatePlantStatus:", payload);
        
        const idempotencyKey = generateIdempotencyKey();
        const response = await fetch(`${API_URL}/updatePlantStatus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-idempotency-key': idempotencyKey
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: `Erro na resposta: ${response.status} ${response.statusText}` };
            }
            console.error("Erro detalhado do backend:", errorData);
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
export async function applyUtilityToPlant(walletAddress, slotId, utility, vaseData) {
    try {
        if (!walletAddress) {
            console.error("Erro: walletAddress não fornecido para applyUtilityToPlant.");
            return;
        }
        
        // Debug dos dados antes de aplicar utilitário
        console.log("Debug applyUtilityToPlant:", {
            walletAddress,
            slotId,
            utility: utility.itemNome,
            vaseData: vaseData ? "presente" : "ausente",
            userDataInventario: window.userData?.inventario ? typeof window.userData.inventario : "não encontrado"
        });

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

        // Garante que o usuário tem dados atualizados antes de aplicar utilitário
        const currentUserData = await updatePlayerStatus(walletAddress);
        if (!currentUserData) {
            throw new Error("Não foi possível obter dados atualizados do usuário");
        }
        
        // Verifica se o usuário tem o utilitário no inventário
        if (!hasUtilityInInventory(currentUserData, utility.itemNome)) {
            throw new Error(`Usuário não possui ${utility.itemNome} no inventário`);
        }

        // Verifica se a planta já está no estado desejado
        if (vaseData && vaseData.growthStatus) {
            const currentStatus = vaseData.growthStatus[statusField];
            
            // ✅ CORREÇÃO: Lógica diferente para cada utilitário
            switch (utility.itemNome) {
                case "Regador":
                    // Verifica se já está regado (isWatered = true)
                    if (currentStatus === true) {
                        showModalInformationUtility('A planta já está regada!💧');
                        document.getElementById("modalInformationUtility").style.height = "70px";
                        console.log('Planta já está regada');
                        return { success: true };
                    }
                    break;
                    
                case "Fertilizante":
                    // Verifica se já está fertilizado (isFertilized = true)
                    if (currentStatus === true) {
                        showModalInformationUtility('A planta já está fertilizada!🌱');
                        document.getElementById("modalInformationUtility").style.height = "70px";
                        console.log('Planta já está fertilizada');
                        return { success: true };
                    }
                    break;
                    
                case "Anti-Parasitas":
                    // ✅ CORREÇÃO: Verifica se JÁ ESTÁ PROTEGIDO (isProtected = true)
                    if (vaseData.growthStatus.isProtected === true) {
                        showModalInformationUtility('A planta já está protegida contra parasitas!🛡️');
                        document.getElementById("modalInformationUtility").style.height = "90px";
                        console.log('Planta já está protegida (isProtected = true)');
                        return { success: true };
                    }
                    break;
                    
                default:
                    // Para outros utilitários, verificação genérica
                    if (currentStatus === newValue) {
                        showModalInformationUtility('Você já aplicou isso aqui!🤣');
                        console.log(`Estado já é o desejado: ${statusField} = ${newValue}`);
                        return { success: true };
                    }
            }
        }

        const result = await updatePlantStatus(
            walletAddress,
            slotId,
            statusField,
            newValue,
            utility.itemNome
        );

        if (result.updatedPlant || result.success) {
            // Atualiza dados locais e UI após aplicar utilitário
            if (window.atualizarDadosLocaisAposAcao) {
                await window.atualizarDadosLocaisAposAcao(walletAddress);
            } else if (window.updateUIAndInventory) {
                await window.updateUIAndInventory(walletAddress);
            }
            playOpen();
            return { success: true };
        } else {
            throw new Error("Falha ao aplicar utilitário");
        }
    } catch (error) {
        console.error("Erro ao aplicar utilitário:", error);
    }
}

// Função para remover parasita
export async function onRemoveParasita(walletAddress, slotId) {
    try {
        const idempotencyKey = generateIdempotencyKey();
        const response = await fetch(`${API_URL}/removeParasita`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-idempotency-key": idempotencyKey
            },
            credentials: "include",
            body: JSON.stringify({ walletAddress, slotId })
        });
        const data = await response.json();
        UpdateUI(walletAddress);
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
        const idempotencyKey = generateIdempotencyKey();
        const response = await fetch(`${API_URL}/colectSeed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-idempotency-key": idempotencyKey
            },
            body: JSON.stringify({ walletAddress, slotID }),
            credentials: 'include' // Para enviar o cookie JWT
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erro ao coletar a planta.");
        }

        UpdateUI(walletAddress); // Atualiza UI após coleta

        return data;
    } catch (error) {
        console.error("Erro na API:", error.message);
        return { error: error.message };
    }
}



//#endregion



//#region COMPRAR FUNCTIONS

// Função para gerar chave de idempotência única
function generateIdempotencyKey() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Função para verificar se o usuário tem o utilitário no inventário
function hasUtilityInInventory(userData, utilityName) {
    if (!userData || !userData.inventario) return false;
    
    let inventario = userData.inventario;
    
    // Normaliza inventário se for string
    if (typeof inventario === 'string') {
        try {
            inventario = JSON.parse(inventario);
        } catch (e) {
            console.error("Erro ao fazer parse do inventário:", e);
            return false;
        }
    }
    
    // Se for array no formato ["Item:quantidade"]
    if (Array.isArray(inventario)) {
        return inventario.some(item => {
            const [itemNome] = item.split(':');
            return itemNome.trim() === utilityName;
        });
    }
    
    // Se for objeto {Item: quantidade}
    if (typeof inventario === 'object') {
        return Object.keys(inventario).includes(utilityName);
    }
    
    return false;
}

// Adiciona um item do inventario
export async function processarCompra(walletAddress, itemNome, quantidade) {
    console.log("Chamando API de Compra");
    try {
        const payload = {
            walletAddress,
            itemNome,
            quantidade
        };

        const idempotencyKey = generateIdempotencyKey();
        
        const response = await fetch(`${API_URL}/processarCompra`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-idempotency-key": idempotencyKey
            },
            body: JSON.stringify(payload),
            credentials: "include" // Inclui cookies na requisição (como sessão)
        });

let data;
try {
  data = await response.json();
} catch {
  data = { error: "Resposta inválida da API", status: response.status };
}

if (!response.ok) {
  console.error("Erro da API:", data);
  throw new Error(data.error || "Erro na requisição");
}

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
            UpdateUI(walletAddress);
            // atualizarDadosLocais(userData); // Isso já chama atualizarUIComDadosLocais()
        }

        return resultado;
    } catch (error) {
        console.error("Erro ao processar compra:", error.message);
        return { error: error.message }; // Retorna o erro para ser tratado pelo chamador
    }
}

//#endregion
