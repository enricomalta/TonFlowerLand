export function detectConsoleHacks(walletAddress) {
    console.log("🚀 Função detectConsoleHacks foi chamada");

    // Lista de palavras suspeitas
    const palavrasSuspeitas = ["eval", "XMLHttpRequest", "Function"];
    
    // Intercepta console.log, console.warn e console.error
    ["log", "warn", "error", "info"].forEach(method => {
        const original = console[method];
        console[method] = function (...args) {
            original.apply(console, args);
            const message = args.join(" ");

            // Verifica se a mensagem contém algo suspeito
            if (palavrasSuspeitas.some(palavra => message.includes(palavra))) {
                console.error("🚨 Tentativa de hack detectada! 🚨");
                banUser(walletAddress);
            }
        };
    });

    // Intercepta eval e Function
    ["eval", "Function"].forEach(fn => {
        window[fn] = function () {
            console.error(`🚨 Acesso não autorizado a ${fn} 🚨`);
            banUser(walletAddress);
        };
    });

    // Intercepta fetch, mas permite requisições legítimas
    // const originalFetch = window.fetch;
    // window.fetch = async function (...args) {
    //     const url = args[0]; // Pega a URL do fetch

    //     // Defina aqui os domínios confiáveis da sua aplicação
    //     const dominiosConfiaveis = ["192.168.0.100", "meusite.com"];

    //     if (!dominiosConfiaveis.some(dominio => url.includes(dominio))) {
    //         console.error("🚨 Acesso não autorizado a fetch 🚨", url);
    //         banUser(walletAddress);
    //         return Promise.reject("Bloqueado pelo sistema de segurança");
    //     }

    //     return originalFetch.apply(this, args);
    // };

    // Detecta se DevTools está aberto
    let devtoolsOpen = false;
    setInterval(() => {
        const threshold = 160; // Largura típica do DevTools
        if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
            if (!devtoolsOpen) {
                console.error("🚨 DevTools detectado! 🚨");
                banUser(walletAddress);
                devtoolsOpen = true;
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);
}

