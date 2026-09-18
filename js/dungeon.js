// ============================================================
// PALAZZO ETERNO
// DUNGEON.JS
// ============================================================
//
// Gestisce:
//
// - autenticazione Supabase
// - caricamento personaggio
// - caricamento dungeon.json
// - posizione iniziale X=10 Y=1
// - movimento con WASD / frecce
// - movimento cliccando una casella adiacente
// - controllo muri e celle percorribili
// - salvataggio posizione
// - visualizzazione token personale
// - statistiche del personaggio
// - caricamento e salvataggio delle note
//
// ============================================================


console.log("DUNGEON.JS CARICATO");


// ============================================================
// SUPABASE
// ============================================================

const db = supabaseClient;


// ============================================================
// CONFIGURAZIONE MAPPA
// ============================================================

const MAP_COLUMNS = 23;
const MAP_ROWS = 23;


// Offset della matrice cells di dungeon.json
// rispetto alla mappa visibile.

const GRID_OFFSET_X = 4;
const GRID_OFFSET_Y = 4;


// ============================================================
// POSIZIONE INIZIALE
// ============================================================

const INITIAL_PLAYER_X = 10;
const INITIAL_PLAYER_Y = 1;


// ============================================================
// VARIABILI
// ============================================================

let dungeonData = null;

let character = null;

let playerX = null;
let playerY = null;

let tokenElement = null;

let movementLocked = false;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Pagina dungeon pronta."
        );


        try {

            // ------------------------------------------------
            // PERSONAGGIO
            // ------------------------------------------------

            await loadCharacter();


            // ------------------------------------------------
            // NOTE
            // ------------------------------------------------
            //
            // Vengono inizializzate PRIMA della mappa.
            //
            // Così continuano a funzionare anche nel caso
            // in cui dungeon.json abbia un problema.
            //

            setupNotes();


            // ------------------------------------------------
            // MAPPA
            // ------------------------------------------------

            await loadDungeon();


            // ------------------------------------------------
            // POSIZIONE
            // ------------------------------------------------

            await initializePlayer();


            // ------------------------------------------------
            // MOVIMENTO
            // ------------------------------------------------

            setupMovement();


        } catch (error) {

            console.error(
                "Errore durante l'avvio del dungeon:",
                error
            );


            showError(
                error.message ||
                "Errore durante il caricamento del dungeon."
            );

        }

    }
);


// ============================================================
// CARICAMENTO DUNGEON.JSON
// ============================================================

async function loadDungeon() {

    console.log(
        "Caricamento dungeon.json..."
    );


    const response =
        await fetch(
            "dungeon.json"
        );


    if (!response.ok) {

        throw new Error(
            "Impossibile caricare dungeon.json"
        );

    }


    dungeonData =
        await response.json();


    console.log(
        "Dungeon JSON caricato:",
        dungeonData
    );


    if (
        !dungeonData.cells
    ) {

        throw new Error(
            "Il file dungeon.json non contiene la matrice cells."
        );

    }


    console.log(
        "Griglia visibile:",
        MAP_COLUMNS,
        "x",
        MAP_ROWS
    );


    console.log(
        "Matrice interna:",
        dungeonData.cells[0].length,
        "x",
        dungeonData.cells.length
    );

}


// ============================================================
// CARICAMENTO PERSONAGGIO
// ============================================================

