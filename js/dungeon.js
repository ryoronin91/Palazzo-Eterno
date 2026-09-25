// ============================================================
// PALAZZO ETERNO
// DUNGEON.JS
// VERSIONE NUOVA INTERFACCIA
// ============================================================

console.log("DUNGEON.JS - NUOVA INTERFACCIA CARICATA");


// ============================================================
// SUPABASE
// ============================================================

const db = supabaseClient;


// ============================================================
// MAPPA
// ============================================================

const MAP_COLUMNS = 23;
const MAP_ROWS = 23;

const GRID_OFFSET_X = 4;
const GRID_OFFSET_Y = 4;

const INITIAL_PLAYER_X = 9;
const INITIAL_PLAYER_Y = 0;


// ============================================================
// MULTIPLAYER
// ============================================================

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";


// ============================================================
// PERSONAGGIO
// ============================================================

let character = null;
let currentUser = null;

let characterInventory = [];

let characterAbilities = [];

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
// MAPPA / POSIZIONE
// ============================================================

let dungeonData = null;

let playerX = null;
let playerY = null;

let tokenElement = null;


// ============================================================
// NUOVO SISTEMA MOVIMENTO
// ============================================================
//
// IMPORTANTE:
//
// Il vecchio sistema bloccava il movimento mentre aspettava:
//
// 1. database
// 2. Presence
// 3. Broadcast
// 4. evento casella
//
// Adesso invece:
//
// - il comando viene messo in coda;
// - il token si sposta immediatamente;
// - il salvataggio avviene dopo;
// - i comandi successivi non vengono persi.
//
// ============================================================

const movementQueue = [];

let movementQueueRunning = false;

let eventLocked = false;

let positionSaveTimer = null;

let positionSaveRunning = false;

let positionSavePending = false;


// ============================================================
// REALTIME
// ============================================================

let dungeonChannel = null;
let realtimeReady = false;


// ============================================================
// ALTRI GIOCATORI
// ============================================================

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
// CURA
// ============================================================

let healModeActive = false;

let healRangeElements = [];


// ============================================================
// REFRESH
// ============================================================

let dungeonCharacterRefreshInterval = null;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            setMessage(
                "Caricamento del dungeon..."
            );


            // ------------------------------------------------
            // PERSONAGGIO
            // ------------------------------------------------

            await loadCharacter();


            // ------------------------------------------------
            // CADUTI DEL PALAZZO
            // ------------------------------------------------

            await loadDungeonLeaderboard();


            // ------------------------------------------------
            // NOTE
            // ------------------------------------------------

            setupNotes();


            // ------------------------------------------------
            // CHAT
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

            // ------------------------------------------------------------
            // NEBBIA DI GUERRA
            // ------------------------------------------------------------

            setupFogOfWar();
            
            // ------------------------------------------------
            // MOVIMENTO
            // ------------------------------------------------

            setupMovement();


            // ------------------------------------------------
            // AZIONI RAPIDE
            // ------------------------------------------------

            setupDungeonActions();


            // ------------------------------------------------
            // MULTIPLAYER
            // ------------------------------------------------

            await setupRealtimeMultiplayer();


            // ------------------------------------------------
            // REFRESH
            // ------------------------------------------------

            startDungeonCharacterRefresh();


            setMessage(
                "Usa WASD, le frecce o clicca una casella adiacente."
            );


        } catch (error) {

            console.error(
                "Errore avvio dungeon:",
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
// CADUTI DEL PALAZZO
// ============================================================

async function loadDungeonLeaderboard() {

    const container =
        document.getElementById(
            "dungeon-leaderboard-list"
        );


    if (!container) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_dead_characters_leaderboard",
                {
                    p_limit:
                        20
                }
            );


        if (error) {

            throw error;

        }


        renderDungeonLeaderboard(
            data || []
        );


    } catch (error) {

        console.error(
            "Errore caricamento Caduti del Palazzo:",
            error
        );


        container.innerHTML =
            `
                <div class="dungeon-leaderboard-empty">
                    Classifica non disponibile.
                </div>
            `;

    }

}


// ============================================================
// RENDER CADUTI DEL PALAZZO
// ============================================================

function renderDungeonLeaderboard(
    rows
) {

    const container =
        document.getElementById(
            "dungeon-leaderboard-list"
        );


    if (!container) {

        return;

    }


    if (
        !Array.isArray(rows) ||
        rows.length === 0
    ) {

        container.innerHTML =
            `
                <div class="dungeon-leaderboard-empty">
                    Nessun caduto registrato.
                </div>
            `;

        return;

    }


    container.innerHTML =
        rows
            .map(
                row => {

                    const position =
                        Number(
                            row.posizione
                        ) || 0;


                    const score =
                        Number(
                            row.score
                        ) || 0;


                    const name =
                        escapeDungeonLeaderboardHtml(
                            row.character_name ||
                            "Avventuriero"
                        );


                    return `
                        <div class="dungeon-leaderboard-row">

                            <div class="dungeon-leaderboard-position">
                                #${position}
                            </div>

                            <div
                                class="dungeon-leaderboard-name"
                                title="${name}"
                            >
                                ${name}
                            </div>

                            <div class="dungeon-leaderboard-score">
                                ${score}
                            </div>

                        </div>
                    `;

                }
            )
            .join("");

}


// ============================================================
// ESCAPE HTML LEADERBOARD
// ============================================================

function escapeDungeonLeaderboardHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


// ============================================================
// CARICAMENTO DUNGEON
// ============================================================

async function loadDungeon() {

    const response =
        await fetch(
            "dungeon.json"
        );


    if (!response.ok) {

        throw new Error(
            "Impossibile caricare dungeon.json."
        );

    }


    dungeonData =
        await response.json();


    if (
        !dungeonData ||
        !Array.isArray(
            dungeonData.cells
        )
    ) {

        throw new Error(
            "dungeon.json non contiene una griglia valida."
        );

    }


    console.log(
        "Dungeon caricato:",
        dungeonData
    );

}


// ============================================================
// CARICAMENTO PERSONAGGIO
// ============================================================

async function loadCharacter() {

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

        window.location.href =
            "personaggio.html";

        return;

    }


    character =
        data;


   await Promise.all([
    loadCharacterEquipment(),
    loadDungeonAbilities()
]);

updateCharacterPanel();

}

// ============================================================
// ABILITÀ PERSONAGGIO
// ============================================================

async function loadDungeonAbilities() {

    if (!character) {

        characterAbilities = [];

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                "character_abilities"
            )
            .select(`
                id,
                ability_id,
                level,

                ability:abilities (
                    id,
                    name,
                    description,
                    ability_type,
                    pm_cost,
                    max_level
                )
            `)
            .eq(
                "character_id",
                character.id
            );


    if (error) {

        throw error;

    }


    characterAbilities =
        data || [];


    updateDungeonAbilityVisibility();

}


// ============================================================
// POSSIEDE UNA ABILITÀ?
// ============================================================

function hasDungeonAbility(
    abilityId
) {

    return characterAbilities.some(
        entry =>
            entry.ability_id === abilityId ||
            entry.ability?.id === abilityId
    );

}


// ============================================================
// VISIBILITÀ ABILITÀ DUNGEON
// ============================================================

