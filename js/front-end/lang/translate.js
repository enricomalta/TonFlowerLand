const contrys = {
    "flag1": "br",   // Português Brasil
    "flag2": "us",   // Inglês
    "flag3": "es",   // Espanhol
    "flag4": "fr",   // Francês
    "flag5": "de",   // Alemão
    "flag6": "it",   // Italiano
    "flag7": "jp",   // Japonês
    "flag8": "cn",   // Chinês
    "flag9": "ru",   // Russo
    "flag10": "in",  // India
    "flag11": "kr",  // Coreano
    "flag12": "pt",  // Português
    "flag13": "nl",  // Holandês
    "flag14": "se",  // Sueco
    "flag15": "no",  // Norueguês
    "flag16": "fi",  // Finlandês
    "flag17": "da",  // Dinamarquês
    "flag18": "pl",  // Polonês
    "flag19": "tr",  // Turco
    "flag20": "gr"   // Grego
};

const countryToLanguageMap = {
    "br": "pt",     // Português Brasil
    "us": "en",     // Inglês
    "es": "es",     // Espanhol
    "fr": "fr",     // Francês
    "de": "de",     // Alemão
    "it": "it",     // Italiano
    "jp": "ja",     // Japonês
    "cn": "zh",     // Chinês
    "ru": "ru",     // Russo
    "in": "hi",     // India
    "kr": "ko",     // Coreano
    "pt": "pt",     // Português Portugal
    "nl": "nl",     // Holandês
    "se": "sv",     // Sueco
    "no": "no",     // Norueguês
    "fi": "fi",     // Finlandês
    "da": "da",     // Dinamarquês
    "pl": "pl",     // Polonês
    "tr": "tr",     // Turco
    "gr": "el"      // Grego
};


let translations = {};
let mascoteTranslations = {};
let currentLanguage = 'pt';
let currentCountry = 'br';

// Carregar traduções
async function loadTranslations() {
    try {
        // Carregar traduções normais
        const response = await fetch('./js/front-end/lang/translate.json');
        translations = await response.json();
        
        // Carregar traduções do mascote
        const mascoteResponse = await fetch('./js/front-end/lang/mascoteTranslate.json');
        mascoteTranslations = await mascoteResponse.json();
        
        //console.log('Traduções carregadas com sucesso!');
        //console.log('Traduções normais:', Object.keys(translations).length, 'chaves');
        //console.log('Traduções do mascote:', Object.keys(mascoteTranslations).length, 'chaves');
        
        return { translations, mascoteTranslations };
    } catch (error) {
        console.error('Erro ao carregar traduções:', error);
        return { translations: {}, mascoteTranslations: {} };
    }
}

// Função de tradução
function translate(key, language = currentLanguage) {
    if (!translations[key]) {
        // console.warn(`Chave de tradução não encontrada: ${key}`);
        return key;
    }
    
    if (!translations[key][language]) {
        if (translations[key]['br']) return translations[key]['br'];
        const firstTranslation = Object.values(translations[key])[0];
        return firstTranslation || key;
    }
    
    return translations[key][language];
}

// Função específica para tradução do mascote (com arrays de frases)
function translateMascote(key, language = currentLanguage) {
    // Verificar se mascoteTranslations foi carregado
    if (!mascoteTranslations || Object.keys(mascoteTranslations).length === 0) {
        // console.warn(`Traduções do mascote ainda não carregadas. Retornando chave: ${key}`);
        return key;
    }
    
    if (!mascoteTranslations[key]) {
        // console.warn(`Chave de tradução do mascote não encontrada: ${key}`);
        return key;
    }
    
    if (!mascoteTranslations[key][language] || !Array.isArray(mascoteTranslations[key][language])) {
        // Fallback para português brasileiro
        if (mascoteTranslations[key]['pt'] && Array.isArray(mascoteTranslations[key]['pt'])) {
            const frases = mascoteTranslations[key]['pt'];
            return frases[Math.floor(Math.random() * frases.length)];
        }
        // Último fallback: primeira linguagem disponível
        const firstLang = Object.keys(mascoteTranslations[key])[0];
        if (mascoteTranslations[key][firstLang] && Array.isArray(mascoteTranslations[key][firstLang])) {
            const frases = mascoteTranslations[key][firstLang];
            return frases[Math.floor(Math.random() * frases.length)];
        }
        return key;
    }
    
    // Pegar frase aleatória do array
    const frases = mascoteTranslations[key][language];
    return frases[Math.floor(Math.random() * frases.length)];
}

