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


const MAP_COLUMNS = 63;
const MAP_ROWS = 81;


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


const MONKEY_SIGN_ENABLED = false;


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
// GIORNO PAGA - FUORI COMBATTIMENTO
// ============================================================


let dungeonGiornoPagaInProgress = false;




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
            "../../music/piano-Ia.mp3"
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
            // RISONANZA · TOP 5
            // ------------------------------------------------


            await Promise.allSettled([loadDungeonLeaderboard(), loadDungeonResonanceScore()]);




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
            // Piano Ia: nessuna missione di esplorazione del Piano 1.

            // ------------------------------------------------
            // CAMERA
            // ------------------------------------------------


            setupDungeonCamera();
            await setupPiaZoomAndExploration();
            piaCombatStart();
            piaSpecialStart();




            // ------------------------------------------------
            // VENDOR
            // ------------------------------------------------


            // Nessun cartello del Piano 1 nel Piano Ia;




            // ------------------------------------------------------------
            // NEBBIA DI GUERRA
            // ------------------------------------------------------------


            // Nebbia del Piano 1 disabilitata: richiede adattamento 63x81;
            
            // ------------------------------------------------
            // MOVIMENTO
            // ------------------------------------------------


            setupMovement();




            // ------------------------------------------------
            // AZIONI RAPIDE
            // ------------------------------------------------


            setupDungeonActions();


            // Giorno Paga è un'azione autonoma: non modifica Cura.
            setupDungeonGiornoPagaAction();




            // ------------------------------------------------
            // SCAMBIO TRA GIOCATORI
            // ------------------------------------------------


            setupDungeonTradeUi();




            // ------------------------------------------------
            // MULTIPLAYER
            // ------------------------------------------------


            await setupRealtimeMultiplayer();
            await recoverDungeonTradeState();




            // ------------------------------------------------
            // REFRESH
            // ------------------------------------------------


            startDungeonCharacterRefresh();


            // Ricarica la Top 5 anche se i giocatori restano online.
            window.setInterval(() => {
                loadDungeonLeaderboard();
                loadDungeonResonanceScore();
            }, 90000);




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
// RISONANZA · TOP 5
// ============================================================


// Risonanza personale: stesso calcolo della scheda e della Top 5.
// Un errore RPC non interrompe il caricamento o i movimenti.
async function loadDungeonResonanceScore() {
    const value = document.getElementById('character-resonance');
    if (!value || !character) return;
    // characters.score è disponibile già nel personaggio caricato:
    // non lasciare il punteggio vuoto per un errore RPC.
    const savedScore = Number(character.score);
    value.textContent = Number.isFinite(savedScore)
        ? `✧ Risonanza: ${savedScore.toLocaleString('it-IT')}`
        : '✧ Risonanza: —';
    try {
        const { data, error } = await db.rpc('get_my_resonance_profile');
        if (error) throw error;
        const score = Number(data?.score);
        if (data && Number.isFinite(score)) {
            value.textContent = `✧ Risonanza: ${score.toLocaleString('it-IT')}`;
        }
    } catch (error) {
        // Mantiene il valore locale; segnala la causa in Console.
        console.warn('[RISONANZA] RPC profilo non disponibile, valore salvato mostrato:', error);
    }
}


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
                "get_living_characters_leaderboard_with_badges",
                {
                    p_limit:
                        5
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
            "Errore caricamento Top 5 Risonanza:",
            error
        );




        container.innerHTML =
            `
                <div class="dungeon-leaderboard-empty">
                    Top 5 non disponibile: verificare la SQL Risonanza V3.
                </div>
            `;


    }


}




// ============================================================
// RENDER RISONANZA · TOP 5
// ============================================================


function renderDungeonLeaderboard(rows) {
    const container = document.getElementById("dungeon-leaderboard-list");
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = '<div class="dungeon-leaderboard-empty">Nessun personaggio vivo in classifica.</div>';
        return;
    }


    container.innerHTML = rows.map(row => {
        const position = Number(row.posizione) || 0;
        const score = Number(row.score) || 0;
        const name = escapeDungeonLeaderboardHtml(row.character_name || "Avventuriero");
        const badges = Array.isArray(row.boss_badges) ? row.boss_badges : [];
        const badgesHtml = badges.map(badge => {
            const badgeName = escapeDungeonLeaderboardHtml(badge?.badge_name || badge?.display_name || "Boss sconfitto");
            const rawPath = String(badge?.icon_path || "").trim();
            // Usa l'icona restituita da Supabase (Goblin, Berserk o entrambi).
            // La pagina parte da una sottocartella rispetto alla root.
            const path = rawPath.startsWith("immagini/") ? "../../" + rawPath : rawPath;
            const iconPath = escapeDungeonLeaderboardHtml(path);
            const floorNumber = Number(badge?.floor_number) || 0;
            const title = escapeDungeonLeaderboardHtml(floorNumber > 0 ? `${badge?.badge_name || badge?.display_name || "Boss sconfitto"} · Piano ${floorNumber}` : badge?.badge_name || badge?.display_name || "Boss sconfitto");
            if (!iconPath) return `<span class="dungeon-leaderboard-badge-fallback" title="${title}" aria-label="${title}">🛡</span>`;
            return `<span class="dungeon-leaderboard-badge-wrap" title="${title}">
                <img class="dungeon-leaderboard-badge" src="${iconPath}" alt="${badgeName}" loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                <span class="dungeon-leaderboard-badge dungeon-leaderboard-badge-fallback" style="display:none" aria-hidden="true">🛡</span>
            </span>`;
        }).join("");
        return `<div class="dungeon-leaderboard-row">
            <div class="dungeon-leaderboard-main">
                <span class="dungeon-leaderboard-position">#${position}</span>
                <span class="dungeon-leaderboard-name" title="${name}">${name}</span>
                <span class="dungeon-leaderboard-score">${score.toLocaleString("it-IT")}</span>
            </div>
            <div class="dungeon-leaderboard-badges">${badgesHtml || '<span class="dungeon-leaderboard-no-badges">Nessuna onorificenza</span>'}</div>
        </div>`;
    }).join("");
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
            "piano-Ia.json"
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




// ============================================================
// GIORNO PAGA - PULSANTE FUORI COMBATTIMENTO
// ============================================================
//
// Il pulsante viene CLONATO graficamente da Cura per mantenere
// lo stesso stile, ma è completamente indipendente:
// - non modifica il pulsante Cura;
// - non usa il targeting di Cura;
// - si applica automaticamente al personaggio che lo lancia.
// ============================================================


function getDungeonGiornoPagaAbilityEntry() {


    return characterAbilities.find(
        entry =>
            entry.ability_id === "giorno_paga" ||
            entry.ability?.id === "giorno_paga"
    ) || null;


}




function getDungeonGiornoPagaPmCost() {


    return Math.max(
        0,
        Number(
            getDungeonGiornoPagaAbilityEntry()?.ability?.pm_cost
        ) || 3
    );


}




function ensureDungeonGiornoPagaButton() {


    const existingButton =
        document.getElementById(
            "dungeon-giorno-paga-button"
        );


    if (existingButton) {
        return existingButton;
    }


    const healButton =
        document.getElementById(
            "dungeon-heal-button"
        );


    if (!healButton) {
        return null;
    }


    // cloneNode NON copia gli event listener: il comportamento di Cura
    // rimane quindi totalmente separato da Giorno Paga.
    const button =
        healButton.cloneNode(true);


    button.id =
        "dungeon-giorno-paga-button";


    button.dataset.action =
        "giorno-paga";


    button.disabled =
        true;


    button.classList.remove(
        "active"
    );


    const icon =
        button.querySelector(
            ".action-card-icon"
        );


    const title =
        button.querySelector(
            "strong"
        );


    const cost =
        button.querySelector(
            "small"
        );


    if (icon) {
        icon.textContent = "¤";
    }


    if (title) {
        title.textContent = "GIORNO PAGA";
    }


    if (cost) {
        cost.textContent =
            `${getDungeonGiornoPagaPmCost()} PM`;
    }


    button.style.display =
        "none";


    healButton.insertAdjacentElement(
        "afterend",
        button
    );


    return button;


}




function updateDungeonGiornoPagaVisibility() {


    const button =
        ensureDungeonGiornoPagaButton();


    if (!button) {
        return;
    }


    button.style.display =
        hasDungeonAbility("giorno_paga")
            ? ""
            : "none";


    const cost =
        button.querySelector(
            "small"
        );


    if (cost) {
        cost.textContent =
            `${getDungeonGiornoPagaPmCost()} PM`;
    }


}




