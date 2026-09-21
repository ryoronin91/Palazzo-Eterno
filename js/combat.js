// ============================================================
// PALAZZO ETERNO
// COMBAT.JS
// ============================================================

console.log(
    "COMBAT.JS CARICATO"
);


const db =
    supabaseClient;


const COMBAT_COLUMNS =
    12;


const COMBAT_ROWS =
    12;


let currentUser =
    null;


let currentCharacter =
    null;


let currentRole =
    "player";

let masterObserverMode =
    false;

let combatId =
    null;

let combatSession =
    null;

let combatTimerInterval =
    null;

let combatStateInterval =
    null;

const combatEntities =
    new Map();


const combatTokens =
    new Map();


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            // =================================================
            // UTENTE
            // =================================================

            await loadCurrentUser();


            // =================================================
            // RUOLO ACCOUNT
            // =================================================

            await loadCurrentRole();


            // =================================================
            // MODALITÀ MASTER OSSERVATORE
            // =================================================

            masterObserverMode =
                getMasterObserverModeFromUrl();


            // =================================================
            // ID SESSIONE COMBATTIMENTO
            // =================================================

            combatId =
                getCombatIdFromUrl();


            if (!combatId) {

                throw new Error(
                    "Nessuna sessione di combattimento specificata."
                );

            }


            // =================================================
            // PERSONAGGIO
            // =================================================

            await loadCurrentCharacter();


            // =================================================
            // SESSIONE DI COMBATTIMENTO
            // =================================================

            await loadCombatSession();

            await loadCombatEntities();

            lastCombatEntitiesSnapshot =
                JSON.stringify(
                    Array.from(
                        combatEntities.values()
                    )
                        .map(
                            entity => ({

                                id:
                                    entity.id,

                                x:
                                    entity.x,

                                y:
                                    entity.y,

                                current_hp:
                                    entity.current_hp,

                                max_hp:
                                    entity.max_hp,

                                movement_remaining:
                                    entity.movement_remaining,

                                status:
                                    entity.status,

                                entity_type:
                                    entity.entity_type,

                                display_name:
                                    entity.display_name,

                                character_id:
                                    entity.character_id,

                                monster_type:
                                    entity.monster_type

                            })
                        )
                        .sort(
                            (a, b) =>
                                a.id.localeCompare(
                                    b.id
                                )
                        )
                );

            renderCombat();

            updateCombatMode();

            setupCombatNotes();

            startCombatStateLoop();


        } catch (error) {

            console.error(
                "Errore caricamento combat:",
                error
            );


            setCombatStatus(
                error.message ||
                "Errore durante il caricamento del combattimento."
            );

        }

    }
);


// ============================================================
// UTENTE
// ============================================================

async function loadCurrentUser() {

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

}


// ============================================================
// RUOLO
// ============================================================

async function loadCurrentRole() {

    const {
        data,
        error
    } =
        await db
            .from(
                "user_roles"
            )
            .select(
                "role"
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentRole =
        data?.role ||
        "player";

}


// ============================================================
// COMBAT ID DALL'URL
// ============================================================

function getCombatIdFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return params.get(
        "combat_id"
    );

}


// ============================================================
// MODALITÀ MASTER DALL'URL
// ============================================================

function getMasterObserverModeFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return (
        params.get(
            "mode"
        ) ===
        "master"
    );

}


// ============================================================
// PERSONAGGIO CORRENTE
// ============================================================

async function loadCurrentCharacter() {

    if (
        masterObserverMode
    ) {

        return;

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
                `
                id,
                nome,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                notes
                `
            )
            .eq(
                "user_id",
                currentUser.id
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    currentCharacter =
        data;

}


// ============================================================
// CARICA SESSIONE COMBATTIMENTO
// ============================================================

async function loadCombatSession() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_sessions"
            )
            .select(
                `
                id,
                encounter_id,
                status,
                round_number,
                current_turn_entity_id,
                turn_started_at,
                turn_duration_seconds
                `
            )
            .eq(
                "id",
                combatId
            )
            .single();


    if (error) {

        throw error;

    }


    combatSession =
        data;

}


