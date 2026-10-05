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
// VENDOR - MANO DI SCIMMIA
// ============================================================

const BASE_VENDOR_X = 22;
const BASE_VENDOR_Y = 13;

const BASE_VENDOR_PAGE =
    "services/vendor/vendor.html";

let baseVendorEntering =
    false;


// ============================================================
// RUNOGRAFO
// ============================================================

const BASE_RUNOGRAFO_X = 18;
const BASE_RUNOGRAFO_Y = 21;

const BASE_RUNOGRAFO_PAGE =
    "services/runografo/runografo.html";

let baseRunografoEntering =
    false;


// ============================================================
// LOCANDA - FEGATO D'OCA
// ============================================================

const BASE_LOCANDA_X = 4;
const BASE_LOCANDA_Y = 15;

const BASE_LOCANDA_PAGE =
    "services/locanda/locanda.html";

let baseLocandaEntering =
    false;


// ============================================================
// ADDESTRATORE - CODA D'ORSO
// ============================================================

const BASE_ADDESTRATORE_X = 22;
const BASE_ADDESTRATORE_Y = 18;

const BASE_ADDESTRATORE_PAGE =
    "services/addestratore/addestratore.html";

let baseAddestratoreEntering =
    false;


// ============================================================
// QUEST GIVER - DENTE DI CASTORO
// ============================================================

const BASE_QUEST_GIVER_X = 13;
const BASE_QUEST_GIVER_Y = 21;

const BASE_QUEST_GIVER_PAGE =
    "services/questgiver/questgiver.html";

let baseQuestGiverEntering =
    false;


// ============================================================
// RIPOSO NELL'AREA DELLA LOCANDA
// ============================================================

let baseInnResting =
    false;

let baseInnState =
    null;

let baseInnTimer =
    null;

let baseInnTickBusy =
    false;


// ============================================================
// DATABASE / REALTIME LIVELLO BASE
// ============================================================

let basePositionSaveTimer = null;
let basePositionSaveRunning = false;
let basePositionSavePending = false;

let baseChannel = null;
let baseRealtimeReady = false;

// Giocatori remoti presenti nel Livello Base.
// La Presence mantiene lo stato, mentre queste Map gestiscono
// i token realmente renderizzati sulla mappa.
const baseOtherPlayers = new Map();
const baseOtherPlayerTokens = new Map();

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

// ============================================================
// ABILITÀ / CONSUMABILI NELLA BASE
// ============================================================

let characterInventory = [];
let characterAbilities = [];
let baseActionsReady = false;


