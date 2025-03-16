import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';
import { items, onSlotClick, updatePlayerStatus, fetchItems, plantSeed, colectSeed } from './api.js';

// const API_URL = "http://192.168.0.100:3000"; Debug
const API_URL = "https://ton-flower-land-back-end.vercel.app"; // Prod
let tonConnect;
let selectPlant = false; // Armazena a planta selecionada
let selectedVaseSlot = null; // Armazena o slot do vaso onde o jogador quer plantar
let selectedPlantSlot = null; // Armazena o slot da planta onde jogador quer inspecionar
let showSpecialItems = false; // Mostra utilizarios ao clicar no vaso plantado
let walletAddress; // Armazena a wallet adress
const activeIntervals = {}; // Temporazidores
const activePlantIntervals = {}; // Planta Update UI/Crescimento

//#region ID Elements
const walletModal = document.getElementById("walletModal");
const playModal = document.getElementById("playModal");
const btnShopOpen = document.getElementById("btnShopOpen");
const btnShopMenu = document.getElementById("btnShopMenu");
const btnPlayMenu = document.getElementById("btnPlayMenu");
const btnInventoryOpen = document.getElementById("btnInventoryOpen");
const btnTradeOpen = document.getElementById("btnTradeOpen");
const btnConfigOpen = document.getElementById("btnConfigOpen");
const btnPlayOpen = document.getElementById("btnPlayOpen");
const btnWalletDisconnect = document.getElementById("btnWalletDisconnect");
const top = document.getElementById("top");
const down = document.getElementById("down");
const middle = document.getElementById("middle");
const input = document.querySelector(".coinNumber input");
//#endregion











// WEB3


// Inicializa o TonConnect
async function initializeTonConnect() {
    checkExistingSession();
    try {
        console.log("Inicializando TonConnect...");

        tonConnect = new TonConnect({
            manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',
            storage: {
                setItem: (key, value) => { sessionStorage[key] = value; },
                getItem: (key) => sessionStorage[key] || null,
                removeItem: (key) => { delete sessionStorage[key]; }
            }
        });

        console.log("TonConnect inicializado:", tonConnect);
        // Configura o listener para mudanças de status da wallet
        tonConnect.onStatusChange(wallet => {
            if (wallet) {
                console.log("✅ Status da wallet mudou - Conectada:", wallet);
                handleWalletConnected(wallet);
            } else {
                console.log("❌ Status da wallet mudou - Desconectada");
            }
        });

        return tonConnect;
    } catch (error) {
        console.error("Erro ao inicializar o TonConnect:", error);
        throw error;
    }
}

// No index.js, adicione uma função para verificar a sessão existente
async function checkExistingSession() {
    try {
        // Tentar buscar o perfil do usuário atual
        const response = await fetch(`${API_URL}/session/check`, {
            method: "GET",
            credentials: 'include' // Para enviar o cookie JWT
        });

        if (response.ok) {
            const userData = await response.json();
            console.log("Sessão existente encontrada:", userData);
            
            // Preencher o campo de endereço
            const web3AdressInput = document.getElementById("adressInput");
            web3AdressInput.value = userData.walletAddress;
            
            // Atualizar UI como se a wallet estivesse conectada
            updateUIForConnectedWallet({
                account: { address: userData.walletAddress }
            });
            
            // Carregar os dados do perfil
            await fetchProfile(userData.walletAddress);
            await updateUIAndInventory(userData.walletAddress);
            console.log(userData.walletAddress);
            return true; // Sessão válida
        }
        
        return false; // Sem sessão
    } catch (error) {
        console.error("Erro ao verificar sessão:", error);
        return false;
    }
}