function updateDungeonAbilityVisibility() {

    const healButton =
        document.getElementById(
            "dungeon-heal-button"
        );


    if (healButton) {

        healButton.style.display =
            hasDungeonAbility("cura")
                ? ""
                : "none";

    }

}

// ============================================================
// EQUIPAGGIAMENTO
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
                    name,
                    item_type,
                    equip_slot,
                    heal_pf,
                    heal_pm,
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
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];


    calculateDungeonEquipmentBonuses();

    updateDungeonConsumables();

}


// ============================================================
// BONUS EQUIPAGGIAMENTO
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


    characterInventory
        .filter(
            entry =>
                entry.equipped_slot &&
                entry.item
        )
        .forEach(
            entry => {

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
// STATISTICHE CALCOLATE
// ============================================================

function getDungeonCalculatedStats() {

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


    return {

        forza,
        resistenza,
        costituzione,
        intelligenza,
        destrezza,
        fortuna,

        attack:
            Math.ceil(
                forza / 2
            )
            +
            (
                Number(
                    equipmentBonuses.attack_bonus
                ) || 0
            ),

        defense:
            Math.ceil(
                7 +
                resistenza / 2
            )
            +
            (
                Number(
                    equipmentBonuses.defense_bonus
                ) || 0
            ),

        maxHealth:
            Math.ceil(
                5 *
                costituzione / 2
            ),

        maxMana:
            Math.ceil(
                5 *
                intelligenza / 2
            ),

        movement:
            Math.ceil(
                4 +
                destrezza / 2
            ),

        critical:
            Math.round(
                fortuna *
                (
                    50 / 30
                )
                *
                100
            )
            /
            100

    };

}


// ============================================================
// PANNELLO PERSONAGGIO
// ============================================================

function updateCharacterPanel() {

    if (!character) {

        return;

    }


    const stats =
        getDungeonCalculatedStats();


    const name =
        character.nome ||
        "Avventuriero";


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
        Number(
            character.livello
        ) || 1
    );


    // --------------------------------------------------------
    // RITRATTO LATERALE
    // --------------------------------------------------------

    const portrait =
        document.getElementById(
            "character-token"
        );


    if (portrait) {

        portrait.src =
            "immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );


        portrait.alt =
            `Token di ${name}`;

    }


    // --------------------------------------------------------
    // ATTRIBUTI
    // --------------------------------------------------------

    setText(
        "forza-display",
        stats.forza
    );


    setText(
        "resistenza-display",
        stats.resistenza
    );


    setText(
        "costituzione-display",
        stats.costituzione
    );


    setText(
        "intelligenza-display",
        stats.intelligenza
    );


    setText(
        "destrezza-display",
        stats.destrezza
    );


    setText(
        "fortuna-display",
        stats.fortuna
    );


    // --------------------------------------------------------
    // PF / PM ATTUALI
    // --------------------------------------------------------

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined

            ? stats.maxHealth

            : Math.max(
                0,
                Math.min(
                    Number(
                        character.current_hp
                    ),
                    stats.maxHealth
                )
            );


    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined

            ? stats.maxMana

            : Math.max(
                0,
                Math.min(
                    Number(
                        character.current_pm
                    ),
                    stats.maxMana
                )
            );


    // --------------------------------------------------------
    // SECONDARIE
    // --------------------------------------------------------

    setText(
        "attack-display",
        stats.attack
    );


    setText(
        "defense-display",
        stats.defense
    );


    setText(
        "health-display",
        `${currentPF}/${stats.maxHealth}`
    );


    setText(
        "mana-display",
        `${currentPM}/${stats.maxMana}`
    );


    setText(
        "movement-display",
        stats.movement
    );


    setText(
        "critical-display",
        `${stats.critical.toFixed(2)}%`
    );


    updateDungeonActionAvailability();

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


        return;

    }


    playerX =
        INITIAL_PLAYER_X;


    playerY =
        INITIAL_PLAYER_Y;


    character.dungeon_x =
        playerX;


    character.dungeon_y =
        playerY;


    showToken(
        playerX,
        playerY
    );


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

}


// ============================================================
// TOKEN PERSONALE
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


        tokenElement.dataset.characterId =
            character.id;


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


    if (
        rect.width <= 0 ||
        rect.height <= 0
    ) {

        return;

    }


    const cellWidth =
        rect.width /
        MAP_COLUMNS;


    const cellHeight =
        rect.height /
        MAP_ROWS;


    // Il token occupa il 90% della casella.
    // È totalmente indipendente dal ritratto laterale.

    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) *
        0.90;


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
// RIPOSIZIONA TOKEN
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


            if (token) {

                positionTokenElement(
                    token,
                    player.x,
                    player.y
                );

            }

        }
    );


    if (healModeActive) {

        renderHealRange();

    }

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
        event => {

            const target =
                event.target;


            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable
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


            // Evitiamo l'autorepeat del sistema operativo.
            // Le pressioni reali successive vengono comunque
            // accodate normalmente.

            if (event.repeat) {

                return;

            }


            queueMovement(
                dx,
                dy
            );

        }
    );


    // --------------------------------------------------------
    // CLICK MAPPA
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
        event => {

            // Se Cura è attiva, il click sulla mappa
            // non deve causare movimento.

            if (healModeActive) {

                return;

            }


            if (
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


            // Movimento normale solo ortogonale.

            if (
                Math.abs(dx) +
                Math.abs(dy)
                !==
                1
            ) {

                return;

            }


            queueMovement(
                dx,
                dy
            );

        }
    );

}


// ============================================================
// ACCODA MOVIMENTO
// ============================================================

function queueMovement(
    dx,
    dy
) {

    if (
        !character ||
        !dungeonData ||
        eventLocked
    ) {

        return;

    }


    // Impediamo che una raffica di input crei
    // una coda enorme.

    if (
        movementQueue.length >= 8
    ) {

        return;

    }


    movementQueue.push({
        dx,
        dy
    });


    processMovementQueue();

}


// ============================================================
// ESEGUE CODA MOVIMENTI
// ============================================================

async function processMovementQueue() {

    if (movementQueueRunning) {

        return;

    }


    movementQueueRunning =
        true;


    try {

        while (
            movementQueue.length > 0
        ) {

            if (eventLocked) {

                break;

            }


            const movement =
                movementQueue.shift();


            await performMovement(
                movement.dx,
                movement.dy
            );


            // Piccolissima pausa grafica.
            // Non dipende dalla risposta di Supabase.

            await wait(
                55
            );

        }


    } finally {

        movementQueueRunning =
            false;

    }

}


// ============================================================
// ESEGUE UN PASSO
// ============================================================

async function performMovement(
    dx,
    dy
) {

    if (
        !character ||
        !dungeonData ||
        eventLocked
    ) {

        return false;

    }


    const newX =
        playerX +
        dx;


    const newY =
        playerY +
        dy;


    // --------------------------------------------------------
    // CONFINI
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


        return false;

    }


    // --------------------------------------------------------
    // MURO
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


        return false;

    }


    // --------------------------------------------------------
    // IL TOKEN SI MUOVE SUBITO
    // --------------------------------------------------------

    playerX =
        newX;


    playerY =
        newY;


    character.dungeon_x =
        playerX;


    character.dungeon_y =
        playerY;


    showToken(
        playerX,
        playerY
    );
    
    updateFogOfWar();

    let hasNearbyCombatEvent =
    false;


