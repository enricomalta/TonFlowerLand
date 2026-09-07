import { getMascoteTranslation } from '../lang/translate.js';

// Variáveis para controlar timeouts das falas
let falaMascoteTimeouts = {};
let delayFalas = 1000; // 1s Delay entra a ultima tecla
let delayUltimaFala = 0; // Timestamp da ultima fala
const speedFala = 60

function mascoteBallon(elementId, falaKey, speed, delayStart = 100) {
    speed = speedFala
    const el = document.getElementById(elementId);
    if (!el || el.offsetParent === null) return;

    // Limpa timeout anterior se existir
    if (falaMascoteTimeouts[elementId]) {
        clearTimeout(falaMascoteTimeouts[elementId]);
    }

    // Sempre sorteia uma fala usando o sistema de tradução
    const novaFala = getMascoteTranslation(falaKey);

    falaMascoteTimeouts[elementId] = setTimeout(() => {
        el.dataset.text = novaFala;
        el.textContent = "";

        let i = 0;
        function type() {
            if (i < novaFala.length) {
                el.textContent += novaFala.charAt(i);
                i++;
                falaMascoteTimeouts[elementId] = setTimeout(type, speed);
            }
        }
        type();
    }, delayStart);
}


function isValorNegativo(inputValue) {
    const valor = parseFloat(inputValue.replace(/[^\d.-]/g, ''));
    return !isNaN(valor) && valor < 0;
}


function handleMascoteFala(inputElement, mascoteId, falaKeyPositiva, falaKeyNegativa, speedFala) {
    const valor = inputElement.value.trim();
    
    if (!valor) {
        // Se input vazio, volta para fala padrão
        const falaPadraoKey = mascoteId === "falaMascoteTextPlanta" ? 
            "falaMascoteTextPlanta" : "falaMascoteTextGnomo";
        mascoteBallon(mascoteId, falaPadraoKey, speedFala, 0);
        return;
    }

    if (isValorNegativo(valor)) {
        // Valor negativo - usa falas especiais
        mascoteBallon(mascoteId, falaKeyNegativa, speedFala, 0);
    } else {
        // Valor positivo - usa falas normais
        mascoteBallon(mascoteId, falaKeyPositiva, speedFala, 0);
    }
}

// Exemplo de uso para todos mascotes com balão de fala
document.addEventListener("DOMContentLoaded", function() {
    // Aguardar as traduções serem carregadas antes de inicializar
    const checkTranslationsLoaded = () => {
        // Verificar se as traduções foram carregadas
        if (typeof getMascoteTranslation === 'function') {
            // Testar se conseguimos obter uma tradução
            const testTranslation = getMascoteTranslation('falaMascoteTextPlanta');
            if (testTranslation && testTranslation !== 'falaMascoteTextPlanta') {
                // Traduções carregadas, podemos inicializar
                initMascoteBallons();
                return;
            }
        }
        // Ainda não carregado, tentar novamente em 100ms
        setTimeout(checkTranslationsLoaded, 100);
    };
    
    const initMascoteBallons = () => {
        // Falas padrão ao carregar
        mascoteBallon("falaMascoteTextGnomo", "falaMascoteTextGnomo");
        mascoteBallon("falaMascoteTextPlanta", "falaMascoteTextPlanta");
        
        // Input de depósito (planta) - COMPORTAMENTO CORRIGIDO
        const inputDeposit = document.getElementById("walletBalanceCryptoDeposit");
        if (inputDeposit) {
            let timeoutDeposit;
            let valorAnteriorDeposit = inputDeposit.value; // Guarda o valor anterior
            
            inputDeposit.addEventListener("input", function() {
                // Só atualiza se o valor REALMENTE mudou (digitação)
                if (inputDeposit.value !== valorAnteriorDeposit) {
                    clearTimeout(timeoutDeposit);
                    timeoutDeposit = setTimeout(() => {
                        handleMascoteFala(
                            inputDeposit, 
                            "falaMascoteTextPlanta", 
                            "falaMascoteTextPlantaDeposit",
                            "falaMascoteTextPlantaDepositNegativo"
                        );
                        valorAnteriorDeposit = inputDeposit.value; // Atualiza valor anterior
                    }, delayFalas);
                }
            });

            inputDeposit.addEventListener("focus", function() {
                // ✅ NÃO faz nada no focus - só mantém a fala atual
                // Não chama handleMascoteFala aqui
            });

            inputDeposit.addEventListener("blur", function() {
                clearTimeout(timeoutDeposit);
                // ✅ Só volta para fala padrão se estiver vazio
                // if (!inputDeposit.value.trim()) {
                //     mascoteBallon("falaMascoteTextPlanta", falas.falaMascoteTextPlanta, 40, 0);
                // }
                // Se tiver valor, mantém a fala atual mesmo perdendo o foco
            });
        }

        // Input de saque (gnomo) - COMPORTAMENTO CORRIGIDO
        const inputSaque = document.getElementById("walletBalanceCryptoSaque");
        if (inputSaque) {
            let timeoutSaque;
            let valorAnteriorSaque = inputSaque.value; // Guarda o valor anterior
            
            inputSaque.addEventListener("input", function() {
                // ✅ Só atualiza se o valor REALMENTE mudou (digitação)
                if (inputSaque.value !== valorAnteriorSaque) {
                    clearTimeout(timeoutSaque);
                    timeoutSaque = setTimeout(() => {
                        handleMascoteFala(
                            inputSaque, 
                            "falaMascoteTextGnomo", 
                            "falaMascoteTextGnomoSaque",
                            "falaMascoteTextGnomoSaqueNegativo"
                        );
                        valorAnteriorSaque = inputSaque.value; // Atualiza valor anterior
                    }, delayFalas);
                }
            });

            inputSaque.addEventListener("focus", function() {
                // ✅ NÃO faz nada no focus - só mantém a fala atual
                // Não chama handleMascoteFala aqui
            });

            inputSaque.addEventListener("blur", function() {
                clearTimeout(timeoutSaque);
                // ✅ Só volta para fala padrão se estiver vazio
                if (!inputSaque.value.trim()) {
                    mascoteBallon("falaMascoteTextGnomo", "falaMascoteTextGnomo", 40, 0);
                }
                // Se tiver valor, mantém a fala atual mesmo perdendo o foco
            });
        }
    };
    
    checkTranslationsLoaded();
});


// Exports
export { mascoteBallon };