document.addEventListener("DOMContentLoaded", async () => {
    try {
        setMessage("Caricamento del Livello Base...");

        setupBaseVolumeControl();

        await loadBaseMapDefinition();
        await loadCharacter();
        await loadCharacterEquipment();
        await loadBaseAbilities();

        updateCharacterPanel();
        setupBaseActions();
        updateBaseConsumables();
        updateBaseAbilityVisibility();

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


// ----------------------------------------------------
// SERVIZI DEL LIVELLO BASE
// ----------------------------------------------------

if (
    typeof initializeBaseServices ===
    "function"
) {
    await initializeBaseServices();
}

// Se il personaggio ricarica la Base mentre si trova già
// nell'area della Locanda, ripristina subito lo stato di riposo.
await updateBaseInnRestState();


setupBaseCamera();
setupBaseNoticeboard();
setupBaseMovement();

        // ----------------------------------------------------
        // EVENTI SULLA CASELLA DI ARRIVO
        // ----------------------------------------------------
        //
        // Quando il PG arriva qui tramite le scale del dungeon,
        // NON riapriamo immediatamente il popup della stessa
        // scala. Il flag viene consumato una sola volta.
        // ----------------------------------------------------

        let skipArrivalEvent =
            false;

        try {

            skipArrivalEvent =
                sessionStorage.getItem(
                    "palazzo_eterno_skip_base_arrival_event"
                ) ===
                "1";

            if (skipArrivalEvent) {

                sessionStorage.removeItem(
                    "palazzo_eterno_skip_base_arrival_event"
                );

            }

        } catch (storageError) {

            console.warn(
                "Impossibile leggere flag arrivo Base:",
                storageError
            );

        }


        if (
            !skipArrivalEvent &&
            typeof checkBaseTeleportEvent ===
            "function"
        ) {
            checkBaseTeleportEvent();
        }

// ----------------------------------------------------
// SERVIZIO PRESENTE SULLA CASELLA DI ARRIVO
// ----------------------------------------------------

if (
    typeof checkBaseServiceArea ===
    "function"
) {
    await checkBaseServiceArea(
        basePlayerX,
        basePlayerY
    );
}

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
        characterInventory = [];
        return;
    }

    const { data, error } = await db
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
        .eq("character_id", character.id);

    if (error) {
        console.warn(
            "Inventario/equipaggiamento non disponibile nel Livello Base:",
            error
        );
        characterInventory = [];
        return;
    }

    characterInventory = data || [];

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
        .filter(entry => entry.equipped_slot && entry.item)
        .forEach(entry => {
            const item = entry.item;

            Object.keys(equipmentBonuses).forEach(key => {
                equipmentBonuses[key] +=
                    Number(item?.[key]) || 0;
            });
        });

    updateBaseConsumables();
}

// ============================================================
// ABILITÀ PERSONAGGIO NELLA BASE
// ============================================================

async function loadBaseAbilities() {
    if (!character) {
        characterAbilities = [];
        return;
    }

    const { data, error } = await db
        .from("character_abilities")
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
        .eq("character_id", character.id);

    if (error) {
        console.warn(
            "Abilità non disponibili nel Livello Base:",
            error
        );
        characterAbilities = [];
        return;
    }

    characterAbilities = data || [];
}

function hasBaseAbility(abilityId) {
    return characterAbilities.some(
        entry =>
            entry.ability_id === abilityId ||
            entry.ability?.id === abilityId
    );
}

function updateBaseAbilityVisibility() {
    const healButton =
        document.getElementById("dungeon-heal-button");

    if (healButton) {
        healButton.style.display =
            hasBaseAbility("cura") ? "" : "none";
    }

    updateBaseActionAvailability();
}

// ============================================================
// AZIONI / CONSUMABILI NELLA BASE
// ============================================================

function setupBaseActions() {
    if (baseActionsReady) {
        return;
    }

    baseActionsReady = true;

    const healButton =
        document.getElementById("dungeon-heal-button");

    const healthPotionButton =
        document.getElementById("dungeon-health-potion-button");

    const manaPotionButton =
        document.getElementById("dungeon-mana-potion-button");

    if (healButton) {
        healButton.addEventListener("click", async () => {
            if (healButton.disabled) {
                return;
            }

            await useBaseHeal();
        });
    }

    if (healthPotionButton) {
        healthPotionButton.addEventListener("click", async () => {
            if (healthPotionButton.disabled) {
                return;
            }

            await useBasePotion("health");
        });
    }

    if (manaPotionButton) {
        manaPotionButton.addEventListener("click", async () => {
            if (manaPotionButton.disabled) {
                return;
            }

            await useBasePotion("mana");
        });
    }

    updateBaseActionAvailability();
}

function findBasePotion(type) {
    return characterInventory.find(entry => {
        if (!entry.item || Number(entry.quantity) <= 0) {
            return false;
        }

        if (type === "health") {
            return (Number(entry.item.heal_pf) || 0) > 0;
        }

        if (type === "mana") {
            return (Number(entry.item.heal_pm) || 0) > 0;
        }

        return false;
    });
}

function updateBaseConsumables() {
    const healthPotion = findBasePotion("health");
    const manaPotion = findBasePotion("mana");

    setText(
        "dungeon-health-potion-count",
        `x${healthPotion ? Number(healthPotion.quantity) || 0 : 0}`
    );

    setText(
        "dungeon-mana-potion-count",
        `x${manaPotion ? Number(manaPotion.quantity) || 0 : 0}`
    );

    updateBaseActionAvailability();
}

function updateBaseActionAvailability() {
    if (!character) {
        return;
    }

    const stats = getCalculatedStats();

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined
            ? stats.maxHealth
            : Number(character.current_hp);

    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined
            ? stats.maxMana
            : Number(character.current_pm);

    const healButton =
        document.getElementById("dungeon-heal-button");

    if (healButton) {
        healButton.disabled =
            !hasBaseAbility("cura") ||
            currentPM < 2 ||
            currentPF >= stats.maxHealth;
    }

    const healthButton =
        document.getElementById("dungeon-health-potion-button");

    const manaButton =
        document.getElementById("dungeon-mana-potion-button");

    if (healthButton) {
        healthButton.disabled =
            !findBasePotion("health") ||
            currentPF >= stats.maxHealth;
    }

    if (manaButton) {
        manaButton.disabled =
            !findBasePotion("mana") ||
            currentPM >= stats.maxMana;
    }
}

async function useBasePotion(type) {
    const potion = findBasePotion(type);

    if (!potion) {
        setMessage(
            type === "health"
                ? "Non hai Pozioni di Vita."
                : "Non hai Pozioni di Mana."
        );
        return;
    }

    const stats = getCalculatedStats();

    const oldPF =
        character.current_hp === null ||
        character.current_hp === undefined
            ? stats.maxHealth
            : Number(character.current_hp);

    const oldPM =
        character.current_pm === null ||
        character.current_pm === undefined
            ? stats.maxMana
            : Number(character.current_pm);

    let newPF = oldPF;
    let newPM = oldPM;

    if (type === "health") {
        if (oldPF >= stats.maxHealth) {
            setMessage("Hai già tutti i PF.");
            return;
        }

        newPF = Math.min(
            stats.maxHealth,
            oldPF + (Number(potion.item.heal_pf) || 0)
        );
    } else {
        if (oldPM >= stats.maxMana) {
            setMessage("Hai già tutti i PM.");
            return;
        }

        newPM = Math.min(
            stats.maxMana,
            oldPM + (Number(potion.item.heal_pm) || 0)
        );
    }

    try {
        const { error: rpcError } = await db.rpc(
            "use_inventory_item",
            {
                p_inventory_id: potion.id
            }
        );

        if (rpcError) {
            throw rpcError;
        }

        const updateData =
            type === "health"
                ? { current_hp: newPF }
                : { current_pm: newPM };

        const { error } = await db
            .from("characters")
            .update(updateData)
            .eq("id", character.id);

        if (error) {
            throw error;
        }

        if (type === "health") {
            character.current_hp = newPF;
        } else {
            character.current_pm = newPM;
        }

        await loadCharacterEquipment();
        updateCharacterPanel();
        updateBaseActionAvailability();
        await updateBasePresence();

        setMessage(
            type === "health"
                ? `Bevi una Pozione di Vita e recuperi ${newPF - oldPF} PF.`
                : `Bevi una Pozione di Mana e recuperi ${newPM - oldPM} PM.`
        );
    } catch (error) {
        console.error("Errore utilizzo pozione nella Base:", error);
        setMessage("Non è stato possibile utilizzare la pozione.", true);
    }
}

async function useBaseHeal() {
    if (!character || !hasBaseAbility("cura")) {
        setMessage("Il personaggio non conosce Cura.");
        return;
    }

    const stats = getCalculatedStats();

    const currentPF =
        character.current_hp === null ||
        character.current_hp === undefined
            ? stats.maxHealth
            : Number(character.current_hp);

    const currentPM =
        character.current_pm === null ||
        character.current_pm === undefined
            ? stats.maxMana
            : Number(character.current_pm);

    if (currentPF >= stats.maxHealth) {
        setMessage("Hai già tutti i PF.");
        return;
    }

    if (currentPM < 2) {
        setMessage("Non hai abbastanza PM per usare Cura.");
        return;
    }

    const level = Number(character.livello) || 1;
    const healAmount = stats.intelligenza + level;
    const newPF = Math.min(stats.maxHealth, currentPF + healAmount);
    const newPM = Math.max(0, currentPM - 2);

    try {
        const { error } = await db
            .from("characters")
            .update({
                current_hp: newPF,
                current_pm: newPM
            })
            .eq("id", character.id);

        if (error) {
            throw error;
        }

        character.current_hp = newPF;
        character.current_pm = newPM;

        updateCharacterPanel();
        updateBaseActionAvailability();
        await updateBasePresence();

        setMessage(
            `Usi Cura e recuperi ${newPF - currentPF} PF. (-2 PM)`
        );
    } catch (error) {
        console.error("Errore Cura nella Base:", error);
        setMessage("Non è stato possibile usare Cura.", true);
    }
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
// BACHECA DELLA BASE
// ============================================================
//
// La grafica della bacheca è già incorporata direttamente
// nell'immagine della mappa. Qui gestiamo soltanto:
// - celle occupate;
// - apertura del popup;
// - contenuti e tab.
//
// ============================================================

const BASE_NOTICEBOARD_CELLS =
    new Set([
        "14,10",
        "15,10"
    ]);

const BASE_NOTICEBOARD_CONTENT = {
    novita: {
        title: "COSA C'È DI NUOVO",
        items: [
            "Il Livello Base è ora accessibile dal dungeon.",
            "Mano di Scimmia si è trasferito alla Base.",
            "Sono iniziati i lavori per i nuovi servizi della Base."
        ]
    },

    upgrade: {
        title: "PROSSIMI UPGRADE",
        items: [
            "Sistema di costruzione e potenziamento dei servizi.",
            "Scambio tra giocatori."
        ]
    },

    avvisi: {
        title: "AVVISI",
        items: [
            "Nuovi contenuti verranno aggiunti progressivamente."
        ]
    }
};

let baseNoticeboardActiveTab =
    "novita";


// ============================================================
// ARREDI STATICI LIVELLO BASE
// ============================================================
//
// Gli arredi vengono posizionati come overlay assoluti
// direttamente sulla griglia della mappa.
//
// Questo primo elemento è il tappeto della locanda:
//
// X12 Y20
// X13 Y20
// X14 Y20
// X12 Y21
// X13 Y21
// X14 Y21
// ============================================================

const BASE_STATIC_DECORATIONS = [
    {
        id: "tappeto_quest",
        imageSrc: "immagini/tappetoX.png",
        alt: "Tappeto quest",
        x: 12,
        y: 20,
        width: 3,
        height: 2,
        zIndex: 6
    },
    {
        id: "tappeto_runografo",
        imageSrc: "immagini/tappetoX.png",
        alt: "Tappeto runografo",
        x: 17,
        y: 20,
        width: 3,
        height: 2,
        zIndex: 6
    },
    {
        id: "tappeto_addestratore",
        imageSrc: "immagini/tappetoY.png",
        alt: "Tappeto addestratore",
        x: 21,
        y: 17,
        width: 2,
        height: 3,
        zIndex: 6
    },
    {
        id: "tappeto_vendor",
        imageSrc: "immagini/tappeto_giallo.png",
        alt: "Tappeto vendor",
        x: 21,
        y: 12,
        width: 2,
        height: 3,
        zIndex: 6
    },
    {
        id: "mano_di_scimmia",
        imageSrc: "../immagini/eventi/vendor.png",
        alt: "Mano di Scimmia",
        x: 22,
        y: 13,
        width: 1,
        height: 1,
        zIndex: 12
    },
    {
        id: "locanda",
        imageSrc: "immagini/locandaX.png",
        alt: "Locanda",
        x: 3,
        y: 14,
        width: 4,
        height: 6,
        zIndex: 7
    }
];

const baseStaticDecorationElements =
    new Map();


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

    renderBaseStaticDecorations();
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

    basePlayerToken.style.zIndex =
        "20";
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
// CREA GLI ARREDI STATICI DELLA BASE
// ============================================================

function renderBaseStaticDecorations() {
    const map =
        document.getElementById("dungeon-map");

    if (!map) {
        return;
    }

    BASE_STATIC_DECORATIONS.forEach(
        decoration => {

            let element =
                baseStaticDecorationElements.get(
                    decoration.id
                );

            if (!element) {
                element =
                    document.createElement("img");

                element.className =
                    "base-static-decoration";

                element.dataset.decorationId =
                    decoration.id;

                element.src =
                    decoration.imageSrc;

                element.alt =
                    decoration.alt || "";

                element.draggable =
                    false;

                element.style.position =
                    "absolute";

                element.style.pointerEvents =
                    decoration.id === "mano_di_scimmia"
                        ? "auto"
                        : "none";

                element.style.cursor =
                    decoration.id === "mano_di_scimmia"
                        ? "pointer"
                        : "default";

                element.style.objectFit =
                    "contain";

                element.style.display =
                    "block";

                element.style.userSelect =
                    "none";

                if (
                    decoration.id ===
                    "mano_di_scimmia"
                ) {
                    element.title =
                        "Mano di Scimmia";

                    element.addEventListener(
                        "click",
                        async event => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (
                                !isBaseVendorAdjacentToPlayer()
                            ) {
                                setMessage(
                                    "Avvicinati a Mano di Scimmia per commerciare."
                                );

                                return;
                            }

                            await enterBaseVendor();
                        }
                    );
                }



                map.appendChild(element);

                baseStaticDecorationElements.set(
                    decoration.id,
                    element
                );
            }

        }
    );

    positionBaseStaticDecorations();
}


// ============================================================
// POSIZIONA GLI ARREDI STATICI SULLA GRIGLIA
// ============================================================

function positionBaseStaticDecorations() {
    const map =
        document.getElementById("dungeon-map");

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
        BASE_MAP_COLUMNS;

    const cellHeight =
        rect.height /
        BASE_MAP_ROWS;

    BASE_STATIC_DECORATIONS.forEach(
        decoration => {

            const element =
                baseStaticDecorationElements.get(
                    decoration.id
                );

            if (!element) {
                return;
            }

            element.style.left =
                `${decoration.x * cellWidth}px`;

            element.style.top =
                `${decoration.y * cellHeight}px`;

            element.style.width =
                `${decoration.width * cellWidth}px`;

            element.style.height =
                `${decoration.height * cellHeight}px`;

            element.style.zIndex =
                String(
                    decoration.zIndex ?? 6
                );

                if (
    decoration.id ===
    "locanda"
) {
    const scale = 1.12;

    element.style.transform =
        `translateY(-10px) scale(${scale})`;

    element.style.transformOrigin =
        "center center";
}

        }
    );
}


// ============================================================
// VENDOR - MANO DI SCIMMIA
// ============================================================

function isBaseVendorCell(
    x,
    y
) {
    return (
        Number(x) ===
            BASE_VENDOR_X
        &&
        Number(y) ===
            BASE_VENDOR_Y
    );
}


function isBaseVendorAdjacentToPlayer() {
    if (
        basePlayerX === null ||
        basePlayerY === null
    ) {
        return false;
    }

    const distance =
        Math.abs(
            Number(basePlayerX) -
            BASE_VENDOR_X
        )
        +
        Math.abs(
            Number(basePlayerY) -
            BASE_VENDOR_Y
        );

    return distance === 1;
}


async function enterBaseVendor() {
    if (
        baseVendorEntering ||
        !character
    ) {
        return;
    }

    if (
        !isBaseVendorAdjacentToPlayer()
    ) {
        setMessage(
            "Avvicinati a Mano di Scimmia per commerciare."
        );

        return;
    }

    baseVendorEntering =
        true;

    setMessage(
        "Ti avvicini a Mano di Scimmia..."
    );

    try {
        // Salva immediatamente la posizione attuale della Base.
        if (basePositionSaveTimer) {
            clearTimeout(
                basePositionSaveTimer
            );

            basePositionSaveTimer =
                null;
        }

        basePositionSavePending =
            false;

        await flushBasePositionSave();

        // Ricorda al negozio da dove siamo arrivati.
        try {
            sessionStorage.setItem(
                "palazzo_eterno_vendor_return",
                "base"
            );
        } catch (storageError) {
            console.warn(
                "Impossibile salvare origine vendor:",
                storageError
            );
        }

        const {
            error
        } =
            await db
                .from("characters")
                .update({
                    base_x:
                        Number(basePlayerX),

                    base_y:
                        Number(basePlayerY),

                    current_location:
                        "vendor"
                })
                .eq(
                    "id",
                    character.id
                );

        if (error) {
            throw error;
        }

        character.base_x =
            Number(basePlayerX);

        character.base_y =
            Number(basePlayerY);

        character.current_location =
            "vendor";

        window.location.href =
            BASE_VENDOR_PAGE;

    } catch (error) {
        console.error(
            "Errore ingresso vendor dalla Base:",
            error
        );

        baseVendorEntering =
            false;

        setMessage(
            "Non riesco ad aprire il negozio. Riprova."
        );
    }
}


// ============================================================
// RUNOGRAFO
// ============================================================

function isBaseRunografoCell(
    x,
    y
) {

    return (
        Number(x) ===
            BASE_RUNOGRAFO_X
        &&
        Number(y) ===
            BASE_RUNOGRAFO_Y
    );
}


function isBaseRunografoActive() {

    if (
        typeof isBaseServiceActive !==
        "function"
    ) {

        return false;
    }

    return (
        isBaseServiceActive(
            "runografo"
        ) ===
        true
    );
}


async function enterBaseRunografo() {

    if (
        baseRunografoEntering ||
        !character
    ) {

        return;
    }

    if (
        !isBaseRunografoActive()
    ) {

        return;
    }

    baseRunografoEntering =
        true;

    setMessage(
        "Ti avvicini al Runografo..."
    );

    try {

        if (
            basePositionSaveTimer
        ) {

            clearTimeout(
                basePositionSaveTimer
            );

            basePositionSaveTimer =
                null;
        }

        basePositionSavePending =
            false;

        await flushBasePositionSave();

        const {
            error
        } =
            await db
                .from(
                    "characters"
                )
                .update({
                    base_x:
                        Number(
                            basePlayerX
                        ),

                    base_y:
                        Number(
                            basePlayerY
                        )
                })
                .eq(
                    "id",
                    character.id
                );

        if (error) {
            throw error;
        }

        character.base_x =
            Number(
                basePlayerX
            );

        character.base_y =
            Number(
                basePlayerY
            );

        /*
         * Il Runografo è un servizio interno al Livello Base.
         * Non cambiamo current_location: il PG resta logicamente
         * nella Base anche mentre usa il servizio.
         */

        window.location.href =
            BASE_RUNOGRAFO_PAGE;

    } catch (error) {

        console.error(
            "Errore ingresso Runografo dalla Base:",
            error
        );

        baseRunografoEntering =
            false;

        setMessage(
            "Non riesco ad aprire il Runografo. Riprova.",
            true
        );
    }
}



// ============================================================
// ADDESTRATORE - CODA D'ORSO
// ============================================================

function isBaseAddestratoreCell(x, y) {
    return (
        Number(x) === BASE_ADDESTRATORE_X &&
        Number(y) === BASE_ADDESTRATORE_Y
    );
}

function isBaseAddestratoreActive() {
    if (typeof isBaseServiceActive !== "function") {
        return false;
    }

    return isBaseServiceActive("addestratore") === true;
}

async function enterBaseAddestratore() {
    if (baseAddestratoreEntering || !character) {
        return;
    }

    if (!isBaseAddestratoreActive()) {
        return;
    }

    baseAddestratoreEntering = true;
    setMessage("Ti avvicini a Coda d'Orso...");

    try {
        if (basePositionSaveTimer) {
            clearTimeout(basePositionSaveTimer);
            basePositionSaveTimer = null;
        }

        basePositionSavePending = false;
        await flushBasePositionSave();

        const { error } = await db
            .from("characters")
            .update({
                base_x: Number(basePlayerX),
                base_y: Number(basePlayerY)
            })
            .eq("id", character.id);

        if (error) {
            throw error;
        }

        character.base_x = Number(basePlayerX);
        character.base_y = Number(basePlayerY);

        // Servizio interno alla Base: current_location resta "base".
        window.location.href = BASE_ADDESTRATORE_PAGE;

    } catch (error) {
        console.error("Errore ingresso Addestratore dalla Base:", error);
        baseAddestratoreEntering = false;
        setMessage("Non riesco ad aprire l'Addestratore. Riprova.", true);
    }
}


// ============================================================
// QUEST GIVER - DENTE DI CASTORO
// ============================================================

function isBaseQuestGiverCell(x, y) {
    return (
        Number(x) === BASE_QUEST_GIVER_X &&
        Number(y) === BASE_QUEST_GIVER_Y
    );
}

function isBaseQuestGiverActive() {
    if (typeof isBaseServiceActive !== "function") {
        return false;
    }

    return isBaseServiceActive("quest_giver") === true;
}

async function enterBaseQuestGiver() {
    if (baseQuestGiverEntering || !character) {
        return;
    }

    if (!isBaseQuestGiverActive()) {
        return;
    }

    baseQuestGiverEntering = true;
    setMessage("Ti avvicini a Dente di Castoro...");

    try {
        if (basePositionSaveTimer) {
            clearTimeout(basePositionSaveTimer);
            basePositionSaveTimer = null;
        }

        basePositionSavePending = false;
        await flushBasePositionSave();

        const { error } = await db
            .from("characters")
            .update({
                base_x: Number(basePlayerX),
                base_y: Number(basePlayerY)
            })
            .eq("id", character.id);

        if (error) {
            throw error;
        }

        character.base_x = Number(basePlayerX);
        character.base_y = Number(basePlayerY);

        // Servizio interno alla Base: current_location resta "base".
        window.location.href = BASE_QUEST_GIVER_PAGE;

    } catch (error) {
        console.error("Errore ingresso Quest Giver dalla Base:", error);
        baseQuestGiverEntering = false;
        setMessage("Non riesco ad aprire le Missioni. Riprova.", true);
    }
}


// ============================================================
// LOCANDA - FEGATO D'OCA
// ============================================================

function isBaseLocandaCell(
    x,
    y
) {

    return (
        Number(x) ===
            BASE_LOCANDA_X
        &&
        Number(y) ===
            BASE_LOCANDA_Y
    );
}


function isBaseLocandaActive() {

    if (
        typeof isBaseServiceActive !==
        "function"
    ) {

        return false;
    }

    return (
        isBaseServiceActive(
            "locanda"
        ) ===
        true
    );
}


async function enterBaseLocanda() {

    if (
        baseLocandaEntering ||
        !character
    ) {

        return;
    }

    if (
        !isBaseLocandaActive()
    ) {

        return;
    }

    baseLocandaEntering =
        true;

    setMessage(
        "Entri nella Locanda di Fegato d'Oca..."
    );

    try {

        if (
            basePositionSaveTimer
        ) {

            clearTimeout(
                basePositionSaveTimer
            );

            basePositionSaveTimer =
                null;
        }

        basePositionSavePending =
            false;

        await flushBasePositionSave();

        const {
            error
        } =
            await db
                .from(
                    "characters"
                )
                .update({
                    base_x:
                        Number(
                            basePlayerX
                        ),

                    base_y:
                        Number(
                            basePlayerY
                        )
                })
                .eq(
                    "id",
                    character.id
                );

        if (error) {
            throw error;
        }

        character.base_x =
            Number(
                basePlayerX
            );

        character.base_y =
            Number(
                basePlayerY
            );

        /*
         * La Locanda è un servizio interno al Livello Base.
         * current_location resta "base", esattamente come
         * per il Runografo.
         */

        window.location.href =
            BASE_LOCANDA_PAGE;

    } catch (error) {

        console.error(
            "Errore ingresso Locanda dalla Base:",
            error
        );

        baseLocandaEntering =
            false;

        setMessage(
            "Non riesco ad entrare nella Locanda. Riprova.",
            true
        );
    }
}



// ============================================================
// RIPOSO NELL'AREA DELLA LOCANDA
// ============================================================
//
// La Locanda attiva cura il personaggio anche restando
// semplicemente sopra l'area dell'edificio:
//
// X 3..6
// Y 14..19
//
// Il timer continua anche entrando nella pagina di Fegato d'Oca,
// perché enter_inn() è idempotente e non resetta un riposo già
// attivo.
// ============================================================

function isPlayerInsideLocandaArea() {

    return (
        Number(basePlayerX) >= 3 &&
        Number(basePlayerX) <= 6 &&
        Number(basePlayerY) >= 14 &&
        Number(basePlayerY) <= 19
    );
}


async function refreshBaseInnState() {

    const {
        data,
        error
    } =
        await db.rpc(
            "get_inn_state"
        );

    if (error) {
        throw error;
    }

    baseInnState =
        data || null;

    return baseInnState;
}


function getBaseInnSecondsRemaining() {

    const target =
        Date.parse(
            baseInnState
                ?.next_regeneration_at
        );

    if (
        Number.isFinite(
            target
        )
    ) {

        return Math.max(
            0,
            Math.ceil(
                (
                    target -
                    Date.now()
                )
                /
                1000
            )
        );
    }

    return Math.max(
        0,
        Number(
            baseInnState
                ?.seconds_until_next_tick
        ) || 0
    );
}


async function updateBaseInnRestState() {

    if (
        !character
    ) {
        return;
    }

    const shouldRest =
        isBaseLocandaActive()
        &&
        isPlayerInsideLocandaArea();

    if (
        shouldRest
    ) {

        if (
            !baseInnResting
        ) {

            try {

                const {
                    error
                } =
                    await db.rpc(
                        "enter_inn"
                    );

                if (error) {
                    throw error;
                }

                baseInnResting =
                    true;

                await refreshBaseInnState();

                startBaseInnTimer();

                setMessage(
                    "Ti riposi nella Locanda. Recuperi 1 PF e 1 PM al minuto."
                );

            } catch (error) {

                console.warn(
                    "Errore ingresso area Locanda:",
                    error
                );
            }
        }

        return;
    }


    if (
        baseInnResting
    ) {

        baseInnResting =
            false;

        stopBaseInnTimer();

        baseInnState =
            null;

        try {

            const {
                error
            } =
                await db.rpc(
                    "leave_inn"
                );

            if (error) {
                throw error;
            }

        } catch (error) {

            console.warn(
                "Errore uscita area Locanda:",
                error
            );
        }
    }
}


function startBaseInnTimer() {

    stopBaseInnTimer();

    baseInnTimer =
        window.setInterval(
            async () => {

                if (
                    !baseInnResting ||
                    baseInnTickBusy
                ) {
                    return;
                }

                if (
                    !isBaseLocandaActive() ||
                    !isPlayerInsideLocandaArea()
                ) {

                    await updateBaseInnRestState();

                    return;
                }

                if (
                    getBaseInnSecondsRemaining() >
                    0
                ) {
                    return;
                }

                await runBaseInnRegenerationTick();

            },
            1000
        );
}


function stopBaseInnTimer() {

    if (
        baseInnTimer
    ) {

        clearInterval(
            baseInnTimer
        );

        baseInnTimer =
            null;
    }
}


async function runBaseInnRegenerationTick() {

    if (
        baseInnTickBusy
    ) {
        return;
    }

    baseInnTickBusy =
        true;

    try {

        const {
            data,
            error
        } =
            await db.rpc(
                "inn_regeneration_tick"
            );

        if (error) {
            throw error;
        }

        baseInnState =
            data || baseInnState;

        if (
            character
        ) {

            character.current_hp =
                data?.current_pf;

            character.current_pm =
                data?.current_pm;

            updateCharacterPanel();

            updateBasePresence();
        }

        const healedPf =
            Math.max(
                0,
                Number(
                    data?.healed_pf
                ) || 0
            );

        const healedPm =
            Math.max(
                0,
                Number(
                    data?.healed_pm
                ) || 0
            );

        if (
            healedPf > 0 ||
            healedPm > 0
        ) {

            setMessage(
                `Riposo in Locanda: +${healedPf} PF · +${healedPm} PM`
            );
        }

    } catch (error) {

        console.warn(
            "Errore rigenerazione area Locanda:",
            error
        );

        /*
         * Se il server rifiuta il tick perché il personaggio
         * non è più realmente nell'area, chiudiamo lo stato locale.
         */
        baseInnResting =
            false;

        stopBaseInnTimer();

        baseInnState =
            null;

    } finally {

        baseInnTickBusy =
            false;
    }
}


// ============================================================
// BACHECA - INTERAZIONE
// ============================================================

function isBaseNoticeboardCell(
    x,
    y
) {
    return BASE_NOTICEBOARD_CELLS.has(
        `${Number(x)},${Number(y)}`
    );
}


function isBaseNoticeboardAdjacentToPlayer() {
    if (
        basePlayerX === null ||
        basePlayerY === null
    ) {
        return false;
    }

    for (
        const cellKey
        of BASE_NOTICEBOARD_CELLS
    ) {
        const [
            cellX,
            cellY
        ] =
            cellKey
                .split(",")
                .map(Number);

        const distance =
            Math.abs(
                Number(basePlayerX) -
                cellX
            )
            +
            Math.abs(
                Number(basePlayerY) -
                cellY
            );

        if (
            distance === 1
        ) {
            return true;
        }
    }

    return false;
}


function setupBaseNoticeboard() {
    const modal =
        document.getElementById(
            "base-noticeboard-modal"
        );

    const closeButton =
        document.getElementById(
            "base-noticeboard-close"
        );

    const tabs =
        document.querySelectorAll(
            "[data-base-noticeboard-tab]"
        );

    if (!modal) {
        return;
    }

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeBaseNoticeboard
        );
    }

    tabs.forEach(
        tab => {
            tab.addEventListener(
                "click",
                () => {
                    const tabId =
                        tab.dataset
                            .baseNoticeboardTab;

                    if (
                        BASE_NOTICEBOARD_CONTENT[
                            tabId
                        ]
                    ) {
                        baseNoticeboardActiveTab =
                            tabId;

                        renderBaseNoticeboard();
                    }
                }
            );
        }
    );

    modal.addEventListener(
        "click",
        event => {
            if (
                event.target ===
                modal
            ) {
                closeBaseNoticeboard();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Escape"
                &&
                !modal.hidden
            ) {
                closeBaseNoticeboard();
            }
        }
    );

    renderBaseNoticeboard();
}


