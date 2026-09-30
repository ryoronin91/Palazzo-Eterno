// ============================================================
// PALAZZO ETERNO
// BASE.JS
//
// Prima versione del "Livello Base".
// Mantiene lo stile e i dati del personaggio del dungeon,
// ma NON modifica dungeon_x / dungeon_y e non introduce ancora
// logiche di movimento, eventi o combattimento.
// ============================================================

console.log("BASE.JS CARICATO");

const db = supabaseClient;

const BASE_MAP_COLUMNS = 27;
const BASE_MAP_ROWS = 36;

const BASE_CAMERA_RADIUS = 6;
const BASE_CAMERA_VISIBLE_CELLS =
    BASE_CAMERA_RADIUS * 2 + 1;

const BASE_CAMERA_TRANSITION_MS = 170;

let currentUser = null;
let character = null;
let baseData = null;
let baseWalkableCells = new Set();


// ============================================================
// DATABASE / REALTIME LIVELLO BASE
// ============================================================

let basePositionSaveTimer = null;
let basePositionSaveRunning = false;
let basePositionSavePending = false;

let baseChannel = null;
let baseRealtimeReady = false;

const BASE_CHANNEL_NAME =
    "palazzo-eterno-base";

const BASE_CHAT_FLOOR_ID =
    "base";

const BASE_CHAT_HISTORY_LIMIT =
    100;

const renderedBaseChatMessageIds =
    new Set();

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

document.addEventListener("DOMContentLoaded", async () => {
    try {
        setMessage("Caricamento del Livello Base...");

        setupBaseVolumeControl();

        await loadBaseMapDefinition();
        await loadCharacter();
        await loadCharacterEquipment();

        updateCharacterPanel();

        // ----------------------------------------------------
        // CADUTI DEL PALAZZO
        // ----------------------------------------------------

        await loadBaseLeaderboard();

        // ----------------------------------------------------
        // CHAT
        // ----------------------------------------------------

        setupBaseChat();
        await loadBaseChatHistory();

        // ----------------------------------------------------
        // POSIZIONE PERSISTENTE
        // ----------------------------------------------------

        await initializeBasePlayer();

        setupBaseCamera();
        setupBaseMovement();

        // ----------------------------------------------------
        // PERSONAGGI ONLINE / REALTIME
        // ----------------------------------------------------

        await setupBaseRealtime();

        setMessage(
            "Livello Base caricato."
        );
    } catch (error) {
        console.error("Errore avvio Livello Base:", error);
        setMessage(
            error?.message ||
            "Errore durante il caricamento del Livello Base.",
            true
        );
    }
});

async function loadBaseMapDefinition() {
    const response = await fetch("base.json", {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error("Impossibile caricare base.json.");
    }

    const data = await response.json();

    baseData = data;

    baseWalkableCells =
        new Set(
            (
                Array.isArray(data?.walkable_cells)
                    ? data.walkable_cells
                    : []
            )
                .map(
                    cell =>
                        `${Number(cell.x)},${Number(cell.y)}`
                )
        );

    const columns =
        Number(data?.grid?.columns) ||
        BASE_MAP_COLUMNS;

    const rows =
        Number(data?.grid?.rows) ||
        BASE_MAP_ROWS;

    if (
        columns !== BASE_MAP_COLUMNS ||
        rows !== BASE_MAP_ROWS
    ) {
        console.warn(
            `La mappa Base dichiara ${columns}x${rows}; ` +
            `la pagina è configurata per ${BASE_MAP_COLUMNS}x${BASE_MAP_ROWS}.`
        );
    }

    console.log("Definizione Livello Base caricata:", data);
}

async function loadCharacter() {
    const {
        data: { user },
        error: authError
    } = await db.auth.getUser();

    if (authError) {
        throw authError;
    }

    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

    const { data, error } = await db
        .from("characters")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        window.location.href = "../personaggio.html";
        return;
    }

    character = data;
}