if (
    typeof checkNearbyCombatEvents ===
    "function"
) {

    hasNearbyCombatEvent =
        checkNearbyCombatEvents() === true;

}

    // --------------------------------------------------------
    // REALTIME SENZA BLOCCARE IL MOVIMENTO
    // --------------------------------------------------------

    broadcastMyState();

    updateMyPresence();


    // --------------------------------------------------------
    // SALVATAGGIO DATABASE DEBOUNCED
    // --------------------------------------------------------

    schedulePositionSave();


    // --------------------------------------------------------
    // EVENTO CASELLA
    // --------------------------------------------------------

    const hasEvent =
        await checkDungeonCellEvent();


    if (
    !hasEvent &&
    !hasNearbyCombatEvent
) {

    setMessage(
        "Ti muovi nel dungeon."
    );

}


    return true;

}


// ============================================================
// SALVATAGGIO POSIZIONE
// ============================================================

function schedulePositionSave() {

    positionSavePending =
        true;


    if (positionSaveTimer) {

        clearTimeout(
            positionSaveTimer
        );

    }


    positionSaveTimer =
        setTimeout(
            () => {

                flushPositionSave();

            },
            120
        );

}


// ============================================================
// SALVA ULTIMA POSIZIONE
// ============================================================

async function flushPositionSave() {

    if (
        !character ||
        playerX === null ||
        playerY === null
    ) {

        return;

    }


    if (positionSaveRunning) {

        positionSavePending =
            true;

        return;

    }


    positionSaveRunning =
        true;


    positionSavePending =
        false;


    const saveX =
        playerX;


    const saveY =
        playerY;


    try {

        const {
            error
        } =
            await db
                .from("characters")
                .update({

                    dungeon_x:
                        saveX,

                    dungeon_y:
                        saveY

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


    } catch (error) {

        console.error(
            "Errore salvataggio posizione:",
            error
        );


        setMessage(
            "Movimento effettuato, ma c'è stato un problema nel salvataggio."
        );


    } finally {

        positionSaveRunning =
            false;


        // Se mentre stavamo salvando il PG si è
        // mosso ancora, salviamo l'ultima posizione.

        if (
            positionSavePending ||
            saveX !== playerX ||
            saveY !== playerY
        ) {

            flushPositionSave();

        }

    }

}


// ============================================================
// ATTESA
// ============================================================

function wait(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

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
        !Array.isArray(
            dungeonData.cells
        )
    ) {

        return false;

    }


    // --------------------------------------------------------
    // CONVERSIONE COORDINATE VISIBILI -> JSON
    // --------------------------------------------------------

    const jsonX =
        visibleX +
        GRID_OFFSET_X;


    const jsonY =
        visibleY +
        GRID_OFFSET_Y;


    // --------------------------------------------------------
    // FUORI DALLA MAPPA
    // --------------------------------------------------------

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


    const rawCell =
        dungeonData.cells[
            jsonY
        ][
            jsonX
        ];


    const cell =
        Number(
            rawCell
        );


    if (
        !Number.isFinite(
            cell
        )
    ) {

        return false;

    }


    // --------------------------------------------------------
    // VUOTO
    // --------------------------------------------------------

    if (
        cell === 0
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
        Number(
            bits.room
        ) || 2;


    const CORRIDOR =
        Number(
            bits.corridor
        ) || 4;


    const APERTURE =
        Number(
            bits.aperture
        ) || 32;


    const ARCH =
        Number(
            bits.arch
        ) || 65536;


    const DOOR =
        Number(
            bits.door
        ) || 131072;


    const PORTCULLIS =
        Number(
            bits.portcullis
        ) || 2097152;


    const STAIR_DOWN =
        Number(
            bits.stair_down
        ) || 4194304;


    const STAIR_UP =
        Number(
            bits.stair_up
        ) || 8388608;


    // --------------------------------------------------------
    // UNA CASELLA È PERCORRIBILE SOLO SE CONTIENE
    // ALMENO UNO DEI BIT DI PAVIMENTO / PASSAGGIO.
    //
    // Quindi:
    //
    // 16 = perimeter -> MURO -> NO
    // 0  = nothing   -> VUOTO -> NO
    // 2  = room      -> SI
    // 4  = corridor  -> SI
    // ecc.
    // --------------------------------------------------------

    const isWalkable =
        (
            cell & ROOM
        ) !== 0 ||

        (
            cell & CORRIDOR
        ) !== 0 ||

        (
            cell & APERTURE
        ) !== 0 ||

        (
            cell & ARCH
        ) !== 0 ||

        (
            cell & DOOR
        ) !== 0 ||

        (
            cell & PORTCULLIS
        ) !== 0 ||

        (
            cell & STAIR_DOWN
        ) !== 0 ||

        (
            cell & STAIR_UP
        ) !== 0;


    return isWalkable;

}

// ============================================================
// REALTIME MULTIPLAYER
// ============================================================

async function setupRealtimeMultiplayer() {

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
                        key: character.id
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

            syncOnlinePlayers();

            broadcastMyState();

        }
    );


    // ========================================================
    // MOVIMENTO ALTRI GIOCATORI
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


            if (!data) {
                return;
            }


            addFloorChatMessage(
                data
            );

        }
    );


    // ========================================================
    // CURA REMOTA
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event: "player-healed"
        },
        message => {

            const data =
                message.payload;


            if (!data) {
                return;
            }


            // Se siamo noi il bersaglio,
            // aggiorniamo immediatamente i PF.

            if (
                data.target_character_id ===
                character.id
            ) {

                character.current_hp =
                    Number(
                        data.new_hp
                    );


                updateCharacterPanel();


                setMessage(
                    `${data.caster_name || "Un alleato"} ti ha curato di ${data.healed_amount} PF.`
                );

            }

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
                        "Realtime:",
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        realtimeReady =
                            true;


                        try {

                            await dungeonChannel.track(
                                getMyPresenceData()
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
// DATI PRESENCE PERSONALE
// ============================================================

function getMyPresenceData() {

    return {

        character_id:
            character.id,

        user_id:
            currentUser.id,

        name:
            character.nome ||
            "Avventuriero",

        token:
            character.token ||
            "token_1.png",

        x:
            playerX,

        y:
            playerY,

        current_hp:
    character.current_hp,

active_combat_id:
    character.active_combat_id ||
    null,

in_combat:
    !!character.active_combat_id,

online_at:
            new Date()
                .toISOString()

    };

}


// ============================================================
// AGGIORNA PRESENCE
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

        await dungeonChannel.track(
            getMyPresenceData()
        );


    } catch (error) {

        console.error(
            "Errore aggiornamento Presence:",
            error
        );

    }

}


// ============================================================
// BROADCAST POSIZIONE
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
                    character.nome ||
                    "Avventuriero",

                token:
                    character.token ||
                    "token_1.png",

                x:
                    playerX,

                y:
                    playerY,

                current_hp:
    character.current_hp,

active_combat_id:
    character.active_combat_id ||
    null,

in_combat:
    !!character.active_combat_id

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


    // ========================================================
    // RIMUOVE TOKEN DEI GIOCATORI USCITI
    // ========================================================

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


    // Se Cura è attiva, aggiorniamo
    // immediatamente i bersagli disponibili.

    if (healModeActive) {

        renderHealRange();

        updateHealTargets();

    }
renderFogOfWar();

updateRemoteTokensVisibility();
    
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


    const oldData =
        otherPlayers.get(
            data.character_id
        ) || {};


    otherPlayers.set(
    data.character_id,
    {

        ...oldData,

        character_id:
            data.character_id,

        name:
            data.name ||
            oldData.name ||
            "Avventuriero",

        token:
            data.token ||
            oldData.token ||
            "token_1.png",

        x:
            x,

        y:
            y,

        current_hp:
            data.current_hp !== undefined
                ? data.current_hp
                : oldData.current_hp,

        active_combat_id:
            data.active_combat_id !== undefined
                ? data.active_combat_id
                : oldData.active_combat_id,

        in_combat:
            data.in_combat !== undefined
                ? !!data.in_combat
                : !!oldData.in_combat

    }
);


    showOtherPlayerToken(
        data.character_id
    );
    
updateRemoteTokensVisibility();

    if (healModeActive) {

        updateHealTargets();

    }

}


