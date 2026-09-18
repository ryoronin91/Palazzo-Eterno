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
// - movimento WASD / frecce
// - movimento tramite click su casella adiacente
// - controllo muri
// - salvataggio posizione
// - token personale
// - token degli altri giocatori online
// - Supabase Realtime Presence
// - Supabase Realtime Broadcast
// - statistiche del personaggio
// - caricamento e salvataggio note
// - chat realtime del piano
//
// ============================================================


console.log("DUNGEON.JS MULTIPLAYER CARICATO");


// ============================================================
// SUPABASE
// ============================================================

const db = supabaseClient;


// ============================================================
// CONFIGURAZIONE MAPPA
// ============================================================

const MAP_COLUMNS = 23;
const MAP_ROWS = 23;


// Offset corretto JSON -> mappa visibile

const GRID_OFFSET_X = 4;
const GRID_OFFSET_Y = 4;


// ============================================================
// POSIZIONE INIZIALE
// ============================================================

const INITIAL_PLAYER_X = 9;
const INITIAL_PLAYER_Y = 0;


// ============================================================
// MULTIPLAYER
// ============================================================
//
// Per ora tutti i giocatori dentro dungeon.html
// partecipano allo stesso piano.
//
// Quando aggiungeremo più piani basterà cambiare
// questo nome, ad esempio:
//
// palazzo-eterno-dungeon-1
// palazzo-eterno-dungeon-2
//
// ============================================================

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";


// ============================================================
// VARIABILI
// ============================================================

let dungeonData = null;

let character = null;

let currentUser = null;

let playerX = null;
let playerY = null;

let tokenElement = null;

let movementLocked = false;


// ============================================================
// REALTIME
// ============================================================

let dungeonChannel = null;

let realtimeReady = false;


// ============================================================
// TOKEN DEGLI ALTRI GIOCATORI
// ============================================================
//
// character_id -> elemento IMG
//
// ============================================================

const otherPlayerTokens =
    new Map();


// ============================================================
// DATI DEGLI ALTRI GIOCATORI
// ============================================================

const otherPlayers =
    new Map();


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

            setupNotes();


            // ------------------------------------------------
            // CHAT DEL PIANO
            // ------------------------------------------------

            setupFloorChat();


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


            // ------------------------------------------------
            // MULTIPLAYER
            // ------------------------------------------------

            await setupRealtimeMultiplayer();


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


    if (!dungeonData.cells) {

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
    // UTENTE
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


    currentUser =
        user;


    console.log(
        "Utente autenticato:",
        currentUser.id
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
                currentUser.id
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


    const name =
        character.nome ||
        "Avventuriero";


    // --------------------------------------------------------
    // NOME
    // --------------------------------------------------------

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
    // TOKEN NELLA SCHEDA
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
// SET TEXT
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
    // PRIMO INGRESSO
    // --------------------------------------------------------

    playerX =
        INITIAL_PLAYER_X;


    playerY =
        INITIAL_PLAYER_Y;


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


    showToken(
        playerX,
        playerY
    );


    setMessage(
        "Usa WASD o le frecce per muoverti."
    );

}


// ============================================================
// REALTIME MULTIPLAYER
// ============================================================

async function setupRealtimeMultiplayer() {

    console.log(
        "Avvio multiplayer..."
    );


    if (
        !character ||
        !currentUser
    ) {

        return;

    }


    // --------------------------------------------------------
    // CREAZIONE CANALE
    // --------------------------------------------------------

    dungeonChannel =
        db.channel(
            DUNGEON_CHANNEL_NAME,
            {

                config: {

                    presence: {

                        key:
                            character.id

                    }

                }

            }
        );


    // ========================================================
    // PRESENCE SYNC
    // ========================================================

    dungeonChannel.on(
        "presence",
        {
            event: "sync"
        },
        () => {

            console.log(
                "Presence sincronizzata."
            );


            syncOnlinePlayers();


            // Quando entra un nuovo giocatore,
            // tutti gli utenti già presenti
            // reinviano la loro posizione corrente.

            broadcastMyState();

        }
    );


    // ========================================================
    // PRESENCE JOIN
    // ========================================================

    dungeonChannel.on(
        "presence",
        {
            event: "join"
        },
        ({
            newPresences
        }) => {

            console.log(
                "Nuovo giocatore:",
                newPresences
            );

        }
    );


    // ========================================================
    // PRESENCE LEAVE
    // ========================================================

    dungeonChannel.on(
        "presence",
        {
            event: "leave"
        },
        ({
            leftPresences
        }) => {

            console.log(
                "Giocatore uscito:",
                leftPresences
            );


            // Presence sync si occuperà
            // anche di rimuovere le pedine.

        }
    );


    // ========================================================
    // MOVIMENTO DEGLI ALTRI GIOCATORI
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "player-move"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            // Ignora il nostro stesso movimento.

            if (
                data.character_id ===
                character.id
            ) {

                return;

            }


            updateRemotePlayer(
                data
            );

        }
    );


    // ========================================================
    // STATO COMPLETO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "player-state"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            if (
                data.character_id ===
                character.id
            ) {

                return;

            }


            updateRemotePlayer(
                data
            );

        }
    );


    // ========================================================
    // CHAT DEL PIANO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "floor-chat"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            // Il messaggio del giocatore locale viene già
            // mostrato immediatamente da sendFloorChatMessage().

            if (
                data.character_id ===
                character.id
            ) {

                return;

            }


            appendFloorChatMessage(
                data
            );

        }
    );


    // ========================================================
    // SUBSCRIBE
    // ========================================================

    dungeonChannel.subscribe(
        async status => {

            console.log(
                "Stato Realtime:",
                status
            );


            if (
                status !==
                "SUBSCRIBED"
            ) {

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {

                    setFloorChatConnected(
                        false
                    );

                }


                return;

            }


            realtimeReady =
                true;


            setFloorChatConnected(
                true
            );


            // ------------------------------------------------
            // REGISTRA PRESENZA
            // ------------------------------------------------

            const presenceData = {

                user_id:
                    currentUser.id,

                character_id:
                    character.id,

                nome:
                    character.nome ||
                    "Avventuriero",

                token:
                    character.token ||
                    "token_1.png",

                x:
                    playerX,

                y:
                    playerY,

                online_at:
                    new Date()
                        .toISOString()

            };


            const trackResult =
                await dungeonChannel.track(
                    presenceData
                );


            console.log(
                "Presence registrata:",
                trackResult
            );


            // ------------------------------------------------
            // INVIA POSIZIONE
            // ------------------------------------------------

            broadcastMyState();

        }
    );

}


