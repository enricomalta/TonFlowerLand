// Rastreia botão
const btnSaveConfig = document.getElementById("btnSaveConfig");
// Volume controles
const volumeControls = [
    { id: "music", container: ".soundMusic", input: "musicVolume", audioId: "musicAudio" },
    { id: "fx", container: ".soundFx", input: "fxVolume", audioId: "fxAudio" },
    { id: "cursor", container: ".soundCursor", input: "cursorVolume", audioId: "cursorAudio" },
];

// Guarda volume anterior
const previousVolume = {
    music: 0,
    fx: 0,
    cursor: 0
};



// Botão de Mute
window.toggleMute = function (soundType) {
    const control = volumeControls.find(c => c.id === soundType);
    if (!control) return;

    const volumeInput = document.getElementById(control.input);

    if (volumeInput.value !== "0") {
        previousVolume[soundType] = volumeInput.value;
        volumeInput.value = "0";
    } else {
        volumeInput.value = previousVolume[soundType];
    }

    updateVolume(control.id, parseInt(volumeInput.value));
};

// Botão Save
if (btnSaveConfig) {
    btnSaveConfig.addEventListener("click", saveConfig);
} else {
    console.error("Botão btnSaveConfig não encontrado!");
}


function saveConfig () {
    const configModal = document.getElementById("configModal");

    // Salvar configurações localstorage
    volumeControls.forEach(control => {
        const volumeInput = document.getElementById(control.input);
        if (volumeInput) {
            localStorage.setItem(`${control.id}Volume`, volumeInput.value);
        }
    });

    if (configModal) {
        if (configModal.style.display === 'flex') {
            configModal.style.display = 'none';
        } else {
            configModal.style.display = 'flex';
        }
    }

}
function updateVolume(soundType, volume) {
    const audioElement = document.getElementById(`${soundType}Audio`);
    if (audioElement) audioElement.volume = volume / 100;
    updateVolumeImage(soundType, volume);
    localStorage.setItem(`${soundType}Volume`, volume);
}

function updateVolumeImage(soundType, volume) {
    const imgElement = document.querySelector(`.sound${soundType.charAt(0).toUpperCase() + soundType.slice(1)} .volumeMuteImg`);
    if (!imgElement) return;
    imgElement.src = volume === 0 ? "img/volumeMute.png" : volume > 50 ? "img/volumeMax.png" : "img/volumeMin.png";
}

function attachVolumeListeners() {
    ["music", "fx", "cursor"].forEach(soundType => {
        const volumeInput = document.getElementById(`${soundType}Volume`);
        if (volumeInput) {
            volumeInput.addEventListener("input", () => {
                updateVolume(soundType, parseInt(volumeInput.value));
            });
        }
    });
}

function loadVolumeSettings() {
    ["music", "fx", "cursor"].forEach(soundType => {
        const volumeInput = document.getElementById(`${soundType}Volume`);
        if (volumeInput) {
            const savedVolume = localStorage.getItem(`${soundType}Volume`) || 100;
            volumeInput.value = savedVolume;
            updateVolume(soundType, savedVolume);
        }
    });
}


// EFEITOS SONOROS

// Musica
function startMusic() {
    var music = document.getElementById("musicAudio");
    if (music) {
        var playPromise = music.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log("Música iniciada com sucesso.");
            }).catch(error => {
                // console.warn("Reprodução bloqueada. Aguardando interação do usuário.");
                document.addEventListener("click", () => {
                    music.play();
                }, { once: true });
            });
        }
    }
}

// Mouse Click
function soundClickMouse() {
    const hoverSound = new Audio("sounds/cursor1.mp3");
    hoverSound.volume = document.getElementById("cursorAudio").volume; // Pega o volume do elemento de controle
    hoverSound.currentTime = 0;
    hoverSound.play().catch(error => console.warn("Erro ao reproduzir o som:", error));
}

// Recolher Sound
function soundRecolherPlanta() {
    const recolherSound = new Audio("sounds/recolher.mp3");
    recolherSound.volume = document.getElementById("fxAudio").volume;
    recolherSound.currentTime = 0;
    recolherSound.play().catch(error => console.warn("Erro ao reproduzir o som:", error));
}
// Recolher Sound
function soundInspectPlant() {
    const soundInspect = new Audio("sounds/fx2.mp3");
    soundInspect.volume = document.getElementById("fxAudio").volume;
    soundInspect.currentTime = 0;
    soundInspect.play().catch(error => console.warn("Erro ao reproduzir o som:", error));
}



// Evento Click Mouse Classe Pointer
document.querySelectorAll(".pointer").forEach(element => {
    element.addEventListener("click", soundClickMouse);
});