function openBaseNoticeboard() {
    const modal =
        document.getElementById(
            "base-noticeboard-modal"
        );

    if (!modal) {
        return;
    }

    renderBaseNoticeboard();

    modal.hidden =
        false;

    document.body.classList.add(
        "base-noticeboard-open"
    );
}


function closeBaseNoticeboard() {
    const modal =
        document.getElementById(
            "base-noticeboard-modal"
        );

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    document.body.classList.remove(
        "base-noticeboard-open"
    );
}


function renderBaseNoticeboard() {
    const content =
        BASE_NOTICEBOARD_CONTENT[
            baseNoticeboardActiveTab
        ];

    if (!content) {
        return;
    }

    const title =
        document.getElementById(
            "base-noticeboard-content-title"
        );

    const list =
        document.getElementById(
            "base-noticeboard-content-list"
        );

    if (title) {
        title.textContent =
            content.title;
    }

    if (list) {
        list.innerHTML =
            content.items
                .map(
                    item => `
                        <li>
                            ${escapeBaseNoticeboardHtml(
                                item
                            )}
                        </li>
                    `
                )
                .join("");
    }

    document
        .querySelectorAll(
            "[data-base-noticeboard-tab]"
        )
        .forEach(
            tab => {
                tab.classList.toggle(
                    "active",
                    tab.dataset
                        .baseNoticeboardTab ===
                        baseNoticeboardActiveTab
                );
            }
        );
}


