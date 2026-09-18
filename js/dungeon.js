// ============================================================
// PALAZZO ETERNO - DUNGEON.JS
// Multiplayer, chat del piano, note e nebbia di guerra personale
// ============================================================

console.log("DUNGEON.JS MULTIPLAYER + FOG CARICATO");

const db = supabaseClient;


// ============================================================
// CONFIGURAZIONE MAPPA
// ============================================================

const MAP_COLUMNS = 23;
const MAP_ROWS = 23;

const GRID_OFFSET_X = 4;
const GRID_OFFSET_Y = 4;

const INITIAL_PLAYER_X = 9;
const INITIAL_PLAYER_Y = 0;

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";


// ============================================================
// STATO GENERALE
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

const otherPlayerTokens =
    new Map();

const otherPlayers =
    new Map();


// ============================================================
// NEBBIA DI GUERRA
// ============================================================

let fogCanvas = null;

let exploredCells =
    new Set();

let visibleCells =
    new Set();

let fogSavePromise =
    Promise.resolve();


// ============================================================
// EVENTI DUNGEON
// ============================================================
//
// Le coordinate sono quelle VISIBILI della mappa 23x23.
//
// Tipi previsti:
// - communication
// - trap
// - combat
//
// Per ora implementiamo le comunicazioni.
// ============================================================

const DUNGEON_EVENTS = {

    // ========================================================
    // COMUNICAZIONI
    // ========================================================

    "11,17": {

        id:
            "stairs_down",

        type:
            "communication",

        title:
            "",

        message:
            "Queste scale scendono ad un piano inferiore.",

        actions: [

            {
                id:
                    "descend",

                label:
                    "SCENDI LE SCALE",

                primary:
                    true
            },

            {
                id:
                    "stay",

                label:
                    "RIMANI QUI",

                primary:
                    false
            }

        ]

    },


    "15,22": {

        id:
            "dead_end",

        type:
            "communication",

        title:
            "",

        message:
            "Possibile che quelle scale ti abbiano portato ad un vicolo cieco? Sì",

        actions: [

            {
                id:
                    "close",

                label:
                    "CHIUDI",

                primary:
                    true
            }

        ]

    },


    // ========================================================
    // TRAPPOLE
    // ========================================================

    "11,11": {

        id:
            "blade_corridor",

        type:
            "trap",

        message:
            "Una lama affilata attraversa il corridoio da muro a muro.",

        defenseStat:
            "destrezza"

    },


    "9,15": {

        id:
            "acid_vapor",

        type:
            "trap",

        message:
            "Dal pavimento una nube di vapore acido ti investe.",

        defenseStat:
            "resistenza"

    }

};

// ============================================================
// COOLDOWN TRAPPOLE
// ============================================================
//
// Durante i test resta DISATTIVATO.
//
// Quando avremo finito i test basterà cambiare:
// false → true
//
// Il tempo previsto è già 1 ora.
// ============================================================

const TRAP_COOLDOWN_ENABLED =
    false;

const TRAP_COOLDOWN_MS =
    60 *
    60 *
    1000;


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

            await loadCharacter();

            setupNotes();

            setupFloorChat();

            await loadDungeon();

            await initializePlayer();

            setupFogOfWar();

            setupMovement();

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
// DUNGEON.JSON
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

    if (!dungeonData.cells) {

        throw new Error(
            "Il file dungeon.json non contiene la matrice cells."
        );

    }

    console.log(
        "Dungeon JSON caricato:",
        dungeonData
    );

}


// ============================================================
// CARICAMENTO PERSONAGGIO
// ============================================================

