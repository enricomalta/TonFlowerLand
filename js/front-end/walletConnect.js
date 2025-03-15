import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';

let tonConnect;

window.onload = function() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;

        // Agora você pode interagir com o Telegram WebApp com segurança
        console.log("Telegram WebApp está pronto");

        // Expande para tela cheia
        tg.expand();

        // Log do usuário para verificar as informações do usuário
        console.log("User:", tg.initDataUnsafe.user);

        // Adicionalmente, você pode verificar o tema e outras informações se necessário
        console.log("Theme:", tg.themeParams);

        // Agora, tente inicializar o TonConnect
        if (typeof TonConnect !== 'undefined') {
            console.log("TonConnect carregado:", TonConnect);
            initializeTonConnect();
        } else {
            console.error("❌ TonConnect não foi carregado corretamente.");
        }
    } else {
        console.error("❌ Telegram WebApp não está disponível.");
    }
};


// Função para inicializar o TonConnect
function initializeTonConnect() {
    const tonConnect = new TonConnect({
        manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',  // Defina a URL do seu manifest
    });

    console.log("TonConnect inicializado:", tonConnect);
}

const API_URL = "https://ton-flower-land-back-end.vercel.app";
const btnWalletConnect = document.getElementById("btnWalletConnect");

// Garantir que a função de inicialização seja chamada após o carregamento completo do script
window.onload = function() {
    if (typeof TonConnect !== "undefined") {
        initializeTonConnect();
        console.log("TonConnect carregado:", tonConnect);
    } else {
        console.error("TonConnect não foi carregado corretamente.");
    }
};



function isTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp;
}

async function connectWallet() {
    try {
        // 1. Verificar se o TonConnect foi inicializado corretamente
        if (!tonConnect) {
            console.error("❌ TonConnect não foi inicializado corretamente.");
            return;
        }

        console.log("🔗 Tentando conectar à Wallet...");

        // 2. Conectar à wallet
        const connectedWallet = await tonConnect.connect();
        console.log(connectedWallet); // Verifique o que está sendo retornado aqui
        
        // 3. Verificar se a carteira foi conectada corretamente
        if (!connectedWallet || !connectedWallet.account) {
            throw new Error("❌ A Wallet não retornou uma conta válida.");
        }

        console.log("✅ Carteira conectada com sucesso!");
        console.log("📌 Endereço da Wallet:", connectedWallet.account.address);

        // 4. Criar o usuário no backend com o endereço da wallet
        await createUser(connectedWallet.account.address);

        return connectedWallet.account.address; // Retornar o endereço da carteira

    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error.message);
        return null; // Retornar null em caso de erro
    }
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

// Conectar ao clicar no botão
btnWalletConnect.addEventListener("click", loginWithTON);

export { loginWithTON };