function escapeBaseNoticeboardHtml(
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
            positionBaseStaticDecorations();
            positionBasePlayerToken();
            positionAllBaseRemotePlayerTokens();
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
    // BACHECA DELLA BASE
    // ========================================================
    //
    // Le caselle X14 Y10 e X15 Y10 sono occupate dalla bacheca.
    // Tentare di entrarci da una casella adiacente apre il popup.
    // ========================================================

    if (
        isBaseNoticeboardCell(
            newX,
            newY
        )
    ) {
        openBaseNoticeboard();

        return false;
    }

    // ========================================================
    // VENDOR - MANO DI SCIMMIA
    // ========================================================
    //
    // La sua casella è occupata. Se il PG prova a entrarci
    // da una casella adiacente, si apre direttamente il negozio.
    // ========================================================

    if (
        isBaseVendorCell(
            newX,
            newY
        )
    ) {
        enterBaseVendor();

        return false;
    }


    // ========================================================
    // RUNOGRAFO
    // ========================================================
    //
    // Quando il servizio è ACTIVE, la casella X18 Y21
    // è occupata dal Runografo.
    //
    // Come per Mano di Scimmia, il PG non può sovrapporsi
    // al token: tentare di entrare nella sua casella apre
    // direttamente il servizio.
    //
    // Quando il servizio non è ACTIVE, la casella torna
    // a comportarsi normalmente.
    // ========================================================

    if (
        isBaseRunografoCell(
            newX,
            newY
        )
        &&
        isBaseRunografoActive()
    ) {

        enterBaseRunografo();

        return false;
    }

    // ========================================================
    // ADDESTRATORE - CODA D'ORSO
    // ========================================================

    if (
        isBaseAddestratoreCell(newX, newY) &&
        isBaseAddestratoreActive()
    ) {
        enterBaseAddestratore();
        return false;
    }

    // ========================================================
    // QUEST GIVER - DENTE DI CASTORO
    // ========================================================
    //
    // Quando il servizio è ACTIVE, la casella X13 Y21 è
    // occupata da Dente di Castoro. Tentare di entrarci apre
    // la pagina Missioni senza sovrapporre il token.
    // Durante UNBUILT / BUILDING la casella resta libera.
    // ========================================================

    if (
        isBaseQuestGiverCell(newX, newY) &&
        isBaseQuestGiverActive()
    ) {
        enterBaseQuestGiver();
        return false;
    }


    // ========================================================
    // LOCANDA - FEGATO D'OCA
    // ========================================================
    //
    // Durante UNBUILT / BUILDING la casella resta libera:
    // il sistema generico dei servizi gestisce il popup di
    // costruzione entrando nell'area configurata in services.json.
    //
    // Solo quando LOCANDA è ACTIVE compare Fegato d'Oca.
    // Tentare di entrare nella sua casella apre il servizio,
    // senza permettere al PG di sovrapporsi al token.
    // ========================================================

    if (
        isBaseLocandaCell(
            newX,
            newY
        )
        &&
        isBaseLocandaActive()
    ) {

        enterBaseLocanda();

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
    broadcastBasePlayerState();

 if (
    typeof checkBaseTeleportEvent ===
    "function"
) {
    checkBaseTeleportEvent();
}


// ========================================================
// COMBAT DEL LIVELLO BASE
// ========================================================
//
// Dopo ogni movimento controlla se il PG è adiacente a uno
// dei due combat X8 Y7 / X10 Y7 definiti in eventi_base.js.
// Il controllo apre il popup singolo oppure la scelta tra i
// due scontri quando il PG si trova nella zona centrale.
// ========================================================

if (
    typeof checkNearbyBaseCombatEvents ===
    "function"
) {
    checkNearbyBaseCombatEvents();
}


// ========================================================
// SERVIZI DEL LIVELLO BASE
// ========================================================
//
// Controlla se il PG è entrato nell'area di uno dei
// servizi configurati in services.json.
//
// Il sistema servizi decide autonomamente quale popup
// mostrare e quale stato del servizio rappresentare.
// ========================================================

if (
    typeof checkBaseServiceArea ===
    "function"
) {
    checkBaseServiceArea(
        basePlayerX,
        basePlayerY
    );
}


// Aggiorna il riposo della Locanda dopo ogni movimento.
updateBaseInnRestState();


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

            syncBaseRemotePlayers();
            renderBaseOnlinePlayers();

            // Presence serve soprattutto a sapere chi è online.
            // Dopo un sync ribroadcastiamo anche la nostra posizione
            // così gli altri client possono aggiornarci subito.
            broadcastBasePlayerState();

        }
    );


    // ========================================================
    // MOVIMENTO ALTRI GIOCATORI
    // ========================================================

    baseChannel.on(
        "broadcast",
        {
            event:
                "base-player-move"
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

            if (
                data.location &&
                data.location !== "base"
            ) {
                return;
            }

            updateBaseRemotePlayer(
                data
            );

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

                            await broadcastBasePlayerState();

                            syncBaseRemotePlayers();
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


// ============================================================
// BROADCAST POSIZIONE BASE
// ============================================================

async function broadcastBasePlayerState() {

    if (
        !baseChannel ||
        !baseRealtimeReady ||
        !character
    ) {
        return;
    }

    try {

        await baseChannel.send({

            type:
                "broadcast",

            event:
                "base-player-move",

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
                    "base"

            }

        });

    } catch (error) {

        console.error(
            "Errore broadcast posizione Base:",
            error
        );

    }

}



// ============================================================
// SINCRONIZZA TOKEN DEGLI ALTRI GIOCATORI NELLA BASE
// ============================================================

function syncBaseRemotePlayers() {

    if (
        !baseChannel ||
        !character
    ) {
        return;
    }

    const state =
        baseChannel.presenceState();

    const onlineIds =
        new Set();

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

                    if (
                        presence.character_id ===
                        character.id
                    ) {
                        return;
                    }

                    // Sicurezza: sulla mappa Base renderizziamo
                    // soltanto Presence dichiarate come Base.
                    if (
                        presence.location &&
                        presence.location !== "base"
                    ) {
                        return;
                    }

                    const x =
                        Number(presence.x);

                    const y =
                        Number(presence.y);

                    if (
                        !Number.isFinite(x) ||
                        !Number.isFinite(y)
                    ) {
                        return;
                    }

                    onlineIds.add(
                        presence.character_id
                    );

                    updateBaseRemotePlayer(
                        presence
                    );

                }
            );

        }
    );

    // Rimuove immediatamente i token di chi ha lasciato
    // il canale Base o è entrato in un servizio/combat.
    for (
        const [
            characterId,
            token
        ] of baseOtherPlayerTokens
    ) {

        if (
            !onlineIds.has(characterId)
        ) {

            token.remove();

            baseOtherPlayerTokens.delete(
                characterId
            );

            baseOtherPlayers.delete(
                characterId
            );

        }

    }

}


