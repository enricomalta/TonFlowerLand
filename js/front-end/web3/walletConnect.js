//#region IMPORTS
import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';

import {
    playOpen,
    closeAllModals,
    addSlotClickListeners
} from '../ui/modal-hook.js';

import {
    updateUIAndInventory,
    updateUIForConnectedWallet, 
    updateUIForDisconnectedWallet,
    updateVasoAndPlantImages,
    carregarDadosDoJogador,
    atualizarUIComDadosLocais
} from '../ui/hud.js';

//#endregion


//#region VARIAVEIS GLOBAIS
const btnWalletDisconnect = document.getElementById("btnWalletDisconnect");
const btnWalletConnect = document.getElementById("btnWalletConnect");

const API_URL = "https://192.168.56.1:443"
let tonConnect;
//#endregion

async function initializeTonConnect() {
    try {
        // console.log("Inicializando TonConnect...");

        tonConnect = new TonConnect({
            manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',
            storage: {
                setItem: (key, value) => { sessionStorage[key] = value; },
                getItem: (key) => sessionStorage[key] || null,
                removeItem: (key) => { delete sessionStorage[key]; }
            }
        });

        // console.log("TonConnect inicializado:", tonConnect);
        // Configura o listener para mudanças de status da wallet
        tonConnect.onStatusChange(wallet => {
            if (wallet) {
                // console.log("✅ Status da wallet mudou - Conectada:", wallet);
                handleWalletConnected(wallet);
            } else {
                // console.log("❌ Status da wallet mudou - Desconectada");
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

            const walletAddress = getWalletAddress();
            
            // Preencher o campo de endereço
            const web3AdressInput = document.getElementById("adressInput");
            web3AdressInput.value = walletAddress;
            
            // Atualizar UI como se a wallet estivesse conectada
            updateUIForConnectedWallet(walletAddress);
            
            // Carregar os dados do perfil
            const sucesso = await carregarDadosDoJogador(walletAddress);
            if (sucesso) {
                atualizarUIComDadosLocais();
            }

            return true;
        }
        
        return false;
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
            window.open(connectResult, '_blank');
            return null; // Retorna null até o usuário voltar da conexão
        }

        if (!connectResult || !connectResult.account) {
            throw new Error("❌ A Wallet não retornou uma conta válida.");
        }

        console.log("✅ Carteira conectada com sucesso!");
        // Armazena o endereço globalmente
        const walletAddress = connectResult.account.address;
        const sucesso = await carregarDadosDoJogador(walletAddress);
        if (sucesso) {
            atualizarUIComDadosLocais();
        }
        localStorage.setItem('walletAddress', walletAddress);
        console.log("Endereço Global", walletAddress);
        updateUIForConnectedWallet(walletAddress);
        return walletAddress;
    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error);
        return null;
    }
}

// Desloga
async function logout() {
    try {

        // Desconectar a wallet se estiver usando TonConnect
        if (tonConnect && tonConnect.wallet) {
            await tonConnect.disconnect();
        }
        
        // Limpar o token do localStorage
        localStorage.removeItem("authToken");
        localStorage.removeItem("walletAddress");
        localStorage.removeItem("connectingWallet");


        // Chamar endpoint para limpar o cookie back-end
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

// Processa a wallet conectada
async function handleWalletConnected(wallet) {
    try {
        const walletAddress = wallet?.account?.address;
        if (!walletAddress) {
            throw new Error("Wallet address não encontrado na wallet conectada");
        }
        document.getElementById("adressInput").value = walletAddress;
        window.walletAddress = walletAddress;

        localStorage.setItem('walletAddress', walletAddress); // Salva aqui também

        // Fazer login ou criar usuário
        const loginResponse = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress }),
            credentials: 'include'
        });

        if (loginResponse.status === 404) {
            await fetch(`${API_URL}/createUser`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress }),
                credentials: 'include'
            });
        }

        // Carrega dados do jogador uma única vez
        const sucesso = await carregarDadosDoJogador(walletAddress);
        if (sucesso) {
            atualizarUIComDadosLocais();
            updateUIForConnectedWallet(walletAddress);
            await updateUIAndInventory(walletAddress);
            await updateVasoAndPlantImages(walletAddress);
            addSlotClickListeners(walletAddress);
            setupTokenRenewal();
        } else {
            console.error("Erro ao carregar dados do jogador");
        }
    } catch (error) {
        console.error("Erro ao processar wallet conectada:", error);
        alert("Erro ao conectar sua wallet. Por favor, tente novamente.");
    }
}

// Verifica se estamos em um WebApp do Telegram
async function isTelegramWebApp() {
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

// Obtem endereço wallet
export function getWalletAddress() {
    return localStorage.getItem("walletAddress");
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
    isTelegramWebApp();

    try {
        // Verificar e processar sessão ativa (essa função já trata tudo internamente)
        const hasSession = await checkExistingSession();
        
        if (!hasSession) {
            // Se não tiver sessão, inicializar o TonConnect normalmente
            await initializeTonConnect();

            // const wallets = await getWallets();
            updateUIForDisconnectedWallet();
        } else {
            // Sessão já tratada dentro do checkExistingSession (inclui walletAddress e UI)
            await initializeTonConnect(); // Apenas inicializa para uso futuro
        }

        // Outras inicializações...

    } catch (error) {
        console.error("Erro ao inicializar o aplicativo:", error);
    }
}



document.addEventListener('DOMContentLoaded', () => {
    // Disconnect Wallet
    btnWalletDisconnect.addEventListener("click", logout);
    //#endregion
    if (btnWalletConnect) {
        btnWalletConnect.addEventListener("click", loginWithTON);
        initApp();
    } else {
        console.error("Botão com ID 'btnWalletConnect' não encontrado.");
    }
});

