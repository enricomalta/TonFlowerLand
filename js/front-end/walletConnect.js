import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';
import { onSlotClick, login, fetchProfile } from './api.js';

let walletConnect = false; // Flag para mostrar Wallet Modal
let tonConnect;

const API_URL = "http://192.168.0.100:3000";

// Inicializa o TonConnect
async function initializeTonConnect() {
    try {
        console.log("Inicializando TonConnect...");

        tonConnect = new TonConnect({
            manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',
            storage: localStorage,
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

// Verifica se já existe uma conexão ativa
async function checkExistingConnection() {
    try {
        const activeWallet = tonConnect.wallet;
        if (activeWallet) {
            console.log("✅ Wallet já está conectada:", activeWallet);
            updateUIForConnectedWallet(activeWallet);
        } else {
            console.log("❌ Nenhuma wallet conectada");
            updateUIForDisconnectedWallet();
        }
    } catch (error) {
        console.error("Erro ao verificar conexão existente:", error);
    }
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
        updateUIForConnectedWallet(connectResult);
        return connectResult.account.address;
    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error);
        return null;
    }
}

// Atualiza a UI quando a wallet está conectada
function updateUIForConnectedWallet(wallet) {
    const top = document.getElementById("top");
    const down = document.getElementById("down");
    const middle = document.getElementById("middle");
    const walletModal = document.getElementById("walletModal");
    const playModal = document.getElementById("playModal");

    top.style.display = "flex";
    down.style.display = "flex";
    walletModal.style.display = "none";
    middle.style.height = "100%";
    walletModal.style.height = "559px";
    playModal.style.display = "none";
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

// Processa a wallet conectada
async function handleWalletConnected(wallet) {
    const web3AdressInput = document.getElementById("adressInput");
    console.log("Processando wallet conectada:", wallet);
    
    // Extrair o endereço da wallet
    const walletAddress = wallet.account.address;
    web3AdressInput.value = walletAddress;
    
    // Atualizar UI para wallet conectada
    updateUIForConnectedWallet(wallet);
    
    try {
        // Verificar se o usuário existe, caso contrário, cria um novo usuário
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress })
        });

        if (!response.ok) {
            // Se o login falhar com um erro 404 (usuário não encontrado), criamos um novo usuário
            if (response.status === 404) {
                console.log("Usuário não encontrado, criando um novo usuário...");
                
                const createResponse = await fetch(`${API_URL}/createUser`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ walletAddress })
                });

                if (!createResponse.ok) {
                    throw new Error("Erro ao criar usuário.");
                }
                console.log("Usuário criado com sucesso!");
            } else {
                throw new Error("Erro ao realizar login.");
            }
        }

        const data = await response.json();
        console.log("Token JWT recebido:", data.token);

        // Armazenar o token no localStorage
        localStorage.setItem("authToken", data.token);

        // Agora que o usuário está logado, podemos buscar os dados do perfil
        await fetchProfile(walletAddress);
    } catch (error) {
        console.error("Erro ao processar o login:", error);
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

// Aguardar o carregamento do DOM para inicializar a funcionalidade
document.addEventListener('DOMContentLoaded', () => {
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    if (btnWalletConnect) {
        btnWalletConnect.addEventListener("click", loginWithTON);
    } else {
        console.error("Botão com ID 'btnWalletConnect' não encontrado.");
    }
});

export { loginWithTON };