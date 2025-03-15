const API_URL = "https://ton-flower-land-back-end.vercel.app";
const btnWalletConnect = document.getElementById("btnWalletConnect");


const tonConnect = new TonConnectSDK.TonConnect({
    manifestUrl: "https://ton-flower-land.vercel.app/tonconnect-manifest.json"
});

console.log("TonConnect carregado:", tonConnect);


async function connectWallet() {
    try {
        // Conectar a carteira
        const wallets = await tonConnect.getWallets();
        console.log("Carteiras disponíveis:", wallets);

        if (!wallets.length) {
            alert("Nenhuma carteira disponível. Instale uma carteira TON.");
            return null;
        }

        // Conectar a primeira carteira disponível
        await tonConnect.connect({ jsBridgeKey: wallets[0].jsBridgeKey });

        const walletInfo = await tonConnect.account;
        console.log("Carteira conectada:", walletInfo);
        return walletInfo.address;
    } catch (error) {
        console.error("Erro ao conectar carteira:", error);
        alert("Erro ao conectar carteira.");
        return null;
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