// ============================================================
// TOKEN ALTRO GIOCATORE
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


        // Cura tramite click sul token.

        token.addEventListener(
            "click",
            async event => {

                if (!healModeActive) {
                    return;
                }


                event.stopPropagation();


                await castHealOnCharacter(
                    characterId
                );

            }
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

    if (
    player.in_combat ||
    player.active_combat_id
) {

    token.classList.add(
        "is-in-combat"
    );


    token.title =
        `${player.name} — IN COMBATTIMENTO`;

} else {

    token.classList.remove(
        "is-in-combat"
    );


    token.title =
        player.name;

}

token.classList.toggle(
    "is-in-combat",
    !!player.in_combat
);


token.title =
    player.in_combat
        ? `${player.name} - IN COMBATTIMENTO`
        : player.name;

    positionTokenElement(
        token,
        player.x,
        player.y
    );

}


// ============================================================
// AZIONI DUNGEON
// ============================================================

function setupDungeonActions() {

    const healButton =
        document.getElementById(
            "dungeon-heal-button"
        );


    const healthPotionButton =
        document.getElementById(
            "dungeon-health-potion-button"
        );


    const manaPotionButton =
        document.getElementById(
            "dungeon-mana-potion-button"
        );


    // ========================================================
    // CURA
    // ========================================================

    if (healButton) {

        healButton.addEventListener(
            "click",
            () => {

                if (healModeActive) {

                    deactivateHealMode();

                } else {

                    activateHealMode();

                }

            }
        );

    }


    // ========================================================
    // POZIONE VITA
    // ========================================================

    if (healthPotionButton) {

        healthPotionButton.addEventListener(
            "click",
            async () => {

                if (
                    healthPotionButton.disabled
                ) {
                    return;
                }


                deactivateHealMode();


                await useDungeonPotion(
                    "health"
                );

            }
        );

    }


    // ========================================================
    // POZIONE MANA
    // ========================================================

    if (manaPotionButton) {

        manaPotionButton.addEventListener(
            "click",
            async () => {

                if (
                    manaPotionButton.disabled
                ) {
                    return;
                }


                deactivateHealMode();


                await useDungeonPotion(
                    "mana"
                );

            }
        );

    }


    // ========================================================
    // CURA SU SE STESSI
    // ========================================================

    if (tokenElement) {

        tokenElement.addEventListener(
            "click",
            async event => {

                if (!healModeActive) {
                    return;
                }


                event.stopPropagation();


                await castHealOnSelf();

            }
        );

    }


    updateDungeonActionAvailability();

}


// ============================================================
// DISPONIBILITÀ AZIONI
// ============================================================

function updateDungeonActionAvailability() {

    if (!character) {
        return;
    }


    const stats =
        getDungeonCalculatedStats();


    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined

            ? stats.maxHealth

            : Number(
                character.current_hp
            );


    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined

            ? stats.maxMana

            : Number(
                character.current_pm
            );


    const healButton =
        document.getElementById(
            "dungeon-heal-button"
        );


    if (healButton) {

        // Cura costa 2 PM.

        healButton.disabled =
            currentPM < 2;

    }


    const healthPotion =
        findDungeonPotion(
            "health"
        );


    const manaPotion =
        findDungeonPotion(
            "mana"
        );


    const healthButton =
        document.getElementById(
            "dungeon-health-potion-button"
        );


    const manaButton =
        document.getElementById(
            "dungeon-mana-potion-button"
        );


    if (healthButton) {

        healthButton.disabled =
            !healthPotion ||
            currentPF >= stats.maxHealth;

    }


    if (manaButton) {

        manaButton.disabled =
            !manaPotion ||
            currentPM >= stats.maxMana;

    }

}


// ============================================================
// AGGIORNA NUMERO CONSUMABILI
// ============================================================

function updateDungeonConsumables() {

    const healthPotion =
        findDungeonPotion(
            "health"
        );


    const manaPotion =
        findDungeonPotion(
            "mana"
        );


    setText(
        "dungeon-health-potion-count",
        `x${
            healthPotion
                ? Number(
                    healthPotion.quantity
                ) || 0
                : 0
        }`
    );


    setText(
        "dungeon-mana-potion-count",
        `x${
            manaPotion
                ? Number(
                    manaPotion.quantity
                ) || 0
                : 0
        }`
    );


    updateDungeonActionAvailability();

}


// ============================================================
// TROVA POZIONE
// ============================================================
//
// Non ci affidiamo al nome esatto della pozione.
// Usiamo heal_pf / heal_pm.
//
// ============================================================

function findDungeonPotion(
    type
) {

    return characterInventory.find(
        entry => {

            if (
                !entry.item ||
                Number(
                    entry.quantity
                ) <= 0
            ) {
                return false;
            }


            if (
                type ===
                "health"
            ) {

                return (
                    Number(
                        entry.item.heal_pf
                    ) || 0
                ) > 0;

            }


            if (
                type ===
                "mana"
            ) {

                return (
                    Number(
                        entry.item.heal_pm
                    ) || 0
                ) > 0;

            }


            return false;

        }
    );

}


// ============================================================
// USA POZIONE NEL DUNGEON
// ============================================================