function updateDungeonGiornoPagaAvailability() {


    const button =
        document.getElementById(
            "dungeon-giorno-paga-button"
        );


    if (
        !button ||
        !character
    ) {
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


    button.disabled =
        !hasDungeonAbility("giorno_paga") ||
        currentPM < getDungeonGiornoPagaPmCost() ||
        dungeonGiornoPagaInProgress;


}




function setupDungeonGiornoPagaAction() {


    const button =
        ensureDungeonGiornoPagaButton();


    if (!button) {
        return;
    }


    if (
        button.dataset.giornoPagaReady !==
        "1"
    ) {


        button.dataset.giornoPagaReady =
            "1";


        button.addEventListener(
            "click",
            async () => {


                if (
                    button.disabled ||
                    dungeonGiornoPagaInProgress
                ) {
                    return;
                }


                // Se il giocatore aveva aperto il targeting di Cura,
                // lo chiudiamo usando la funzione già esistente.
                // Non viene modificata alcuna logica di Cura.
                if (healModeActive) {
                    deactivateHealMode();
                }


                await castDungeonGiornoPaga();


            }
        );


    }


    updateDungeonGiornoPagaVisibility();
    updateDungeonGiornoPagaAvailability();


}




async function castDungeonGiornoPaga() {


    if (
        !character ||
        !hasDungeonAbility("giorno_paga") ||
        dungeonGiornoPagaInProgress
    ) {
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


    const pmCost =
        getDungeonGiornoPagaPmCost();


    if (currentPM < pmCost) {


        setMessage(
            "Non hai abbastanza PM per usare Giorno Paga."
        );


        updateDungeonGiornoPagaAvailability();


        return;
    }


    dungeonGiornoPagaInProgress =
        true;


    updateDungeonGiornoPagaAvailability();


    try {


        const {
            data,
            error
        } =
            await db.rpc(
                "cast_giorno_paga_outside_combat",
                {
                    p_character_id:
                        character.id
                }
            );


        if (error) {
            throw error;
        }


        if (
            data?.current_pm !==
            undefined
        ) {
            character.current_pm =
                Number(
                    data.current_pm
                );
        }


        updateCharacterPanel();


        setMessage(
            `Usi GIORNO PAGA! L'oro del prossimo incontro sarà raddoppiato. (-${data?.pm_cost ?? pmCost} PM)`
        );


    } catch (error) {


        console.error(
            "Errore Giorno Paga fuori combattimento:",
            error
        );


        setMessage(
            error?.message ||
            "Non è stato possibile usare Giorno Paga."
        );


    } finally {


        dungeonGiornoPagaInProgress =
            false;


        updateDungeonGiornoPagaVisibility();
        updateDungeonGiornoPagaAvailability();


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
    // Posizione ufficiale del Piano Ia; non utilizzare dungeon_x/y del Piano 1.
    const {data,error}=await db.rpc('piano_ia_get_position');
    if(error) throw error;
    if(!data?.active) throw new Error('Il personaggio non e` attivo nel Piano Ia.');
    playerX=Number(data.x);playerY=Number(data.y);
    if(!Number.isInteger(playerX)||!Number.isInteger(playerY)) throw new Error('Coordinate Piano Ia non valide');
    showToken(playerX,playerY);
}




// ============================================================
// CARTELLO - MANO DI SCIMMIA
// ============================================================


function setupMonkeySignToken() {


    // Evento conservato nel codice ma temporaneamente disattivato.
    // Con false il cartello non viene creato e X2 Y11 resta libera.
    if (!MONKEY_SIGN_ENABLED) {


        if (monkeySignElement) {
            monkeySignElement.remove();
            monkeySignElement = null;
        }


        return;
    }


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
        MONKEY_SIGN_ENABLED === true
        &&
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


    if (!MONKEY_SIGN_ENABLED) {


        monkeySignElement.style.display =
            "none";


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
    if (piaFogReady) piaRenderFog();




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


async function performMovement(dx,dy) {
    if(!character||!dungeonData||eventLocked)return false;
    const nx=playerX+dx,ny=playerY+dy;
    if(await piaSpecialTryInteract(nx,ny)) return false;
    if(await piaCombatTryInteract(nx,ny)) return false;
    if(nx<0||ny<0||nx>=MAP_COLUMNS||ny>=MAP_ROWS||!canMoveTo(nx,ny)){
        setMessage('Il passaggio e` bloccato.');return false;
    }
    try {
        const {data,error}=await db.rpc('piano_ia_move',{p_x:nx,p_y:ny});
        if(error) throw error;
        playerX=Number(data.x);playerY=Number(data.y);
        showToken(playerX,playerY);piaRevealAroundPlayer();updateDungeonCamera();
        piaCombatMoved();
        piaSpecialMoved();
        if(typeof broadcastDungeonPosition==='function') broadcastDungeonPosition();
        setMessage(`Giungla Bassa - X ${playerX} Y ${playerY}`);
        return true;
    }catch(error){console.error('Movimento Piano Ia:',error);setMessage(error.message||'Movimento non riuscito');return false;}
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


// Solo questi due attraversamenti dall'esterno verso l'interno
// richiedono la password. Il percorso inverso è sempre libero.
function isRestrictedBossGateEntry(fromX, fromY, toX, toY) {
    return (
        (Number(fromX) === 19 && Number(fromY) === 15 &&
         Number(toX) === 19 && Number(toY) === 16) ||
        (Number(fromX) === 15 && Number(fromY) === 17 &&
         Number(toX) === 16 && Number(toY) === 17)
    );
}


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


function canMoveTo(x,y) {
    if(!dungeonData?.cells||x<0||y<0||x>=MAP_COLUMNS||y>=MAP_ROWS)return false;
    const cell=Number(dungeonData.cells[y+GRID_OFFSET_Y]?.[x+GRID_OFFSET_X]);
    if(!Number.isFinite(cell)||cell===0)return false;
    const b=dungeonData.cell_bit||{};
    return [b.room??2,b.corridor??4,b.aperture??32,b.arch??65536,b.door??131072,b.portcullis??2097152,b.stair_down??4194304,b.stair_up??8388608].some(bit=>(cell&bit)!==0);
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
            renderDungeonTradeNearbyPlayers();
            refreshDungeonTradeAdjacencyState();


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
            renderDungeonTradeNearbyPlayers();
            refreshDungeonTradeAdjacencyState();
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
    // SCAMBIO TRA GIOCATORI
    // ========================================================


    dungeonChannel.on(
        "broadcast",
        { event: "dungeon-trade-request" },
        message => {
            handleDungeonTradeRequestBroadcast(message?.payload);
        }
    );


    dungeonChannel.on(
        "broadcast",
        { event: "dungeon-trade-update" },
        message => {
            handleDungeonTradeUpdateBroadcast(message?.payload);
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


    renderDungeonTradeNearbyPlayers();
    refreshDungeonTradeAdjacencyState();


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




    // Giorno Paga è gestito separatamente da Cura.
    updateDungeonGiornoPagaAvailability();


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




    updateFruitConsumable();
    updateSpatialCoinAction();
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
            if (entry.item?.id === 'frutto_carnoso') return false;


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


function setupFogOfWar() { /* Nebbia del dungeon Piano 1 non applicabile qui. */ }




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


function updateFogOfWar() { /* Nebbia Piano Ia da integrare nella fase successiva. */ }




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
// SCAMBIO TRA GIOCATORI - DUNGEON
// Interfaccia fissa sotto le statistiche del personaggio.
// Il click/tap sulla mappa resta sempre dedicato al movimento.
// ============================================================


let dungeonTradeCurrentId = null;
let dungeonTradeInviteId = null;
let dungeonTradeBusy = false;
let dungeonTradePollTimer = null;
let dungeonTradeSelectedCharacterId = null;


function setupDungeonTradeUi() {
    document.getElementById("dungeon-trade-add-item")
        ?.addEventListener("click", addSelectedDungeonTradeItem);


    document.getElementById("dungeon-trade-confirm")
        ?.addEventListener("click", confirmCurrentDungeonTrade);


    document.getElementById("dungeon-trade-cancel")
        ?.addEventListener("click", cancelCurrentDungeonTrade);


    document.getElementById("dungeon-trade-accept")
        ?.addEventListener("click", acceptDungeonTradeInvite);


    document.getElementById("dungeon-trade-decline")
        ?.addEventListener("click", declineDungeonTradeInvite);


    document.getElementById("dungeon-trade-item-select")
        ?.addEventListener("change", updateDungeonTradeQuantityLimit);


    renderDungeonTradeNearbyPlayers();
    resetDungeonTradePanel();
}


function isDungeonTradeInteractionOpen() {
    return false;
}


function isDungeonTradeAdjacent(player) {
    if (!player) return false;


    const distance =
        Math.abs(Number(playerX) - Number(player.x)) +
        Math.abs(Number(playerY) - Number(player.y));


    return distance === 1;
}


function getAdjacentDungeonTradePlayers() {
    return Array.from(otherPlayers.values())
        .filter(player => {
            if (!player?.character_id) return false;
            if (player.in_combat || player.active_combat_id) return false;
            return isDungeonTradeAdjacent(player);
        })
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "it"));
}


function renderDungeonTradeNearbyPlayers() {
    const container = document.getElementById("dungeon-trade-nearby-players");
    if (!container) return;


    const players = getAdjacentDungeonTradePlayers();
    container.replaceChildren();


    if (!players.length) {
        const empty = document.createElement("div");
        empty.className = "dungeon-trade-inline-empty";
        empty.textContent = "Nessun giocatore adiacente.";
        container.appendChild(empty);
        return;
    }


    players.forEach(player => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "dungeon-trade-nearby-player";


        if (player.character_id === dungeonTradeSelectedCharacterId) {
            button.classList.add("selected");
        }


        const image = document.createElement("img");
        image.src = "../../immagini/token/" + (player.token || "token_1.png");
        image.alt = player.name || "Personaggio";


        const text = document.createElement("span");
        const name = document.createElement("strong");
        name.textContent = player.name || "Avventuriero";
        const state = document.createElement("small");


        if (dungeonTradeInviteId && player.character_id === dungeonTradeSelectedCharacterId) {
            state.textContent = "Richiesta ricevuta";
        } else if (dungeonTradeCurrentId && player.character_id === dungeonTradeSelectedCharacterId) {
            state.textContent = "Scambio selezionato";
        } else {
            state.textContent = "Adiacente";
        }


        text.append(name, state);
        button.append(image, text);


        button.addEventListener("click", () => selectDungeonTradePlayer(player.character_id));
        container.appendChild(button);
    });
}


async function selectDungeonTradePlayer(characterId) {
    if (dungeonTradeBusy) return;


    const player = otherPlayers.get(characterId);
    if (!player || !isDungeonTradeAdjacent(player)) {
        setMessage("Il personaggio non è più adiacente.");
        renderDungeonTradeNearbyPlayers();
        return;
    }


    if (player.in_combat || player.active_combat_id) {
        setMessage("Non puoi scambiare con un personaggio in combattimento.");
        return;
    }


    // Se esiste già uno scambio con questo giocatore, mostralo.
    const existing = await findDungeonTradeWithCharacter(characterId);
    if (existing) {
        dungeonTradeSelectedCharacterId = characterId;


        if (existing.status === "pending" && existing.character_b_id === character.id) {
            dungeonTradeInviteId = existing.id;
            dungeonTradeCurrentId = null;
            showDungeonTradePendingInvite(existing);
        } else {
            dungeonTradeInviteId = null;
            dungeonTradeCurrentId = existing.id;
            await refreshDungeonTradeState();
            startDungeonTradePolling();
        }


        renderDungeonTradeNearbyPlayers();
        return;
    }


    if (dungeonTradeCurrentId || dungeonTradeInviteId) {
        setMessage("Hai già uno scambio in corso. Annullalo prima di iniziarne un altro.");
        return;
    }


    await openDungeonTradeForRemotePlayer(characterId);
}


async function findDungeonTradeWithCharacter(characterId) {
    if (!character) return null;


    const { data, error } = await db
        .from("player_trades")
        .select("id, character_a_id, character_b_id, status, a_confirmed, b_confirmed")
        .or(`and(character_a_id.eq.${character.id},character_b_id.eq.${characterId}),and(character_a_id.eq.${characterId},character_b_id.eq.${character.id})`)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();


    if (error) {
        console.warn("Errore ricerca scambio esistente:", error);
        return null;
    }


    return data || null;
}


async function openDungeonTradeForRemotePlayer(characterId) {
    const player = otherPlayers.get(characterId);
    if (!player || !isDungeonTradeAdjacent(player)) {
        setMessage("Devi essere adiacente al personaggio per proporre uno scambio.");
        return;
    }


    dungeonTradeBusy = true;
    dungeonTradeSelectedCharacterId = characterId;


    try {
        const { data, error } = await db.rpc(
            "create_player_trade",
            { p_target_character_id: characterId }
        );


        if (error) throw error;


        dungeonTradeCurrentId = data;
        dungeonTradeInviteId = null;


        setDungeonTradePanelEnabled(true);
        setDungeonTradeStatus(`Richiesta inviata a ${player.name}. In attesa che accetti...`);
        setDungeonTradeControlsForStatus("pending-sent");
        clearDungeonTradeOffers();


        await sendDungeonTradeBroadcast("dungeon-trade-request", {
            trade_id: data,
            from_character_id: character.id,
            from_name: character.nome || "Avventuriero",
            to_character_id: characterId
        });


        startDungeonTradePolling();
        renderDungeonTradeNearbyPlayers();
    } catch (error) {
        console.error("Errore richiesta scambio:", error);
        dungeonTradeCurrentId = null;
        setDungeonTradeStatus(error?.message || "Impossibile avviare lo scambio.", true);
        setDungeonTradeControlsForStatus("idle");
    } finally {
        dungeonTradeBusy = false;
    }
}


async function sendDungeonTradeBroadcast(event, payload) {
    if (!dungeonChannel || !realtimeReady) return;


    try {
        await dungeonChannel.send({ type: "broadcast", event, payload });
    } catch (error) {
        console.warn("Broadcast scambio non riuscito:", error);
    }
}


function handleDungeonTradeRequestBroadcast(payload) {
    if (!payload || payload.to_character_id !== character?.id) return;


    const remote = otherPlayers.get(payload.from_character_id);
    if (!remote || !isDungeonTradeAdjacent(remote)) return;


    if (dungeonTradeCurrentId || dungeonTradeInviteId) return;


    dungeonTradeInviteId = payload.trade_id;
    dungeonTradeSelectedCharacterId = payload.from_character_id;
    showDungeonTradePendingInvite({ id: payload.trade_id });
    renderDungeonTradeNearbyPlayers();
}


function showDungeonTradePendingInvite() {
    const remote = otherPlayers.get(dungeonTradeSelectedCharacterId);
    setDungeonTradePanelEnabled(true);
    setDungeonTradeStatus(`${remote?.name || "Un giocatore"} vuole scambiare con te.`);
    setDungeonTradeOtherName(remote?.name || "ALTRO GIOCATORE");
    setDungeonTradeControlsForStatus("pending-received");
    clearDungeonTradeOffers();
}


async function acceptDungeonTradeInvite() {
    if (!dungeonTradeInviteId || dungeonTradeBusy) return;


    dungeonTradeBusy = true;
    const tradeId = dungeonTradeInviteId;


    try {
        const { error } = await db.rpc("accept_player_trade", { p_trade_id: tradeId });
        if (error) throw error;


        dungeonTradeInviteId = null;
        dungeonTradeCurrentId = tradeId;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: tradeId,
            kind: "accepted"
        });


        await refreshDungeonTradeState();
        startDungeonTradePolling();
    } catch (error) {
        console.error("Errore accettazione scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile accettare lo scambio.", true);
    } finally {
        dungeonTradeBusy = false;
    }
}


async function declineDungeonTradeInvite() {
    if (!dungeonTradeInviteId || dungeonTradeBusy) return;


    dungeonTradeBusy = true;
    const tradeId = dungeonTradeInviteId;


    try {
        const { error } = await db.rpc("cancel_player_trade", { p_trade_id: tradeId });
        if (error) throw error;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: tradeId,
            kind: "cancelled"
        });


        resetDungeonTradeState("Richiesta rifiutata.");
    } catch (error) {
        console.warn("Errore rifiuto scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile rifiutare la richiesta.", true);
    } finally {
        dungeonTradeBusy = false;
    }
}


function setDungeonTradePanelEnabled(enabled) {
    document.getElementById("dungeon-trade-inline-panel")
        ?.classList.toggle("disabled", !enabled);
}


function setDungeonTradeOtherName(name) {
    const el = document.getElementById("dungeon-trade-other-name");
    if (el) el.textContent = name || "ALTRO GIOCATORE";
}


function setDungeonTradeControlsForStatus(status) {
    const select = document.getElementById("dungeon-trade-item-select");
    const qty = document.getElementById("dungeon-trade-item-quantity");
    const add = document.getElementById("dungeon-trade-add-item");
    const confirm = document.getElementById("dungeon-trade-confirm");
    const cancel = document.getElementById("dungeon-trade-cancel");
    const accept = document.getElementById("dungeon-trade-accept");
    const decline = document.getElementById("dungeon-trade-decline");


    const active = status === "active";
    const pendingReceived = status === "pending-received";
    const hasTrade = status !== "idle";


    if (select) select.disabled = !active;
    if (qty) qty.disabled = !active;
    if (add) add.disabled = !active;
    if (confirm) confirm.disabled = !active;
    if (cancel) cancel.disabled = !hasTrade;
    if (accept) accept.hidden = !pendingReceived;
    if (decline) decline.hidden = !pendingReceived;


    if (active) populateDungeonTradeInventorySelect();
}


function clearDungeonTradeOffers() {
    ["dungeon-trade-my-offer", "dungeon-trade-other-offer"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '<div class="dungeon-trade-empty">Nessun oggetto offerto.</div>';
        }
    });


    ["dungeon-trade-my-confirmed", "dungeon-trade-other-confirmed"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = "NON CONFERMATO";
            el.classList.remove("confirmed");
        }
    });
}