// No frontend, função para renovar o token
async function renewToken() {
    try {
        const response = await fetch(`${API_URL}/renew-token`, {
            method: "POST",
            credentials: 'include' // Para enviar o cookie JWT
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("Token renovado com sucesso");
            
            // Atualizar o token no localStorage também
            if (data.token) {
                localStorage.setItem("authToken", data.token);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Erro ao renovar token:", error);
        return false;
    }
}

// Configurar timer para renovar o token a cada 6 dias (se o token dura 7 dias)
function setupTokenRenewal() {
    // Renovar a cada 6 dias (em milissegundos)
    const renewalInterval = 6 * 24 * 3600 * 1000;
    
    setInterval(async () => {
        console.log("Tentando renovar o token...");
        await renewToken();
    }, renewalInterval);
}

// Função para conectar à Wallet
async function connectWallet() {
    try {
        if (!tonConnect) {
            console.log("TonConnect não inicializado, tentando novamente...");
            await initializeTonConnect();
        }

        console.log("🔗 Tentando conectar à Wallet...");

        const activeWallet = tonConnect.wallet;
        if (activeWallet) {
            console.log("✅ Carteira já conectada:", activeWallet);
            updateUIForConnectedWallet(activeWallet);
            return activeWallet.account.address;
        }

        const walletsList = await tonConnect.getWallets();
        console.log("Wallets disponíveis:", walletsList);

        let telegramWallet = walletsList.find(wallet => wallet.name.toLowerCase().includes('telegram')) || walletsList[0];
        const connectResult = await tonConnect.connect({
            universalLink: telegramWallet.universalLink,
            bridgeUrl: telegramWallet.bridgeUrl,
        });

        if (typeof connectResult === 'string' && connectResult.startsWith('http')) {
            localStorage.setItem('connectingWallet', 'true');
            localStorage.setItem('walletAddress', connectResult); 
            window.open(connectResult, '_blank');
            return null; // Retorna null até o usuário voltar da conexão
        }

        if (!connectResult || !connectResult.account) {
            throw new Error("❌ A Wallet não retornou uma conta válida.");
        }

        console.log("✅ Carteira conectada com sucesso!");
        // Armazena o endereço globalmente
        window.walletAddress = connectResult.account.address;
        console.log("Endereço Global",window.walletAddress);
        updateUIForConnectedWallet(connectResult);
        return connectResult.account.address;
    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error);
        return null;
    }
}

async function logout() {
    try {

        // Desconectar a wallet se estiver usando TonConnect
        if (tonConnect && tonConnect.wallet) {
            await tonConnect.disconnect();
        }
        
        // Limpar o token do localStorage
        localStorage.removeItem("authToken");
        
        // Chamar endpoint para limpar o cookie
        await fetch(`${API_URL}/logout`, {
            method: "POST",
            credentials: 'include'
        });
        
        // Atualizar a UI para o estado desconectado
        updateUIForDisconnectedWallet();
        closeAllModals();
        
        console.log("Logout realizado com sucesso");
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
}



// Wallet Connection
async function handleWalletConnect(address) {
    walletConnect = true; // Marca que a wallet foi conectada
    walletAddress = address || ""; // Recebe o endereço da wallet


    // Outros processos como o login e inicialização de perfil podem ser feitos depois
    try {
        console.log("Login com a wallet:", walletAddress);

        const userProfile = await fetchProfile(walletAddress);  // Carrega o perfil do usuário
        if (userProfile) {
            addSlotClickListeners(walletAddress);
            await updateVasoAndPlantImages(walletAddress);
            playOpen();
            const userData = await updatePlayerStatus(walletAddress);
            if (userData) {
                await updateUIAndInventory();
            } else {
                console.error("Erro: Dados do jogador não foram carregados corretamente.");
            }
        } else {
            console.error("Erro ao buscar perfil do usuário.");
        }
    } catch (error) {
        console.error("Erro ao processar login:", error);
    }
}

// Processa a wallet conectada
async function handleWalletConnected(wallet) {
    try {
        const web3AdressInput = document.getElementById("adressInput");
        console.log("Processando wallet conectada:", wallet);
        
        // Extrair o endereço da wallet
        const walletAddress = wallet.account.address;
        web3AdressInput.value = walletAddress;
        
        // Armazenar o endereço da wallet globalmente
        window.walletAddress = walletAddress;
        console.log("Endereço da wallet armazenado:", window.walletAddress);
        
        // Primeiro verificar se o usuário existe ou criar um novo
        console.log("Verificando usuário na API...");
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress }),
            credentials: 'include' // Importante para enviar e receber cookies
        });

        if (!response.ok) {
            // Se o login falhar com um erro 404 (usuário não encontrado), criamos um novo usuário
            if (response.status === 404) {
                console.log("Usuário não encontrado, criando um novo usuário...");
                
                const createResponse = await fetch(`${API_URL}/createUser`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ walletAddress }),
                    credentials: 'include' // Importante para cookies
                });

                if (!createResponse.ok) {
                    throw new Error("Erro ao criar usuário.");
                }
                console.log("Usuário criado com sucesso!");
            } else {
                throw new Error(`Erro ao realizar login: ${response.status} ${response.statusText}`);
            }
        }
        
        // Agora que o usuário existe, buscar os dados atualizados
        console.log("Buscando dados do usuário...");
        const userData = await updatePlayerStatus(walletAddress);
        console.log("Dados do usuário recebidos:", userData);
        
        if (!userData) {
            console.error("Erro: Dados do jogador não foram carregados corretamente.");
            return;
        }


        console.log("Login com a wallet:", walletAddress);
        const userProfile = await fetchProfile(walletAddress);  // Carrega o perfil do usuário
        if (userProfile) {
            addSlotClickListeners(walletAddress);
            await updateVasoAndPlantImages(walletAddress);
            playOpen();
            const userData = await updatePlayerStatus(walletAddress);
            if (userData) {
                await updateUIAndInventory(walletAddress);
            } else {
                console.error("Erro: Dados do jogador não foram carregados corretamente.");
            }
        }


        
        // Atualizar UI para wallet conectada
        updateUIForConnectedWallet(wallet);
        
        // Armazenar os dados globalmente e atualizar UI
        window.userData = userData;
        
        // Verificar se há vasos no inventário
        let quantityVasos = 0;
        if (Array.isArray(userData.inventario)) {
            const vasoItem = userData.inventario.find(item => item.startsWith("Vaso:"));
            if (vasoItem) {
                quantityVasos = parseInt(vasoItem.split(":")[1].trim()) || 0;
            }
        }
        window.quantityVasos = quantityVasos;
        
        // Atualizar toda a UI com os dados obtidos
        await updateUIAndInventory(walletAddress);
        
        // Configurar renovação do token
        setupTokenRenewal();
        
        console.log("Conexão da wallet processada com sucesso!");
        
    } catch (error) {
        console.error("Erro ao processar o login:", error);
        alert("Erro ao conectar sua wallet. Por favor, tente novamente.");
    }
}




