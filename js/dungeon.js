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
// - posizione iniziale
// - movimento WASD / frecce
// - movimento tramite click su casella adiacente
// - controllo muri
// - salvataggio posizione
// - token personale
// - token degli altri giocatori online
// - Supabase Realtime Presence
// - Supabase Realtime Broadcast
// - statistiche del personaggio
// - BONUS EQUIPAGGIAMENTO
// - PF / PM con attributi effettivi
// - caricamento e salvataggio note
// - chat realtime del piano
//
// ============================================================


console.log("DUNGEON.JS MULTIPLAYER + EQUIPAGGIAMENTO CARICATO");


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
// EQUIPAGGIAMENTO / BONUS
// ============================================================

let characterInventory = [];

let equipmentBonuses = {

    attack_bonus: 0,
    defense_bonus: 0,

    forza_bonus: 0,
    resistenza_bonus: 0,
    costituzione_bonus: 0,
    intelligenza_bonus: 0,
    destrezza_bonus: 0,
    fortuna_bonus: 0

};


// ============================================================
// REALTIME
// ============================================================

let dungeonChannel = null;

let realtimeReady = false;


// ============================================================
// TOKEN DEGLI ALTRI GIOCATORI
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


    // --------------------------------------------------------
    // EQUIPAGGIAMENTO
    // --------------------------------------------------------

    await loadCharacterEquipment();


    // --------------------------------------------------------
    // PANNELLO PERSONAGGIO
    // --------------------------------------------------------

    updateCharacterPanel();

}


// ============================================================
// CARICAMENTO EQUIPAGGIAMENTO
// ============================================================

async function loadCharacterEquipment() {

    if (!character) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from("character_inventory")
            .select(`
                id,
                quantity,
                equipped_slot,

                item:items (
                    id,
                    attack_bonus,
                    defense_bonus,
                    forza_bonus,
                    resistenza_bonus,
                    costituzione_bonus,
                    intelligenza_bonus,
                    destrezza_bonus,
                    fortuna_bonus
                )
            `)
            .eq(
                "character_id",
                character.id
            )
            .not(
                "equipped_slot",
                "is",
                null
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];


    calculateDungeonEquipmentBonuses();


    console.log(
        "Equipaggiamento dungeon:",
        characterInventory
    );


    console.log(
        "Bonus equipaggiamento dungeon:",
        equipmentBonuses
    );

}


// ============================================================
// CALCOLO BONUS EQUIPAGGIAMENTO
// ============================================================

function calculateDungeonEquipmentBonuses() {

    equipmentBonuses = {

        attack_bonus: 0,
        defense_bonus: 0,

        forza_bonus: 0,
        resistenza_bonus: 0,
        costituzione_bonus: 0,
        intelligenza_bonus: 0,
        destrezza_bonus: 0,
        fortuna_bonus: 0

    };


    characterInventory.forEach(
        entry => {

            if (!entry.item) {

                return;

            }


            const item =
                entry.item;


            equipmentBonuses.attack_bonus +=
                Number(
                    item.attack_bonus
                ) || 0;


            equipmentBonuses.defense_bonus +=
                Number(
                    item.defense_bonus
                ) || 0;


            equipmentBonuses.forza_bonus +=
                Number(
                    item.forza_bonus
                ) || 0;


            equipmentBonuses.resistenza_bonus +=
                Number(
                    item.resistenza_bonus
                ) || 0;


            equipmentBonuses.costituzione_bonus +=
                Number(
                    item.costituzione_bonus
                ) || 0;


            equipmentBonuses.intelligenza_bonus +=
                Number(
                    item.intelligenza_bonus
                ) || 0;


            equipmentBonuses.destrezza_bonus +=
                Number(
                    item.destrezza_bonus
                ) || 0;


            equipmentBonuses.fortuna_bonus +=
                Number(
                    item.fortuna_bonus
                ) || 0;

        }
    );

}


// ============================================================
// ATTRIBUTO EFFETTIVO
//
// Attributo base + bonus equipaggiamento.
// Gli attributi finali sono sempre compresi tra 1 e 30.
// ============================================================

function getDungeonEffectiveAttribute(
    attribute
) {

    const base =
        Number(
            character?.[attribute]
        ) || 1;


    const bonus =
        Number(
            equipmentBonuses[
                `${attribute}_bonus`
            ]
        ) || 0;


    return Math.max(
        1,
        Math.min(
            30,
            base + bonus
        )
    );

}


