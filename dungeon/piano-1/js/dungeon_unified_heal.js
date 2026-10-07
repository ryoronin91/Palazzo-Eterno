// ============================================================
// PALAZZO ETERNO
// DUNGEON.JS
// VERSIONE NUOVA INTERFACCIA
// ============================================================

console.log("DUNGEON.JS - NUOVA INTERFACCIA CARICATA");



// ============================================================
// MUSICA DI SOTTOFONDO
// ============================================================

let pageBackgroundMusic = null;

const DUNGEON_MUSIC_VOLUME_KEY =
    "palazzo-eterno-dungeon-volume";

let dungeonMusicVolume =
    loadDungeonMusicVolume();

function startBackgroundMusic(
    source
) {

    if (
        pageBackgroundMusic ||
        !source
    ) {

        return;

    }


    pageBackgroundMusic =
        new Audio(
            source
        );


    pageBackgroundMusic.loop =
        true;

    pageBackgroundMusic.volume =
        dungeonMusicVolume;

    pageBackgroundMusic.preload =
        "auto";


    const tryPlay =
        async () => {

            if (
                !pageBackgroundMusic
            ) {

                return;

            }


            try {

                await pageBackgroundMusic.play();

            } catch (
                error
            ) {

                // I browser possono bloccare l'autoplay finché
                // il giocatore non interagisce con la pagina.

            }

        };


    tryPlay();


    const unlockAudio =
        () => {

            tryPlay();

        };


    document.addEventListener(
        "pointerdown",
        unlockAudio,
        {
            once: true
        }
    );


    document.addEventListener(
        "keydown",
        unlockAudio,
        {
            once: true
        }
    );

}


// ============================================================
// VOLUME MUSICA
// ============================================================

function loadDungeonMusicVolume() {

    try {

        const saved =
            localStorage.getItem(
                DUNGEON_MUSIC_VOLUME_KEY
            );

        if (
            saved === null ||
            saved === ""
        ) {

            return 0.35;
        }

        const value =
            Number(saved);

        if (
            !Number.isFinite(value)
        ) {

            return 0.35;
        }

        return Math.max(
            0,
            Math.min(
                1,
                value
            )
        );

    } catch (error) {

        return 0.35;
    }
}


function saveDungeonMusicVolume(
    value
) {

    try {

        localStorage.setItem(
            DUNGEON_MUSIC_VOLUME_KEY,
            String(value)
        );

    } catch (error) {
        // localStorage può essere disabilitato.
    }
}


function getDungeonVolumeIcon(
    volume
) {

    if (volume <= 0) {
        return "🔇";
    }

    if (volume < 0.5) {
        return "🔉";
    }

    return "🔊";
}


function updateDungeonVolumeUI() {

    const button =
        document.getElementById(
            "dungeon-volume-button"
        );

    const slider =
        document.getElementById(
            "dungeon-volume-slider"
        );

    const value =
        document.getElementById(
            "dungeon-volume-value"
        );

    const percentage =
        Math.round(
            dungeonMusicVolume *
            100
        );

    if (button) {

        button.textContent =
            getDungeonVolumeIcon(
                dungeonMusicVolume
            );

        button.title =
            `Volume musica: ${percentage}%`;
    }

    if (slider) {

        slider.value =
            String(percentage);
    }

    if (value) {

        value.textContent =
            `${percentage}%`;
    }
}


function setupDungeonVolumeControl() {

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

    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {

        return;
    }

    updateDungeonVolumeUI();

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();
            event.stopPropagation();

            const willOpen =
                popover.hidden === true;

            popover.hidden =
                !willOpen;

            button.setAttribute(
                "aria-expanded",
                willOpen
                    ? "true"
                    : "false"
            );
        }
    );

    slider.addEventListener(
        "input",
        () => {

            dungeonMusicVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(slider.value) / 100
                    )
                );

            if (pageBackgroundMusic) {

                pageBackgroundMusic.volume =
                    dungeonMusicVolume;
            }

            saveDungeonMusicVolume(
                dungeonMusicVolume
            );

            updateDungeonVolumeUI();
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

            popover.hidden =
                true;

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    );
}


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
// CAMERA DUNGEON
// ============================================================
//
// Il frame mostra 13x13 celle:
// PG + 6 celle di raggio in ogni direzione.
//
// Le coordinate di gioco e multiplayer NON cambiano.
// Si muove soltanto la visuale.
//
// ============================================================

const CAMERA_RADIUS = 6;

const CAMERA_VISIBLE_CELLS =
    CAMERA_RADIUS * 2 + 1;

const CAMERA_TRANSITION_MS = 170;


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
// CARTELLO - MANO DI SCIMMIA
// ============================================================
//
// Mano di Scimmia non si trova più sul Piano 1.
// Al suo posto, in X2 Y11, c'è un cartello di legno
// che avvisa i giocatori che ora si è trasferito
// al livello successivo.
//
// Il cartello occupa la casella ed è leggibile sia
// cliccandolo da adiacenti sia tentando di entrarci.
// ============================================================

const MONKEY_SIGN_X = 2;
const MONKEY_SIGN_Y = 11;

const MONKEY_SIGN_TITLE =
    "Cartello di legno";

const MONKEY_SIGN_MESSAGE =
    "Ciao campione! Qui era troppo pericoloso per me restare, mi trovi al piano successivo. Ah tranquillo, le scale ora sono sicure... quasi tutte..";

let monkeySignElement = null;


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
// CHAT PERSISTENTE
// ============================================================

const DUNGEON_CHAT_FLOOR_ID =
    "floor_1";

const DUNGEON_CHAT_HISTORY_LIMIT =
    100;