async function useDungeonPotion(
    type
) {

    const potion =
        findDungeonPotion(
            type
        );


    if (!potion) {

        setMessage(
            type === "health"
                ? "Non hai Pozioni di Vita."
                : "Non hai Pozioni di Mana."
        );


        return;

    }


    const stats =
        getDungeonCalculatedStats();


    const oldPF =
        character.current_hp === null ||
        character.current_hp === undefined

            ? stats.maxHealth

            : Number(
                character.current_hp
            );


    const oldPM =
        character.current_pm === null ||
        character.current_pm === undefined

            ? stats.maxMana

            : Number(
                character.current_pm
            );


    let newPF =
        oldPF;


    let newPM =
        oldPM;


    if (
        type ===
        "health"
    ) {

        if (
            oldPF >=
            stats.maxHealth
        ) {

            setMessage(
                "Hai già tutti i PF."
            );

            return;

        }


        newPF =
            Math.min(
                stats.maxHealth,
                oldPF +
                (
                    Number(
                        potion.item.heal_pf
                    ) || 0
                )
            );

    }


    if (
        type ===
        "mana"
    ) {

        if (
            oldPM >=
            stats.maxMana
        ) {

            setMessage(
                "Hai già tutti i PM."
            );

            return;

        }


        newPM =
            Math.min(
                stats.maxMana,
                oldPM +
                (
                    Number(
                        potion.item.heal_pm
                    ) || 0
                )
            );

    }


    try {

        // ----------------------------------------------------
        // Usiamo l'RPC già esistente del progetto.
        // L'RPC gestisce la diminuzione della quantità.
        // ----------------------------------------------------

        const {
            error: rpcError
        } =
            await db.rpc(
                "use_inventory_item",
                {
                    p_inventory_id:
                        potion.id
                }
            );


        if (rpcError) {

            throw rpcError;

        }


        // ----------------------------------------------------
        // Aggiorniamo PF / PM.
        // ----------------------------------------------------

        const updateData = {};


        if (
            type ===
            "health"
        ) {

            updateData.current_hp =
                newPF;

        } else {

            updateData.current_pm =
                newPM;

        }


        const {
            error
        } =
            await db
                .from("characters")
                .update(
                    updateData
                )
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        if (
            type ===
            "health"
        ) {

            character.current_hp =
                newPF;

        } else {

            character.current_pm =
                newPM;

        }


        await loadCharacterEquipment();


        updateCharacterPanel();

        updateMyPresence();


        if (
            type ===
            "health"
        ) {

            setMessage(
                `Bevi una Pozione di Vita e recuperi ${newPF - oldPF} PF.`
            );

        } else {

            setMessage(
                `Bevi una Pozione di Mana e recuperi ${newPM - oldPM} PM.`
            );

        }


    } catch (error) {

        console.error(
            "Errore utilizzo pozione:",
            error
        );


        setMessage(
            "Non è stato possibile utilizzare la pozione."
        );

    }

}


// ============================================================
// ATTIVA MODALITÀ CURA
// ============================================================

function activateHealMode() {

    if (!character) {
        return;
    }

    if (
    !hasDungeonAbility(
        "cura"
    )
) {

    setMessage(
        "Il personaggio non conosce Cura."
    );

    return;

}

    const stats =
        getDungeonCalculatedStats();


    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined

            ? stats.maxMana

            : Number(
                character.current_pm
            );


    if (
        currentPM < 2
    ) {

        setMessage(
            "Non hai abbastanza PM per usare Cura."
        );

        return;

    }


    healModeActive =
        true;


    movementQueue.length =
        0;


    const button =
        document.getElementById(
            "dungeon-heal-button"
        );


    if (button) {

        button.classList.add(
            "active"
        );

    }


    renderHealRange();

    updateHealTargets();


    setMessage(
        "CURA: scegli te stesso o un alleato in una delle 8 caselle adiacenti."
    );

}


// ============================================================
// DISATTIVA MODALITÀ CURA
// ============================================================

function deactivateHealMode() {

    healModeActive =
        false;


    const button =
        document.getElementById(
            "dungeon-heal-button"
        );


    if (button) {

        button.classList.remove(
            "active"
        );

    }


    clearHealRange();

    clearHealTargets();


    setMessage(
        "Usa WASD, le frecce o clicca una casella adiacente."
    );

}


// ============================================================
// DISEGNA AREA CURA 3x3
// ============================================================
//
// La casella del PG è inclusa.
//
// x-1,y-1   x,y-1   x+1,y-1
// x-1,y     PG      x+1,y
// x-1,y+1   x,y+1   x+1,y+1
//
// ============================================================

function renderHealRange() {

    clearHealRange();


    if (
        !healModeActive ||
        playerX === null ||
        playerY === null
    ) {
        return;
    }


    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {
        return;
    }


    const rect =
        map.getBoundingClientRect();


    if (
        rect.width <= 0 ||
        rect.height <= 0
    ) {
        return;
    }


    const cellWidth =
        rect.width /
        MAP_COLUMNS;


    const cellHeight =
        rect.height /
        MAP_ROWS;


    for (
        let dy = -1;
        dy <= 1;
        dy++
    ) {

        for (
            let dx = -1;
            dx <= 1;
            dx++
        ) {

            const x =
                playerX +
                dx;


            const y =
                playerY +
                dy;


            if (
                x < 0 ||
                y < 0 ||
                x >= MAP_COLUMNS ||
                y >= MAP_ROWS
            ) {
                continue;
            }


            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "dungeon-heal-range-cell";


            element.style.left =
                `${x * cellWidth}px`;


            element.style.top =
                `${y * cellHeight}px`;


            element.style.width =
                `${cellWidth}px`;


            element.style.height =
                `${cellHeight}px`;


            map.appendChild(
                element
            );


            healRangeElements.push(
                element
            );

        }

    }

}


// ============================================================
// CANCELLA AREA CURA
// ============================================================

function clearHealRange() {

    healRangeElements.forEach(
        element => {

            element.remove();

        }
    );


    healRangeElements =
        [];

}


// ============================================================
// È NEL RAGGIO DI CURA?
// ============================================================

function isInHealRange(
    x,
    y
) {

    if (
        playerX === null ||
        playerY === null
    ) {
        return false;
    }


    const dx =
        Math.abs(
            Number(x) -
            playerX
        );


    const dy =
        Math.abs(
            Number(y) -
            playerY
        );


    // Distanza Chebyshev 1:
    // comprende ortogonali e diagonali.

    return (
        dx <= 1 &&
        dy <= 1
    );

}


// ============================================================
// AGGIORNA BERSAGLI CURA
// ============================================================

function updateHealTargets() {

    clearHealTargets();


    if (!healModeActive) {
        return;
    }


    // --------------------------------------------------------
    // SE STESSI
    // --------------------------------------------------------

    if (tokenElement) {

        tokenElement.classList.add(
            "heal-target"
        );


        tokenElement.style.pointerEvents =
            "auto";

    }


    // --------------------------------------------------------
    // ALTRI PG
    // --------------------------------------------------------

    otherPlayers.forEach(
        player => {

            if (
                !isInHealRange(
                    player.x,
                    player.y
                )
            ) {
                return;
            }


            const token =
                otherPlayerTokens.get(
                    player.character_id
                );


            if (!token) {
                return;
            }


            token.classList.add(
                "heal-target"
            );


            token.style.pointerEvents =
                "auto";

        }
    );

}


// ============================================================
// PULISCE BERSAGLI CURA
// ============================================================

function clearHealTargets() {

    if (tokenElement) {

        tokenElement.classList.remove(
            "heal-target"
        );


        tokenElement.style.pointerEvents =
            "";

    }


    otherPlayerTokens.forEach(
        token => {

            token.classList.remove(
                "heal-target"
            );


            token.style.pointerEvents =
                "";

        }
    );

}


// ============================================================
// CURA SE STESSI
// ============================================================

async function castHealOnSelf() {

    if (!healModeActive) {
        return;
    }


    const stats =
        getDungeonCalculatedStats();


    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined

            ? stats.maxHealth

            : Number(
                character.current_hp
            );


    if (
        currentPF >=
        stats.maxHealth
    ) {

        setMessage(
            "Hai già tutti i PF."
        );

        return;

    }


    await executeHeal(
        character.id,
        character.nome ||
        "Avventuriero",
        currentPF,
        stats.maxHealth,
        true
    );

}