// ============================================================
// AGGIORNA PANNELLO PERSONAGGIO
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
    // ATTRIBUTI EFFETTIVI
    // --------------------------------------------------------

    const forza =
        getDungeonEffectiveAttribute(
            "forza"
        );


    const resistenza =
        getDungeonEffectiveAttribute(
            "resistenza"
        );


    const costituzione =
        getDungeonEffectiveAttribute(
            "costituzione"
        );


    const intelligenza =
        getDungeonEffectiveAttribute(
            "intelligenza"
        );


    const destrezza =
        getDungeonEffectiveAttribute(
            "destrezza"
        );


    const fortuna =
        getDungeonEffectiveAttribute(
            "fortuna"
        );


    // --------------------------------------------------------
    // MOSTRA ATTRIBUTI EFFETTIVI
    // --------------------------------------------------------

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
        )
        +
        (
            Number(
                equipmentBonuses.attack_bonus
            ) || 0
        );


    const defense =
        Math.ceil(
            7 +
            (
                resistenza / 2
            )
        )
        +
        (
            Number(
                equipmentBonuses.defense_bonus
            ) || 0
        );


    const health =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    const mana =
        Math.ceil(
            5 *
            (
                intelligenza / 2
            )
        );


    const movement =
        Math.ceil(
            4 +
            (
                destrezza / 2
            )
        );


    const critical =
        (
            fortuna *
            (
                50 / 30
            )
        ).toFixed(
            2
        );


    // --------------------------------------------------------
    // PF ATTUALI
    //
    // L'equipaggiamento modifica il MASSIMO.
    // Non cura automaticamente il personaggio.
    //
    // Esempio:
    //
    // prima 3/3
    // +2 COS
    // dopo  3/8
    //
    // --------------------------------------------------------

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined

            ? health

            : Math.max(
                0,
                Math.min(
                    Number(
                        character.current_hp
                    ),
                    health
                )
            );


    // --------------------------------------------------------
    // PM ATTUALI
    //
    // Stessa logica dei PF.
    //
    // --------------------------------------------------------

    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined

            ? mana

            : Math.max(
                0,
                Math.min(
                    Number(
                        character.current_pm
                    ),
                    mana
                )
            );


    // --------------------------------------------------------
    // MOSTRA STATISTICHE
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
        `${currentPF}/${health}`
    );


    setText(
        "mana-display",
        `${currentPM}/${mana}`
    );


    setText(
        "movement-display",
        movement
    );


    setText(
        "critical-display",
        `${critical}%`
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


            addFloorChatMessage(
                data
            );

        }
    );


    // ========================================================
    // SOTTOSCRIZIONE
    // ========================================================

    await new Promise(
        (
            resolve,
            reject
        ) => {

            dungeonChannel.subscribe(
                async status => {

                    console.log(
                        "Stato canale:",
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        realtimeReady =
                            true;


                        try {

                            await dungeonChannel.track({

                                character_id:
                                    character.id,

                                user_id:
                                    currentUser.id,

                                name:
                                    character.nome,

                                token:
                                    character.token,

                                x:
                                    playerX,

                                y:
                                    playerY,

                                online_at:
                                    new Date()
                                        .toISOString()

                            });


                            console.log(
                                "Presence registrata."
                            );


                            resolve();


                        } catch (error) {

                            reject(
                                error
                            );

                        }

                    }


                    if (
                        status ===
                        "CHANNEL_ERROR"
                    ) {

                        reject(
                            new Error(
                                "Errore nel canale realtime."
                            )
                        );

                    }

                }
            );

        }
    );


    syncOnlinePlayers();

}


// ============================================================
// SINCRONIZZA GIOCATORI ONLINE
// ============================================================

function syncOnlinePlayers() {

    if (!dungeonChannel) {

        return;

    }


    const state =
        dungeonChannel.presenceState();


    const onlineIds =
        new Set();


    Object.values(
        state
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    const id =
                        presence.character_id;


                    if (!id) {

                        return;

                    }


                    if (
                        id ===
                        character.id
                    ) {

                        return;

                    }


                    onlineIds.add(
                        id
                    );


                    updateRemotePlayer(
                        presence
                    );

                }
            );

        }
    );


    // --------------------------------------------------------
    // RIMUOVE GIOCATORI NON PIÙ ONLINE
    // --------------------------------------------------------

    for (
        const [
            id,
            token
        ]
        of otherPlayerTokens
    ) {

        if (
            !onlineIds.has(
                id
            )
        ) {

            token.remove();


            otherPlayerTokens.delete(
                id
            );


            otherPlayers.delete(
                id
            );

        }

    }

}


