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

            await loadCurrentUser();

            await loadCurrentRole();

masterObserverMode =
    getMasterObserverModeFromUrl();

combatId =
    getCombatIdFromUrl();


            if (!combatId) {

                throw new Error(
                    "Nessuna sessione di combattimento specificata."
                );

            }


            await loadCurrentCharacter();

            await loadCombatEntities();

            renderCombat();

            updateCombatMode();

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
                "id, nome, token"
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


    for (
        const token
        of combatTokens.values()
    ) {

        token.remove();

    }


    combatTokens.clear();


    const rect =
        map.getBoundingClientRect();


    const cellWidth =
        rect.width /
        COMBAT_COLUMNS;


    const cellHeight =
        rect.height /
        COMBAT_ROWS;


    combatEntities.forEach(
        entity => {

            if (
                entity.status ===
                "dead"
            ) {

                return;

            }


            const token =
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

            }


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


            if (
                entity.entity_type ===
                "player"
            ) {

                renderPlayerTokenContent(
                    token,
                    entity
                );

            } else {

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
    );

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
                } · HP ${
                    entity.current_hp
                }/${
                    entity.max_hp
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
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderCombatTokens();

    }
);