async function loadCharacter() {

    console.log(
        "Caricamento personaggio..."
    );

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

    const level =
        Number(
            character.livello
        ) || 1;

    setText(
        "character-name",
        name
    );

    setText(
        "character-name-panel",
        name
    );

    setText(
        "character-level",
        level
    );


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
    // STATISTICHE
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

    const maxHealth =
    Math.ceil(
        5 *
        (
            costituzione / 2
        )
    );


const health =
    character.current_hp !== null &&
    character.current_hp !== undefined
        ? Number(
            character.current_hp
        )
        : maxHealth;

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
// POSIZIONE INIZIALE
// ============================================================

async function initializePlayer() {

    console.log(
        "Controllo posizione del personaggio..."
    );

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
        
checkDungeonEventAtCurrentPosition();
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
    checkDungeonEventAtCurrentPosition();

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
    // PRESENCE
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

            broadcastMyState();

        }
    );


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

        }
    );


    // ========================================================
    // MOVIMENTO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "player-move"
        },
        message => {

            const data =
                message.payload;

            if (
                !data ||
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
    // STATO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "player-state"
        },
        message => {

            const data =
                message.payload;

            if (
                !data ||
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
    // CHAT
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "floor-chat"
        },
        message => {

            const data =
                message.payload;

            if (
                !data ||
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

            broadcastMyState();

        }
    );

}


// ============================================================
// GIOCATORI ONLINE
// ============================================================

function syncOnlinePlayers() {

    if (!dungeonChannel) {

        return;

    }

    const presenceState =
        dungeonChannel
            .presenceState();

    const onlineCharacterIds =
        new Set();

    Object.values(
        presenceState
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence.character_id ||
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

        }

    }

    updateFloorChatOnlineStatus();

    updateRemoteTokensVisibility();

}


// ============================================================
// GIOCATORE REMOTO
// ============================================================

function updateRemotePlayer(
    data
) {

    if (
        !data ||
        !data.character_id ||
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

            x,
            y

        }
    );

    showRemoteToken(
        data.character_id
    );

}


// ============================================================
// TOKEN REMOTO
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


        token.src =
            "immagini/token/" +
            player.token;

        token.alt =
            "Token di " +
            player.nome;

        token.title =
            player.nome;


        const tokenSize =
            Math.min(
                cellWidth,
                cellHeight
            ) * 0.92;

        token.style.width =
            `${tokenSize}px`;

        token.style.height =
            `${tokenSize}px`;


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


        // ----------------------------------------------------
        // NEBBIA
        // ----------------------------------------------------

        token.style.display =
            isCellCurrentlyVisible(
                player.x,
                player.y
            )
                ? "block"
                : "none";


    } catch (error) {

        console.error(
            "Errore token remoto:",
            error
        );

    }

}


// ============================================================
// BROADCAST STATO
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
// BROADCAST MOVIMENTO
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
// VALORE CELLA DUNGEON
// ============================================================

function getDungeonCellValue(
    x,
    y
) {

    if (
        !dungeonData ||
        x < 0 ||
        y < 0 ||
        x >= MAP_COLUMNS ||
        y >= MAP_ROWS
    ) {

        return null;

    }

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

        return null;

    }

    const value =
        Number(
            dungeonData
                .cells[jsonY][jsonX]
        );

    return Number.isFinite(
        value
    )
        ? value
        : null;

}


// ============================================================
// CONTROLLO CELLA PERCORRIBILE
// ============================================================