// ============================================================
// AGGIORNA GIOCATORE REMOTO
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


    otherPlayers.set(
        data.character_id,
        {

            character_id:
                data.character_id,

            name:
                data.name ||
                "Avventuriero",

            token:
                data.token ||
                "token_1.png",

            x:
                x,

            y:
                y

        }
    );


    showOtherPlayerToken(
        data.character_id
    );

}


// ============================================================
// MOSTRA TOKEN ALTRO GIOCATORE
// ============================================================

function showOtherPlayerToken(
    characterId
) {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    const player =
        otherPlayers.get(
            characterId
        );


    if (!player) {

        return;

    }


    let token =
        otherPlayerTokens.get(
            characterId
        );


    if (!token) {

        token =
            document.createElement(
                "div"
            );


        token.className =
            "dungeon-player-token other-player-token";


        token.dataset.characterId =
            characterId;


        const image =
            document.createElement(
                "img"
            );


        image.alt =
            player.name;


        token.appendChild(
            image
        );


        const label =
            document.createElement(
                "div"
            );


        label.className =
            "other-player-name";


        token.appendChild(
            label
        );


        map.appendChild(
            token
        );


        otherPlayerTokens.set(
            characterId,
            token
        );

    }


    const image =
        token.querySelector(
            "img"
        );


    const label =
        token.querySelector(
            ".other-player-name"
        );


    if (image) {

        image.src =
            "immagini/token/" +
            (
                player.token ||
                "token_1.png"
            );


        image.alt =
            player.name;

    }


    if (label) {

        label.textContent =
            player.name;

    }


    positionTokenElement(
        token,
        player.x,
        player.y
    );

}


// ============================================================
// INVIA IL PROPRIO STATO
// ============================================================

async function broadcastMyState() {

    if (
        !dungeonChannel ||
        !realtimeReady ||
        !character
    ) {

        return;

    }


    try {

        await dungeonChannel.send({

            type:
                "broadcast",

            event:
                "player-move",

            payload: {

                character_id:
                    character.id,

                name:
                    character.nome,

                token:
                    character.token,

                x:
                    playerX,

                y:
                    playerY

            }

        });


    } catch (error) {

        console.error(
            "Errore broadcast posizione:",
            error
        );

    }

}


// ============================================================
// AGGIORNA PRESENCE PERSONALE
// ============================================================

async function updateMyPresence() {

    if (
        !dungeonChannel ||
        !realtimeReady ||
        !character
    ) {

        return;

    }


    try {

        await dungeonChannel.track({

            character_id:
                character.id,

            user_id:
                currentUser.id,

            name:
                character.nome,

            token:
                character.token,

            x:
                playerX,

            y:
                playerY,

            online_at:
                new Date()
                    .toISOString()

        });


    } catch (error) {

        console.error(
            "Errore aggiornamento presence:",
            error
        );

    }

}


// ============================================================
// MOSTRA TOKEN PERSONALE
// ============================================================

function showToken(
    x,
    y
) {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    if (!tokenElement) {

        tokenElement =
            document.createElement(
                "div"
            );


        tokenElement.className =
            "dungeon-player-token";


        const image =
            document.createElement(
                "img"
            );


        image.src =
            "immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );


        image.alt =
            character.nome ||
            "Personaggio";


        tokenElement.appendChild(
            image
        );


        map.appendChild(
            tokenElement
        );

    }


    positionTokenElement(
        tokenElement,
        x,
        y
    );

}


// ============================================================
// POSIZIONA TOKEN
// ============================================================

function positionTokenElement(
    element,
    x,
    y
) {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (
        !map ||
        !element
    ) {

        return;

    }


    const rect =
        map.getBoundingClientRect();


    const cellWidth =
        rect.width /
        MAP_COLUMNS;


    const cellHeight =
        rect.height /
        MAP_ROWS;


    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) *
        0.72;


    element.style.width =
        `${tokenSize}px`;


    element.style.height =
        `${tokenSize}px`;


    element.style.left =
        `${
            (
                Number(x) +
                0.5
            )
            *
            cellWidth
            -
            tokenSize / 2
        }px`;


    element.style.top =
        `${
            (
                Number(y) +
                0.5
            )
            *
            cellHeight
            -
            tokenSize / 2
        }px`;

}