async function login(walletAddress) {
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ walletAddress }),
            credentials: "include"  // Isso inclui os cookies na requisição
        });

        if (!response.ok) {
            throw new Error(`Erro no login: ${response.status}`);
        }

        const data = await response.json();
        console.log("Resposta completa da API:", data);

        return data.token;  // Retorna o token que foi enviado diretamente na resposta
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        return null;  // Retorna null se houver erro
    }
}


async function fetchProfile(walletAddress) {
    try {
        const response = await fetch(`${API_URL}/user/${walletAddress}`, {
            method: "GET",
            credentials: 'include' // Importante para enviar cookies
        });

        if (!response.ok) {
            throw new Error(`Erro ao buscar perfil: ${response.status}`);
        }

        const profileData = await response.json();
        console.log("Dados do perfil:", profileData);
        
        // Atualizar UI com os dados do perfil
        // updateProfileUI(profileData);
        
        return profileData;
    } catch (error) {
        console.error("Erro ao buscar perfil:", error);
    }
}


// Verifica se estamos em um WebApp do Telegram
function isTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp;
}

// Solicita um desafio ao backend
async function fetchChallenge(walletAddress) {
    console.log("🔄 Solicitando desafio do backend...");
    const response = await fetch(`${API_URL}/generate-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
        throw new Error("Erro ao obter desafio do backend.");
    }

    const { challenge } = await response.json();
    console.log("Desafio recebido:", challenge);
    return challenge;
}

// Assina um desafio
async function signChallenge(walletAddress) {
    try {
        const challenge = await fetchChallenge(walletAddress);

        console.log("Assinando desafio via transação...");
        const transaction = await tonConnect.sendTransaction({
            validUntil: Math.floor(Date.now() / 1000) + 60,
            messages: [{ address: walletAddress, amount: "0", payload: challenge }],
        });

        console.log("Transação enviada:", transaction);
        const verifyResponse = await fetch(`${API_URL}/verify-transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, challenge, transaction }),
        });

        const verifyData = await verifyResponse.json();
        if (verifyData.success && verifyData.userCreated) {
            console.log("Usuário criado com sucesso no backend!");
            return verifyData;
        }
    } catch (error) {
        console.error("Erro ao assinar desafio:", error);
        return null;
    }
}

// Verifica a assinatura do usuário
async function verifySignature(walletAddress, signature) {
    try {
        const response = await fetch(`${API_URL}/verify-signature`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, signature }),
        });

        const data = await response.json();
        if (data.verified) {
            alert("✅ Login bem-sucedido!");
        } else {
            alert("❌ Assinatura inválida.");
        }
    } catch (error) {
        console.error("Erro ao verificar assinatura:", error);
        alert("Erro ao verificar assinatura.");
    }
}

// Realiza o login com a wallet TON
async function loginWithTON() {
    try {
        const walletAddress = await connectWallet();
        if (!walletAddress) {
            console.log("Aguardando conexão da wallet...");
            return;
        }

        const signature = await signChallenge(walletAddress);
        if (!signature) {
            console.log("Não foi possível obter a assinatura");
            return;
        }

        await verifySignature(walletAddress, signature);
    } catch (error) {
        console.error("Erro no login com TON:", error);
    }
}

// Função principal de inicialização
async function initApp() {
    try {
        // Verificar se já existe uma sessão ativa
        const hasSession = await checkExistingSession();
        
        if (!hasSession) {
            // Se não tiver sessão, inicializar o TonConnect normalmente
            await initializeTonConnect();
            console.log("🔗 Tentando conectar à Wallet...");
            
            // Listar wallets disponíveis
            const wallets = await getWallets();
            console.log("Wallets disponíveis:", wallets);
            
            // Aqui você pode mostrar uma mensagem ou botão para o usuário conectar a wallet
            updateUIForDisconnectedWallet();
            
        } else {
            // Se já tem sessão, ainda precisamos inicializar o TonConnect para outras operações
            // mas não precisamos pedir ao usuário para conectar novamente
            await initializeTonConnect();
            console.log("Sessão existente encontrada, não é necessário conectar wallet novamente");
            
            // Recuperar o endereço da wallet da sessão
            const userData = await fetch(`${API_URL}/session/check`, {
                method: "GET",
                credentials: 'include'
            }).then(res => res.json());
            
            if (userData && userData.walletAddress) {
                window.walletAddress = userData.walletAddress;
                console.log("Endereço da wallet recuperado da sessão:", window.walletAddress);
            }
        }
        
        // Outras inicializações...
        
    } catch (error) {
        console.error("Erro ao inicializar o aplicativo:", error);
    }
}


























