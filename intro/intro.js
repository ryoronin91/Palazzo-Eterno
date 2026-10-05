const FADE_MS = 420;

const scenes = [
    {
        image: null,
        text:
            "Misteriosa figura: Così vicino, eppure così lontano",
        black: true
    },
    {
        image:
            "immagini/intro1.png",
        text:
            "Misteriosa figura: L'ingresso dalle fogne è stato bloccato. Non sono stato abbastanza veloce.",
        startMusic: true
    },
    {
        image:
            "immagini/intro2.png",
        text:
            "Misteriosa figura: Chiusa una porta si apre un portone. Vorrà dire che entrerò dalla porta principale"
    },
    {
        image:
            "immagini/intro3.png",
        text:
            "Misteriosa figura: Vieni, avvicinati. Devi fare un lavoro per me...."
    },
    {
        image:
            "immagini/intro4.png",
        text:
            "Misteriosa figura: .... che tu lo voglia oppure no.",
        playSfx1: true
    },
    {
        image:
            "immagini/intro5.png",
        text:
            "Misteriosa figura: Raggiungi la stanza dell'orologio, sconfiggi i custodi ed entra nel Cuore del Palazzo. Quando sarai lì ci rivedremo."
    },
    {
        image: null,
        text: "",
        black: true,
        final: true
    }
];

let currentScene = 0;
let transitioning = false;
let musicStarted = false;
let sfx1Played = false;

const introRoot =
    document.getElementById(
        "intro-root"
    );

const introImage =
    document.getElementById(
        "intro-image"
    );

const dialogueText =
    document.getElementById(
        "dialogue-text"
    );

const nextButton =
    document.getElementById(
        "next-button"
    );

const introMusic =
    document.getElementById(
        "intro-music"
    );

const introSfx1 =
    document.getElementById(
        "intro-sfx1"
    );


function preloadImages() {

    scenes.forEach(
        (scene) => {

            if (!scene.image) {
                return;
            }

            const image =
                new Image();

            image.src =
                scene.image;
        }
    );
}


function startMusic() {

    if (
        musicStarted ||
        !introMusic
    ) {
        return;
    }

    introMusic.loop = true;

    introMusic.currentTime = 0;

    introMusic
        .play()
        .then(() => {

            musicStarted = true;
        })
        .catch((error) => {

            console.warn(
                "Impossibile avviare music.mp3:",
                error
            );
        });
}


function playSfx1() {

    if (
        sfx1Played ||
        !introSfx1
    ) {
        return;
    }

    sfx1Played = true;

    introSfx1.currentTime = 0;

    introSfx1
        .play()
        .catch((error) => {

            sfx1Played = false;

            console.warn(
                "Impossibile avviare sfx1.mp3:",
                error
            );
        });
}


function applyScene(index) {

    const scene =
        scenes[index];

    if (!scene) {
        return;
    }

    currentScene = index;

    dialogueText.textContent =
        scene.text || "";

    if (
        scene.black ||
        !scene.image
    ) {

        introRoot.classList.add(
            "is-black"
        );

        introImage.removeAttribute(
            "src"
        );

    } else {

        introImage.src =
            scene.image;

        introRoot.classList.remove(
            "is-black"
        );
    }

    if (scene.startMusic) {
        startMusic();
    }

    if (scene.playSfx1) {
        playSfx1();
    }

    nextButton.setAttribute(
        "aria-label",
        scene.final
            ? "Vai alla creazione del personaggio"
            : "Avanti"
    );

    nextButton.title =
        scene.final
            ? "Continua"
            : "Avanti";
}


function goToNextScene() {

    if (transitioning) {
        return;
    }

    const scene =
        scenes[currentScene];

    if (
        scene &&
        scene.final
    ) {

        window.location.href =
            "../personaggio.html";

        return;
    }

    const nextIndex =
        currentScene + 1;

    if (
        nextIndex >=
        scenes.length
    ) {
        return;
    }

    transitioning = true;

    nextButton.disabled = true;

    introRoot.classList.add(
        "is-transitioning"
    );

    window.setTimeout(
        () => {

            applyScene(
                nextIndex
            );

            introRoot.classList.remove(
                "is-transitioning"
            );

            window.setTimeout(
                () => {

                    transitioning =
                        false;

                    nextButton.disabled =
                        false;

                },
                FADE_MS
            );

        },
        FADE_MS
    );
}


function startIntro() {

    preloadImages();

    applyScene(0);

    nextButton.addEventListener(
        "click",
        goToNextScene
    );
}


document.addEventListener(
    "DOMContentLoaded",
    startIntro
);