// ============================================================
// RIPOSIZIONA TUTTI I TOKEN
// ============================================================

function repositionAllTokens() {

    if (
        tokenElement &&
        playerX !== null &&
        playerY !== null
    ) {

        positionTokenElement(
            tokenElement,
            playerX,
            playerY
        );

    }


    otherPlayers.forEach(
        player => {

            const token =
                otherPlayerTokens.get(
                    player.character_id
                );


            if (!token) {

                return;

            }


            positionTokenElement(
                token,
                player.x,
                player.y
            );

        }
    );

}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        repositionAllTokens();

    }
);


// ============================================================
// MOVIMENTO
// ============================================================

function setupMovement() {

    // --------------------------------------------------------
    // TASTIERA
    // --------------------------------------------------------

    document.addEventListener(
        "keydown",
        async event => {

            const target =
                event.target;


            // Non intercettare i tasti mentre
            // si scrive nelle note/chat/input.

            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable
            ) {

                return;

            }


            if (event.repeat) {

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


            await movePlayer(
                dx,
                dy
            );

        }
    );


    // --------------------------------------------------------
    // CLICK SULLA MAPPA
    // --------------------------------------------------------

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    map.addEventListener(
        "click",
        async event => {

            if (
                movementLocked ||
                playerX === null ||
                playerY === null
            ) {

                return;

            }


            const rect =
                map.getBoundingClientRect();


            const cellWidth =
                rect.width /
                MAP_COLUMNS;


            const cellHeight =
                rect.height /
                MAP_ROWS;


            const clickedX =
                Math.floor(
                    (
                        event.clientX -
                        rect.left
                    )
                    /
                    cellWidth
                );


            const clickedY =
                Math.floor(
                    (
                        event.clientY -
                        rect.top
                    )
                    /
                    cellHeight
                );


            const dx =
                clickedX -
                playerX;


            const dy =
                clickedY -
                playerY;


            // Solo movimento ortogonale
            // di una singola casella.

            const isAdjacent =
                (
                    Math.abs(dx) +
                    Math.abs(dy)
                ) === 1;


            if (!isAdjacent) {

                return;

            }


            await movePlayer(
                dx,
                dy
            );

        }
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
        !character ||
        !dungeonData
    ) {

        return;

    }


    const newX =
        playerX +
        dx;


    const newY =
        playerY +
        dy;


    // --------------------------------------------------------
    // LIMITI MAPPA
    // --------------------------------------------------------

    if (
        newX < 0 ||
        newY < 0 ||
        newX >= MAP_COLUMNS ||
        newY >= MAP_ROWS
    ) {

        setMessage(
            "Non puoi andare oltre i confini del piano."
        );


        return;

    }


    // --------------------------------------------------------
    // CONTROLLO MURO
    // --------------------------------------------------------

    if (
        !canMoveTo(
            newX,
            newY
        )
    ) {

        setMessage(
            "Il passaggio è bloccato."
        );


        return;

    }


    movementLocked =
        true;


    try {

        const oldX =
            playerX;


        const oldY =
            playerY;


        playerX =
            newX;


        playerY =
            newY;


        // ----------------------------------------------------
        // AGGIORNA SUBITO TOKEN
        // ----------------------------------------------------

        showToken(
            playerX,
            playerY
        );


        // ----------------------------------------------------
        // SALVA POSIZIONE
        // ----------------------------------------------------

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

            // Ripristina posizione precedente
            // in caso di errore database.

            playerX =
                oldX;


            playerY =
                oldY;


            showToken(
                playerX,
                playerY
            );


            throw error;

        }


        character.dungeon_x =
            playerX;


        character.dungeon_y =
            playerY;


        // ----------------------------------------------------
        // PRESENCE
        // ----------------------------------------------------

        await updateMyPresence();


        // ----------------------------------------------------
        // BROADCAST
        // ----------------------------------------------------

        await broadcastMyState();


        // ----------------------------------------------------
        // EVENTUALE EVENTO DELLA CASELLA
        // ----------------------------------------------------

        await checkDungeonCellEvent();


        setMessage(
            "Ti muovi nel dungeon."
        );


    } catch (error) {

        console.error(
            "Errore movimento:",
            error
        );


        setMessage(
            "Errore durante il movimento."
        );


    } finally {

        movementLocked =
            false;

    }

}