async function loadCharacterEquipment() {
    if (!character) {
        return;
    }

    const { data, error } = await db
        .from("character_inventory")
        .select(`
            equipped_slot,
            item:items (
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
        .eq("character_id", character.id);

    if (error) {
        console.warn(
            "Equipaggiamento non disponibile nel Livello Base:",
            error
        );
        return;
    }

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

    (data || [])
        .filter(entry => entry.equipped_slot && entry.item)
        .forEach(entry => {
            const item = entry.item;

            Object.keys(equipmentBonuses).forEach(key => {
                equipmentBonuses[key] +=
                    Number(item?.[key]) || 0;
            });
        });
}

function getEffectiveAttribute(attribute) {
    const base = Number(character?.[attribute]) || 1;
    const bonus =
        Number(
            equipmentBonuses[
                `${attribute}_bonus`
            ]
        ) || 0;

    return Math.max(
        1,
        Math.min(30, base + bonus)
    );
}

function getCalculatedStats() {
    const forza = getEffectiveAttribute("forza");
    const resistenza = getEffectiveAttribute("resistenza");
    const costituzione = getEffectiveAttribute("costituzione");
    const intelligenza = getEffectiveAttribute("intelligenza");
    const destrezza = getEffectiveAttribute("destrezza");
    const fortuna = getEffectiveAttribute("fortuna");

    return {
        forza,
        resistenza,
        costituzione,
        intelligenza,
        destrezza,
        fortuna,

        attack:
            Math.ceil(forza / 2) +
            (Number(equipmentBonuses.attack_bonus) || 0),

        defense:
            Math.ceil(7 + resistenza / 2) +
            (Number(equipmentBonuses.defense_bonus) || 0),

        maxHealth:
            Math.ceil(5 * costituzione / 2),

        maxMana:
            Math.ceil(5 * intelligenza / 2),

        movement:
            Math.ceil(4 + destrezza / 2),

        critical:
            Math.round(
                fortuna * (50 / 30) * 100
            ) / 100
    };
}

function updateCharacterPanel() {
    if (!character) {
        return;
    }

    const stats = getCalculatedStats();
    const name =
        character.nome ||
        "Avventuriero";

    setText("character-name", name);
    setText("character-name-panel", name);
    setText(
        "character-level",
        Number(character.livello) || 1
    );

    const portrait =
        document.getElementById("character-token");

    if (portrait) {
        portrait.src =
            "../immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );

        portrait.alt =
            `Token di ${name}`;
    }

    setText("forza-display", stats.forza);
    setText("resistenza-display", stats.resistenza);
    setText("costituzione-display", stats.costituzione);
    setText("intelligenza-display", stats.intelligenza);
    setText("destrezza-display", stats.destrezza);
    setText("fortuna-display", stats.fortuna);

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined
            ? stats.maxHealth
            : Math.max(
                0,
                Math.min(
                    Number(character.current_hp),
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
                    Number(character.current_pm),
                    stats.maxMana
                )
            );

    setText("attack-display", stats.attack);
    setText("defense-display", stats.defense);
    setText(
        "health-display",
        `${currentPF}/${stats.maxHealth}`
    );
    setText(
        "mana-display",
        `${currentPM}/${stats.maxMana}`
    );
    setText("movement-display", stats.movement);
    setText(
        "critical-display",
        `${stats.critical.toFixed(2)}%`
    );
}

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function setMessage(text, error = false) {
    const element =
        document.getElementById(
            "dungeon-message"
        );

    if (!element) {
        return;
    }

    element.textContent = text;
    element.classList.toggle(
        "error",
        !!error
    );
}


// ============================================================
// POSIZIONE PG - TEST LIVELLO BASE
// ============================================================
//
// Per questa prima prova NON salviamo nulla in Supabase.
// La posizione del dungeon principale resta quindi intatta.
//
// La mappa Base usa una griglia 27 x 36.
// ============================================================

const BASE_INITIAL_PLAYER_X = 12;
const BASE_INITIAL_PLAYER_Y = 19;

let basePlayerX = BASE_INITIAL_PLAYER_X;
let basePlayerY = BASE_INITIAL_PLAYER_Y;
let basePlayerToken = null;


// ============================================================
// CREA E POSIZIONA IL TOKEN
// ============================================================

async function initializeBasePlayer() {
    const map =
        document.getElementById("dungeon-map");

    if (
        !map ||
        !character
    ) {
        return;
    }


    // --------------------------------------------------------
    // POSIZIONE SALVATA NEL DATABASE
    // --------------------------------------------------------

    const storedX =
        Number(character.base_x);

    const storedY =
        Number(character.base_y);

    const storedPositionValid =
        Number.isInteger(storedX) &&
        Number.isInteger(storedY) &&
        storedX >= 0 &&
        storedY >= 0 &&
        storedX < BASE_MAP_COLUMNS &&
        storedY < BASE_MAP_ROWS &&
        isBaseCellWalkable(
            storedX,
            storedY
        );


    if (storedPositionValid) {

        basePlayerX =
            storedX;

        basePlayerY =
            storedY;

    } else {

        basePlayerX =
            BASE_INITIAL_PLAYER_X;

        basePlayerY =
            BASE_INITIAL_PLAYER_Y;


        character.base_x =
            basePlayerX;

        character.base_y =
            basePlayerY;


        const {
            error
        } =
            await db
                .from("characters")
                .update({

                    base_x:
                        basePlayerX,

                    base_y:
                        basePlayerY

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }

    }


    // --------------------------------------------------------
    // TOKEN DEL PERSONAGGIO
    // --------------------------------------------------------

    if (!basePlayerToken) {
        basePlayerToken =
            document.createElement("div");

        basePlayerToken.className =
            "dungeon-player-token base-player-token";

        basePlayerToken.dataset.characterId =
            character.id;

        const image =
            document.createElement("img");

        image.src =
            "../immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );

        image.alt =
            character.nome ||
            "Personaggio";

        image.draggable = false;

        basePlayerToken.appendChild(image);
        map.appendChild(basePlayerToken);
    }

    positionBasePlayerToken();
    updateBaseCoordinates();
}



// ============================================================
// POSIZIONA TOKEN SULLA GRIGLIA 27 x 36
// ============================================================

function positionBasePlayerToken() {
    const map =
        document.getElementById("dungeon-map");

    if (
        !map ||
        !basePlayerToken
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
        BASE_MAP_COLUMNS;

    const cellHeight =
        rect.height /
        BASE_MAP_ROWS;

    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) * 0.88;

    basePlayerToken.style.width =
        `${tokenSize}px`;

    basePlayerToken.style.height =
        `${tokenSize}px`;

    basePlayerToken.style.left =
        `${
            (
                basePlayerX +
                0.5
            ) *
            cellWidth -
            tokenSize / 2
        }px`;

    basePlayerToken.style.top =
        `${
            (
                basePlayerY +
                0.5
            ) *
            cellHeight -
            tokenSize / 2
        }px`;
}


// ============================================================
// COORDINATE A SCHERMO
// ============================================================

function updateBaseCoordinates() {
    const element =
        document.getElementById(
            "dungeon-player-coordinates"
        );

    if (!element) {
        return;
    }

    element.textContent =
        `Coordinate PG: X ${basePlayerX} · Y ${basePlayerY}`;
}


// ============================================================
// MOVIMENTO TEST
// ============================================================

function setupBaseMovement() {
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

            if (event.repeat) {
                return;
            }

            moveBasePlayer(dx, dy);
        }
    );

    const map =
        document.getElementById("dungeon-map");

    if (map) {
        map.addEventListener(
            "click",
            event => {
                const rect =
                    map.getBoundingClientRect();

                const cellWidth =
                    rect.width /
                    BASE_MAP_COLUMNS;

                const cellHeight =
                    rect.height /
                    BASE_MAP_ROWS;

                const clickedX =
                    Math.floor(
                        (
                            event.clientX -
                            rect.left
                        ) /
                        cellWidth
                    );

                const clickedY =
                    Math.floor(
                        (
                            event.clientY -
                            rect.top
                        ) /
                        cellHeight
                    );

                const dx =
                    clickedX -
                    basePlayerX;

                const dy =
                    clickedY -
                    basePlayerY;

                if (
                    Math.abs(dx) +
                    Math.abs(dy) !==
                    1
                ) {
                    return;
                }

                moveBasePlayer(dx, dy);
            }
        );
    }

    window.addEventListener(
        "resize",
        () => {
            updateBaseCamera(true);
            positionBasePlayerToken();
        }
    );
}


// ============================================================
// CAMERA LIVELLO BASE
// ============================================================
//
// Come nel dungeon principale:
// visuale di 13 x 13 caselle, cioè PG + 6 celle per lato.
// La mappa completa continua ad avere coordinate 27 x 36.
// ============================================================

function setupBaseCamera() {
    updateBaseCamera(true);
}


function updateBaseCamera(instant = false) {
    const frame =
        document.querySelector(
            ".dungeon-map-frame"
        );

    const map =
        document.getElementById(
            "dungeon-map"
        );

    if (
        !frame ||
        !map ||
        basePlayerX === null ||
        basePlayerY === null
    ) {
        return;
    }

    const frameRect =
        frame.getBoundingClientRect();

    const mapRect =
        map.getBoundingClientRect();

    if (
        frameRect.width <= 0 ||
        frameRect.height <= 0 ||
        mapRect.width <= 0 ||
        mapRect.height <= 0
    ) {
        return;
    }

    const cellWidth =
        mapRect.width /
        BASE_MAP_COLUMNS;

    const cellHeight =
        mapRect.height /
        BASE_MAP_ROWS;

    const playerCenterX =
        (
            Number(basePlayerX) +
            0.5
        ) *
        cellWidth;

    const playerCenterY =
        (
            Number(basePlayerY) +
            0.5
        ) *
        cellHeight;

    let cameraX =
        playerCenterX -
        frameRect.width / 2;

    let cameraY =
        playerCenterY -
        frameRect.height / 2;

    const maxCameraX =
        Math.max(
            0,
            mapRect.width -
            frameRect.width
        );

    const maxCameraY =
        Math.max(
            0,
            mapRect.height -
            frameRect.height
        );

    cameraX =
        Math.max(
            0,
            Math.min(
                cameraX,
                maxCameraX
            )
        );

    cameraY =
        Math.max(
            0,
            Math.min(
                cameraY,
                maxCameraY
            )
        );

    map.style.transition =
        instant
            ? "none"
            : `transform ${BASE_CAMERA_TRANSITION_MS}ms ease-out`;

    map.style.transform =
        `translate(${-cameraX}px, ${-cameraY}px)`;

    if (instant) {
        requestAnimationFrame(
            () => {
                map.style.transition =
                    `transform ${BASE_CAMERA_TRANSITION_MS}ms ease-out`;
            }
        );
    }
}


// ============================================================
// COLLISIONI LIVELLO BASE
// ============================================================

function isBaseCellWalkable(x, y) {
    if (
        !baseData ||
        !(baseWalkableCells instanceof Set)
    ) {
        return false;
    }

    return baseWalkableCells.has(
        `${Number(x)},${Number(y)}`
    );
}


// ============================================================
// PASSAGGI BLOCCATI TRA CELLE
// ============================================================
//
// I primi quattro passaggi sono bloccati in entrambe le direzioni.
// Il passaggio X18 Y10 -> X18 Y9 è invece bloccato SOLO in quella
// direzione: da X18 Y9 a X18 Y10 rimane consentito.
// ============================================================

const BASE_BLOCKED_EDGES_BIDIRECTIONAL =
    new Set([
        "7,10|7,9",
        "8,9|8,10",
        "10,10|10,9",
        "11,9|11,10"
    ]);


const BASE_BLOCKED_EDGES_ONE_WAY =
    new Set();


function isBasePassageBlocked(
    fromX,
    fromY,
    toX,
    toY
) {

    const directKey =
        `${fromX},${fromY}|${toX},${toY}`;

    const reverseKey =
        `${toX},${toY}|${fromX},${fromY}`;


    if (
        BASE_BLOCKED_EDGES_ONE_WAY.has(
            directKey
        )
    ) {

        return true;

    }


    return (
        BASE_BLOCKED_EDGES_BIDIRECTIONAL.has(
            directKey
        )
        ||
        BASE_BLOCKED_EDGES_BIDIRECTIONAL.has(
            reverseKey
        )
    );
}


// ============================================================
// ESEGUE UN PASSO
// ============================================================

function moveBasePlayer(dx, dy) {
    const newX =
        basePlayerX + dx;

    const newY =
        basePlayerY + dy;

    if (
        newX < 0 ||
        newY < 0 ||
        newX >= BASE_MAP_COLUMNS ||
        newY >= BASE_MAP_ROWS
    ) {
        setMessage(
            "Non puoi andare oltre i confini del Livello Base."
        );

        return false;
    }

    // ========================================================
    // CANCELLO A SENSO UNICO X18 Y10 -> X18 Y9
    // ========================================================

    if (
        basePlayerX === 18 &&
        basePlayerY === 10 &&
        newX === 18 &&
        newY === 9
    ) {
        setMessage(
            "Questo cancello si può attraversare solo dall'altro lato"
        );

        return false;
    }


    if (
        isBasePassageBlocked(
            basePlayerX,
            basePlayerY,
            newX,
            newY
        )
    ) {
        setMessage(
            "Il passaggio è bloccato."
        );

        return false;
    }

    // ========================================================
    // CANCELLO CENTRALE X9 Y9 <-> X9 Y10
    //
    // Il passaggio è bloccato finché almeno uno dei due combat
    // Base è disponibile. La funzione vive in eventi_base.js.
    // ========================================================

    const crossesBaseGate =
        (
            basePlayerX === 9 &&
            basePlayerY === 9 &&
            newX === 9 &&
            newY === 10
        )
        ||
        (
            basePlayerX === 9 &&
            basePlayerY === 10 &&
            newX === 9 &&
            newY === 9
        );

    if (
        crossesBaseGate &&
        typeof isBaseFilterBlocked === "function" &&
        isBaseFilterBlocked()
    ) {
        setMessage(
            "Il cancello è chiuso. Si aprirà quando non ci saranno nemici nelle vicinanze"
        );

        return false;
    }

    if (
        !isBaseCellWalkable(
            newX,
            newY
        )
    ) {
        setMessage(
            "Il passaggio è bloccato."
        );

        return false;
    }

    basePlayerX = newX;
    basePlayerY = newY;

    positionBasePlayerToken();
    updateBaseCoordinates();
    updateBaseCamera();

    scheduleBasePositionSave();
    updateBasePresence();

    if (
        typeof checkNearbyBaseCombatEvents ===
        "function"
    ) {
        checkNearbyBaseCombatEvents();
    }

    if (
        typeof checkBaseTeleportEvent ===
        "function"
    ) {
        checkBaseTeleportEvent();
    }

    setMessage(
        `Ti muovi nel Livello Base. X ${basePlayerX} · Y ${basePlayerY}`
    );

    return true;
}


// ============================================================
// SALVATAGGIO POSIZIONE BASE
// ============================================================

function scheduleBasePositionSave() {

    basePositionSavePending =
        true;


    if (
        basePositionSaveTimer
    ) {

        clearTimeout(
            basePositionSaveTimer
        );

    }


    basePositionSaveTimer =
        setTimeout(
            () => {

                flushBasePositionSave();

            },
            120
        );

}


// ============================================================
// SALVA ULTIMA POSIZIONE NEL DATABASE
// ============================================================

async function flushBasePositionSave() {

    if (
        !character ||
        basePlayerX === null ||
        basePlayerY === null
    ) {

        return;

    }


    if (
        basePositionSaveRunning
    ) {

        basePositionSavePending =
            true;

        return;

    }


    basePositionSaveRunning =
        true;

    basePositionSavePending =
        false;


    const saveX =
        Number(basePlayerX);

    const saveY =
        Number(basePlayerY);


    try {

        const {
            error
        } =
            await db
                .from("characters")
                .update({

                    base_x:
                        saveX,

                    base_y:
                        saveY

                })
                .eq(
                    "id",
                    character.id
                );


        if (error) {

            throw error;

        }


        character.base_x =
            saveX;

        character.base_y =
            saveY;


    } catch (error) {

        console.error(
            "Errore salvataggio posizione Base:",
            error
        );


        setMessage(
            "Movimento effettuato, ma la posizione non è stata salvata."
        );


    } finally {

        basePositionSaveRunning =
            false;


        if (
            basePositionSavePending ||
            saveX !== basePlayerX ||
            saveY !== basePlayerY
        ) {

            flushBasePositionSave();

        }

    }

}


// ============================================================
// VOLUME
// ============================================================

const BASE_VOLUME_KEY =
    "palazzo-eterno-base-volume";

let baseVolume =
    loadBaseVolume();

let baseMusic = null;

function loadBaseVolume() {
    try {
        const saved =
            localStorage.getItem(
                BASE_VOLUME_KEY
            );

        const value =
            Number(saved);

        return Number.isFinite(value)
            ? Math.max(
                0,
                Math.min(1, value)
            )
            : 0.35;

    } catch {
        return 0.35;
    }
}

function volumeIcon(volume) {
    if (volume <= 0) return "🔇";
    if (volume < 0.5) return "🔉";
    return "🔊";
}

function setupBaseVolumeControl() {
    const control =
        document.querySelector(
            ".dungeon-volume-control"
        );

    const button =
        document.getElementById(
            "dungeon-volume-button"
        );

    const popover =
        document.getElementById(
            "dungeon-volume-popover"
        );

    const slider =
        document.getElementById(
            "dungeon-volume-slider"
        );

    const value =
        document.getElementById(
            "dungeon-volume-value"
        );

    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {
        return;
    }

    const updateUI = () => {
        const percentage =
            Math.round(baseVolume * 100);

        button.textContent =
            volumeIcon(baseVolume);

        slider.value =
            String(percentage);

        if (value) {
            value.textContent =
                `${percentage}%`;
        }

        if (baseMusic) {
            baseMusic.volume =
                baseVolume;
        }
    };

    updateUI();

    button.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            popover.hidden =
                !popover.hidden;

            button.setAttribute(
                "aria-expanded",
                popover.hidden
                    ? "false"
                    : "true"
            );
        }
    );

    slider.addEventListener(
        "input",
        () => {
            baseVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(slider.value) / 100
                    )
                );

            try {
                localStorage.setItem(
                    BASE_VOLUME_KEY,
                    String(baseVolume)
                );
            } catch {}

            updateUI();
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                control.contains(
                    event.target
                )
            ) {
                return;
            }

            popover.hidden = true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}


// ============================================================
// CADUTI DEL PALAZZO
// ============================================================

async function loadBaseLeaderboard() {

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
                "get_dead_characters_leaderboard_with_badges",
                {
                    p_limit:
                        20
                }
            );


        if (error) {

            throw error;

        }


        renderBaseLeaderboard(
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


function renderBaseLeaderboard(
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
                        escapeBaseHtml(
                            row.character_name ||
                            "Avventuriero"
                        );


                    const badges =
                        Array.isArray(
                            row.boss_badges
                        )
                            ? row.boss_badges
                            : [];


                    const badgesHtml =
                        badges
                            .map(
                                badge => {

                                    const badgeName =
                                        escapeBaseHtml(
                                            badge?.badge_name ||
                                            badge?.display_name ||
                                            "Boss sconfitto"
                                        );


                                    let iconPath =
                                        String(
                                            badge?.icon_path ||
                                            ""
                                        );


                                    // Le icone salvate come "immagini/..."
                                    // sono relative alla root del gioco.
                                    // Base si trova una cartella più in basso.
                                    if (
                                        iconPath.startsWith(
                                            "immagini/"
                                        )
                                    ) {

                                        iconPath =
                                            "../" +
                                            iconPath;

                                    }


                                    iconPath =
                                        escapeBaseHtml(
                                            iconPath
                                        );


                                    const floorNumber =
                                        Number(
                                            badge?.floor_number
                                        ) || 0;


                                    const title =
                                        floorNumber > 0
                                            ? `${badgeName} · Piano ${floorNumber}`
                                            : badgeName;


                                    if (!iconPath) {

                                        return `
                                            <span
                                                class="dungeon-leaderboard-badge dungeon-leaderboard-badge-fallback"
                                                title="${title}"
                                            >
                                                🛡
                                            </span>
                                        `;

                                    }


                                    return `
                                        <span
                                            class="dungeon-leaderboard-badge-wrap"
                                            title="${title}"
                                        >
                                            <img
                                                class="dungeon-leaderboard-badge"
                                                src="${iconPath}"
                                                alt="${badgeName}"
                                                loading="lazy"
                                                onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
                                            >
                                            <span
                                                class="dungeon-leaderboard-badge dungeon-leaderboard-badge-fallback"
                                                style="display:none"
                                                aria-hidden="true"
                                            >
                                                🛡
                                            </span>
                                        </span>
                                    `;

                                }
                            )
                            .join("");


                    return `
                        <div class="dungeon-leaderboard-row">

                            <div class="dungeon-leaderboard-position">
                                #${position}
                            </div>

                            <div class="dungeon-leaderboard-identity">

                                <div
                                    class="dungeon-leaderboard-name"
                                    title="${name}"
                                >
                                    ${name}
                                </div>

                                ${
                                    badgesHtml
                                        ? `
                                            <div class="dungeon-leaderboard-badges">
                                                ${badgesHtml}
                                            </div>
                                        `
                                        : ""
                                }

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
// REALTIME / PERSONAGGI ONLINE
// ============================================================

async function setupBaseRealtime() {

    if (
        !character ||
        !currentUser
    ) {

        return;

    }


    baseChannel =
        db.channel(
            BASE_CHANNEL_NAME,
            {
                config: {
                    presence: {
                        key:
                            character.id
                    }
                }
            }
        );


    baseChannel.on(
        "presence",
        {
            event:
                "sync"
        },
        () => {

            renderBaseOnlinePlayers();

        }
    );


    baseChannel.on(
        "broadcast",
        {
            event:
                "base-chat"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            addBaseChatMessage(
                data
            );

        }
    );


    await new Promise(
        (
            resolve,
            reject
        ) => {

            baseChannel.subscribe(
                async status => {

                    console.log(
                        "Realtime Base:",
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        baseRealtimeReady =
                            true;


                        try {

                            await baseChannel.track(
                                getMyBasePresenceData()
                            );


                            renderBaseOnlinePlayers();

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
                                "Errore nel canale realtime del Livello Base."
                            )
                        );

                    }

                }
            );

        }
    );

}


function getMyBasePresenceData() {

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
            Number(basePlayerX),

        y:
            Number(basePlayerY),

        current_hp:
            character.current_hp,

        active_combat_id:
            character.active_combat_id ||
            null,

        in_combat:
            !!character.active_combat_id,

        location:
            "base",

        online_at:
            new Date()
                .toISOString()

    };

}