// ============================================================
// CARICA ENTITÀ
// ============================================================

async function loadCombatEntities() {

    const {
        data,
        error
    } =
        await db
            .from(
                "combat_entities"
            )
            .select(
                `
                id,
                entity_type,
                character_id,
                monster_type,
                display_name,
                x,
                y,
                current_hp,
                max_hp,
                movement_remaining,
                status
                `
            )
            .eq(
                "combat_id",
                combatId
            );


    if (error) {

        throw error;

    }


    combatEntities.clear();


    (
        data ||
        []
    ).forEach(
        entity => {

            combatEntities.set(
                entity.id,
                entity
            );

        }
    );

}


// ============================================================
// RENDER COMPLETO
// ============================================================

function renderCombat() {

    renderCombatTokens();

    renderCombatEntityList();

    renderPlayerCombatSheet();

    setCombatStatus(
        `Sessione: ${combatId}`
    );

}


// ============================================================
// TOKEN
// ============================================================

function renderCombatTokens() {

    const map =
        document.getElementById(
            "combat-map"
        );


    if (!map) {

        return;

    }


    const rect =
        map.getBoundingClientRect();


    const cellWidth =
        rect.width /
        COMBAT_COLUMNS;


    const cellHeight =
        rect.height /
        COMBAT_ROWS;


    const activeEntityIds =
        new Set();


    combatEntities.forEach(
        entity => {

            activeEntityIds.add(
                entity.id
            );


            // =================================================
            // ENTITÀ MORTA
            // =================================================

            if (
                entity.status ===
                "dead"
            ) {

                const deadToken =
                    combatTokens.get(
                        entity.id
                    );


                if (deadToken) {

                    deadToken.remove();

                    combatTokens.delete(
                        entity.id
                    );

                }


                return;

            }


            // =================================================
            // CERCA TOKEN ESISTENTE
            // =================================================

            let token =
                combatTokens.get(
                    entity.id
                );


            // =================================================
            // CREA TOKEN SOLO SE NON ESISTE
            // =================================================

            if (!token) {

                token =
                    document.createElement(
                        "div"
                    );


                token.className =
                    "combat-token";


                if (
                    entity.entity_type ===
                    "player"
                ) {

                    token.classList.add(
                        "player"
                    );


                    renderPlayerTokenContent(
                        token,
                        entity
                    );

                } else {

                    token.classList.add(
                        "enemy"
                    );


                    renderEnemyTokenContent(
                        token,
                        entity
                    );

                }


                token.title =
                    entity.display_name;


                map.appendChild(
                    token
                );


                combatTokens.set(
                    entity.id,
                    token
                );

            }


            // =================================================
            // DIMENSIONI
            // =================================================

            const size =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.82;


            token.style.width =
                `${size}px`;


            token.style.height =
                `${size}px`;


            // =================================================
            // POSIZIONE
            // =================================================

            token.style.left =
                `${
                    (
                        Number(
                            entity.x
                        ) +
                        0.5
                    ) *
                    cellWidth -
                    size / 2
                }px`;


            token.style.top =
                `${
                    (
                        Number(
                            entity.y
                        ) +
                        0.5
                    ) *
                    cellHeight -
                    size / 2
                }px`;

        }
    );


    // ========================================================
    // ELIMINA TOKEN DI ENTITÀ NON PIÙ PRESENTI
    // ========================================================

    for (
        const [
            entityId,
            token
        ]
        of combatTokens
    ) {

        if (
            !activeEntityIds.has(
                entityId
            )
        ) {

            token.remove();

            combatTokens.delete(
                entityId
            );

        }

    }

}


// ============================================================
// TOKEN PLAYER
// ============================================================