// ============================================================
// CONTROLLO CASELLA ACCESSIBILE
// ============================================================

function canMoveTo(
    visibleX,
    visibleY
) {

    if (
        !dungeonData ||
        !dungeonData.cells
    ) {

        return false;

    }


    const jsonX =
        visibleX +
        GRID_OFFSET_X;


    const jsonY =
        visibleY +
        GRID_OFFSET_Y;


    if (
        jsonY < 0 ||
        jsonY >=
            dungeonData.cells.length
    ) {

        return false;

    }


    if (
        jsonX < 0 ||
        jsonX >=
            dungeonData.cells[
                jsonY
            ].length
    ) {

        return false;

    }


    const cell =
        dungeonData.cells[
            jsonY
        ][
            jsonX
        ];


    // --------------------------------------------------------
    // SUPPORTO A PIÙ FORMATI DEL JSON
    // --------------------------------------------------------

    if (
        cell === null ||
        cell === undefined
    ) {

        return false;

    }


    if (
        typeof cell ===
        "number"
    ) {

        return cell !== 0;

    }


    if (
        typeof cell ===
        "string"
    ) {

        const value =
            cell.toLowerCase();


        return ![
            "wall",
            "muro",
            "void",
            "blocked",
            "0"
        ].includes(
            value
        );

    }


    if (
        typeof cell ===
        "object"
    ) {

        if (
            cell.walkable !==
            undefined
        ) {

            return !!cell.walkable;

        }


        if (
            cell.blocked !==
            undefined
        ) {

            return !cell.blocked;

        }


        if (
            cell.type
        ) {

            const type =
                String(
                    cell.type
                ).toLowerCase();


            return ![
                "wall",
                "muro",
                "void",
                "blocked"
            ].includes(
                type
            );

        }


        return true;

    }


    return false;

}


// ============================================================
// OTTIENI CASELLA JSON CORRENTE
// ============================================================

function getCurrentDungeonCell() {

    if (
        !dungeonData ||
        !dungeonData.cells
    ) {

        return null;

    }


    const jsonX =
        playerX +
        GRID_OFFSET_X;


    const jsonY =
        playerY +
        GRID_OFFSET_Y;


    if (
        jsonY < 0 ||
        jsonY >=
            dungeonData.cells.length
    ) {

        return null;

    }


    if (
        jsonX < 0 ||
        jsonX >=
            dungeonData.cells[
                jsonY
            ].length
    ) {

        return null;

    }


    return dungeonData.cells[
        jsonY
    ][
        jsonX
    ];

}


// ============================================================
// CONTROLLO EVENTI DELLA CASELLA
// ============================================================

async function checkDungeonCellEvent() {

    const cell =
        getCurrentDungeonCell();


    if (
        !cell ||
        typeof cell !==
            "object"
    ) {

        return;

    }


    // --------------------------------------------------------
    // SUPPORTO GENERICO EVENTO
    // --------------------------------------------------------

    const eventType =
        cell.event ||
        cell.event_type ||
        cell.type_event ||
        null;


    if (!eventType) {

        return;

    }


    const normalizedEvent =
        String(
            eventType
        ).toLowerCase();


    // --------------------------------------------------------
    // TRAPPOLA
    // --------------------------------------------------------

    if (
        normalizedEvent ===
            "trap" ||
        normalizedEvent ===
            "trappola"
    ) {

        await triggerTrapEvent(
            cell
        );


        return;

    }

}


// ============================================================
// EVENTO TRAPPOLA
// ============================================================