// ============================================================
// CURA ALTRO PERSONAGGIO
// ============================================================

async function castHealOnCharacter(
    targetCharacterId
) {

    if (!healModeActive) {
        return;
    }


    const target =
        otherPlayers.get(
            targetCharacterId
        );


    if (!target) {

        setMessage(
            "Il bersaglio non è più disponibile."
        );

        return;

    }


    if (
        !isInHealRange(
            target.x,
            target.y
        )
    ) {

        setMessage(
            "Il bersaglio è fuori dal raggio di Cura."
        );

        return;

    }


    // --------------------------------------------------------
    // LEGGIAMO IL PG DAL DATABASE
    //
    // Non ci fidiamo dei PF presenti nella Presence:
    // per una cura multiplayer vogliamo il dato attuale.
    // --------------------------------------------------------

    try {

        const {
            data: targetCharacter,
            error
        } =
            await db
                .from("characters")
                .select(`
                    id,
                    nome,
                    current_hp,
                    costituzione
                `)
                .eq(
                    "id",
                    targetCharacterId
                )
                .maybeSingle();


        if (error) {

            throw error;

        }


        if (!targetCharacter) {

            setMessage(
                "Il bersaglio non è più disponibile."
            );

            return;

        }


        // Per il bersaglio remoto il massimo PF preciso
        // può dipendere dall'equipaggiamento.
        // Recuperiamo quindi anche il suo equipaggiamento.

        const {
            data: targetInventory,
            error: inventoryError
        } =
            await db
                .from("character_inventory")
                .select(`
                    equipped_slot,

                    item:items (
                        costituzione_bonus
                    )
                `)
                .eq(
                    "character_id",
                    targetCharacterId
                )
                .not(
                    "equipped_slot",
                    "is",
                    null
                );


        if (inventoryError) {

            throw inventoryError;

        }


        let constitutionBonus =
            0;


        (
            targetInventory ||
            []
        ).forEach(
            entry => {

                constitutionBonus +=
                    Number(
                        entry.item?.costituzione_bonus
                    ) || 0;

            }
        );


        const effectiveConstitution =
            Math.max(
                1,
                Math.min(
                    30,
                    (
                        Number(
                            targetCharacter.costituzione
                        ) || 1
                    )
                    +
                    constitutionBonus
                )
            );


        const targetMaxHealth =
            Math.ceil(
                5 *
                effectiveConstitution /
                2
            );


        const targetCurrentHealth =
            targetCharacter.current_hp === null ||
            targetCharacter.current_hp === undefined

                ? targetMaxHealth

                : Number(
                    targetCharacter.current_hp
                );


        if (
            targetCurrentHealth >=
            targetMaxHealth
        ) {

            setMessage(
                `${targetCharacter.nome || "Il bersaglio"} ha già tutti i PF.`
            );

            return;

        }


        await executeHeal(
            targetCharacterId,
            targetCharacter.nome ||
            target.name ||
            "Alleato",
            targetCurrentHealth,
            targetMaxHealth,
            false
        );


    } catch (error) {

        console.error(
            "Errore lettura bersaglio Cura:",
            error
        );


        setMessage(
            "Non è stato possibile curare il bersaglio."
        );

    }

}


// ============================================================
// ESEGUE CURA
// ============================================================

async function executeHeal(
    targetCharacterId,
    targetName,
    targetCurrentHealth,
    targetMaxHealth,
    selfTarget
) {

    if (!character) {
        return;
    }


    const stats =
        getDungeonCalculatedStats();


    const currentMana =
        character.current_pm === null ||
        character.current_pm === undefined

            ? stats.maxMana

            : Number(
                character.current_pm
            );


    if (
        currentMana < 2
    ) {

        setMessage(
            "Non hai abbastanza PM per usare Cura."
        );


        deactivateHealMode();

        return;

    }


    // ========================================================
    // FORMULA UFFICIALE
    //
    // Cura = INT effettiva + Livello
    // ========================================================

    const level =
        Number(
            character.livello
        ) || 1;


    const healAmount =
        stats.intelligenza +
        level;


    const newHealth =
        Math.min(
            targetMaxHealth,
            targetCurrentHealth +
            healAmount
        );


    const actualHeal =
        newHealth -
        targetCurrentHealth;


    if (
        actualHeal <= 0
    ) {

        setMessage(
            `${targetName} ha già tutti i PF.`
        );

        return;

    }


    // Blocchiamo soltanto l'evento Cura,
    // non per il normale movimento.

    eventLocked =
        true;


    movementQueue.length =
        0;


    try {

        // ----------------------------------------------------
        // 1. AGGIORNA BERSAGLIO
        // ----------------------------------------------------

        const {
            error: healError
        } =
            await db
                .from("characters")
                .update({

                    current_hp:
                        newHealth

                })
                .eq(
                    "id",
                    targetCharacterId
                );


        if (healError) {

            throw healError;

        }


        // ----------------------------------------------------
        // 2. SPENDE 2 PM
        // ----------------------------------------------------

        const newMana =
            Math.max(
                0,
                currentMana - 2
            );


        const {
            error: manaError
        } =
            await db
                .from("characters")
                .update({

                    current_pm:
                        newMana

                })
                .eq(
                    "id",
                    character.id
                );


        if (manaError) {

            throw manaError;

        }


        character.current_pm =
            newMana;


        // ----------------------------------------------------
        // SE ABBIAMO CURATO NOI STESSI
        // ----------------------------------------------------

        if (selfTarget) {

            character.current_hp =
                newHealth;

        }


        updateCharacterPanel();


        // ----------------------------------------------------
        // BROADCAST CURA
        // ----------------------------------------------------

        if (
            dungeonChannel &&
            realtimeReady
        ) {

            dungeonChannel.send({

                type:
                    "broadcast",

                event:
                    "player-healed",

                payload: {

                    caster_character_id:
                        character.id,

                    caster_name:
                        character.nome ||
                        "Avventuriero",

                    target_character_id:
                        targetCharacterId,

                    target_name:
                        targetName,

                    healed_amount:
                        actualHeal,

                    new_hp:
                        newHealth

                }

            });

        }


        updateMyPresence();


        if (selfTarget) {

            setMessage(
                `Usi Cura su te stesso e recuperi ${actualHeal} PF.`
            );

        } else {

            setMessage(
                `Curi ${targetName} di ${actualHeal} PF.`
            );

        }


        deactivateHealMode();


    } catch (error) {

        console.error(
            "Errore Cura:",
            error
        );


        setMessage(
            "Non è stato possibile completare Cura."
        );


    } finally {

        eventLocked =
            false;

    }

}
// ============================================================
// TRAPPOLE DEL PIANO
// ============================================================
//
// Coordinate VISIBILI della mappa dungeon.
//
// Nessun timeout.
// Nessun cooldown.
// Nessuna dipendenza dagli oggetti di dungeonData.cells.
//
// ============================================================

const DUNGEON_TRAPS = {

    "11,11": {

        id:
            "blade_corridor",

        name:
            "LAMA",

        defenseStat:
            "destrezza",

        defenseLabel:
            "DES",

        message:
            "Una lama affilata attraversa il corridoio da muro a muro."

    },


    "9,15": {

        id:
            "acid_vapor",

        name:
            "VAPORE ACIDO",

        defenseStat:
            "resistenza",

        defenseLabel:
            "RES",

        message:
            "Dal pavimento una nube di vapore acido ti investe."

    }

};