function isWalkable(
    x,
    y
) {

    const value =
        getDungeonCellValue(
            x,
            y
        );

    if (
        value === null
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

    const targetX =
        Math.floor(
            (
                event.clientX -
                rect.left
            ) /
            cellWidth
        );

    const targetY =
        Math.floor(
            (
                event.clientY -
                rect.top
            ) /
            cellHeight
        );

    const dx =
        targetX -
        playerX;

    const dy =
        targetY -
        playerY;

    if (
        Math.abs(dx) +
        Math.abs(dy) !==
        1
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
        movementLocked ||
        dungeonEventModalOpen ||
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


    playerX =
        targetX;

    playerY =
        targetY;


    showToken(
        playerX,
        playerY
    );


    // Aggiorna immediatamente la visuale.

    updateFogOfWar();


    broadcastMovement();


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

        updateFogOfWar();

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
        `Posizione: X ${playerX} • Y ${playerY}`
    );

    checkDungeonEventAtCurrentPosition();


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
// TOKEN PERSONALE
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
// NEBBIA DI GUERRA - INIZIALIZZAZIONE
// ============================================================

function setupFogOfWar() {

    loadExploredCellsFromCharacter();


    const {
        image,
        container
    } =
        getMapContainer();


    if (!fogCanvas) {

        fogCanvas =
            document.createElement(
                "canvas"
            );

        fogCanvas.className =
            "dungeon-fog-canvas";

        fogCanvas.setAttribute(
            "aria-hidden",
            "true"
        );

        container.appendChild(
            fogCanvas
        );

    }


    if (
        !image.complete
    ) {

        image.addEventListener(
            "load",
            updateFogOfWar,
            {
                once: true
            }
        );

    }


    updateFogOfWar();

}


// ============================================================
// CARICA CELLE GIÀ ESPLORATE
// ============================================================

function loadExploredCellsFromCharacter() {

    exploredCells.clear();


    const stored =
        character?.fog_explored;


    if (
        !Array.isArray(
            stored
        )
    ) {

        return;

    }


    stored.forEach(
        cell => {

            if (
                !Array.isArray(cell) ||
                cell.length < 2
            ) {

                return;

            }


            const x =
                Number(
                    cell[0]
                );

            const y =
                Number(
                    cell[1]
                );


            if (
                Number.isInteger(x) &&
                Number.isInteger(y) &&
                x >= 0 &&
                y >= 0 &&
                x < MAP_COLUMNS &&
                y < MAP_ROWS
            ) {

                exploredCells.add(
                    fogCellKey(
                        x,
                        y
                    )
                );

            }

        }
    );

}


// ============================================================
// AGGIORNA NEBBIA
// ============================================================

function updateFogOfWar() {

    if (
        !dungeonData ||
        playerX === null ||
        playerY === null
    ) {

        return;

    }


    visibleCells =
        calculateVisibleCells();


    let discoveredSomething =
        false;


    for (
        const key
        of visibleCells
    ) {

        if (
            !exploredCells.has(
                key
            )
        ) {

            exploredCells.add(
                key
            );

            discoveredSomething =
                true;

        }

    }


    renderFogOfWar();

    updateRemoteTokensVisibility();


    if (
        discoveredSomething
    ) {

        queueFogExplorationSave();

    }

}


// ============================================================
// CALCOLA VISIBILITÀ
// ============================================================

function calculateVisibleCells() {

    const visible =
        new Set();


    const radius =
        getVisionRadius();


    for (
        let y = 0;
        y < MAP_ROWS;
        y++
    ) {

        for (
            let x = 0;
            x < MAP_COLUMNS;
            x++
        ) {

            const dx =
                x -
                playerX;

            const dy =
                y -
                playerY;


            // Raggio circolare.
            // Il valore massimo è il Movimento.

            if (
                Math.hypot(
                    dx,
                    dy
                ) >
                radius
            ) {

                continue;

            }


            if (
                hasLineOfSight(
                    playerX,
                    playerY,
                    x,
                    y
                )
            ) {

                visible.add(
                    fogCellKey(
                        x,
                        y
                    )
                );

            }

        }

    }


    // La propria casella è sempre visibile.

    visible.add(
        fogCellKey(
            playerX,
            playerY
        )
    );


    return visible;

}


// ============================================================
// RAGGIO DI VISIONE = MOVIMENTO
// ============================================================

function getVisionRadius() {

    const destrezza =
        Number(
            character?.destrezza
        ) || 1;


    return 4 +
        Math.ceil(
            destrezza / 2
        );

}


// ============================================================
// LINEA DI VISTA
// ============================================================

function hasLineOfSight(
    startX,
    startY,
    targetX,
    targetY
) {

    if (
        startX === targetX &&
        startY === targetY
    ) {

        return true;

    }


    const line =
        getGridLine(
            startX,
            startY,
            targetX,
            targetY
        );


    /*
       Controlliamo tutte le celle attraversate
       tranne:

       - la cella iniziale del giocatore
       - la cella bersaglio

       In questo modo il muro/porta bersaglio
       può essere visto, ma non si vede attraverso.
    */

    for (
        let i = 1;
        i < line.length - 1;
        i++
    ) {

        const cell =
            line[i];


        if (
            isVisionBlockingCell(
                cell.x,
                cell.y
            )
        ) {

            return false;

        }

    }


    return true;

}


// ============================================================
// LINEA TRA DUE CASELLE - BRESENHAM
// ============================================================

function getGridLine(
    x0,
    y0,
    x1,
    y1
) {

    const cells = [];


    // --------------------------------------------------------
    // AGGIUNGE UNA CELLA EVITANDO DUPLICATI
    // --------------------------------------------------------

    function addCell(
        x,
        y
    ) {

        const last =
            cells[
                cells.length - 1
            ];


        if (
            !last ||
            last.x !== x ||
            last.y !== y
        ) {

            cells.push({
                x,
                y
            });

        }

    }


    let x =
        x0;

    let y =
        y0;


    addCell(
        x,
        y
    );


    const dx =
        x1 -
        x0;


    const dy =
        y1 -
        y0;


    const stepX =
        Math.sign(
            dx
        );


    const stepY =
        Math.sign(
            dy
        );


    const absDx =
        Math.abs(
            dx
        );


    const absDy =
        Math.abs(
            dy
        );


    const tDeltaX =
        absDx === 0
            ? Infinity
            : 1 / absDx;


    const tDeltaY =
        absDy === 0
            ? Infinity
            : 1 / absDy;


    /*
       Partiamo dal centro della casella,
       quindi il primo bordo dista metà cella.
    */

    let tMaxX =
        absDx === 0
            ? Infinity
            : 0.5 / absDx;


    let tMaxY =
        absDy === 0
            ? Infinity
            : 0.5 / absDy;


    const EPSILON =
        0.0000001;


    while (
        x !== x1 ||
        y !== y1
    ) {

        // ----------------------------------------------------
        // ATTRAVERSAMENTO DI UN ANGOLO
        // ----------------------------------------------------
        //
        // Qui sta la correzione fondamentale.
        //
        // Se il raggio attraversa esattamente l'angolo
        // di quattro celle, controlliamo ENTRAMBE
        // le celle laterali.
        //
        // Così la vista non può infilarsi diagonalmente
        // tra due muri.
        // ----------------------------------------------------

        if (
            Math.abs(
                tMaxX -
                tMaxY
            ) <
            EPSILON
        ) {

            const sideX =
                x +
                stepX;


            const sideY =
                y +
                stepY;


            // Cella laterale orizzontale

            addCell(
                sideX,
                y
            );


            // Cella laterale verticale

            addCell(
                x,
                sideY
            );


            // Cella diagonale

            x =
                sideX;


            y =
                sideY;


            addCell(
                x,
                y
            );


            tMaxX +=
                tDeltaX;


            tMaxY +=
                tDeltaY;


            continue;

        }


        // ----------------------------------------------------
        // ATTRAVERSA BORDO VERTICALE
        // ----------------------------------------------------

        if (
            tMaxX <
            tMaxY
        ) {

            x +=
                stepX;


            tMaxX +=
                tDeltaX;


            addCell(
                x,
                y
            );


            continue;

        }


        // ----------------------------------------------------
        // ATTRAVERSA BORDO ORIZZONTALE
        // ----------------------------------------------------

        y +=
            stepY;


        tMaxY +=
            tDeltaY;


        addCell(
            x,
            y
        );

    }


    return cells;

}

// ============================================================
// CELLE CHE BLOCCANO LA VISTA
// ============================================================

function isVisionBlockingCell(
    x,
    y
) {

    const value =
        getDungeonCellValue(
            x,
            y
        );


    // Fuori dalla mappa / cella inesistente
    // blocca sempre la visuale.

    if (
        value === null
    ) {

        return true;

    }


    const bits =
        dungeonData.cell_bit ||
        {};


    // --------------------------------------------------------
    // SPAZIO VUOTO / NERO
    // --------------------------------------------------------
    //
    // Nel dungeon.json molte zone nere non sono "perimeter":
    // hanno semplicemente valore 0.
    //
    // Devono quindi bloccare la visuale.
    // --------------------------------------------------------

    if (
        value === 0
    ) {

        return true;

    }


    // --------------------------------------------------------
    // BIT CHE BLOCCANO LA VISUALE
    // --------------------------------------------------------

    const BLOCK =
        bits.block ||
        1;


    const PERIMETER =
        bits.perimeter ||
        16;


    const DOOR =
        bits.door ||
        131072;


    const LOCKED =
        bits.locked ||
        262144;


    const SECRET =
        bits.secret ||
        1048576;


    const PORTCULLIS =
        bits.portcullis ||
        2097152;


    return (

        (value & BLOCK) !== 0 ||

        (value & PERIMETER) !== 0 ||

        (value & DOOR) !== 0 ||

        (value & LOCKED) !== 0 ||

        (value & SECRET) !== 0 ||

        (value & PORTCULLIS) !== 0

    );

}


// ============================================================
// DISEGNA NEBBIA
// ============================================================

function renderFogOfWar() {

    if (
        !fogCanvas
    ) {

        return;

    }


    let image;
    let container;


    try {

        ({
            image,
            container
        } =
            getMapContainer());

    } catch {

        return;

    }


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        container.getBoundingClientRect();


    if (
        mapRect.width <= 0 ||
        mapRect.height <= 0
    ) {

        return;

    }


    const pixelRatio =
        window.devicePixelRatio ||
        1;


    fogCanvas.style.left =
        `${
            mapRect.left -
            containerRect.left
        }px`;


    fogCanvas.style.top =
        `${
            mapRect.top -
            containerRect.top
        }px`;


    fogCanvas.style.width =
        `${mapRect.width}px`;


    fogCanvas.style.height =
        `${mapRect.height}px`;


    fogCanvas.width =
        Math.max(
            1,
            Math.round(
                mapRect.width *
                pixelRatio
            )
        );


    fogCanvas.height =
        Math.max(
            1,
            Math.round(
                mapRect.height *
                pixelRatio
            )
        );


    const context =
        fogCanvas.getContext(
            "2d"
        );


    if (!context) {

        return;

    }


    context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );


    context.clearRect(
        0,
        0,
        mapRect.width,
        mapRect.height
    );


    const cellWidth =
        mapRect.width /
        MAP_COLUMNS;


    const cellHeight =
        mapRect.height /
        MAP_ROWS;


    for (
        let y = 0;
        y < MAP_ROWS;
        y++
    ) {

        for (
            let x = 0;
            x < MAP_COLUMNS;
            x++
        ) {

            const key =
                fogCellKey(
                    x,
                    y
                );


            // --------------------------------------------
            // VISIBILE ORA
            // --------------------------------------------

            if (
                visibleCells.has(
                    key
                )
            ) {

                continue;

            }


            // --------------------------------------------
            // GIÀ ESPLORATA
            // --------------------------------------------

            if (
                exploredCells.has(
                    key
                )
            ) {

                context.fillStyle =
                    "rgba(0, 0, 0, 0.62)";

            }

            // --------------------------------------------
            // MAI ESPLORATA
            // --------------------------------------------

            else {

                context.fillStyle =
                    "rgba(0, 0, 0, 1)";

            }


            context.fillRect(

                x *
                cellWidth -
                0.5,

                y *
                cellHeight -
                0.5,

                cellWidth +
                1,

                cellHeight +
                1

            );

        }

    }

}


// ============================================================
// CONTROLLO VISIBILITÀ CELLA
// ============================================================

function isCellCurrentlyVisible(
    x,
    y
) {

    return visibleCells.has(
        fogCellKey(
            Number(x),
            Number(y)
        )
    );

}


// ============================================================
// NASCONDI / MOSTRA TOKEN REMOTI
// ============================================================

function updateRemoteTokensVisibility() {

    for (
        const [
            characterId,
            token
        ]
        of otherPlayerTokens
    ) {

        const player =
            otherPlayers.get(
                characterId
            );


        if (!player) {

            token.style.display =
                "none";

            continue;

        }


        token.style.display =
            isCellCurrentlyVisible(
                player.x,
                player.y
            )
                ? "block"
                : "none";

    }

}


// ============================================================
// SALVATAGGIO ESPLORAZIONE
// ============================================================

function queueFogExplorationSave() {

    const snapshot =
        Array.from(
            exploredCells
        )
            .map(
                key =>
                    key
                        .split(",")
                        .map(Number)
            )
            .sort(
                (a, b) =>
                    a[1] -
                    b[1] ||
                    a[0] -
                    b[0]
            );


    character.fog_explored =
        snapshot;


    /*
       I salvataggi vengono messi in coda.
       Così due movimenti veloci non possono
       sovrascrivere accidentalmente l'esplorazione.
    */

    fogSavePromise =
        fogSavePromise
            .then(
                async () => {

                    const {
                        error
                    } =
                        await db
                            .from(
                                "characters"
                            )
                            .update({

                                fog_explored:
                                    snapshot,

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
                            "Errore salvataggio nebbia di guerra:",
                            error
                        );

                    }

                }
            )
            .catch(
                error => {

                    console.error(
                        "Errore coda salvataggio nebbia:",
                        error
                    );

                }
            );

}


// ============================================================
// CHIAVE CELLA
// ============================================================

function fogCellKey(
    x,
    y
) {

    return `${x},${y}`;

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


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                form.requestSubmit();

            }

        }
    );

}


