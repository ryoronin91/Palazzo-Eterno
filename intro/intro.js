const INTRO_IMAGES = [
    "immagini/intro1.png",
    "immagini/intro2.png",
    "immagini/intro3.png",
    "immagini/intro4.png",
    "immagini/intro5.png"
];

const SCENE_DURATION_MS = 6000;
const FADE_DURATION_MS = 350;

const introImage = document.getElementById("intro-image");
const introMusic = document.getElementById("intro-music");
const introSfx1 = document.getElementById("intro-sfx-1");

let currentSceneIndex = 0;
let sceneTimer = null;
let transitionTimer = null;
let sfx1Played = false;
let audioUnlocked = false;

function preloadIntroImages() {
    INTRO_IMAGES.forEach((src) => {
        const image = new Image();
        image.src = src;
    });
}

async function startBackgroundMusic() {
    if (!introMusic) {
        return;
    }

    introMusic.loop = true;

    try {
        await introMusic.play();
        audioUnlocked = true;
    } catch (error) {
        // I browser possono bloccare l'autoplay con audio.
        // Il primo click o tasto premuto proverà a sbloccarlo.
    }
}

function playSceneSfx(index) {
    if (index !== 3 || sfx1Played || !introSfx1) {
        return;
    }

    sfx1Played = true;
    introSfx1.currentTime = 0;

    introSfx1.play().catch(() => {
        // Se l'audio non è ancora stato autorizzato dal browser,
        // il fallback di sblocco proverà a riprodurlo se siamo ancora
        // sulla scena 4.
        sfx1Played = false;
    });
}

async function unlockAudio() {
    if (audioUnlocked) {
        return;
    }

    try {
        if (introMusic) {
            await introMusic.play();
        }

        audioUnlocked = true;

        if (currentSceneIndex === 3 && !sfx1Played) {
            playSceneSfx(currentSceneIndex);
        }
    } catch (error) {
        return;
    }

    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
}

function showSceneImmediately(index) {
    if (!introImage) {
        return;
    }

    if (index < 0 || index >= INTRO_IMAGES.length) {
        return;
    }

    currentSceneIndex = index;
    introImage.src = INTRO_IMAGES[currentSceneIndex];
    introImage.classList.remove("is-fading");

    playSceneSfx(currentSceneIndex);
}

function transitionToScene(index) {
    if (!introImage) {
        return;
    }

    if (index < 0 || index >= INTRO_IMAGES.length) {
        return;
    }

    clearTimeout(transitionTimer);

    introImage.classList.add("is-fading");

    transitionTimer = window.setTimeout(() => {
        currentSceneIndex = index;
        introImage.src = INTRO_IMAGES[currentSceneIndex];

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                introImage.classList.remove("is-fading");
            });
        });

        playSceneSfx(currentSceneIndex);
    }, FADE_DURATION_MS);
}

function scheduleNextScene() {
    clearTimeout(sceneTimer);

    if (currentSceneIndex >= INTRO_IMAGES.length - 1) {
        return;
    }

    sceneTimer = window.setTimeout(() => {
        transitionToScene(currentSceneIndex + 1);

        window.setTimeout(() => {
            scheduleNextScene();
        }, FADE_DURATION_MS);
    }, SCENE_DURATION_MS);
}

function startIntro() {
    preloadIntroImages();
    showSceneImmediately(0);
    startBackgroundMusic();
    scheduleNextScene();

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
}

window.addEventListener("DOMContentLoaded", startIntro);
