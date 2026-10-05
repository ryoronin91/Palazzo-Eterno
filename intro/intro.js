const INTRO_IMAGES = [
    "immagini/intro1.png",
    "immagini/intro2.png",
    "immagini/intro3.png",
    "immagini/intro4.png",
    "immagini/intro5.png"
];

const SCENE_DURATION_MS = 6000;

const introImage = document.getElementById("intro-image");

let currentSceneIndex = 0;
let sceneTimer = null;

function preloadIntroImages() {
    INTRO_IMAGES.forEach((src) => {
        const image = new Image();
        image.src = src;
    });
}

function showScene(index) {
    if (!introImage) {
        return;
    }

    if (index < 0 || index >= INTRO_IMAGES.length) {
        return;
    }

    currentSceneIndex = index;
    introImage.src = INTRO_IMAGES[currentSceneIndex];
}

function scheduleNextScene() {
    clearTimeout(sceneTimer);

    if (currentSceneIndex >= INTRO_IMAGES.length - 1) {
        return;
    }

    sceneTimer = window.setTimeout(() => {
        showScene(currentSceneIndex + 1);
        scheduleNextScene();
    }, SCENE_DURATION_MS);
}

function startIntro() {
    preloadIntroImages();
    showScene(0);
    scheduleNextScene();
}

window.addEventListener("DOMContentLoaded", startIntro);