async function updateBasePresence() {

    if (
        !baseChannel ||
        !baseRealtimeReady ||
        !character
    ) {

        return;

    }


    try {

        await baseChannel.track(
            getMyBasePresenceData()
        );


    } catch (error) {

        console.error(
            "Errore aggiornamento Presence Base:",
            error
        );

    }

}


function renderBaseOnlinePlayers() {

    const container =
        document.getElementById(
            "dungeon-online-list"
        );


    if (!container) {

        return;

    }


    if (
        !baseChannel ||
        !character
    ) {

        container.innerHTML =
            `
                <div class="dungeon-online-empty">
                    Connessione...
                </div>
            `;

        return;

    }


    const state =
        baseChannel.presenceState();


    const playersById =
        new Map();


    Object.values(
        state
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence ||
                        !presence.character_id
                    ) {

                        return;

                    }


                    const previous =
                        playersById.get(
                            presence.character_id
                        );


                    if (
                        !previous ||
                        String(
                            presence.online_at ||
                            ""
                        ) >=
                        String(
                            previous.online_at ||
                            ""
                        )
                    ) {

                        playersById.set(
                            presence.character_id,
                            presence
                        );

                    }

                }
            );

        }
    );


    if (
        character.id &&
        !playersById.has(
            character.id
        )
    ) {

        playersById.set(
            character.id,
            getMyBasePresenceData()
        );

    }


    const players =
        Array.from(
            playersById.values()
        )
            .sort(
                (
                    a,
                    b
                ) => {

                    const aIsMe =
                        a.character_id ===
                        character.id;

                    const bIsMe =
                        b.character_id ===
                        character.id;


                    if (
                        aIsMe !==
                        bIsMe
                    ) {

                        return aIsMe
                            ? -1
                            : 1;

                    }


                    return String(
                        a.name ||
                        ""
                    ).localeCompare(
                        String(
                            b.name ||
                            ""
                        ),
                        "it"
                    );

                }
            );


    if (
        players.length ===
        0
    ) {

        container.innerHTML =
            `
                <div class="dungeon-online-empty">
                    Nessun personaggio online.
                </div>
            `;

        return;

    }


    container.replaceChildren();


    players.forEach(
        player => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "dungeon-online-row";


            const image =
                document.createElement(
                    "img"
                );


            image.className =
                "dungeon-online-token";


            image.src =
                "../immagini/token/" +
                (
                    player.token ||
                    "token_1.png"
                );


            image.alt =
                player.name ||
                "Personaggio";


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "dungeon-online-info";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "dungeon-online-name";


            const isMe =
                player.character_id ===
                character.id;


            name.textContent =
                `${
                    player.name ||
                    "Avventuriero"
                }${
                    isMe
                        ? " (tu)"
                        : ""
                }`;


            const status =
                document.createElement(
                    "div"
                );


            status.className =
                "dungeon-online-status";


            status.textContent =
                "Nel Livello Base";


            const dot =
                document.createElement(
                    "span"
                );


            dot.className =
                "dungeon-online-dot";


            info.append(
                name,
                status
            );


            row.append(
                image,
                info,
                dot
            );


            container.appendChild(
                row
            );

        }
    );

}