async function triggerTrapEvent(
    dungeonEvent
) {

    if (!character) {

        return;

    }


    // --------------------------------------------------------
    // FORTUNA EFFETTIVA
    // --------------------------------------------------------

    const fortuna =
        getDungeonEffectiveAttribute(
            "fortuna"
        );


    // --------------------------------------------------------
    // STATISTICA DIFENSIVA
    //
    // Se il JSON non specifica niente,
    // usiamo RES come fallback.
    // --------------------------------------------------------

    const defenseStatName =
        String(
            dungeonEvent.defenseStat ||
            dungeonEvent.defense_stat ||
            "resistenza"
        ).toLowerCase();


    const supportedStats =
        [
            "forza",
            "resistenza",
            "costituzione",
            "intelligenza",
            "destrezza",
            "fortuna"
        ];


    const safeDefenseStat =
        supportedStats.includes(
            defenseStatName
        )

            ? defenseStatName

            : "resistenza";


    const defenseValue =
        getDungeonEffectiveAttribute(
            safeDefenseStat
        );


    // --------------------------------------------------------
    // DIFFICOLTÀ
    // --------------------------------------------------------

    const difficulty =
        Number(
            dungeonEvent.difficulty ||
            dungeonEvent.dc
        ) || 10;


    // --------------------------------------------------------
    // TIRO
    // --------------------------------------------------------

    const roll =
        Math.floor(
            Math.random() *
            20
        ) + 1;


    // Piccolo contributo della fortuna.

    const fortuneBonus =
        Math.floor(
            fortuna / 5
        );


    const total =
        roll +
        defenseValue +
        fortuneBonus;


    console.log(
        "TRAPPOLA:",
        {
            roll,
            defenseStat:
                safeDefenseStat,
            defenseValue,
            fortuna,
            fortuneBonus,
            total,
            difficulty
        }
    );


    // --------------------------------------------------------
    // SUPERATA
    // --------------------------------------------------------

    if (
        total >=
        difficulty
    ) {

        setMessage(
            dungeonEvent.success_message ||
            dungeonEvent.successMessage ||
            "Riesci a evitare la trappola."
        );


        return;

    }


    // --------------------------------------------------------
    // DANNO
    // --------------------------------------------------------

    const baseDamage =
        Number(
            dungeonEvent.damage
        ) || 1;


    const costituzione =
        getDungeonEffectiveAttribute(
            "costituzione"
        );


    // Per ora manteniamo la logica
    // del sistema dungeon:
    // il danno minimo è sempre 1.

    const constitutionReduction =
        Math.floor(
            costituzione / 10
        );


    const damage =
        Math.max(
            1,
            baseDamage -
            constitutionReduction
        );


    const maxHealth =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    const oldHealth =
        character.current_hp ===
            null
        ||
        character.current_hp ===
            undefined

            ? maxHealth

            : Math.max(
                0,
                Math.min(
                    Number(
                        character.current_hp
                    ),
                    maxHealth
                )
            );


    const newHealth =
        Math.max(
            0,
            oldHealth -
            damage
        );


    // --------------------------------------------------------
    // SALVA PF
    // --------------------------------------------------------

    const {
        error
    } =
        await db
            .from("characters")
            .update({

                current_hp:
                    newHealth

            })
            .eq(
                "id",
                character.id
            );


    if (error) {

        console.error(
            "Errore aggiornamento PF:",
            error
        );


        return;

    }


    character.current_hp =
        newHealth;


    // Aggiorna tutta la scheda,
    // così resta PF attuali / PF massimi.

    updateCharacterPanel();


    setMessage(
        dungeonEvent.fail_message ||
        dungeonEvent.failMessage ||
        `La trappola ti colpisce: perdi ${damage} PF.`
    );


    // --------------------------------------------------------
    // MORTE
    // --------------------------------------------------------

    if (
        newHealth <= 0
    ) {

        await handleCharacterDeath();

    }

}
// ============================================================
// MORTE DEL PERSONAGGIO
// ============================================================

async function handleCharacterDeath() {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


    console.log(
        "Il personaggio è morto."
    );


    movementLocked =
        true;


    setMessage(
        "Il tuo personaggio è morto..."
    );


    // ========================================================
    // RIMUOVE PRESENCE
    // ========================================================

    if (
        dungeonChannel &&
        realtimeReady
    ) {

        try {

            await dungeonChannel.untrack();

        } catch (error) {

            console.error(
                "Errore rimozione presence:",
                error
            );

        }

    }


    // ========================================================
    // ELIMINA PERSONAGGIO
    // ========================================================

    try {

        const {
            error
        } =
            await db
                .from("characters")
                .delete()
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        character = null;


        // ====================================================
        // PAGINA MORTE
        // ====================================================

        window.location.href =
            "morte.html";


    } catch (error) {

        console.error(
            "Errore eliminazione personaggio:",
            error
        );


        showError(
            "Errore durante la gestione della morte del personaggio."
        );

    }

}


// ============================================================
// NOTE PERSONAGGIO
// ============================================================