// ============================================================
// SINCRONIZZA GIOCATORI ONLINE
// ============================================================

function syncOnlinePlayers() {

    if (!dungeonChannel) {

        return;

    }


    const presenceState =
        dungeonChannel
            .presenceState();


    console.log(
        "Giocatori online:",
        presenceState
    );


    const onlineCharacterIds =
        new Set();


    // --------------------------------------------------------
    // LEGGI TUTTE LE PRESENZE
    // --------------------------------------------------------

    Object.values(
        presenceState
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence.character_id
                    ) {

                        return;

                    }


                    // Il nostro personaggio
                    // viene già disegnato separatamente.

                    if (
                        presence.character_id ===
                        character.id
                    ) {

                        return;

                    }


                    onlineCharacterIds.add(
                        presence.character_id
                    );


                    updateRemotePlayer(
                        presence
                    );

                }
            );

        }
    );


    // --------------------------------------------------------
    // RIMUOVI CHI NON È PIÙ ONLINE
    // --------------------------------------------------------

    for (
        const [
            characterId,
            token
        ]
        of otherPlayerTokens
    ) {

        if (
            !onlineCharacterIds.has(
                characterId
            )
        ) {

            token.remove();


            otherPlayerTokens.delete(
                characterId
            );


            otherPlayers.delete(
                characterId
            );


            console.log(
                "Rimossa pedina offline:",
                characterId
            );

        }

    }


    updateFloorChatOnlineStatus();

}


// ============================================================
// CREA / AGGIORNA GIOCATORE REMOTO
// ============================================================

function updateRemotePlayer(
    data
) {

    if (
        !data ||
        !data.character_id
    ) {

        return;

    }


    if (
        data.character_id ===
        character.id
    ) {

        return;

    }


    const x =
        Number(
            data.x
        );


    const y =
        Number(
            data.y
        );


    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;

    }


    // --------------------------------------------------------
    // SALVA DATI LOCALI
    // --------------------------------------------------------

    otherPlayers.set(
        data.character_id,
        {

            character_id:
                data.character_id,

            user_id:
                data.user_id,

            nome:
                data.nome ||
                "Giocatore",

            token:
                data.token ||
                "token_1.png",

            x:
                x,

            y:
                y

        }
    );


    // --------------------------------------------------------
    // DISEGNA TOKEN
    // --------------------------------------------------------

    showRemoteToken(
        data.character_id
    );

}


// ============================================================
// MOSTRA TOKEN REMOTO
// ============================================================