// ============================================================
// STATO CHAT
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


    let onlineCount =
        0;


    Object.values(
        presenceState
    ).forEach(
        presences => {

            onlineCount +=
                presences.length;

        }
    );


    if (
        onlineCount <= 0
    ) {

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
// INVIA CHAT
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
            `${
                character.id
            }-${Date.now()}`,

        character_id:
            character.id,

        user_id:
            currentUser?.id ||
            null,

        nome:
            character.nome ||
            "Avventuriero",

        text,

        sent_at:
            new Date()
                .toISOString()

    };


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


    const messages =
        container.querySelectorAll(
            ".floor-chat-message"
        );


    if (
        messages.length >
        100
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

            hour:
                "2-digit",

            minute:
                "2-digit"

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


    textarea.value =
        character.notes ||
        "";


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
            .from(
                "characters"
            )
            .update({

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


        setTimeout(
            () => {

                if (
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

}

// ============================================================
// EVENTI DUNGEON
// ============================================================

function getDungeonEventKey(
    x,
    y
) {

    return `${x},${y}`;

}


// ============================================================
// CONTROLLA EVENTO NELLA POSIZIONE ATTUALE
// ============================================================

function checkDungeonEventAtCurrentPosition() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return;

    }


    const eventKey =
        getDungeonEventKey(
            playerX,
            playerY
        );


    const dungeonEvent =
        DUNGEON_EVENTS[
            eventKey
        ];


    /*
       Se non siamo più sopra una casella evento,
       azzeriamo l'ultimo evento.

       In questo modo, se il giocatore esce dalla
       casella e successivamente ci rientra,
       l'evento si attiva nuovamente.
    */

    if (!dungeonEvent) {

        lastTriggeredDungeonEventKey =
            null;

        return;

    }


    /*
       Impedisce che lo stesso popup continui
       ad aprirsi mentre il personaggio
       rimane fermo sulla stessa casella.
    */

    if (
        lastTriggeredDungeonEventKey ===
        eventKey
    ) {

        return;

    }


    lastTriggeredDungeonEventKey =
        eventKey;


    triggerDungeonEvent(
        dungeonEvent,
        eventKey
    );

}


// ============================================================
// ATTIVA EVENTO
// ============================================================

function triggerDungeonEvent(
    dungeonEvent,
    eventKey
) {

    if (!dungeonEvent) {

        return;

    }


    switch (
        dungeonEvent.type
    ) {

        // ----------------------------------------------------
        // COMUNICAZIONE
        // ----------------------------------------------------

        case "communication":

            openCommunicationEvent(
                dungeonEvent,
                eventKey
            );

            break;


        // ----------------------------------------------------
        // TRAPPOLA
        // ----------------------------------------------------

        case "trap":

            console.log(
                "Evento trappola non ancora implementato:",
                dungeonEvent
            );

            break;


        // ----------------------------------------------------
        // COMBATTIMENTO
        // ----------------------------------------------------

        case "combat":

            console.log(
                "Evento combattimento non ancora implementato:",
                dungeonEvent
            );

            break;


        // ----------------------------------------------------
        // TIPO SCONOSCIUTO
        // ----------------------------------------------------

        default:

            console.warn(
                "Tipo evento sconosciuto:",
                dungeonEvent.type
            );

    }

}


// ============================================================
// APRI COMUNICAZIONE
// ============================================================

function openCommunicationEvent(
    dungeonEvent,
    eventKey
) {

    const modal =
        document.getElementById(
            "dungeon-event-modal"
        );


    const titleElement =
        document.getElementById(
            "dungeon-event-title"
        );


    const textElement =
        document.getElementById(
            "dungeon-event-text"
        );


    const actionsElement =
        document.getElementById(
            "dungeon-event-actions"
        );


    if (
        !modal ||
        !titleElement ||
        !textElement ||
        !actionsElement
    ) {

        console.error(
            "Elementi popup evento non trovati."
        );

        return;

    }


    activeDungeonEvent =
        dungeonEvent;

    activeDungeonEventKey =
        eventKey;

    dungeonEventModalOpen =
        true;


const popupTitle =
    dungeonEvent.title || "";

titleElement.textContent =
    popupTitle;

titleElement.style.display =
    popupTitle
        ? "block"
        : "none";


    textElement.textContent =
        dungeonEvent.message ||
        "";


    actionsElement.innerHTML =
        "";


    const actions =
        Array.isArray(
            dungeonEvent.actions
        )
            ? dungeonEvent.actions
            : [];


    actions.forEach(
        action => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                action.primary
                    ? "button"
                    : "button secondary";


            button.textContent =
                action.label ||
                "CONTINUA";


            button.addEventListener(
                "click",
                () => {

                    handleDungeonEventAction(
                        action.id
                    );

                }
            );


            actionsElement.appendChild(
                button
            );

        }
    );


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";

}


// ============================================================
// AZIONI EVENTO
// ============================================================

function handleDungeonEventAction(
    actionId
) {

    switch (
        actionId
    ) {

        // ----------------------------------------------------
        // SCENDI LE SCALE
        // ----------------------------------------------------

        case "descend":

            /*
               Per ora non facciamo realmente
               cambiare piano al personaggio.

               Qui in futuro collegheremo
               il sistema dei piani.
            */

            closeDungeonEventModal();


            setMessage(
                "La discesa al piano inferiore non è ancora disponibile."
            );

            break;


        // ----------------------------------------------------
        // RIMANI QUI
        // ----------------------------------------------------

        case "stay":

            closeDungeonEventModal();


            setMessage(
                "Decidi di rimanere su questo piano."
            );

            break;


        // ----------------------------------------------------
        // CHIUDI
        // ----------------------------------------------------

        case "close":

            closeDungeonEventModal();

            break;


        // ----------------------------------------------------
        // AZIONE NON RICONOSCIUTA
        // ----------------------------------------------------

        default:

            closeDungeonEventModal();

    }

}


// ============================================================
// CHIUDI POPUP EVENTO
// ============================================================

function closeDungeonEventModal() {

    const modal =
        document.getElementById(
            "dungeon-event-modal"
        );


    if (modal) {

        modal.hidden =
            true;

    }


    document.body.style.overflow =
        "";


    dungeonEventModalOpen =
        false;

    activeDungeonEvent =
        null;

    activeDungeonEventKey =
        null;

}


// ============================================================
// MESSAGGI
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

        if (
            playerX !== null &&
            playerY !== null
        ) {

            showToken(
                playerX,
                playerY
            );

        }


        renderFogOfWar();


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