// Rastrear clique nas flags
function setupFlagClickListeners() {
    // Adiciona event listener para todos os elementos que começam com "flag"
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        // Verifica se o elemento clicado ou seu pai tem ID que começa com "flag"
        let flagElement = target;
        if (!flagElement.id.startsWith('flag')) {
            flagElement = target.closest('[id^="flag"]');
        }
        
        if (flagElement && flagElement.id.startsWith('flag')) {
            const flagId = flagElement.id;
            handleFlagClick(flagId);
        }
    });
}

// Manipular clique na flag
function handleFlagClick(flagId) {
    // Extrai o número do ID (flag1 → 1, flag2 → 2, etc.)
    const slotId = flagId.replace('flag', '');
    
    // Obtém o código do país baseado no ID
    const countryCode = contrys[flagId];
    
    if (countryCode) {
        changeLanguage(countryCode, flagId, slotId);
    } else {
        console.warn(`País não encontrado para a flag: ${flagId}`);
    }
}



// Mudar idioma
export function changeLanguage(countryCode, flagId, slotId) {
    const languageCode = countryToLanguageMap[countryCode] || 'en';
    
    // Atualiza variáveis globais
    currentLanguage = languageCode;
    currentCountry = countryCode;
    
    //console.log(`🎌 Flag clicada: ${flagId} (Slot: ${slotId})`);
    //console.log(`🌍 País: ${countryCode}`);
    //console.log(`🗣️ Idioma alterado para: ${languageCode}`);
    
    // Atualiza a UI
    updateAllTexts();
    updateActiveFlag(flagId);
    
    // Salva preferências
    localStorage.setItem('preferredLanguage', languageCode);
    localStorage.setItem('preferredCountry', countryCode);
    localStorage.setItem('lastFlagId', flagId);
    
    // Aqui você pode adicionar outras ações específicas do slot se necessário
    handleSlotSpecificAction(slotId, countryCode);
}

// Atualizar flag ativa
function updateActiveFlag(activeFlagId) {
    // Remove classe active de todas as flags
    document.querySelectorAll('[id^="flag"]').forEach(flag => {
        flag.classList.remove('active');
    });
    
    // Adiciona classe active na flag clicada
    const activeFlag = document.getElementById(activeFlagId);
    if (activeFlag) {
        activeFlag.classList.add('active');
    }
}

// Ação específica baseada no slot (opcional)
function handleSlotSpecificAction(slotId, countryCode) {
    //console.log(`📍 Slot ${slotId} selecionado - País: ${countryCode}`);
    
    // Exemplo: ações diferentes baseadas no slot
    switch(slotId) {
        case '1':
            //console.log('🌟 Slot premium 1 selecionado!');
            break;
        case '2':
            //console.log('⭐ Slot premium 2 selecionado!');
            break;
        // Adicione mais casos conforme necessário
    }
}

// Atualizar todos os textos
export function updateAllTexts() {
    // Textos normais e especiais do mascote
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        const elementId = element.id;
        
        // Pular elementos do mascote que são controlados por mascoteBallon
        if (elementId === 'falaMascoteTextPlanta' || elementId === 'falaMascoteTextGnomo') {
            return;
        }
        
        // Verificar se é uma chave do mascote
        if (mascoteTranslations[key]) {
            element.textContent = translateMascote(key);
        } else {
            // Tradução normal
            element.textContent = translate(key);
        }
    });
    
    // Placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        element.placeholder = translate(key);
    });
    
    // Titles
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        element.title = translate(key);
    });
    
    // Alt texts para imagens
    document.querySelectorAll('[data-translate-alt]').forEach(element => {
        const key = element.getAttribute('data-translate-alt');
        element.alt = translate(key);
    });
}

// Inicializar sistema
export async function initTranslationSystem() {
    await loadTranslations();
    setupFlagClickListeners();
    
    // Restaurar preferências salvas
    const savedLanguage = localStorage.getItem('preferredLanguage');
    const savedCountry = localStorage.getItem('preferredCountry');
    const savedFlagId = localStorage.getItem('lastFlagId');
    
    if (savedLanguage && savedCountry) {
        currentLanguage = savedLanguage;
        currentCountry = savedCountry;
        
        if (savedFlagId) {
            updateActiveFlag(savedFlagId);
        }
    }
    
    updateAllTexts();
    //console.log('Sistema de tradução inicializado!');
}

// Exportar função de tradução do mascote para uso externo
export function getMascoteTranslation(key, language = currentLanguage) {
    return translateMascote(key, language);
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initTranslationSystem);