async function renderPlayerTokenContent(
    token,
    entity
) {

    const image =
        document.createElement(
            "img"
        );


    image.style.width =
        "100%";


    image.style.height =
        "100%";


    image.style.objectFit =
        "contain";


    image.alt =
        entity.display_name;


    image.src =
        "immagini/token/token_1.png";


    if (
        entity.character_id
    ) {

        const {
            data
        } =
            await db
                .from(
                    "characters"
                )
                .select(
                    "token"
                )
                .eq(
                    "id",
                    entity.character_id
                )
                .maybeSingle();


        if (
            data?.token
        ) {

            image.src =
                "immagini/token/" +
                data.token;

        }

    }


    token.appendChild(
        image
    );

}


// ============================================================
// TOKEN MOSTRO
// ============================================================

function renderEnemyTokenContent(
    token,
    entity
) {

    const marker =
        document.createElement(
            "div"
        );


    marker.style.width =
        "100%";


    marker.style.height =
        "100%";


    marker.style.display =
        "flex";


    marker.style.alignItems =
        "center";


    marker.style.justifyContent =
        "center";


    marker.style.borderRadius =
        "50%";


    marker.style.background =
        "#7d2020";


    marker.style.color =
        "#ffffff";


    marker.style.fontWeight =
        "700";


    marker.textContent =
        "M";


    token.appendChild(
        marker
    );

}


// ============================================================
// LISTA ENTITÀ
// ============================================================

function renderCombatEntityList() {

    const container =
        document.getElementById(
            "combat-entity-list"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


    combatEntities.forEach(
        entity => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "combat-entity-item";


            const name =
                document.createElement(
                    "strong"
                );


            name.textContent =
                entity.display_name;


            const meta =
                document.createElement(
                    "div"
                );


            meta.className =
                "combat-entity-meta";


            meta.textContent =
                `${
                    entity.entity_type ===
                    "player"
                        ? "Giocatore"
                        : "Nemico"
                } · PF ${
                    entity.current_hp
                }/${
                    entity.max_hp
                } · Movimento ${
                    entity.movement_remaining ?? 0
                } · X ${
                    entity.x
                } Y ${
                    entity.y
                }`;


            item.appendChild(
                name
            );


            item.appendChild(
                meta
            );


            container.appendChild(
                item
            );

        }
    );

}


// ============================================================
// LIMITI ATTRIBUTI
// ============================================================

function clampAttribute(value) {

    return Math.max(
        1,
        Math.min(
            30,
            Number(value) || 1
        )
    );

}


// ============================================================
// SCHEDA PERSONAGGIO COMBATTIMENTO
// ============================================================

