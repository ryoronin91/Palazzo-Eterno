// ============================================================
// PALAZZO ETERNO
// SCHEDA.JS
// ============================================================
//
// Gestisce:
//
// - autenticazione
// - ruolo utente
// - personaggio
// - token
// - attributi base
// - bonus equipaggiamento
// - statistiche secondarie
// - abilità
// - inventario
// - zaino
// - equipaggia
// - rimuovi equipaggiamento
// - usa consumabili
// - note
// - Master
// - logout
//
// ============================================================


console.log("SCHEDA.JS CARICATO");


// ============================================================
// MUSICA DI SOTTOFONDO
// ============================================================

let sheetBackgroundMusic = null;

const PALAZZO_MUSIC_VOLUME_KEY =
    "palazzo-eterno-dungeon-volume";

let sheetMusicVolume =
    loadSheetMusicVolume();


function loadSheetMusicVolume() {

    try {

        const saved =
            localStorage.getItem(
                PALAZZO_MUSIC_VOLUME_KEY
            );


        if (
            saved === null ||
            saved === ""
        ) {

            return 0.35;

        }


        const value =
            Number(
                saved
            );


        if (
            !Number.isFinite(
                value
            )
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


function saveSheetMusicVolume(
    value
) {

    try {

        localStorage.setItem(
            PALAZZO_MUSIC_VOLUME_KEY,
            String(
                value
            )
        );


    } catch (error) {

        // localStorage potrebbe essere disabilitato.

    }

}


function getSheetVolumeIcon(
    volume
) {

    if (
        volume <= 0
    ) {

        return "🔇";

    }


    if (
        volume < 0.5
    ) {

        return "🔉";

    }


    return "🔊";

}


function updateSheetVolumeUI() {

    const button =
        document.getElementById(
            "sheet-volume-button"
        );


    const slider =
        document.getElementById(
            "sheet-volume-slider"
        );


    const value =
        document.getElementById(
            "sheet-volume-value"
        );


    const percentage =
        Math.round(
            sheetMusicVolume *
            100
        );


    if (button) {

        button.textContent =
            getSheetVolumeIcon(
                sheetMusicVolume
            );


        button.title =
            `Volume musica: ${percentage}%`;

    }


    if (slider) {

        slider.value =
            String(
                percentage
            );

    }


    if (value) {

        value.textContent =
            `${percentage}%`;

    }

}


function startSheetBackgroundMusic() {

    if (
        sheetBackgroundMusic
    ) {

        return;

    }


    sheetBackgroundMusic =
        new Audio(
            "music/dungeon.mp3"
        );


    sheetBackgroundMusic.loop =
        true;


    sheetBackgroundMusic.volume =
        sheetMusicVolume;


    sheetBackgroundMusic.preload =
        "auto";


    const tryPlay =
        async () => {

            if (
                !sheetBackgroundMusic
            ) {

                return;

            }


            try {

                await sheetBackgroundMusic.play();

            } catch (error) {

                // Autoplay eventualmente sbloccato
                // alla prima interazione dell'utente.

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


function setupSheetVolumeControl() {

    const control =
        document.querySelector(
            ".sheet-volume-control"
        );


    const button =
        document.getElementById(
            "sheet-volume-button"
        );


    const popover =
        document.getElementById(
            "sheet-volume-popover"
        );


    const slider =
        document.getElementById(
            "sheet-volume-slider"
        );


    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {

        return;

    }


    updateSheetVolumeUI();


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

            sheetMusicVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(
                            slider.value
                        ) /
                        100
                    )
                );


            if (
                sheetBackgroundMusic
            ) {

                sheetBackgroundMusic.volume =
                    sheetMusicVolume;

            }


            saveSheetMusicVolume(
                sheetMusicVolume
            );


            updateSheetVolumeUI();

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
// VARIABILI GLOBALI
// ============================================================

let currentUser = null;

let character = null;

let currentUserRole = "player";

let characterInventory = [];

let characterAbilities = [];
const ABILITIES_PER_PAGE = 5;
const BACKPACK_ITEMS_PER_PAGE = 6;

let abilitiesPage = 1;
let backpackPage = 1;

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
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Pagina scheda pronta."
        );


        startSheetBackgroundMusic();

        setupSheetVolumeControl();


        try {

            await checkUser();

            await loadUserRole();

            await loadCharacter();

            await loadSheetLeaderboard();

            ensureInventoryInterface();

            await Promise.all([

                loadInventory(),

                loadAbilities()

            ]);


            displayCharacter();

            displayInventory();

            displayAbilities();

            updateMasterEntryButton();

            setupEvents();


        } catch (error) {

            console.error(
                "Errore caricamento scheda:",
                error
            );


            showMessage(
                "Errore durante il caricamento della scheda: " +
                error.message
            );

        }

    }
);



// ============================================================
// CADUTI DEL PALAZZO
// ============================================================

async function loadSheetLeaderboard() {

    const container =
        document.getElementById(
            "sheet-leaderboard-list"
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


        renderSheetLeaderboard(
            data || []
        );


    } catch (error) {

        console.error(
            "Errore caricamento Caduti del Palazzo:",
            error
        );


        container.innerHTML =
            `
                <div class="sheet-leaderboard-empty">
                    Classifica non disponibile.
                </div>
            `;

    }

}


// ============================================================
// RENDER LEADERBOARD
// ============================================================

function renderSheetLeaderboard(
    rows
) {

    const container =
        document.getElementById(
            "sheet-leaderboard-list"
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
                <div class="sheet-leaderboard-empty">
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
                        escapeSheetLeaderboardHtml(
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
                                        escapeSheetLeaderboardHtml(
                                            badge?.badge_name ||
                                            badge?.display_name ||
                                            "Boss sconfitto"
                                        );

                                    const iconPath =
                                        escapeSheetLeaderboardHtml(
                                            badge?.icon_path ||
                                            ""
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
                                                class="sheet-leaderboard-badge sheet-leaderboard-badge-fallback"
                                                title="${title}"
                                                aria-label="${title}"
                                            >
                                                🛡
                                            </span>
                                        `;

                                    }


                                    return `
                                        <span
                                            class="sheet-leaderboard-badge-wrap"
                                            title="${title}"
                                        >
                                            <img
                                                class="sheet-leaderboard-badge"
                                                src="${iconPath}"
                                                alt="${badgeName}"
                                                loading="lazy"
                                                onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';"
                                            >
                                            <span
                                                class="sheet-leaderboard-badge sheet-leaderboard-badge-fallback"
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
                        <div class="sheet-leaderboard-row">

                            <div class="sheet-leaderboard-position">
                                #${position}
                            </div>

                            <div class="sheet-leaderboard-identity">

                                <div
                                    class="sheet-leaderboard-name"
                                    title="${name}"
                                >
                                    ${name}
                                </div>

                                ${
                                    badgesHtml
                                        ? `
                                            <div class="sheet-leaderboard-badges">
                                                ${badgesHtml}
                                            </div>
                                        `
                                        : ""
                                }

                            </div>

                            <div class="sheet-leaderboard-score">
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

function escapeSheetLeaderboardHtml(
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
// AUTENTICAZIONE
// ============================================================

async function checkUser() {

    const {
        data: {
            user
        },
        error
    } =
        await db.auth.getUser();


    if (error) {

        throw error;

    }


    if (!user) {

        window.location.href =
            "login.html";

        return;

    }


    currentUser =
        user;


    const emailElement =
        document.getElementById(
            "user-email"
        );


    if (emailElement) {

        emailElement.textContent =
            currentUser.email || "";

    }

}


// ============================================================
// RUOLO
// ============================================================

async function loadUserRole() {

    const {
        data,
        error
    } =
        await db
            .from("user_roles")
            .select("role")
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentUserRole =
        data?.role ||
        "player";

}


// ============================================================
// MASTER
// ============================================================

function updateMasterEntryButton() {

    const button =
        document.getElementById(
            "master-entry-button"
        );


    if (!button) {

        return;

    }


    button.style.display =
        currentUserRole === "master"
            ? "inline-flex"
            : "none";

}


// ============================================================
// PERSONAGGIO
// ============================================================

async function loadCharacter() {

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


    console.log(
        "Personaggio:",
        character
    );

}


// ============================================================
// ABILITÀ
// ============================================================

async function loadAbilities() {

    if (!character) {

        characterAbilities = [];

        return;

    }


    console.log(
        "Caricamento abilità personaggio..."
    );


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
                character_id,
                ability_id,
                level,
                created_at,
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
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    characterAbilities =
        data || [];


    console.log(
        "Abilità personaggio:",
        characterAbilities
    );

}

// ============================================================
// PAGINAZIONE
// ============================================================

function renderSheetPagination(
    container,
    currentPage,
    totalPages,
    onPageChange
) {

    if (
        !container ||
        totalPages <= 1
    ) {

        return;

    }


    const pagination =
        document.createElement(
            "div"
        );


    pagination.className =
        "sheet-pagination";


    const previous =
        document.createElement(
            "button"
        );


    previous.type =
        "button";


    previous.className =
        "sheet-pagination-button";


    previous.textContent =
        "‹";


    previous.disabled =
        currentPage <= 1;


    previous.addEventListener(
        "click",
        () => {

            if (
                currentPage <= 1
            ) {

                return;

            }


            onPageChange(
                currentPage - 1
            );

        }
    );


    const label =
        document.createElement(
            "div"
        );


    label.className =
        "sheet-pagination-label";


    label.textContent =
        `${currentPage} / ${totalPages}`;


    const next =
        document.createElement(
            "button"
        );


    next.type =
        "button";


    next.className =
        "sheet-pagination-button";


    next.textContent =
        "›";


    next.disabled =
        currentPage >= totalPages;


    next.addEventListener(
        "click",
        () => {

            if (
                currentPage >= totalPages
            ) {

                return;

            }


            onPageChange(
                currentPage + 1
            );

        }
    );


    pagination.append(
        previous,
        label,
        next
    );


    container.appendChild(
        pagination
    );

}

// ============================================================
// MOSTRA ABILITÀ
// 5 PER PAGINA
// ============================================================

function displayAbilities() {

    const container =
        document.getElementById(
            "abilities-list"
        );


    if (!container) {

        return;

    }


    container.replaceChildren();


    if (
        characterAbilities.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "abilities-empty";


        empty.textContent =
            "Nessuna abilità conosciuta.";


        container.appendChild(
            empty
        );


        return;

    }


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                characterAbilities.length /
                ABILITIES_PER_PAGE
            )
        );


    abilitiesPage =
        Math.max(
            1,
            Math.min(
                abilitiesPage,
                totalPages
            )
        );


    const startIndex =
        (
            abilitiesPage - 1
        ) *
        ABILITIES_PER_PAGE;


    const endIndex =
        startIndex +
        ABILITIES_PER_PAGE;


    const visibleAbilities =
        characterAbilities.slice(
            startIndex,
            endIndex
        );


    visibleAbilities.forEach(
        entry => {

            if (!entry.ability) {

                return;

            }


            container.appendChild(
                createAbilityCard(
                    entry
                )
            );

        }
    );


    renderSheetPagination(
        container,
        abilitiesPage,
        totalPages,
        newPage => {

            abilitiesPage =
                newPage;


            displayAbilities();

        }
    );

}

// ============================================================
// CREA CARTA ABILITÀ
// ============================================================

function createAbilityCard(
    entry
) {

    const ability =
        entry.ability;


    const level =
        Math.max(
            1,
            Math.min(
                6,
                Number(
                    entry.level
                ) || 1
            )
        );


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "ability-sheet-card";


    // ========================================================
    // HEADER
    // ========================================================

    const header =
        document.createElement(
            "div"
        );


    header.className =
        "ability-sheet-header";


    // --------------------------------------------------------
    // NOME
    // --------------------------------------------------------

    const name =
        document.createElement(
            "div"
        );


    name.className =
        "ability-sheet-name";


    name.textContent =
        ability.name ||
        "Abilità";


    header.appendChild(
        name
    );


    // --------------------------------------------------------
    // LIVELLO
    // --------------------------------------------------------

    const levelElement =
        document.createElement(
            "div"
        );


    levelElement.className =
        "ability-sheet-level";


    levelElement.textContent =
        `LV.${level}`;


    header.appendChild(
        levelElement
    );


    card.appendChild(
        header
    );


    // ========================================================
    // DESCRIZIONE
    // ========================================================

    if (
        ability.description
    ) {

        const description =
            document.createElement(
                "div"
            );


        description.className =
            "ability-sheet-description";


        description.textContent =
            ability.description;


        card.appendChild(
            description
        );

    }


    // ========================================================
    // COSTO PM
    // ========================================================

    const cost =
        document.createElement(
            "div"
        );


    cost.className =
        "ability-sheet-cost";


    cost.textContent =
        `Costo: ${
            Number(
                ability.pm_cost
            ) || 0
        } PM`;


    card.appendChild(
        cost
    );


    return card;

}// ============================================================
// INVENTARIO
// ============================================================

async function loadInventory() {

    if (!character) {

        characterInventory = [];

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                "character_inventory"
            )
            .select(`
                id,
                character_id,
                item_id,
                quantity,
                equipped_slot,
                created_at,
                updated_at,
                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    hand_rule,
                    stackable,
                    max_stack,
                    attack_bonus,
                    defense_bonus,
                    forza_bonus,
                    resistenza_bonus,
                    costituzione_bonus,
                    intelligenza_bonus,
                    destrezza_bonus,
                    fortuna_bonus,
                    heal_pf,
                    heal_pm,
                    gold_value,
                    grants_ability_id,
                    unique_world,
                    vendor_unlimited,
                    recipe_only
                )
            `)
            .eq(
                "character_id",
                character.id
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        throw error;

    }


    characterInventory =
        data || [];


    calculateEquipmentBonuses();


    console.log(
        "Inventario:",
        characterInventory
    );

}


// ============================================================
// BONUS EQUIPAGGIAMENTO
// ============================================================

function calculateEquipmentBonuses() {

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
// CLAMP ATTRIBUTO 1-30
// ============================================================

function clampAttribute(
    value
) {

    return Math.max(
        1,
        Math.min(
            30,
            Number(value) || 1
        )
    );

}


// ============================================================
// ATTRIBUTO BASE
// ============================================================

function getBaseAttribute(
    name
) {

    return clampAttribute(
        character?.[name]
    );

}


// ============================================================
// ATTRIBUTO EFFETTIVO
// ============================================================

function getEffectiveAttribute(
    name
) {

    const base =
        getBaseAttribute(
            name
        );


    const bonusName =
        `${name}_bonus`;


    const bonus =
        Number(
            equipmentBonuses[
                bonusName
            ]
        ) || 0;


    return clampAttribute(
        base + bonus
    );

}


// ============================================================
// MOSTRA PERSONAGGIO
// ============================================================

function displayCharacter() {

    if (!character) {

        return;

    }


    setText(
        "character-name",
        character.nome ||
        "Avventuriero"
    );


    setText(
        "character-level",
        `Livello ${
            Number(
                character.livello
            ) || 1
        }`
    );


    displayToken();


    displayAttributes();


    calculateSecondaryStats();


    const notes =
        document.getElementById(
            "character-notes"
        );


    if (notes) {

        notes.value =
            character.notes || "";

    }

}


// ============================================================
// ATTRIBUTI
// ============================================================

function displayAttributes() {

    const attributeNames = [

        "forza",

        "resistenza",

        "costituzione",

        "intelligenza",

        "destrezza",

        "fortuna"

    ];


    attributeNames.forEach(
        name => {

            const base =
                getBaseAttribute(
                    name
                );


            const effective =
                getEffectiveAttribute(
                    name
                );


            const element =
                document.getElementById(
                    `${name}-display`
                );


            if (!element) {

                return;

            }


            element.textContent =
                effective;


            if (
                base ===
                effective
            ) {

                element.removeAttribute(
                    "title"
                );

            } else {

                element.title =
                    `Base ${base} · Equipaggiamento ${
                        effective - base >= 0
                            ? "+"
                            : ""
                    }${effective - base}`;

            }

        }
    );

}


// ============================================================
// TOKEN
// ============================================================

function displayToken() {

    const token =
        document.getElementById(
            "character-token"
        );


    if (!token) {

        return;

    }


    if (
        !character.token
    ) {

        token.style.display =
            "none";

        return;

    }


    let path =
        character.token;


    if (
        !path.includes("/")
    ) {

        path =
            `immagini/token/${path}`;

    }


    token.src =
        path;


    token.alt =
        `Token di ${
            character.nome ||
            "personaggio"
        }`;


    token.style.display =
        "block";

}


// ============================================================
// STATISTICHE
// ============================================================

function calculateSecondaryStats() {

    const forza =
        getEffectiveAttribute(
            "forza"
        );


    const resistenza =
        getEffectiveAttribute(
            "resistenza"
        );


    const costituzione =
        getEffectiveAttribute(
            "costituzione"
        );


    const intelligenza =
        getEffectiveAttribute(
            "intelligenza"
        );


    const destrezza =
        getEffectiveAttribute(
            "destrezza"
        );


    const fortuna =
        getEffectiveAttribute(
            "fortuna"
        );


    const attack =
        Math.ceil(
            forza / 2
        )
        +
        equipmentBonuses.attack_bonus;


    const defense =
        Math.ceil(
            7 +
            (
                resistenza / 2
            )
        )
        +
        equipmentBonuses.defense_bonus;


    const maxPF =
        Math.ceil(
            5 *
            (
                costituzione / 2
            )
        );


    const maxPM =
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
        Math.round(
            fortuna *
            (
                50 / 30
            )
            *
            100
        )
        /
        100;


    let currentPF =
        character.current_hp;


    let currentPM =
        character.current_pm;


    if (
        currentPF === null ||
        currentPF === undefined
    ) {

        currentPF =
            maxPF;

    }


    if (
        currentPM === null ||
        currentPM === undefined
    ) {

        currentPM =
            maxPM;

    }


    currentPF =
        Math.max(
            0,
            Math.min(
                Number(
                    currentPF
                ),
                maxPF
            )
        );


    currentPM =
        Math.max(
            0,
            Math.min(
                Number(
                    currentPM
                ),
                maxPM
            )
        );


    setText(
        "attack-display",
        attack
    );


    setText(
        "defense-display",
        defense
    );


    setText(
        "life-display",
        `${currentPF}/${maxPF}`
    );


    setText(
        "mana-display",
        `${currentPM}/${maxPM}`
    );


    setText(
        "movement-display",
        movement
    );


    setText(
        "critical-display",
        `${critical.toFixed(2)}%`
    );

}


// ============================================================
// IMPOSTA TESTO
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
// CREA INTERFACCIA INVENTARIO SE MANCA
// ============================================================

function ensureInventoryInterface() {

    if (
        document.getElementById(
            "backpack-list"
        )
    ) {

        return;

    }


    const notesSection =
        document.querySelector(
            ".notes-section"
        );


    const parent =
        notesSection?.parentNode;


    if (!parent) {

        return;

    }


    const section =
        document.createElement(
            "section"
        );


    section.className =
        "inventory-system-section";


    section.innerHTML = `

        <h2>
            Equipaggiamento
        </h2>

        <div class="equipment-grid">

            <div
                id="equipment-slot-hand-1"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Mano 1
                </div>
            </div>

            <div
                id="equipment-slot-hand-2"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Mano 2
                </div>
            </div>

            <div
                id="equipment-slot-armor"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Armatura
                </div>
            </div>

            <div
                id="equipment-slot-accessory-1"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Accessorio 1
                </div>
            </div>

            <div
                id="equipment-slot-accessory-2"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Accessorio 2
                </div>
            </div>

            <div
                id="equipment-slot-accessory-3"
                class="equipment-slot"
            >
                <div class="equipment-slot-title">
                    Accessorio 3
                </div>
            </div>

        </div>

        <div class="backpack-header">

            <h2>
                Zaino
            </h2>

            <span id="backpack-count">
                0 oggetti
            </span>

        </div>

        <div id="backpack-empty">
            Lo zaino è vuoto.
        </div>

        <div id="backpack-list"></div>

    `;


    parent.insertBefore(
        section,
        notesSection
    );

}


// ============================================================
// VISUALIZZA INVENTARIO
// ============================================================

function displayInventory() {

    calculateEquipmentBonuses();

    displayEquipment();

    displayBackpack();

    displayAttributes();

    calculateSecondaryStats();

}


// ============================================================
// EQUIPAGGIAMENTO
// ============================================================

function displayEquipment() {

    const slots = {

        hand_1: {
            key: "hand-1"
        },

        hand_2: {
            key: "hand-2"
        },

        armor: {
            key: "armor"
        },

        accessory_1: {
            key: "accessory-1"
        },

        accessory_2: {
            key: "accessory-2"
        },

        accessory_3: {
            key: "accessory-3"
        }

    };


    const twoHanded =
        characterInventory.find(
            entry =>
                entry.equipped_slot ===
                    "hand_1"
                &&
                entry.item?.hand_rule ===
                    "two_handed"
        );


    Object.entries(
        slots
    ).forEach(
        (
            [
                slotName,
                config
            ]
        ) => {

            let entry =
                characterInventory.find(
                    inventoryItem =>
                        inventoryItem.equipped_slot ===
                        slotName
                );


            let blockedByTwoHanded =
                false;


            if (
                slotName === "hand_2" &&
                twoHanded
            ) {

                entry =
                    twoHanded;


                blockedByTwoHanded =
                    true;

            }


            renderEquipmentSlot(
                config.key,
                entry,
                blockedByTwoHanded
            );

        }
    );

}


// ============================================================
// RENDER SLOT
// ============================================================

function renderEquipmentSlot(
    htmlKey,
    entry,
    blockedByTwoHanded = false
) {

    const container =
        document.getElementById(
            `equipment-slot-${htmlKey}`
        );


    if (!container) {

        return;

    }


    let content =
        container.querySelector(
            "[data-equipment-content]"
        );


    if (!content) {

        content =
            document.createElement(
                "div"
            );


        content.dataset.equipmentContent =
            "true";


        container.appendChild(
            content
        );

    }


    content.replaceChildren();


    if (
        !entry ||
        !entry.item
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "equipment-empty";


        empty.textContent =
            "Vuoto";


        content.appendChild(
            empty
        );


        return;

    }


    const item =
        entry.item;const name =
        document.createElement(
            "div"
        );


    name.className =
        "equipment-item-name";


    name.textContent =
        blockedByTwoHanded
            ? `${item.name} · Due mani`
            : item.name;


    content.appendChild(
        name
    );


    const description =
        document.createElement(
            "div"
        );


    description.className =
        "equipment-item-description";


    description.textContent =
        item.description || "";


    content.appendChild(
        description
    );


    const value =
        document.createElement(
            "div"
        );


    value.className =
        "equipment-item-value";


    value.textContent =
        `Valore: ${
            Number(
                item.gold_value
            ) || 0
        } MO`;


    content.appendChild(
        value
    );


    if (!blockedByTwoHanded) {

        const removeButton =
            document.createElement(
                "button"
            );


        removeButton.type =
            "button";


        removeButton.className =
            "inventory-button";


        removeButton.textContent =
            "RIMUOVI";


        removeButton.addEventListener(
            "click",
            () => {

                unequipItem(
                    entry.id
                );

            }
        );


        content.appendChild(
            removeButton
        );

    }

}


// ============================================================
// ZAINO
// 6 TIPI DI OGGETTO PER PAGINA
// ============================================================

function displayBackpack() {

    const list =
        document.getElementById(
            "backpack-list"
        );


    const count =
        document.getElementById(
            "backpack-count"
        );


    const empty =
        document.getElementById(
            "backpack-empty"
        );


    if (!list) {

        return;

    }


    const items =
    characterInventory
        .filter(
            entry =>
                !entry.equipped_slot
        )
        .sort(
            (a, b) => {

                const getCategoryOrder =
                    entry => {

                        const item =
                            entry.item || {};


                        const itemId =
                            String(
                                item.id || ""
                            ).toLowerCase();


                        const itemName =
                            String(
                                item.name || ""
                            ).toLowerCase();


                        const itemType =
                            String(
                                item.item_type || ""
                            ).toLowerCase();


                        // =====================================
                        // 1. MONETE
                        // =====================================

                        if (
                            itemId.includes("monet") ||
                            itemName.includes("monet")
                        ) {

                            return 1;

                        }


                        // =====================================
                        // 2. CONSUMABILI
                        // =====================================

                        if (
                            itemType ===
                            "consumable"
                        ) {

                            return 2;

                        }


                        // =====================================
                        // 3. EQUIPAGGIAMENTI
                        //
                        // Qualsiasi oggetto che possiede
                        // uno slot equipaggiabile.
                        // =====================================

                        if (
                            item.equip_slot
                        ) {

                            return 3;

                        }


                        // =====================================
                        // 4. TUTTO IL RESTO
                        // =====================================

                        return 4;

                    };


                const categoryA =
                    getCategoryOrder(a);


                const categoryB =
                    getCategoryOrder(b);


                // Prima ordina per categoria

                if (
                    categoryA !==
                    categoryB
                ) {

                    return (
                        categoryA -
                        categoryB
                    );

                }


                // All'interno della stessa categoria
                // ordine alfabetico

                const nameA =
                    String(
                        a.item?.name || ""
                    );


                const nameB =
                    String(
                        b.item?.name || ""
                    );


                return nameA.localeCompare(
                    nameB,
                    "it",
                    {
                        sensitivity:
                            "base"
                    }
                );

            }
        );


    const total =
        items.reduce(
            (
                sum,
                entry
            ) =>
                sum +
                (
                    Number(
                        entry.quantity
                    ) || 0
                ),
            0
        );


    if (count) {

        count.textContent =
            total === 1
                ? "1 oggetto"
                : `${total} oggetti`;

    }


    if (empty) {

        empty.style.display =
            items.length === 0
                ? ""
                : "none";

    }


    list.replaceChildren();


    if (
        items.length === 0
    ) {

        return;

    }


    const totalPages =
        Math.max(
            1,
            Math.ceil(
                items.length /
                BACKPACK_ITEMS_PER_PAGE
            )
        );


    backpackPage =
        Math.max(
            1,
            Math.min(
                backpackPage,
                totalPages
            )
        );


    const startIndex =
        (
            backpackPage - 1
        ) *
        BACKPACK_ITEMS_PER_PAGE;


    const endIndex =
        startIndex +
        BACKPACK_ITEMS_PER_PAGE;


    const visibleItems =
        items.slice(
            startIndex,
            endIndex
        );


    visibleItems.forEach(
        entry => {

            renderBackpackItem(
                list,
                entry
            );

        }
    );


    renderSheetPagination(
        list,
        backpackPage,
        totalPages,
        newPage => {

            backpackPage =
                newPage;


            displayBackpack();

        }
    );

}

// ============================================================
// RENDER OGGETTO ZAINO
// ============================================================

function renderBackpackItem(
    container,
    entry
) {

    const item =
        entry.item;


    if (!item) {

        return;

    }


    const quantity =
        Number(
            entry.quantity
        ) || 1;


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "backpack-item";


    const name =
        document.createElement(
            "div"
        );


    name.className =
        "backpack-item-name";


    name.textContent =
        item.name;


    if (
        quantity > 1
    ) {

        const quantityElement =
            document.createElement(
                "span"
            );


        quantityElement.className =
            "backpack-item-quantity";


        quantityElement.textContent =
            ` ×${quantity}`;


        name.appendChild(
            quantityElement
        );

    }


    card.appendChild(
        name
    );


    if (
        item.description
    ) {

        const description =
            document.createElement(
                "div"
            );


        description.className =
            "backpack-item-description";


        description.textContent =
            item.description;


        card.appendChild(
            description
        );

    }


    const value =
        document.createElement(
            "div"
        );


    value.className =
        "backpack-item-value";


    const unitValue =
        Number(
            item.gold_value
        ) || 0;


    value.textContent =
        `Valore: ${unitValue} MO`;


    if (
        quantity > 1
    ) {

        value.textContent +=
            ` · Totale: ${
                unitValue *
                quantity
            } MO`;

    }


    card.appendChild(
        value
    );


    if (
        item.item_type ===
            "consumable"
        ||
        Boolean(
            item.grants_ability_id
        )
    ) {

        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "backpack-actions";


        const useButton =
            document.createElement(
                "button"
            );


        useButton.type =
            "button";


        useButton.className =
            "inventory-button";


        const isAbilityScroll =
            Boolean(
                item.grants_ability_id
            );


        useButton.textContent =
            isAbilityScroll
                ? "APPRENDI"
                : "USA";


        useButton.addEventListener(
            "click",
            () => {

                if (
                    isAbilityScroll
                ) {

                    learnAbilityFromScroll(
                        entry.id
                    );

                    return;

                }


                useInventoryItem(
                    entry.id
                );

            }
        );


        actions.appendChild(
            useButton
        );


        card.appendChild(
            actions
        );

    }


    if (
        item.equip_slot !==
        "none"
    ) {

        const slots =
            getCompatibleSlots(
                item
            );


        const select =
            document.createElement(
                "select"
            );


        select.className =
            "backpack-slot-select";


        slots.forEach(
            slot => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    slot.value;


                option.textContent =
                    slot.label;


                select.appendChild(
                    option
                );

            }
        );


        card.appendChild(
            select
        );


        const actions =
            document.createElement(
                "div"
            );


        actions.className =
            "backpack-actions";


        const equipButton =
            document.createElement(
                "button"
            );


        equipButton.type =
            "button";


        equipButton.className =
            "inventory-button";


        equipButton.textContent =
            "EQUIPAGGIA";


        equipButton.addEventListener(
            "click",
            () => {

                equipItem(
                    entry.id,
                    select.value
                );

            }
        );


        actions.appendChild(
            equipButton
        );


        card.appendChild(
            actions
        );

    }


    // ========================================================
    // MANO DI SCIMMIA INCOMPLETA + DITO
    // ========================================================

    if (
        item.id ===
            "mano_scimmia_manca_dito"
        &&
        canCompleteMonkeyHand()
    ) {

        const combineActions =
            document.createElement(
                "div"
            );


        combineActions.className =
            "backpack-actions";


        const combineButton =
            document.createElement(
                "button"
            );


        combineButton.type =
            "button";


        combineButton.className =
            "inventory-button";


        combineButton.textContent =
            "COMPLETA LA MANO";


        combineButton.addEventListener(
            "click",
            () => {

                completeMonkeyHand(
                    combineButton
                );

            }
        );


        combineActions.appendChild(
            combineButton
        );


        card.appendChild(
            combineActions
        );

    }


    container.appendChild(
        card
    );

}


// ============================================================
// COMBINA MANO DI SCIMMIA
// ============================================================

function canCompleteMonkeyHand() {

    const hasFinger =
        characterInventory.some(
            entry =>
                !entry.equipped_slot
                &&
                entry.item_id ===
                    "dito_scimmia"
                &&
                (
                    Number(
                        entry.quantity
                    ) || 0
                ) >= 1
        );


    const hasIncompleteHand =
        characterInventory.some(
            entry =>
                !entry.equipped_slot
                &&
                entry.item_id ===
                    "mano_scimmia_manca_dito"
                &&
                (
                    Number(
                        entry.quantity
                    ) || 0
                ) >= 1
        );


    return (
        hasFinger
        &&
        hasIncompleteHand
    );

}


async function completeMonkeyHand(
    button
) {

    if (
        !button
        ||
        button.disabled
    ) {

        return;

    }


    const originalText =
        button.textContent;


    try {

        button.disabled =
            true;

        button.textContent =
            "COMPLETAMENTO...";


        showMessage(
            "Stai completando la Mano di scimmia..."
        );


        const {
            data,
            error
        } =
            await db.rpc(
                "combine_monkey_hand"
            );


        if (error) {

            throw error;

        }


        await refreshCharacterAndInventory();


        showMessage(
            data?.message ||
            "Hai completato una Mano di scimmia."
        );


    } catch (error) {

        console.error(
            "Errore combinazione Mano di scimmia:",
            error
        );


        showMessage(
            cleanDatabaseError(
                error.message
            )
        );


        button.disabled =
            false;

        button.textContent =
            originalText;

    }

}


// ============================================================
// SLOT COMPATIBILI
// ============================================================

function getCompatibleSlots(
    item
) {

    if (
        item.equip_slot ===
        "armor"
    ) {

        return [

            {
                value: "armor",
                label: "Armatura"
            }

        ];

    }


    if (
        item.equip_slot ===
        "accessory"
    ) {

        return [

            {
                value: "accessory_1",
                label: "Accessorio 1"
            },

            {
                value: "accessory_2",
                label: "Accessorio 2"
            },

            {
                value: "accessory_3",
                label: "Accessorio 3"
            }

        ];

    }


    if (
        item.equip_slot ===
        "hand"
    ) {

        if (
            item.hand_rule ===
            "main_hand_only"
        ) {

            return [

                {
                    value: "hand_1",
                    label: "Mano 1"
                }

            ];

        }


        if (
            item.hand_rule ===
            "two_handed"
        ) {

            return [

                {
                    value: "hand_1",
                    label: "Due mani"
                }

            ];

        }


        return [

            {
                value: "hand_1",
                label: "Mano 1"
            },

            {
                value: "hand_2",
                label: "Mano 2"
            }

        ];}


    return [];

}


// ============================================================
// EQUIPAGGIA
// ============================================================

async function equipItem(
    inventoryId,
    slot
) {

    try {

        showMessage(
            "Equipaggiamento..."
        );


        const {
            error
        } =
            await db.rpc(
                "equip_inventory_item",
                {

                    p_inventory_id:
                        inventoryId,

                    p_slot:
                        slot

                }
            );


        if (error) {

            throw error;

        }


        await refreshCharacterAndInventory();


        showMessage(
            "Oggetto equipaggiato."
        );


    } catch (error) {

        console.error(
            "Errore equipaggiamento:",
            error
        );


        showMessage(
            cleanDatabaseError(
                error.message
            )
        );

    }

}


// ============================================================
// RIMUOVI EQUIPAGGIAMENTO
// ============================================================

async function unequipItem(
    inventoryId
) {

    try {

        showMessage(
            "Rimozione equipaggiamento..."
        );


        const {
            error
        } =
            await db.rpc(
                "unequip_inventory_item",
                {

                    p_inventory_id:
                        inventoryId

                }
            );


        if (error) {

            throw error;

        }


        await refreshCharacterAndInventory();


        showMessage(
            "Oggetto rimesso nello zaino."
        );


    } catch (error) {

        console.error(
            "Errore rimozione equipaggiamento:",
            error
        );


        showMessage(
            cleanDatabaseError(
                error.message
            )
        );

    }

}


// ============================================================
// APPRENDE ABILITÀ DA PERGAMENA
// ============================================================

async function learnAbilityFromScroll(
    inventoryId
) {

    try {

        showMessage(
            "Stai studiando la pergamena..."
        );


        const {
            data,
            error
        } =
            await db.rpc(
                "learn_ability_from_scroll",
                {

                    p_inventory_id:
                        inventoryId

                }
            );


        if (error) {

            throw error;

        }


        await refreshCharacterAndInventory();


        await loadAbilities();

        displayAbilities();


        showMessage(
            `${
                data?.ability_name ||
                "Abilità"
            } appresa!`
        );


    } catch (error) {

        console.error(
            "Errore apprendimento pergamena:",
            error
        );


        showMessage(
            cleanDatabaseError(
                error.message
            )
        );

    }

}


// ============================================================
// USA CONSUMABILE
// ============================================================

async function useInventoryItem(
    inventoryId
) {

    try {

        showMessage(
            "Uso oggetto..."
        );


        const {
            data,
            error
        } =
            await db.rpc(
                "use_inventory_item",
                {

                    p_inventory_id:
                        inventoryId

                }
            );


        if (error) {

            throw error;

        }


        await refreshCharacterAndInventory();


        if (data) {

            showMessage(
                `${data.item_name || "Oggetto"} utilizzato.`
            );

        } else {

            showMessage(
                "Oggetto utilizzato."
            );

        }


    } catch (error) {

        console.error(
            "Errore uso oggetto:",
            error
        );


        showMessage(
            cleanDatabaseError(
                error.message
            )
        );

    }

}


// ============================================================
// AGGIORNA DOPO UN'AZIONE
// ============================================================

async function refreshCharacterAndInventory() {

    await loadCharacter();

    await loadInventory();


    displayCharacter();

    displayInventory();

}


// ============================================================
// PULIZIA MESSAGGI POSTGRES
// ============================================================

function cleanDatabaseError(
    text
) {

    if (!text) {

        return "Si è verificato un errore.";

    }


    return text
        .replace(
            /^.*?: /,
            ""
        )
        .trim();

}


// ============================================================
// EVENTI
// ============================================================

function setupEvents() {

    const saveNotesButton =
        document.getElementById(
            "save-notes-button"
        );


    if (saveNotesButton) {

        saveNotesButton.addEventListener(
            "click",
            saveNotes
        );

    }


    const logoutButton =
        document.getElementById(
            "logout-button"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logout
        );

    }

}


// ============================================================
// SALVA NOTE
// ============================================================

async function saveNotes() {

    const notesElement =
        document.getElementById(
            "character-notes"
        );


    if (!notesElement) {

        return;

    }


    const notes =
        notesElement.value;


    const saveButton =
        document.getElementById(
            "save-notes-button"
        );


    if (saveButton) {

        saveButton.disabled =
            true;


        saveButton.textContent =
            "SALVATAGGIO...";

    }


    try {

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
                .select()
                .single();


        if (error) {

            throw error;

        }


        character =
            data;


        showMessage(
            "Note salvate correttamente!"
        );


    } catch (error) {

        console.error(
            "Errore salvataggio note:",
            error
        );


        showMessage(
            "Errore durante il salvataggio delle note: " +
            error.message
        );


    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;


            saveButton.textContent =
                "SALVA NOTE";

        }

    }

}


// ============================================================
// LOGOUT
// ============================================================

async function logout() {

    const {
        error
    } =
        await db.auth.signOut();


    if (error) {

        console.error(
            "Errore logout:",
            error
        );


        return;

    }


    window.location.href =
        "index.html";

}


// ============================================================
// MESSAGGI
// ============================================================

function showMessage(
    text
) {

    const element =
        document.getElementById(
            "sheet-message"
        );


    if (!element) {

        console.log(
            text
        );

        return;

    }


    element.textContent =
        text;


    if (!text) {

        return;

    }


    setTimeout(
        () => {

            if (
                element.textContent ===
                text
            ) {

                element.textContent =
                    "";

            }

        },
        4000
    );

}