const renderedFloorChatMessageIds =
    new Set();


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

        startBackgroundMusic(
            "../../music/dungeon.mp3"
        );


        setupDungeonVolumeControl();


        try {

            setMessage(
                "Caricamento del dungeon..."
            );


            // ------------------------------------------------
            // PERSONAGGIO
            // ------------------------------------------------

            await loadCharacter();


            // ------------------------------------------------
            // ROUTER STATO PG
            // ------------------------------------------------
            //
            // Supabase decide dove si trova realmente il PG.
            // Se il browser apre una pagina non coerente
            // (Indietro / Avanti / URL manuale / cache),
            // lo rimandiamo alla pagina corretta.
            //
            // ------------------------------------------------

            if (
                await enforceDungeonPageState()
            ) {

                return;

            }


            // ------------------------------------------------
            // ACCESSO STANZA BOSS
            // ------------------------------------------------

            await loadBossRoomAccess();


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

            await loadFloorChatHistory();

            requestAnimationFrame(
                syncDungeonChatHeightWithMap
            );


            // ------------------------------------------------
            // MAPPA
            // ------------------------------------------------

            await loadDungeon();


            // ------------------------------------------------
            // POSIZIONE
            // ------------------------------------------------

            await initializePlayer();

            // Registra la casella realmente occupata dal token per
            // la missione di esplorazione del Piano 1.
            await recordCurrentFloorVisit();


            // ------------------------------------------------
            // CAMERA
            // ------------------------------------------------

            setupDungeonCamera();


            // ------------------------------------------------
            // VENDOR
            // ------------------------------------------------

            setupMonkeySignToken();


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
                "get_dead_characters_leaderboard_with_badges",
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
                                        escapeDungeonLeaderboardHtml(
                                            badge?.badge_name ||
                                            badge?.display_name ||
                                            "Boss sconfitto"
                                        );

                                    const rawIconPath =
                                        badge?.icon_path ||
                                        "";

                                    const resolvedIconPath =

                                    rawIconPath.startsWith("immagini/")
                                            ? "../../" + rawIconPath
                                            : rawIconPath;

                                    const iconPath =
                                        escapeDungeonLeaderboardHtml(
                                            resolvedIconPath
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
                                                aria-label="${title}"
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
                                                aria-hidden="true"
                                                style="display:none"
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
// ROUTER STATO DEL PERSONAGGIO
// ============================================================
//
// Ritorna true quando è stato avviato un redirect.
//
// Priorità:
// 1. active_combat_id  -> combat.html
// 2. current_location vendor -> vendor.html
// 3. altrimenti dungeon
//
// Se current_location è rimasto "combat" ma active_combat_id
// non esiste più, ripariamo automaticamente lo stato.
//
// ============================================================

async function enforceDungeonPageState(
    refreshFromDatabase = false
) {

    if (
        refreshFromDatabase
    ) {

        const {
            data: {
                user
            },
            error: authError
        } =
            await db.auth.getUser();


        if (
            authError
        ) {

            console.error(
                "Errore controllo stato pagina:",
                authError
            );

            return false;

        }


        if (
            !user
        ) {

            window.location.replace(
                "../../login.html"
            );

            return true;

        }


        const {
            data,
            error
        } =
            await db
                .from(
                    "characters"
                )
                .select(
                    "id, active_combat_id, current_location"
                )
                .eq(
                    "user_id",
                    user.id
                )
                .maybeSingle();


        if (
            error
        ) {

            console.error(
                "Errore lettura stato PG:",
                error
            );

            return false;

        }


        if (
            !data
        ) {

            window.location.replace(
                "../../personaggio.html"
            );

            return true;

        }


        if (
            character
        ) {

            character.active_combat_id =
                data.active_combat_id;

            character.current_location =
                data.current_location;

        } else {

            character =
                data;

        }

    }


    if (
        !character
    ) {

        return false;

    }


    // --------------------------------------------------------
    // COMBAT HA SEMPRE LA PRIORITÀ
    // --------------------------------------------------------

    if (
        character.active_combat_id
    ) {

        if (
            character.current_location !==
            "combat"
        ) {

            try {

                await db
                    .from(
                        "characters"
                    )
                    .update({
                        current_location:
                            "combat"
                    })
                    .eq(
                        "id",
                        character.id
                    );

            } catch (error) {

                console.error(
                    "Errore sincronizzazione stato combat:",
                    error
                );

            }

        }


        window.location.replace(
            "../../combat.html"
        );

        return true;

    }


    // --------------------------------------------------------
    // VENDOR
    // --------------------------------------------------------

    if (
        character.current_location ===
        "vendor"
    ) {

        window.location.replace(
            "../../../base/services/vendor/vendor.html"
        );

        return true;

    }


    // --------------------------------------------------------
    // STATO COMBAT ORFANO
    // --------------------------------------------------------
    //
    // Se non esiste più active_combat_id, "combat" non è
    // uno stato valido. Lo riportiamo al dungeon.
    //
    // --------------------------------------------------------

    if (
        character.current_location ===
        "combat"
    ) {

        try {

            const {
                error
            } =
                await db
                    .from(
                        "characters"
                    )
                    .update({
                        current_location:
                            "dungeon"
                    })
                    .eq(
                        "id",
                        character.id
                    );


            if (
                error
            ) {

                throw error;

            }


            character.current_location =
                "dungeon";

        } catch (error) {

            console.error(
                "Errore ripristino stato dungeon:",
                error
            );

        }

    }


    return false;

}


// ============================================================
// RIENTRO DA CACHE DEL BROWSER
// ============================================================
//
// Il tasto Indietro può ripristinare dungeon.html dalla BFCache
// senza rieseguire DOMContentLoaded.
// In quel caso controlliamo di nuovo Supabase.
//
// ============================================================

window.addEventListener(
    "pageshow",
    async event => {

        if (
            !event.persisted
        ) {

            return;

        }


        try {

            await enforceDungeonPageState(
                true
            );

        } catch (error) {

            console.error(
                "Errore controllo stato al ritorno pagina:",
                error
            );

        }

    }
);


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
            "../../login.html";

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
            "../../personaggio.html";

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


function getDungeonHealAbilityEntry() {

    return characterAbilities.find(
        entry =>
            entry.ability_id === "cura" ||
            entry.ability?.id === "cura"
    ) || null;

}


function getDungeonHealPmCost() {

    return Math.max(
        0,
        Number(
            getDungeonHealAbilityEntry()?.ability?.pm_cost
        ) || 2
    );

}


function updateDungeonHealCostLabel() {

    const button =
        document.getElementById(
            "dungeon-heal-button"
        );

    const label =
        button?.querySelector(
            "small"
        );

    if (label) {
        label.textContent =
            `${getDungeonHealPmCost()} PM`;
    }

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

    updateDungeonHealCostLabel();

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
            "../../immagini/token/" +
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
// COORDINATE PG
// ============================================================

function updatePlayerCoordinates(
    x = playerX,
    y = playerY
) {

    const element =
        document.getElementById(
            "dungeon-player-coordinates"
        );

    if (!element) {
        return;
    }

    if (
        x === null ||
        x === undefined ||
        y === null ||
        y === undefined
    ) {

        element.textContent =
            "Coordinate PG: X -- · Y --";

        return;
    }

    element.textContent =
        `Coordinate PG: X ${Number(x)} · Y ${Number(y)}`;

}


// ============================================================
// TRACCIAMENTO CASELLE REALMENTE VISITATE - PIANO 1
// ============================================================

async function recordCurrentFloorVisit() {

    if (
        !character ||
        !character.id ||
        !Number.isInteger(Number(playerX)) ||
        !Number.isInteger(Number(playerY))
    ) {
        return;
    }

    try {
        const { error } = await db.rpc(
            "record_floor_visit",
            {
                p_floor_id: "piano_1",
                p_x: Number(playerX),
                p_y: Number(playerY)
            }
        );

        if (error) {
            throw error;
        }

    } catch (error) {
        // Il tracciamento missione non deve bloccare il movimento.
        console.warn(
            "Errore registrazione casella visitata:",
            error
        );
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
// CARTELLO - MANO DI SCIMMIA
// ============================================================

function setupMonkeySignToken() {

    const map =
        document.getElementById(
            "dungeon-map"
        );


    if (!map) {

        return;

    }


    if (!monkeySignElement) {

        monkeySignElement =
            document.createElement(
                "div"
            );


        monkeySignElement.className =
            "dungeon-player-token dungeon-monkey-sign-token";


        monkeySignElement.title =
            MONKEY_SIGN_TITLE;


        monkeySignElement.setAttribute(
            "aria-label",
            MONKEY_SIGN_TITLE
        );


        monkeySignElement.style.cursor =
            "pointer";

        monkeySignElement.style.zIndex =
            "6";

        monkeySignElement.style.pointerEvents =
            "auto";

        monkeySignElement.style.display =
            "flex";

        monkeySignElement.style.alignItems =
            "center";

        monkeySignElement.style.justifyContent =
            "center";

        monkeySignElement.style.background =
            "transparent";

        monkeySignElement.style.border =
            "none";

        monkeySignElement.style.boxShadow =
            "none";

        monkeySignElement.style.overflow =
            "visible";


        const signWrapper =
            document.createElement(
                "div"
            );

        signWrapper.style.position =
            "relative";

        signWrapper.style.width =
            "100%";

        signWrapper.style.height =
            "100%";


        const signBoard =
            document.createElement(
                "div"
            );

        signBoard.style.position =
            "absolute";

        signBoard.style.left =
            "8%";

        signBoard.style.right =
            "8%";

        signBoard.style.top =
            "10%";

        signBoard.style.height =
            "54%";

        signBoard.style.display =
            "flex";

        signBoard.style.alignItems =
            "center";

        signBoard.style.justifyContent =
            "center";

        signBoard.style.padding =
            "2px";

        signBoard.style.border =
            "2px solid #4d2c12";

        signBoard.style.borderRadius =
            "8px";

        signBoard.style.background =
            "linear-gradient(180deg, #b67a3c 0%, #8a5826 60%, #6c431d 100%)";

        signBoard.style.boxShadow =
            "0 1px 3px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 232, 187, 0.25)";


        const signText =
            document.createElement(
                "div"
            );

        signText.textContent =
            "AVVISO";

        signText.style.color =
            "#f7e4b5";

        signText.style.fontSize =
            "8px";

        signText.style.fontWeight =
            "800";

        signText.style.letterSpacing =
            "0.06em";

        signText.style.textShadow =
            "0 1px 1px rgba(0, 0, 0, 0.6)";

        signText.style.lineHeight =
            "1";


        const signPost =
            document.createElement(
                "div"
            );

        signPost.style.position =
            "absolute";

        signPost.style.left =
            "45%";

        signPost.style.width =
            "10%";

        signPost.style.bottom =
            "3%";

        signPost.style.height =
            "34%";

        signPost.style.borderRadius =
            "3px";

        signPost.style.background =
            "linear-gradient(180deg, #6a4320 0%, #4a2d13 100%)";

        signPost.style.boxShadow =
            "0 1px 2px rgba(0, 0, 0, 0.35)";


        signBoard.appendChild(
            signText
        );

        signWrapper.appendChild(
            signBoard
        );

        signWrapper.appendChild(
            signPost
        );

        monkeySignElement.appendChild(
            signWrapper
        );


        monkeySignElement.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                if (
                    !isMonkeySignAdjacentToPlayer()
                ) {

                    setMessage(
                        "Avvicinati al cartello per leggerlo."
                    );

                    return;

                }


                openMonkeySignPrompt();

            }
        );


        map.appendChild(
            monkeySignElement
        );

    }


    positionTokenElement(
        monkeySignElement,
        MONKEY_SIGN_X,
        MONKEY_SIGN_Y
    );


    updateMonkeySignVisibility();

}


function isMonkeySignCell(
    x,
    y
) {

    return (
        Number(x) === MONKEY_SIGN_X
        &&
        Number(y) === MONKEY_SIGN_Y
    );

}


function isMonkeySignAdjacentToPlayer() {

    if (
        playerX === null ||
        playerY === null
    ) {

        return false;

    }


    const distance =
        Math.abs(
            Number(playerX) -
            MONKEY_SIGN_X
        )
        +
        Math.abs(
            Number(playerY) -
            MONKEY_SIGN_Y
        );


    return distance === 1;

}


function updateMonkeySignVisibility() {

    if (!monkeySignElement) {

        return;

    }


    monkeySignElement.style.display =
        isCellCurrentlyVisible(
            MONKEY_SIGN_X,
            MONKEY_SIGN_Y
        )
            ? "flex"
            : "none";

}


function openMonkeySignPrompt() {

    if (eventLocked) {

        return;

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    setMessage(
        "Leggi il cartello di legno."
    );


    if (
        typeof openSimpleDungeonEventPrompt ===
        "function"
    ) {

        openSimpleDungeonEventPrompt(
            MONKEY_SIGN_TITLE,
            MONKEY_SIGN_MESSAGE
        );

        return;

    }


    alert(
        `${MONKEY_SIGN_TITLE}\n\n${MONKEY_SIGN_MESSAGE}`
    );

    eventLocked =
        false;
}


// ============================================================
// CAMERA DUNGEON
// ============================================================

function setupDungeonCamera() {

    updateDungeonCamera(
        true
    );

}


// ============================================================
// AGGIORNA CAMERA
// ============================================================

function updateDungeonCamera(
    instant = false
) {

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
        playerX === null ||
        playerY === null
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
        MAP_COLUMNS;


    const cellHeight =
        mapRect.height /
        MAP_ROWS;


    const playerCenterX =
        (
            Number(playerX) +
            0.5
        )
        *
        cellWidth;


    const playerCenterY =
        (
            Number(playerY) +
            0.5
        )
        *
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
            : `transform ${CAMERA_TRANSITION_MS}ms ease-out`;


    map.style.transform =
        `translate(${-cameraX}px, ${-cameraY}px)`;


    if (instant) {

        requestAnimationFrame(
            () => {

                map.style.transition =
                    `transform ${CAMERA_TRANSITION_MS}ms ease-out`;

            }
        );

    }

}


// ============================================================
// LIMITI TEORICI DELLA CAMERA
// ============================================================

function getDungeonCameraBounds() {

    return {

        minX:
            Math.max(
                0,
                Number(playerX) -
                CAMERA_RADIUS
            ),

        maxX:
            Math.min(
                MAP_COLUMNS - 1,
                Number(playerX) +
                CAMERA_RADIUS
            ),

        minY:
            Math.max(
                0,
                Number(playerY) -
                CAMERA_RADIUS
            ),

        maxY:
            Math.min(
                MAP_ROWS - 1,
                Number(playerY) +
                CAMERA_RADIUS
            )

    };

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
            "../../immagini/token/" +
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

    updatePlayerCoordinates(
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


    if (monkeySignElement) {

        positionTokenElement(
            monkeySignElement,
            MONKEY_SIGN_X,
            MONKEY_SIGN_Y
        );

        updateMonkeySignVisibility();

    }


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

        updateDungeonCamera(
            true
        );

        repositionAllTokens();

        updateFogOfWar();

        syncDungeonChatHeightWithMap();

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
    // CARTELLO - MANO DI SCIMMIA
    // --------------------------------------------------------
    //
    // La casella X2 Y11 è occupata dal cartello.
    // Tentare di entrarci mostra direttamente il messaggio.
    //
    // --------------------------------------------------------

    if (
        isMonkeySignCell(
            newX,
            newY
        )
    ) {

        openMonkeySignPrompt();

        return false;

    }


    // --------------------------------------------------------
    // VARCO STANZA BOSS
    // --------------------------------------------------------
    //
    // Il popup si apre SOLO quando il PG tenta realmente
    // di entrare in una delle due celle protette.
    //
    // --------------------------------------------------------

    if (
        isBossRoomGateCell(
            newX,
            newY
        )
        &&
        !hasBossRoomAccess()
    ) {

        setMessage(
            "La porta è chiusa."
        );

        openBossRoomGatePrompt();

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
    
    updateDungeonCamera();


    updateFogOfWar();

    // Registra la casella calpestata. Il salvataggio è idempotente:
    // tornare sulla stessa casella non incrementa il progresso.
    recordCurrentFloorVisit();

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

    // Movimento remoto: solo Broadcast. Presence non viene
    // riscritta a ogni passo.
    broadcastMyState();


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
// VARCHI STANZA BOSS
// ============================================================
//
// I due ingressi condividono lo stesso permesso.
//
// La password NON esiste più nel JavaScript.
// Viene verificata esclusivamente da Supabase.
//
// Cicli password:
// - 00:00 -> 12:00
// - 12:00 -> 00:00
// fuso Europe/Rome.
//
// Lo sblocco vale soltanto per il ciclo corrente.
// ============================================================

const BOSS_ROOM_GATE_CELLS = [
    { x: 19, y: 16 },
    { x: 16, y: 17 }
];

let bossRoomAccessUnlocked =
    false;

let bossRoomAccessExpiresAt =
    null;


// ============================================================
// CARICA STATO ACCESSO DAL DATABASE
// ============================================================

async function loadBossRoomAccess() {

    bossRoomAccessUnlocked =
        false;

    bossRoomAccessExpiresAt =
        null;


    if (
        !character ||
        !character.id
    ) {
        return;
    }


    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "get_boss_gate_access_state",
                {
                    p_character_id:
                        character.id
                }
            );


        if (error) {

            throw error;

        }


        bossRoomAccessUnlocked =
            data?.unlocked ===
            true;


        bossRoomAccessExpiresAt =
            data?.cycle_expires_at
                ? String(
                    data.cycle_expires_at
                )
                : null;


    } catch (error) {

        console.error(
            "Errore caricamento accesso stanza Boss:",
            error
        );


        bossRoomAccessUnlocked =
            false;

        bossRoomAccessExpiresAt =
            null;

    }

}


// ============================================================
// REGISTRA ACCESSO LOCALE DEL CICLO CORRENTE
// ============================================================

function unlockBossRoomAccess(
    cycleExpiresAt
) {

    bossRoomAccessUnlocked =
        true;

    bossRoomAccessExpiresAt =
        cycleExpiresAt
            ? String(
                cycleExpiresAt
            )
            : null;


    updateFogOfWar();

}


// ============================================================
// CELLA VARCO
// ============================================================

function isBossRoomGateCell(
    x,
    y
) {

    return BOSS_ROOM_GATE_CELLS.some(
        gate =>
            Number(gate.x) === Number(x) &&
            Number(gate.y) === Number(y)
    );

}


// ============================================================
// ACCESSO ATTUALE
// ============================================================
//
// Anche se la pagina resta aperta oltre le 12:00 / 00:00,
// l'accesso decade immediatamente quando scade il ciclo.
//
// ============================================================

function hasBossRoomAccess() {

    if (
        bossRoomAccessUnlocked !==
        true
    ) {

        return false;

    }


    if (
        !bossRoomAccessExpiresAt
    ) {

        bossRoomAccessUnlocked =
            false;

        return false;

    }


    const expiresAt =
        new Date(
            bossRoomAccessExpiresAt
        )
            .getTime();


    if (
        !Number.isFinite(
            expiresAt
        )
        ||
        Date.now() >=
            expiresAt
    ) {

        bossRoomAccessUnlocked =
            false;

        bossRoomAccessExpiresAt =
            null;

        return false;

    }


    return true;

}


// ============================================================
// POPUP VARCO STANZA BOSS
// ============================================================

function closeBossRoomGatePrompt() {

    const overlay =
        document.getElementById(
            "boss-room-gate-overlay"
        );


    if (overlay) {

        overlay.remove();

    }


    eventLocked =
        false;

}


// ============================================================
// APRE POPUP VARCO
// ============================================================

function openBossRoomGatePrompt() {

    if (
        hasBossRoomAccess() ||
        document.getElementById(
            "boss-room-gate-overlay"
        )
    ) {

        return;

    }


    eventLocked =
        true;

    movementQueue.length =
        0;


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "boss-room-gate-overlay";

    overlay.className =
        "combat-event-overlay";


    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "combat-event-modal";


    modal.innerHTML = `
        <div class="combat-event-icon">
            🔒
        </div>

        <h2>
            PORTA CHIUSA
        </h2>

        <p>
            La porta è chiusa.
        </p>

        <div class="combat-event-warning">
            Sembra necessaria una parola d'ordine per poter accedere
            a questa zona.
        </div>

        <div
            id="boss-room-gate-code-panel"
            style="display:none; margin-top:16px;"
        >
            <input
                id="boss-room-gate-code-input"
                type="text"
                maxlength="40"
                autocomplete="off"
                placeholder="Inserisci la parola d'ordine"
                style="width:100%; box-sizing:border-box; padding:10px 12px; text-align:center;"
            >

            <div
                id="boss-room-gate-code-error"
                style="min-height:22px; margin-top:8px; text-align:center;"
            ></div>
        </div>

        <div class="combat-event-buttons">

            <button
                id="boss-room-gate-close-button"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                INDIETRO
            </button>

            <button
                id="boss-room-gate-code-button"
                type="button"
                class="combat-event-button combat-event-confirm"
            >
                INSERISCI CODICE
            </button>

        </div>
    `;


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    const closeButton =
        document.getElementById(
            "boss-room-gate-close-button"
        );


    const codeButton =
        document.getElementById(
            "boss-room-gate-code-button"
        );


    const codePanel =
        document.getElementById(
            "boss-room-gate-code-panel"
        );


    const codeInput =
        document.getElementById(
            "boss-room-gate-code-input"
        );


    const codeError =
        document.getElementById(
            "boss-room-gate-code-error"
        );


    let submitting =
        false;


    // ========================================================
    // VERIFICA PASSWORD VIA SUPABASE
    // ========================================================

    async function submitBossRoomCode() {

        if (
            !codeInput ||
            !character ||
            !character.id ||
            submitting
        ) {

            return;

        }


        const enteredCode =
            String(
                codeInput.value ||
                ""
            )
                .trim();


        if (!enteredCode) {

            if (codeError) {

                codeError.textContent =
                    "Inserisci la parola d'ordine.";

            }

            return;

        }


        submitting =
            true;


        if (codeButton) {

            codeButton.disabled =
                true;

            codeButton.textContent =
                "VERIFICA...";

        }


        if (codeInput) {

            codeInput.disabled =
                true;

        }


        if (codeError) {

            codeError.textContent =
                "";

        }


        try {

            const {
                data,
                error
            } =
                await db.rpc(
                    "try_boss_gate_password",
                    {
                        p_character_id:
                            character.id,

                        p_password:
                            enteredCode
                    }
                );


            if (error) {

                throw error;

            }


            // ====================================================
            // PASSWORD CORRETTA
            // ====================================================

            if (
                data?.correct ===
                true
            ) {

                unlockBossRoomAccess(
                    data.cycle_expires_at
                );


                closeBossRoomGatePrompt();


                setMessage(
                    "Parola d'ordine corretta. I varchi della stanza del Boss sono sbloccati."
                );


                return;

            }


            // ====================================================
            // PASSWORD ERRATA: 7 DANNI
            // ====================================================

            const newHealth =
                Math.max(
                    0,
                    Number(
                        data?.current_hp
                    ) || 0
                );


            character.current_hp =
                newHealth;


            updateCharacterPanel();


            try {

                await updateMyPresence();

            } catch (presenceError) {

                console.warn(
                    "Errore aggiornamento Presence dopo danno porta Boss:",
                    presenceError
                );

            }


            setMessage(
                "Parola d'ordine errata: subisci 7 PF di danno."
            );


            if (
                data?.dead ===
                true ||
                newHealth <= 0
            ) {

                if (codeError) {

                    codeError.textContent =
                        "Parola d'ordine errata. Subisci 7 danni. I tuoi PF scendono a 0.";

                }


                // Il danno è già stato salvato dalla RPC.
                // Usiamo la normale gestione morte del dungeon.
                setTimeout(
                    async () => {

                        closeBossRoomGatePrompt();

                        try {

                            const temporalCoinActivated =
                                await tryConsumeTemporalCoinAfterDamage();


                            if (temporalCoinActivated) {

                                eventLocked =
                                    false;

                                return;

                            }

                        } catch (temporalCoinError) {

                            console.error(
                                "Errore attivazione Moneta Temporale dopo danno porta Boss:",
                                temporalCoinError
                            );

                            setMessage(
                                "Errore durante il controllo della Moneta Temporale."
                            );

                            eventLocked =
                                false;

                            return;

                        }


                        await handleCharacterDeath();

                    },
                    500
                );


                return;

            }


            if (codeError) {

                codeError.textContent =
                    `Parola d'ordine errata. Subisci 7 danni. PF rimasti: ${newHealth}.`;

            }


            codeInput.value =
                "";

            codeInput.disabled =
                false;

            codeInput.focus();


        } catch (error) {

            console.error(
                "Errore verifica parola d'ordine Boss:",
                error
            );


            if (codeError) {

                codeError.textContent =
                    "Errore durante la verifica. Riprova.";

            }


            if (codeInput) {

                codeInput.disabled =
                    false;

                codeInput.focus();

            }


        } finally {

            submitting =
                false;


            if (
                codeButton &&
                document.body.contains(
                    codeButton
                )
            ) {

                codeButton.disabled =
                    false;

                codeButton.textContent =
                    "SBLOCCA";

            }

        }

    }


    // ========================================================
    // INDIETRO
    // ========================================================

    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeBossRoomGatePrompt
        );

    }


    // ========================================================
    // PULSANTE CODICE
    // ========================================================

    if (codeButton) {

        codeButton.addEventListener(
            "click",
            async () => {

                if (
                    codePanel &&
                    codePanel.style.display ===
                        "none"
                ) {

                    codePanel.style.display =
                        "block";

                    codeButton.textContent =
                        "SBLOCCA";


                    if (codeInput) {

                        codeInput.focus();

                    }


                    return;

                }


                await submitBossRoomCode();

            }
        );

    }


    // ========================================================
    // INVIO CON ENTER
    // ========================================================

    if (codeInput) {

        codeInput.addEventListener(
            "keydown",
            async event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    await submitBossRoomCode();

                }

            }
        );

    }

}


// ============================================================
// OCCLUSIONE VISIVA DEI VARCHI BOSS
// ============================================================
//
// Controlla se il segmento che unisce il centro della casella
// del PG al centro della casella bersaglio attraversa una
// specifica cella-varco. Usiamo un'intersezione geometrica
// inclusiva, così anche le diagonali che sfiorano il bordo del
// varco non permettono di vedere "un quadretto oltre".
//
// ============================================================

function doesSightSegmentCrossCell(
    startX,
    startY,
    targetX,
    targetY,
    cellX,
    cellY
) {

    const x0 = Number(startX) + 0.5;
    const y0 = Number(startY) + 0.5;
    const x1 = Number(targetX) + 0.5;
    const y1 = Number(targetY) + 0.5;

    const dx = x1 - x0;
    const dy = y1 - y0;

    const minX = Number(cellX);
    const maxX = Number(cellX) + 1;
    const minY = Number(cellY);
    const maxY = Number(cellY) + 1;

    let tMin = 0;
    let tMax = 1;

    const checks = [
        [-dx, x0 - minX],
        [ dx, maxX - x0],
        [-dy, y0 - minY],
        [ dy, maxY - y0]
    ];

    for (const [p, q] of checks) {

        if (Math.abs(p) < 1e-12) {

            if (q < 0) {
                return false;
            }

            continue;

        }

        const r = q / p;

        if (p < 0) {
            tMin = Math.max(tMin, r);
        } else {
            tMax = Math.min(tMax, r);
        }

        if (tMin > tMax) {
            return false;
        }

    }

    return true;
}


function isHiddenBehindClosedBossGate(
    targetX,
    targetY
) {

    if (
        hasBossRoomAccess() ||
        playerX === null ||
        playerY === null
    ) {
        return false;
    }

    return BOSS_ROOM_GATE_CELLS.some(
        gate => {

            // Anche la cella del varco chiuso deve essere
            // completamente nascosta, non solo ciò che si trova
            // oltre di essa.
            return doesSightSegmentCrossCell(
                playerX,
                playerY,
                targetX,
                targetY,
                gate.x,
                gate.y
            );

        }
    );
}


// ============================================================
// CONTROLLO CASELLA OCCUPATA DA EVENTO COMBAT
// ============================================================
//
// I token degli eventi combat (C1-C5, PvP, Boss, ecc.)
// occupano realmente la loro casella nel dungeon.
// Un PG può quindi arrivare accanto al token, ma non può
// attraversarlo o fermarsi sulla sua stessa casella.
//
// ============================================================

function isCombatEventCellOccupied(
    visibleX,
    visibleY
) {

    if (
        typeof DUNGEON_COMBAT_EVENTS === "undefined" ||
        !Array.isArray(
            DUNGEON_COMBAT_EVENTS
        )
    ) {

        return false;

    }


    return DUNGEON_COMBAT_EVENTS.some(
        combatEvent => {

            // Se eventi.js espone uno stato dinamico
            // dell'evento (es. Boss in cooldown),
            // una pedina non disponibile NON occupa la casella.

            if (
                typeof isDungeonCombatEventAvailable ===
                    "function"
                &&
                !isDungeonCombatEventAvailable(
                    combatEvent
                )
            ) {

                return false;

            }


            return (
                Number(combatEvent.x) ===
                    Number(visibleX)
                &&
                Number(combatEvent.y) ===
                    Number(visibleY)
            );

        }
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
    // CARTELLO - MANO DI SCIMMIA
    // --------------------------------------------------------

    if (
        isMonkeySignCell(
            visibleX,
            visibleY
        )
    ) {

        return false;

    }


    // --------------------------------------------------------
    // VARCHI STANZA BOSS
    // --------------------------------------------------------

    if (
        isBossRoomGateCell(
            visibleX,
            visibleY
        )
        &&
        !hasBossRoomAccess()
    ) {

        return false;

    }


    // --------------------------------------------------------
    // TOKEN EVENTO COMBAT
    // --------------------------------------------------------
    //
    // La casella di un evento combat è occupata dal suo token.
    // Questo controllo avviene PRIMA della lettura del JSON:
    // anche se sotto al token c'è un pavimento percorribile,
    // il PG non può entrare nella casella.
    //
    // --------------------------------------------------------

    if (
        isCombatEventCellOccupied(
            visibleX,
            visibleY
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

            // Presence serve solo a sapere chi è online.
            // Non ribroadcastiamo e non rimuoviamo token durante sync.
            syncOnlinePlayers();

        }
    );


    // ========================================================
    // PRESENCE JOIN
    // ========================================================

    dungeonChannel.on(
        "presence",
        { event: "join" },
        ({ newPresences }) => {

            (newPresences || []).forEach(
                presence => {
                    if (
                        !presence?.character_id ||
                        presence.character_id === character.id
                    ) {
                        return;
                    }

                    updateRemotePlayer(presence);
                }
            );

            renderDungeonOnlinePlayers();
        }
    );


    // ========================================================
    // PRESENCE LEAVE
    // ========================================================

    dungeonChannel.on(
        "presence",
        { event: "leave" },
        ({ leftPresences }) => {

            const state = dungeonChannel.presenceState();

            (leftPresences || []).forEach(
                presence => {
                    const id = presence?.character_id;

                    if (!id || id === character.id) {
                        return;
                    }

                    const stillOnline =
                        Object.values(state).some(
                            presences =>
                                (presences || []).some(
                                    item => item?.character_id === id
                                )
                        );

                    if (stillOnline) {
                        return;
                    }

                    const token = otherPlayerTokens.get(id);

                    if (token) {
                        token.remove();
                    }

                    otherPlayerTokens.delete(id);
                    otherPlayers.delete(id);
                }
            );

            renderDungeonOnlinePlayers();
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


            console.log("[RT DUNGEON] RX player-move", data.character_id, data.x, data.y);

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

        console.log("[RT DUNGEON] TX player-move", character.id, playerX, playerY);

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
// PANNELLO PERSONAGGI ONLINE
// ============================================================

function renderDungeonOnlinePlayers() {

    const container =
        document.getElementById(
            "dungeon-online-list"
        );

    if (!container) {
        return;
    }

    if (
        !dungeonChannel ||
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
        dungeonChannel.presenceState();

    const playersById =
        new Map();

    Object.values(state).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence ||
                        !presence.character_id
                    ) {

                        return;
                    }

                    const old =
                        playersById.get(
                            presence.character_id
                        );

                    if (
                        !old ||
                        String(
                            presence.online_at ||
                            ""
                        ) >=
                        String(
                            old.online_at ||
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
            getMyPresenceData()
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

                    if (aIsMe !== bIsMe) {

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
        players.length === 0
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
                "../../immagini/token/" +
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

            const inCombat =
                player.in_combat === true ||
                !!player.active_combat_id;

            status.className =
                "dungeon-online-status" +
                (
                    inCombat
                        ? " in-combat"
                        : ""
                );

            status.textContent =
                inCombat
                    ? "⚔ In combattimento"
                    : "Nel dungeon";

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


    // I token NON vengono rimossi durante un normale sync Presence.
    // La rimozione avviene esclusivamente su un vero evento leave.


    // Se Cura è attiva, aggiorniamo
    // immediatamente i bersagli disponibili.

    if (healModeActive) {

        renderHealRange();

        updateHealTargets();

    }
renderFogOfWar();

updateRemoteTokensVisibility();

renderDungeonOnlinePlayers();
    
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

    renderDungeonOnlinePlayers();

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
            "../../immagini/token/" +
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

        healButton.disabled =
            !hasDungeonAbility("cura") ||
            currentPM < getDungeonHealPmCost();

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
        currentPM < getDungeonHealPmCost()
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

    await executeHeal(
        character.id,
        character.nome || "Avventuriero",
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

    if (
        target.in_combat ||
        target.active_combat_id
    ) {
        setMessage(
            "Non puoi curare un personaggio impegnato in combattimento."
        );
        return;
    }

    await executeHeal(
        targetCharacterId,
        target.name || "Alleato",
        false
    );

}


// ============================================================
// ESEGUE CURA TRAMITE RPC UNICA
// ============================================================

async function executeHeal(
    targetCharacterId,
    targetName,
    selfTarget
) {

    if (!character) {
        return;
    }

    eventLocked = true;
    movementQueue.length = 0;

    try {

        // La RPC verifica il range con le coordinate persistite.
        // Salviamo subito l'ultima posizione prima di lanciare Cura.
        if (positionSaveTimer) {
            clearTimeout(positionSaveTimer);
            positionSaveTimer = null;
        }
        positionSavePending = false;
        await flushPositionSave();

        const {
            data,
            error
        } =
            await db.rpc(
                "use_heal",
                {
                    p_target_character_id:
                        targetCharacterId,

                    p_context:
                        "dungeon"
                }
            );

        if (error) {
            throw error;
        }

        const result =
            data || {};

        character.current_pm =
            Number(
                result.caster_current_pm
            );

        if (selfTarget) {
            character.current_hp =
                Number(
                    result.target_current_hp
                );
        }

        updateCharacterPanel();

        // La RPC è la fonte di verità; il broadcast serve solo
        // ad aggiornare subito il client del bersaglio remoto.
        if (
            dungeonChannel &&
            realtimeReady
        ) {

            await dungeonChannel.send({

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
                        result.target_name ||
                        targetName,

                    healed_amount:
                        Number(
                            result.healed_amount
                        ) || 0,

                    new_hp:
                        Number(
                            result.target_current_hp
                        ) || 0

                }

            });

        }

        await updateMyPresence();

        const actualHeal =
            Number(
                result.healed_amount
            ) || 0;

        if (selfTarget) {

            setMessage(
                `Usi Cura su te stesso e recuperi ${actualHeal} PF.`
            );

        } else {

            setMessage(
                `Curi ${result.target_name || targetName} di ${actualHeal} PF.`
            );

        }

        deactivateHealMode();

    } catch (error) {

        console.error(
            "Errore Cura:",
            error
        );

        setMessage(
            error?.message ||
            "Non è stato possibile completare Cura."
        );

    } finally {

        eventLocked = false;
        updateDungeonActionAvailability();

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

        // ====================================================
        // COOLDOWN GLOBALE TRAPPOLA - 15 MINUTI
        // ====================================================

        const {
            data: trapTriggered,
            error: trapTriggerError
        } =
            await db.rpc(
                "try_trigger_trap",
                {
                    p_trap_id:
                        dungeonTrap.id,

                    p_character_id:
                        character.id
                }
            );


        if (trapTriggerError) {

            throw trapTriggerError;

        }


        // La trappola è ancora in cooldown.
        // Nessun tiro, nessun popup, nessun blocco persistente.
        if (
            trapTriggered !==
            true
        ) {

            eventLocked =
                false;


            setMessage(
                "La trappola è temporaneamente disattivata."
            );


            return;

        }


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
                "Riesci a evitare la trappola."
            );


            openTrapResultPrompt({

                title:
                    dungeonTrap.name,

                message:
                    dungeonTrap.message,

                roll:
                    roll,

                luck:
                    luck,

                trapResult:
                    trapResult,

                defenseLabel:
                    dungeonTrap.defenseLabel,

                defense:
                    defense,

                damage:
                    0,

                currentHealth:
                    oldHealth,

                maxHealth:
                    stats.maxHealth,

                avoided:
                    true,

                lethal:
                    false

            });


            return;

        }


        // ====================================================
        // AGGIORNAMENTO IMMEDIATO LATO CLIENT
        //
        // Il popup viene mostrato SUBITO.
        // Il salvataggio Supabase avviene in background:
        // non blocchiamo più l'interfaccia per 2-3 secondi.
        // ====================================================

        character.current_hp =
            newHealth;


        updateCharacterPanel();


        setMessage(
            `La trappola ti colpisce: perdi ${damage} PF.`
        );


        const trapSavePromise =
            db
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
                )
                .then(
                    ({ error }) => {

                        if (error) {

                            throw error;

                        }


                        // Presence non deve rallentare il popup.
                        updateMyPresence();

                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Errore salvataggio danno trappola:",
                            error
                        );

                    }
                );


        openTrapResultPrompt({

            title:
                dungeonTrap.name,

            message:
                dungeonTrap.message,

            roll:
                roll,

            luck:
                luck,

            trapResult:
                trapResult,

            defenseLabel:
                dungeonTrap.defenseLabel,

            defense:
                defense,

            damage:
                damage,

            currentHealth:
                newHealth,

            maxHealth:
                stats.maxHealth,

            avoided:
                false,

            lethal:
                newHealth <= 0,

            savePromise:
                trapSavePromise

        });


    } catch (error) {

        console.error(
            "Errore trappola:",
            error
        );


        setMessage(
            "Errore durante la risoluzione della trappola."
        );


        eventLocked =
            false;

    }

}


// ============================================================
// POPUP RISULTATO TRAPPOLA
// ============================================================

function openTrapResultPrompt(
    result
) {

    const oldOverlay =
        document.getElementById(
            "trap-event-overlay"
        );


    if (oldOverlay) {

        oldOverlay.remove();

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "trap-event-overlay";


    overlay.className =
        "combat-event-overlay";


    const modal =
        document.createElement(
            "div"
        );


    modal.className =
        "combat-event-modal";


    const resultText =
        result.avoided

            ? "RIESCI A EVITARE LA TRAPPOLA"

            : `SUBISCI ${result.damage} DANNI`;


    modal.innerHTML = `

        <div class="combat-event-icon">
            ⚠
        </div>

        <h2>
            ${escapeTrapHtml(
                result.title
            )}
        </h2>

        <p>
            ${escapeTrapHtml(
                result.message
            )}
        </p>

        <div class="combat-event-warning">

            <div>
                <strong>Tiro:</strong>
                1d10 = ${result.roll}
            </div>

            <div>
                <strong>LCK:</strong>
                ${result.luck}
            </div>

            <div>
                <strong>Risultato:</strong>
                ${result.roll} - ${result.luck}
                = ${result.trapResult}
            </div>

            <div>
                <strong>${escapeTrapHtml(
                    result.defenseLabel
                )}:</strong>
                ${result.defense}
            </div>

            <br>

            <div>
                <strong>
                    ${escapeTrapHtml(
                        resultText
                    )}
                </strong>
            </div>

            <div>
                Vita:
                ${result.currentHealth}
                /
                ${result.maxHealth}
            </div>

        </div>

        <div class="combat-event-buttons">

            <button
                id="trap-event-close"
                type="button"
                class="combat-event-button combat-event-cancel"
            >
                CONTINUA
            </button>

        </div>
    `;


    overlay.appendChild(
        modal
    );


    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "trap-event-close"
        )
        ?.addEventListener(
            "click",
            async () => {

                overlay.remove();


                if (
                    result.lethal ===
                    true
                ) {

                    // In caso di morte aspettiamo solo che il danno
                    // sia stato persistito prima di archiviare/eliminare.
                    if (
                        result.savePromise
                    ) {

                        await result.savePromise;

                    }


                    try {

                        const temporalCoinActivated =
                            await tryConsumeTemporalCoinAfterDamage();


                        if (temporalCoinActivated) {

                            eventLocked =
                                false;

                            return;

                        }

                    } catch (temporalCoinError) {

                        console.error(
                            "Errore attivazione Moneta Temporale dopo trappola:",
                            temporalCoinError
                        );

                        setMessage(
                            "Errore durante il controllo della Moneta Temporale."
                        );

                        eventLocked =
                            false;

                        return;

                    }


                    await handleCharacterDeath();

                    return;

                }


                // Per i colpi non letali non attendiamo Supabase.
                // Il giocatore può riprendere subito a muoversi.
                eventLocked =
                    false;

            }
        );

}


// ============================================================
// ESCAPE HTML POPUP TRAPPOLA
// ============================================================

function escapeTrapHtml(
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
// MONETA TEMPORALE - SALVATAGGIO DA DANNO LETALE
// ============================================================
//
// Questa funzione viene chiamata SOLO nei flussi di danno letale.
// Le morti narrative/speciali (es. scale) non passano da qui.
//
// Ritorna true se una Moneta Temporale è stata consumata e il PG
// è stato ripristinato a PF/PM massimi.
// ============================================================

async function tryConsumeTemporalCoinAfterDamage() {

    if (
        !character ||
        !character.id
    ) {
        return false;
    }


    const {
        data,
        error
    } =
        await db.rpc(
            "try_consume_temporal_coin",
            {
                p_character_id:
                    character.id,

                p_combat_id:
                    null
            }
        );


    if (error) {
        throw error;
    }


    if (
        !data ||
        data.activated !== true
    ) {
        return false;
    }


    character.current_hp =
        Number(
            data.current_hp
        ) || 0;


    character.current_pm =
        Number(
            data.current_pm
        ) || 0;


    // La moneta è stata rimossa dal DB: riallineiamo inventario,
    // bonus, pannello e Presence.
    await loadCharacterEquipment();

    updateCharacterPanel();


    try {
        await updateMyPresence();
    } catch (presenceError) {
        console.warn(
            "Errore Presence dopo Moneta Temporale:",
            presenceError
        );
    }


    setMessage(
        "La Moneta Temporale si frantuma: il tempo si riavvolge e torni al massimo di PF e PM."
    );

// ============================================================
// RIPRISTINO MOVIMENTO DOPO MONETA TEMPORALE
// ============================================================

eventLocked = false;

movementQueue.length = 0;

movementQueueRunning = false;

// Evita che un elemento del popup appena chiuso
// mantenga inutilmente il focus.
if (
    document.activeElement instanceof HTMLElement
) {
    document.activeElement.blur();
}

    return true;

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
            "../../morte.html";


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

    updateMonkeySignVisibility();


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


    // I varchi Boss chiusi sono pareti ottiche complete.
    // Questo controllo aggiuntivo evita che la supercover
    // lasci visibile la prima casella immediatamente oltre
    // il varco, soprattutto sulle diagonali.

    if (
        !hasBossRoomAccess() &&
        BOSS_ROOM_GATE_CELLS.some(
            gate => {

                return doesSightSegmentCrossCell(
                    startX,
                    startY,
                    targetX,
                    targetY,
                    gate.x,
                    gate.y
                );

            }
        )
    ) {
        return false;
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

    // I varchi della stanza Boss bloccano anche la visuale
    // finché questo personaggio non possiede l'accesso.

    if (
        isBossRoomGateCell(
            x,
            y
        )
        &&
        !hasBossRoomAccess()
    ) {

        return true;

    }


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


            // Dietro a un varco Boss ancora chiuso:
            // nero pieno anche se la cella era già stata
            // esplorata in precedenza.

            if (
                isHiddenBehindClosedBossGate(
                    x,
                    y
                )
            ) {

                context.fillStyle =
                    "rgba(0, 0, 0, 1)";

                context.fillRect(
                    x * cellWidth - 0.5,
                    y * cellHeight - 0.5,
                    cellWidth + 1,
                    cellHeight + 1
                );

                continue;

            }


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


        // DEBUG REALTIME: durante questo test i PG remoti restano
        // sempre visibili. Quando il movimento sarà stabile,
        // riattiveremo il filtro della nebbia separatamente.
        token.style.display = "flex";

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
// ALTEZZA CHAT = ALTEZZA MAPPA
// ============================================================

function syncDungeonChatHeightWithMap() {

    const socialColumn =
        document.querySelector(
            ".dungeon-social-column"
        );

    const chatPanel =
        document.querySelector(
            ".dungeon-chat-panel"
        );

    const mapFrame =
        document.querySelector(
            ".dungeon-map-frame"
        );

    const messages =
        document.getElementById(
            "floor-chat-messages"
        );

    const controls =
        document.querySelector(
            ".floor-chat-controls"
        );

    if (
        !socialColumn ||
        !chatPanel ||
        !mapFrame ||
        !messages
    ) {

        return;
    }

    if (
        window.innerWidth <=
        1050
    ) {

        socialColumn.style.height =
            "";

        socialColumn.style.maxHeight =
            "";

        chatPanel.style.height =
            "";

        chatPanel.style.maxHeight =
            "";

        chatPanel.style.minHeight =
            "";

        return;
    }

    const mapHeight =
        mapFrame
            .getBoundingClientRect()
            .height;

    if (
        !Number.isFinite(mapHeight) ||
        mapHeight <= 0
    ) {

        return;
    }

    socialColumn.style.height =
        `${mapHeight}px`;

    socialColumn.style.maxHeight =
        `${mapHeight}px`;

    chatPanel.style.flex =
        "1 1 auto";

    chatPanel.style.height =
        "auto";

    chatPanel.style.minHeight =
        "0";

    chatPanel.style.maxHeight =
        "none";

    chatPanel.style.display =
        "flex";

    chatPanel.style.flexDirection =
        "column";

    chatPanel.style.overflow =
        "hidden";

    messages.style.flex =
        "1 1 auto";

    messages.style.minHeight =
        "0";

    messages.style.height =
        "auto";

    messages.style.maxHeight =
        "none";

    messages.style.overflowY =
        "auto";

    messages.style.overflowX =
        "hidden";

    if (controls) {

        controls.style.flex =
            "0 0 auto";
    }
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
// CARICA STORICO CHAT
// ============================================================

async function loadFloorChatHistory() {

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
                    DUNGEON_CHAT_FLOOR_ID
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    DUNGEON_CHAT_HISTORY_LIMIT
                );

        if (error) {
            throw error;
        }

        renderedFloorChatMessageIds.clear();

        container.innerHTML =
            "";

        const rows =
            Array.isArray(data)
                ? [...data]
                : [];

        if (
            rows.length === 0
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

                addFloorChatMessage(
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
            "Errore caricamento storico chat:",
            error
        );
    }
}


// ============================================================
// INVIA CHAT
// ============================================================

async function sendFloorChatMessage(
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
                        DUNGEON_CHAT_FLOOR_ID,

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

        addFloorChatMessage(
            message
        );

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

            } catch (broadcastError) {

                console.error(
                    "Errore broadcast chat:",
                    broadcastError
                );
            }
        }

    } catch (error) {

        console.error(
            "Errore salvataggio chat:",
            error
        );

        input.value =
            originalValue;

        setMessage(
            "Non è stato possibile inviare il messaggio."
        );
    }
}


// ============================================================
// MOSTRA CHAT
// ============================================================

function addFloorChatMessage(
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
        renderedFloorChatMessageIds.has(
            messageId
        )
    ) {
        return;
    }

    if (messageId) {

        renderedFloorChatMessageIds.add(
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

    if (
        messageId
    ) {
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

        // Lo storico è già ordinato:
        // più recente -> più vecchio.
        container.appendChild(
            row
        );

    } else {

        // I nuovi messaggi entrano sempre in cima.
        container.prepend(
            row
        );

    }

    container.scrollTop =
        0;
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


        updateDungeonCamera(
            true
        );

        repositionAllTokens();

        updateFogOfWar();

    }
);


// ============================================================
// FOCUS
// ============================================================

window.addEventListener(
    "focus",
    async () => {

        await refreshDungeonCharacter();


        updateDungeonCamera(
            true
        );

        repositionAllTokens();

        updateFogOfWar();

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