function renderPlayerCombatSheet() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return;

    }


    // ========================================================
    // ENTITÀ DEL PERSONAGGIO NEL COMBATTIMENTO
    // ========================================================

    const playerEntity =
        Array.from(
            combatEntities.values()
        ).find(
            entity =>
                entity.entity_type === "player" &&
                entity.character_id === currentCharacter.id
        );


    if (!playerEntity) {

        return;

    }


    // ========================================================
    // CARATTERISTICHE
    // ========================================================

    const forza =
        clampAttribute(
            currentCharacter.forza
        );


    const resistenza =
        clampAttribute(
            currentCharacter.resistenza
        );


    const costituzione =
        clampAttribute(
            currentCharacter.costituzione
        );


    const intelligenza =
        clampAttribute(
            currentCharacter.intelligenza
        );


    const destrezza =
        clampAttribute(
            currentCharacter.destrezza
        );


    const fortuna =
        clampAttribute(
            currentCharacter.fortuna
        );


    // ========================================================
    // STATISTICHE DERIVATE
    // ========================================================

    const attack =
        Math.ceil(
            forza / 2
        );


    const defense =
        Math.ceil(
            7 +
            resistenza / 2
        );


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


    const maxMovement =
        Math.ceil(
            4 +
            destrezza / 2
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


    // ========================================================
    // VALORI ATTUALI DAL COMBATTIMENTO
    // ========================================================

    const currentPF =
        Number(
            playerEntity.current_hp
        ) || 0;


    const entityMaxPF =
        Number(
            playerEntity.max_hp
        ) || maxPF;


    const currentMovement =
        Number(
            playerEntity.movement_remaining
        ) || 0;


    // ========================================================
    // ELEMENTI HTML
    // ========================================================

    const nameElement =
        document.getElementById(
            "combat-character-name"
        );


    const pfElement =
        document.getElementById(
            "combat-pf-value"
        );


    const pfBar =
        document.getElementById(
            "combat-pf-bar"
        );


    const pmElement =
        document.getElementById(
            "combat-pm-value"
        );


    const pmBar =
        document.getElementById(
            "combat-pm-bar"
        );


    const attackElement =
        document.getElementById(
            "combat-attack-value"
        );


    const defenseElement =
        document.getElementById(
            "combat-defense-value"
        );


    const movementElement =
        document.getElementById(
            "combat-movement-value"
        );


    const criticalElement =
        document.getElementById(
            "combat-critical-value"
        );


    // ========================================================
    // NOME
    // ========================================================

    if (nameElement) {

        nameElement.textContent =
            currentCharacter.nome;

    }


    // ========================================================
    // PF
    // ========================================================

    if (pfElement) {

        pfElement.textContent =
            `${currentPF} / ${entityMaxPF}`;

    }


    if (pfBar) {

        const pfPercentage =
            entityMaxPF > 0
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        (
                            currentPF /
                            entityMaxPF
                        ) * 100
                    )
                )
                : 0;


        pfBar.style.width =
            `${pfPercentage}%`;

    }


    // ========================================================
    // PM
    // ========================================================

    if (pmElement) {

        pmElement.textContent =
            `${maxPM} / ${maxPM}`;

    }


    if (pmBar) {

        pmBar.style.width =
            "100%";

    }


    // ========================================================
    // STATISTICHE
    // ========================================================

    if (attackElement) {

        attackElement.textContent =
            attack;

    }


    if (defenseElement) {

        defenseElement.textContent =
            defense;

    }


    if (movementElement) {

        movementElement.textContent =
            `${currentMovement} / ${maxMovement}`;

    }


    if (criticalElement) {

        criticalElement.textContent =
            `${critical}%`;

    }

}


// ============================================================
// NOTE PERSONALI PERSONAGGIO
// ============================================================

function setupCombatNotes() {

    if (
        masterObserverMode ||
        !currentCharacter
    ) {

        return;

    }


    const notesElement =
        document.getElementById(
            "combat-notes"
        );


    const saveButton =
        document.getElementById(
            "combat-notes-save"
        );


    if (
        !notesElement ||
        !saveButton
    ) {

        return;

    }


    // ========================================================
    // CARICA NOTE DELLA SCHEDA
    // ========================================================

    notesElement.value =
        currentCharacter.notes || "";


    saveButton.disabled =
        false;


    // ========================================================
    // SALVA NOTE
    // ========================================================

    saveButton.addEventListener(
        "click",
        async () => {

            const newNotes =
                notesElement.value;


            saveButton.disabled =
                true;


            saveButton.textContent =
                "SALVATAGGIO...";


            try {

                const {
                    error
                } =
                    await db
                        .from(
                            "characters"
                        )
                        .update(
                            {
                                notes:
                                    newNotes
                            }
                        )
                        .eq(
                            "id",
                            currentCharacter.id
                        );


                if (error) {

                    throw error;

                }


                currentCharacter.notes =
                    newNotes;


                saveButton.textContent =
                    "SALVATO ✓";


                setTimeout(
                    () => {

                        saveButton.textContent =
                            "SALVA NOTE";

                        saveButton.disabled =
                            false;

                    },
                    1200
                );


            } catch (error) {

                console.error(
                    "Errore salvataggio note:",
                    error
                );


                saveButton.textContent =
                    "ERRORE";


                setTimeout(
                    () => {

                        saveButton.textContent =
                            "SALVA NOTE";

                        saveButton.disabled =
                            false;

                    },
                    1500
                );

            }

        }
    );

}


// ============================================================
// MODALITÀ MASTER
// ============================================================

function updateCombatMode() {

    const badge =
        document.getElementById(
            "combat-master-badge"
        );


    if (!badge) {

        return;

    }


    badge.classList.toggle(
        "visible",
        masterObserverMode
    );

}