// ============================================================
// CHAT LIVELLO BASE
// ============================================================

function setupBaseChat() {

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


    // base.html nasceva con la chat disabilitata.
    // La abilitiamo ora che è collegata al database.
    input.disabled =
        false;

    button.disabled =
        false;

    input.placeholder =
        "Scrivi...";


    button.addEventListener(
        "click",
        async () => {

            await sendBaseChatMessage(
                input
            );

        }
    );


    input.addEventListener(
        "keydown",
        async event => {

            if (
                event.key !==
                "Enter" ||
                event.shiftKey
            ) {

                return;

            }


            event.preventDefault();


            await sendBaseChatMessage(
                input
            );

        }
    );

}


async function loadBaseChatHistory() {

    const container =
        document.getElementById(
            "floor-chat-messages"
        );


    if (!container) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .select(`
                    id,
                    character_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .eq(
                    "floor_id",
                    BASE_CHAT_FLOOR_ID
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    BASE_CHAT_HISTORY_LIMIT
                );


        if (error) {

            throw error;

        }


        renderedBaseChatMessageIds.clear();


        container.innerHTML =
            "";


        const rows =
            Array.isArray(data)
                ? [...data]
                : [];


        if (
            rows.length ===
            0
        ) {

            container.innerHTML =
                `
                    <div class="chat-placeholder">
                        Nessun messaggio ancora.
                    </div>
                `;

            return;

        }


        rows.forEach(
            row => {

                addBaseChatMessage(
                    {

                        id:
                            row.id,

                        character_id:
                            row.character_id,

                        name:
                            row.sender_name,

                        text:
                            row.message_text,

                        timestamp:
                            row.created_at

                    },
                    true
                );

            }
        );


    } catch (error) {

        console.error(
            "Errore caricamento storico chat Base:",
            error
        );

    }

}


async function sendBaseChatMessage(
    input
) {

    if (
        !input ||
        !character ||
        !currentUser
    ) {

        return;

    }


    const messageText =
        input.value.trim();


    if (!messageText) {

        return;

    }


    const originalValue =
        input.value;


    input.value =
        "";


    try {

        const {
            data: savedMessage,
            error
        } =
            await db
                .from(
                    "dungeon_chat_messages"
                )
                .insert({

                    floor_id:
                        BASE_CHAT_FLOOR_ID,

                    character_id:
                        character.id,

                    user_id:
                        currentUser.id,

                    sender_name:
                        character.nome ||
                        "Avventuriero",

                    message_text:
                        messageText

                })
                .select(`
                    id,
                    character_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .single();


        if (error) {

            throw error;

        }


        const message = {

            id:
                savedMessage.id,

            character_id:
                savedMessage.character_id,

            name:
                savedMessage.sender_name ||
                character.nome ||
                "Avventuriero",

            text:
                savedMessage.message_text ||
                messageText,

            timestamp:
                savedMessage.created_at ||
                new Date()
                    .toISOString()

        };


        addBaseChatMessage(
            message
        );


        if (
            baseChannel &&
            baseRealtimeReady
        ) {

            try {

                await baseChannel.send({

                    type:
                        "broadcast",

                    event:
                        "base-chat",

                    payload:
                        message

                });


            } catch (broadcastError) {

                console.error(
                    "Errore broadcast chat Base:",
                    broadcastError
                );

            }

        }


    } catch (error) {

        console.error(
            "Errore salvataggio chat Base:",
            error
        );


        input.value =
            originalValue;


        setMessage(
            "Non è stato possibile inviare il messaggio."
        );

    }

}