function setupNotes() {

    const notesElement =
        document.getElementById(
            "character-notes"
        );


    const saveButton =
        document.getElementById(
            "save-notes-button"
        );


    // Supporto anche agli eventuali ID
    // utilizzati nelle versioni precedenti dell'HTML.

    const notes =
        notesElement ||
        document.getElementById(
            "notes"
        );


    const button =
        saveButton ||
        document.getElementById(
            "save-notes"
        );


    if (
        !notes ||
        !button ||
        !character
    ) {

        return;

    }


    notes.value =
        character.notes ||
        "";


    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;


            const originalText =
                button.textContent;


            button.textContent =
                "SALVATAGGIO...";


            try {

                const newNotes =
                    notes.value;


                const {
                    error
                } =
                    await db
                        .from("characters")
                        .update({

                            notes:
                                newNotes

                        })
                        .eq(
                            "id",
                            character.id
                        );


                if (error) {

                    throw error;

                }


                character.notes =
                    newNotes;


                button.textContent =
                    "SALVATO ✓";


            } catch (error) {

                console.error(
                    "Errore salvataggio note:",
                    error
                );


                button.textContent =
                    "ERRORE";


            } finally {

                setTimeout(
                    () => {

                        button.textContent =
                            originalText;


                        button.disabled =
                            false;

                    },
                    1200
                );

            }

        }
    );

}


// ============================================================
// CHAT DEL PIANO
// ============================================================

function setupFloorChat() {

    const input =
        document.getElementById(
            "floor-chat-input"
        )
        ||
        document.getElementById(
            "chat-input"
        );


    const button =
        document.getElementById(
            "floor-chat-send"
        )
        ||
        document.getElementById(
            "chat-send"
        );


    if (
        !input ||
        !button
    ) {

        return;

    }


    // ========================================================
    // INVIO CON PULSANTE
    // ========================================================

    button.addEventListener(
        "click",
        async () => {

            await sendFloorChatMessage(
                input
            );

        }
    );


    // ========================================================
    // INVIO CON ENTER
    // ========================================================

    input.addEventListener(
        "keydown",
        async event => {

            if (
                event.key !==
                "Enter"
            ) {

                return;

            }


            if (
                event.shiftKey
            ) {

                return;

            }


            event.preventDefault();


            await sendFloorChatMessage(
                input
            );

        }
    );

}


// ============================================================
// INVIA MESSAGGIO CHAT
// ============================================================

async function sendFloorChatMessage(
    input
) {

    if (
        !input ||
        !character
    ) {

        return;

    }


    const text =
        input.value.trim();


    if (!text) {

        return;

    }


    const message = {

        character_id:
            character.id,

        name:
            character.nome ||
            "Avventuriero",

        text:
            text,

        timestamp:
            new Date()
                .toISOString()

    };


    // ========================================================
    // MOSTRA SUBITO IL MESSAGGIO LOCALE
    // ========================================================

    addFloorChatMessage(
        message
    );


    input.value =
        "";


    // ========================================================
    // INVIA AGLI ALTRI
    // ========================================================

    if (
        dungeonChannel &&
        realtimeReady
    ) {

        try {

            await dungeonChannel.send({

                type:
                    "broadcast",

                event:
                    "floor-chat",

                payload:
                    message

            });


        } catch (error) {

            console.error(
                "Errore invio chat:",
                error
            );

        }

    }

}


// ============================================================
// MOSTRA MESSAGGIO CHAT
// ============================================================

function addFloorChatMessage(
    message
) {

    if (!message) {

        return;

    }


    const container =
        document.getElementById(
            "floor-chat-messages"
        )
        ||
        document.getElementById(
            "chat-messages"
        );


    if (!container) {

        return;

    }


    // ========================================================
    // RIMUOVE PLACEHOLDER
    // ========================================================

    const placeholder =
        container.querySelector(
            ".chat-placeholder"
        );


    if (placeholder) {

        placeholder.remove();

    }


    // ========================================================
    // RIGA
    // ========================================================

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "floor-chat-message";


    if (
        character &&
        message.character_id ===
            character.id
    ) {

        row.classList.add(
            "mine"
        );

    }


    // ========================================================
    // NOME
    // ========================================================

    const name =
        document.createElement(
            "strong"
        );


    name.className =
        "floor-chat-name";


    name.textContent =
        message.name ||
        "Avventuriero";


    // ========================================================
    // TESTO
    // ========================================================

    const text =
        document.createElement(
            "span"
        );


    text.className =
        "floor-chat-text";


    text.textContent =
        message.text ||
        "";


    row.append(
        name,
        document.createTextNode(
            ": "
        ),
        text
    );


    container.appendChild(
        row
    );


    container.scrollTop =
        container.scrollHeight;

}