// ============================================================
// STATO
// ============================================================

function setCombatStatus(
    text
) {

    const element =
        document.getElementById(
            "combat-status"
        );


    if (element) {

        element.textContent =
            text;

    }

}


// ============================================================
// LOOP STATO COMBATTIMENTO
// ============================================================

function startCombatStateLoop() {

    stopCombatStateLoop();


    updateCombatTurnUI();


    combatTimerInterval =
        setInterval(
            () => {

                updateCombatTurnUI();

            },
            250
        );


    combatStateInterval =
        setInterval(
            async () => {

                await refreshCombatState();

            },
            1000
        );

}


// ============================================================
// FERMA LOOP
// ============================================================

function stopCombatStateLoop() {

    if (
        combatTimerInterval
    ) {

        clearInterval(
            combatTimerInterval
        );

        combatTimerInterval =
            null;

    }


    if (
        combatStateInterval
    ) {

        clearInterval(
            combatStateInterval
        );

        combatStateInterval =
            null;

    }

}


// ============================================================
// AGGIORNA STATO DAL DATABASE
// ============================================================

let combatRefreshInProgress =
    false;


let lastCombatEntitiesSnapshot =
    "";


async function refreshCombatState() {

    if (
        combatRefreshInProgress
    ) {

        return;

    }


    combatRefreshInProgress =
        true;


    try {

        await db.rpc(
            "advance_combat_if_timeout",
            {
                p_combat_id:
                    combatId
            }
        );


        await loadCombatSession();

        await loadCombatEntities();


        // ====================================================
        // CREA SNAPSHOT DELLO STATO ENTITÀ
        // ====================================================

        const snapshot =
            JSON.stringify(
                Array.from(
                    combatEntities.values()
                )
                    .map(
                        entity => ({

                            id:
                                entity.id,

                            x:
                                entity.x,

                            y:
                                entity.y,

                            current_hp:
                                entity.current_hp,

                            max_hp:
                                entity.max_hp,

                            movement_remaining:
                                entity.movement_remaining,

                            status:
                                entity.status,

                            entity_type:
                                entity.entity_type,

                            display_name:
                                entity.display_name,

                            character_id:
                                entity.character_id,

                            monster_type:
                                entity.monster_type

                        })
                    )
                    .sort(
                        (a, b) =>
                            a.id.localeCompare(
                                b.id
                            )
                    )
            );


        // ====================================================
        // RIDISEGNA SOLO SE QUALCOSA È CAMBIATO
        // ====================================================

        if (
            snapshot !==
            lastCombatEntitiesSnapshot
        ) {

            lastCombatEntitiesSnapshot =
                snapshot;


            renderCombatTokens();

            renderCombatEntityList();

            renderPlayerCombatSheet();

        }


        updateCombatTurnUI();


    } catch (error) {

        console.error(
            "Errore aggiornamento stato combat:",
            error
        );


    } finally {

        combatRefreshInProgress =
            false;

    }

}


// ============================================================
// ENTITÀ DI TURNO
// ============================================================

function getCurrentTurnEntity() {

    if (
        !combatSession ||
        !combatSession.current_turn_entity_id
    ) {

        return null;

    }


    return combatEntities.get(
        combatSession.current_turn_entity_id
    ) || null;

}


// ============================================================
// UI TURNO
// ============================================================