// ============================================================
// CONTROLLO EVENTO CASELLA
// ============================================================
//
// Le celle di dungeonData.cells sono valori numerici.
// Quindi NON cerchiamo più cell.event / cell.type_event.
//
// Usiamo direttamente le coordinate visibili del PG.
//
// ============================================================

async function checkDungeonCellEvent() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return false;

    }


    const coordinateKey =
        `${Number(playerX)},${Number(playerY)}`;


    const dungeonTrap =
        DUNGEON_TRAPS[
            coordinateKey
        ];


    if (!dungeonTrap) {

        return false;

    }


    console.log(
        "TRAPPOLA RILEVATA:",
        coordinateKey,
        dungeonTrap
    );


    await triggerTrapEvent(
        dungeonTrap
    );


    return true;

}


// ============================================================
// TRAPPOLA
// ============================================================
//
// Regola definitiva:
//
// 1d10 - LCK
//
// LAMA:
// risultato contro DES
//
// ACIDO:
// risultato contro RES
//
// Se risultato > difesa:
// danno = risultato - difesa
//
// NESSUN COOLDOWN.
//
// ============================================================

async function triggerTrapEvent(
    dungeonTrap
) {

    if (
        !character ||
        !character.id ||
        !dungeonTrap
    ) {

        return;

    }


    eventLocked =
        true;


    movementQueue.length =
        0;


    try {

        const luck =
            getDungeonEffectiveAttribute(
                "fortuna"
            );


        const defense =
            getDungeonEffectiveAttribute(
                dungeonTrap.defenseStat
            );


        const roll =
            Math.floor(
                Math.random() *
                10
            ) + 1;


        const trapResult =
            roll -
            luck;


        const damage =
            Math.max(
                0,
                trapResult -
                defense
            );


        const stats =
            getDungeonCalculatedStats();


        const oldHealth =
            character.current_hp === null ||
            character.current_hp === undefined

                ? stats.maxHealth

                : Math.max(
                    0,
                    Math.min(
                        Number(
                            character.current_hp
                        ),
                        stats.maxHealth
                    )
                );


        const newHealth =
            Math.max(
                0,
                oldHealth -
                damage
            );


        console.log(
            "RISOLUZIONE TRAPPOLA:",
            {
                id:
                    dungeonTrap.id,

                coordinate:
                    `${playerX},${playerY}`,

                roll,
                luck,
                trapResult,

                defenseStat:
                    dungeonTrap.defenseStat,

                defense,
                damage,
                oldHealth,
                newHealth
            }
        );


        // ====================================================
        // NESSUN DANNO
        // ====================================================

        if (
            damage <= 0
        ) {

            setMessage(
                `${dungeonTrap.name}: ${dungeonTrap.message} ` +
                `1d10 (${roll}) - LCK ${luck} = ${trapResult} ` +
                `contro ${dungeonTrap.defenseLabel} ${defense}. ` +
                `Riesci a evitare la trappola.`
            );


            return;

        }


        // ====================================================
        // SALVA DANNO
        // ====================================================

        const {
            error: healthError
        } =
            await db
                .from(
                    "characters"
                )
                .update({

                    current_hp:
                        newHealth

                })
                .eq(
                    "id",
                    character.id
                );


        if (healthError) {

            throw healthError;

        }


        character.current_hp =
            newHealth;


        updateCharacterPanel();


        await updateMyPresence();


        setMessage(
            `${dungeonTrap.name}: ${dungeonTrap.message} ` +
            `1d10 (${roll}) - LCK ${luck} = ${trapResult} ` +
            `contro ${dungeonTrap.defenseLabel} ${defense}. ` +
            `Perdi ${damage} PF.`
        );


        // ====================================================
        // MORTE
        // ====================================================

        if (
            newHealth <= 0
        ) {

            await handleCharacterDeath();

        }


    } catch (error) {

        console.error(
            "Errore trappola:",
            error
        );


        setMessage(
            "Errore durante la risoluzione della trappola."
        );


    } finally {

        eventLocked =
            false;

    }

}


// ============================================================
// MORTE
// ============================================================

async function handleCharacterDeath() {

    if (
        !character ||
        !character.id
    ) {
        return;
    }


    eventLocked =
        true;


    movementQueue.length =
        0;


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
                "Errore untrack:",
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


        character =
            null;


        window.location.href =
            "morte.html";


    } catch (error) {

        console.error(
            "Errore eliminazione personaggio:",
            error
        );


        showError(
            "Errore durante la gestione della morte."
        );

    }

}

// ============================================================
// NEBBIA DI GUERRA
// ============================================================


// ============================================================
// INIZIALIZZAZIONE
// ============================================================

function setupFogOfWar() {

    loadExploredCellsFromCharacter();


    const map =
        document.getElementById(
            "dungeon-map"
        );


    const image =
        document.getElementById(
            "dungeon-map-image"
        );


    if (
        !map ||
        !image
    ) {

        console.error(
            "Impossibile inizializzare la nebbia: mappa non trovata."
        );

        return;

    }


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


        map.appendChild(
            fogCanvas
        );

    }


    if (!image.complete) {

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
// CARICA CELLE ESPLORATE DAL PERSONAGGIO
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
        !character ||
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


    if (discoveredSomething) {

        queueFogExplorationSave();

    }

}


// ============================================================
// CALCOLA CELLE VISIBILI
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


            // Zona di visione circolare.

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


    // La casella del PG è sempre visibile.

    visible.add(
        fogCellKey(
            playerX,
            playerY
        )
    );


    return visible;

}


// ============================================================
// RAGGIO DI VISIONE
//
// Usiamo il MOVIMENTO effettivo, quindi tiene conto anche
// dell'equipaggiamento.
// ============================================================

function getVisionRadius() {

    if (!character) {

        return 5;

    }


    return getDungeonCalculatedStats()
        .movement;

}


// ============================================================
// VALORE DELLA CELLA NEL DUNGEON.JSON
// ============================================================

