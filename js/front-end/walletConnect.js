const API_URL = "https://ton-flower-land-back-end.vercel.app";
const btnWalletConnect = document.getElementById("btnWalletConnect");


const tonConnect = new TonConnectSDK.TonConnect({
    manifestUrl: "https://ton-flower-land.vercel.app/tonconnect-manifest.json"
});

console.log("TonConnect carregado:", tonConnect);

function isTelegram() {
    return window.Telegram && window.Telegram.WebApp;
}

async function connectWallet() {
    try {
        const wallets = await tonConnect.getWallets();
        console.log("Carteiras disponíveis:", wallets);

        // Se estiver rodando no Telegram, tenta conectar à Wallet do Telegram
        if (isTelegram()) {
            const telegramWallet = wallets.find(wallet => wallet.appName === "telegram-wallet");

            if (!telegramWallet) {
                throw new Error("A Wallet do Telegram não foi detectada.");
            }

            console.log("Conectando à Wallet do Telegram...");
            await tonConnect.connect({ name: "telegram-wallet" });

            console.log("✅ Carteira conectada com sucesso!");
            return;
        }

        // Caso contrário, conecta a uma carteira injetada no navegador
        const injectedWallet = wallets.find(wallet => wallet.injected);
        
        if (!injectedWallet) {
            throw new Error("Nenhuma carteira injetada encontrada. Use QR Code ou outro método de conexão.");
        }

        console.log("Conectando à carteira:", injectedWallet.name);
        await tonConnect.connect({ name: injectedWallet.appName });

        console.log("✅ Carteira conectada com sucesso!");
    } catch (error) {
        console.error("Erro ao conectar carteira:", error);
        alert(error.message);
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