function resetDungeonTradePanel() {
    setDungeonTradePanelEnabled(false);
    setDungeonTradeOtherName("ALTRO GIOCATORE");
    setDungeonTradeStatus("Seleziona un giocatore adiacente.");
    setDungeonTradeControlsForStatus("idle");
    clearDungeonTradeOffers();


    const select = document.getElementById("dungeon-trade-item-select");
    if (select) {
        select.replaceChildren();
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Scegli un oggetto...";
        select.appendChild(option);
    }
}


function populateDungeonTradeInventorySelect() {
    const select = document.getElementById("dungeon-trade-item-select");
    if (!select) return;


    const previous = select.value;
    select.replaceChildren();


    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Scegli un oggetto...";
    select.appendChild(placeholder);


    characterInventory
        .filter(entry => entry?.item && Number(entry.quantity) > 0)
        .sort((a, b) => String(a.item.name).localeCompare(String(b.item.name), "it"))
        .forEach(entry => {
            const option = document.createElement("option");
            option.value = entry.id;
            option.dataset.quantity = String(entry.quantity);
            option.textContent = `${entry.item.name} ×${entry.quantity}` +
                (entry.equipped_slot ? ` · equipaggiato (${entry.equipped_slot})` : "");
            select.appendChild(option);
        });


    if ([...select.options].some(option => option.value === previous)) {
        select.value = previous;
    }


    updateDungeonTradeQuantityLimit();
}


function updateDungeonTradeQuantityLimit() {
    const select = document.getElementById("dungeon-trade-item-select");
    const input = document.getElementById("dungeon-trade-item-quantity");
    if (!select || !input) return;


    const option = select.selectedOptions?.[0];
    const entry = characterInventory.find(row => row.id === select.value);
    const max = Number(option?.dataset?.quantity) || 1;


    input.max = String(max);
    input.value = String(Math.min(Math.max(1, Number(input.value) || 1), max));


    if (entry?.equipped_slot) {
        input.value = String(entry.quantity);
        input.disabled = true;
    } else {
        input.disabled = !select.value || !dungeonTradeCurrentId;
    }
}


async function addSelectedDungeonTradeItem() {
    if (!dungeonTradeCurrentId || dungeonTradeBusy) return;


    const select = document.getElementById("dungeon-trade-item-select");
    const input = document.getElementById("dungeon-trade-item-quantity");


    if (!select?.value) {
        setDungeonTradeStatus("Scegli prima un oggetto da offrire.", true);
        return;
    }


    const quantity = Number(input?.value) || 1;
    dungeonTradeBusy = true;


    try {
        const { error } = await db.rpc("add_player_trade_item", {
            p_trade_id: dungeonTradeCurrentId,
            p_inventory_id: select.value,
            p_quantity: quantity
        });
        if (error) throw error;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: dungeonTradeCurrentId,
            kind: "changed"
        });
        await refreshDungeonTradeState();
    } catch (error) {
        console.error("Errore aggiunta oggetto allo scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile aggiungere l'oggetto.", true);
    } finally {
        dungeonTradeBusy = false;
    }
}


async function removeDungeonTradeItem(tradeItemId) {
    if (!dungeonTradeCurrentId || dungeonTradeBusy) return;
    dungeonTradeBusy = true;


    try {
        const { error } = await db.rpc("remove_player_trade_item", {
            p_trade_item_id: tradeItemId
        });
        if (error) throw error;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: dungeonTradeCurrentId,
            kind: "changed"
        });
        await refreshDungeonTradeState();
    } catch (error) {
        console.error("Errore rimozione oggetto dallo scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile rimuovere l'oggetto.", true);
    } finally {
        dungeonTradeBusy = false;
    }
}