function addBaseChatMessage(
    message,
    fromHistory = false
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


    const messageId =
        message.id
            ? String(
                message.id
            )
            : null;


    if (
        messageId &&
        renderedBaseChatMessageIds.has(
            messageId
        )
    ) {

        return;

    }


    if (messageId) {

        renderedBaseChatMessageIds.add(
            messageId
        );

    }


    const placeholder =
        container.querySelector(
            ".chat-placeholder"
        );


    if (placeholder) {

        placeholder.remove();

    }


    const row =
        document.createElement(
            "div"
        );


    row.className =
        "floor-chat-message";


    if (messageId) {

        row.dataset.messageId =
            messageId;

    }


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


    const textElement =
        document.createElement(
            "span"
        );


    textElement.className =
        "floor-chat-text";


    textElement.textContent =
        message.text ||
        "";


    row.append(
        name,
        document.createTextNode(
            ": "
        ),
        textElement
    );


    if (fromHistory) {

        container.appendChild(
            row
        );

    } else {

        container.prepend(
            row
        );

    }


    container.scrollTop =
        0;

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeBaseHtml(
    value
) {

    return String(
        value ??
        ""
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
// USCITA PAGINA BASE
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            basePositionSaveTimer
        ) {

            clearTimeout(
                basePositionSaveTimer
            );

            basePositionSaveTimer =
                null;

        }


        // Tenta l'ultimo salvataggio prima di uscire.
        if (
            character &&
            basePlayerX !== null &&
            basePlayerY !== null
        ) {

            db
                .from("characters")
                .update({

                    base_x:
                        Number(basePlayerX),

                    base_y:
                        Number(basePlayerY)

                })
                .eq(
                    "id",
                    character.id
                )
                .then(
                    () => {}
                )
                .catch(
                    () => {}
                );

        }


        if (
            baseChannel
        ) {

            try {

                baseChannel.untrack();

            } catch (error) {

                console.warn(
                    "Errore chiusura Presence Base:",
                    error
                );

            }

        }

    }
);