function getDungeonCellValue(
    x,
    y
) {

    if (
        !dungeonData ||
        !Array.isArray(
            dungeonData.cells
        ) ||
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
        !dungeonData.cells[
            jsonY
        ] ||
        dungeonData.cells[
            jsonY
        ][
            jsonX
        ] ===
        undefined
    ) {

        return null;

    }


    const value =
        Number(
            dungeonData.cells[
                jsonY
            ][
                jsonX
            ]
        );


    return Number.isFinite(
        value
    )
        ? value
        : null;

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


    // Non controlliamo:
    //
    // - la casella iniziale
    // - la casella bersaglio
    //
    // In questo modo il muro è visibile,
    // ma ciò che si trova dietro al muro no.

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
// LINEA DI CELLE
//
// Versione "supercover":
// impedisce alla visuale di infilarsi diagonalmente
// tra due muri.
// ============================================================

function getGridLine(
    x0,
    y0,
    x1,
    y1
) {

    const cells =
        [];


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

        // Passaggio perfettamente diagonale.

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


            addCell(
                sideX,
                y
            );


            addCell(
                x,
                sideY
            );


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
// CELLA BLOCCA LA VISUALE?
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


    if (
        value === null
    ) {

        return true;

    }


    // Le zone completamente vuote/nere
    // bloccano la visuale.

    if (
        value === 0
    ) {

        return true;

    }


    const bits =
        dungeonData.cell_bit ||
        {};


    const BLOCK =
        Number(
            bits.block
        ) || 1;


    const PERIMETER =
        Number(
            bits.perimeter
        ) || 16;


    const DOOR =
        Number(
            bits.door
        ) || 131072;


    const LOCKED =
        Number(
            bits.locked
        ) || 262144;


    const SECRET =
        Number(
            bits.secret
        ) || 1048576;


    const PORTCULLIS =
        Number(
            bits.portcullis
        ) || 2097152;


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

    if (!fogCanvas) {

        return;

    }


    const map =
        document.getElementById(
            "dungeon-map"
        );


    const image =
        document.getElementById(
            "dungeon-map-image"
        );


    if (
        !map ||
        !image
    ) {

        return;

    }


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        map.getBoundingClientRect();


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


            // Visibile in questo momento.

            if (
                visibleCells.has(
                    key
                )
            ) {

                continue;

            }


            // Già visitata ma non visibile ora.

            if (
                exploredCells.has(
                    key
                )
            ) {

                context.fillStyle =
                    "rgba(0, 0, 0, 0.62)";

            }

            // Mai esplorata.

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
// CELLA ATTUALMENTE VISIBILE?
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
// VISIBILITÀ ALTRI GIOCATORI
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
                ? "flex"
                : "none";

    }

}


// ============================================================
// SALVA LE CELLE ESPLORATE
// ============================================================

function queueFogExplorationSave() {

    if (
        !character ||
        !character.id
    ) {

        return;

    }


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


    // Serializziamo i salvataggi per evitare
    // che movimenti veloci sovrascrivano uno
    // stato di esplorazione più recente.

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
                                    snapshot

                            })
                            .eq(
                                "id",
                                character.id
                            );


                    if (error) {

                        console.error(
                            "Errore salvataggio nebbia:",
                            error
                        );

                    }

                }
            )
            .catch(
                error => {

                    console.error(
                        "Errore coda nebbia:",
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
// NOTE
// ============================================================

function setupNotes() {

    const notes =
        document.getElementById(
            "character-notes"
        );


    const button =
        document.getElementById(
            "save-notes-button"
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
// CHAT
// ============================================================

function setupFloorChat() {

    const input =
        document.getElementById(
            "floor-chat-input"
        );


    const button =
        document.getElementById(
            "floor-chat-send"
        );


    if (
        !input ||
        !button
    ) {
        return;
    }


    button.addEventListener(
        "click",
        async () => {

            await sendFloorChatMessage(
                input
            );

        }
    );


    input.addEventListener(
        "keydown",
        async event => {

            if (
                event.key !== "Enter"
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
// INVIA CHAT
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


    const messageText =
        input.value.trim();


    if (!messageText) {
        return;
    }


    const message = {

        character_id:
            character.id,

        name:
            character.nome ||
            "Avventuriero",

        text:
            messageText,

        timestamp:
            new Date()
                .toISOString()

    };


    // Mostra immediatamente a chi scrive.

    addFloorChatMessage(
        message
    );


    input.value =
        "";


    // ========================================================
    // BROADCAST
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
// MOSTRA CHAT
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
        );


    if (!container) {
        return;
    }


    // ========================================================
    // PLACEHOLDER
    // ========================================================

    const placeholder =
        container.querySelector(
            ".chat-placeholder"
        );


    if (placeholder) {

        placeholder.remove();

    }


    // ========================================================
    // MESSAGGIO
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


    const name =
        document.createElement(
            "strong"
        );


    name.className =
        "floor-chat-name";


    name.textContent =
        message.name ||
        "Avventuriero";


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
// REFRESH PERSONAGGIO
// ============================================================
//
// IMPORTANTE:
//
// Il refresh NON deve mai modificare playerX/playerY.
//
// La posizione locale della pedina resta quella gestita
// dal nuovo sistema di movimento.
//
// ============================================================

async function refreshDungeonCharacter() {

    if (
        !character ||
        !currentUser ||
        eventLocked
    ) {
        return;
    }


    try {

        const currentCharacterId =
            character.id;


        const {
            data,
            error
        } =
            await db
                .from("characters")
                .select("*")
                .eq(
                    "id",
                    currentCharacterId
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


        // ====================================================
        // CONSERVIAMO POSIZIONE LOCALE
        // ====================================================

        const localX =
            playerX;


        const localY =
            playerY;


        character =
            data;


        // NON prendiamo dungeon_x / dungeon_y dal refresh.
        // Potrebbero essere leggermente indietro rispetto
        // alla posizione visiva attuale.

        character.dungeon_x =
            localX;


        character.dungeon_y =
            localY;


        await loadCharacterEquipment();


        updateCharacterPanel();


    } catch (error) {

        console.error(
            "Errore refresh personaggio:",
            error
        );

    }

}


// ============================================================
// REFRESH PERIODICO
// ============================================================

function startDungeonCharacterRefresh() {

    stopDungeonCharacterRefresh();


    dungeonCharacterRefreshInterval =
        setInterval(
            async () => {

                await refreshDungeonCharacter();

            },
            5000
        );

}


// ============================================================
// STOP REFRESH
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
// VISIBILITÀ PAGINA
// ============================================================

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState !==
            "visible"
        ) {
            return;
        }


        await refreshDungeonCharacter();


        repositionAllTokens();

    }
);


// ============================================================
// FOCUS
// ============================================================

window.addEventListener(
    "focus",
    async () => {

        await refreshDungeonCharacter();


        repositionAllTokens();

    }
);


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


    if (!element) {
        return;
    }


    element.classList.remove(
        "error"
    );


    element.textContent =
        text;

}


// ============================================================
// ERRORE
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
// SALVATAGGIO PRIMA DI USCIRE
// ============================================================

async function savePositionBeforeExit() {

    if (
        !character ||
        playerX === null ||
        playerY === null
    ) {
        return;
    }


    try {

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


    } catch (error) {

        console.error(
            "Errore salvataggio finale posizione:",
            error
        );

    }

}


// ============================================================
// PULSANTE ESCI
// ============================================================
//
// Intercettiamo il pulsante ESCI per tentare di salvare
// l'ultima posizione prima di cambiare pagina.
//
// ============================================================

document.addEventListener(
    "click",
    async event => {

        const exitButton =
            event.target.closest(
                ".dungeon-exit-button"
            );


        if (!exitButton) {
            return;
        }


        const href =
            exitButton.getAttribute(
                "href"
            );


        if (!href) {
            return;
        }


        event.preventDefault();


        movementQueue.length =
            0;


        await flushPositionSave();

        await savePositionBeforeExit();


        window.location.href =
            href;

    }
);


// ============================================================
// USCITA DALLA PAGINA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        stopDungeonCharacterRefresh();


        // Se esiste ancora un timer di salvataggio
        // lo annulliamo.

        if (positionSaveTimer) {

            clearTimeout(
                positionSaveTimer
            );

            positionSaveTimer =
                null;

        }


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
        // CANALE
        // ====================================================

        if (dungeonChannel) {

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