async function refreshDungeonTradeState() {
    if (!dungeonTradeCurrentId || !character) return;


    const { data: trade, error: tradeError } = await db
        .from("player_trades")
        .select("id, character_a_id, character_b_id, status, a_confirmed, b_confirmed")
        .eq("id", dungeonTradeCurrentId)
        .maybeSingle();


    if (tradeError) {
        console.warn("Errore lettura scambio:", tradeError);
        return;
    }


    if (!trade) {
        resetDungeonTradeState("Scambio non più disponibile.");
        return;
    }


    if (trade.status === "cancelled") {
        resetDungeonTradeState("Lo scambio è stato annullato.");
        return;
    }


    if (trade.status === "completed") {
        await loadCharacterEquipment();
        resetDungeonTradeState("Scambio completato.");
        return;
    }


    const otherCharacterId = trade.character_a_id === character.id
        ? trade.character_b_id
        : trade.character_a_id;


    dungeonTradeSelectedCharacterId = otherCharacterId;
    const remote = otherPlayers.get(otherCharacterId);
    setDungeonTradeOtherName(remote?.name || "ALTRO GIOCATORE");
    setDungeonTradePanelEnabled(true);


    if (trade.status === "pending") {
        if (trade.character_b_id === character.id) {
            dungeonTradeInviteId = trade.id;
            dungeonTradeCurrentId = null;
            showDungeonTradePendingInvite(trade);
            renderDungeonTradeNearbyPlayers();
            return;
        }


        setDungeonTradeControlsForStatus("pending-sent");
        setDungeonTradeStatus(`Richiesta inviata a ${remote?.name || "giocatore"}. In attesa che accetti...`);
        renderDungeonTradeNearbyPlayers();
        return;
    }


    dungeonTradeInviteId = null;
    setDungeonTradeControlsForStatus("active");


    if (remote && !isDungeonTradeAdjacent(remote)) {
        setDungeonTradeStatus("Vi siete allontanati: riavvicinatevi per confermare.", true);
    }


    // Dettagli offerta via RPC server-side: il partecipante vede i nomi
    // reali senza ottenere accesso diretto all'inventario dell'altro PG.
    const { data: tradeItemDetails, error: itemsError } = await db.rpc(
        "get_player_trade_items_details",
        { p_trade_id: trade.id }
    );


    if (itemsError) {
        console.warn("Errore lettura dettagli oggetti scambio:", itemsError);
        return;
    }


    const tradeItems = (tradeItemDetails || []).map(row => ({
        id: row.trade_item_id,
        owner_character_id: row.owner_character_id,
        inventory_id: row.inventory_id,
        quantity: row.trade_quantity
    }));


    const inventoryById = new Map(
        (tradeItemDetails || []).map(row => [
            row.inventory_id,
            {
                id: row.inventory_id,
                item_id: row.item_id,
                quantity: row.inventory_quantity,
                equipped_slot: row.equipped_slot,
                item: {
                    id: row.item_id,
                    name: row.item_name,
                    item_type: row.item_type
                }
            }
        ])
    );


    renderDungeonTradeOffers(trade, tradeItems, inventoryById, remote);
    renderDungeonTradeNearbyPlayers();
}


function renderDungeonTradeOffers(trade, tradeItems, inventoryById, remote) {
    const mine = document.getElementById("dungeon-trade-my-offer");
    const theirs = document.getElementById("dungeon-trade-other-offer");
    const confirmButton = document.getElementById("dungeon-trade-confirm");


    setDungeonTradeOtherName(remote?.name || "ALTRO GIOCATORE");


    const render = (container, ownerId, editable) => {
        if (!container) return;
        container.replaceChildren();


        const rows = tradeItems.filter(row => row.owner_character_id === ownerId);
        if (!rows.length) {
            const empty = document.createElement("div");
            empty.className = "dungeon-trade-empty";
            empty.textContent = "Nessun oggetto offerto.";
            container.appendChild(empty);
            return;
        }


        rows.forEach(row => {
            const inv = inventoryById.get(row.inventory_id);
            const card = document.createElement("div");
            card.className = "dungeon-trade-offer-row";


            const label = document.createElement("span");
            label.textContent = `${inv?.item?.name || "Oggetto"} ×${row.quantity}`;
            card.appendChild(label);


            if (editable) {
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "dungeon-trade-remove";
                remove.textContent = "×";
                remove.title = "Rimuovi dall'offerta";
                remove.addEventListener("click", () => removeDungeonTradeItem(row.id));
                card.appendChild(remove);
            }


            container.appendChild(card);
        });
    };


    const myConfirmed = trade.character_a_id === character.id ? trade.a_confirmed : trade.b_confirmed;
    const otherConfirmed = trade.character_a_id === character.id ? trade.b_confirmed : trade.a_confirmed;


    render(mine, character.id, true);
    render(theirs,
        trade.character_a_id === character.id ? trade.character_b_id : trade.character_a_id,
        false
    );


    const myState = document.getElementById("dungeon-trade-my-confirmed");
    const otherState = document.getElementById("dungeon-trade-other-confirmed");


    if (myState) {
        myState.textContent = myConfirmed ? "CONFERMATO ✓" : "NON CONFERMATO";
        myState.classList.toggle("confirmed", !!myConfirmed);
    }


    if (otherState) {
        otherState.textContent = otherConfirmed ? "CONFERMATO ✓" : "NON CONFERMATO";
        otherState.classList.toggle("confirmed", !!otherConfirmed);
    }


    if (confirmButton) {
        confirmButton.disabled = !!myConfirmed;
        confirmButton.textContent = myConfirmed ? "CONFERMATO" : "CONFERMA";
    }


    if (myConfirmed && !otherConfirmed) {
        setDungeonTradeStatus("Confermato. In attesa dell'altro giocatore...");
    } else if (!myConfirmed && otherConfirmed) {
        setDungeonTradeStatus("L'altro giocatore ha confermato. Controlla l'offerta e conferma.");
    } else if (!(remote && !isDungeonTradeAdjacent(remote))) {
        setDungeonTradeStatus("Aggiungi gli oggetti da offrire e conferma quando sei pronto.");
    }
}


async function confirmCurrentDungeonTrade() {
    if (!dungeonTradeCurrentId || dungeonTradeBusy) return;


    const tradeId = dungeonTradeCurrentId;
    dungeonTradeBusy = true;


    try {
        const { data, error } = await db.rpc("confirm_player_trade", {
            p_trade_id: tradeId
        });
        if (error) throw error;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: tradeId,
            kind: data?.completed ? "completed" : "confirmed"
        });


        if (data?.completed) {
            await loadCharacterEquipment();
            resetDungeonTradeState("Scambio completato.");
            return;
        }


        await refreshDungeonTradeState();
    } catch (error) {
        console.error("Errore conferma scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile confermare lo scambio.", true);
        await refreshDungeonTradeState();
    } finally {
        dungeonTradeBusy = false;
    }
}


async function cancelCurrentDungeonTrade() {
    const tradeId = dungeonTradeCurrentId || dungeonTradeInviteId;
    if (!tradeId || dungeonTradeBusy) {
        resetDungeonTradeState();
        return;
    }


    dungeonTradeBusy = true;


    try {
        const { error } = await db.rpc("cancel_player_trade", { p_trade_id: tradeId });
        if (error) throw error;


        await sendDungeonTradeBroadcast("dungeon-trade-update", {
            trade_id: tradeId,
            kind: "cancelled"
        });


        resetDungeonTradeState("Scambio annullato.");
    } catch (error) {
        console.error("Errore annullamento scambio:", error);
        setDungeonTradeStatus(error?.message || "Impossibile annullare lo scambio.", true);
    } finally {
        dungeonTradeBusy = false;
    }
}


function handleDungeonTradeUpdateBroadcast(payload) {
    if (!payload?.trade_id) return;


    if (payload.kind === "cancelled") {
        if (payload.trade_id === dungeonTradeCurrentId || payload.trade_id === dungeonTradeInviteId) {
            resetDungeonTradeState("Lo scambio è stato annullato dall'altro giocatore.");
        }
        return;
    }


    if (payload.trade_id === dungeonTradeCurrentId) {
        refreshDungeonTradeState();
        return;
    }


    if (payload.trade_id === dungeonTradeInviteId && payload.kind === "accepted") {
        dungeonTradeCurrentId = dungeonTradeInviteId;
        dungeonTradeInviteId = null;
        refreshDungeonTradeState();
        startDungeonTradePolling();
    }
}


function setDungeonTradeStatus(text, error = false) {
    const status = document.getElementById("dungeon-trade-status");
    if (!status) return;
    status.textContent = text || "";
    status.classList.toggle("error", !!error);
}


function startDungeonTradePolling() {
    stopDungeonTradePolling();
    dungeonTradePollTimer = window.setInterval(() => refreshDungeonTradeState(), 1500);
}


function stopDungeonTradePolling() {
    if (dungeonTradePollTimer) {
        clearInterval(dungeonTradePollTimer);
        dungeonTradePollTimer = null;
    }
}


function resetDungeonTradeState(message = "") {
    dungeonTradeCurrentId = null;
    dungeonTradeInviteId = null;
    dungeonTradeSelectedCharacterId = null;
    stopDungeonTradePolling();
    resetDungeonTradePanel();
    renderDungeonTradeNearbyPlayers();
    if (message) setMessage(message);
}


function refreshDungeonTradeAdjacencyState() {
    if (!dungeonTradeSelectedCharacterId) return;
    const remote = otherPlayers.get(dungeonTradeSelectedCharacterId);
    if (!remote || !isDungeonTradeAdjacent(remote)) {
        if (dungeonTradeCurrentId || dungeonTradeInviteId) {
            setDungeonTradeStatus("Il giocatore non è più adiacente.", true);
        }
    }
}


