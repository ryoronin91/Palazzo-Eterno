const SCENE_DURATION_MS = 6000;
const FADE_DURATION_MS = 350;

const scenes = [
    "immagini/intro1.png",
    "immagini/intro2.png",
    "immagini/intro3.png",
    "immagini/intro4.png",
    "immagini/intro5.png"
];

let currentScene = 0;
let sceneTimer = null;
let sfx1Played = false;

const introImage =
    document.getElementById("intro-image");

const introMusic =
    document.getElementById("intro-music");

const introSfx1 =
    document.getElementById("intro-sfx1");


function preloadIntroImages() {

    scenes.forEach((src) => {

        const img = new Image();

        img.src = src;
    });
}


function showSceneImmediately(index) {

    if (
        !introImage ||
        !scenes[index]
    ) {
        return;
    }

    currentScene = index;

    introImage.src =
        scenes[index];

    introImage.classList.remove(
        "is-fading"
    );

    playSceneSfx(index);
}


function startBackgroundMusic() {

    if (!introMusic) {
        return;
    }

    introMusic.loop = true;

    introMusic.currentTime = 0;

    introMusic
        .play()
        .catch((error) => {

            console.warn(
                "Autoplay musica bloccato dal browser:",
                error
            );
        });
}


function unlockAudio() {

    if (
        introMusic &&
        introMusic.paused
    ) {

        introMusic
            .play()
            .catch(() => {});
    }

    window.removeEventListener(
        "pointerdown",
        unlockAudio
    );

    window.removeEventListener(
        "keydown",
        unlockAudio
    );
}


function playSceneSfx(index) {

    if (
        index !== 3 ||
        sfx1Played ||
        !introSfx1
    ) {
        return;
    }

    sfx1Played = true;

    introSfx1.currentTime = 0;

    introSfx1
        .play()
        .catch(() => {

            sfx1Played = false;
        });
}


function changeScene(nextIndex) {

    if (
        !introImage ||
        nextIndex < 0 ||
        nextIndex >= scenes.length
    ) {
        return;
    }

    introImage.classList.add(
        "is-fading"
    );

    window.setTimeout(() => {

        currentScene =
            nextIndex;

        introImage.src =
            scenes[currentScene];

        playSceneSfx(
            currentScene
        );

        requestAnimationFrame(() => {

            introImage.classList.remove(
                "is-fading"
            );
        });

    }, FADE_DURATION_MS);
}


function scheduleNextScene() {

    clearTimeout(sceneTimer);

    if (
        currentScene >=
        scenes.length - 1
    ) {
        return;
    }

    sceneTimer =
        window.setTimeout(() => {

            changeScene(
                currentScene + 1
            );

            window.setTimeout(() => {

                scheduleNextScene();

            }, FADE_DURATION_MS);

        }, SCENE_DURATION_MS);
}


function startIntro() {

    preloadIntroImages();

    showSceneImmediately(0);

    // Tenta di far partire la musica subito
    // dalla prima slide.
    startBackgroundMusic();

    scheduleNextScene();

    // Fallback:
    // se il browser blocca l'autoplay,
    // la musica parte al primo click o tasto.
    window.addEventListener(
        "pointerdown",
        unlockAudio
    );

    window.addEventListener(
        "keydown",
        unlockAudio
    );
}


document.addEventListener(
    "DOMContentLoaded",
    startIntro
);