function updateBaseRemotePlayer(data) {

    if (
        !data ||
        !data.character_id ||
        !character ||
        data.character_id === character.id
    ) {
        return;
    }

    const x = Number(data.x);
    const y = Number(data.y);

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {
        return;
    }

    const previous =
        baseOtherPlayers.get(
            data.character_id
        ) || {};

    baseOtherPlayers.set(
        data.character_id,
        {
            ...previous,
            character_id:
                data.character_id,
            name:
                data.name ||
                previous.name ||
                "Avventuriero",
            token:
                data.token ||
                previous.token ||
                "token_1.png",
            x,
            y,
            current_hp:
                data.current_hp !== undefined
                    ? data.current_hp
                    : previous.current_hp,
            active_combat_id:
                data.active_combat_id !== undefined
                    ? data.active_combat_id
                    : previous.active_combat_id,
            in_combat:
                data.in_combat !== undefined
                    ? !!data.in_combat
                    : !!previous.in_combat
        }
    );

    showBaseRemotePlayerToken(
        data.character_id
    );

}


function showBaseRemotePlayerToken(
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
        baseOtherPlayers.get(
            characterId
        );

    if (!player) {
        return;
    }

    let token =
        baseOtherPlayerTokens.get(
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

        image.draggable = false;

        token.appendChild(image);

        const label =
            document.createElement(
                "div"
            );

        label.className =
            "other-player-name";

        token.appendChild(label);

        map.appendChild(token);

        baseOtherPlayerTokens.set(
            characterId,
            token
        );

    }

    const image =
        token.querySelector("img");

    const label =
        token.querySelector(
            ".other-player-name"
        );

    if (image) {
        image.src =
            "../immagini/token/" +
            (
                player.token ||
                "token_1.png"
            );
        image.alt =
            player.name ||
            "Avventuriero";
    }

    if (label) {
        label.textContent =
            player.name ||
            "Avventuriero";
    }

    const inCombat =
        player.in_combat === true ||
        !!player.active_combat_id;

    token.classList.toggle(
        "is-in-combat",
        inCombat
    );

    token.title =
        inCombat
            ? `${player.name} - IN COMBATTIMENTO`
            : player.name;

    positionBaseRemotePlayerToken(
        token,
        player.x,
        player.y
    );

}


function positionBaseRemotePlayerToken(
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
        BASE_MAP_COLUMNS;

    const cellHeight =
        rect.height /
        BASE_MAP_ROWS;

    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) * 0.88;

    element.style.width =
        `${tokenSize}px`;

    element.style.height =
        `${tokenSize}px`;

    element.style.left =
        `${(Number(x) + 0.5) * cellWidth - tokenSize / 2}px`;

    element.style.top =
        `${(Number(y) + 0.5) * cellHeight - tokenSize / 2}px`;

    element.style.zIndex =
        "19";

}


function positionAllBaseRemotePlayerTokens() {

    for (
        const [
            characterId,
            token
        ] of baseOtherPlayerTokens
    ) {

        const player =
            baseOtherPlayers.get(
                characterId
            );

        if (!player) {
            continue;
        }

        positionBaseRemotePlayerToken(
            token,
            player.x,
            player.y
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

        stopBaseInnTimer();

        if (
            typeof destroyBaseServices ===
            "function"
        ) {
            destroyBaseServices();
        }

    }
);
