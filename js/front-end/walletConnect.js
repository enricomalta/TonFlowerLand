const API_URL = "http://192.168.0.100:3000";
const btnWalletConnect = document.getElementById("btnWalletConnect");


const tonConnect = new TonConnectSDK.TonConnect({
    manifestUrl: "http://192.168.0.100:5500/tonconnect-manifest.json"
});

console.log("TonConnect carregado:", tonConnect);


async function connectWallet() {
    try {
        await tonConnect.connectWallet();
        const wallets = await tonConnect.getWallets();
        if (wallets.length > 0) {
            const wallet = wallets[0];
            const walletAddress = wallet.account.address;

            console.log("Wallet conectada:", walletAddress);

            // Gerar um desafio (challenge) no backend
            const response = await fetch(`${API_URL}/generate-challenge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress })
            });

            const { challenge } = await response.json();

            // Assinar o desafio com a carteira
            const signature = await wallet.sign(challenge);

            // Enviar a assinatura para o backend validar
            const verifyResponse = await fetch(`${API_URL}/verify-signature`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ walletAddress, signature })
            });

            const { token } = await verifyResponse.json();

            console.log("Token JWT recebido:", token);

            // Salvar no LocalStorage ou Context API para usar depois
            localStorage.setItem("authToken", token);

        } else {
            console.error("Nenhuma carteira encontrada.");
        }
    } catch (error) {
        console.error("Erro ao conectar carteira:", error);
    }
}


async function signChallenge(walletAddress) {
    console.log("🔄 Solicitando desafio do backend...");
    
    // Passo 2: Solicitar o desafio do backend
    const response = await fetch(`${API_URL}/generate-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletAddress }),
    });

    const data = await response.json();
    const challenge = data.challenge;

    console.log("📝 Desafio recebido:", challenge);

    console.log("🔑 Assinando desafio com a carteira TON...");
    // Passo 3: Assinar a mensagem com a carteira TON
    const result = await tonConnect.sendTransaction({
        messages: [{ address: walletAddress, payload: challenge }],
    });

    console.log("✅ Assinatura gerada:", result);
    return { signature: result, challenge };
}


async function verifySignature(walletAddress, signature) {
    // Passo 4: Enviar assinatura para o backend verificar
    console.log("🔄 Verificando assinatura no backend...");

    const response = await fetch(`${API_URL}/verify-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAdress: walletAddress, signature }),
    });

    const data = await response.json();
    console.log("✅ Token do Firebase recebido:", data.firebaseToken);
    return data.firebaseToken;
}

async function loginWithTON() {
    console.log("Botão de login clicado!");
    try {
        // 1 Conectar a carteira
        const walletAddress = await connectWallet();
        console.log("Carteira conectada:", walletAddress);

        // 2 Assinar o desafio gerado pelo backend
        const { signature } = await signChallenge(walletAddress);
        console.log("Assinatura gerada:", signature);

        // 3 Verificar assinatura e obter token do Firebase
        const firebaseToken = await verifySignature(walletAddress, signature);
        console.log("Token do Firebase:", firebaseToken);

        // 4 Logar no Firebase
        await firebase.auth().signInWithCustomToken(firebaseToken);
        console.log("Usuário autenticado com sucesso!");
    } catch (error) {
        console.error("Erro ao autenticar:", error);
    }
}


// Connect Wallet
btnWalletConnect.addEventListener("click", loginWithTON);

export { loginWithTON };