async function recoverDungeonTradeState() {
    if (!character) return;


    try {
        const { data, error } = await db
            .from("player_trades")
            .select("id, character_a_id, character_b_id, status, a_confirmed, b_confirmed, created_at")
            .or(`character_a_id.eq.${character.id},character_b_id.eq.${character.id}`)
            .in("status", ["pending", "active"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();


        if (error || !data) {
            renderDungeonTradeNearbyPlayers();
            return;
        }


        const otherId = data.character_a_id === character.id
            ? data.character_b_id
            : data.character_a_id;


        dungeonTradeSelectedCharacterId = otherId;


        if (data.status === "pending" && data.character_b_id === character.id) {
            dungeonTradeInviteId = data.id;
            showDungeonTradePendingInvite(data);
        } else {
            dungeonTradeCurrentId = data.id;
            await refreshDungeonTradeState();
            startDungeonTradePolling();
        }


        renderDungeonTradeNearbyPlayers();
    } catch (error) {
        console.warn("Impossibile recuperare uno scambio precedente:", error);
    }
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
    // V3: in una colonna ci sono due pannelli affiancati sopra la TOP 5.
    // La vecchia funzione assegnava l'altezza della mappa al solo contenitore
    // Chat/Online e spingeva la classifica fuori dall'impaginazione.
    const side = document.querySelector('.dungeon-chat-column');
    const map = document.querySelector('.dungeon-map-frame');
    if (!side || !map) return;
    if (window.innerWidth <= 1050) {
        side.style.height = '';
        side.style.maxHeight = '';
        return;
    }
    const mapHeight = map.getBoundingClientRect().height;
    if (!Number.isFinite(mapHeight) || mapHeight <= 0) return;
    side.style.height = `${mapHeight}px`;
    side.style.maxHeight = `${mapHeight}px`;
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


/* FRUTTO CARNOSO — CONSUMABILE DINAMICO IN DUNGEON */
let fruitConsumableBusy = false;
function fruitInventoryRows() {
    return (Array.isArray(characterInventory) ? characterInventory : [])
        .filter(row => row?.item?.id === 'frutto_carnoso'
            && !row.equipped_slot && Number(row.quantity) > 0);
}
function ensureFruitConsumableButton() {
    let button = document.getElementById('dungeon-fruit-button');
    if (button) return button;
    const panel = document.querySelector('.dungeon-actions-panel');
    if (!panel) return null;
    button = document.createElement('button');
    button.id = 'dungeon-fruit-button';
    button.type = 'button';
    button.className = 'dungeon-action-card';
    button.hidden = true;
    button.style.display = 'none';
    button.title = 'Recupera fino a 10 PF e 10 PM';
    button.innerHTML =
        '<span class="action-card-icon">✿</span>' +
        '<span class="action-card-content"><strong>FRUTTO CARNOSO</strong>' +
        '<small id="dungeon-fruit-count">x0</small></span>';
    const pagination = panel.querySelector('.dungeon-action-pagination');
    panel.insertBefore(button, pagination || null);
    button.addEventListener('click', useFruitConsumable);
    return button;
}
function updateFruitConsumable() {
    const button = ensureFruitConsumableButton();
    if (!button) return;
    const rows = fruitInventoryRows();
    const count = rows.reduce((n, row) => n + Number(row.quantity || 0), 0);
    button.hidden = count === 0;
    button.style.display = count ? '' : 'none';
    const countElement = document.getElementById('dungeon-fruit-count');
    if (countElement) countElement.textContent = 'x' + count;
    if (!count || fruitConsumableBusy || !character) {
        button.disabled = true;
        return;
    }
    const stats = getDungeonCalculatedStats();
    const pf = character.current_hp == null ? stats.maxHealth : Number(character.current_hp);
    const pm = character.current_pm == null ? stats.maxMana : Number(character.current_pm);
    button.disabled = pf >= stats.maxHealth && pm >= stats.maxMana;
}
async function useFruitConsumable() {
    const button = ensureFruitConsumableButton();
    if (fruitConsumableBusy || !button || button.disabled || !character || !db) return;
    const row = fruitInventoryRows()[0];
    if (!row) { updateFruitConsumable(); return; }
    fruitConsumableBusy = true;
    button.disabled = true;
    try {
        const { data, error } = await db.rpc('use_piano_ia_fruit', { p_inventory_id: row.id });
        if (error) throw error;
        character.current_hp = Number(data.current_pf);
        character.current_pm = Number(data.current_pm);
        await loadCharacterEquipment();
        updateCharacterPanel();
        updateMyPresence();
        setMessage('Mangi un Frutto Carnoso. PF ' + data.current_pf + '/' +
            data.max_pf + ', PM ' + data.current_pm + '/' + data.max_pm + '.');
    } catch (error) {
        console.error('Errore utilizzo Frutto Carnoso:', error);
        setMessage(error?.message || 'Impossibile utilizzare il Frutto Carnoso.', true);
    } finally {
        fruitConsumableBusy = false;
        updateFruitConsumable();
    }
}

// ============================================================
// PIANO IA — ZOOM E NEBBIA (la griglia e il layout restano invariati)
// ============================================================
let piaViewCells = 13;
let piaFogReady = false;
let piaMaster = false;
let piaNoFog = false;
let piaVisited = new Set();
let piaFogElement = null;
let piaLastFogPosition = '';

// Celle visibili adesso, separate dallo storico esplorato.
let piaVisibleNow = new Set();
function piaBlocksSight(x, y) { return !canMoveTo(x, y); }
function piaHasLineOfSight(targetX, targetY) {
    if (targetX === playerX && targetY === playerY) return true;
    const dx = targetX - playerX, dy = targetY - playerY;
    const stepX = Math.sign(dx), stepY = Math.sign(dy);
    const absX = Math.abs(dx), absY = Math.abs(dy);
    let x = playerX, y = playerY, ix = 0, iy = 0;
    while (ix < absX || iy < absY) {
        const comparison = (1 + 2 * ix) * absY - (1 + 2 * iy) * absX;
        if (comparison === 0) {
            if (piaBlocksSight(x + stepX, y) && piaBlocksSight(x, y + stepY)) return false;
            x += stepX; y += stepY; ix++; iy++;
        } else if (comparison < 0) { x += stepX; ix++; }
        else { y += stepY; iy++; }
        if (x === targetX && y === targetY) return true;
        if (piaBlocksSight(x, y)) return false;
    }
    return true;
}
function piaRevealAroundPlayer() {
    if (!piaFogReady || playerX == null || playerY == null) return;
    const mark = playerX + ',' + playerY;
    if (mark === piaLastFogPosition) return;
    piaLastFogPosition = mark;
    piaVisibleNow = new Set();
    let changed = false;
    for (let y = Math.max(0, playerY - 6); y <= Math.min(MAP_ROWS - 1, playerY + 6); y++) {
        for (let x = Math.max(0, playerX - 6); x <= Math.min(MAP_COLUMNS - 1, playerX + 6); x++) {
            if (!piaHasLineOfSight(x, y)) continue;
            const key = x + ',' + y;
            piaVisibleNow.add(key);
            if (!piaVisited.has(key)) { piaVisited.add(key); changed = true; }
        }
    }
    if (changed) {
        try { localStorage.setItem('palazzo:piano-Ia:fog:' + character.id, JSON.stringify([...piaVisited])); }
        catch (_) { /* Storage opzionale */ }
    }
}
function piaRenderFog() {
    if (!piaFogReady || !piaFogElement) return;
    piaRevealAroundPlayer();
    const ctx = piaFogElement.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, MAP_COLUMNS, MAP_ROWS);
    if (piaMaster && piaNoFog) return;
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLUMNS; x++) {
            if (piaVisibleNow.has(x + ',' + y)) continue;
            ctx.fillStyle = piaVisited.has(x + ',' + y) ? 'rgba(3,13,6,0.64)' : 'rgba(2,9,4,0.97)';
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

async function setupPiaZoomAndExploration() {
    const map = document.getElementById('dungeon-map');
    const toolbar = document.querySelector('.pia-map-toolbar');
    if (!map || !toolbar) return;
    const setZoom = value => {
        piaViewCells = Math.max(5, Math.min(81, Math.round(value)));
        map.style.setProperty('--pia-view-cells', String(piaViewCells));
        map.style.setProperty('width', `${MAP_COLUMNS * 100 / piaViewCells}%`, 'important');
        map.style.setProperty('height', `${MAP_ROWS * 100 / piaViewCells}%`, 'important');
        const reset = document.getElementById('pia-zoom-reset');
        if (reset) reset.title = `Visuale attuale: ${piaViewCells} caselle`;
        updateDungeonCamera(true);
        repositionAllTokens();
        piaCombatRender();
    };
    document.getElementById('pia-zoom-out').addEventListener('click', () => setZoom(piaViewCells + (piaViewCells < 20 ? 2 : 8)));
    document.getElementById('pia-zoom-in').addEventListener('click', () => setZoom(piaViewCells - (piaViewCells <= 20 ? 2 : 8)));
    document.getElementById('pia-zoom-reset').addEventListener('click', () => setZoom(13));
    document.getElementById('pia-zoom-full').addEventListener('click', () => setZoom(81));

    piaFogElement = document.createElement('canvas');
    piaFogElement.id = 'pia-fog-overlay';
    piaFogElement.width = MAP_COLUMNS;
    piaFogElement.height = MAP_ROWS;
    piaFogElement.setAttribute('aria-hidden', 'true');
    map.appendChild(piaFogElement);
    try {
        const stored = JSON.parse(localStorage.getItem(`palazzo:piano-Ia:fog:${character.id}`) || '[]');
        if (Array.isArray(stored)) piaVisited = new Set(stored.filter(v => typeof v === 'string'));
    } catch (_) { piaVisited = new Set(); }
    // I controlli Master vengono mostrati solo dopo verifica del ruolo sul server.
    try {
        if (currentUser?.id) {
            const { data, error } = await db.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle();
            if (!error && data?.role === 'master') {
                piaMaster = true;
                document.getElementById('pia-master-exploration').hidden = false;
                document.getElementById('pia-master-no-fog').addEventListener('change', e => {
                    piaNoFog = e.target.checked === true;
                    piaRenderFog();
                });
            }
        }
    } catch (error) { console.warn('Permessi esplorazione non disponibili:', error); }
    piaFogReady = true;
    piaRevealAroundPlayer();
    setZoom(13);
    piaRenderFog();
}



// ============================================================
// PIANO I-A — EVENTI E INCONTRI ROTANTI (compatibilità RPC preesistenti)
// Modulo isolato: nessuna modifica alla logica del Piano 1.
// ============================================================
const piaCombat = {
    slots: new Map(), tokens: new Map(), boss: null,
    updating: false, entering: false, ready: false, timer: null,
    stateKnown: false
};
const PIA_COMBAT_FAMILIES = Object.freeze({
    uccello_parassita: ['🐦','Uccelli Parassita'],
    piante_carnivore: ['🌿','Piante Carnivore'],
    lucertoloidi: ['🦎','Pattuglie di Lucertoloidi'],
    dinosauri: ['🦖','Dinosauri Selvaggi'],
    miconidi: ['🍄','Miconidi Tossici']
});

function piaCombatDialog(title, description, actionLabel = 'COMBATTI') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className='pia-encounter-overlay';
        overlay.setAttribute('role','dialog');
        overlay.setAttribute('aria-modal','true');
        overlay.setAttribute('aria-label',title);
        const card=document.createElement('section');card.className='pia-encounter-card';
        const h=document.createElement('h2');h.textContent=title;
        const p=document.createElement('p');p.textContent=description;
        const controls=document.createElement('div');controls.className='pia-encounter-actions';
        const cancel=document.createElement('button');cancel.type='button';cancel.textContent='VAI VIA';
        const accept=document.createElement('button');accept.type='button';accept.textContent=actionLabel;
        controls.append(cancel,accept);card.append(h,p,controls);overlay.appendChild(card);
        document.body.appendChild(overlay);
        const oldFocus=document.activeElement;
        const done = result => {
            overlay.removeEventListener('click',backdrop);
            document.removeEventListener('keydown',key,true);
            overlay.remove();
            if(oldFocus?.isConnected)oldFocus.focus({preventScroll:true});
            resolve(result);
        };
        const backdrop = e => {if(e.target===overlay)done(false)};
        const key=e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(false)}
            else if(e.key==='Tab'){e.preventDefault();(document.activeElement===cancel?accept:cancel).focus()}
            else if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation()}
        };
        cancel.addEventListener('click',()=>done(false));
        accept.addEventListener('click',()=>done(true));
        overlay.addEventListener('click',backdrop);
        document.addEventListener('keydown',key,true);
        cancel.focus({preventScroll:true});
    });
}
function piaCombatNotice(message,error=false) {
    if(typeof setMessage==='function')setMessage(message,error);
}
function piaCombatPoint(el,x,y) {
    const map=document.getElementById('dungeon-map');
    if(!map || !el)return;
    // Relativi alla mappa intera, anche con zoom massimo o camera spostata.
    el.style.left=((x+.5)/MAP_COLUMNS*100)+'%';
    el.style.top=((y+.5)/MAP_ROWS*100)+'%';
    el.style.width=(100/MAP_COLUMNS*1.2)+'%';
    el.style.height=(100/MAP_ROWS*1.2)+'%';
    el.style.fontSize=`clamp(11px, ${Math.max(11,Math.min(22,map.offsetWidth/MAP_COLUMNS*0.92))}px, 22px)`;
}
function piaCombatMakeToken(id,icon,cls,title,fn) {
    let el=piaCombat.tokens.get(id);
    if(!el) {
        el=document.createElement('button');el.type='button';
        el.className='pia-encounter-token '+cls;
        el.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();fn()});
        document.getElementById('dungeon-map')?.appendChild(el);
        piaCombat.tokens.set(id,el);
    }
    el.textContent=icon;el.title=title;el.setAttribute('aria-label',title);
    return el;
}
function piaCombatRender() {
    if(!piaCombat.ready)return;
    const active=new Set();
    for(const slot of piaCombat.slots.values()) {
        if(!['active','engaged'].includes(slot.status))continue;
        const family=PIA_COMBAT_FAMILIES[slot.family];
        const x=Number(slot.x),y=Number(slot.y),id=String(slot.encounter_id||'');
        if(!family || !id || !Number.isInteger(x) || !Number.isInteger(y) ||x<0||x>=MAP_COLUMNS||y<0||y>=MAP_ROWS)continue;
        const key='room:'+id;active.add(key);
        const detail=`${family[1]} · ${slot.difficulty||'medio'} · stanza ${slot.room_number||'?'}${slot.status==='engaged'?' · combattimento in corso':''}`;
        const el=piaCombatMakeToken(key,'','pia-encounter-room',detail,()=>piaCombatRoom(id));
        // Immagine condivisa per tutti gli incontri normali della Giungla Bassa.
        let image=el.querySelector('img');
        if(!image){
            image=document.createElement('img');
            image.src='immagini/combat-Ia.png';
            image.alt='';
            image.draggable=false;
            image.style.width='100%';
            image.style.height='100%';
            image.style.objectFit='contain';
            image.style.display='block';
            image.style.pointerEvents='none';
            el.appendChild(image);
        }
        el.style.padding='0';
        el.style.background='transparent';
        el.style.border='none';
        el.style.boxShadow='none';
        el.style.overflow='visible';
        piaCombatPoint(el,x,y);
    }
    if(piaCombat.boss?.available===true||piaCombat.boss?.in_combat===true){
        const key='boss';active.add(key);
        const el=piaCombatMakeToken(key,'','pia-encounter-boss','Allosauro Dominante · Boss · X 27 Y 32',piaCombatBoss);
        // Token grafico definitivo: riutilizza l'asset già usato dal boss.
        let image=el.querySelector('img');
        if(!image){
            image=document.createElement('img');
            image.src='../../immagini/nemici/allosauro_dominante.png';
            image.alt=''; // L'etichetta accessibile è già sul pulsante.
            image.draggable=false;
            image.style.width='100%';
            image.style.height='100%';
            image.style.objectFit='contain';
            image.style.display='block';
            image.style.pointerEvents='none';
            el.appendChild(image);
        }
        el.style.padding='0';
        el.style.background='transparent';
        el.style.border='none';
        el.style.boxShadow='none';
        el.style.overflow='visible';
        piaCombatPoint(el,27,32);
    }
    const key='guard';active.add(key);
    const guard=piaCombatMakeToken(key,'','pia-encounter-guard','Guardie del Varco · X 0 Y 67',piaCombatGuard);
    // Token grafico della scena Guardie del Varco.
    let guardImage=guard.querySelector('img');
    if(!guardImage){
        guardImage=document.createElement('img');
        guardImage.src='immagini/Ia2Ib.png';
        guardImage.alt='';
        guardImage.draggable=false;
        guardImage.style.width='100%';
        guardImage.style.height='100%';
        guardImage.style.objectFit='contain';
        guardImage.style.display='block';
        guardImage.style.pointerEvents='none';
        guard.appendChild(guardImage);
    }
    guard.style.padding='0';
    guard.style.background='transparent';
    guard.style.border='none';
    guard.style.boxShadow='none';
    guard.style.overflow='visible';
    piaCombatPoint(guard,0,67);
    for(const [id,el] of piaCombat.tokens){if(!active.has(id)){el.remove();piaCombat.tokens.delete(id)}}
    const counter=document.getElementById('pia-encounter-count');
    if(counter)counter.textContent=`Incontri: ${piaCombat.slots.size}/20`;
}
async function piaCombatRefresh() {
    if(piaCombat.updating || !piaCombat.ready || document.hidden || !db || !character)return;
    piaCombat.updating=true;
    try {
        const [rooms,boss]=await Promise.allSettled([
            db.rpc('p1_get_rotating_combats'),
            db.rpc('p1_get_allosauro_state')
        ]);
        if(rooms.status==='fulfilled' && !rooms.value.error && Array.isArray(rooms.value.data)){
            piaCombat.slots=new Map(rooms.value.data.map(s=>[String(s.encounter_id),s]));
        }else console.warn('Incontri Piano Ia non disponibili',rooms);
        if(boss.status==='fulfilled' && !boss.value.error){piaCombat.boss=boss.value.data;piaCombat.stateKnown=true;}
        else console.warn('Stato boss Piano Ia non disponibile',boss);
        piaCombatRender();
    }finally {piaCombat.updating=false}
}
function piaCombatAdjacent(x,y,diagonal=false){
    const dx=Math.abs(playerX-x),dy=Math.abs(playerY-y);
    return diagonal?Math.max(dx,dy)<=1:dx+dy<=1;
}
async function piaCombatEnter(rpc,args,title) {
    if(piaCombat.entering)return;
    piaCombat.entering=true;
    try {
        const result=await db.rpc(rpc,args);
        if(result.error)throw result.error;
        if(!result.data)throw new Error('Nessuna sessione disponibile');
        const id=typeof result.data==='string'?result.data:result.data.combat_id;
        if(!id)throw new Error('Identificativo combattimento assente');
        window.location.assign(`../../combat.html?combat_id=${encodeURIComponent(id)}`);
    }catch(error){
        console.error(title,error);piaCombatNotice(title+': '+(error?.message||error),true);
        await piaCombatRefresh();
    }finally{piaCombat.entering=false}
}
async function piaCombatRoom(id) {
    const slot=piaCombat.slots.get(String(id));
    if(!slot||!['active','engaged'].includes(slot.status))return;
    if(!piaCombatAdjacent(Number(slot.x),Number(slot.y))){piaCombatNotice('Avvicinati al combattimento.');return}
    const family=PIA_COMBAT_FAMILIES[slot.family];
    if(!await piaCombatDialog('INCONTRO NELLA GIUNGLA',`La giungla è pericolosa. ${family?.[1]||'Creature ostili'} ti sbarrano il cammino. Vuoi combattere?`))return;
    await piaCombatEnter('p1_enter_room_combat',{p_encounter_id:id},'Ingresso nel combattimento');
}
async function piaCombatBoss() {
    if(!piaCombatAdjacent(27,32,true)){piaCombatNotice('Avvicinati all’Allosauro.');return}
    if(!piaCombat.boss?.available && !piaCombat.boss?.in_combat){piaCombatNotice('L’Allosauro non è disponibile.');return}
    if(!await piaCombatDialog('!! BOSS FIGHT !!','Un gigantesco Allosauro Dominante blocca la strada verso la radura dell’accampamento. Vuoi affrontarlo?'))return;
    await piaCombatEnter('p1_enter_allosauro_combat',{},'Allosauro Dominante');
}
async function piaCombatGuard() {
    if(!piaCombatAdjacent(0,67)){piaCombatNotice('Avvicinati alle guardie.');return}
    if(!await piaCombatDialog('GUARDIE DEL VARCO','Quattro lucertoloidi e un allosauro corazzato sorvegliano il passaggio verso il settore successivo.','AVVICINATI'))return;
    if(piaCombat.entering)return;
    piaCombat.entering=true;
    try {
        const {data,error}=await db.rpc('ia2ib_open');
        if(error)throw error;
        if(!data?.id)throw new Error('Varco non disponibile');
        window.location.assign('Ia2Ib.html?id='+encodeURIComponent(data.id));
    }catch(error){piaCombatNotice('Guardie: '+(error?.message||error),true)}
    finally{piaCombat.entering=false}
}
async function piaCombatTryInteract(x,y) {
    // Previene di occupare una casella già impegnata da un combattimento.
    if(!piaCombat.ready ||piaCombat.entering)return false;
    if(x===0&&y===67){await piaCombatGuard();return true}
    if(x===27&&y===32&&(piaCombat.boss?.available||piaCombat.boss?.in_combat)){
        await piaCombatBoss();return true;
    }
    for(const slot of piaCombat.slots.values()){
        if(['active','engaged'].includes(slot.status)&&Number(slot.x)===x&&Number(slot.y)===y){
            await piaCombatRoom(String(slot.encounter_id));return true;
        }
    }
    return false;
}
function piaCombatMoved(){/* La prossimità viene verificata dal server e all'interazione. */}
function piaCombatStart() {
    if(piaCombat.ready)return;
    piaCombat.ready=true;
    piaCombatRefresh();
    piaCombat.timer=setInterval(piaCombatRefresh,15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)piaCombatRefresh()});
    window.addEventListener('resize',piaCombatRender,{passive:true});
}