// UI UPDATE



// Atualizar UI (Contadores, Inventário e Loja)
async function updateUIAndInventory(walletAddress) {
    const raridadeClasses = {
        1: "--incomun-color",
        2: "--comun-color",
        3: "--raro-color",
        4: "--epico-color",
        5: "--lendario-color",
        6: "--mitico-color",
        7: "--desconhecido-color"
    };
    
    try {
        // Tenta usar o parâmetro ou recorrer ao valor global
        const addressToUse = walletAddress || window.walletAddress;
        if (!addressToUse) {
            console.error("Endereço da wallet não encontrado.");
            return;
        }
        
        // 1. Atualiza os dados do jogador
        const userData = await updatePlayerStatus(addressToUse);
        if (!userData) {
            console.error("Erro ao obter os dados do jogador.");
            return;
        }
        
        // Armazena os dados do jogador globalmente para consultas
        window.userData = userData;
        // console.log("✅ Dados do usuário carregados:", window.userData);
        
        // 2. Atualiza os contadores do jogador
        const criptoBalanceElement = document.getElementById("criptoBalance");
        const tokenBalanceElement = document.getElementById("tokenBalance");
        if (criptoBalanceElement) {
            criptoBalanceElement.value = userData.criptoBalance || "0.00";
        } else {
            console.warn("Elemento 'criptoBalance' não encontrado.");
        }
        if (tokenBalanceElement) {
            tokenBalanceElement.value = userData.tokenBalance || "0.00";
        } else {
            console.warn("Elemento 'tokenBalance' não encontrado.");
        }
        
        // Atualiza o Inventário do jogador e os Vasos
        if (Array.isArray(userData.plantTime) && userData.plantTime.length > 0) {
            updateVasosUI(userData); // Atualiza os vasos e a contagem dinâmica
        }
        
        // 3. Atualiza a loja (Itens disponíveis para compra)
        const items = await fetchItems(); // Busca os itens da loja no banco de dados
        if (items && items.length > 0) {
            window.userData.items = items; // 🔥 Salvar os itens no userData global
            // console.log("✅ Itens carregados no userData:", window.userData.items);
            items.forEach((item, index) => {
                const slotIndex = index + 1;
                const titleElement = document.querySelector(`#titleShopSlot${slotIndex} h1`);
                if (titleElement) {
                    titleElement.textContent = item.itemNome;
                }
                const imgElement = document.querySelector(`#imgSlotShop${slotIndex}`);
                if (imgElement) {
                    imgElement.src = `img/shop/${item.itemId}.png`; // Diretamente do itemId
                }
                const priceElement = document.querySelector(`#priceSlotShop${slotIndex}`);
                if (priceElement) {
                    priceElement.textContent = item.price || "0.00";
                }
                const slotElement = document.querySelector(`#titleShopSlot${slotIndex}`);
                if (slotElement) {
                    const raridadeVar = raridadeClasses[item.raridade] || "--incomun-color";
                    slotElement.style.backgroundColor = `var(${raridadeVar})`;
                    if (item.raridade === "7") {
                        titleElement.style.color = `var(--txt-text)`;
                    }
                }
            });
        } else {
            console.warn("Nenhum item encontrado na loja.");
        }
        
        // 4. Atualiza o Inventário do jogador (Itens)
        if (!Array.isArray(userData.inventario)) {
            console.error("Inventário não encontrado ou inválido.");
            return;
        }
        
        const itemMap = {
            "Vaso": "quantityVasos",
            "Regador": "quantityAgua",
            "Fertilizante": "quantityFertilize",
            "Anti-Parasitas": "quantityAntiParasita",
            "Estrela": "quantityStar",
        };
        
        let quantityVasos = 0;
        let quantityStar = 0;
        userData.inventario.forEach(item => {
            const [itemNome, quantidade] = item.split(":").map(part => part.trim());
            const elementId = itemMap[itemNome];
            const element = document.getElementById(elementId);
            if (itemNome === "Vaso") {
                quantityVasos = parseInt(quantidade) || 0;  // Armazena a quantidade de vasos
                window.quantityVasos = quantityVasos; // Salva globalmente para uso em outras funções
            } else if (itemNome === "Estrela") {
                quantityStar = parseInt(quantidade) || 0;  // Armazena a quantidade de estrelas
            }
            if (element) {
                // Se for "Vaso" ou "Estrela", adiciona "/100", caso contrário, só exibe a quantidade
                element.value = (itemNome === "Vaso" || itemNome === "Estrela")
                    ? `${quantidade}/100`
                    : quantidade || "0";
            }
        });
        
        // 5. Atualiza Dispay GameBoard Vasos
        updatePlayBoard(quantityVasos);
        attachSlotClickEvents(quantityVasos);
        updateVasosUI(userData);
        updateVasoAndPlantImages(addressToUse);
        
        // 6. Atualiza os slots restantes (sementes, etc.)
        const remainingItems = userData.inventario.filter(item => {
            const [itemNome] = item.split(":");
            return !itemMap[itemNome.trim()];
        });
        
        remainingItems.forEach((item, index) => {
            const partes = item.split(":");
            const itemNome = partes[0].trim();
            const quantidade = partes[1].trim();
            const matchingItem = items.find(i => i.itemNome === itemNome); // Busca o item na loja
            if (!matchingItem) {
                console.warn(`Item '${itemNome}' não encontrado nos dados da loja.`);
                return;
            }
            
            const slotIndex = index + 1;
            const titleElement = document.querySelector(`#titleInvetorySlot${slotIndex}`);
            const imgElement = document.querySelector(`#imgSlotInventory${slotIndex}`);
            const quantityElement = document.querySelector(`#quantityItemInventory${slotIndex}`);
            
            if (titleElement) {
                titleElement.textContent = itemNome;
                const raridadeVar = raridadeClasses[matchingItem.raridade] || "--incomun-color";
                titleElement.style.backgroundColor = `var(${raridadeVar})`;
                if (matchingItem.raridade === "7") {
                    titleElement.style.color = `var(--txt-text)`;
                }
            }
            
            if (imgElement) {
                imgElement.src = `img/shop/${matchingItem.itemId}.png`;
            }
            
            if (quantityElement) {
                quantityElement.textContent = quantidade;
            }
        });
        
        return userData;
    } catch (error) {
        console.error("Erro ao atualizar UI e inventário:", error);
        return null;
    }
}
// Atualizar Slots Vasos com base na quantidade de vasos do jogaor
function updatePlayBoard(quantityVasos) {
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
// Atualiza contador e seta foto da planta
async function updateVasosUI(userData) {
    try {
        
        
        const plantTimes = userData.plantTime;
        if (!Array.isArray(plantTimes) || plantTimes.length === 0) {
            console.warn("Nenhum tempo de plantio encontrado.");
            return;
        }
        
        // Define activeIntervals se não existir
        if (typeof activeIntervals === 'undefined') {
            window.activeIntervals = {};
        }
        
        // Função para atualizar o contador e adicionar o evento de clique
        const updatePlantCounter = (slotID, harvestTimestamp) => {
            const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
            if (!plantTimerElement) return;
            
            // Remove event listener anterior (evita duplicação)
            plantTimerElement.onclick = null;
            
            // Adiciona evento de clique para verificar a colheita
            plantTimerElement.addEventListener("click", async () => {
                const currentTimestamp = Date.now();
                if (currentTimestamp >= harvestTimestamp) {
                    console.log(`Slot ${slotID} pronto! Coletando...`);
                    try {
                        verifyAndCollectSeed(walletAddress, slotID);
                        console.log("Resultado da colheita:", walletAddress);
                        plantTimerElement.innerText = "Colhido!";
                        clearInterval(activeIntervals[slotID]); // Para o contador
                        delete activeIntervals[slotID]; // Remove o intervalo da lista
                    } catch (error) {
                        console.error("Erro ao coletar planta:", error);
                    }
                } else {
                    console.warn(`Slot ${slotID} ainda não está pronto para colher.`);
                }
            });
            
            // Se já existir um contador para esse slot, limpa antes de criar um novo
            if (activeIntervals[slotID]) {
                clearInterval(activeIntervals[slotID]);
            }
            
            activeIntervals[slotID] = setInterval(() => {
                const currentTimestamp = Date.now();
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
            const { slotID, itemNome, harvestDate, itemId, raridade } = plant;
            if (!itemId) {
                console.warn(`itemId não encontrado para a planta no slot ${slotID}.`);
                continue;
            }
            
            const harvestTimestamp = (harvestDate._seconds * 1000) + (harvestDate._nanoseconds / 1000000);
            const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
            if (plantTimerElement) {
                updatePlantCounter(slotID, harvestTimestamp);
            }
            
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
const updateVasoAndPlantImages = async (walletAddress) => {
    // Define activePlantIntervals se não existir
    if (typeof activePlantIntervals === 'undefined') {
        window.activePlantIntervals = {};
    }
    
    // Tenta usar o parâmetro ou recorrer ao valor global
    const addressToUse = walletAddress || window.walletAddress;
    if (!addressToUse) {
        console.error("Endereço da wallet não encontrado.");
        return;
    }
    
    const userStatus = await updatePlayerStatus(addressToUse);
    if (!userStatus || !userStatus.plantTime || userStatus.plantTime.length === 0) {
        console.warn("Nenhuma planta ativa encontrada para o jogador.");
        return;
    }
    
    // console.log("Atualizando vasos e plantas...", userStatus.plantTime);
    userStatus.plantTime.forEach((plant) => {
        const { slotID, plantDate, harvestDate, itemTime, isFertilized } = plant;
        if (!slotID || !plantDate || !harvestDate || !itemTime) {
            console.warn(`Dados incompletos para o slot ${slotID}, pulando...`);
            return;
        }
        
        // Converter timestamps Firestore para milissegundos
        const plantTimestamp = (plantDate._seconds * 1000) + (plantDate._nanoseconds / 1000000);
        const harvestTimestamp = (harvestDate._seconds * 1000) + (harvestDate._nanoseconds / 1000000);
        const totalDuration = itemTime * 60 * 60 * 1000;
        
        // Se já existir um intervalo para esse slot, limpar antes de criar um novo
        if (activePlantIntervals[slotID]) {
            clearInterval(activePlantIntervals[slotID]);
        }
        
        // Função que verifica e atualiza o progresso da planta
        const updateProgress = () => {
            const currentTimestamp = Date.now();
            const timeElapsed = currentTimestamp - plantTimestamp;
            const timeRemaining = harvestTimestamp - currentTimestamp;
            const progress = timeElapsed / totalDuration;
            const spriteInicial = 0.10;
            const spriteFinal = 0.50;
            const vasoPhotoElement = document.getElementById(`vasoPhoto${slotID}`);
            const plantPhotoElement = document.getElementById(`plantPhoto${slotID}`);
            
            if (!vasoPhotoElement || !plantPhotoElement) {
                console.warn(`Elementos do slot ${slotID} não encontrados.`);
                return;
            }
            
            if (timeRemaining <= 0) {
                // Planta completamente crescida
                vasoPhotoElement.src = isFertilized ? "/img/play/002.png" : "/img/play/02.png";
                plantPhotoElement.style.display = "block";
                // Limpa o intervalo para evitar execuções desnecessárias
                clearInterval(activePlantIntervals[slotID]);
                delete activePlantIntervals[slotID];
            } else {
                // Atualizar vaso com base no progresso
                if (progress >= spriteFinal) {
                    vasoPhotoElement.src = isFertilized ? "/img/play/002.png" : "/img/play/02.png";
                } else if (progress >= spriteInicial) {
                    vasoPhotoElement.src = isFertilized ? "/img/play/001.png" : "/img/play/01.png";
                } else {
                    vasoPhotoElement.src = "/img/play/0.png";
                }
                // Exibir planta apenas quando atingir 50% do crescimento
                plantPhotoElement.style.display = progress >= spriteFinal ? "block" : "none";
            }
        };
        
        // Atualiza imediatamente e depois a cada segundo
        updateProgress();
        activePlantIntervals[slotID] = setInterval(updateProgress, 1000);
    });
};
// Atualiza a UI quando a wallet está conectada
function updateUIForConnectedWallet(wallet) {
    const top = document.getElementById("top");
    const down = document.getElementById("down");
    const middle = document.getElementById("middle");
    const walletModal = document.getElementById("walletModal");
    const playModal = document.getElementById("playModal");
    const playGameBoard = document.getElementById("playGameBoard");

    top.style.display = "flex";
    down.style.display = "flex";
    walletModal.style.display = "none";
    middle.style.height = "100%";
    walletModal.style.height = "559px";
    playModal.style.display = "flex";
    playGameBoard.style.display = "flex";
}
// Atualiza a UI quando a wallet está desconectada
function updateUIForDisconnectedWallet() {
    const top = document.getElementById("top");
    const down = document.getElementById("down");
    const middle = document.getElementById("middle");
    const walletModal = document.getElementById("walletModal");
    const playModal = document.getElementById("playModal");

    top.style.display = "none";
    down.style.display = "none";
    walletModal.style.display = "flex";
    middle.style.height = "100%";
    walletModal.style.height = "650px";
    playModal.style.display = "flex";
}
// Filtra utilirarios ao clicar no vaso depois de ter colocado a semente
function filterInventoryItems() {
    const allSlots = document.querySelectorAll(".playInvetorySlot");

    if (allSlots.length === 0) {
        console.error("Nenhum item encontrado no inventário!");
        return;
    }

    // Definição dos itens especiais (Regador, Fertilizante, Anti-Parasita)
    const specialItems = ["Regador", "Fertilizante", "Anti-Parasita"];

    allSlots.forEach(slot => {
        const slotId = slot.id.replace("playInvetorySlot", "");
        const itemTitleElement = document.querySelector(`#titleInvetorySlot${slotId}`);

        if (!itemTitleElement) return;

        const itemName = itemTitleElement.textContent.trim();

        // Se estiver abrindo pelo vaso, exibe plantas + especiais
        if (showSpecialItems) {
            const isSpecialItem = specialItems.includes(itemName);
            slot.style.display = "flex"; // Exibe todos os itens ao abrir pelo vaso
        } else {
            // Se estiver abrindo pelo menu, exibe apenas plantas (ocultando especiais)
            const isSpecialItem = specialItems.includes(itemName);
            slot.style.display = isSpecialItem ? "none" : "flex"; // Oculta itens especiais no menu de sementes
        }
    });
}
// Função para verificar a coletar da planta
async function verifyAndCollectSeed(walletAddress, slotID) {
    try {
        console.log(`Verificando se a planta do slot ${slotID} pode ser colhida...`);

        
        // Obtém os dados do jogador corretamente antes de chamar updatePlayerStatus
        const userData = await updatePlayerStatus(walletAddress);

        if (!userData || !userData.walletAddress) {
            console.error("Erro: walletAddress não encontrado!");
            return;
        }

        window.userData = walletAddress;


        // Busca os dados da planta novamente para garantir que pode ser colhida
        const plantTimes = userData.plantTime || [];
        const plant = plantTimes.find(p => p.slotID === slotID);

        if (!plant) {
            console.warn(`Nenhuma planta encontrada para o slot ${slotID}`);
            return;
        }

        console.log(`Slot ${slotID} pronto! Coletando...`);

        // Chama a API de coleta
        const data = await colectSeed(walletAddress, slotID);

        // Verifica se a API retornou um erro
        if (!data || data.error) {
            console.error("Erro ao coletar planta:", data?.error || "Resposta inválida da API.");
            return;
        }

        console.log("Resultado da colheita:", data);

        // Atualiza a UI indicando que foi colhido
        const plantTimerElement = document.getElementById(`plantTimer${slotID}`);
        if (plantTimerElement) {
            plantTimerElement.innerText = "Colhido!";
            soundRecolherPlanta();
            updateUIAndInventory();
        }
        console.warn(`Slot ${slotID} ainda não está pronto para colher.`);
    } catch (error) {
        console.error("Erro ao verificar e coletar a planta:", error);
    }
}
// Evento UI
window.addEventListener('updateUI', function (e) {
    updateDisplay();
    updateUIAndInventory();
    updatePlayBoard();
    updateVasosUI();
    updateVasoAndPlantImages();
});
// Evento Modificação Input
input.addEventListener("input", function () {
    let value = input.value.replace(/\D/g, "");
    input.value = new Intl.NumberFormat("pt-BR").format(value);
});



//#region Modal Funcion //
// Abre modal configurações
function configOpen() {
    const configModal = document.getElementById("configModal");

    if (configModal) {
        if (configModal.style.display === 'flex') {
            configModal.style.display = 'none';
            document.getElementById("playInvetoryContent").style.display = "flex";
        } else {
            configModal.style.display = 'flex';
            document.getElementById("playInvetoryContent").style.display = "none";
        }
    }
}
// Abre modal shop
function shopOpen(walletAddress) {
    closeAllModals();
    document.getElementById("shopModal").style.display = "flex";
    document.getElementById("subShopModal").style.display = "flex";
    
    // Usa o endereço passado ou recorre ao global
    const addressToUse = userData.walletAddress;
    
    if (!addressToUse) {
        console.error("Erro: Nenhum endereço de carteira disponível");
        alert("Por favor, conecte sua carteira antes de acessar a loja.");
        return;
    }
    
    addSlotClickListeners(addressToUse);
    setupPagination("shopModal", "shopArrowNext", "shopArrowLast", ".shopLayoutSlot", 3);
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
    document.getElementById("playInvetoryContent").style.display = "flex";
};
// Abre modal trade
function tradeOpen() {
    closeAllModals();
    document.getElementById("tradeModal").style.display = "flex";
}
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
        "playInvetoryContent",
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
    // updatePlayBoard(playerVases);
};
// Abre modal Inventario
function inventoryOpen() {
    selectPlant = false;
    closeAllModals();
    document.getElementById("playInvetory").style.display = "flex";
    document.getElementById("playModal").style.display = "flex";
    document.getElementById("playInvetoryContent").style.display = "flex";
    setupPagination("playInvetory", "playArrowNextInventory", "playArrowLastInventory", ".playInvetorySlots", 4);
    // Remove 'pointer' de todos os slots antes de abrir o inventário
    const allSlots = document.querySelectorAll(".playInvetorySlot");
    allSlots.forEach(slot => {
        slot.classList.remove("pointer");
    });
    updateUIAndInventory(walletAddress);

    // Se o inventário NÃO foi aberto pelo vaso, resetar filtro
    if (!showSpecialItems) {
        showSpecialItems = false;
    }

    filterInventoryItems(); // Aplica a lógica de exibição dos itens
}
// Função para atualizar a exibição das linhas
function updateDisplay(rows, arrowLast, arrowNext, currentPage, totalPages, itemsPerPage) {
    // console.log(`Atualizando exibição: ${rows ? rows.length : 0} slots encontrados.`);

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
function setupPagination(modalId, arrowNextId, arrowLastId, rowClass, itemsPerPage) {
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
// Evento para abrir o inventário ao clicar no vaso
function attachSlotClickEvents(quantityVasos) {
    document.querySelectorAll(".slotVasos").forEach(slot => {
        const slotIndex = parseInt(slot.id.replace("slotVasos", ""), 10);
        const vasoPhoto = slot.querySelector(".vasoPhoto");
        const plantPhoto = slot.querySelector(".plantPhoto");


        if (vasoPhoto) {
            const vasoSrc = vasoPhoto.getAttribute("src");

            if ((vasoSrc.includes("0.png") || vasoSrc.includes("00.png")) && slotIndex <= quantityVasos) {
                vasoPhoto.style.cursor = "url('../img/cursor/colher.png') 16 16, auto";
                vasoPhoto.addEventListener("click", () => {
                    selectedVaseSlot = slotIndex;

                    showSpecialItems = true; // Ativar filtro de itens especiais APENAS quando clicar no vaso
                    inventoryOpen(); // Abre o inventário

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
                // console.log(`Slot ${slotIndex} - plantPhoto atualizado: ${plantSrc}`);

                if (plantSrc && plantSrc.includes("/img/plant/") && slotIndex <= quantityVasos) {
                    plantPhoto.style.cursor = "url('../img/cursor/lupa.png') 16 16, auto";
                }
            });

            plantPhoto.addEventListener("click", () => {
                const plantSrc = plantPhoto.getAttribute("src"); // Obtém a imagem
                // console.log(`Clique na planta do slot ${slotIndex}: ${plantSrc}`);
                selectedPlantSlot = slotIndex;

                // Extrair o número da planta do src
                const plantIdMatch = plantSrc.match(/\/img\/plant\/(\d+)\.png/);
                if (!plantIdMatch) {
                    console.error("Erro ao extrair o ID da planta!");
                    return;
                }

                const plantId = plantIdMatch[1]; // Pega apenas o número da planta
                // console.log(`🔍 ID da planta extraído: ${plantId}`);

                // Buscar os dados no userData
                if (!window.userData || !Array.isArray(window.userData.items)) {
                    console.error("Dados do usuário não carregados corretamente!");
                    return;
                }

                const plantData = window.userData.items.find(plant => plant.itemId === plantId);

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
                    `;

                // Exibe o modal com informações da planta
                soundInspectPlant();
                showInspectModal(plantInfo);
            });


        }

    });
}
// Função para exibir o modal e esperar a resposta do usuário.
function showConfirmationModal(message) {
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
function showInspectModal(message) {
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
        }, 200); // Atraso de 100ms
    });
}
//Função para fechar o modal
function fecharModal() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("modalInformation").style.display = "none";
    document.getElementById("modalInformationInspect").style.display = "none";
}
//#endregion


// Evento para plantar ao clicar no item do inventário
document.querySelectorAll(".playInvetorySlot").forEach(slot => {
    slot.addEventListener("click", async (event) => {
        if (!selectedVaseSlot) {
            console.error("Nenhum vaso selecionado para plantar!");
            return;
        }

        const slotId = slot.id.replace("playInvetorySlot", "");
        const seedTitleElement = document.querySelector(`#titleInvetorySlot${slotId}`);
        if (!seedTitleElement) {
            console.error("Não foi possível encontrar o nome da flor!");
            return;
        }

        const selectedSeedName = seedTitleElement.textContent.trim();
        console.log("Buscando item com nome:", selectedSeedName); // Debugging

        // Verificar se a variável `items` está carregada corretamente
        if (!Array.isArray(items) || items.length === 0) {
            console.error("Itens não carregados corretamente. Verifique a função fetchItems.");
            console.log("Itens disponíveis:", items); // Verifique o conteúdo de `items`
            return;
        }

        // Procurar no array `items` o nome da semente
        const selectedItem = items.find(item => {
            // Compara os nomes
            return item.itemNome.trim() === selectedSeedName.trim();
        });

        // Item não encontrado
        if (!selectedItem) {
            console.error(`Erro: Item com nome '${selectedSeedName}' não encontrado.`);
            console.log("Itens disponíveis:", items.map(item => item.itemNome)); // Debugging
            return;
        }

        console.log("Item encontrado:", selectedItem); // Debugging
        // Mostrar modal e esperar resposta do usuário
        const userConfirmed = await showConfirmationModal(`Deseja substituir a planta atual por "${selectedSeedName}"?`);

        if (userConfirmed) {
            // Certifique-se de que walletAddress está definido
            const addressToUse = userData?.walletAddress || walletAddress;
            
            if (!addressToUse) {
                console.error("Erro: Não foi possível determinar o endereço da carteira");
                return;
            }

            await plantSeed(addressToUse, selectedVaseSlot, selectedItem.itemId);
            await updateVasoAndPlantImages(addressToUse);
            await updateUIAndInventory(addressToUse);
            playOpen();
        } else {
            console.log("Usuário cancelou o plantio.");
        }

        // Resetar seleção e fechar modal
        document.querySelectorAll(".playInvetorySlot").forEach(slot => slot.classList.remove("pointer"));
        selectedVaseSlot = null;
    });
});


//#region Button Events
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
// Disconnect Wallet
btnWalletDisconnect.addEventListener("click", logout);
//#endregion

// Main Structure Starts --------------------------------
startMusic();
attachVolumeListeners();
loadVolumeSettings();



// Evento click slot/shop walletAddress
function addSlotClickListeners(walletAddress) {
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

// Aguardar o carregamento do DOM para inicializar a funcionalidade
document.addEventListener('DOMContentLoaded', () => {
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    if (btnWalletConnect) {
        btnWalletConnect.addEventListener("click", loginWithTON);
        initApp();
    } else {
        console.error("Botão com ID 'btnWalletConnect' não encontrado.");
    }
});
