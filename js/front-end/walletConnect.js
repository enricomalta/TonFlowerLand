import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';
import { createUser } from './api.js';  // Correto para exportação nomeada
let tonConnect;

// Função para inicializar o TonConnect
async function initializeTonConnect() {
    try {
        console.log("Inicializando TonConnect...");
        
        // Inicialize o TonConnect com manifestUrl em vez de bridgeUrl
        tonConnect = new TonConnect({
            manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',
        });
        
        console.log("TonConnect inicializado:", tonConnect);
        return tonConnect;
    } catch (error) {
        console.error("Erro ao inicializar o TonConnect:", error);
        throw error;
    }
}
// Inicializar imediatamente
initializeTonConnect().catch(error => {
    console.error("Falha ao inicializar TonConnect:", error);
});

// const API_URL = "http://192.168.0.100:3000"; // Defina a URL da sua API
const API_URL = "https://ton-flower-land-back-end.vercel.app";

// Função para conectar à Wallet
async function connectWallet() {
    try {
        if (!tonConnect) {
            console.log("TonConnect não inicializado, tentando novamente...");
            await initializeTonConnect();
        }

        console.log("🔗 Tentando conectar à Wallet...");
        
        // Listar as carteiras disponíveis
        const walletsList = await tonConnect.getWallets();
        console.log("Wallets disponíveis:", walletsList);

        // Selecionar a primeira wallet da lista (ou uma específica se você preferir)
        if (walletsList.length === 0) {
            throw new Error("Nenhuma wallet disponível");
        }
        
        // Conectar usando a primeira wallet disponível
        const connectedWallet = await tonConnect.connect({
            universalLink: walletsList[0].universalLink,
            bridgeUrl: walletsList[0].bridgeUrl
        });
        
        console.log("Wallet conectada:", connectedWallet);
        
        // Verificar se a conta foi conectada corretamente
        if (!connectedWallet || !connectedWallet.account) {
            throw new Error("❌ A Wallet não retornou uma conta válida.");
        }

        console.log("✅ Carteira conectada com sucesso!");
        console.log("📌 Endereço da Wallet:", connectedWallet.account.address);

        return connectedWallet.account.address;
    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error);
        alert("Erro ao conectar wallet: " + error.message);
        return null;
    }
}

function isTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp;
}

async function signChallenge(walletAddress) {
    try {
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

        // Assinar o desafio usando a carteira
        const signature = await tonConnect.sendTransaction({
            messages: [{ address: walletAddress, payload: challenge }],
        });

        console.log("Assinatura:", signature);
        return signature;
    } catch (error) {
        console.error("Erro ao assinar desafio:", error);
        alert("Erro ao assinar desafio.");
        return null;
    }
}

async function verifySignature(walletAddress, signature) {
    try {
        console.log("🔄 Verificando assinatura no backend...");
        const response = await fetch(`${API_URL}/verify-signature`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress, signature }),
        });

        const data = await response.json();
        console.log("Resposta do backend:", data);

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

async function loginWithTON() {
    try {
        const walletAddress = await connectWallet();
        if (!walletAddress) return;

        const signature = await signChallenge(walletAddress);
        if (!signature) return;

        await verifySignature(walletAddress, signature);
    } catch (error) {
        console.error("Erro no login com TON:", error);
    }
}

// Aguardar DOM estar pronto
document.addEventListener('DOMContentLoaded', () => {
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    if (btnWalletConnect) {
        // Conectar ao clicar no botão
        btnWalletConnect.addEventListener("click", loginWithTON);
    } else {
        console.error("Botão com ID 'btnWalletConnect' não encontrado.");
    }
});

export { loginWithTON };