// ============================================================
// PIANO IA — FRUTTO CARNOSO + PASSAGGIO E ACCAMPAMENTO
// Interazioni collegate alle RPC originali. Indipendente dai combat.
// ============================================================
const piaSpecial={chests:[],tokens:new Map(),busy:false,ready:false,camp:null,campBusy:false,campOpen:false,lastInside:false};
function piaSpecialNotify(message,error=false){ if(typeof setMessage==='function')setMessage(message,error); }
const piaSpecialEl=id=>document.getElementById(id);
const piaSpecialInsideCamp=()=>playerX>=28&&playerX<=30&&playerY>=34&&playerY<=36;
const piaSpecialNear=(x,y)=>Math.abs(playerX-x)+Math.abs(playerY-y)<=1;
function piaSpecialDialog(title,message,confirm=true){
  return new Promise(resolve=>{
    const wrapper=document.createElement('div');wrapper.className='pia-special-dialog';
    const section=document.createElement('section');section.className='pia-special-box';section.setAttribute('role','dialog');section.setAttribute('aria-modal','true');
    const h=document.createElement('h2');h.textContent=title;
    const p=document.createElement('p');p.textContent=message;
    const actions=document.createElement('div');actions.className='pia-special-actions';
    const cancel=document.createElement('button');cancel.textContent=confirm?'VAI VIA':'CHIUDI';
    const accept=document.createElement('button');accept.textContent='CONFERMA';
    actions.append(cancel);if(confirm)actions.append(accept);
    section.append(h,p,actions);wrapper.append(section);document.body.appendChild(wrapper);
    const done=v=>{document.removeEventListener('keydown',keys,true);wrapper.remove();resolve(v)};
    const keys=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();e.preventDefault();done(false)}else if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.stopImmediatePropagation();e.preventDefault()}};
    document.addEventListener('keydown',keys,true);
    cancel.onclick=()=>done(false);accept.onclick=()=>done(true);
    wrapper.addEventListener('click',e=>{if(e.target===wrapper)done(false)});
    cancel.focus();
  });
}
function piaSpecialMapPosition(el,x,y,w=1,h=1){
  el.style.left=(100*x/MAP_COLUMNS)+'%';el.style.top=(100*y/MAP_ROWS)+'%';
  el.style.width=(100*w/MAP_COLUMNS)+'%';el.style.height=(100*h/MAP_ROWS)+'%';
}
function piaSpecialRenderFruit(){
  const map=piaSpecialEl('dungeon-map');if(!map)return;
  const active=new Set();
  for(const c of piaSpecial.chests){
    if(!c.available)continue;
    const id=String(c.id),x=Number(c.x),y=Number(c.y);
    if(!Number.isInteger(x)||!Number.isInteger(y))continue;
    active.add(id);
    let el=piaSpecial.tokens.get(id);
    if(!el){
      el=document.createElement('button');el.type='button';el.className='pia-fruit-token';
      el.title='Frutto Carnoso';el.setAttribute('aria-label','Raccogli Frutto Carnoso');
      const image=document.createElement('img');
      image.src='immagini/frutto.png';image.alt='';image.draggable=false;
      image.style.width='100%';image.style.height='100%';image.style.objectFit='contain';
      image.style.display='block';image.style.pointerEvents='none';
      el.appendChild(image);
      el.style.padding='0';el.style.background='transparent';el.style.border='none';
      el.style.boxShadow='none';el.style.overflow='visible';
      el.addEventListener('click',()=>piaSpecialCollect(id));map.appendChild(el);piaSpecial.tokens.set(id,el);
    }
    piaSpecialMapPosition(el,x,y);
  }
  for(const [id,el] of piaSpecial.tokens)if(!active.has(id)){el.remove();piaSpecial.tokens.delete(id)}
}
async function piaSpecialRefreshFruit(){
  if(!piaSpecial.ready||document.hidden)return;
  const {data,error}=await db.rpc('piano_ia_chests_refresh');
  if(error){console.warn('Frutti Piano Ia:',error.message);return}
  piaSpecial.chests=Array.isArray(data)?data:[];piaSpecialRenderFruit();
}
async function piaSpecialCollect(id){
  const c=piaSpecial.chests.find(r=>String(r.id)===String(id)&&r.available);
  if(!c||piaSpecial.busy||!piaSpecialNear(Number(c.x),Number(c.y))){piaSpecialNotify('Avvicinati al Frutto Carnoso.');return}
  if(!await piaSpecialDialog('FRUTTO CARNOSO','Hai trovato un frutto particolarmente carnoso. Vuoi raccoglierlo?'))return;
  piaSpecial.busy=true;
  try{
    const {data,error}=await db.rpc('piano_ia_chest_collect',{p_id:c.id,p_x:Number(c.x),p_y:Number(c.y)});
    if(error)throw error;
    piaSpecialNotify(data?.message||data?.reason||(data?.ok?'Frutto raccolto.':'Impossibile raccogliere il frutto.'),!data?.ok);
    if(data?.ok){window.dispatchEvent(new Event('piano-ia-inventory-changed'));await loadCharacterEquipment();updateDungeonConsumables()}
    await piaSpecialRefreshFruit();
  }catch(e){piaSpecialNotify('Frutto Carnoso: '+e.message,true)}finally{piaSpecial.busy=false}
}
function piaSpecialCampPicture(){
  const map=piaSpecialEl('dungeon-map');if(!map)return;
  let img=piaSpecialEl('p1-camp-image');
  if(!img){img=document.createElement('img');img.id='p1-camp-image';img.className='pia-camp-image';img.alt='Accampamento';img.draggable=false;img.onerror=()=>{img.style.opacity='0'};img.onload=()=>{img.style.opacity='1'};map.appendChild(img)}
  piaSpecialMapPosition(img,28,34,3,3);
  const source='immagini/'+(piaSpecial.camp?.built?'campB.png':'campA.png');
  if(img.getAttribute('src')!==source)img.src=source;
}
function piaSpecialCampFeedback(msg,error=false){let el=piaSpecialEl('p1-camp-feedback');if(!el)return;el.hidden=false;el.textContent=msg;el.classList.toggle('is-error',error)}
function piaSpecialRenderCamp(){
  const d=piaSpecial.camp;if(!d)return;
  const state=piaSpecialEl('p1-camp-state-label');state.textContent=d.active?'ATTIVO · FUOCO ACCESO':'NON COSTRUITO';state.className='base-service-status '+(d.active?'base-service-status-active':'base-service-status-unbuilt');
  piaSpecialEl('p1-camp-fuel').textContent=d.built?`Riserva: ${d.fuel} Legname · circa ${Number(d.fuel)*3} minuti`:'Contribuisci ai materiali per accendere il campo.';
  piaSpecialEl('p1-camp-recipe').hidden=!d.active;piaSpecialEl('p1-camp-refuel').hidden=!d.active;
  piaSpecialEl('p1-camp-requirements-title').hidden=!!d.built;
  const rows=piaSpecialEl('p1-camp-rows');rows.replaceChildren();
  if(!d.built)for(const r of d.requirements||[]){
    const needed=Math.max(1,Number(r.needed)||1),given=Math.max(0,Number(r.contributed)||0),remaining=Math.max(0,needed-given);
    const card=document.createElement('div');card.className='base-service-requirement'+(remaining?'':' is-complete');
    const head=document.createElement('div');head.className='base-service-requirement-head';
    const name=document.createElement('strong');name.textContent=r.name||r.item_id;
    const progress=document.createElement('span');progress.textContent=`${given}/${needed}`;head.append(name,progress);
    const bar=document.createElement('div');bar.className='base-service-progress';const fill=document.createElement('span');fill.style.width=Math.min(100,given/needed*100)+'%';bar.append(fill);
    const b=document.createElement('button');b.type='button';b.className='base-service-contribute';b.textContent=remaining?'CONTRIBUISCI':'COMPLETATO';b.disabled=!remaining||piaSpecial.campBusy;b.onclick=()=>piaSpecialQuantity(r.item_id,remaining,'construction');
    card.append(head,bar,b);rows.append(card);
  }
  const insufficient=d.active&&Number(d.fuel)<5,warning=piaSpecialEl('p1-camp-cook-warning');warning.hidden=!insufficient;
  warning.textContent=insufficient?'Servono almeno 5 riserve di Legname.':'';
  piaSpecialEl('p1-camp-cook').disabled=piaSpecial.campBusy||!d.active||insufficient;
  piaSpecialEl('p1-camp-fuel-button').disabled=piaSpecial.campBusy||!d.active;
}
async function piaSpecialCampRefresh(){
  if(!piaSpecial.ready||!db)return;
  const {data,error}=await db.rpc('p1_camp_state');
  if(error){console.warn('Accampamento Ia:',error.message);return}
  piaSpecial.camp=data;piaSpecialCampPicture();if(piaSpecial.campOpen)piaSpecialRenderCamp();
}
function piaSpecialCampOpen(){
  if(!piaSpecialInsideCamp())return;
  piaSpecial.campOpen=true;piaSpecialEl('p1-camp-overlay').hidden=false;
  piaSpecialEl('p1-camp-feedback').hidden=true;
  piaSpecialRenderCamp();piaSpecialCampRefresh();piaSpecialEl('p1-camp-close').focus();
}
function piaSpecialCampClose(){piaSpecial.campOpen=false;piaSpecialEl('p1-camp-overlay').hidden=true}
function piaSpecialQuantity(item,limit,purpose){
  const panel=piaSpecialEl('p1-camp-quantity-panel'),input=piaSpecialEl('p1-camp-quantity');
  input.min='1';input.max=String(limit);input.value=String(Math.min(1,limit));
  piaSpecialEl('p1-camp-quantity-label').textContent=purpose==='fuel'?'Quanto Legname vuoi aggiungere?':'Quante unità vuoi consegnare?';
  panel.hidden=false;
  piaSpecialEl('p1-camp-quantity-confirm').onclick=async()=>{
    const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>limit){piaSpecialCampFeedback('Quantità non valida.',true);return}
    piaSpecial.campBusy=true;
    try{const {error}=await db.rpc('p1_camp_contribute',{p_item_id:item,p_quantity:n,p_purpose:purpose});if(error)throw error;panel.hidden=true;piaSpecialCampFeedback('Materiali consegnati.');await piaSpecialCampRefresh()}
    catch(e){piaSpecialCampFeedback(e.message,true)}finally{piaSpecial.campBusy=false;piaSpecialRenderCamp()}
  };input.focus();
}
function piaSpecialMoved(){
  if(!piaSpecial.ready)return;
  const inside=piaSpecialInsideCamp();piaSpecialEl('p1-camp-open').hidden=!inside;
  if(inside&&!piaSpecial.lastInside)piaSpecialCampOpen();
  piaSpecial.lastInside=inside;
  if(inside)piaSpecialCampRefresh();
}
async function piaSpecialTryInteract(nx,ny){
  if(!piaSpecial.ready)return false;
  if(piaSpecial.campOpen)return true;
  const fruit=piaSpecial.chests.find(c=>c.available&&Number(c.x)===nx&&Number(c.y)===ny);
  if(fruit){await piaSpecialCollect(String(fruit.id));return true}
  // Passaggio speciale originale: X25,Y35 -> X26,Y35 è bloccato.
  if(playerX===25&&playerY===35&&nx===26&&ny===35){await piaSpecialDialog('PASSAGGIO BLOCCATO','Da questo lato non puoi raggiungere la radura dell’accampamento.',false);return true}
  // Da est a ovest X27,Y35 -> X26,Y35 si arriva a X25,Y35 (senza ritorno).
  if(playerX===27&&playerY===35&&nx===26&&ny===35){
    if(!await piaSpecialDialog('SENTIERO SENZA RITORNO','Attraversando questo passaggio arriverai a X25 Y35 e non potrai tornare indietro lungo questa strada. Vuoi procedere?'))return true;
    try{const {data,error}=await db.rpc('piano_ia_move',{p_x:25,p_y:35});if(error)throw error;
      playerX=Number(data.x);playerY=Number(data.y);showToken(playerX,playerY);piaRevealAroundPlayer();updateDungeonCamera();piaSpecialMoved();
      if(typeof broadcastDungeonPosition==='function')broadcastDungeonPosition();piaSpecialNotify('Hai attraversato il passaggio senza ritorno.');
    }catch(e){piaSpecialNotify('Passaggio: '+e.message,true)}return true;
  }
  return false;
}
function piaSpecialStart(){
  if(piaSpecial.ready)return;piaSpecial.ready=true;
  piaSpecialEl('p1-camp-close')?.addEventListener('click',piaSpecialCampClose);
  piaSpecialEl('p1-camp-open')?.addEventListener('click',piaSpecialCampOpen);
  piaSpecialEl('p1-camp-overlay')?.addEventListener('click',e=>{if(e.target===piaSpecialEl('p1-camp-overlay'))piaSpecialCampClose()});
  piaSpecialEl('p1-camp-fuel-button')?.addEventListener('click',()=>piaSpecialQuantity('legname',1000,'fuel'));
  piaSpecialEl('p1-camp-cook')?.addEventListener('click',async()=>{if(piaSpecial.campBusy)return;piaSpecial.campBusy=true;try{const {error}=await db.rpc('p1_camp_cook');if(error)throw error;piaSpecialCampFeedback('Lautopasto cucinato!');await piaSpecialCampRefresh()}catch(e){piaSpecialCampFeedback(e.message,true)}finally{piaSpecial.campBusy=false;piaSpecialRenderCamp()}});
  document.addEventListener('keydown',e=>{if(piaSpecial.campOpen){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();piaSpecialCampClose()}else if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation()}}},true);
  piaSpecialCampPicture();piaSpecialCampRefresh();piaSpecialRefreshFruit();
  piaSpecial.lastInside=piaSpecialInsideCamp();piaSpecialEl('p1-camp-open').hidden=!piaSpecial.lastInside;
  if(piaSpecial.lastInside)piaSpecialCampOpen();
  setInterval(()=>{piaSpecialRefreshFruit();piaSpecialCampRefresh()},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){piaSpecialRefreshFruit();piaSpecialCampRefresh()}});
}

