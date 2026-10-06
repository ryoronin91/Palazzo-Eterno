const FADE_MS = 500;

const scenes = [
    {
        image: null,
        speaker: "Misteriosa figura",
        text: "Così vicino... eppure ancora fuori dalla mia portata.",
        black: true
    },
    {
        image: "immagini/intro1.png",
        speaker: "Misteriosa figura",
        text: "L'accesso dalle fogne è stato sigillato. Sono arrivato troppo tardi.",
        startMusic: true
    },
    {
        image: "immagini/intro2.png",
        speaker: "Misteriosa figura",
        text: "Chiusa una porta, se ne apre un'altra. Vorrà dire che entrerò dall'ingresso principale."
    },
    {
        image: "immagini/intro3.png",
        speaker: "Misteriosa figura",
        text: "Vieni. Avvicinati. Ho un lavoro per te..."
    },
    {
        image: "immagini/intro4.png",
        speaker: "Misteriosa figura",
        text: "...che tu lo voglia oppure no.",
        playSfx1: true
    },
    {
        image: "immagini/intro5.png",
        speaker: "Misteriosa figura",
        text: "Raggiungi la stanza dell'orologio. Sconfiggi i Custodi ed entra nel Cuore del Palazzo. Quando sarai lì... ci rivedremo."
    },
    {
        image: null,
        speaker: "",
        text: "",
        black: true,
        final: true
    }
];

let currentScene = 0;
let transitioning = false;
let musicStarted = false;
let sfx1Played = false;

const introRoot = document.getElementById('intro-root');
const introImage = document.getElementById('intro-image');
const dialogueBox = document.getElementById('dialogue-box');
const dialogueSpeaker = document.getElementById('dialogue-speaker');
const dialogueText = document.getElementById('dialogue-text');
const nextButton = document.getElementById('next-button');
const introMusic = document.getElementById('intro-music');
const introSfx1 = document.getElementById('intro-sfx1');

function preloadImages() {
    scenes.forEach((scene) => {
        if (!scene.image) return;
        const image = new Image();
        image.src = scene.image;
    });
    const frame = new Image();
    frame.src = 'immagini/cornice.png';
}

function startMusic() {
    if (musicStarted || !introMusic) return;
    introMusic.loop = true;
    introMusic.currentTime = 0;
    introMusic.play().then(() => {
        musicStarted = true;
    }).catch((error) => {
        console.warn('Impossibile avviare music.mp3:', error);
    });
}

function playSfx1() {
    if (sfx1Played || !introSfx1) return;
    sfx1Played = true;
    introSfx1.currentTime = 0;
    introSfx1.play().catch((error) => {
        sfx1Played = false;
        console.warn('Impossibile avviare sfx1.mp3:', error);
    });
}

function applyScene(index) {
    const scene = scenes[index];
    if (!scene) return;

    currentScene = index;
    dialogueSpeaker.textContent = scene.speaker || '';
    dialogueText.textContent = scene.text || '';

    if (scene.black || !scene.image) {
        introRoot.classList.add('is-black');
        introImage.removeAttribute('src');
    } else {
        introImage.src = scene.image;
        introRoot.classList.remove('is-black');
    }

    if (scene.startMusic) startMusic();
    if (scene.playSfx1) playSfx1();

    if (scene.final) {
        dialogueBox.classList.add('is-final');
        dialogueSpeaker.textContent = '';
        dialogueText.textContent = '';
    } else {
        dialogueBox.classList.remove('is-final');
    }

    nextButton.setAttribute('aria-label', scene.final ? 'Vai alla creazione del personaggio' : 'Avanti');
    nextButton.title = scene.final ? 'Continua' : 'Avanti';
}

function getIntroExitDestination() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("return") === "mano") {
        return "../base/services/vendor/vendor.html";
    }
    return "../personaggio.html";
}

function goToNextScene() {
    if (transitioning) return;
    const scene = scenes[currentScene];

    if (
    scene &&
    scene.final
) {

    const params =
        new URLSearchParams(
            window.location.search
        );

    const returnTo =
        params.get("return");

    if (returnTo === "mano") {

        window.location.href =
            "../base/services/vendor/vendor.html";

    } else {

        window.location.href =
            "../personaggio.html";
    }

    return;
}

    const nextIndex = currentScene + 1;
    if (nextIndex >= scenes.length) return;

    transitioning = true;
    nextButton.disabled = true;
    introRoot.classList.add('is-transitioning');

    window.setTimeout(() => {
        applyScene(nextIndex);
        introRoot.classList.remove('is-transitioning');
        window.setTimeout(() => {
            transitioning = false;
            nextButton.disabled = false;
        }, FADE_MS);
    }, FADE_MS);
}

function startIntro() {
    preloadImages();
    applyScene(0);
    nextButton.addEventListener('click', goToNextScene);
}

document.addEventListener('DOMContentLoaded', startIntro);
