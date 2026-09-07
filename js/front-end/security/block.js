const input = document.querySelector(".coinNumber input");

// Lista de IDs para bloquear
const idsParaBloquear = [
    'criptoBalance',
    'tokenBalance', 
    'quantityStar',
    'quantityVasos',
    'quantityAgua',
    'quantityFertilize',
    'quantityAntiParasita',
    'balanceTokenSwap',
    'balanceTonSwap',
    'adressInput'
];

// Bloquear cada input da lista
idsParaBloquear.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.readOnly = true; // Desabilita completamente
    }
});

// Seu evento existente
input.addEventListener("input", function () {
    let value = input.value.replace(/\D/g, "");
    input.value = new Intl.NumberFormat("pt-BR").format(value);
});