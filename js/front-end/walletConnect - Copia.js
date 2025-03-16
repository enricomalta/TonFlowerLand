import { TonConnect } from 'https://cdn.jsdelivr.net/npm/@tonconnect/sdk@3.0.7/+esm';

let tonConnect;

// Função para inicializar o TonConnect
async function initializeTonConnect() {
    try {
        console.log("Inicializando TonConnect...");
        
        // Inicialize o TonConnect com a configuração correta
        tonConnect = new TonConnect({
            manifestUrl: 'https://ton-flower-land.vercel.app/tonconnect-manifest.json',
            // Adicione opções para salvar o estado da conexão
            storage: localStorage
        });
        
        console.log("TonConnect inicializado:", tonConnect);
        
        // Configurar listeners para mudanças de estado
        tonConnect.onStatusChange(wallet => {
            if (wallet) {
                console.log("✅ Status da wallet mudou - Conectada:", wallet);
                // Chamar uma função para processar a wallet conectada
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

// Inicializar o TonConnect quando o script carregar
initializeTonConnect().then(() => {
    // Verificar se já existe uma conexão
    checkExistingConnection();
}).catch(error => {
    console.error("Falha ao inicializar TonConnect:", error);
});

const API_URL = "http://192.168.0.100:3000";

// Função para verificar se já existe uma conexão
async function checkExistingConnection() {
    try {
        const activeWallet = tonConnect.wallet;
        if (activeWallet) {
            console.log("✅ Wallet já está conectada:", activeWallet);
            console.log("📌 Endereço da Wallet:", activeWallet.account.address);
            // Aqui você pode atualizar a UI para mostrar que está conectado
            updateUIForConnectedWallet(activeWallet);
        } else {
            console.log("❌ Nenhuma wallet conectada");
            // Atualizar UI para mostrar que não está conectado
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
        
        // Verificar se já existe uma conexão ativa
        const activeWallet = tonConnect.wallet;
        if (activeWallet) {
            console.log("✅ Carteira já conectada:", activeWallet);
            console.log("📌 Endereço da Wallet:", activeWallet.account.address);
            updateUIForConnectedWallet(activeWallet);
            return activeWallet.account.address;
        }
        
        // Listar as carteiras disponíveis
        const walletsList = await tonConnect.getWallets();
        console.log("Wallets disponíveis:", walletsList);
        
        // Encontrar a wallet do Telegram
        let telegramWallet = walletsList.find(wallet => wallet.name.toLowerCase().includes('telegram'));
        if (!telegramWallet) {
            telegramWallet = walletsList[0]; // Usa a primeira wallet se não encontrar a do Telegram
        }
        
        // Iniciar o processo de conexão
        const connectResult = await tonConnect.connect({
            universalLink: telegramWallet.universalLink,
            bridgeUrl: telegramWallet.bridgeUrl
        });
        
        console.log("Wallet conectada:", connectResult);
        
        // Se o resultado for uma URL (comum no ambiente Telegram), abra-a
        if (typeof connectResult === 'string' && connectResult.startsWith('http')) {
            console.log("Redirecionando para a wallet...");
            
            // Salvar que estamos no processo de conexão
            localStorage.setItem('connectingWallet', 'true');
            
            // Abrir a URL no ambiente Telegram
            if (isTelegramWebApp()) {
                window.Telegram.WebApp.openLink(connectResult);
            } else {
                window.open(connectResult, '_blank');
            }
            
            // Nesse ponto, o usuário será redirecionado. Quando ele voltar, precisamos verificar o estado da conexão.
            // Isso será feito pelo listener de onStatusChange que configuramos acima.
            
            // Retornar null por enquanto, pois a conexão real será processada quando o usuário voltar
            return null;
        }
        
        // Se o resultado não for uma URL, significa que temos uma conexão direta
        if (!connectResult || !connectResult.account) {
            throw new Error("❌ A Wallet não retornou uma conta válida.");
        }
        
        console.log("✅ Carteira conectada com sucesso!");
        console.log("📌 Endereço da Wallet:", connectResult.account.address);
        updateUIForConnectedWallet(connectResult);
        
        return connectResult.account.address;
    } catch (error) {
        console.error("❌ Erro ao conectar a Wallet:", error);
        return null;
    }
}


// Função para atualizar a UI quando a wallet está conectada
function updateUIForConnectedWallet(wallet) {
    // Aqui você pode atualizar botões, textos, etc.
    console.log("Atualizando UI para wallet conectada");
    
    // Exemplo: atualizar texto do botão
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    if (btnWalletConnect) {
        btnWalletConnect.textContent = "Wallet Conectada";
        btnWalletConnect.disabled = true;
    }
}



// Função para atualizar a UI quando a wallet está desconectada
function updateUIForDisconnectedWallet() {
    console.log("Atualizando UI para wallet desconectada");
    
    // Exemplo: atualizar texto do botão
    const btnWalletConnect = document.getElementById("btnWalletConnect");
    if (btnWalletConnect) {
        btnWalletConnect.textContent = "Connect Wallet";
        btnWalletConnect.disabled = false;
    }
}

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

// Adicione algo como isto:
function handleWalletConnected(wallet) {
    console.log("Processando wallet conectada:", wallet);
    
    // Extrair o endereço da wallet
    const walletAddress = wallet.account.address;
    
    // Atualizar UI para wallet conectada
    updateUIForConnectedWallet(wallet);
    
    // Solicitar desafio e assinar
    fetchChallenge(walletAddress)
        .then(challenge => {
            return signChallenge(walletAddress);
        })
        .then(signatureResult => {
            if (signatureResult && typeof window.handleWalletConnect === 'function') {
                // Chamar a função de login do index.js
                window.handleWalletConnect(walletAddress);
            }
        })
        .catch(error => {
            console.error("Erro no processo de autenticação:", error);
        });
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
        
        // Usar diretamente sendTransaction sem tentar signData primeiro
        console.log("Assinando desafio via transação...");
        try {
            const transaction = await tonConnect.sendTransaction({
                validUntil: Math.floor(Date.now() / 1000) + 60,
                messages: [
                    {
                        address: walletAddress,
                        amount: "0",
                        payload: challenge // Usar o desafio diretamente
                    }
                ]
            });
            
            console.log("Transação enviada:", transaction);
            
            // Verificar a assinatura no backend (se necessário)
            // Isso depende de como seu backend está configurado para verificar
            try {
                const verifyResponse = await fetch(`${API_URL}/verify-transaction`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        walletAddress,
                        challenge,
                        transaction
                    }),
                });
                
                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    console.log("Verificação completa:", verifyData);
                    
                    // Se a verificação for bem-sucedida, chamar a função de login
                    if (verifyData.success && typeof window.handleWalletConnect === 'function') {
                        window.handleWalletConnect(walletAddress);
                    }
                    
                    return verifyData;
                }
            } catch (verifyError) {
                console.warn("Erro ao verificar transação:", verifyError);
                // Continue para chamada padrão de login, mesmo se a verificação falhar
            }
            
            // Chamar a função de login mesmo se não houver verificação de backend
            if (typeof window.handleWalletConnect === 'function') {
                window.handleWalletConnect(walletAddress);
            }
            
            return transaction;
        } catch (txError) {
            console.error("Erro ao enviar transação:", txError);
            throw txError;
        }
    } catch (error) {
        console.error("Erro ao assinar desafio:", error);
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