async function loadCharacter() {

    console.log(
        "Caricamento personaggio..."
    );


    // --------------------------------------------------------
    // AUTENTICAZIONE
    // --------------------------------------------------------

    const {
        data: {
            user
        },
        error: authError
    } =
        await db.auth.getUser();


    if (authError) {

        throw authError;

    }


    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    console.log(
        "Utente autenticato:",
        user.id
    );


    // --------------------------------------------------------
    // PERSONAGGIO
    // --------------------------------------------------------

    const {
        data,
        error
    } =
        await db
            .from("characters")
            .select("*")
            .eq(
                "user_id",
                user.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    if (!data) {

        alert(
            "Non hai ancora creato un personaggio."
        );


        window.location.href =
            "personaggio.html";


        return;

    }


    character =
        data;


    console.log(
        "Personaggio caricato:",
        character
    );


    updateCharacterPanel();

}


// ============================================================
// AGGIORNA SCHEDA PERSONAGGIO
// ============================================================

function updateCharacterPanel() {

    if (!character) {

        return;

    }


    // --------------------------------------------------------
    // NOME
    // --------------------------------------------------------

    const name =
        character.nome ||
        "Avventuriero";


    const nameHeader =
        document.getElementById(
            "character-name"
        );


    const namePanel =
        document.getElementById(
            "character-name-panel"
        );


    if (nameHeader) {

        nameHeader.textContent =
            name;

    }


    if (namePanel) {

        namePanel.textContent =
            name;

    }


    // --------------------------------------------------------
    // LIVELLO
    // --------------------------------------------------------

    const level =
        Number(
            character.livello
        ) || 1;


    const levelElement =
        document.getElementById(
            "character-level"
        );


    if (levelElement) {

        levelElement.textContent =
            level;

    }


    // --------------------------------------------------------
    // TOKEN
    // --------------------------------------------------------

    const tokenImage =
        document.getElementById(
            "character-token"
        );


    if (tokenImage) {

        const tokenFile =
            character.token ||
            "token_1.png";


        tokenImage.src =
            "immagini/token/" +
            tokenFile;


        tokenImage.alt =
            "Token di " +
            name;


        tokenImage.onerror =
            () => {

                console.error(
                    "Impossibile caricare il token:",
                    tokenFile
                );

            };

    }


    // --------------------------------------------------------
    // ATTRIBUTI
    // --------------------------------------------------------

    const forza =
        Number(
            character.forza
        ) || 1;


    const resistenza =
        Number(
            character.resistenza
        ) || 1;


    const costituzione =
        Number(
            character.costituzione
        ) || 1;


    const intelligenza =
        Number(
            character.intelligenza
        ) || 1;


    const destrezza =
        Number(
            character.destrezza
        ) || 1;


    const fortuna =
        Number(
            character.fortuna
        ) || 1;


    setText(
        "forza-display",
        forza
    );


    setText(
        "resistenza-display",
        resistenza
    );


    setText(
        "costituzione-display",
        costituzione
    );


    setText(
        "intelligenza-display",
        intelligenza
    );


    setText(
        "destrezza-display",
        destrezza
    );


    setText(
        "fortuna-display",
        fortuna
    );


    // --------------------------------------------------------
    // STATISTICHE SECONDARIE
    // --------------------------------------------------------

    const attack =
        Math.ceil(
            forza / 2
        );


    const defense =
        7 +
        Math.ceil(
            resistenza / 2
        );


    const health =
        5 *
        Math.ceil(
            costituzione / 2
        );


    const mana =
        5 *
        Math.ceil(
            intelligenza / 2
        );


    const movement =
        4 +
        Math.ceil(
            destrezza / 2
        );


    const critical =
        Math.round(
            (
                fortuna *
                (50 / 30)
            ) *
            100
        ) / 100;


    // --------------------------------------------------------
    // VISUALIZZAZIONE
    // --------------------------------------------------------

    setText(
        "attack-display",
        attack
    );


    setText(
        "defense-display",
        defense
    );


    setText(
        "health-display",
        health
    );


    setText(
        "mana-display",
        mana
    );


    setText(
        "movement-display",
        movement
    );


    setText(
        "critical-display",
        critical + "%"
    );

}


// ============================================================
// FUNZIONE SET TEXT
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ============================================================
// INIZIALIZZAZIONE GIOCATORE
// ============================================================

async function initializePlayer() {

    console.log(
        "Controllo posizione del personaggio..."
    );


    // --------------------------------------------------------
    // POSIZIONE GIÀ SALVATA
    // --------------------------------------------------------

    if (
        character.dungeon_x !== null &&
        character.dungeon_x !== undefined &&
        character.dungeon_y !== null &&
        character.dungeon_y !== undefined
    ) {

        playerX =
            Number(
                character.dungeon_x
            );


        playerY =
            Number(
                character.dungeon_y
            );


        console.log(
            "Posizione già presente:",
            playerX,
            playerY
        );


        showToken(
            playerX,
            playerY
        );


        setMessage(
            "Usa WASD o le frecce per muoverti."
        );


        return;

    }


    // --------------------------------------------------------
    // PRIMA ENTRATA
    // --------------------------------------------------------

    console.log(
        "Prima entrata nel dungeon."
    );


    playerX =
        INITIAL_PLAYER_X;


    playerY =
        INITIAL_PLAYER_Y;


    console.log(
        "Posizione iniziale:",
        playerX,
        playerY
    );


    // --------------------------------------------------------
    // SALVATAGGIO
    // --------------------------------------------------------

    const {
        error
    } =
        await db
            .from("characters")
            .update({

                dungeon_x:
                    playerX,

                dungeon_y:
                    playerY

            })
            .eq(
                "id",
                character.id
            );


    if (error) {

        throw error;

    }


    character.dungeon_x =
        playerX;


    character.dungeon_y =
        playerY;


    console.log(
        "Posizione iniziale salvata."
    );


    // --------------------------------------------------------
    // TOKEN
    // --------------------------------------------------------

    showToken(
        playerX,
        playerY
    );


    setMessage(
        "Usa WASD o le frecce per muoverti."
    );

}


// ============================================================
// CONTROLLO CELLA PERCORRIBILE
// ============================================================

function isWalkable(
    x,
    y
) {

    if (!dungeonData) {

        return false;

    }


    // --------------------------------------------------------
    // LIMITI MAPPA VISIBILE
    // --------------------------------------------------------

    if (
        x < 0 ||
        y < 0 ||
        x >= MAP_COLUMNS ||
        y >= MAP_ROWS
    ) {

        return false;

    }


    // --------------------------------------------------------
    // CONVERSIONE COORDINATE MAPPA -> JSON
    // --------------------------------------------------------

    const jsonX =
        x +
        GRID_OFFSET_X;


    const jsonY =
        y +
        GRID_OFFSET_Y;


    // --------------------------------------------------------
    // CONTROLLO MATRICE
    // --------------------------------------------------------

    if (
        !dungeonData.cells[jsonY] ||
        dungeonData.cells[jsonY][jsonX] === undefined
    ) {

        return false;

    }


    const value =
        Number(
            dungeonData.cells[jsonY][jsonX]
        );


    if (
        !Number.isFinite(
            value
        )
    ) {

        return false;

    }


    // --------------------------------------------------------
    // BIT DEL DUNGEON
    // --------------------------------------------------------

    const bits =
        dungeonData.cell_bit ||
        {};


    const ROOM =
        bits.room ||
        2;


    const CORRIDOR =
        bits.corridor ||
        4;


    const APERTURE =
        bits.aperture ||
        32;


    const ARCH =
        bits.arch ||
        65536;


    const DOOR =
        bits.door ||
        131072;


    const PORTCULLIS =
        bits.portcullis ||
        2097152;


    const STAIR_DOWN =
        bits.stair_down ||
        4194304;


    const STAIR_UP =
        bits.stair_up ||
        8388608;


    // --------------------------------------------------------
    // CELLE CONSENTITE
    // --------------------------------------------------------

    const walkable =
        (
            (value & ROOM) !== 0 ||
            (value & CORRIDOR) !== 0 ||
            (value & APERTURE) !== 0 ||
            (value & ARCH) !== 0 ||
            (value & DOOR) !== 0 ||
            (value & PORTCULLIS) !== 0 ||
            (value & STAIR_DOWN) !== 0 ||
            (value & STAIR_UP) !== 0
        );


    return walkable;

}


// ============================================================
// CONFIGURAZIONE MOVIMENTO
// ============================================================

function setupMovement() {

    console.log(
        "Movimento attivato."
    );


    // --------------------------------------------------------
    // TASTIERA
    // --------------------------------------------------------

    document.addEventListener(
        "keydown",
        handleMovementKey
    );


    // --------------------------------------------------------
    // CLICK SULLA MAPPA
    // --------------------------------------------------------

    const image =
        document.getElementById(
            "dungeon-image"
        );


    if (image) {

        image.style.cursor =
            "pointer";


        image.addEventListener(
            "click",
            handleMapClick
        );

    }

}


// ============================================================
// MOVIMENTO DA TASTIERA
// ============================================================

function handleMovementKey(
    event
) {

    // Se stiamo scrivendo nelle note,
    // WASD e frecce devono continuare a scrivere normalmente.

    const activeElement =
        document.activeElement;


    if (
        activeElement &&
        (
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "INPUT"
        )
    ) {

        return;

    }


    let dx = 0;
    let dy = 0;


    switch (
        event.key.toLowerCase()
    ) {

        case "w":
        case "arrowup":

            dy = -1;

            break;


        case "s":
        case "arrowdown":

            dy = 1;

            break;


        case "a":
        case "arrowleft":

            dx = -1;

            break;


        case "d":
        case "arrowright":

            dx = 1;

            break;


        default:

            return;

    }


    // Impedisce alle frecce di scorrere la pagina.

    event.preventDefault();


    movePlayer(
        dx,
        dy
    );

}


// ============================================================
// MOVIMENTO CON CLICK
// ============================================================

function handleMapClick(
    event
) {

    if (
        playerX === null ||
        playerY === null
    ) {

        return;

    }


    const image =
        document.getElementById(
            "dungeon-image"
        );


    if (!image) {

        return;

    }


    const rect =
        image.getBoundingClientRect();


    const cellWidth =
        rect.width /
        MAP_COLUMNS;


    const cellHeight =
        rect.height /
        MAP_ROWS;


    // --------------------------------------------------------
    // COORDINATE CLICCATE
    // --------------------------------------------------------

    const clickX =
        event.clientX -
        rect.left;


    const clickY =
        event.clientY -
        rect.top;


    const targetX =
        Math.floor(
            clickX /
            cellWidth
        );


    const targetY =
        Math.floor(
            clickY /
            cellHeight
        );


    // --------------------------------------------------------
    // DEVE ESSERE UNA CASELLA ADIACENTE
    // --------------------------------------------------------

    const dx =
        targetX -
        playerX;


    const dy =
        targetY -
        playerY;


    const distance =
        Math.abs(dx) +
        Math.abs(dy);


    if (
        distance !== 1
    ) {

        return;

    }


    movePlayer(
        dx,
        dy
    );

}


// ============================================================
// MUOVI GIOCATORE
// ============================================================

async function movePlayer(
    dx,
    dy
) {

    if (
        movementLocked
    ) {

        return;

    }


    if (
        playerX === null ||
        playerY === null
    ) {

        return;

    }


    const targetX =
        playerX +
        dx;


    const targetY =
        playerY +
        dy;


    console.log(
        "Tentativo movimento:",
        playerX,
        playerY,
        "->",
        targetX,
        targetY
    );


    // --------------------------------------------------------
    // CONTROLLO MURO
    // --------------------------------------------------------

    if (
        !isWalkable(
            targetX,
            targetY
        )
    ) {

        console.log(
            "Movimento bloccato."
        );


        setMessage(
            "Non puoi andare in quella direzione."
        );


        return;

    }


    movementLocked =
        true;


    const previousX =
        playerX;


    const previousY =
        playerY;


    // --------------------------------------------------------
    // MOVIMENTO VISIVO
    // --------------------------------------------------------

    playerX =
        targetX;


    playerY =
        targetY;


    showToken(
        playerX,
        playerY
    );


    // --------------------------------------------------------
    // SALVATAGGIO SU SUPABASE
    // --------------------------------------------------------

    const success =
        await savePlayerPosition();


    // --------------------------------------------------------
    // SE IL SALVATAGGIO FALLISCE
    // TORNIAMO ALLA POSIZIONE PRECEDENTE
    // --------------------------------------------------------

    if (!success) {

        playerX =
            previousX;


        playerY =
            previousY;


        showToken(
            playerX,
            playerY
        );


        setMessage(
            "Errore durante il salvataggio della posizione."
        );


        movementLocked =
            false;


        return;

    }


    // --------------------------------------------------------
    // AGGIORNA PERSONAGGIO LOCALE
    // --------------------------------------------------------

    character.dungeon_x =
        playerX;


    character.dungeon_y =
        playerY;


    console.log(
        "Nuova posizione:",
        playerX,
        playerY
    );


    setMessage(
        "Posizione: X " +
        playerX +
        " • Y " +
        playerY
    );


    movementLocked =
        false;

}


// ============================================================
// SALVA POSIZIONE
// ============================================================

async function savePlayerPosition() {

    try {

        const {
            error
        } =
            await db
                .from("characters")
                .update({

                    dungeon_x:
                        playerX,

                    dungeon_y:
                        playerY,

                    updated_at:
                        new Date().toISOString()

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            console.error(
                "Errore salvataggio posizione:",
                error
            );


            return false;

        }


        return true;


    } catch (error) {

        console.error(
            "Errore salvataggio posizione:",
            error
        );


        return false;

    }

}


// ============================================================
// MAPPA
// ============================================================

function getMapContainer() {

    const image =
        document.getElementById(
            "dungeon-image"
        );


    if (!image) {

        throw new Error(
            "Immagine della mappa non trovata."
        );

    }


    const container =
        document.getElementById(
            "dungeon-map"
        );


    if (!container) {

        throw new Error(
            "Contenitore della mappa non trovato."
        );

    }


    const style =
        window.getComputedStyle(
            container
        );


    if (
        style.position === "static"
    ) {

        container.style.position =
            "relative";

    }


    return {

        image,
        container

    };

}


// ============================================================
// MOSTRA TOKEN
// ============================================================

function showToken(
    x,
    y
) {

    console.log(
        "Visualizzazione token:",
        x,
        y
    );


    try {

        const {
            image,
            container
        } =
            getMapContainer();


        // ----------------------------------------------------
        // RIMUOVI TOKEN PRECEDENTE
        // ----------------------------------------------------

        if (tokenElement) {

            tokenElement.remove();

            tokenElement =
                null;

        }


        // ----------------------------------------------------
        // DIMENSIONI MAPPA
        // ----------------------------------------------------

        const mapRect =
            image.getBoundingClientRect();


        const containerRect =
            container.getBoundingClientRect();


        const cellWidth =
            mapRect.width /
            MAP_COLUMNS;


        const cellHeight =
            mapRect.height /
            MAP_ROWS;


        // ----------------------------------------------------
        // CREA TOKEN
        // ----------------------------------------------------

        const token =
            document.createElement(
                "img"
            );


        token.className =
            "dungeon-player-token";


        const tokenFile =
            character.token ||
            "token_1.png";


        token.src =
            "immagini/token/" +
            tokenFile;


        token.alt =
            "Token di " +
            (
                character.nome ||
                "personaggio"
            );


        token.title =
            character.nome ||
            "Personaggio";


        // ----------------------------------------------------
        // DIMENSIONI
        // ----------------------------------------------------

        const tokenSize =
            Math.min(
                cellWidth,
                cellHeight
            ) * 0.92;


        token.style.position =
            "absolute";


        token.style.width =
            `${tokenSize}px`;


        token.style.height =
            `${tokenSize}px`;


        token.style.objectFit =
            "contain";


        token.style.boxSizing =
            "border-box";


        token.style.zIndex =
            "100";


        token.style.pointerEvents =
            "none";


        // ----------------------------------------------------
        // CENTRO DELLA CASELLA
        // ----------------------------------------------------

        const centerX =
            (
                x + 0.5
            ) *
            cellWidth;


        const centerY =
            (
                y + 0.5
            ) *
            cellHeight;


        // ----------------------------------------------------
        // OFFSET MAPPA
        // ----------------------------------------------------

        const offsetX =
            mapRect.left -
            containerRect.left;


        const offsetY =
            mapRect.top -
            containerRect.top;


        // ----------------------------------------------------
        // POSIZIONE
        // ----------------------------------------------------

        token.style.left =
            `${
                offsetX +
                centerX -
                (tokenSize / 2)
            }px`;


        token.style.top =
            `${
                offsetY +
                centerY -
                (tokenSize / 2)
            }px`;


        // ----------------------------------------------------
        // INSERIMENTO
        // ----------------------------------------------------

        container.appendChild(
            token
        );


        tokenElement =
            token;


        console.log(
            "Token creato:",
            token.src
        );


    } catch (error) {

        console.error(
            "Errore nella visualizzazione del token:",
            error
        );


        showError(
            "Errore nella visualizzazione del personaggio."
        );

    }

}


// ============================================================
// NOTE
// ============================================================

function setupNotes() {

    const textarea =
        document.getElementById(
            "character-notes"
        );


    const saveButton =
        document.getElementById(
            "save-notes-button"
        );


    if (!textarea || !saveButton) {

        console.warn(
            "Campo note o pulsante salva non trovato."
        );

        return;

    }


    // --------------------------------------------------------
    // CARICAMENTO NOTE
    // --------------------------------------------------------

    textarea.value =
        character.notes ||
        "";


    console.log(
        "Note caricate:",
        character.notes
    );


    // --------------------------------------------------------
    // SALVATAGGIO
    // --------------------------------------------------------

    saveButton.addEventListener(
        "click",
        saveNotes
    );

}


// ============================================================
// SALVA NOTE
// ============================================================

async function saveNotes() {

    const textarea =
        document.getElementById(
            "character-notes"
        );


    const message =
        document.getElementById(
            "notes-message"
        );


    if (!textarea) {

        return;

    }


    if (!character) {

        console.error(
            "Personaggio non caricato."
        );

        return;

    }


    const notes =
        textarea.value;


    if (message) {

        message.textContent =
            "Salvataggio...";

    }


    console.log(
        "Salvataggio note:",
        notes
    );


    const {
        data,
        error
    } =
        await db
            .from("characters")
            .update({

                notes:
                    notes,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                character.id
            )
            .select(
                "id, notes"
            )
            .single();


    if (error) {

        console.error(
            "Errore salvataggio note:",
            error
        );


        if (message) {

            message.textContent =
                "Errore durante il salvataggio delle note.";

        }


        return;

    }


    character.notes =
        data.notes ||
        "";


    textarea.value =
        character.notes;


    console.log(
        "Note salvate su Supabase:",
        data
    );


    if (message) {

        message.textContent =
            "Note salvate.";

    }


    setTimeout(
        () => {

            if (
                message &&
                message.textContent ===
                "Note salvate."
            ) {

                message.textContent =
                    "";

            }

        },
        2500
    );

}


// ============================================================
// MESSAGGIO
// ============================================================

function setMessage(
    text
) {

    const element =
        document.getElementById(
            "dungeon-message"
        );


    if (element) {

        element.textContent =
            text;

        element.style.color =
            "";

    }

}


// ============================================================
// ERRORI
// ============================================================

function showError(
    text
) {

    console.error(
        text
    );


    const element =
        document.getElementById(
            "dungeon-message"
        );


    if (element) {

        element.textContent =
            text;

        element.style.color =
            "#d66";

    }

}


// ============================================================
// LOGOUT
// ============================================================

const logoutButton =
    document.getElementById(
        "logout-button"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            await db
                .auth
                .signOut();


            window.location.href =
                "index.html";

        }
    );

}


// ============================================================
// RIDIMENSIONAMENTO
// ============================================================

window.addEventListener(
    "resize",
    () => {

        if (
            playerX !== null &&
            playerY !== null
        ) {

            showToken(
                playerX,
                playerY
            );

        }

    }
);