const SPATIAL_COIN_BASE_URL = "../../base/base.html";


// ============================================================
// MONETA SPAZIALE - CONSUMABILE COMUNE ALLE TRE MAPPE
// ============================================================
let spatialCoinInProgress = false;

function updateSpatialCoinAction() {
    const manaButton = document.getElementById("dungeon-mana-potion-button");
    if (!manaButton || !manaButton.parentElement) return;

    let button = document.getElementById("dungeon-spatial-coin-button");
    if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.id = "dungeon-spatial-coin-button";
        button.className = "dungeon-action-card";
        button.dataset.action = "spatial-coin";
        button.title = "Consuma una Moneta Spaziale per tornare alla Base";
        const icon = document.createElement("span");
        icon.className = "action-card-icon";
        icon.textContent = "✦";
        const content = document.createElement("span");
        content.className = "action-card-content";
        const name = document.createElement("strong");
        name.textContent = "MONETA SPAZIALE";
        const amount = document.createElement("small");
        amount.id = "dungeon-spatial-coin-count";
        content.append(name, amount);
        button.append(icon, content);
        manaButton.insertAdjacentElement("afterend", button);
        button.addEventListener("click", useSpatialCoinFromMap);
    }

    const quantity = (Array.isArray(characterInventory) ? characterInventory : [])
        .filter(entry => entry?.item?.id === "moneta_spaziale")
        .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
    const count = document.getElementById("dungeon-spatial-coin-count");
    if (count) count.textContent = `x${quantity}`;
    button.disabled = spatialCoinInProgress || quantity < 1 || !character ||
        Boolean(character.active_combat_id) || character.current_location === "combat";
}