function showRemoteToken(
    characterId
) {

    const player =
        otherPlayers.get(
            characterId
        );


    if (!player) {

        return;

    }


    try {

        const {
            image,
            container
        } =
            getMapContainer();


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
        // CREA O RECUPERA TOKEN
        // ----------------------------------------------------

        let token =
            otherPlayerTokens.get(
                characterId
            );


        if (!token) {

            token =
                document.createElement(
                    "img"
                );


            token.className =
                "dungeon-player-token dungeon-other-player-token";


            token.style.position =
                "absolute";


            token.style.objectFit =
                "contain";


            token.style.boxSizing =
                "border-box";


            token.style.zIndex =
                "90";


            token.style.pointerEvents =
                "none";


            container.appendChild(
                token
            );


            otherPlayerTokens.set(
                characterId,
                token
            );

        }


        // ----------------------------------------------------
        // IMMAGINE
        // ----------------------------------------------------

        token.src =
            "immagini/token/" +
            player.token;


        token.alt =
            "Token di " +
            player.nome;


        token.title =
            player.nome;


        // ----------------------------------------------------
        // DIMENSIONI
        // ----------------------------------------------------

        const tokenSize =
            Math.min(
                cellWidth,
                cellHeight
            ) * 0.92;


        token.style.width =
            `${tokenSize}px`;


        token.style.height =
            `${tokenSize}px`;


        // ----------------------------------------------------
        // POSIZIONE
        // ----------------------------------------------------

        const centerX =
            (
                player.x +
                0.5
            ) *
            cellWidth;


        const centerY =
            (
                player.y +
                0.5
            ) *
            cellHeight;


        const offsetX =
            mapRect.left -
            containerRect.left;


        const offsetY =
            mapRect.top -
            containerRect.top;


        token.style.left =
            `${
                offsetX +
                centerX -
                tokenSize / 2
            }px`;


        token.style.top =
            `${
                offsetY +
                centerY -
                tokenSize / 2
            }px`;


    } catch (error) {

        console.error(
            "Errore token remoto:",
            error
        );

    }

}


// ============================================================
// INVIA STATO PERSONAGGIO
// ============================================================

function broadcastMyState() {

    if (
        !dungeonChannel ||
        !realtimeReady ||
        !character
    ) {

        return;

    }


    dungeonChannel.send({

        type:
            "broadcast",

        event:
            "player-state",

        payload: {

            user_id:
                currentUser.id,

            character_id:
                character.id,

            nome:
                character.nome ||
                "Avventuriero",

            token:
                character.token ||
                "token_1.png",

            x:
                playerX,

            y:
                playerY

        }

    });

}


// ============================================================
// INVIA MOVIMENTO
// ============================================================

function broadcastMovement() {

    if (
        !dungeonChannel ||
        !realtimeReady ||
        !character
    ) {

        return;

    }


    dungeonChannel.send({

        type:
            "broadcast",

        event:
            "player-move",

        payload: {

            user_id:
                currentUser.id,

            character_id:
                character.id,

            nome:
                character.nome ||
                "Avventuriero",

            token:
                character.token ||
                "token_1.png",

            x:
                playerX,

            y:
                playerY

        }

    });

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


    if (
        x < 0 ||
        y < 0 ||
        x >= MAP_COLUMNS ||
        y >= MAP_ROWS
    ) {

        return false;

    }


    // --------------------------------------------------------
    // MAPPA -> JSON
    // --------------------------------------------------------

    const jsonX =
        x +
        GRID_OFFSET_X;


    const jsonY =
        y +
        GRID_OFFSET_Y;


    if (
        !dungeonData.cells[jsonY] ||
        dungeonData.cells[jsonY][jsonX] ===
        undefined
    ) {

        return false;

    }


    const value =
        Number(
            dungeonData
                .cells[jsonY][jsonX]
        );


    if (
        !Number.isFinite(
            value
        )
    ) {

        return false;

    }


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


    return (

        (value & ROOM) !== 0 ||

        (value & CORRIDOR) !== 0 ||

        (value & APERTURE) !== 0 ||

        (value & ARCH) !== 0 ||

        (value & DOOR) !== 0 ||

        (value & PORTCULLIS) !== 0 ||

        (value & STAIR_DOWN) !== 0 ||

        (value & STAIR_UP) !== 0

    );

}


// ============================================================
// MOVIMENTO
// ============================================================