// ============================================================
// MESSAGGIO DI STATO
// ============================================================

function setMessage(
    text
) {

    const element =
        document.getElementById(
            "dungeon-message"
        )
        ||
        document.getElementById(
            "message"
        );


    if (!element) {

        return;

    }


    element.textContent =
        text;

}


// ============================================================
// MOSTRA ERRORE
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
        )
        ||
        document.getElementById(
            "message"
        );


    if (element) {

        element.textContent =
            text;


        element.classList.add(
            "error"
        );


        return;

    }


    alert(
        text
    );

}


// ============================================================
// RIPRISTINA STILE MESSAGGIO
// ============================================================

function clearMessageError() {

    const element =
        document.getElementById(
            "dungeon-message"
        )
        ||
        document.getElementById(
            "message"
        );


    if (!element) {

        return;

    }


    element.classList.remove(
        "error"
    );

}


// ============================================================
// AGGIORNA DATI PERSONAGGIO DAL DATABASE
// ============================================================
//
// Utile quando PF / PM vengono modificati da altre pagine,
// ad esempio:
//
// - scheda.html
// - combat.html
// - pozioni
// - abilità
//
// ============================================================

async function refreshDungeonCharacter() {

    if (
        !character ||
        !currentUser
    ) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db
                .from("characters")
                .select("*")
                .eq(
                    "id",
                    character.id
                )
                .eq(
                    "user_id",
                    currentUser.id
                )
                .maybeSingle();


        if (error) {

            throw error;

        }


        if (!data) {

            return;

        }


        character =
            data;


        // Ricarichiamo anche l'equipaggiamento:
        // potrebbe essere cambiato dalla scheda.

        await loadCharacterEquipment();


        updateCharacterPanel();


    } catch (error) {

        console.error(
            "Errore aggiornamento personaggio dungeon:",
            error
        );

    }

}


// ============================================================
// AGGIORNAMENTO PERIODICO DELLA SCHEDA
// ============================================================
//
// Serve soprattutto se il personaggio viene modificato
// da un'altra scheda/browser mentre dungeon.html resta aperto.
//
// ============================================================

let dungeonCharacterRefreshInterval =
    null;


function startDungeonCharacterRefresh() {

    if (
        dungeonCharacterRefreshInterval
    ) {

        clearInterval(
            dungeonCharacterRefreshInterval
        );

    }


    dungeonCharacterRefreshInterval =
        setInterval(
            async () => {

                await refreshDungeonCharacter();

            },
            5000
        );

}


// ============================================================
// FERMA AGGIORNAMENTO PERIODICO
// ============================================================

function stopDungeonCharacterRefresh() {

    if (
        !dungeonCharacterRefreshInterval
    ) {

        return;

    }


    clearInterval(
        dungeonCharacterRefreshInterval
    );


    dungeonCharacterRefreshInterval =
        null;

}


// ============================================================
// AVVIA REFRESH AUTOMATICO DOPO IL CARICAMENTO
// ============================================================

window.addEventListener(
    "load",
    () => {

        startDungeonCharacterRefresh();

    }
);


// ============================================================
// VISIBILITÀ PAGINA
// ============================================================
//
// Quando torniamo sulla scheda dungeon dopo essere stati
// in un'altra tab, aggiorniamo immediatamente PG ed
// equipaggiamento.
//
// ============================================================

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            await refreshDungeonCharacter();


            repositionAllTokens();

        }

    }
);


// ============================================================
// FOCUS FINESTRA
// ============================================================

window.addEventListener(
    "focus",
    async () => {

        await refreshDungeonCharacter();


        repositionAllTokens();

    }
);


// ============================================================
// USCITA DALLA PAGINA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        // ====================================================
        // REFRESH PG
        // ====================================================

        stopDungeonCharacterRefresh();


        // ====================================================
        // PRESENCE
        // ====================================================

        if (
            dungeonChannel &&
            realtimeReady
        ) {

            try {

                dungeonChannel.untrack();

            } catch (error) {

                console.error(
                    "Errore untrack:",
                    error
                );

            }

        }


        // ====================================================
        // RIMUOVE CANALE
        // ====================================================

        if (
            dungeonChannel
        ) {

            try {

                db.removeChannel(
                    dungeonChannel
                );

            } catch (error) {

                console.error(
                    "Errore rimozione canale:",
                    error
                );

            }

        }

    }
);


// ============================================================
// FINE DUNGEON.JS
// ============================================================