function updateCombatTurnUI() {

    if (
        !combatSession
    ) {

        return;

    }


    if (
        combatSession.status !==
        "active"
    ) {

        setCombatStatus(
            `Stato: ${combatSession.status}`
        );

        return;

    }


    const currentEntity =
        getCurrentTurnEntity();


    if (
        !currentEntity
    ) {

        setCombatStatus(
            "Turno non disponibile."
        );

        return;

    }


    const round =
        Number(
            combatSession.round_number
        ) || 1;


    // ========================================================
    // TURNO MOSTRO
    // ========================================================

    if (
        currentEntity.entity_type ===
        "enemy"
    ) {

        setCombatStatus(
            `Round ${round} · Turno di ${currentEntity.display_name}`
        );

        return;

    }


    // ========================================================
    // TIMER PLAYER
    // ========================================================

    const duration =
        Number(
            combatSession.turn_duration_seconds
        ) || 30;


    const startedAt =
        combatSession.turn_started_at
            ? new Date(
                combatSession.turn_started_at
            ).getTime()
            : Date.now();


    const elapsedSeconds =
        (
            Date.now() -
            startedAt
        ) /
        1000;


    const remaining =
        Math.max(
            0,
            Math.ceil(
                duration -
                elapsedSeconds
            )
        );


    const isMyTurn =
        currentCharacter &&
        currentEntity.character_id ===
            currentCharacter.id;


    if (
        isMyTurn
    ) {

        setCombatStatus(
            `Round ${round} · IL TUO TURNO · ${remaining}s`
        );

        return;

    }


    setCombatStatus(
        `Round ${round} · Turno di ${currentEntity.display_name} · ${remaining}s`
    );

}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderCombatTokens();

    }
);


// ============================================================
// MOVIMENTO PLAYER
// ============================================================

let combatMoveInProgress =
    false;


window.moveCombatPlayer =
    async function (
        dx,
        dy
    ) {

        if (
            combatMoveInProgress ||
            masterObserverMode ||
            !currentCharacter ||
            !combatSession ||
            combatSession.status !== "active"
        ) {

            return;

        }


        const currentEntity =
            getCurrentTurnEntity();


        if (
            !currentEntity ||
            currentEntity.entity_type !== "player" ||
            currentEntity.character_id !== currentCharacter.id
        ) {

            return;

        }


        combatMoveInProgress =
            true;


        try {

            const {
                data,
                error
            } =
                await db.rpc(
                    "move_combat_player",
                    {
                        p_combat_id:
                            combatId,

                        p_character_id:
                            currentCharacter.id,

                        p_dx:
                            dx,

                        p_dy:
                            dy
                    }
                );


            if (error) {

                throw error;

            }


            if (!data) {

                console.log(
                    "Movimento non consentito."
                );

                return;

            }


            await loadCombatEntities();

            renderCombatTokens();

            renderCombatEntityList();

            renderPlayerCombatSheet();


            lastCombatEntitiesSnapshot =
                JSON.stringify(
                    Array.from(
                        combatEntities.values()
                    )
                        .map(
                            entity => ({

                                id:
                                    entity.id,

                                x:
                                    entity.x,

                                y:
                                    entity.y,

                                current_hp:
                                    entity.current_hp,

                                max_hp:
                                    entity.max_hp,

                                movement_remaining:
                                    entity.movement_remaining,

                                status:
                                    entity.status,

                                entity_type:
                                    entity.entity_type,

                                display_name:
                                    entity.display_name,

                                character_id:
                                    entity.character_id,

                                monster_type:
                                    entity.monster_type

                            })
                        )
                        .sort(
                            (a, b) =>
                                a.id.localeCompare(
                                    b.id
                                )
                        )
                );


        } catch (error) {

            console.error(
                "Errore movimento combattimento:",
                error
            );


        } finally {

            combatMoveInProgress =
                false;

        }

    };


// ============================================================
// TASTIERA MOVIMENTO
// ============================================================

document.addEventListener(
    "keydown",
    async event => {

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


        if (
            event.repeat
        ) {

            return;

        }


        let dx =
            0;

        let dy =
            0;


        switch (
            event.key.toLowerCase()
        ) {

            case "w":
            case "arrowup":

                dy =
                    -1;

                break;


            case "s":
            case "arrowdown":

                dy =
                    1;

                break;


            case "a":
            case "arrowleft":

                dx =
                    -1;

                break;


            case "d":
            case "arrowright":

                dx =
                    1;

                break;


            default:

                return;

        }


        event.preventDefault();


        await window.moveCombatPlayer(
            dx,
            dy
        );

    }
);


window.addEventListener(
    "beforeunload",
    () => {

        stopCombatStateLoop();

    }
);