function setupMovement() {

    console.log(
        "Movimento attivato."
    );


    document.addEventListener(
        "keydown",
        handleMovementKey
    );


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
// MOVIMENTO TASTIERA
// ============================================================

function handleMovementKey(
    event
) {

    const activeElement =
        document.activeElement;


    // Se stiamo scrivendo nelle note,
    // non muovere il personaggio.

    if (
        activeElement &&
        (
            activeElement.tagName ===
            "TEXTAREA" ||

            activeElement.tagName ===
            "INPUT"
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


    event.preventDefault();


    movePlayer(
        dx,
        dy
    );

}


// ============================================================
// MOVIMENTO CLICK
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


    const dx =
        targetX -
        playerX;


    const dy =
        targetY -
        playerY;


    // Solo movimento ortogonale
    // verso una casella adiacente.

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

    if (movementLocked) {

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


    // --------------------------------------------------------
    // MURO
    // --------------------------------------------------------

    if (
        !isWalkable(
            targetX,
            targetY
        )
    ) {

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
    // MOVIMENTO LOCALE
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
    // MULTIPLAYER
    // --------------------------------------------------------
    //
    // Gli altri giocatori vedono immediatamente
    // il movimento.
    //

    broadcastMovement();


    // --------------------------------------------------------
    // DATABASE
    // --------------------------------------------------------

    const success =
        await savePlayerPosition();


    if (!success) {

        playerX =
            previousX;


        playerY =
            previousY;


        showToken(
            playerX,
            playerY
        );


        // Comunica agli altri che siamo tornati indietro.

        broadcastMovement();


        setMessage(
            "Errore durante il salvataggio della posizione."
        );


        movementLocked =
            false;


        return;

    }


    character.dungeon_x =
        playerX;


    character.dungeon_y =
        playerY;


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
                        new Date()
                            .toISOString()

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
        style.position ===
        "static"
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
// MOSTRA TOKEN PERSONALE
// ============================================================

function showToken(
    x,
    y
) {

    try {

        const {
            image,
            container
        } =
            getMapContainer();


        if (tokenElement) {

            tokenElement.remove();

            tokenElement =
                null;

        }


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


        // Il proprio token rimane sopra
        // quelli degli altri.

        token.style.zIndex =
            "100";


        token.style.pointerEvents =
            "none";


        const centerX =
            (
                x +
                0.5
            ) *
            cellWidth;


        const centerY =
            (
                y +
                0.5
            ) *
            cellHeight;


        const offsetX =
            mapRect.left -
            containerRect.left;


        const offsetY =
            mapRect.top -
            containerRect.top;


        token.style.left =
            `${
                offsetX +
                centerX -
                tokenSize / 2
            }px`;


        token.style.top =
            `${
                offsetY +
                centerY -
                tokenSize / 2
            }px`;


        container.appendChild(
            token
        );


        tokenElement =
            token;


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
// CHAT DEL PIANO
// ============================================================

function setupFloorChat() {

    const form =
        document.getElementById(
            "floor-chat-form"
        );


    const input =
        document.getElementById(
            "floor-chat-input"
        );


    if (
        !form ||
        !input
    ) {

        return;

    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            await sendFloorChatMessage();

        }
    );


    // Invio con ENTER.
    // SHIFT + ENTER continua ad andare a capo.

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                form.requestSubmit();

            }

        }
    );

}


// ============================================================
// STATO CONNESSIONE CHAT
// ============================================================

function setFloorChatConnected(
    connected
) {

    const sendButton =
        document.getElementById(
            "floor-chat-send"
        );


    const input =
        document.getElementById(
            "floor-chat-input"
        );


    const status =
        document.getElementById(
            "floor-chat-status"
        );


    if (sendButton) {

        sendButton.disabled =
            !connected;

    }


    if (input) {

        input.disabled =
            !connected;

    }


    if (status) {

        status.textContent =
            connected
                ? "Online"
                : "Disconnessa";


        status.classList.toggle(
            "is-online",
            connected
        );

    }


    if (connected) {

        updateFloorChatOnlineStatus();

    }

}


// ============================================================
// NUMERO GIOCATORI ONLINE
// ============================================================

function updateFloorChatOnlineStatus() {

    if (
        !dungeonChannel ||
        !realtimeReady
    ) {

        return;

    }


    const status =
        document.getElementById(
            "floor-chat-status"
        );


    if (!status) {

        return;

    }


    const presenceState =
        dungeonChannel
            .presenceState();


    let onlineCount = 0;


    Object.values(
        presenceState
    ).forEach(
        presences => {

            onlineCount +=
                presences.length;

        }
    );


    if (onlineCount <= 0) {

        status.textContent =
            "Online";

        return;

    }


    status.textContent =
        onlineCount === 1
            ? "1 giocatore online"
            : `${onlineCount} giocatori online`;

}


// ============================================================
// INVIA MESSAGGIO CHAT
// ============================================================

async function sendFloorChatMessage() {

    const input =
        document.getElementById(
            "floor-chat-input"
        );


    const feedback =
        document.getElementById(
            "floor-chat-feedback"
        );


    if (
        !input ||
        !character
    ) {

        return;

    }


    const text =
        input.value
            .trim();


    if (!text) {

        return;

    }


    if (
        !dungeonChannel ||
        !realtimeReady
    ) {

        if (feedback) {

            feedback.textContent =
                "Chat non connessa.";

        }


        return;

    }


    const payload = {

        message_id:
            `${character.id}-${Date.now()}`,

        character_id:
            character.id,

        user_id:
            currentUser?.id ||
            null,

        nome:
            character.nome ||
            "Avventuriero",

        text:
            text,

        sent_at:
            new Date()
                .toISOString()

    };


    // Mostra subito il messaggio nel browser locale.

    appendFloorChatMessage(
        payload,
        true
    );


    input.value =
        "";


    if (feedback) {

        feedback.textContent =
            "";

    }


    const result =
        await dungeonChannel.send({

            type:
                "broadcast",

            event:
                "floor-chat",

            payload:
                payload

        });


    if (
        result !== "ok" &&
        result !== undefined
    ) {

        console.warn(
            "Invio chat:",
            result
        );

    }

}


// ============================================================
// MOSTRA MESSAGGIO CHAT
// ============================================================

function appendFloorChatMessage(
    data,
    isMine = false
) {

    const container =
        document.getElementById(
            "floor-chat-messages"
        );


    if (
        !container ||
        !data
    ) {

        return;

    }


    const empty =
        container.querySelector(
            ".floor-chat-empty"
        );


    if (empty) {

        empty.remove();

    }


    const message =
        document.createElement(
            "div"
        );


    message.className =
        "floor-chat-message" +
        (
            isMine
                ? " is-mine"
                : ""
        );


    const meta =
        document.createElement(
            "div"
        );


    meta.className =
        "floor-chat-message-meta";


    const author =
        document.createElement(
            "strong"
        );


    author.textContent =
        data.nome ||
        "Giocatore";


    const time =
        document.createElement(
            "span"
        );


    time.textContent =
        formatFloorChatTime(
            data.sent_at
        );


    meta.appendChild(
        author
    );


    meta.appendChild(
        time
    );


    const body =
        document.createElement(
            "div"
        );


    body.className =
        "floor-chat-message-body";


    // textContent evita che un messaggio possa inserire HTML.

    body.textContent =
        String(
            data.text ||
            ""
        );


    message.appendChild(
        meta
    );


    message.appendChild(
        body
    );


    container.appendChild(
        message
    );


    // Limitiamo la chat locale agli ultimi 100 messaggi.

    const messages =
        container.querySelectorAll(
            ".floor-chat-message"
        );


    if (
        messages.length > 100
    ) {

        messages[0].remove();

    }


    container.scrollTop =
        container.scrollHeight;

}


// ============================================================
// ORARIO CHAT
// ============================================================

function formatFloorChatTime(
    value
) {

    const date =
        value
            ? new Date(value)
            : new Date();


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "";

    }


    return date.toLocaleTimeString(
        "it-IT",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

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


    if (
        !textarea ||
        !saveButton
    ) {

        return;

    }


    // --------------------------------------------------------
    // CARICAMENTO
    // --------------------------------------------------------

    textarea.value =
        character.notes ||
        "";


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


    if (
        !textarea ||
        !character
    ) {

        return;

    }


    const notes =
        textarea.value;


    if (message) {

        message.textContent =
            "Salvataggio...";

    }


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
                    new Date()
                        .toISOString()

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

            // ------------------------------------------------
            // ABBANDONA PRESENCE
            // ------------------------------------------------

            if (dungeonChannel) {

                try {

                    await dungeonChannel
                        .untrack();

                } catch (error) {

                    console.error(
                        "Errore untrack:",
                        error
                    );

                }

            }


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

        // ----------------------------------------------------
        // NOSTRO TOKEN
        // ----------------------------------------------------

        if (
            playerX !== null &&
            playerY !== null
        ) {

            showToken(
                playerX,
                playerY
            );

        }


        // ----------------------------------------------------
        // TOKEN DEGLI ALTRI
        // ----------------------------------------------------

        for (
            const characterId
            of otherPlayers.keys()
        ) {

            showRemoteToken(
                characterId
            );

        }

    }
);


// ============================================================
// USCITA DALLA PAGINA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (dungeonChannel) {

            dungeonChannel.untrack();

        }

    }
);