// Popup coerente con gli eventi del dungeon: niente finestre native del browser.
function confirmSpatialCoinTeleport() {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "combat-event-overlay spatial-coin-overlay";
        overlay.setAttribute("role", "presentation");

        const modal = document.createElement("div");
        modal.className = "combat-event-modal spatial-coin-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "spatial-coin-modal-title");

        modal.innerHTML = `
            <div class="combat-event-icon" aria-hidden="true">✦</div>
            <h2 id="spatial-coin-modal-title">MONETA SPAZIALE</h2>
            <p>Vuoi teletrasportarti al Livello Base?</p>
            <div class="combat-event-warning">
                Il teletrasporto consuma una Moneta Spaziale.
            </div>
            <div class="combat-event-buttons">
                <button type="button" class="combat-event-button combat-event-cancel" data-spatial-cancel>ANNULLA</button>
                <button type="button" class="combat-event-button combat-event-confirm" data-spatial-confirm>TELETRASPORTATI</button>
            </div>
        `;

        // Stesso linguaggio grafico dei popup dungeon; fallback anche per la Base.
        overlay.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.78);box-sizing:border-box;";
        modal.style.cssText = "width:min(460px,100%);max-height:90vh;overflow-y:auto;box-sizing:border-box;padding:28px 24px;text-align:center;background:linear-gradient(160deg,#30271c,#171713);color:#f5e9cf;border:2px solid #9e7d40;border-radius:12px;box-shadow:0 14px 55px rgba(0,0,0,.85);";
        modal.querySelector(".combat-event-icon").style.cssText = "font-size:42px;color:#d9b66e;margin-bottom:10px;";
        modal.querySelector("h2").style.cssText = "font-size:23px;letter-spacing:.08em;color:#e6c480;margin:5px 0 14px;";
        modal.querySelector("p").style.cssText = "font-size:16px;line-height:1.55;margin:0 0 15px;";
        modal.querySelector(".combat-event-warning").style.cssText = "background:rgba(187,140,57,.12);border:1px solid rgba(218,176,100,.4);border-radius:6px;padding:12px;font-size:14px;line-height:1.5;";
        const buttons = modal.querySelector(".combat-event-buttons");
        buttons.style.cssText = "display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:23px;";
        buttons.querySelectorAll("button").forEach(button => {
            button.style.cssText = "min-width:140px;padding:11px 15px;border-radius:6px;border:1px solid #977945;font-weight:700;letter-spacing:.04em;cursor:pointer;color:#f9edcf;background:#483a26;";
        });
        buttons.querySelector("[data-spatial-confirm]").style.background = "#72582e";

        const previousFocus = document.activeElement;
        function finish(result) {
            document.removeEventListener("keydown", onKeyDown, true);
            overlay.remove();
            if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
            resolve(result);
        }
        function onKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                finish(false);
            }
        }
        buttons.querySelector("[data-spatial-cancel]").addEventListener("click", () => finish(false));
        buttons.querySelector("[data-spatial-confirm]").addEventListener("click", () => finish(true));
        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.addEventListener("keydown", onKeyDown, true);
        buttons.querySelector("[data-spatial-cancel]").focus();
    });
}

async function useSpatialCoinFromMap() {
    if (spatialCoinInProgress || !character) return;
    if (!await confirmSpatialCoinTeleport()) return;
    spatialCoinInProgress = true;
    updateSpatialCoinAction();
    try {
        const { data, error } = await db.rpc("use_spatial_coin");
        if (error) throw error;
        if (!data?.ok) throw new Error("Teletrasporto non riuscito.");
        // Il server ha già consumato la moneta e aggiornato la posizione.
        window.location.replace(SPATIAL_COIN_BASE_URL);
    } catch (error) {
        console.error("Errore utilizzo Moneta Spaziale:", error);
        window.alert(error?.message || "Impossibile utilizzare la Moneta Spaziale.");
        spatialCoinInProgress = false;
        updateSpatialCoinAction();
    }
}
