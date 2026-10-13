// ============================================================
// PALAZZO ETERNO
// MASTER.JS
// ============================================================
//
// Modalità Master:
//
// - controlla autenticazione
// - controlla ruolo master
// - nessuna pedina del Master
// - visualizza tutta la mappa
// - visualizza tutti i giocatori online
// - riceve movimenti in tempo reale
// - permette di cliccare sulle pedine
// - mostra la scheda del personaggio
// - chat realtime del piano
//
// ============================================================


console.log(
    "MASTER.JS CARICATO"
);


// ============================================================
// SUPABASE
// ============================================================

const db =
    supabaseClient;


// ============================================================
// MAPPA
// ============================================================

const MAP_COLUMNS =
    23;

const MAP_ROWS =
    23;


// Stesso canale di dungeon.js

const DUNGEON_CHANNEL_NAME =
    "palazzo-eterno-dungeon-1";

// ============================================================
// EVENTI DEL DUNGEON
// ============================================================

const MASTER_DUNGEON_EVENTS = {

    "11,17": {

        id:
            "stairs_down",

        type:
            "communication",

        message:
            "Queste scale scendono ad un piano inferiore."

    },


    "15,22": {

        id:
            "dead_end",

        type:
            "communication",

        message:
            "Possibile che quelle scale ti abbiano portato ad un vicolo cieco? Sì"

    },


    "11,11": {

        id:
            "blade_corridor",

        type:
            "trap",

        message:
            "Una lama affilata attraversa il corridoio da muro a muro."

    },


    "9,15": {

        id:
            "acid_vapor",

        type:
            "trap",

        message:
            "Dal pavimento una nube di vapore acido ti investe."

    }

};


// trap_id -> stato Supabase

const masterTrapStates =
    new Map();


let trapStateRefreshTimer =
    null;


let trapCountdownTimer =
    null;


// ============================================================
// VARIABILI
// ============================================================

let currentUser =
    null;

let dungeonChannel =
    null;

let realtimeReady =
    false;


// ============================================================
// CHAT PERSISTENTE
// ============================================================

const MASTER_CHAT_FLOOR_ID =
    "floor_1";

const MASTER_CHAT_HISTORY_LIMIT =
    100;

const renderedMasterChatMessageIds =
    new Set();


// character_id -> dati giocatore

const onlinePlayers =
    new Map();


// character_id -> token

const playerTokens =
    new Map();


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await checkMasterAccess();

            setupModal();

            setupLogout();

            setupMasterFloorSelector();

            setupMasterChat();

            await loadMasterChatHistory();

            setupMap();

            // Prima leggiamo le sessioni attive: servono anche
            // per capire a quale piano appartiene un PG in combat.
            await loadActiveMasterCombats();

            await Promise.all([
                loadMasterTrapStates(),
                loadAllMasterCharacters(),
                loadMasterBossPassword(),
                loadMasterCooldownStates()
            ]);

            renderMasterEvents();

            startMasterTrapTimers();

            await setupRealtime();

            // Prima visualizzazione dei sei pannelli del nuovo Master.
            await loadMasterControlCenter();

            startMasterDashboardRefresh();

        } catch (error) {

            console.error(
                "Errore modalità Master:",
                error
            );


            showMessage(
                "Errore: " +
                (
                    error.message ||
                    "impossibile avviare la modalità Master."
                )
            );

        }

    }
);


// ============================================================
// CONTROLLO ACCESSO MASTER
// ============================================================

async function checkMasterAccess() {

    const {
        data: {
            user
        },
        error: authError
    } =
        await db
            .auth
            .getUser();


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


    if (
        data?.role !==
        "master"
    ) {

        window.location.href =
            "scheda.html";

        return;

    }


    console.log(
        "Accesso Master autorizzato."
    );

}


// ============================================================
// MAPPA
// ============================================================

function setupMap() {

    const image =
        document.getElementById(
            "master-map-image"
        );


    if (!image) {

        return;

    }


    const renderMapElements =
        () => {

            renderAllTokens();

            renderMasterEvents();

        };


    if (
        image.complete
    ) {

        renderMapElements();

    } else {

        image.addEventListener(
            "load",
            renderMapElements
        );

    }

}

// ============================================================
// CARICA STATO TRAPPOLE
// ============================================================

async function loadMasterTrapStates() {

    const {
        data,
        error
    } =
        await db
            .from(
                "dungeon_trap_states"
            )
            .select(
                "trap_id, triggered_at, disabled_until"
            );


    if (error) {

        console.error(
            "Errore caricamento stato trappole:",
            error
        );

        return;

    }


    masterTrapStates.clear();


    (
        data ||
        []
    ).forEach(
        trapState => {

            masterTrapStates.set(
                trapState.trap_id,
                trapState
            );

        }
    );


    renderMasterEvents();

}


// ============================================================
// TIMER MASTER TRAPPOLE
// ============================================================

function startMasterTrapTimers() {

    if (
        trapStateRefreshTimer
    ) {

        clearInterval(
            trapStateRefreshTimer
        );

    }


    if (
        trapCountdownTimer
    ) {

        clearInterval(
            trapCountdownTimer
        );

    }


    // Rilegge Supabase periodicamente,
    // così il Master vede le trappole
    // attivate dai giocatori.

    trapStateRefreshTimer =
        setInterval(
            async () => {

                await loadMasterTrapStates();

            },
            5000
        );


    // Aggiorna invece il countdown visivo
    // ogni secondo senza interrogare Supabase.

    trapCountdownTimer =
        setInterval(
            () => {

                updateMasterTrapCountdowns();

            },
            1000
        );

}


// ============================================================
// RENDER EVENTI MASTER
// ============================================================

function renderMasterEvents() {

    const image =
        document.getElementById(
            "master-map-image"
        );


    const container =
        document.getElementById(
            "master-map"
        );


    if (
        !image ||
        !container
    ) {

        return;

    }


    const oldMarkers =
        container.querySelectorAll(
            ".master-event-marker"
        );


    oldMarkers.forEach(
        marker => {

            marker.remove();

        }
    );


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


    const cellWidth =
        mapRect.width /
        MAP_COLUMNS;


    const cellHeight =
        mapRect.height /
        MAP_ROWS;


    Object.entries(
        MASTER_DUNGEON_EVENTS
    ).forEach(
        ([
            coordinateKey,
            dungeonEvent
        ]) => {

            const [
                x,
                y
            ] =
                coordinateKey
                    .split(",")
                    .map(Number);


            const marker =
                document.createElement(
                    "div"
                );


            marker.className =
                "master-event-marker";


            marker.dataset.eventId =
                dungeonEvent.id;


            marker.dataset.eventType =
                dungeonEvent.type;


            // ------------------------------------------------
            // POSIZIONE
            // ------------------------------------------------

            const markerSize =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.72;


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


            marker.style.width =
                `${markerSize}px`;


            marker.style.height =
                `${markerSize}px`;


            marker.style.left =
                `${
                    offsetX +
                    centerX -
                    markerSize / 2
                }px`;


            marker.style.top =
                `${
                    offsetY +
                    centerY -
                    markerSize / 2
                }px`;


            // ------------------------------------------------
            // TIPO EVENTO
            // ------------------------------------------------

            if (
                dungeonEvent.type ===
                "communication"
            ) {

                marker.classList.add(
                    "is-communication"
                );


                marker.textContent =
                    "◆";


                marker.title =
                    `EVENTO\nX ${x} • Y ${y}\n${dungeonEvent.message}`;

            }


            if (
                dungeonEvent.type ===
                "trap"
            ) {

                const state =
                    masterTrapStates.get(
                        dungeonEvent.id
                    );


                const cooldownActive =
                    isMasterTrapCooldownActive(
                        state
                    );


                marker.classList.add(
                    "is-trap"
                );


                if (
                    cooldownActive
                ) {

                    marker.classList.add(
                        "is-cooldown"
                    );

                } else {

                    marker.classList.add(
                        "is-active"
                    );

                }


                const icon =
                    document.createElement(
                        "span"
                    );


                icon.className =
                    "master-event-icon";


                icon.textContent =
                    "⚠";


                marker.appendChild(
                    icon
                );


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                marker.appendChild(
                    countdown
                );


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }


            container.appendChild(
                marker
            );

        }
    );

}


// ============================================================
// TRAPPOLA IN COOLDOWN?
// ============================================================

function isMasterTrapCooldownActive(
    state
) {

    if (
        !state ||
        !state.disabled_until
    ) {

        return false;

    }


    const disabledUntil =
        new Date(
            state.disabled_until
        )
            .getTime();


    if (
        !Number.isFinite(
            disabledUntil
        )
    ) {

        return false;

    }


    return (
        disabledUntil >
        Date.now()
    );

}


// ============================================================
// AGGIORNA COUNTDOWN
// ============================================================

function updateMasterTrapCountdowns() {

    document
        .querySelectorAll(
            ".master-event-marker.is-trap"
        )
        .forEach(
            marker => {

                const eventId =
                    marker.dataset.eventId;


                const dungeonEvent =
                    Object.values(
                        MASTER_DUNGEON_EVENTS
                    )
                        .find(
                            event =>
                                event.id ===
                                eventId
                        );


                if (
                    !dungeonEvent
                ) {

                    return;

                }


                const entry =
                    Object.entries(
                        MASTER_DUNGEON_EVENTS
                    )
                        .find(
                            ([
                                key,
                                event
                            ]) =>
                                event.id ===
                                eventId
                        );


                if (
                    !entry
                ) {

                    return;

                }


                const [
                    coordinateKey
                ] =
                    entry;


                const [
                    x,
                    y
                ] =
                    coordinateKey
                        .split(",")
                        .map(Number);


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }
        );

}


// ============================================================
// AGGIORNA SINGOLA TRAPPOLA
// ============================================================

function updateSingleMasterTrapMarker(
    marker,
    dungeonEvent,
    x,
    y
) {

    const state =
        masterTrapStates.get(
            dungeonEvent.id
        );


    const countdownElement =
        marker.querySelector(
            ".master-event-countdown"
        );


    const cooldownActive =
        isMasterTrapCooldownActive(
            state
        );


    marker.classList.toggle(
        "is-cooldown",
        cooldownActive
    );


    marker.classList.toggle(
        "is-active",
        !cooldownActive
    );


    if (
        !cooldownActive
    ) {

        if (
            countdownElement
        ) {

            countdownElement.textContent =
                "";

        }


        marker.title =
            `TRAPPOLA ATTIVA\nX ${x} • Y ${y}\n${dungeonEvent.message}`;


        return;

    }


    const disabledUntil =
        new Date(
            state.disabled_until
        )
            .getTime();


    const remainingMs =
        Math.max(
            0,
            disabledUntil -
            Date.now()
        );


    const remainingSeconds =
        Math.ceil(
            remainingMs /
            1000
        );


    const minutes =
        Math.floor(
            remainingSeconds /
            60
        );


    const seconds =
        remainingSeconds %
        60;


    const countdownText =
        `${minutes}:${String(
            seconds
        ).padStart(
            2,
            "0"
        )}`;


    if (
        countdownElement
    ) {

        countdownElement.textContent =
            countdownText;

    }


    marker.title =
        `TRAPPOLA IN COOLDOWN\nX ${x} • Y ${y}\n${dungeonEvent.message}\nTempo residuo: ${countdownText}`;

}

// ============================================================
// REALTIME
// ============================================================

async function setupRealtime() {

    showMessage(
        "Connessione al dungeon..."
    );


    dungeonChannel =
        db.channel(
            DUNGEON_CHANNEL_NAME
        );


    // ========================================================
    // PRESENCE
    // ========================================================

    dungeonChannel.on(
        "presence",
        {
            event:
                "sync"
        },
        () => {

            syncPresencePlayers();

        }
    );


    // ========================================================
    // MOVIMENTO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event:
                "player-move"
        },
        message => {

            const data =
                message.payload;


            if (
                !data ||
                !data.character_id
            ) {

                return;

            }


            updatePlayer(
                data
            );

        }
    );


    // ========================================================
    // STATO COMPLETO
    // ========================================================

    dungeonChannel.on(
        "broadcast",
        {
            event:
                "player-state"
        },
        message => {

            const data =
                message.payload;


            if (
                !data ||
                !data.character_id
            ) {

                return;

            }


            updatePlayer(
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
            event:
                "floor-chat"
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            appendMasterChatMessage(
                data,
                data.name === "MASTER" ||
                data.nome === "MASTER" ||
                data.sender_name === "MASTER"
            );

        }
    );


    // ========================================================
    // SUBSCRIBE
    // ========================================================

    dungeonChannel.subscribe(
        status => {

            console.log(
                "Realtime Master:",
                status
            );


            if (
                status ===
                "SUBSCRIBED"
            ) {

                realtimeReady =
                    true;


                showMessage(
                    "Modalità Master connessa."
                );


                setMasterChatConnected(
                    true
                );


                updateOnlineCounter();

            }


            if (
                status ===
                "CHANNEL_ERROR" ||
                status ===
                "TIMED_OUT" ||
                status ===
                "CLOSED"
            ) {

                realtimeReady =
                    false;


                setMasterChatConnected(
                    false
                );


                showMessage(
                    "Errore connessione Realtime."
                );

            }

        }
    );

}


// ============================================================
// SINCRONIZZA PRESENCE
// ============================================================

function syncPresencePlayers() {

    if (!dungeonChannel) {

        return;

    }


    const state =
        dungeonChannel
            .presenceState();


    const currentIds =
        new Set();


    Object.values(
        state
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence.character_id
                    ) {

                        return;

                    }


                    currentIds.add(
                        presence.character_id
                    );


                    updatePlayer(
                        presence
                    );

                }
            );

        }
    );


    for (
        const characterId
        of onlinePlayers.keys()
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            removePlayer(
                characterId
            );

        }

    }


    updatePlayerList();

    updateOnlineCounter();

}


// ============================================================
// AGGIORNA GIOCATORE
// ============================================================

function updatePlayer(
    data
) {

    if (
        !data ||
        !data.character_id
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


    onlinePlayers.set(
        data.character_id,
        {

            character_id:
                data.character_id,

            user_id:
                data.user_id ||
                null,

            nome:
                data.nome ||
                "Avventuriero",

            token:
                data.token ||
                "token_1.png",

            x,
            y

        }
    );


    renderPlayerToken(
        data.character_id
    );


    updatePlayerList();

    updateOnlineCounter();

}


// ============================================================
// RIMUOVI GIOCATORE
// ============================================================

function removePlayer(
    characterId
) {

    onlinePlayers.delete(
        characterId
    );


    const token =
        playerTokens.get(
            characterId
        );


    if (token) {

        token.remove();


        playerTokens.delete(
            characterId
        );

    }

}


// ============================================================
// MOSTRA TOKEN
// ============================================================

function renderPlayerToken(
    characterId
) {

    const player =
        onlinePlayers.get(
            characterId
        );


    if (!player) {

        return;

    }


    const image =
        document.getElementById(
            "master-map-image"
        );


    const container =
        document.getElementById(
            "master-map"
        );


    if (
        !image ||
        !container
    ) {

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


    const cellWidth =
        mapRect.width /
        MAP_COLUMNS;


    const cellHeight =
        mapRect.height /
        MAP_ROWS;


    let token =
        playerTokens.get(
            characterId
        );


    if (!token) {

        token =
            document.createElement(
                "img"
            );


        token.className =
            "master-player-token";


        token.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                openCharacterSheet(
                    characterId
                );

            }
        );


        container.appendChild(
            token
        );


        playerTokens.set(
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
        ) *
        0.92;


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

}


// ============================================================
// RIDISEGNA TOKEN
// ============================================================

function renderAllTokens() {

    for (
        const characterId
        of onlinePlayers.keys()
    ) {

        renderPlayerToken(
            characterId
        );

    }

}


// ============================================================
// LISTA GIOCATORI
// ============================================================

function updatePlayerList() {

    const list =
        document.getElementById(
            "master-player-list"
        );


    if (!list) {

        return;

    }


    list.innerHTML =
        "";


    if (
        onlinePlayers.size ===
        0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "master-player-empty";


        empty.textContent =
            "Nessun giocatore collegato.";


        list.appendChild(
            empty
        );


        return;

    }


    const players =
        Array.from(
            onlinePlayers.values()
        )
            .sort(
                (a, b) =>
                    a.nome.localeCompare(
                        b.nome,
                        "it"
                    )
            );


    players.forEach(
        player => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "master-player-item";


            const token =
                document.createElement(
                    "img"
                );


            token.src =
                "immagini/token/" +
                player.token;


            token.alt =
                "";


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "master-player-info";


            const name =
                document.createElement(
                    "span"
                );


            name.className =
                "master-player-name";


            name.textContent =
                player.nome;


            const position =
                document.createElement(
                    "span"
                );


            position.className =
                "master-player-position";


            position.textContent =
                `X ${player.x} • Y ${player.y}`;


            info.appendChild(
                name
            );


            info.appendChild(
                position
            );


            button.appendChild(
                token
            );


            button.appendChild(
                info
            );


            button.addEventListener(
                "click",
                () => {

                    openCharacterSheet(
                        player.character_id
                    );

                }
            );


            list.appendChild(
                button
            );

        }
    );

}


// ============================================================
// CONTATORE ONLINE
// ============================================================

function updateOnlineCounter() {

    const element =
        document.getElementById(
            "master-online-count"
        );


    if (!element) {

        return;

    }


    const count =
        onlinePlayers.size;


    if (
        !realtimeReady
    ) {

        element.textContent =
            "Connessione...";

        return;

    }


    if (
        count ===
        0
    ) {

        element.textContent =
            "Nessun giocatore online";

    } else if (
        count ===
        1
    ) {

        element.textContent =
            "1 giocatore online";

    } else {

        element.textContent =
            `${count} giocatori online`;

    }

}


// ============================================================
// CHAT MASTER - SETUP
// ============================================================

function setupMasterChat() {

    const form =
        document.getElementById(
            "master-chat-form"
        );

    const input =
        document.getElementById(
            "master-chat-input"
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

            await sendMasterChatMessage();

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
// CARICA STORICO CHAT MASTER
// ============================================================

async function loadMasterChatHistory() {

    const container =
        document.getElementById(
            "master-chat-messages"
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
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .eq(
                    "floor_id",
                    MASTER_CHAT_FLOOR_ID
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    MASTER_CHAT_HISTORY_LIMIT
                );

        if (error) {
            throw error;
        }

        renderedMasterChatMessageIds.clear();

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
                    <div class="master-chat-empty">
                        Nessun messaggio ancora.
                    </div>
                `;

            return;
        }

        rows.forEach(
            row => {

                appendMasterChatMessage(
                    {
                        id:
                            row.id,

                        character_id:
                            row.character_id,

                        master_user_id:
                            row.character_id === null
                                ? row.user_id
                                : null,

                        name:
                            row.sender_name,

                        text:
                            row.message_text,

                        timestamp:
                            row.created_at,

                        sent_at:
                            row.created_at
                    },
                    row.sender_name ===
                        "MASTER"
                );

            }
        );

    } catch (error) {

        console.error(
            "Errore caricamento storico chat Master:",
            error
        );

    }

}


// ============================================================
// STATO CHAT
// ============================================================

function setMasterChatConnected(
    connected
) {

    const input =
        document.getElementById(
            "master-chat-input"
        );

    const button =
        document.getElementById(
            "master-chat-send"
        );

    const status =
        document.getElementById(
            "master-chat-status"
        );

    if (input) {
        input.disabled =
            !connected;
    }

    if (button) {
        button.disabled =
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

}


// ============================================================
// INVIA MESSAGGIO MASTER
// ============================================================

async function sendMasterChatMessage() {

    const input =
        document.getElementById(
            "master-chat-input"
        );

    const feedback =
        document.getElementById(
            "master-chat-feedback"
        );

    if (
        !input ||
        !currentUser
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

    const originalValue =
        input.value;

    input.value =
        "";

    if (feedback) {
        feedback.textContent =
            "";
    }

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
                        MASTER_CHAT_FLOOR_ID,

                    character_id:
                        null,

                    user_id:
                        currentUser.id,

                    sender_name:
                        "MASTER",

                    message_text:
                        text

                })
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .single();

        if (error) {
            throw error;
        }

        const payload = {

            id:
                savedMessage.id,

            character_id:
                null,

            master_user_id:
                savedMessage.user_id ||
                currentUser.id,

            name:
                "MASTER",

            nome:
                "MASTER",

            text:
                savedMessage.message_text ||
                text,

            timestamp:
                savedMessage.created_at,

            sent_at:
                savedMessage.created_at

        };

        appendMasterChatMessage(
            payload,
            true
        );

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
                "Invio chat Master:",
                result
            );

        }

    } catch (error) {

        console.error(
            "Errore salvataggio chat Master:",
            error
        );

        input.value =
            originalValue;

        if (feedback) {
            feedback.textContent =
                "Messaggio non inviato.";
        }

    }

}


// ============================================================
// MOSTRA MESSAGGIO CHAT
// ============================================================

function appendMasterChatMessage(
    data,
    isMaster = false
) {

    const container =
        document.getElementById(
            "master-chat-messages"
        );

    if (
        !container ||
        !data
    ) {
        return;
    }

    const messageId =
        data.id ||
        data.message_id ||
        null;

    if (
        messageId &&
        renderedMasterChatMessageIds.has(
            String(messageId)
        )
    ) {
        return;
    }

    if (messageId) {
        renderedMasterChatMessageIds.add(
            String(messageId)
        );
    }

    const empty =
        container.querySelector(
            ".master-chat-empty"
        );

    if (empty) {
        empty.remove();
    }

    const message =
        document.createElement(
            "div"
        );

    const authorName =
        data.name ||
        data.nome ||
        data.sender_name ||
        "Giocatore";

    message.className =
        "master-chat-message" +
        (
            isMaster ||
            authorName ===
            "MASTER"
                ? " is-master"
                : ""
        );

    if (messageId) {
        message.dataset.messageId =
            String(messageId);
    }

    const meta =
        document.createElement(
            "div"
        );

    meta.className =
        "master-chat-meta";

    const author =
        document.createElement(
            "strong"
        );

    author.textContent =
        authorName;

    const time =
        document.createElement(
            "span"
        );

    time.textContent =
        formatChatTime(
            data.sent_at ||
            data.timestamp ||
            data.created_at
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
        "master-chat-body";

    body.textContent =
        String(
            data.text ||
            data.message_text ||
            ""
        );

    message.appendChild(
        meta
    );

    message.appendChild(
        body
    );

    container.prepend(
        message
    );

    const messages =
        container.querySelectorAll(
            ".master-chat-message"
        );

    if (
        messages.length >
        MASTER_CHAT_HISTORY_LIMIT
    ) {

        const last =
            messages[
                messages.length - 1
            ];

        const lastId =
            last?.dataset
                ?.messageId;

        if (lastId) {

            renderedMasterChatMessageIds.delete(
                lastId
            );

        }

        last?.remove();

    }

    container.scrollTop =
        0;

}


// ============================================================
// ORARIO CHAT
// ============================================================

function formatChatTime(
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
// APRI SCHEDA PERSONAGGIO
// ============================================================

async function openCharacterSheet(
    characterId
) {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    if (!modal) {

        return;

    }


    showMessage(
        "Caricamento scheda..."
    );


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
                livello,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                dungeon_x,
                dungeon_y
                `
            )
            .eq(
                "id",
                characterId
            )
            .single();


    if (error) {

        console.error(
            "Errore caricamento scheda:",
            error
        );


        showMessage(
            "Impossibile caricare la scheda."
        );


        return;

    }


    fillCharacterSheet(
        data
    );


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    showMessage(
        ""
    );

}


// ============================================================
// RIEMPI SCHEDA
// ============================================================

function fillCharacterSheet(
    character
) {

    const forza =
        getStat(
            character.forza
        );


    const resistenza =
        getStat(
            character.resistenza
        );


    const costituzione =
        getStat(
            character.costituzione
        );


    const intelligenza =
        getStat(
            character.intelligenza
        );


    const destrezza =
        getStat(
            character.destrezza
        );


    const fortuna =
        getStat(
            character.fortuna
        );


    setText(
        "master-character-name",
        character.nome ||
        "Avventuriero"
    );


    setText(
        "master-character-level",
        "Livello " +
        (
            Number(
                character.livello
            ) ||
            1
        )
    );


    const token =
        document.getElementById(
            "master-character-token"
        );


    if (token) {

        token.src =
            "immagini/token/" +
            (
                character.token ||
                "token_1.png"
            );


        token.alt =
            "Token di " +
            (
                character.nome ||
                "personaggio"
            );

    }


    setText(
        "master-forza",
        forza
    );


    setText(
        "master-resistenza",
        resistenza
    );


    setText(
        "master-costituzione",
        costituzione
    );


    setText(
        "master-intelligenza",
        intelligenza
    );


    setText(
        "master-destrezza",
        destrezza
    );


    setText(
        "master-fortuna",
        fortuna
    );


    const attack =
        Math.ceil(
            forza /
            2
        );


    const defense =
        Math.ceil(
            7 +
            (
                resistenza /
                2
            )
        );


    const life =
        Math.ceil(
            5 *
            (
                costituzione /
                2
            )
        );


    const mana =
        Math.ceil(
            5 *
            (
                intelligenza /
                2
            )
        );


    const movement =
        Math.ceil(
            4 +
            (
                destrezza /
                2
            )
        );


    const critical =
        Math.min(
            50,
            Math.ceil(
                fortuna *
                (
                    50 /
                    30
                )
            )
        );


    setText(
        "master-attack",
        attack
    );


    setText(
        "master-defense",
        defense
    );


    setText(
        "master-life",
        life
    );


    setText(
        "master-mana",
        mana
    );


    setText(
        "master-movement",
        movement
    );


    setText(
        "master-critical",
        `${critical}%`
    );


    setText(
        "master-character-position",
        `X ${
            Number(
                character.dungeon_x
            ) || 0
        } • Y ${
            Number(
                character.dungeon_y
            ) || 0
        }`
    );

}


// ============================================================
// VALORE STAT
// ============================================================

function getStat(
    value
) {

    const number =
        Number(
            value
        );


    if (
        !Number.isFinite(
            number
        )
    ) {

        return 1;

    }


    return Math.max(
        1,
        Math.min(
            30,
            number
        )
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
// MODALE
// ============================================================

function setupModal() {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    const closeButton =
        document.getElementById(
            "master-modal-close"
        );


    if (
        !modal ||
        !closeButton
    ) {

        return;

    }


    closeButton.addEventListener(
        "click",
        closeCharacterSheet
    );


    modal
        .querySelectorAll(
            "[data-close-master-modal]"
        )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    closeCharacterSheet
                );

            }
        );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape" &&
                !modal.hidden
            ) {

                closeCharacterSheet();

            }

        }
    );

}


// ============================================================
// CHIUDI SCHEDA
// ============================================================

function closeCharacterSheet() {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    if (!modal) {

        return;

    }


    modal.hidden =
        true;


    document.body.style.overflow =
        "";

}


// ============================================================
// LOGOUT
// ============================================================

function setupLogout() {

    const button =
        document.getElementById(
            "logout-button"
        );


    if (!button) {

        return;

    }


    button.addEventListener(
        "click",
        async () => {

            if (
                dungeonChannel
            ) {

                await db
                    .removeChannel(
                        dungeonChannel
                    );

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
// MESSAGGIO
// ============================================================

function showMessage(
    text
) {

    const element =
        document.getElementById(
            "master-message"
        );


    if (element) {

        element.textContent =
            text;

    }

}


// ============================================================
// RIDIMENSIONAMENTO
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderAllTokens();

        renderMasterEvents();

    }
);


// ============================================================
// USCITA
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            dungeonChannel
        ) {

            db.removeChannel(
                dungeonChannel
            );

        }

    }
);


// ============================================================
// DASHBOARD MASTER v3
// Tutti i PG dal database + Presence online + combat spettatore
// ============================================================

const MASTER_COMBAT_EVENTS = [
    { id: "C1", x: 12, y: 4, encounter_id: "combat_1" },
    { id: "C2", x: 7,  y: 11, encounter_id: "combat_2" },
    { id: "C3", x: 13, y: 14, encounter_id: "combat_3" },
    { id: "C4", x: 19, y: 11, encounter_id: "combat_4" },
    { id: "C5", x: 11, y: 20, encounter_id: "combat_5" },
    { id: "BOSS1", x: 19, y: 20, encounter_id: "combat_boss", type: "boss" }
];

const MASTER_SPECIAL_EVENTS = [
    { id: "PVP1", x: 1, y: 14, type: "pvp", label: "PVP" },
    { id: "VENDOR1", x: 2, y: 11, type: "vendor", label: "VENDOR" }
];

const allMasterPlayers = new Map();
const activeMasterCombats = new Map();
const masterPlayerScores = new Map();
const masterMonkeyFingerOwners = new Set();
let masterDashboardRefreshTimer = null;

async function loadMasterCharacterExtras(characterIds) {
    const ids = Array.isArray(characterIds)
        ? characterIds.filter(Boolean)
        : [];

    if (ids.length === 0) {
        masterPlayerScores.clear();
        masterMonkeyFingerOwners.clear();
        return;
    }

    const [scoreResults, inventoryResult] = await Promise.all([
        Promise.all(
            ids.map(async characterId => {
                try {
                    const { data, error } = await db.rpc(
                        "get_character_final_score",
                        {
                            p_character_id: characterId
                        }
                    );

                    if (error) {
                        throw error;
                    }

                    return {
                        characterId,
                        score: Number(data) || 0
                    };
                } catch (error) {
                    console.error(
                        "Errore score Master per PG",
                        characterId,
                        error
                    );

                    return {
                        characterId,
                        score: masterPlayerScores.get(characterId) ?? 0
                    };
                }
            })
        ),

        db
            .from("character_inventory")
            .select("character_id, item_id, quantity")
            .in("character_id", ids)
            .eq("item_id", "dito_scimmia")
    ]);

    scoreResults.forEach(entry => {
        masterPlayerScores.set(
            entry.characterId,
            entry.score
        );
    });

    if (inventoryResult.error) {
        console.error(
            "Errore controllo Dito di Scimmia Master:",
            inventoryResult.error
        );
        return;
    }

    masterMonkeyFingerOwners.clear();

    (inventoryResult.data || []).forEach(entry => {
        if (
            entry.character_id &&
            (Number(entry.quantity) || 0) > 0
        ) {
            masterMonkeyFingerOwners.add(
                entry.character_id
            );
        }
    });
}


async function loadAllMasterCharacters() {
    const { data, error } = await db
        .from("characters")
        .select(`
            id,
            user_id,
            nome,
            livello,
            token,
            forza,
            resistenza,
            costituzione,
            intelligenza,
            destrezza,
            fortuna,
            current_hp,
            current_pm,
            dungeon_x,
            dungeon_y,
            active_combat_id
        `);

    if (error) {
        console.error("Errore caricamento PG Master:", error);
        return;
    }

    const characterIds = (data || []).map(characterData => characterData.id);

    await loadMasterCharacterExtras(characterIds);

    const currentIds = new Set();

    (data || []).forEach(characterData => {
        currentIds.add(characterData.id);

        const presence = onlinePlayers.get(characterData.id);

        const x = presence && Number.isFinite(Number(presence.x))
            ? Number(presence.x)
            : Number(characterData.dungeon_x);

        const y = presence && Number.isFinite(Number(presence.y))
            ? Number(presence.y)
            : Number(characterData.dungeon_y);

        allMasterPlayers.set(characterData.id, {
            ...characterData,
            character_id: characterData.id,
            nome: presence?.nome || presence?.name || characterData.nome || "Avventuriero",
            token: presence?.token || characterData.token || "token_1.png",
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            current_hp: presence?.current_hp !== undefined
                ? presence.current_hp
                : characterData.current_hp,
            active_combat_id: presence?.active_combat_id || characterData.active_combat_id || null,
            score: masterPlayerScores.get(characterData.id) ?? 0,
            has_monkey_finger: masterMonkeyFingerOwners.has(characterData.id),
            online: onlinePlayers.has(characterData.id)
        });
    });

    for (const characterId of Array.from(allMasterPlayers.keys())) {
        if (!currentIds.has(characterId)) {
            allMasterPlayers.delete(characterId);
            const token = playerTokens.get(characterId);
            if (token) token.remove();
            playerTokens.delete(characterId);
        }
    }

    renderAllTokens();
    updatePlayerList();
    updateOnlineCounter();
    renderMasterMonkeyFingerStatus();
}


// ============================================================
// BOX PASSWORD BOSS
// ============================================================

async function loadMasterBossPassword() {
    const passwordElement =
        document.getElementById("master-boss-password");

    const expiryElement =
        document.getElementById("master-boss-password-expiry");

    if (!passwordElement) {
        return;
    }

    try {
        const { data, error } = await db
            .from("dungeon_boss_gate_password")
            .select("password_text, cycle_started_at, cycle_expires_at")
            .eq("id", "boss_room_1")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data?.password_text) {
            passwordElement.textContent = "NON DISPONIBILE";

            if (expiryElement) {
                expiryElement.textContent =
                    "Nessuna password attiva trovata.";
            }

            return;
        }

        passwordElement.textContent =
            String(data.password_text);

        if (expiryElement) {
            const expiresAt =
                data.cycle_expires_at
                    ? new Date(data.cycle_expires_at)
                    : null;

            expiryElement.textContent =
                expiresAt &&
                !Number.isNaN(expiresAt.getTime())
                    ? "Valida fino alle " +
                      expiresAt.toLocaleTimeString(
                          "it-IT",
                          {
                              hour: "2-digit",
                              minute: "2-digit"
                          }
                      )
                    : "Password del ciclo attuale";
        }

    } catch (error) {
        console.error(
            "Errore caricamento password Boss Master:",
            error
        );

        passwordElement.textContent = "ERRORE";

        if (expiryElement) {
            expiryElement.textContent =
                "Impossibile leggere la password attuale.";
        }
    }
}


// ============================================================
// BOX DITO DI SCIMMIA
// ============================================================

function renderMasterMonkeyFingerStatus() {
    const statusElement =
        document.getElementById(
            "master-monkey-finger-status"
        );

    const ownerElement =
        document.getElementById(
            "master-monkey-finger-owner"
        );

    const panel =
        document.querySelector(
            ".master-monkey-finger-panel"
        );

    if (!statusElement) {
        return;
    }

    const owners =
        Array.from(masterMonkeyFingerOwners)
            .map(characterId => {
                const player =
                    allMasterPlayers.get(characterId);

                return player?.nome || null;
            })
            .filter(Boolean);

    const available =
        owners.length === 0;

    statusElement.textContent =
        available
            ? "DISPONIBILE"
            : "IN POSSESSO";

    if (ownerElement) {
        ownerElement.textContent =
            available
                ? "Nessun PG lo possiede."
                : owners.length === 1
                    ? `In mano a: ${owners[0]}`
                    : `In mano a: ${owners.join(", ")}`;
    }

    if (panel) {
        panel.classList.toggle(
            "is-available",
            available
        );

        panel.classList.toggle(
            "is-owned",
            !available
        );
    }
}


async function loadActiveMasterCombats() {
    const { data, error } = await db
        .from("combat_sessions")
        .select(`
            id,
            encounter_id,
            status,
            round_number,
            current_turn_entity_id
        `)
        .in("status", ["waiting", "active"]);

    if (error) {
        console.error("Errore caricamento combat Master:", error);
        return;
    }

    activeMasterCombats.clear();

    (data || []).forEach(combat => {
        activeMasterCombats.set(combat.id, combat);
    });

    renderActiveMasterCombats();
    renderMasterEvents();
}

function startMasterDashboardRefresh() {
    if (masterDashboardRefreshTimer) {
        clearInterval(masterDashboardRefreshTimer);
    }

    masterDashboardRefreshTimer = setInterval(async () => {
        await Promise.all([
            loadAllMasterCharacters(),
            loadActiveMasterCombats(),
            loadMasterBossPassword()
        ]);
    }, 4000);
}

function getActiveCombatForEncounter(encounterId) {
    return Array.from(activeMasterCombats.values()).find(
        combat => combat.encounter_id === encounterId
    ) || null;
}

function openMasterCombat(combatId) {
    if (!combatId) return;

    window.location.href =
        `combat.html?combat_id=${encodeURIComponent(combatId)}&mode=master`;
}

function renderActiveMasterCombats() {
    const list = document.getElementById("master-combat-list");
    const countElement = document.getElementById("master-combat-count");

    if (!list) return;

    const combats = Array.from(activeMasterCombats.values())
        .sort((a, b) => String(a.encounter_id || "").localeCompare(String(b.encounter_id || "")));

    list.innerHTML = "";

    if (countElement) {
        countElement.textContent = combats.length === 0
            ? "Nessun combattimento attivo"
            : combats.length === 1
                ? "1 combattimento attivo"
                : `${combats.length} combattimenti attivi`;
    }

    if (combats.length === 0) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun combattimento in corso.";
        list.appendChild(empty);
        return;
    }

    combats.forEach(combat => {
        const row = document.createElement("div");
        row.className = "master-combat-item";

        const info = document.createElement("div");
        const title = document.createElement("div");
        title.className = "master-combat-title";
        title.textContent = String(combat.encounter_id || "COMBATTIMENTO").toUpperCase();

        const meta = document.createElement("div");
        meta.className = "master-combat-meta";

        const participants = Array.from(allMasterPlayers.values())
            .filter(player => player.active_combat_id === combat.id)
            .map(player => player.nome);

        const participantText = participants.length
            ? ` · ${participants.join(", ")}`
            : "";

        meta.textContent =
            `${combat.status === "active" ? "IN CORSO" : "IN ATTESA"} · Round ${Number(combat.round_number) || 1}${participantText}`;

        info.append(title, meta);

        const watch = document.createElement("button");
        watch.type = "button";
        watch.className = "button master-combat-watch";
        watch.textContent = "OSSERVA";
        watch.addEventListener("click", () => openMasterCombat(combat.id));

        row.append(info, watch);
        list.appendChild(row);
    });
}

// ============================================================
// PRESENCE: non rimuove più i PG offline dal Master
// ============================================================

function syncPresencePlayers() {
    if (!dungeonChannel) return;

    const state = dungeonChannel.presenceState();
    const currentIds = new Set();

    Object.values(state).forEach(presences => {
        presences.forEach(presence => {
            if (!presence.character_id) return;

            currentIds.add(presence.character_id);

            onlinePlayers.set(presence.character_id, {
                ...presence,
                nome: presence.nome || presence.name || "Avventuriero"
            });

            const existing = allMasterPlayers.get(presence.character_id);

            if (existing) {
                allMasterPlayers.set(presence.character_id, {
                    ...existing,
                    nome: presence.nome || presence.name || existing.nome,
                    token: presence.token || existing.token,
                    x: Number.isFinite(Number(presence.x)) ? Number(presence.x) : existing.x,
                    y: Number.isFinite(Number(presence.y)) ? Number(presence.y) : existing.y,
                    current_hp: presence.current_hp !== undefined ? presence.current_hp : existing.current_hp,
                    active_combat_id: presence.active_combat_id || existing.active_combat_id || null,
                    online: true
                });
            }
        });
    });

    for (const characterId of Array.from(onlinePlayers.keys())) {
        if (!currentIds.has(characterId)) {
            onlinePlayers.delete(characterId);
            const existing = allMasterPlayers.get(characterId);
            if (existing) {
                allMasterPlayers.set(characterId, { ...existing, online: false });
            }
        }
    }

    renderAllTokens();
    updatePlayerList();
    updateOnlineCounter();
    renderActiveMasterCombats();
}

function updatePlayer(data) {
    if (!data || !data.character_id) return;

    const x = Number(data.x);
    const y = Number(data.y);

    onlinePlayers.set(data.character_id, {
        ...onlinePlayers.get(data.character_id),
        ...data,
        nome: data.nome || data.name || onlinePlayers.get(data.character_id)?.nome || "Avventuriero"
    });

    const existing = allMasterPlayers.get(data.character_id) || {
        id: data.character_id,
        character_id: data.character_id,
        nome: data.nome || data.name || "Avventuriero",
        token: data.token || "token_1.png"
    };

    allMasterPlayers.set(data.character_id, {
        ...existing,
        character_id: data.character_id,
        nome: data.nome || data.name || existing.nome,
        token: data.token || existing.token || "token_1.png",
        x: Number.isFinite(x) ? x : (existing.x ?? 0),
        y: Number.isFinite(y) ? y : (existing.y ?? 0),
        current_hp: data.current_hp !== undefined ? data.current_hp : existing.current_hp,
        active_combat_id: data.active_combat_id !== undefined
            ? data.active_combat_id
            : existing.active_combat_id,
        online: true
    });

    renderPlayerToken(data.character_id);
    updatePlayerList();
    updateOnlineCounter();
    renderActiveMasterCombats();
}

function removePlayer(characterId) {
    onlinePlayers.delete(characterId);

    const existing = allMasterPlayers.get(characterId);
    if (existing) {
        allMasterPlayers.set(characterId, { ...existing, online: false });
    }

    renderPlayerToken(characterId);
    updatePlayerList();
    updateOnlineCounter();
}

// ============================================================
// TOKEN: tutti i PG, online/offline/combat
// ============================================================

function renderPlayerToken(characterId) {
    const player = allMasterPlayers.get(characterId);
    if (!player) return;

    const image = document.getElementById("master-map-image");
    const container = document.getElementById("master-map");
    if (!image || !container) return;

    const mapRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (mapRect.width <= 0 || mapRect.height <= 0) return;

    const cellWidth = mapRect.width / MAP_COLUMNS;
    const cellHeight = mapRect.height / MAP_ROWS;

    let token = playerTokens.get(characterId);

    if (!token) {
        token = document.createElement("img");
        token.className = "master-player-token";
        token.addEventListener("click", event => {
            event.stopPropagation();
            openCharacterSheet(characterId);
        });
        container.appendChild(token);
        playerTokens.set(characterId, token);
    }

    token.src = "immagini/token/" + (player.token || "token_1.png");
    token.alt = "Token di " + (player.nome || "Avventuriero");
    token.title = `${player.nome || "Avventuriero"}${player.online ? " · ONLINE" : " · OFFLINE"}${player.active_combat_id ? " · IN COMBATTIMENTO" : ""}`;

    token.classList.toggle("is-online", !!player.online);
    token.classList.toggle("is-offline", !player.online);
    token.classList.toggle("is-in-combat", !!player.active_combat_id);

    const tokenSize = Math.min(cellWidth, cellHeight) * 0.92;
    token.style.width = `${tokenSize}px`;
    token.style.height = `${tokenSize}px`;

    const x = Number.isFinite(Number(player.x)) ? Number(player.x) : 0;
    const y = Number.isFinite(Number(player.y)) ? Number(player.y) : 0;

    const centerX = (x + 0.5) * cellWidth;
    const centerY = (y + 0.5) * cellHeight;
    const offsetX = mapRect.left - containerRect.left;
    const offsetY = mapRect.top - containerRect.top;

    token.style.left = `${offsetX + centerX - tokenSize / 2}px`;
    token.style.top = `${offsetY + centerY - tokenSize / 2}px`;
}

function renderAllTokens() {
    for (const characterId of allMasterPlayers.keys()) {
        renderPlayerToken(characterId);
    }
}

// ============================================================
// LISTA PG COMPLETA
// ============================================================

function updatePlayerList() {
    const list = document.getElementById("master-player-list");
    if (!list) return;

    list.innerHTML = "";

    if (allMasterPlayers.size === 0) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun personaggio presente nel piano.";
        list.appendChild(empty);
        return;
    }

    const players = Array.from(allMasterPlayers.values())
        .sort((a, b) => {
            if (!!a.online !== !!b.online) return a.online ? -1 : 1;
            if (!!a.active_combat_id !== !!b.active_combat_id) return a.active_combat_id ? -1 : 1;
            return String(a.nome || "").localeCompare(String(b.nome || ""), "it");
        });

    players.forEach(player => {
        const row = document.createElement("div");
        row.className = "master-player-item";
        row.classList.toggle("is-offline", !player.online);
        row.classList.toggle("is-combat", !!player.active_combat_id);

        const token = document.createElement("img");
        token.src = "immagini/token/" + (player.token || "token_1.png");
        token.alt = "";

        const info = document.createElement("div");
        info.className = "master-player-info";

        const name = document.createElement("span");
        name.className = "master-player-name";
        name.textContent = player.nome || "Avventuriero";

        const position = document.createElement("span");
        position.className = "master-player-position";
        position.textContent = `X ${Number(player.x) || 0} • Y ${Number(player.y) || 0}`;

        const score = document.createElement("span");
        score.className = "master-player-score";
        score.textContent = `SCORE ${Number(player.score) || 0}`;

        const statusRow = document.createElement("div");
        statusRow.className = "master-player-status-row";

        const onlineBadge = document.createElement("span");
        onlineBadge.className = `master-status-badge ${player.online ? "online" : "offline"}`;
        onlineBadge.textContent = player.online ? "● ONLINE" : "○ OFFLINE";
        statusRow.appendChild(onlineBadge);

        if (player.active_combat_id) {
            const combatBadge = document.createElement("span");
            combatBadge.className = "master-status-badge combat";
            combatBadge.textContent = "⚔ COMBAT";
            statusRow.appendChild(combatBadge);
        }

        if (player.has_monkey_finger) {
            const fingerBadge = document.createElement("span");
            fingerBadge.className = "master-status-badge monkey-finger";
            fingerBadge.textContent = "☝ DITO DI SCIMMIA";
            statusRow.appendChild(fingerBadge);
        }

        info.append(name, position, score, statusRow);

        row.append(token, info);

        if (player.active_combat_id) {
            const watch = document.createElement("button");
            watch.type = "button";
            watch.className = "button master-inline-watch";
            watch.textContent = "OSSERVA";
            watch.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(player.active_combat_id);
            });
            row.appendChild(watch);
        }

        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        list.appendChild(row);
    });
}

function updateOnlineCounter() {
    const element = document.getElementById("master-online-count");
    if (!element) return;

    const onlineCount = Array.from(allMasterPlayers.values()).filter(player => player.online).length;
    const total = allMasterPlayers.size;

    if (!realtimeReady) {
        element.textContent = `${total} PG totali · connessione realtime...`;
        return;
    }

    element.textContent = `${onlineCount} online · ${total} PG totali`;
}

// ============================================================
// EVENTI MASTER: comunicazioni + trappole + combat
// ============================================================

function renderMasterEvents() {
    const image = document.getElementById("master-map-image");
    const container = document.getElementById("master-map");
    if (!image || !container) return;

    container.querySelectorAll(".master-event-marker").forEach(marker => marker.remove());

    const mapRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (mapRect.width <= 0 || mapRect.height <= 0) return;

    const cellWidth = mapRect.width / MAP_COLUMNS;
    const cellHeight = mapRect.height / MAP_ROWS;
    const offsetX = mapRect.left - containerRect.left;
    const offsetY = mapRect.top - containerRect.top;

    const placeMarker = (x, y, marker) => {
        const markerSize = Math.min(cellWidth, cellHeight) * 0.72;
        marker.style.width = `${markerSize}px`;
        marker.style.height = `${markerSize}px`;
        marker.style.left = `${offsetX + (x + 0.5) * cellWidth - markerSize / 2}px`;
        marker.style.top = `${offsetY + (y + 0.5) * cellHeight - markerSize / 2}px`;
        container.appendChild(marker);
    };

    Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coordinateKey, dungeonEvent]) => {
        const [x, y] = coordinateKey.split(",").map(Number);
        const marker = document.createElement("div");
        marker.className = "master-event-marker";
        marker.dataset.eventId = dungeonEvent.id;
        marker.dataset.eventType = dungeonEvent.type;

        if (dungeonEvent.type === "communication") {
            marker.classList.add("is-communication");
            marker.textContent = "◆";
            marker.title = `EVENTO\nX ${x} • Y ${y}\n${dungeonEvent.message}`;
        }

        if (dungeonEvent.type === "trap") {
            marker.classList.add("is-trap");
            const icon = document.createElement("span");
            icon.className = "master-event-icon";
            icon.textContent = "⚠";
            const countdown = document.createElement("span");
            countdown.className = "master-event-countdown";
            marker.append(icon, countdown);
            updateSingleMasterTrapMarker(marker, dungeonEvent, x, y);
        }

        placeMarker(x, y, marker);
    });

    MASTER_COMBAT_EVENTS.forEach(combatEvent => {
        const marker = document.createElement("div");
        const isBoss = combatEvent.type === "boss";

        marker.className =
            "master-event-marker is-combat" +
            (isBoss ? " is-boss" : "");

        marker.dataset.eventId = combatEvent.id;
        marker.dataset.eventType = isBoss ? "boss" : "combat";
        marker.textContent = isBoss ? "👹" : "⚔";

        const liveCombat = getActiveCombatForEncounter(combatEvent.encounter_id);

        if (liveCombat) {
            marker.classList.add("has-live-combat");
            marker.title =
                `${isBoss ? "BOSS IN CORSO" : "COMBATTIMENTO IN CORSO"}\n` +
                `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                "Clicca per osservare";

            marker.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(liveCombat.id);
            });
        } else {
            marker.title =
                `${isBoss ? "GOBLIN BOSS" : "EVENTO COMBAT"}\n` +
                `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                `X ${combatEvent.x} • Y ${combatEvent.y}`;
        }

        placeMarker(combatEvent.x, combatEvent.y, marker);
    });

    MASTER_SPECIAL_EVENTS.forEach(specialEvent => {
        const marker = document.createElement("div");

        marker.className =
            `master-event-marker is-special is-${specialEvent.type}`;

        marker.dataset.eventId = specialEvent.id;
        marker.dataset.eventType = specialEvent.type;

        marker.textContent =
            specialEvent.type === "pvp"
                ? "⚔"
                : "🐒";

        marker.title =
            `${specialEvent.label}\n` +
            `X ${specialEvent.x} • Y ${specialEvent.y}`;

        placeMarker(
            specialEvent.x,
            specialEvent.y,
            marker
        );
    });
}

// Countdown hh:mm:ss quando supera un'ora
function updateSingleMasterTrapMarker(marker, dungeonEvent, x, y) {
    const state = masterTrapStates.get(dungeonEvent.id);
    const countdownElement = marker.querySelector(".master-event-countdown");
    const cooldownActive = isMasterTrapCooldownActive(state);

    marker.classList.toggle("is-cooldown", cooldownActive);
    marker.classList.toggle("is-active", !cooldownActive);

    if (!cooldownActive) {
        if (countdownElement) countdownElement.textContent = "";
        marker.title = `TRAPPOLA ATTIVA\nX ${x} • Y ${y}\n${dungeonEvent.message}`;
        return;
    }

    const disabledUntil = new Date(state.disabled_until).getTime();
    const remainingSeconds = Math.ceil(Math.max(0, disabledUntil - Date.now()) / 1000);
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const countdownText = hours > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${minutes}:${String(seconds).padStart(2, "0")}`;

    if (countdownElement) countdownElement.textContent = countdownText;

    marker.title = `TRAPPOLA IN COOLDOWN\nX ${x} • Y ${y}\n${dungeonEvent.message}\nTempo residuo: ${countdownText}`;
}

// ============================================================
// SCHEDA PG MASTER ESTESA
// ============================================================

async function openCharacterSheet(characterId) {
    const modal = document.getElementById("master-character-modal");
    if (!modal) return;

    showMessage("Caricamento scheda...");

    const { data, error } = await db
        .from("characters")
        .select(`
            id,
            nome,
            livello,
            token,
            forza,
            resistenza,
            costituzione,
            intelligenza,
            destrezza,
            fortuna,
            current_hp,
            current_pm,
            dungeon_x,
            dungeon_y,
            active_combat_id
        `)
        .eq("id", characterId)
        .single();

    if (error) {
        console.error("Errore caricamento scheda:", error);
        showMessage("Impossibile caricare la scheda.");
        return;
    }

    const cached = allMasterPlayers.get(characterId);
    fillCharacterSheet({
        ...data,
        online: !!cached?.online,
        active_combat_id: cached?.active_combat_id || data.active_combat_id || null,
        score: cached?.score ?? masterPlayerScores.get(characterId) ?? 0,
        has_monkey_finger:
            cached?.has_monkey_finger ??
            masterMonkeyFingerOwners.has(characterId)
    });

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    showMessage("");
}

function fillCharacterSheet(characterData) {
    const forza = getStat(characterData.forza);
    const resistenza = getStat(characterData.resistenza);
    const costituzione = getStat(characterData.costituzione);
    const intelligenza = getStat(characterData.intelligenza);
    const destrezza = getStat(characterData.destrezza);
    const fortuna = getStat(characterData.fortuna);

    setText("master-character-name", characterData.nome || "Avventuriero");
    setText("master-character-level", "Livello " + (Number(characterData.livello) || 1));

    const token = document.getElementById("master-character-token");
    if (token) {
        token.src = "immagini/token/" + (characterData.token || "token_1.png");
        token.alt = "Token di " + (characterData.nome || "personaggio");
    }

    setText("master-forza", forza);
    setText("master-resistenza", resistenza);
    setText("master-costituzione", costituzione);
    setText("master-intelligenza", intelligenza);
    setText("master-destrezza", destrezza);
    setText("master-fortuna", fortuna);

    const attack = Math.ceil(forza / 2);
    const defense = Math.ceil(7 + resistenza / 2);
    const life = Math.ceil(5 * costituzione / 2);
    const mana = Math.ceil(5 * intelligenza / 2);
    const movement = Math.ceil(4 + destrezza / 2);
    const critical = Math.min(50, Math.ceil(fortuna * (50 / 30)));

    setText("master-attack", attack);
    setText("master-defense", defense);
    setText("master-life", life);
    setText("master-mana", mana);
    setText("master-movement", movement);
    setText("master-critical", `${critical}%`);

    const currentHp = characterData.current_hp === null || characterData.current_hp === undefined
        ? life
        : Number(characterData.current_hp);
    const currentPm = characterData.current_pm === null || characterData.current_pm === undefined
        ? mana
        : Number(characterData.current_pm);

    setText("master-character-current-hp", `${currentHp} / ${life}`);
    setText("master-character-current-pm", `${currentPm} / ${mana}`);
    setText("master-character-score", Number(characterData.score) || 0);
    setText(
        "master-character-monkey-finger",
        characterData.has_monkey_finger ? "☝ SÌ" : "NO"
    );
    setText("master-character-online-status", characterData.online ? "● ONLINE" : "○ OFFLINE");

    const fingerBox = document
        .getElementById("master-character-monkey-finger")
        ?.closest(".master-runtime-box");

    if (fingerBox) {
        fingerBox.classList.toggle(
            "has-monkey-finger",
            !!characterData.has_monkey_finger
        );
    }

    setText(
        "master-character-position",
        `X ${Number(characterData.dungeon_x) || 0} • Y ${Number(characterData.dungeon_y) || 0}`
    );

    const combatBox = document.getElementById("master-character-combat-box");
    const observeButton = document.getElementById("master-character-observe-combat");

    if (characterData.active_combat_id) {
        const session = activeMasterCombats.get(characterData.active_combat_id);
        setText(
            "master-character-combat-label",
            session?.encounter_id
                ? `${session.encounter_id} · Round ${Number(session.round_number) || 1}`
                : characterData.active_combat_id
        );

        if (combatBox) combatBox.hidden = false;

        if (observeButton) {
            observeButton.onclick = () => openMasterCombat(characterData.active_combat_id);
        }
    } else {
        if (combatBox) combatBox.hidden = true;
        if (observeButton) observeButton.onclick = null;
    }
}

window.addEventListener("beforeunload", () => {
    if (masterDashboardRefreshTimer) {
        clearInterval(masterDashboardRefreshTimer);
        masterDashboardRefreshTimer = null;
    }
});


// ============================================================
// DASHBOARD MASTER v9
// PIANO 1 / LIVELLO BASE + COOLDOWN BOSS / COMBAT BASE
// ============================================================

let masterViewFloor = "dungeon";
let masterFloorSwitchInProgress = false;

const MASTER_BASE_CHANNEL_NAME =
    "palazzo-eterno-base";

const MASTER_BASE_CHAT_FLOOR_ID =
    "base";

const MASTER_DUNGEON_CHAT_FLOOR_ID =
    "floor_1";

const MASTER_BASE_MAP_COLUMNS =
    27;

const MASTER_BASE_MAP_ROWS =
    36;

const MASTER_BASE_COMBAT_EVENTS = [
    {
        id: "BASE_C1_LEFT",
        x: 8,
        y: 7,
        encounter_id: "base_combat_left",
        state_key: "left",
        label: "COMBAT BASE SINISTRO"
    },
    {
        id: "BASE_C1_RIGHT",
        x: 10,
        y: 7,
        encounter_id: "base_combat_right",
        state_key: "right",
        label: "COMBAT BASE DESTRO"
    }
];

let masterBossState = {
    available: true,
    cooldown_until: null
};

let masterBaseCombatStates = {
    left: {
        available: true,
        cooldown_until: null,
        remaining_seconds: 0
    },
    right: {
        available: true,
        cooldown_until: null,
        remaining_seconds: 0
    }
};

let masterCooldownCountdownTimer = null;


// ============================================================
// CONFIGURAZIONE PIANO
// ============================================================

function getMasterFloorConfig() {

    if (masterViewFloor === "base") {

        return {
            key: "base",
            title: "PALAZZO ETERNO - LIVELLO BASE",
            columns: MASTER_BASE_MAP_COLUMNS,
            rows: MASTER_BASE_MAP_ROWS,
            image: "base/immagini/base_map.png",
            imageAlt: "Mappa completa del Livello Base",
            channel: MASTER_BASE_CHANNEL_NAME,
            chatFloorId: MASTER_BASE_CHAT_FLOOR_ID,
            chatEvent: "base-chat",
            message: "Modalità Master connessa al Livello Base."
        };

    }


    return {
        key: "dungeon",
        title: "PALAZZO ETERNO - PIANO 1",
        columns: MAP_COLUMNS,
        rows: MAP_ROWS,
        image: "immagini/dungeon-test.png?v=2",
        imageAlt: "Mappa completa del dungeon",
        channel: DUNGEON_CHANNEL_NAME,
        chatFloorId: MASTER_DUNGEON_CHAT_FLOOR_ID,
        chatEvent: "floor-chat",
        message: "Modalità Master connessa al Piano 1."
    };

}


function getMasterMapColumns() {

    return getMasterFloorConfig().columns;

}


function getMasterMapRows() {

    return getMasterFloorConfig().rows;

}


function getMasterChatFloorId() {

    return getMasterFloorConfig().chatFloorId;

}


function getMasterChatBroadcastEvent() {

    return getMasterFloorConfig().chatEvent;

}


// ============================================================
// SELETTORE PIANO
// ============================================================

function setupMasterFloorSelector() {

    document
        .querySelectorAll(
            "[data-master-floor]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const floor =
                            button.dataset.masterFloor;


                        if (
                            !floor ||
                            floor === masterViewFloor ||
                            masterFloorSwitchInProgress
                        ) {

                            return;

                        }


                        await switchMasterFloor(
                            floor
                        );

                    }
                );

            }
        );


    updateMasterFloorInterface();

}


async function switchMasterFloor(
    floor
) {

    if (
        ![
            "dungeon",
            "base"
        ].includes(floor)
    ) {

        return;

    }


    masterFloorSwitchInProgress =
        true;


    try {

        setMasterChatConnected(
            false
        );


        realtimeReady =
            false;


        if (dungeonChannel) {

            try {

                await db.removeChannel(
                    dungeonChannel
                );

            } catch (error) {

                console.warn(
                    "Errore chiusura canale Master:",
                    error
                );

            }


            dungeonChannel =
                null;

        }


        masterViewFloor =
            floor;


        onlinePlayers.clear();


        allMasterPlayers.clear();


        playerTokens.forEach(
            token => token?.remove()
        );


        playerTokens.clear();


        renderedMasterChatMessageIds.clear();


        const chat =
            document.getElementById(
                "master-chat-messages"
            );


        if (chat) {

            chat.innerHTML =
                `
                    <div class="master-chat-empty">
                        Caricamento messaggi...
                    </div>
                `;

        }


        updateMasterFloorInterface();


        await loadActiveMasterCombats();


        await Promise.all([
            loadMasterCooldownStates(),
            loadAllMasterCharacters(),
            loadMasterChatHistory()
        ]);


        renderMasterEvents();


        await setupRealtime();


    } catch (error) {

        console.error(
            "Errore cambio piano Master:",
            error
        );


        showMessage(
            "Impossibile cambiare piano."
        );


    } finally {

        masterFloorSwitchInProgress =
            false;

    }

}


function updateMasterFloorInterface() {

    const config =
        getMasterFloorConfig();


    const title =
        document.getElementById(
            "master-floor-title"
        );


    if (title) {

        title.textContent =
            config.title;

    }


    document
        .querySelectorAll(
            "[data-master-floor]"
        )
        .forEach(
            button => {

                const active =
                    button.dataset.masterFloor ===
                    masterViewFloor;


                button.classList.toggle(
                    "is-active",
                    active
                );


                button.setAttribute(
                    "aria-pressed",
                    active
                        ? "true"
                        : "false"
                );

            }
        );


    const image =
        document.getElementById(
            "master-map-image"
        );


    if (image) {

        image.src =
            config.image;

        image.alt =
            config.imageAlt;

    }


    const map =
        document.getElementById(
            "master-map"
        );


    map?.classList.toggle(
        "is-base-view",
        masterViewFloor ===
            "base"
    );


    const dungeonOnlyLegendIds = [
        "master-legend-boss",
        "master-legend-pvp",
        "master-legend-vendor",
        "master-legend-trap",
        "master-legend-event"
    ];


    dungeonOnlyLegendIds.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.hidden =
                    masterViewFloor ===
                    "base";

            }

        }
    );


    showMessage(
        masterViewFloor === "base"
            ? "Visualizzazione Livello Base."
            : "Visualizzazione Piano 1."
    );

}


// ============================================================
// COOLDOWN
// ============================================================

async function loadMasterCooldownStates() {

    const jobs = [];


    jobs.push(
        (
            async () => {

                try {

                    const {
                        data,
                        error
                    } =
                        await db.rpc(
                            "get_goblin_boss_state"
                        );


                    if (error) {

                        throw error;

                    }


                    masterBossState = {
                        available:
                            data?.available !==
                            false,

                        cooldown_until:
                            data?.cooldown_until ||
                            null
                    };


                } catch (error) {

                    console.error(
                        "Errore cooldown Boss Master:",
                        error
                    );

                }

            }
        )()
    );


    jobs.push(
        (
            async () => {

                try {

                    const {
                        data,
                        error
                    } =
                        await db.rpc(
                            "get_base_combat_states"
                        );


                    if (error) {

                        throw error;

                    }


                    masterBaseCombatStates = {
                        left: {
                            available:
                                data?.left?.available !==
                                false,

                            cooldown_until:
                                data?.left?.cooldown_until ||
                                null,

                            remaining_seconds:
                                Number(
                                    data?.left?.remaining_seconds
                                ) || 0
                        },

                        right: {
                            available:
                                data?.right?.available !==
                                false,

                            cooldown_until:
                                data?.right?.cooldown_until ||
                                null,

                            remaining_seconds:
                                Number(
                                    data?.right?.remaining_seconds
                                ) || 0
                        }
                    };


                } catch (error) {

                    console.error(
                        "Errore cooldown combat Base Master:",
                        error
                    );

                }

            }
        )()
    );


    await Promise.all(
        jobs
    );


    renderMasterEvents();


    startMasterCooldownCountdown();

}


function startMasterCooldownCountdown() {

    if (
        masterCooldownCountdownTimer
    ) {

        clearInterval(
            masterCooldownCountdownTimer
        );

    }


    masterCooldownCountdownTimer =
        setInterval(
            () => {

                updateMasterCombatCooldownCountdowns();

            },
            1000
        );

}


function formatMasterCooldown(
    cooldownUntil
) {

    if (!cooldownUntil) {

        return "";

    }


    const end =
        new Date(
            cooldownUntil
        ).getTime();


    if (
        !Number.isFinite(
            end
        )
    ) {

        return "";

    }


    const seconds =
        Math.ceil(
            Math.max(
                0,
                end -
                Date.now()
            ) /
            1000
        );


    if (
        seconds <=
        0
    ) {

        return "";

    }


    const hours =
        Math.floor(
            seconds /
            3600
        );


    const minutes =
        Math.floor(
            (
                seconds %
                3600
            ) /
            60
        );


    const remainingSeconds =
        seconds %
        60;


    return hours >
        0

        ? `${hours}:${String(
            minutes
        ).padStart(
            2,
            "0"
        )}:${String(
            remainingSeconds
        ).padStart(
            2,
            "0"
        )}`

        : `${minutes}:${String(
            remainingSeconds
        ).padStart(
            2,
            "0"
        )}`;

}


function updateMasterCombatCooldownCountdowns() {

    document
        .querySelectorAll(
            ".master-event-marker[data-cooldown-until]"
        )
        .forEach(
            marker => {

                const countdown =
                    marker.querySelector(
                        ".master-event-countdown"
                    );


                const value =
                    formatMasterCooldown(
                        marker.dataset.cooldownUntil
                    );


                if (countdown) {

                    countdown.textContent =
                        value;

                }


                if (!value) {

                    marker.classList.remove(
                        "is-cooldown"
                    );


                    marker.classList.add(
                        "is-available"
                    );

                }

            }
        );

}


// ============================================================
// CHAT DINAMICA
// ============================================================

async function loadMasterChatHistory() {

    const container =
        document.getElementById(
            "master-chat-messages"
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
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .eq(
                    "floor_id",
                    getMasterChatFloorId()
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            false
                    }
                )
                .limit(
                    MASTER_CHAT_HISTORY_LIMIT
                );


        if (error) {

            throw error;

        }


        renderedMasterChatMessageIds.clear();


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
                    <div class="master-chat-empty">
                        Nessun messaggio ancora.
                    </div>
                `;


            return;

        }


        rows.forEach(
            row => {

                appendMasterChatMessage(
                    {
                        id:
                            row.id,

                        character_id:
                            row.character_id,

                        master_user_id:
                            row.character_id === null
                                ? row.user_id
                                : null,

                        name:
                            row.sender_name,

                        text:
                            row.message_text,

                        timestamp:
                            row.created_at,

                        sent_at:
                            row.created_at
                    },
                    row.sender_name ===
                        "MASTER"
                );

            }
        );


    } catch (error) {

        console.error(
            "Errore storico chat Master:",
            error
        );

    }

}


async function sendMasterChatMessage() {

    const input =
        document.getElementById(
            "master-chat-input"
        );


    const feedback =
        document.getElementById(
            "master-chat-feedback"
        );


    if (
        !input ||
        !currentUser
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


    const originalValue =
        input.value;


    input.value =
        "";


    if (feedback) {

        feedback.textContent =
            "";

    }


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
                        getMasterChatFloorId(),

                    character_id:
                        null,

                    user_id:
                        currentUser.id,

                    sender_name:
                        "MASTER",

                    message_text:
                        text
                })
                .select(`
                    id,
                    character_id,
                    user_id,
                    sender_name,
                    message_text,
                    created_at
                `)
                .single();


        if (error) {

            throw error;

        }


        const payload = {
            id:
                savedMessage.id,

            character_id:
                null,

            master_user_id:
                savedMessage.user_id ||
                currentUser.id,

            name:
                "MASTER",

            nome:
                "MASTER",

            text:
                savedMessage.message_text ||
                text,

            timestamp:
                savedMessage.created_at,

            sent_at:
                savedMessage.created_at
        };


        appendMasterChatMessage(
            payload,
            true
        );


        await dungeonChannel.send({
            type:
                "broadcast",

            event:
                getMasterChatBroadcastEvent(),

            payload
        });


    } catch (error) {

        console.error(
            "Errore invio chat Master:",
            error
        );


        input.value =
            originalValue;


        if (feedback) {

            feedback.textContent =
                "Messaggio non inviato.";

        }

    }

}


// ============================================================
// REALTIME DINAMICO
// ============================================================

async function setupRealtime() {

    const config =
        getMasterFloorConfig();


    showMessage(
        masterViewFloor === "base"
            ? "Connessione al Livello Base..."
            : "Connessione al dungeon..."
    );


    dungeonChannel =
        db.channel(
            config.channel
        );


    dungeonChannel.on(
        "presence",
        {
            event:
                "sync"
        },
        () => {

            syncPresencePlayers();

        }
    );


    dungeonChannel.on(
        "broadcast",
        {
            event:
                config.chatEvent
        },
        message => {

            const data =
                message.payload;


            if (!data) {

                return;

            }


            appendMasterChatMessage(
                data,
                data.name === "MASTER" ||
                data.nome === "MASTER" ||
                data.sender_name === "MASTER"
            );

        }
    );


    // Il Piano 1 invia player-move/player-state.
    // La Base mantiene comunque Presence aggiornata ad ogni passo.
    if (
        masterViewFloor ===
        "dungeon"
    ) {

        [
            "player-move",
            "player-state"
        ].forEach(
            eventName => {

                dungeonChannel.on(
                    "broadcast",
                    {
                        event:
                            eventName
                    },
                    message => {

                        const data =
                            message.payload;


                        if (
                            !data ||
                            !data.character_id
                        ) {

                            return;

                        }


                        updatePlayer(
                            data
                        );

                    }
                );

            }
        );

    }


    await new Promise(
        resolve => {

            dungeonChannel.subscribe(
                status => {

                    console.log(
                        `Realtime Master ${masterViewFloor}:`,
                        status
                    );


                    if (
                        status ===
                        "SUBSCRIBED"
                    ) {

                        realtimeReady =
                            true;


                        setMasterChatConnected(
                            true
                        );


                        syncPresencePlayers();


                        showMessage(
                            config.message
                        );


                        resolve();

                    }


                    if (
                        status === "CHANNEL_ERROR" ||
                        status === "TIMED_OUT" ||
                        status === "CLOSED"
                    ) {

                        realtimeReady =
                            false;


                        setMasterChatConnected(
                            false
                        );


                        resolve();

                    }

                }
            );

        }
    );

}


// ============================================================
// PRESENCE DINAMICA
// ============================================================

function syncPresencePlayers() {

    if (!dungeonChannel) {

        return;

    }


    const state =
        dungeonChannel
            .presenceState();


    const currentIds =
        new Set();


    Object.values(
        state
    ).forEach(
        presences => {

            presences.forEach(
                presence => {

                    if (
                        !presence?.character_id
                    ) {

                        return;

                    }


                    currentIds.add(
                        presence.character_id
                    );


                    onlinePlayers.set(
                        presence.character_id,
                        {
                            ...presence,

                            nome:
                                presence.nome ||
                                presence.name ||
                                "Avventuriero"
                        }
                    );


                    const existing =
                        allMasterPlayers.get(
                            presence.character_id
                        );


                    if (existing) {

                        allMasterPlayers.set(
                            presence.character_id,
                            {
                                ...existing,

                                nome:
                                    presence.nome ||
                                    presence.name ||
                                    existing.nome,

                                token:
                                    presence.token ||
                                    existing.token,

                                x:
                                    Number.isFinite(
                                        Number(
                                            presence.x
                                        )
                                    )
                                        ? Number(
                                            presence.x
                                        )
                                        : existing.x,

                                y:
                                    Number.isFinite(
                                        Number(
                                            presence.y
                                        )
                                    )
                                        ? Number(
                                            presence.y
                                        )
                                        : existing.y,

                                current_hp:
                                    presence.current_hp !==
                                    undefined
                                        ? presence.current_hp
                                        : existing.current_hp,

                                active_combat_id:
                                    presence.active_combat_id !==
                                    undefined
                                        ? presence.active_combat_id
                                        : existing.active_combat_id,

                                online:
                                    true
                            }
                        );

                    }

                }
            );

        }
    );


    for (
        const characterId
        of Array.from(
            onlinePlayers.keys()
        )
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            onlinePlayers.delete(
                characterId
            );


            const existing =
                allMasterPlayers.get(
                    characterId
                );


            if (existing) {

                allMasterPlayers.set(
                    characterId,
                    {
                        ...existing,
                        online:
                            false
                    }
                );

            }

        }

    }


    renderAllTokens();

    updatePlayerList();

    updateOnlineCounter();

    renderActiveMasterCombats();

}


// ============================================================
// PG DEL PIANO SELEZIONATO
// ============================================================

function isMasterCharacterOnSelectedFloor(
    characterData
) {

    const location =
        characterData?.current_location ||
        "dungeon";


    if (
        location ===
        "base"
    ) {

        return masterViewFloor ===
            "base";

    }


    if (
        location ===
        "combat" &&
        characterData?.active_combat_id
    ) {

        const session =
            activeMasterCombats.get(
                characterData.active_combat_id
            );


        const isBaseCombat =
            String(
                session?.encounter_id ||
                ""
            ).startsWith(
                "base_"
            );


        return masterViewFloor ===
            (
                isBaseCombat
                    ? "base"
                    : "dungeon"
            );

    }


    // vendor/PvP/dungeon appartengono al Piano 1.
    return masterViewFloor ===
        "dungeon";

}


async function loadAllMasterCharacters() {

    const {
        data,
        error
    } =
        await db
            .from(
                "characters"
            )
            .select(`
                id,
                user_id,
                nome,
                livello,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                current_hp,
                current_pm,
                dungeon_x,
                dungeon_y,
                base_x,
                base_y,
                current_location,
                active_combat_id
            `);


    if (error) {

        console.error(
            "Errore caricamento PG Master:",
            error
        );


        return;

    }


    const rows =
        (
            data ||
            []
        ).filter(
            isMasterCharacterOnSelectedFloor
        );


    const characterIds =
        rows.map(
            characterData =>
                characterData.id
        );


    await loadMasterCharacterExtras(
        characterIds
    );


    const currentIds =
        new Set();


    allMasterPlayers.clear();


    rows.forEach(
        characterData => {

            currentIds.add(
                characterData.id
            );


            const presence =
                onlinePlayers.get(
                    characterData.id
                );


            const storedX =
                masterViewFloor === "base"
                    ? Number(
                        characterData.base_x
                    )
                    : Number(
                        characterData.dungeon_x
                    );


            const storedY =
                masterViewFloor === "base"
                    ? Number(
                        characterData.base_y
                    )
                    : Number(
                        characterData.dungeon_y
                    );


            const x =
                presence &&
                Number.isFinite(
                    Number(
                        presence.x
                    )
                )

                    ? Number(
                        presence.x
                    )

                    : storedX;


            const y =
                presence &&
                Number.isFinite(
                    Number(
                        presence.y
                    )
                )

                    ? Number(
                        presence.y
                    )

                    : storedY;


            allMasterPlayers.set(
                characterData.id,
                {
                    ...characterData,

                    character_id:
                        characterData.id,

                    nome:
                        presence?.nome ||
                        presence?.name ||
                        characterData.nome ||
                        "Avventuriero",

                    token:
                        presence?.token ||
                        characterData.token ||
                        "token_1.png",

                    x:
                        Number.isFinite(
                            x
                        )
                            ? x
                            : 0,

                    y:
                        Number.isFinite(
                            y
                        )
                            ? y
                            : 0,

                    current_hp:
                        presence?.current_hp !==
                        undefined
                            ? presence.current_hp
                            : characterData.current_hp,

                    active_combat_id:
                        presence?.active_combat_id !==
                        undefined
                            ? presence.active_combat_id
                            : characterData.active_combat_id ||
                              null,

                    score:
                        masterPlayerScores.get(
                            characterData.id
                        ) ??
                        0,

                    has_monkey_finger:
                        masterMonkeyFingerOwners.has(
                            characterData.id
                        ),

                    online:
                        onlinePlayers.has(
                            characterData.id
                        )
                }
            );

        }
    );


    for (
        const [
            characterId,
            token
        ]
        of Array.from(
            playerTokens.entries()
        )
    ) {

        if (
            !currentIds.has(
                characterId
            )
        ) {

            token?.remove();

            playerTokens.delete(
                characterId
            );

        }

    }


    renderAllTokens();

    updatePlayerList();

    updateOnlineCounter();

    renderMasterMonkeyFingerStatus();

}


// ============================================================
// TOKEN CON GRIGLIA DINAMICA
// ============================================================

function renderPlayerToken(
    characterId
) {

    const player =
        allMasterPlayers.get(
            characterId
        );


    if (!player) {

        const old =
            playerTokens.get(
                characterId
            );


        old?.remove();

        playerTokens.delete(
            characterId
        );


        return;

    }


    const image =
        document.getElementById(
            "master-map-image"
        );


    const container =
        document.getElementById(
            "master-map"
        );


    if (
        !image ||
        !container
    ) {

        return;

    }


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        container.getBoundingClientRect();


    if (
        mapRect.width <=
            0 ||
        mapRect.height <=
            0
    ) {

        return;

    }


    const cellWidth =
        mapRect.width /
        getMasterMapColumns();


    const cellHeight =
        mapRect.height /
        getMasterMapRows();


    let token =
        playerTokens.get(
            characterId
        );


    if (!token) {

        token =
            document.createElement(
                "img"
            );


        token.className =
            "master-player-token";


        token.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                openCharacterSheet(
                    characterId
                );

            }
        );


        container.appendChild(
            token
        );


        playerTokens.set(
            characterId,
            token
        );

    }


    token.src =
        "immagini/token/" +
        (
            player.token ||
            "token_1.png"
        );


    token.alt =
        "Token di " +
        (
            player.nome ||
            "Avventuriero"
        );


    token.title =
        `${player.nome || "Avventuriero"}` +
        `${player.online ? " · ONLINE" : " · OFFLINE"}` +
        `${player.active_combat_id ? " · IN COMBATTIMENTO" : ""}`;


    token.classList.toggle(
        "is-online",
        !!player.online
    );


    token.classList.toggle(
        "is-offline",
        !player.online
    );


    token.classList.toggle(
        "is-in-combat",
        !!player.active_combat_id
    );


    const tokenSize =
        Math.min(
            cellWidth,
            cellHeight
        ) *
        0.92;


    token.style.width =
        `${tokenSize}px`;


    token.style.height =
        `${tokenSize}px`;


    const x =
        Number.isFinite(
            Number(
                player.x
            )
        )
            ? Number(
                player.x
            )
            : 0;


    const y =
        Number.isFinite(
            Number(
                player.y
            )
        )
            ? Number(
                player.y
            )
            : 0;


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
        `${offsetX + centerX - tokenSize / 2}px`;


    token.style.top =
        `${offsetY + centerY - tokenSize / 2}px`;

}


// ============================================================
// EVENTI MAPPA DINAMICI
// ============================================================

function renderMasterEvents() {

    const image =
        document.getElementById(
            "master-map-image"
        );


    const container =
        document.getElementById(
            "master-map"
        );


    if (
        !image ||
        !container
    ) {

        return;

    }


    container
        .querySelectorAll(
            ".master-event-marker"
        )
        .forEach(
            marker =>
                marker.remove()
        );


    const mapRect =
        image.getBoundingClientRect();


    const containerRect =
        container.getBoundingClientRect();


    if (
        mapRect.width <=
            0 ||
        mapRect.height <=
            0
    ) {

        return;

    }


    const cellWidth =
        mapRect.width /
        getMasterMapColumns();


    const cellHeight =
        mapRect.height /
        getMasterMapRows();


    const offsetX =
        mapRect.left -
        containerRect.left;


    const offsetY =
        mapRect.top -
        containerRect.top;


    const placeMarker =
        (
            x,
            y,
            marker
        ) => {

            const markerSize =
                Math.min(
                    cellWidth,
                    cellHeight
                ) *
                0.72;


            marker.style.width =
                `${markerSize}px`;


            marker.style.height =
                `${markerSize}px`;


            marker.style.left =
                `${
                    offsetX +
                    (
                        x +
                        0.5
                    ) *
                    cellWidth -
                    markerSize /
                    2
                }px`;


            marker.style.top =
                `${
                    offsetY +
                    (
                        y +
                        0.5
                    ) *
                    cellHeight -
                    markerSize /
                    2
                }px`;


            container.appendChild(
                marker
            );

        };


    if (
        masterViewFloor ===
        "base"
    ) {

        MASTER_BASE_COMBAT_EVENTS.forEach(
            combatEvent => {

                const state =
                    masterBaseCombatStates[
                        combatEvent.state_key
                    ] ||
                    {
                        available:
                            true,
                        cooldown_until:
                            null
                    };


                const marker =
                    document.createElement(
                        "div"
                    );


                marker.className =
                    "master-event-marker is-base-combat";


                marker.dataset.eventId =
                    combatEvent.id;


                marker.textContent =
                    "⚔";


                const activeCombat =
                    getActiveCombatForEncounter(
                        combatEvent.encounter_id
                    );


                if (activeCombat) {

                    marker.classList.add(
                        "has-live-combat"
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "COMBATTIMENTO IN CORSO\nClicca per osservare";


                    marker.addEventListener(
                        "click",
                        event => {

                            event.stopPropagation();

                            openMasterCombat(
                                activeCombat.id
                            );

                        }
                    );


                } else if (
                    state.available !==
                    false
                ) {

                    marker.classList.add(
                        "is-available"
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "DISPONIBILE";


                } else {

                    marker.classList.add(
                        "is-cooldown"
                    );


                    marker.dataset.cooldownUntil =
                        state.cooldown_until ||
                        "";


                    const countdown =
                        document.createElement(
                            "span"
                        );


                    countdown.className =
                        "master-event-countdown";


                    countdown.textContent =
                        formatMasterCooldown(
                            state.cooldown_until
                        );


                    marker.appendChild(
                        countdown
                    );


                    marker.title =
                        `${combatEvent.label}\n` +
                        `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                        "IN COOLDOWN";

                }


                placeMarker(
                    combatEvent.x,
                    combatEvent.y,
                    marker
                );

            }
        );


        return;

    }


    // --------------------------------------------------------
    // EVENTI PIANO 1
    // --------------------------------------------------------

    Object.entries(
        MASTER_DUNGEON_EVENTS
    ).forEach(
        ([
            coordinateKey,
            dungeonEvent
        ]) => {

            const [
                x,
                y
            ] =
                coordinateKey
                    .split(",")
                    .map(Number);


            const marker =
                document.createElement(
                    "div"
                );


            marker.className =
                "master-event-marker";


            marker.dataset.eventId =
                dungeonEvent.id;


            marker.dataset.eventType =
                dungeonEvent.type;


            if (
                dungeonEvent.type ===
                "communication"
            ) {

                marker.classList.add(
                    "is-communication"
                );


                marker.textContent =
                    "◆";


                marker.title =
                    `EVENTO\nX ${x} • Y ${y}\n${dungeonEvent.message}`;

            }


            if (
                dungeonEvent.type ===
                "trap"
            ) {

                marker.classList.add(
                    "is-trap"
                );


                const icon =
                    document.createElement(
                        "span"
                    );


                icon.className =
                    "master-event-icon";


                icon.textContent =
                    "⚠";


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                marker.append(
                    icon,
                    countdown
                );


                updateSingleMasterTrapMarker(
                    marker,
                    dungeonEvent,
                    x,
                    y
                );

            }


            placeMarker(
                x,
                y,
                marker
            );

        }
    );


    MASTER_COMBAT_EVENTS.forEach(
        combatEvent => {

            const marker =
                document.createElement(
                    "div"
                );


            const isBoss =
                combatEvent.type ===
                "boss";


            marker.className =
                "master-event-marker is-combat" +
                (
                    isBoss
                        ? " is-boss"
                        : ""
                );


            marker.dataset.eventId =
                combatEvent.id;


            marker.dataset.eventType =
                isBoss
                    ? "boss"
                    : "combat";


            marker.textContent =
                isBoss
                    ? "👹"
                    : "⚔";


            const liveCombat =
                getActiveCombatForEncounter(
                    combatEvent.encounter_id
                );


            if (liveCombat) {

                marker.classList.add(
                    "has-live-combat"
                );


                marker.title =
                    `${
                        isBoss
                            ? "BOSS IN CORSO"
                            : "COMBATTIMENTO IN CORSO"
                    }\n` +
                    `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}\n` +
                    "Clicca per osservare";


                marker.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();


                        openMasterCombat(
                            liveCombat.id
                        );

                    }
                );


            } else if (
                isBoss &&
                masterBossState.available ===
                false
            ) {

                marker.classList.add(
                    "is-cooldown"
                );


                marker.dataset.cooldownUntil =
                    masterBossState.cooldown_until ||
                    "";


                const countdown =
                    document.createElement(
                        "span"
                    );


                countdown.className =
                    "master-event-countdown";


                countdown.textContent =
                    formatMasterCooldown(
                        masterBossState.cooldown_until
                    );


                marker.appendChild(
                    countdown
                );


                marker.title =
                    `GOBLIN BOSS IN COOLDOWN\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}`;


            } else {

                marker.classList.add(
                    "is-available"
                );


                marker.title =
                    `${
                        isBoss
                            ? "GOBLIN BOSS"
                            : "EVENTO COMBAT"
                    }\n` +
                    `${combatEvent.id} · ${combatEvent.encounter_id}\n` +
                    `X ${combatEvent.x} • Y ${combatEvent.y}`;

            }


            placeMarker(
                combatEvent.x,
                combatEvent.y,
                marker
            );

        }
    );


    MASTER_SPECIAL_EVENTS.forEach(
        specialEvent => {

            const marker =
                document.createElement(
                    "div"
                );


            marker.className =
                `master-event-marker is-special is-${specialEvent.type}`;


            marker.dataset.eventId =
                specialEvent.id;


            marker.dataset.eventType =
                specialEvent.type;


            marker.textContent =
                specialEvent.type ===
                "pvp"
                    ? "⚔"
                    : "🐒";


            marker.title =
                `${specialEvent.label}\n` +
                `X ${specialEvent.x} • Y ${specialEvent.y}`;


            placeMarker(
                specialEvent.x,
                specialEvent.y,
                marker
            );

        }
    );

}


// ============================================================
// SCHEDA PG: COORDINATE DEL PIANO SELEZIONATO
// ============================================================

async function openCharacterSheet(
    characterId
) {

    const modal =
        document.getElementById(
            "master-character-modal"
        );


    if (!modal) {

        return;

    }


    showMessage(
        "Caricamento scheda..."
    );


    const {
        data,
        error
    } =
        await db
            .from(
                "characters"
            )
            .select(`
                id,
                nome,
                livello,
                token,
                forza,
                resistenza,
                costituzione,
                intelligenza,
                destrezza,
                fortuna,
                current_hp,
                current_pm,
                dungeon_x,
                dungeon_y,
                base_x,
                base_y,
                current_location,
                active_combat_id
            `)
            .eq(
                "id",
                characterId
            )
            .single();


    if (error) {

        console.error(
            "Errore caricamento scheda:",
            error
        );


        showMessage(
            "Impossibile caricare la scheda."
        );


        return;

    }


    const cached =
        allMasterPlayers.get(
            characterId
        );


    fillCharacterSheet({
        ...data,

        online:
            !!cached?.online,

        active_combat_id:
            cached?.active_combat_id ||
            data.active_combat_id ||
            null,

        score:
            cached?.score ??
            masterPlayerScores.get(
                characterId
            ) ??
            0,

        has_monkey_finger:
            cached?.has_monkey_finger ??
            masterMonkeyFingerOwners.has(
                characterId
            ),

        master_display_x:
            cached?.x ??
            (
                masterViewFloor === "base"
                    ? data.base_x
                    : data.dungeon_x
            ),

        master_display_y:
            cached?.y ??
            (
                masterViewFloor === "base"
                    ? data.base_y
                    : data.dungeon_y
            )
    });


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";


    showMessage(
        ""
    );

}


function fillCharacterSheet(
    characterData
) {

    const forza =
        getStat(
            characterData.forza
        );


    const resistenza =
        getStat(
            characterData.resistenza
        );


    const costituzione =
        getStat(
            characterData.costituzione
        );


    const intelligenza =
        getStat(
            characterData.intelligenza
        );


    const destrezza =
        getStat(
            characterData.destrezza
        );


    const fortuna =
        getStat(
            characterData.fortuna
        );


    setText(
        "master-character-name",
        characterData.nome ||
        "Avventuriero"
    );


    setText(
        "master-character-level",
        "Livello " +
        (
            Number(
                characterData.livello
            ) ||
            1
        )
    );


    const token =
        document.getElementById(
            "master-character-token"
        );


    if (token) {

        token.src =
            "immagini/token/" +
            (
                characterData.token ||
                "token_1.png"
            );


        token.alt =
            "Token di " +
            (
                characterData.nome ||
                "personaggio"
            );

    }


    setText(
        "master-forza",
        forza
    );

    setText(
        "master-resistenza",
        resistenza
    );

    setText(
        "master-costituzione",
        costituzione
    );

    setText(
        "master-intelligenza",
        intelligenza
    );

    setText(
        "master-destrezza",
        destrezza
    );

    setText(
        "master-fortuna",
        fortuna
    );


    const attack =
        Math.ceil(
            forza /
            2
        );


    const defense =
        Math.ceil(
            7 +
            resistenza /
            2
        );


    const life =
        Math.ceil(
            5 *
            costituzione /
            2
        );


    const mana =
        Math.ceil(
            5 *
            intelligenza /
            2
        );


    const movement =
        Math.ceil(
            4 +
            destrezza /
            2
        );


    const critical =
        Math.min(
            50,
            Math.ceil(
                fortuna *
                (
                    50 /
                    30
                )
            )
        );


    setText(
        "master-attack",
        attack
    );

    setText(
        "master-defense",
        defense
    );

    setText(
        "master-life",
        life
    );

    setText(
        "master-mana",
        mana
    );

    setText(
        "master-movement",
        movement
    );

    setText(
        "master-critical",
        `${critical}%`
    );


    const currentHp =
        characterData.current_hp === null ||
        characterData.current_hp === undefined

            ? life

            : Number(
                characterData.current_hp
            );


    const currentPm =
        characterData.current_pm === null ||
        characterData.current_pm === undefined

            ? mana

            : Number(
                characterData.current_pm
            );


    setText(
        "master-character-current-hp",
        `${currentHp} / ${life}`
    );


    setText(
        "master-character-current-pm",
        `${currentPm} / ${mana}`
    );


    setText(
        "master-character-score",
        Number(
            characterData.score
        ) ||
        0
    );


    setText(
        "master-character-monkey-finger",
        characterData.has_monkey_finger
            ? "☝ SÌ"
            : "NO"
    );


    setText(
        "master-character-online-status",
        characterData.online
            ? "● ONLINE"
            : "○ OFFLINE"
    );


    const fingerBox =
        document
            .getElementById(
                "master-character-monkey-finger"
            )
            ?.closest(
                ".master-runtime-box"
            );


    if (fingerBox) {

        fingerBox.classList.toggle(
            "has-monkey-finger",
            !!characterData.has_monkey_finger
        );

    }


    setText(
        "master-character-position",
        `X ${
            Number(
                characterData.master_display_x
            ) ||
            0
        } • Y ${
            Number(
                characterData.master_display_y
            ) ||
            0
        }`
    );


    const combatBox =
        document.getElementById(
            "master-character-combat-box"
        );


    const observeButton =
        document.getElementById(
            "master-character-observe-combat"
        );


    if (
        characterData.active_combat_id
    ) {

        const session =
            activeMasterCombats.get(
                characterData.active_combat_id
            );


        setText(
            "master-character-combat-label",
            session?.encounter_id
                ? `${session.encounter_id} · Round ${Number(session.round_number) || 1}`
                : characterData.active_combat_id
        );


        if (combatBox) {

            combatBox.hidden =
                false;

        }


        if (observeButton) {

            observeButton.onclick =
                () =>
                    openMasterCombat(
                        characterData.active_combat_id
                    );

        }


    } else {

        if (combatBox) {

            combatBox.hidden =
                true;

        }


        if (observeButton) {

            observeButton.onclick =
                null;

        }

    }

}


// ============================================================
// REFRESH DASHBOARD DINAMICO
// ============================================================

function startMasterDashboardRefresh() {

    if (
        masterDashboardRefreshTimer
    ) {

        clearInterval(
            masterDashboardRefreshTimer
        );

    }


    masterDashboardRefreshTimer =
        setInterval(
            async () => {

                await loadActiveMasterCombats();


                await Promise.all([
                    loadAllMasterCharacters(),
                    loadMasterBossPassword(),
                    loadMasterCooldownStates()
                ]);

            },
            4000
        );

}


// ============================================================
// RIDIMENSIONAMENTO v9
// ============================================================

window.addEventListener(
    "resize",
    () => {

        renderAllTokens();

        renderMasterEvents();

    }
);


// ============================================================
// CLEANUP v9
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (
            masterCooldownCountdownTimer
        ) {

            clearInterval(
                masterCooldownCountdownTimer
            );


            masterCooldownCountdownTimer =
                null;

        }

    }
);


// ============================================================
// CENTRO DI CONTROLLO MASTER v12
// Bacheca + riepilogo operativo + servizi/vendor
// ============================================================

const MASTER_NOTICEBOARD_SECTIONS = ["novita", "upgrade", "avvisi"];
const MASTER_UNIQUE_ITEMS = [
    { item_id: "dito_scimmia", label: "Dito di Scimmia" }
];

let masterControlServices = [];
let masterControlUniqueState = [];

window.addEventListener("DOMContentLoaded", () => {
    setupMasterControlCenter();
});

function setupMasterControlCenter() {
    const modal = document.getElementById("master-control-center");
    const open = document.getElementById("master-control-center-button");
    const close = document.getElementById("master-control-center-close");
    const refresh = document.getElementById("master-control-refresh");
    const saveNoticeboard = document.getElementById("master-noticeboard-save");

    if (!modal || !open) return;

    const closeModal = () => {
        modal.hidden = true;
        document.body.style.overflow = "";
    };

    open.addEventListener("click", async () => {
        modal.hidden = false;
        document.body.style.overflow = "hidden";
        await loadMasterControlCenter();
    });

    close?.addEventListener("click", closeModal);
    modal.querySelectorAll("[data-close-control-center]").forEach(el => el.addEventListener("click", closeModal));
    refresh?.addEventListener("click", loadMasterControlCenter);
    saveNoticeboard?.addEventListener("click", saveMasterNoticeboard);

    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.addEventListener("click", () => setMasterControlTab(button.dataset.masterControlTab));
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !modal.hidden) closeModal();
    });
}

function setMasterControlTab(tab) {
    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.classList.toggle("is-active", button.dataset.masterControlTab === tab);
    });
    document.querySelectorAll("[data-master-control-pane]").forEach(pane => {
        pane.classList.toggle("is-active", pane.dataset.masterControlPane === tab);
    });
}

async function loadMasterControlCenter() {
    const button = document.getElementById("master-control-refresh");
    if (button) button.disabled = true;

    try {
        // Prima aggiorna le sorgenti già usate dalla dashboard.
        await loadActiveMasterCombats();
        await Promise.all([
            loadAllMasterCharacters(),
            loadMasterBossPassword(),
            loadMasterCooldownStates(),
            loadMasterTrapStates(),
            loadMasterControlServices(),
            loadMasterUniqueItems(),
            loadMasterNoticeboardEditor()
        ]);
        renderMasterControlOverview();
        renderMasterControlPlayers();
        renderMasterControlServices();
        renderMasterControlUniqueItems();
        renderMasterControlCombats();
        renderMasterControlCooldowns();
        syncMasterControlBossPassword();
    } catch (error) {
        console.error("Errore Centro di Controllo Master:", error);
    } finally {
        if (button) button.disabled = false;
    }
}

async function loadMasterControlServices() {
    const { data, error } = await db
        .from("base_services")
        .select("*")
        .order("display_name", { ascending: true });

    if (error) {
        console.error("Errore servizi Master:", error);
        masterControlServices = [];
        return;
    }
    masterControlServices = Array.isArray(data) ? data : [];
}

async function loadMasterUniqueItems() {
    const ids = MASTER_UNIQUE_ITEMS.map(item => item.item_id);
    const { data, error } = await db
        .from("character_inventory")
        .select("character_id, item_id, quantity")
        .in("item_id", ids);

    if (error) {
        console.error("Errore oggetti unici Master:", error);
        masterControlUniqueState = [];
        return;
    }

    masterControlUniqueState = MASTER_UNIQUE_ITEMS.map(definition => {
        const holdings = (data || []).filter(row =>
            row.item_id === definition.item_id && (Number(row.quantity) || 0) > 0
        );
        const owners = holdings.map(row => ({
            character_id: row.character_id,
            quantity: Number(row.quantity) || 0,
            name: allMasterPlayers.get(row.character_id)?.nome || row.character_id
        }));
        return { ...definition, available: owners.length === 0, owners };
    });
}

function renderMasterControlOverview() {
    const players = Array.from(allMasterPlayers.values());
    const online = players.filter(p => p.online).length;
    const combats = Array.from(activeMasterCombats.values());
    const uniqueOwned = masterControlUniqueState.filter(item => !item.available).length;

    setText("master-control-player-count", String(players.length));
    setText("master-control-player-detail", `${online} online · ${players.length - online} offline`);
    setText("master-control-combat-count", String(combats.length));
    setText("master-control-combat-detail", combats.length ? "Sessioni waiting / active" : "Nessun combattimento in corso");

    const bossCooldown = masterBossState.available === false;
    setText("master-control-boss-state", bossCooldown ? "COOLDOWN" : "DISPONIBILE");
    setText("master-control-boss-detail", bossCooldown ? (formatMasterCooldown(masterBossState.cooldown_until) || "Cooldown attivo") : "Goblin Boss affrontabile");

    setText("master-control-unique-count", `${uniqueOwned}/${MASTER_UNIQUE_ITEMS.length}`);
    setText("master-control-unique-detail", uniqueOwned ? "Oggetti attualmente posseduti" : "Tutti disponibili");
}

function renderMasterControlPlayers() {
    const container = document.getElementById("master-control-players");
    if (!container) return;
    const players = Array.from(allMasterPlayers.values()).sort((a,b) => String(a.nome||"").localeCompare(String(b.nome||""), "it"));
    container.innerHTML = "";
    if (!players.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun personaggio nel piano selezionato.</div>';
        return;
    }
    players.forEach(player => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "master-control-row";
        const info = document.createElement("div");
        info.className = "master-control-row-main";
        const title = document.createElement("strong");
        title.textContent = player.nome || "Avventuriero";
        const meta = document.createElement("small");
        meta.textContent = `LV ${Number(player.livello)||1} · SCORE ${Number(player.score)||0} · X ${Number(player.x)||0} Y ${Number(player.y)||0}${player.active_combat_id ? " · COMBAT" : ""}`;
        const state = document.createElement("span");
        state.className = `master-control-state ${player.online ? "master-control-good" : ""}`;
        state.textContent = player.online ? "ONLINE" : "OFFLINE";
        info.append(title, meta); row.append(info, state);
        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        container.appendChild(row);
    });
}

function renderMasterControlServices() {
    const container = document.getElementById("master-control-services");
    if (!container) return;
    container.innerHTML = "";
    if (!masterControlServices.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun servizio trovato in base_services.</div>';
        return;
    }
    masterControlServices.forEach(service => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = service.display_name || service.service_key || "Servizio";
        const meta = document.createElement("small");
        const parts = [`LV ${Number(service.current_level)||1}`];
        if (service.maintenance_seconds != null) parts.push(`manutenzione ${service.maintenance_seconds}s`);
        if (service.construction_seconds != null) parts.push(`costruzione ${service.construction_seconds}s`);
        meta.textContent = parts.join(" · ");
        const state = document.createElement("span"); state.className = "master-control-state";
        state.textContent = String(service.status || "SCONOSCIUTO").toUpperCase();
        const normalized = String(service.status || "").toLowerCase();
        if (normalized === "active") state.classList.add("master-control-good");
        if (normalized === "building" || normalized === "maintenance") state.classList.add("master-control-warn");
        info.append(title, meta); row.append(info, state); container.appendChild(row);
    });
}

function renderMasterControlUniqueItems() {
    const container = document.getElementById("master-control-unique-items");
    if (!container) return;
    container.innerHTML = "";
    masterControlUniqueState.forEach(item => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = item.label;
        const meta = document.createElement("small");
        meta.textContent = item.available ? "Nessun personaggio lo possiede." : item.owners.map(owner => `${owner.name}${owner.quantity > 1 ? ` ×${owner.quantity}` : ""}`).join(", ");
        const state = document.createElement("span"); state.className = `master-control-state ${item.available ? "master-control-good" : "master-control-warn"}`;
        state.textContent = item.available ? "DISPONIBILE" : "IN POSSESSO";
        info.append(title, meta); row.append(info, state); container.appendChild(row);
    });
}

function renderMasterControlCombats() {
    const container = document.getElementById("master-control-combats");
    if (!container) return;
    const combats = Array.from(activeMasterCombats.values());
    container.innerHTML = "";
    if (!combats.length) { container.innerHTML = '<div class="master-control-empty">Nessun combattimento attivo.</div>'; return; }
    combats.forEach(combat => {
        const row = document.createElement("div"); row.className = "master-control-row";
        const info = document.createElement("div"); info.className = "master-control-row-main";
        const title = document.createElement("strong"); title.textContent = String(combat.encounter_id || "COMBAT").toUpperCase();
        const participants = Array.from(allMasterPlayers.values()).filter(p => p.active_combat_id === combat.id).map(p => p.nome);
        const meta = document.createElement("small"); meta.textContent = `${combat.status || "active"} · Round ${Number(combat.round_number)||1}${participants.length ? ` · ${participants.join(", ")}` : ""}`;
        const watch = document.createElement("button"); watch.type="button"; watch.className="button master-combat-watch"; watch.textContent="OSSERVA"; watch.addEventListener("click",()=>openMasterCombat(combat.id));
        info.append(title,meta); row.append(info,watch); container.appendChild(row);
    });
}

function renderMasterControlCooldowns() {
    const container = document.getElementById("master-control-cooldowns");
    if (!container) return;
    const items = [];
    items.push({ label:"Goblin Boss", available: masterBossState.available !== false, until: masterBossState.cooldown_until });
    for (const event of MASTER_BASE_COMBAT_EVENTS) {
        const state = masterBaseCombatStates[event.state_key] || {};
        items.push({ label:event.label, available: state.available !== false, until: state.cooldown_until });
    }
    Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coords,event]) => {
        if (event.type !== "trap") return;
        const state = masterTrapStates.get(event.id);
        items.push({ label:`Trappola ${event.id} · ${coords}`, available: !isMasterTrapCooldownActive(state), until: state?.disabled_until });
    });
    container.innerHTML="";
    items.forEach(item=>{
        const row=document.createElement("div"); row.className="master-control-row";
        const info=document.createElement("div"); info.className="master-control-row-main";
        const title=document.createElement("strong"); title.textContent=item.label;
        const meta=document.createElement("small"); meta.textContent=item.available ? "Pronto / disponibile" : `Fine: ${formatMasterDateTime(item.until)}`;
        const state=document.createElement("span"); state.className=`master-control-state ${item.available ? "master-control-good" : "master-control-warn"}`;
        state.textContent=item.available ? "PRONTO" : (formatMasterCooldown(item.until)||"COOLDOWN");
        info.append(title,meta); row.append(info,state); container.appendChild(row);
    });
}

function syncMasterControlBossPassword() {
    const password = document.getElementById("master-boss-password")?.textContent || "-";
    const expiry = document.getElementById("master-boss-password-expiry")?.textContent || "";
    setText("master-control-boss-password", password);
    setText("master-control-boss-password-expiry", expiry);
}

function formatMasterDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("it-IT", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

async function loadMasterNoticeboardEditor() {
    const feedback = document.getElementById("master-noticeboard-feedback");
    const { data, error } = await db
        .from("noticeboard_entries")
        .select("id, section, content, sort_order, active")
        .eq("active", true)
        .order("sort_order", { ascending: true });

    if (error) {
        console.error("Errore caricamento bacheca Master:", error);
        if (feedback) feedback.textContent = "Bacheca non disponibile: esegui prima lo SQL incluso nel pacchetto.";
        return;
    }

    MASTER_NOTICEBOARD_SECTIONS.forEach(section => {
        const textarea = document.getElementById(`master-noticeboard-${section}`);
        if (!textarea) return;
        textarea.value = (data || []).filter(row => row.section === section).map(row => row.content).join("\n");
    });
    if (feedback) feedback.textContent = "";
}

async function saveMasterNoticeboard() {
    const button = document.getElementById("master-noticeboard-save");
    const feedback = document.getElementById("master-noticeboard-feedback");
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "Salvataggio...";

    try {
        const rows = [];
        MASTER_NOTICEBOARD_SECTIONS.forEach(section => {
            const value = document.getElementById(`master-noticeboard-${section}`)?.value || "";
            value.split(/\r?\n/).map(v => v.trim()).filter(Boolean).forEach((content, index) => {
                rows.push({ section, content, sort_order:index, active:true });
            });
        });

        const { error: deleteError } = await db.from("noticeboard_entries").delete().in("section", MASTER_NOTICEBOARD_SECTIONS);
        if (deleteError) throw deleteError;
        if (rows.length) {
            const { error: insertError } = await db.from("noticeboard_entries").insert(rows);
            if (insertError) throw insertError;
        }

        if (feedback) feedback.textContent = "Bacheca aggiornata. Le tre pagine leggeranno questi contenuti al prossimo caricamento.";
    } catch (error) {
        console.error("Errore salvataggio bacheca:", error);
        if (feedback) feedback.textContent = `Errore: ${error.message || "salvataggio non riuscito"}`;
    } finally {
        if (button) button.disabled = false;
    }
}


// ============================================================
// CENTRO DI CONTROLLO MASTER v13 - FIX OPERATIVI
// - roster globale indipendente dal piano visualizzato
// - refresh con feedback visibile
// - cooldown di TUTTI i combat noti
// - diagnostica base_services / RLS
// ============================================================

let masterControlAllPlayers = [];
let masterControlServicesError = null;
let masterControlRegularCombatStates = new Map();

function setMasterControlRefreshStatus(text, type = "") {
    const element = document.getElementById("master-control-refresh-status");
    if (!element) return;
    element.textContent = text || "";
    element.classList.toggle("is-ok", type === "ok");
    element.classList.toggle("is-error", type === "error");
}

async function loadMasterControlAllPlayers() {
    const { data, error } = await db
        .from("characters")
        .select(`
            id,
            user_id,
            nome,
            livello,
            token,
            forza,
            resistenza,
            costituzione,
            intelligenza,
            destrezza,
            fortuna,
            current_hp,
            current_pm,
            dungeon_x,
            dungeon_y,
            base_x,
            base_y,
            current_location,
            active_combat_id
        `)
        .order("nome", { ascending: true });

    if (error) {
        console.error("Errore roster globale Master:", error);
        masterControlAllPlayers = [];
        throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    const ids = rows.map(row => row.id).filter(Boolean);

    const scoreMap = new Map();
    await Promise.all(ids.map(async characterId => {
        try {
            const { data: score, error: scoreError } = await db.rpc(
                "get_character_final_score",
                { p_character_id: characterId }
            );
            if (scoreError) throw scoreError;
            scoreMap.set(characterId, Number(score) || 0);
        } catch (error) {
            console.warn("Score non disponibile nel roster Master:", characterId, error);
            scoreMap.set(characterId, 0);
        }
    }));

    masterControlAllPlayers = rows.map(character => {
        const presence = onlinePlayers.get(character.id);
        const cached = allMasterPlayers.get(character.id);
        return {
            ...character,
            character_id: character.id,
            nome: presence?.nome || presence?.name || character.nome || "Avventuriero",
            token: presence?.token || character.token || "token_1.png",
            online: onlinePlayers.has(character.id),
            score: scoreMap.get(character.id) || 0,
            x: character.current_location === "base"
                ? Number(character.base_x) || 0
                : Number(character.dungeon_x) || 0,
            y: character.current_location === "base"
                ? Number(character.base_y) || 0
                : Number(character.dungeon_y) || 0,
            active_combat_id: presence?.active_combat_id ?? cached?.active_combat_id ?? character.active_combat_id ?? null
        };
    });
}

async function loadMasterControlServices() {
    masterControlServicesError = null;

    const { data, error } = await db
        .from("base_services")
        .select("*")
        .order("service_key", { ascending: true });

    if (error) {
        console.error("Errore servizi Master:", error);
        masterControlServices = [];
        masterControlServicesError = error;
        return;
    }

    masterControlServices = Array.isArray(data) ? data : [];
}

async function loadMasterControlRegularCombatCooldowns() {
    const encounterIds = MASTER_COMBAT_EVENTS
        .filter(event => event.type !== "boss")
        .map(event => event.encounter_id);

    masterControlRegularCombatStates.clear();

    try {
        const { data, error } = await db
            .from("combat_sessions")
            .select("*")
            .in("encounter_id", encounterIds);

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;

        for (const encounterId of encounterIds) {
            const sessions = rows
                .filter(row => row.encounter_id === encounterId)
                .sort((a, b) => getMasterCombatSessionTimestamp(b) - getMasterCombatSessionTimestamp(a));

            const active = sessions.find(row => ["waiting", "active"].includes(String(row.status || "").toLowerCase()));
            if (active) {
                masterControlRegularCombatStates.set(encounterId, {
                    state: "active",
                    available: false,
                    active: true,
                    until: null,
                    source: active
                });
                continue;
            }

            const latest = sessions[0] || null;
            if (!latest) {
                masterControlRegularCombatStates.set(encounterId, {
                    state: "ready",
                    available: true,
                    active: false,
                    until: null
                });
                continue;
            }

            let until = latest.cooldown_until || latest.disabled_until || null;
            if (!until) {
                const finishedAt = getMasterCombatSessionTimestamp(latest);
                if (finishedAt > 0) until = new Date(finishedAt + fiveMinutes).toISOString();
            }

            const untilMs = until ? new Date(until).getTime() : 0;
            const cooldown = Number.isFinite(untilMs) && untilMs > now;

            masterControlRegularCombatStates.set(encounterId, {
                state: cooldown ? "cooldown" : "ready",
                available: !cooldown,
                active: false,
                until: cooldown ? until : null,
                source: latest
            });
        }
    } catch (error) {
        console.error("Errore cooldown combat Piano 1 Master:", error);
        for (const encounterId of encounterIds) {
            masterControlRegularCombatStates.set(encounterId, {
                state: "unknown",
                available: null,
                active: false,
                until: null,
                error
            });
        }
    }
}

function getMasterCombatSessionTimestamp(row) {
    if (!row) return 0;
    const candidates = [
        row.cooldown_started_at,
        row.completed_at,
        row.ended_at,
        row.finished_at,
        row.updated_at,
        row.created_at
    ];
    for (const value of candidates) {
        if (!value) continue;
        const time = new Date(value).getTime();
        if (Number.isFinite(time)) return time;
    }
    return 0;
}

async function loadMasterControlCenter() {
    const button = document.getElementById("master-control-refresh");
    if (button) button.disabled = true;
    setMasterControlRefreshStatus("Aggiornamento in corso…");

    try {
        await loadActiveMasterCombats();

        await Promise.all([
            loadAllMasterCharacters(),
            loadMasterControlAllPlayers(),
            loadMasterBossPassword(),
            loadMasterCooldownStates(),
            loadMasterTrapStates(),
            loadMasterControlRegularCombatCooldowns(),
            loadMasterControlServices(),
            loadMasterUniqueItems(),
            loadMasterNoticeboardEditor()
        ]);

        // Ricarica gli oggetti unici dopo il roster globale, così i nomi dei possessori
        // possono essere risolti anche se il PG è su un altro piano.
        await loadMasterUniqueItems();

        renderMasterControlOverview();
        renderMasterControlPlayers();
        renderMasterControlServices();
        renderMasterControlUniqueItems();
        renderMasterControlCombats();
        renderMasterControlCooldowns();
        syncMasterControlBossPassword();

        setMasterControlRefreshStatus(
            `Aggiornato alle ${new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
            "ok"
        );
    } catch (error) {
        console.error("Errore Centro di Controllo Master:", error);
        setMasterControlRefreshStatus(
            `Aggiornamento incompleto: ${error?.message || "errore sconosciuto"}`,
            "error"
        );
    } finally {
        if (button) button.disabled = false;
    }
}

async function loadMasterUniqueItems() {
    const ids = MASTER_UNIQUE_ITEMS.map(item => item.item_id);
    const { data, error } = await db
        .from("character_inventory")
        .select("character_id, item_id, quantity")
        .in("item_id", ids);

    if (error) {
        console.error("Errore oggetti unici Master:", error);
        masterControlUniqueState = [];
        return;
    }

    const globalPlayers = new Map(masterControlAllPlayers.map(player => [player.character_id, player]));

    masterControlUniqueState = MASTER_UNIQUE_ITEMS.map(definition => {
        const holdings = (data || []).filter(row =>
            row.item_id === definition.item_id && (Number(row.quantity) || 0) > 0
        );
        const owners = holdings.map(row => ({
            character_id: row.character_id,
            quantity: Number(row.quantity) || 0,
            name: globalPlayers.get(row.character_id)?.nome || allMasterPlayers.get(row.character_id)?.nome || row.character_id
        }));
        return { ...definition, available: owners.length === 0, owners };
    });
}

function renderMasterControlOverview() {
    const players = masterControlAllPlayers;
    const online = players.filter(p => p.online).length;
    const combats = Array.from(activeMasterCombats.values());
    const uniqueOwned = masterControlUniqueState.filter(item => !item.available).length;

    setText("master-control-player-count", String(players.length));
    setText("master-control-player-detail", `${online} online · ${players.length - online} offline`);
    setText("master-control-combat-count", String(combats.length));
    setText("master-control-combat-detail", combats.length ? "Sessioni waiting / active" : "Nessun combattimento in corso");

    const bossCooldown = masterBossState.available === false;
    setText("master-control-boss-state", bossCooldown ? "COOLDOWN" : "DISPONIBILE");
    setText("master-control-boss-detail", bossCooldown ? (formatMasterCooldown(masterBossState.cooldown_until) || "Cooldown attivo") : "Goblin Boss affrontabile");

    setText("master-control-unique-count", `${uniqueOwned}/${MASTER_UNIQUE_ITEMS.length}`);
    setText("master-control-unique-detail", uniqueOwned ? "Oggetti attualmente posseduti" : "Tutti disponibili");
}

function renderMasterControlPlayers() {
    const container = document.getElementById("master-control-players");
    if (!container) return;

    const players = [...masterControlAllPlayers].sort((a,b) => String(a.nome||"").localeCompare(String(b.nome||""), "it"));
    container.innerHTML = "";

    if (!players.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun personaggio trovato nel database.</div>';
        return;
    }

    players.forEach(player => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "master-control-row";

        const info = document.createElement("div");
        info.className = "master-control-row-main";

        const title = document.createElement("strong");
        title.textContent = player.nome || "Avventuriero";

        const meta = document.createElement("small");
        const location = String(player.current_location || "dungeon").toUpperCase();
        meta.textContent = `LV ${Number(player.livello)||1} · SCORE ${Number(player.score)||0} · ${location} · X ${Number(player.x)||0} Y ${Number(player.y)||0}${player.active_combat_id ? " · COMBAT" : ""}`;

        const state = document.createElement("span");
        state.className = `master-control-state ${player.online ? "master-control-good" : ""}`;
        state.textContent = player.online ? "ONLINE" : "OFFLINE";

        info.append(title, meta);
        row.append(info, state);
        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        container.appendChild(row);
    });
}

function renderMasterControlServices() {
    const container = document.getElementById("master-control-services");
    if (!container) return;
    container.innerHTML = "";

    if (masterControlServicesError) {
        container.innerHTML = `<div class="master-control-empty is-error">Impossibile leggere base_services: ${String(masterControlServicesError.message || masterControlServicesError)}. Esegui la patch SQL inclusa nello ZIP per consentire la lettura al ruolo Master.</div>`;
        return;
    }

    if (!masterControlServices.length) {
        container.innerHTML = '<div class="master-control-empty">base_services è leggibile ma non restituisce righe. Se i servizi esistono nel DB, controlla le policy RLS con la patch SQL inclusa.</div>';
        return;
    }

    masterControlServices.forEach(service => {
        const row = document.createElement("div");
        row.className = "master-control-row";
        const info = document.createElement("div");
        info.className = "master-control-row-main";
        const title = document.createElement("strong");
        title.textContent = service.display_name || service.service_key || service.id || "Servizio";
        const meta = document.createElement("small");
        const parts = [];
        if (service.current_level != null) parts.push(`LV ${Number(service.current_level)||1}`);
        if (service.maintenance_seconds != null) parts.push(`manutenzione ${service.maintenance_seconds}s`);
        if (service.construction_seconds != null) parts.push(`costruzione ${service.construction_seconds}s`);
        if (service.build_started_at) parts.push(`inizio ${formatMasterDateTime(service.build_started_at)}`);
        if (service.maintenance_started_at) parts.push(`manut. ${formatMasterDateTime(service.maintenance_started_at)}`);
        meta.textContent = parts.join(" · ") || "Dati servizio disponibili";
        const state = document.createElement("span");
        state.className = "master-control-state";
        state.textContent = String(service.status || "SCONOSCIUTO").toUpperCase();
        const normalized = String(service.status || "").toLowerCase();
        if (normalized === "active") state.classList.add("master-control-good");
        if (["building", "maintenance", "unbuilt"].includes(normalized)) state.classList.add("master-control-warn");
        info.append(title, meta);
        row.append(info, state);
        container.appendChild(row);
    });
}

function renderMasterControlCooldowns() {
    const container = document.getElementById("master-control-cooldowns");
    if (!container) return;

    const items = [];

    // Tutti i combattimenti standard del Piano 1.
    for (const event of MASTER_COMBAT_EVENTS.filter(entry => entry.type !== "boss")) {
        const current = masterControlRegularCombatStates.get(event.encounter_id) || {};
        items.push({
            label: `${event.id} · ${event.encounter_id}`,
            available: current.available,
            active: current.active,
            until: current.until,
            unknown: current.state === "unknown"
        });
    }

    // Boss con RPC dedicata.
    items.push({
        label: "Goblin Boss",
        available: masterBossState.available !== false,
        active: !!getActiveCombatForEncounter("combat_boss"),
        until: masterBossState.cooldown_until
    });

    // Combat della Base.
    for (const event of MASTER_BASE_COMBAT_EVENTS) {
        const state = masterBaseCombatStates[event.state_key] || {};
        items.push({
            label: event.label,
            available: state.available !== false,
            active: !!getActiveCombatForEncounter(event.encounter_id),
            until: state.cooldown_until
        });
    }

    // Trappole, tenute nello stesso pannello perché sono cooldown operativi.
    Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coords,event]) => {
        if (event.type !== "trap") return;
        const state = masterTrapStates.get(event.id);
        items.push({
            label: `Trappola ${event.id} · ${coords}`,
            available: !isMasterTrapCooldownActive(state),
            active: false,
            until: state?.disabled_until
        });
    });

    container.innerHTML = "";

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "master-control-row";

        const info = document.createElement("div");
        info.className = "master-control-row-main";

        const title = document.createElement("strong");
        title.textContent = item.label;

        const meta = document.createElement("small");
        if (item.active) meta.textContent = "Combattimento attualmente in corso";
        else if (item.unknown) meta.textContent = "Stato cooldown non leggibile da combat_sessions";
        else if (item.available) meta.textContent = "Pronto / disponibile";
        else meta.textContent = `Fine: ${formatMasterDateTime(item.until)}`;

        const state = document.createElement("span");
        if (item.active) {
            state.className = "master-control-state master-control-warn";
            state.textContent = "IN CORSO";
        } else if (item.unknown) {
            state.className = "master-control-state";
            state.textContent = "N/D";
        } else {
            state.className = `master-control-state ${item.available ? "master-control-good" : "master-control-warn"}`;
            state.textContent = item.available ? "PRONTO" : (formatMasterCooldown(item.until) || "COOLDOWN");
        }

        info.append(title, meta);
        row.append(info, state);
        container.appendChild(row);
    });
}

// ============================================================
// MASTER v14 — LAYOUT A TRE COLONNE, PRESENZE GLOBALI,
// CHAT UNIFICATA BASE/PIANO 1
// Overrides mirati delle funzioni delle versioni precedenti:
// nessuna RPC amministrativa esistente viene rimossa.
// ============================================================

const masterFloorChannels = new Map();
const masterFloorConnected = new Map();
let masterRosterExtrasLastLoaded = 0;
let masterGlobalLoadBusy = false;

const MASTER_PAGE_SECTIONS = {
    overview: ["PANORAMICA", "Stato operativo generale del gioco."],
    players: ["GIOCATORI", "Elenco di tutti i personaggi del Palazzo."],
    services: ["VENDOR / SERVIZI", "Servizi e costruzioni del Livello Base."],
    combats: ["COMBATTIMENTI", "Combattimenti attivi su entrambi i piani."],
    events: ["EVENTI / SEGRETI", "Mappe, eventi, trappole e incontri."],
    bacheca: ["BACHECA", "Gestione delle comunicazioni pubbliche ai giocatori."]
};

function setupMasterControlCenter() {
    const refresh = document.getElementById("master-control-refresh");
    const save = document.getElementById("master-noticeboard-save");
    refresh?.addEventListener("click", loadMasterControlCenter);
    save?.addEventListener("click", saveMasterNoticeboard);

    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.addEventListener("click", () => setMasterControlTab(button.dataset.masterControlTab));
    });
    const image = document.getElementById("master-map-image");
    image?.addEventListener("load", () => {
        if (document.querySelector('[data-master-control-pane="events"]')?.classList.contains("is-active")) {
            requestAnimationFrame(() => { renderAllTokens(); renderMasterEvents(); });
        }
    });
    setMasterControlTab("overview");
}

function setMasterControlTab(tab) {
    if (!MASTER_PAGE_SECTIONS[tab]) return;
    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        const active = button.dataset.masterControlTab === tab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll("[data-master-control-pane]").forEach(pane => {
        pane.classList.toggle("is-active", pane.dataset.masterControlPane === tab);
    });
    setText("master-control-center-title", MASTER_PAGE_SECTIONS[tab][0]);
    setText("master-panel-description", MASTER_PAGE_SECTIONS[tab][1]);
    document.querySelector(".master-control-body")?.scrollTo(0, 0);
    if (tab === "events") {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            renderAllTokens();
            renderMasterEvents();
        }));
    }
    if (tab === "combats") {
        renderActiveMasterCombats();
        renderMasterControlCombats();
    }
}

function getMasterCharacterFloor(character) {
    const location = String(character?.current_location || "dungeon").toLowerCase();
    if (location === "base") return "base";
    if (location === "combat" && character?.active_combat_id) {
        const session = activeMasterCombats.get(character.active_combat_id);
        if (String(session?.encounter_id || "").startsWith("base_")) return "base";
    }
    return "dungeon";
}

function masterFloorDisplayName(floor) {
    return floor === "base" ? "Base" : "Piano 1";
}

function masterGetPresence(characterId) {
    return onlinePlayers.get(characterId) || null;
}

function updateMasterSelectedFloorPlayers() {
    const selected = new Set();
    allMasterPlayers.clear();
    masterControlAllPlayers.forEach(character => {
        if (getMasterCharacterFloor(character) !== masterViewFloor) return;
        selected.add(character.character_id);
        allMasterPlayers.set(character.character_id, character);
    });
    for (const [id, token] of Array.from(playerTokens.entries())) {
        if (!selected.has(id)) {
            token?.remove();
            playerTokens.delete(id);
        }
    }
    renderAllTokens();
}

function masterBuildCharacter(row) {
    const presence = masterGetPresence(row.id);
    const floor = getMasterCharacterFloor(row);
    const xStored = floor === "base" ? row.base_x : row.dungeon_x;
    const yStored = floor === "base" ? row.base_y : row.dungeon_y;
    const canUsePresence = !!presence && presence.master_floor === floor;
    const x = canUsePresence && Number.isFinite(Number(presence.x))
        ? Number(presence.x) : Number(xStored);
    const y = canUsePresence && Number.isFinite(Number(presence.y))
        ? Number(presence.y) : Number(yStored);
    return {
        ...row,
        character_id: row.id,
        nome: presence?.nome || presence?.name || row.nome || "Avventuriero",
        token: presence?.token || row.token || "token_1.png",
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        floor,
        online: !!presence,
        score: masterPlayerScores.get(row.id) ?? 0,
        has_monkey_finger: masterMonkeyFingerOwners.has(row.id),
        current_hp: presence?.current_hp ?? row.current_hp,
        active_combat_id: row.active_combat_id || presence?.active_combat_id || null
    };
}

async function loadAllMasterCharacters() {
    if (masterGlobalLoadBusy) return;
    masterGlobalLoadBusy = true;
    try {
        const { data, error } = await db.from("characters").select(`
            id, user_id, nome, livello, token,
            forza, resistenza, costituzione, intelligenza, destrezza, fortuna,
            current_hp, current_pm, dungeon_x, dungeon_y, base_x, base_y,
            current_location, active_combat_id
        `);
        if (error) throw error;
        const rows = Array.isArray(data) ? data : [];
        // Rilevamento score / Dito di Scimmia ogni 30s, non a ogni refresh da 4s.
        if (Date.now() - masterRosterExtrasLastLoaded > 30000) {
            await loadMasterCharacterExtras(rows.map(row => row.id));
            masterRosterExtrasLastLoaded = Date.now();
        }
        masterControlAllPlayers = rows.map(masterBuildCharacter);
        updateMasterSelectedFloorPlayers();
        updatePlayerList();
        updateOnlineCounter();
        renderMasterMonkeyFingerStatus();
        updateMasterChatPresenceLabels();
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
            renderMasterControlOverview();
        }
    } catch (error) {
        console.error("Errore roster globale Master:", error);
        setMasterControlRefreshStatus("Impossibile leggere tutti i personaggi.", "error");
    } finally {
        masterGlobalLoadBusy = false;
    }
}

// Il roster completo ora è alimentato direttamente dalla lettura globale
// precedente, quindi evita una seconda query e N RPC score duplicate.
async function loadMasterControlAllPlayers() {
    if (masterControlAllPlayers.length === 0 && !masterGlobalLoadBusy) {
        await loadAllMasterCharacters();
    }
}

function updatePlayerList() {
    const list = document.getElementById("master-player-list");
    if (!list) return;
    list.replaceChildren();
    const players = [...masterControlAllPlayers].sort((a, b) =>
        Number(b.online) - Number(a.online) ||
        String(a.nome || "").localeCompare(String(b.nome || ""), "it")
    );
    if (!players.length) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun personaggio trovato.";
        list.appendChild(empty);
        return;
    }
    for (const player of players) {
        const row = document.createElement("div");
        row.className = "master-player-item";
        row.classList.toggle("is-offline", !player.online);
        row.classList.toggle("is-combat", !!player.active_combat_id);

        const image = document.createElement("img");
        image.src = "immagini/token/" + (player.token || "token_1.png");
        image.alt = "";
        const info = document.createElement("div");
        info.className = "master-player-info";
        const name = document.createElement("span");
        name.className = "master-player-name";
        name.textContent = player.nome || "Avventuriero";
        const position = document.createElement("span");
        position.className = "master-player-position";
        position.textContent = `${masterFloorDisplayName(player.floor)} · X ${player.x} · Y ${player.y}`;
        const statuses = document.createElement("div");
        statuses.className = "master-player-status-row";
        const badge = (text, kind) => {
            const el = document.createElement("span");
            el.className = "master-status-badge " + kind;
            el.textContent = text;
            statuses.appendChild(el);
        };
        badge(player.online ? "● ONLINE" : "○ OFFLINE", player.online ? "online" : "offline");
        badge(masterFloorDisplayName(player.floor), "floor");
        if (player.active_combat_id) badge("⚔ COMBAT", "combat");
        if (player.has_monkey_finger) badge("☝ DITO", "monkey-finger");
        const score = document.createElement("span");
        score.className = "master-player-score";
        score.textContent = `LV ${Number(player.livello) || 1} · SCORE ${Number(player.score) || 0}`;
        info.append(name, position, score, statuses);
        row.append(image, info);
        if (player.active_combat_id) {
            const watch = document.createElement("button");
            watch.type = "button";
            watch.className = "button master-inline-watch";
            watch.textContent = "OSSERVA";
            watch.addEventListener("click", event => {
                event.stopPropagation();
                openMasterCombat(player.active_combat_id);
            });
            row.appendChild(watch);
        }
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-label", `Scheda ${player.nome}, ${masterFloorDisplayName(player.floor)}`);
        row.addEventListener("click", () => openCharacterSheet(player.character_id));
        row.addEventListener("keydown", event => {
            if (event.target !== row) return;
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openCharacterSheet(player.character_id);
            }
        });
        list.appendChild(row);
    }
}

function updateOnlineCounter() {
    const total = masterControlAllPlayers.length;
    const connected = masterControlAllPlayers.filter(player => player.online).length;
    setText("master-online-count", `${connected} online · ${total - connected} offline · ${total} totali`);
}

function syncPresencePlayers() {
    onlinePlayers.clear();
    for (const [floor, channel] of masterFloorChannels) {
        let state = {};
        try { state = channel.presenceState() || {}; }
        catch (error) { console.warn("Presence Master", floor, error); }
        Object.values(state).forEach(presences => {
            (presences || []).forEach(presence => {
                if (!presence?.character_id) return;
                onlinePlayers.set(presence.character_id, {
                    ...presence, master_floor: floor,
                    nome: presence.nome || presence.name || "Avventuriero"
                });
            });
        });
    }
    masterControlAllPlayers = masterControlAllPlayers.map(character => masterBuildCharacter(character));
    updateMasterSelectedFloorPlayers();
    updatePlayerList();
    updateOnlineCounter();
    renderActiveMasterCombats();
    updateMasterChatPresenceLabels();
}

function updatePlayer(data) {
    if (!data?.character_id) return;
    const previous = onlinePlayers.get(data.character_id) || {};
    onlinePlayers.set(data.character_id, {
        ...previous, ...data, master_floor: "dungeon",
        nome: data.nome || data.name || previous.nome || "Avventuriero"
    });
    masterControlAllPlayers = masterControlAllPlayers.map(character =>
        character.character_id === data.character_id ? masterBuildCharacter(character) : character
    );
    updateMasterSelectedFloorPlayers();
    updatePlayerList();
    updateOnlineCounter();
}

async function setupRealtime() {
    const jobs = ["base", "dungeon"].map(async floor => {
        if (masterFloorChannels.has(floor)) return;
        const config = floor === "base"
            ? { channel:MASTER_BASE_CHANNEL_NAME, event:"base-chat", floorId:MASTER_BASE_CHAT_FLOOR_ID }
            : { channel:DUNGEON_CHANNEL_NAME, event:"floor-chat", floorId:MASTER_DUNGEON_CHAT_FLOOR_ID };
        const channel = db.channel(config.channel);
        masterFloorChannels.set(floor, channel);
        masterFloorConnected.set(floor, false);
        channel.on("presence", { event:"sync" }, syncPresencePlayers);
        channel.on("broadcast", { event:config.event }, message => {
            if (!message?.payload) return;
            appendMasterChatMessage({ ...message.payload, master_floor_id:config.floorId },
                message.payload.name === "MASTER" || message.payload.nome === "MASTER" || message.payload.sender_name === "MASTER");
        });
        if (floor === "dungeon") {
            ["player-move", "player-state"].forEach(eventName => {
                channel.on("broadcast", {event:eventName}, message => {
                    if (message?.payload?.character_id) updatePlayer(message.payload);
                });
            });
        }
        await new Promise(resolve => {
            channel.subscribe(status => {
                if (status === "SUBSCRIBED") {
                    masterFloorConnected.set(floor, true);
                    syncPresencePlayers();
                    resolve();
                } else if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
                    masterFloorConnected.set(floor, false);
                    syncPresencePlayers();
                    resolve();
                }
                setMasterChatConnected([...masterFloorConnected.values()].some(Boolean));
            });
        });
    });
    await Promise.all(jobs);
    dungeonChannel = masterFloorChannels.get(masterViewFloor) || null;
    realtimeReady = [...masterFloorConnected.values()].some(Boolean);
    syncPresencePlayers();
    showMessage(realtimeReady ? "Monitoraggio Base e Piano 1 attivo." : "Connessione realtime non disponibile.");
}

async function switchMasterFloor(floor) {
    if (!["base", "dungeon"].includes(floor) || masterFloorSwitchInProgress) return;
    masterFloorSwitchInProgress = true;
    try {
        masterViewFloor = floor;
        dungeonChannel = masterFloorChannels.get(floor) || null;
        updateMasterFloorInterface();
        updateMasterSelectedFloorPlayers();
        updatePlayerList();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        renderAllTokens();
        renderMasterEvents();
    } finally {
        masterFloorSwitchInProgress = false;
    }
}

function setMasterChatConnected(connected) {
    const status = document.getElementById("master-chat-status");
    const onlineFloors = ["base", "dungeon"].filter(floor => masterFloorConnected.get(floor));
    const usable = connected && onlineFloors.length > 0;
    const input = document.getElementById("master-chat-input");
    const send = document.getElementById("master-chat-send");
    if (input) input.disabled = !usable;
    if (send) send.disabled = !usable;
    if (status) {
        status.textContent = onlineFloors.length === 2
            ? "Base + Piano 1 connessi"
            : onlineFloors.length === 1
                ? `${masterFloorDisplayName(onlineFloors[0])} connesso · altro piano non disponibile`
                : "Chat scollegata";
        status.classList.toggle("is-online", usable);
    }
}

async function loadMasterChatHistory() {
    const container = document.getElementById("master-chat-messages");
    if (!container) return;
    try {
        const { data, error } = await db.from("dungeon_chat_messages")
            .select("id, floor_id, character_id, user_id, sender_name, message_text, created_at")
            .in("floor_id", [MASTER_BASE_CHAT_FLOOR_ID, MASTER_DUNGEON_CHAT_FLOOR_ID])
            .order("created_at", {ascending:false})
            .limit(MASTER_CHAT_HISTORY_LIMIT);
        if (error) throw error;
        renderedMasterChatMessageIds.clear();
        container.replaceChildren();
        for (const row of data || []) {
            appendMasterChatMessage({
                id: row.id,
                character_id: row.character_id,
                name: row.sender_name,
                text: row.message_text,
                sent_at: row.created_at,
                master_floor_id: row.floor_id
            }, row.sender_name === "MASTER");
        }
        if (!(data || []).length) {
            const empty = document.createElement("div");
            empty.className = "master-chat-empty";
            empty.textContent = "Nessun messaggio ancora.";
            container.appendChild(empty);
        }
    } catch (error) {
        console.error("Errore storico chat globale Master:", error);
        container.textContent = "Impossibile caricare i messaggi dei due piani.";
    }
}

async function sendMasterChatMessage() {
    const input = document.getElementById("master-chat-input");
    const feedback = document.getElementById("master-chat-feedback");
    const button = document.getElementById("master-chat-send");
    const text = input?.value?.trim();
    if (!text || !currentUser) return;
    const selected = document.getElementById("master-chat-destination")?.value || "both";
    const targets = selected === "both" ? ["base", "dungeon"] : [selected];
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "Invio in corso…";
    const sent = [], failed = [];
    for (const floor of targets) {
        if (!masterFloorConnected.get(floor)) {
            failed.push(masterFloorDisplayName(floor));
            continue;
        }
        const floorId = floor === "base" ? MASTER_BASE_CHAT_FLOOR_ID : MASTER_DUNGEON_CHAT_FLOOR_ID;
        try {
            const {data, error} = await db.from("dungeon_chat_messages").insert({
                floor_id: floorId, character_id:null, user_id:currentUser.id,
                sender_name:"MASTER", message_text:text
            }).select("id, character_id, user_id, sender_name, message_text, created_at").single();
            if (error) throw error;
            const payload = {
                id:data.id, character_id:null, master_user_id:currentUser.id,
                name:"MASTER", nome:"MASTER", text:data.message_text || text,
                timestamp:data.created_at, sent_at:data.created_at
            };
            appendMasterChatMessage({...payload, master_floor_id:floorId},true);
            const channel = masterFloorChannels.get(floor);
            const result = await channel.send({
                type:"broadcast", event:floor === "base" ? "base-chat" : "floor-chat", payload
            });
            if (result !== "ok" && result !== undefined) console.warn("Broadcast chat Master:",result);
            sent.push(masterFloorDisplayName(floor));
        } catch (error) {
            console.error("Errore invio chat Master:",floor,error);
            failed.push(masterFloorDisplayName(floor));
        }
    }
    if (sent.length) input.value = "";
    if (feedback) feedback.textContent = failed.length
        ? `${sent.length ? "Inviato a " + sent.join(" e ") + ". " : ""}Non inviato a ${failed.join(" e ")}.`
        : `Inviato a ${sent.join(" e ")}.`;
    if (button) button.disabled = ![...masterFloorConnected.values()].some(Boolean);
}

function appendMasterChatMessage(data, isMaster = false) {
    const container = document.getElementById("master-chat-messages");
    if (!container || !data) return;
    const id = data.id || data.message_id || null;
    if (id && renderedMasterChatMessageIds.has(String(id))) return;
    if (id) renderedMasterChatMessageIds.add(String(id));
    container.querySelector(".master-chat-empty")?.remove();
    const message = document.createElement("div");
    message.className = "master-chat-message" + (isMaster ? " is-master" : "");
    if (id) message.dataset.messageId = String(id);
    const stamp = data.sent_at || data.timestamp || data.created_at;
    message.dataset.ts = String(new Date(stamp || Date.now()).getTime() || 0);
    const authorId = data.character_id || "";
    if (authorId) message.dataset.characterId = authorId;
    const authorName = data.name || data.nome || data.sender_name || "Giocatore";
    const floorId = data.master_floor_id || data.floor_id || getMasterChatFloorId();
    const label = floorId === MASTER_BASE_CHAT_FLOOR_ID ? "Base" : "Piano 1";
    const meta = document.createElement("div");
    meta.className = "master-chat-meta";
    const name = document.createElement("strong");
    name.textContent = authorName;
    const place = document.createElement("span");
    place.className = "master-chat-location";
    place.textContent = label;
    const presence = document.createElement("span");
    presence.className = "master-chat-presence";
    if (authorId) {
        const known = masterControlAllPlayers.find(player => player.character_id === authorId);
        const active = known?.online || false;
        presence.textContent = `${active ? "● online" : "○ offline"}${known ? " · " + masterFloorDisplayName(known.floor) : ""}`;
        presence.classList.toggle("is-online", active);
    }
    const time = document.createElement("span");
    time.className = "master-chat-clock";
    time.textContent = formatChatTime(stamp);
    meta.append(name, place);
    if (authorId) meta.append(presence);
    meta.append(time);
    const body = document.createElement("div");
    body.className = "master-chat-body";
    body.textContent = String(data.text ?? data.message_text ?? "");
    message.append(meta, body);
    const timestamp = Number(message.dataset.ts);
    const later = [...container.querySelectorAll(".master-chat-message")]
        .find(entry => Number(entry.dataset.ts) < timestamp);
    if (later) container.insertBefore(message, later);
    else container.appendChild(message);
    while (container.querySelectorAll(".master-chat-message").length > MASTER_CHAT_HISTORY_LIMIT) {
        const last = container.querySelector(".master-chat-message:last-child");
        if (!last) break;
        if (last.dataset.messageId) renderedMasterChatMessageIds.delete(last.dataset.messageId);
        last.remove();
    }
    container.scrollTop = 0;
}

function updateMasterChatPresenceLabels() {
    const map = new Map(masterControlAllPlayers.map(player => [player.character_id, player]));
    document.querySelectorAll(".master-chat-message[data-character-id]").forEach(el => {
        const presence = el.querySelector(".master-chat-presence");
        if (!presence) return;
        const known = map.get(el.dataset.characterId);
        const active = !!known?.online;
        presence.textContent = `${active ? "● online" : "○ offline"}${known ? " · " + masterFloorDisplayName(known.floor) : ""}`;
        presence.classList.toggle("is-online", active);
    });
}

async function openCharacterSheet(characterId) {
    const modal = document.getElementById("master-character-modal");
    if (!modal) return;
    showMessage("Caricamento scheda...");
    const {data, error} = await db.from("characters").select(`
        id, nome, livello, token,
        forza, resistenza, costituzione, intelligenza, destrezza, fortuna,
        current_hp, current_pm, dungeon_x, dungeon_y,
        base_x, base_y, current_location, active_combat_id
    `).eq("id", characterId).single();
    if (error) {
        console.error("Errore caricamento scheda Master:",error);
        showMessage("Impossibile caricare la scheda.");
        return;
    }
    const global = masterControlAllPlayers.find(p => p.character_id === characterId);
    const floor = getMasterCharacterFloor(data);
    const x = floor === "base" ? data.base_x : data.dungeon_x;
    const y = floor === "base" ? data.base_y : data.dungeon_y;
    fillCharacterSheet({
        ...data,
        online:!!global?.online,
        active_combat_id:data.active_combat_id || global?.active_combat_id || null,
        score: global?.score ?? masterPlayerScores.get(characterId) ?? 0,
        has_monkey_finger:global?.has_monkey_finger ?? masterMonkeyFingerOwners.has(characterId),
        master_display_x:global?.x ?? x,
        master_display_y:global?.y ?? y
    });
    const position = document.getElementById("master-character-position");
    if (position) position.textContent = `${masterFloorDisplayName(floor)} · X ${Number(global?.x ?? x) || 0} • Y ${Number(global?.y ?? y) || 0}`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    showMessage("");
}

// Il roster centrale e le statistiche dell'overview usano il roster globale.
function renderMasterControlPlayers() {
    const container = document.getElementById("master-control-players");
    if (!container) return;
    container.replaceChildren();
    const players = [...masterControlAllPlayers].sort((a,b) => String(a.nome || "").localeCompare(String(b.nome || ""),"it"));
    if (!players.length) {
        const empty = document.createElement("div");
        empty.className = "master-control-empty";
        empty.textContent = "Nessun personaggio trovato nel database.";
        container.appendChild(empty);
    }
    for (const player of players) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "master-control-row";
        const info = document.createElement("div");
        info.className = "master-control-row-main";
        const name = document.createElement("strong");
        name.textContent = player.nome;
        const meta = document.createElement("small");
        meta.textContent = `LV ${Number(player.livello) || 1} · SCORE ${Number(player.score) || 0} · ${masterFloorDisplayName(player.floor)} · X ${player.x} Y ${player.y}${player.active_combat_id ? " · COMBAT" : ""}`;
        info.append(name,meta);
        const state = document.createElement("span");
        state.className = `master-control-state ${player.online ? "master-control-good" : ""}`;
        state.textContent = player.online ? "ONLINE" : "OFFLINE";
        row.append(info,state);
        row.addEventListener("click",()=>openCharacterSheet(player.character_id));
        container.appendChild(row);
    }
}

function renderMasterControlCombats() {
    const container = document.getElementById("master-control-combats");
    if (!container) return;
    container.replaceChildren();
    const combats = [...activeMasterCombats.values()];
    if (!combats.length) {
        const empty = document.createElement("div");
        empty.className = "master-control-empty";
        empty.textContent = "Nessun combattimento attivo.";
        container.appendChild(empty);
        return;
    }
    for (const combat of combats) {
        const row = document.createElement("div");
        row.className = "master-control-row";
        const info = document.createElement("div");
        info.className = "master-control-row-main";
        const title = document.createElement("strong");
        title.textContent = String(combat.encounter_id || "COMBAT").toUpperCase();
        const meta = document.createElement("small");
        const participants = masterControlAllPlayers.filter(p => p.active_combat_id === combat.id).map(p => p.nome);
        meta.textContent = `${combat.status} · Round ${Number(combat.round_number) || 1}${participants.length ? " · " + participants.join(", ") : ""}`;
        info.append(title, meta);
        const watch = document.createElement("button");
        watch.type = "button";
        watch.className = "button master-combat-watch";
        watch.textContent = "OSSERVA";
        watch.addEventListener("click", () => openMasterCombat(combat.id));
        row.append(info, watch);
        container.appendChild(row);
    }
}

window.addEventListener("beforeunload", () => {
    for (const channel of masterFloorChannels.values()) db.removeChannel(channel);
    masterFloorChannels.clear();
});

// Gli indicatori di inventario e le sessioni combat devono prendere i
// nominativi dal roster globale, non solo dal piano attualmente mostrato.
function renderMasterMonkeyFingerStatus() {
    const status = document.getElementById("master-monkey-finger-status");
    const owner = document.getElementById("master-monkey-finger-owner");
    const panel = document.querySelector(".master-monkey-finger-panel");
    if (!status) return;
    const byId = new Map(masterControlAllPlayers.map(player => [player.character_id,player]));
    const owners = [...masterMonkeyFingerOwners].map(id => byId.get(id)?.nome || `PG ${id}`).filter(Boolean);
    const available = owners.length === 0;
    status.textContent = available ? "DISPONIBILE" : "IN POSSESSO";
    if (owner) owner.textContent = available ? "Nessun PG lo possiede." : `In mano a: ${owners.join(", ")}`;
    panel?.classList.toggle("is-available", available);
    panel?.classList.toggle("is-owned", !available);
}

function renderActiveMasterCombats() {
    const list = document.getElementById("master-combat-list");
    if (!list) return;
    const combats = [...activeMasterCombats.values()].sort((a,b) =>
        String(a.encounter_id || "").localeCompare(String(b.encounter_id || "")));
    const count = combats.length;
    setText("master-combat-count",count ? `${count} combattiment${count === 1 ? "o" : "i"} attiv${count === 1 ? "o" : "i"}` : "Nessun combattimento attivo");
    list.replaceChildren();
    if (!count) {
        const empty = document.createElement("div");
        empty.className = "master-player-empty";
        empty.textContent = "Nessun combattimento in corso.";
        list.appendChild(empty);
        return;
    }
    for (const combat of combats) {
        const row = document.createElement("div");
        row.className = "master-combat-item";
        const info = document.createElement("div");
        const title = document.createElement("div");
        title.className = "master-combat-title";
        title.textContent = String(combat.encounter_id || "COMBAT").toUpperCase();
        const meta = document.createElement("div");
        meta.className = "master-combat-meta";
        const names = masterControlAllPlayers.filter(p => p.active_combat_id === combat.id).map(p => p.nome);
        meta.textContent = `${combat.status === "active" ? "IN CORSO" : "IN ATTESA"} · Round ${Number(combat.round_number) || 1}${names.length ? " · " + names.join(", ") : ""}`;
        info.append(title,meta);
        const watch = document.createElement("button");
        watch.type = "button";
        watch.className = "button master-combat-watch";
        watch.textContent = "OSSERVA";
        watch.addEventListener("click",()=>openMasterCombat(combat.id));
        row.append(info,watch);
        list.appendChild(row);
    }
}

// ============================================================
// MASTER v15 — PANORAMICA A MAPPA CON SLIDER
// ============================================================

let masterOverviewFloor = "dungeon";

const MASTER_OVERVIEW_FLOORS = ["dungeon", "base"];

const MASTER_OVERVIEW_BASE_SERVICE_POSITIONS = [
    { x: 5, y: 33 },
    { x: 9, y: 33 },
    { x: 13, y: 33 },
    { x: 17, y: 33 },
    { x: 21, y: 33 },
    { x: 7, y: 29 },
    { x: 11, y: 29 },
    { x: 15, y: 29 },
    { x: 19, y: 29 }
];

function getMasterOverviewFloorConfig() {
    if (masterOverviewFloor === "base") {
        return {
            key: "base",
            title: "LIVELLO BASE",
            index: 2,
            total: 2,
            columns: MASTER_BASE_MAP_COLUMNS,
            rows: MASTER_BASE_MAP_ROWS,
            image: "base/immagini/base_map.png",
            imageAlt: "Mappa panoramica del Livello Base"
        };
    }
    return {
        key: "dungeon",
        title: "PIANO 1",
        index: 1,
        total: 2,
        columns: MAP_COLUMNS,
        rows: MAP_ROWS,
        image: "immagini/dungeon-test.png?v=2",
        imageAlt: "Mappa panoramica del Piano 1"
    };
}

function setupMasterOverviewSlider() {
    document.getElementById("master-overview-prev")?.addEventListener("click", () => {
        changeMasterOverviewFloor(-1);
    });
    document.getElementById("master-overview-next")?.addEventListener("click", () => {
        changeMasterOverviewFloor(1);
    });
    const image = document.getElementById("master-overview-map-image");
    image?.addEventListener("load", () => {
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
            requestAnimationFrame(renderMasterOverviewMap);
        }
    });
}

function changeMasterOverviewFloor(delta) {
    const index = MASTER_OVERVIEW_FLOORS.indexOf(masterOverviewFloor);
    const next = (index + delta + MASTER_OVERVIEW_FLOORS.length) % MASTER_OVERVIEW_FLOORS.length;
    setMasterOverviewFloor(MASTER_OVERVIEW_FLOORS[next]);
}

function setMasterOverviewFloor(floor) {
    if (!MASTER_OVERVIEW_FLOORS.includes(floor)) return;
    masterOverviewFloor = floor;
    renderMasterControlOverview();
}

function setupMasterControlCenter() {
    const refresh = document.getElementById("master-control-refresh");
    const save = document.getElementById("master-noticeboard-save");
    refresh?.addEventListener("click", loadMasterControlCenter);
    save?.addEventListener("click", saveMasterNoticeboard);

    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        button.addEventListener("click", () => setMasterControlTab(button.dataset.masterControlTab));
    });

    const image = document.getElementById("master-map-image");
    image?.addEventListener("load", () => {
        if (document.querySelector('[data-master-control-pane="events"]')?.classList.contains("is-active")) {
            requestAnimationFrame(() => { renderAllTokens(); renderMasterEvents(); });
        }
    });

    setupMasterOverviewSlider();
    setMasterControlTab("overview");
}

function setMasterControlTab(tab) {
    if (!MASTER_PAGE_SECTIONS[tab]) return;
    document.querySelector(".master-page-redesigned")?.classList.toggle("master-overview-active", tab === "overview");
    document.querySelectorAll("[data-master-control-tab]").forEach(button => {
        const active = button.dataset.masterControlTab === tab;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelectorAll("[data-master-control-pane]").forEach(pane => {
        pane.classList.toggle("is-active", pane.dataset.masterControlPane === tab);
    });
    setText("master-control-center-title", MASTER_PAGE_SECTIONS[tab][0]);
    setText("master-panel-description", MASTER_PAGE_SECTIONS[tab][1]);
    document.querySelector(".master-control-body")?.scrollTo(0, 0);
    if (tab === "overview") {
        requestAnimationFrame(() => requestAnimationFrame(renderMasterControlOverview));
    }
    if (tab === "events") {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            renderAllTokens();
            renderMasterEvents();
        }));
    }
    if (tab === "combats") {
        renderActiveMasterCombats();
        renderMasterControlCombats();
    }
}

function startMasterDashboardRefresh() {
    if (masterDashboardRefreshTimer) {
        clearInterval(masterDashboardRefreshTimer);
    }
    masterDashboardRefreshTimer = setInterval(async () => {
        await loadActiveMasterCombats();
        await Promise.all([
            loadAllMasterCharacters(),
            loadMasterBossPassword(),
            loadMasterCooldownStates(),
            loadMasterTrapStates(),
            loadMasterControlRegularCombatCooldowns(),
            loadMasterControlServices(),
            loadMasterUniqueItems()
        ]);
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
            renderMasterControlOverview();
        }
        if (document.querySelector('[data-master-control-pane="combats"]')?.classList.contains("is-active")) {
            renderMasterControlCombats();
            renderActiveMasterCombats();
        }
        if (document.querySelector('[data-master-control-pane="services"]')?.classList.contains("is-active")) {
            renderMasterControlServices();
        }
    }, 4000);
}

function renderMasterControlOverview() {
    const players = masterControlAllPlayers || [];
    const online = players.filter(p => p.online).length;
    const combats = Array.from(activeMasterCombats.values());
    const uniqueOwned = masterControlUniqueState.filter(item => !item.available).length;

    setText("master-control-player-count", String(players.length));
    setText("master-control-player-detail", `${online} online · ${players.length - online} offline`);
    setText("master-control-combat-count", String(combats.length));
    setText("master-control-combat-detail", combats.length ? "Monitoraggio in tempo reale" : "Nessun combattimento in corso");

    const bossCooldown = masterBossState.available === false;
    setText("master-control-boss-state", bossCooldown ? "COOLDOWN" : "DISPONIBILE");
    setText("master-control-boss-detail", bossCooldown ? (formatMasterCooldown(masterBossState.cooldown_until) || "Cooldown attivo") : "Goblin Boss affrontabile");

    setText("master-control-unique-count", `${uniqueOwned}/${MASTER_UNIQUE_ITEMS.length}`);
    setText("master-control-unique-detail", uniqueOwned ? "Oggetti attualmente posseduti" : "Tutti disponibili");

    syncMasterControlBossPassword();
    renderMasterMonkeyFingerStatus();
    renderMasterOverviewLists();
    renderMasterOverviewMap();
}

function renderMasterOverviewLists() {
    renderMasterOverviewCombatList();
    renderMasterOverviewTrapList();
    renderMasterOverviewEventList();
    renderMasterOverviewVendorList();
}

function clearMasterOverviewMarkers() {
    document.querySelectorAll("#master-overview-map .master-overview-token, #master-overview-map .master-overview-marker").forEach(node => node.remove());
}

function renderMasterOverviewMap() {
    const config = getMasterOverviewFloorConfig();
    const image = document.getElementById("master-overview-map-image");
    const container = document.getElementById("master-overview-map");
    if (!image || !container) return;

    setText("master-overview-floor-name", config.title);
    setText("master-overview-slide-count", `${config.index} / ${config.total}`);
    image.alt = config.imageAlt;
    if (!image.src.includes(config.image)) {
        image.src = config.image;
    }

    clearMasterOverviewMarkers();

    const mapRect = image.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (!image.complete || mapRect.width <= 0 || mapRect.height <= 0) return;

    const cellWidth = mapRect.width / config.columns;
    const cellHeight = mapRect.height / config.rows;
    const offsetX = mapRect.left - containerRect.left;
    const offsetY = mapRect.top - containerRect.top;
    const iconSize = Math.max(18, Math.min(cellWidth, cellHeight) * 0.76);
    const tokenSize = Math.max(18, Math.min(cellWidth, cellHeight) * 0.96);

    const placeNode = (x, y, node, size = iconSize) => {
        node.style.width = `${size}px`;
        node.style.minWidth = `${size}px`;
        node.style.height = `${size}px`;
        node.style.left = `${offsetX + (x + 0.5) * cellWidth}px`;
        node.style.top = `${offsetY + (y + 0.5) * cellHeight}px`;
        container.appendChild(node);
    };

    const floorPlayers = masterControlAllPlayers.filter(player => player.floor === config.key);
    floorPlayers.forEach(player => {
        const token = document.createElement("img");
        token.className = `master-overview-token ${player.online ? "is-online" : "is-offline"}`;
        token.src = `immagini/token/${player.token || "token_1.png"}`;
        token.alt = player.nome || "PG";
        token.title = `${player.nome || "Giocatore"} · ${player.online ? "online" : "offline"} · X ${Number(player.x) || 0} Y ${Number(player.y) || 0}`;
        placeNode(Number(player.x) || 0, Number(player.y) || 0, token, tokenSize);
    });

    const addMarker = (x, y, icon, stateClass, title, timerText = "") => {
        const marker = document.createElement("div");
        marker.className = `master-overview-marker ${stateClass}`;
        marker.title = title;
        const iconEl = document.createElement("span");
        iconEl.className = "icon";
        iconEl.textContent = icon;
        marker.appendChild(iconEl);
        if (timerText) {
            const timer = document.createElement("span");
            timer.className = "timer";
            timer.textContent = timerText;
            marker.appendChild(timer);
        }
        placeNode(Number(x) || 0, Number(y) || 0, marker, iconSize);
    };

    if (config.key === "dungeon") {
        MASTER_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, "dungeon");
            addMarker(event.x, event.y, event.type === "boss" ? "👹" : "⚔", state.markerClass, state.title, state.timerText);
        });

        Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coords, event]) => {
            const [x, y] = coords.split(",").map(Number);
            if (event.type === "trap") {
                const state = getMasterOverviewTrapState(event, coords);
                addMarker(x, y, "⚠", state.markerClass, state.title, state.timerText);
            } else {
                const state = getMasterOverviewEventState(event, coords);
                addMarker(x, y, "◆", state.markerClass, state.title, state.timerText);
            }
        });

        MASTER_SPECIAL_EVENTS.filter(event => event.type === "vendor").forEach(event => {
            const state = getMasterOverviewDungeonVendorState(event);
            addMarker(event.x, event.y, "🛠", state.markerClass, state.title, state.timerText);
        });
    } else {
        MASTER_BASE_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, "base");
            addMarker(event.x, event.y, "⚔", state.markerClass, state.title, state.timerText);
        });

        getMasterOverviewBaseServiceMarkers().forEach(marker => {
            addMarker(marker.x, marker.y, "🛠", marker.markerClass, marker.title, marker.timerText);
        });
    }
}

function getMasterOverviewCombatState(event, floor) {
    if (floor === "base") {
        const state = masterBaseCombatStates[event.state_key] || {};
        const active = !!getActiveCombatForEncounter(event.encounter_id);
        if (active) {
            return {
                markerClass: "state-live",
                timerText: "LIVE",
                title: `${event.label || event.encounter_id} · combattimento in corso`
            };
        }
        if (state.available === false) {
            return {
                markerClass: "state-cooldown",
                timerText: formatMasterCooldown(state.cooldown_until) || "CD",
                title: `${event.label || event.encounter_id} · in cooldown fino a ${formatMasterDateTime(state.cooldown_until)}`
            };
        }
        return {
            markerClass: "state-active",
            timerText: "ON",
            title: `${event.label || event.encounter_id} · attivo`
        };
    }

    if (event.type === "boss") {
        const active = !!getActiveCombatForEncounter(event.encounter_id);
        if (active) {
            return {
                markerClass: "state-live",
                timerText: "LIVE",
                title: "Goblin Boss · combattimento in corso"
            };
        }
        if (masterBossState.available === false) {
            return {
                markerClass: "state-cooldown",
                timerText: formatMasterCooldown(masterBossState.cooldown_until) || "CD",
                title: `Goblin Boss · in cooldown fino a ${formatMasterDateTime(masterBossState.cooldown_until)}`
            };
        }
        return {
            markerClass: "state-active",
            timerText: "ON",
            title: "Goblin Boss · attivo"
        };
    }

    const state = masterControlRegularCombatStates.get(event.encounter_id) || {};
    const active = !!getActiveCombatForEncounter(event.encounter_id);
    if (active) {
        return {
            markerClass: "state-live",
            timerText: "LIVE",
            title: `${event.encounter_id} · combattimento in corso`
        };
    }
    if (state.available === false) {
        return {
            markerClass: "state-cooldown",
            timerText: formatMasterCooldown(state.cooldown_until) || "CD",
            title: `${event.encounter_id} · in cooldown fino a ${formatMasterDateTime(state.cooldown_until)}`
        };
    }
    return {
        markerClass: "state-active",
        timerText: "ON",
        title: `${event.encounter_id} · attivo`
    };
}

function getMasterOverviewTrapState(event, coords) {
    const state = masterTrapStates.get(event.id);
    if (isMasterTrapCooldownActive(state)) {
        return {
            markerClass: "state-cooldown",
            timerText: formatMasterCooldown(state?.disabled_until) || "CD",
            title: `${event.id} · trappola disattiva fino a ${formatMasterDateTime(state?.disabled_until)} · ${coords}`
        };
    }
    return {
        markerClass: "state-active",
        timerText: "ON",
        title: `${event.id} · trappola attiva · ${coords}`
    };
}

function getMasterOverviewEventState(event, coords) {
    const activeUntil = event?.active_until || null;
    const isActive = !!activeUntil || event?.is_active !== false;
    return {
        markerClass: isActive ? "state-active" : "state-inactive",
        timerText: activeUntil ? (formatMasterCooldown(activeUntil) || "ON") : (isActive ? "ON" : "OFF"),
        title: `${event.id || "evento"} · ${isActive ? "attivo" : "non attivo"} · ${coords}`
    };
}

function getMasterOverviewDungeonVendorState(event) {
    return {
        markerClass: "state-active",
        timerText: "ON",
        title: `${event.label || "Vendor"} · attivo`
    };
}

function getMasterOverviewBaseServiceMarkers() {
    if (!Array.isArray(masterControlServices) || !masterControlServices.length) return [];
    return masterControlServices.slice(0, MASTER_OVERVIEW_BASE_SERVICE_POSITIONS.length).map((service, index) => {
        const pos = MASTER_OVERVIEW_BASE_SERVICE_POSITIONS[index];
        const state = describeMasterServiceState(service);
        return {
            ...pos,
            markerClass: state.markerClass,
            timerText: state.timerText,
            title: `${state.label} · ${state.description}`
        };
    });
}

function describeMasterServiceState(service) {
    const name = service?.display_name || service?.service_key || service?.id || "Servizio";
    const statusRaw = String(service?.status || "").toLowerCase();
    const constructionEnd = getMasterServiceEndTime(service?.build_started_at, service?.construction_seconds);
    const maintenanceEnd = getMasterServiceEndTime(service?.maintenance_started_at, service?.maintenance_seconds);

    if (["construction", "building", "in_construction"].includes(statusRaw) || (constructionEnd && Date.parse(constructionEnd) > Date.now())) {
        return {
            label: name,
            markerClass: "state-building",
            iconClass: "state-building",
            icon: "🛠",
            timerText: formatMasterCooldown(constructionEnd) || "WORK",
            description: "In costruzione"
        };
    }
    if (["active", "enabled", "online", "available"].includes(statusRaw)) {
        return {
            label: name,
            markerClass: "state-active",
            iconClass: "state-active",
            icon: "🛠",
            timerText: formatMasterCooldown(maintenanceEnd) || `LV ${Number(service?.current_level) || 1}`,
            description: maintenanceEnd ? "Attivo con manutenzione programmata" : "Attivo"
        };
    }
    if (["maintenance", "upgrading"].includes(statusRaw) || (maintenanceEnd && Date.parse(maintenanceEnd) > Date.now())) {
        return {
            label: name,
            markerClass: "state-building",
            iconClass: "state-building",
            icon: "🛠",
            timerText: formatMasterCooldown(maintenanceEnd) || "WORK",
            description: "In lavorazione"
        };
    }
    return {
        label: name,
        markerClass: "state-disabled",
        iconClass: "state-disabled",
        icon: "🛠",
        timerText: "OFF",
        description: "Disattivato"
    };
}

function getMasterServiceEndTime(startedAt, seconds) {
    if (!startedAt || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return null;
    const start = Date.parse(startedAt);
    if (!Number.isFinite(start)) return null;
    return new Date(start + Number(seconds) * 1000).toISOString();
}

function renderMasterOverviewRow(container, { icon, iconClass, label, description, timerText }) {
    const row = document.createElement("div");
    row.className = "master-overview-row";
    const iconEl = document.createElement("span");
    iconEl.className = `master-overview-row-icon ${iconClass}`;
    iconEl.textContent = icon;
    const info = document.createElement("div");
    info.className = "master-overview-row-main";
    const title = document.createElement("strong");
    title.textContent = label;
    const meta = document.createElement("small");
    meta.textContent = description;
    info.append(title, meta);
    const time = document.createElement("span");
    time.className = "master-overview-row-time";
    time.textContent = timerText || "-";
    row.append(iconEl, info, time);
    container.appendChild(row);
}

function renderMasterOverviewCombatList() {
    const container = document.getElementById("master-overview-combats");
    if (!container) return;
    container.innerHTML = "";
    const rows = [];
    if (masterOverviewFloor === "dungeon") {
        MASTER_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, "dungeon");
            rows.push({
                icon: event.type === "boss" ? "👹" : "⚔",
                iconClass: state.markerClass,
                label: event.type === "boss" ? "Goblin Boss" : String(event.encounter_id || event.id || "Combat").toUpperCase(),
                description: state.title,
                timerText: state.timerText
            });
        });
    } else {
        MASTER_BASE_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, "base");
            rows.push({
                icon: "⚔",
                iconClass: state.markerClass,
                label: event.label,
                description: state.title,
                timerText: state.timerText
            });
        });
    }
    if (!rows.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun combat definito su questo piano.</div>';
        return;
    }
    rows.forEach(row => renderMasterOverviewRow(container, row));
}

function renderMasterOverviewTrapList() {
    const container = document.getElementById("master-overview-traps");
    if (!container) return;
    container.innerHTML = "";
    if (masterOverviewFloor !== "dungeon") {
        container.innerHTML = '<div class="master-control-empty">Nessuna trappola monitorata nel Livello Base.</div>';
        return;
    }
    const rows = Object.entries(MASTER_DUNGEON_EVENTS)
        .filter(([, event]) => event.type === "trap")
        .map(([coords, event]) => {
            const state = getMasterOverviewTrapState(event, coords);
            return {
                icon: "⚠",
                iconClass: state.markerClass,
                label: `${event.id} · ${coords}`,
                description: state.title,
                timerText: state.timerText
            };
        });
    if (!rows.length) {
        container.innerHTML = '<div class="master-control-empty">Nessuna trappola configurata.</div>';
        return;
    }
    rows.forEach(row => renderMasterOverviewRow(container, row));
}

function renderMasterOverviewEventList() {
    const container = document.getElementById("master-overview-events");
    if (!container) return;
    container.innerHTML = "";
    if (masterOverviewFloor !== "dungeon") {
        container.innerHTML = '<div class="master-control-empty">Nessun evento monitorato nel Livello Base.</div>';
        return;
    }
    const rows = Object.entries(MASTER_DUNGEON_EVENTS)
        .filter(([, event]) => event.type !== "trap")
        .map(([coords, event]) => {
            const state = getMasterOverviewEventState(event, coords);
            return {
                icon: "◆",
                iconClass: state.markerClass,
                label: `${event.id || "evento"} · ${coords}`,
                description: event.message || state.title,
                timerText: state.timerText
            };
        });
    if (!rows.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun evento configurato.</div>';
        return;
    }
    rows.forEach(row => renderMasterOverviewRow(container, row));
}

function renderMasterOverviewVendorList() {
    const container = document.getElementById("master-overview-vendors");
    if (!container) return;
    container.innerHTML = "";

    const rows = [];
    if (masterOverviewFloor === "dungeon") {
        MASTER_SPECIAL_EVENTS.filter(event => event.type === "vendor").forEach(event => {
            const state = getMasterOverviewDungeonVendorState(event);
            rows.push({
                icon: "🛠",
                iconClass: state.markerClass,
                label: event.label || "Vendor",
                description: state.title,
                timerText: state.timerText
            });
        });
    } else if (masterControlServicesError) {
        container.innerHTML = `<div class="master-control-empty is-error">Impossibile leggere i servizi della base: ${String(masterControlServicesError.message || masterControlServicesError)}</div>`;
        return;
    } else {
        masterControlServices.forEach(service => {
            const state = describeMasterServiceState(service);
            rows.push({
                icon: state.icon,
                iconClass: state.iconClass,
                label: state.label,
                description: state.description,
                timerText: state.timerText
            });
        });
    }

    if (!rows.length) {
        container.innerHTML = '<div class="master-control-empty">Nessun vendor / servizio disponibile.</div>';
        return;
    }
    rows.forEach(row => renderMasterOverviewRow(container, row));
}

window.addEventListener("resize", () => {
    if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
        requestAnimationFrame(renderMasterOverviewMap);
    }
});

// ============================================================
// MASTER v16 — ROSTER E SCHEDA AMMINISTRATIVA
// Usa direttamente characters, character_inventory, items e RPC
// protette lato Supabase. Non modifica il PG al semplice click.
// ============================================================
let masterPgSelectedId = null;
let masterPgInventory = [];
let masterPgItemCatalog = new Map();
let masterPgLoading = false;

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("master-pg-search")?.addEventListener("input", renderMasterControlPlayers);
    document.getElementById("master-pg-back")?.addEventListener("click", masterPgCloseSheet);
    renderMasterControlPlayers();
});

function masterPgCloseSheet() {
    masterPgSelectedId = null;
    document.getElementById("master-pg-browser")?.removeAttribute("hidden");
    document.getElementById("master-pg-sheet")?.setAttribute("hidden", "");
    document.getElementById("master-pg-back")?.setAttribute("hidden", "");
    setText("master-pg-title", "TUTTI I GIOCATORI");
    renderMasterControlPlayers();
}

function renderMasterControlPlayers() {
    const container = document.getElementById("master-pg-list");
    if (!container) return;
    const query = (document.getElementById("master-pg-search")?.value || "").toLocaleLowerCase("it").trim();
    const players = [...masterControlAllPlayers].filter(p => {
        const searchable = `${p.nome || ""} ${p.livello || ""} ${masterFloorDisplayName(p.floor)}`;
        return searchable.toLocaleLowerCase("it").includes(query);
    }).sort((a,b) => Number(b.online) - Number(a.online) || String(a.nome||"").localeCompare(String(b.nome||""),"it"));
    container.replaceChildren();
    if (!players.length) {
        const empty = document.createElement("div");
        empty.className="master-pg-empty";
        empty.textContent = "Nessun personaggio corrispondente.";
        container.appendChild(empty);
        return;
    }
    for (const p of players) {
        const button = document.createElement("button");
        button.type="button";
        button.className=`master-pg-entry ${p.online ? "is-online" : "is-offline"}`;
        const icon=document.createElement("img");
        icon.src="immagini/token/"+(p.token||"token_1.png"); icon.alt="";
        const info=document.createElement("div");
        const title=document.createElement("strong");
        title.textContent=`${p.nome || "Avventuriero"} · Lv ${Number(p.livello)||1}`;
        const status=document.createElement("small");
        status.innerHTML=`<span class="master-pg-dot ${p.online ? "is-online" : ""}">${p.online ? "●" : "○"}</span> ${p.online ? "Online" : "Offline"} · ${masterFloorDisplayName(p.floor)}`;
        info.append(title,status);button.append(icon,info);
        button.addEventListener("click",()=>masterPgOpenSheet(p.character_id));
        container.appendChild(button);
    }
}

function masterPgEl(tag, className="", value="") {
    const el=document.createElement(tag);
    if(className) el.className=className;
    if(value!==null && value!==undefined) el.textContent=String(value);
    return el;
}

async function masterPgOpenSheet(id) {
    if(masterPgLoading) return;
    masterPgSelectedId=id;
    const browser=document.getElementById("master-pg-browser");
    const sheet=document.getElementById("master-pg-sheet");
    const back=document.getElementById("master-pg-back");
    if(!sheet) return;
    browser.hidden=true;sheet.hidden=false;back.hidden=false;
    sheet.replaceChildren(masterPgEl("div","master-pg-loading","Caricamento scheda del personaggio..."));
    await masterPgLoadSheet(id);
}

async function masterPgLoadSheet(id) {
    const sheet=document.getElementById("master-pg-sheet");
    if(!sheet||!id) return;
    masterPgLoading=true;
    try {
        const [characterResult, inventoryResult, catalogResult] = await Promise.all([
            db.from("characters").select("*").eq("id",id).single(),
            db.from("character_inventory").select("id,character_id,item_id,quantity,equipped_slot,expires_at").eq("character_id",id),
            db.from("items").select("*")
        ]);
        if(characterResult.error) throw characterResult.error;
        if(inventoryResult.error) throw inventoryResult.error;
        if(catalogResult.error) throw catalogResult.error;
        if(masterPgSelectedId!==id) return;
        const character=characterResult.data;
        masterPgInventory=inventoryResult.data||[];
        masterPgItemCatalog=new Map((catalogResult.data||[]).map(item=>[item.id,item]));
        // La Risonanza della scheda giocatore usa get_character_final_score
        // tramite get_character_resonance_safe. Quest'ultima RPC non e'
        // eseguibile direttamente con il ruolo authenticated; la prima sì.
        const {data:score, error:scoreError} = await db.rpc(
            "get_character_final_score", {p_character_id:id}
        );
        if(scoreError) {
            console.warn("Risonanza Master non disponibile:", scoreError);
        }
        const resonance=scoreError ? "N/D" : masterPgValue(score);
        masterPgRenderSheet(character, resonance);
    }catch(error){
        console.error("Caricamento scheda Master:",error);
        sheet.replaceChildren(masterPgEl("div","master-pg-feedback error",`Impossibile leggere la scheda: ${error.message||error}`));
    }finally {masterPgLoading=false;}
}

function masterPgValue(value) {
    if(value===null||value===undefined) return "N/D";
    if(typeof value==='object') return String(value.resonance ?? value.risonanza ?? value.total ?? value.value ?? JSON.stringify(value));
    return String(value);
}

function masterPgRenderSheet(c, resonance) {
    const sheet=document.getElementById("master-pg-sheet");
    sheet.replaceChildren();
    setText("master-pg-title",`SCHEDA · ${c.nome || "Personaggio"}`);
    const floor=getMasterCharacterFloor(c);
    const cached=masterControlAllPlayers.find(p=>p.character_id===c.id);
    const identity=masterPgEl("div","master-pg-identity",null);
    const token=masterPgEl("img","",null);
    token.src="immagini/token/"+(c.token||"token_1.png");token.alt="Token del personaggio";
    const identityInfo=masterPgEl("div","",null);
    identityInfo.append(masterPgEl("h2","",c.nome||"Avventuriero"));
    identityInfo.append(masterPgEl("p","",`Lv ${c.livello||1} · ${c.razza||"Razza N/D"} · ${c.classe||"Classe N/D"}`));
    identityInfo.append(masterPgEl("p","",`${cached?.online?"● Online":"○ Offline"} · ${masterFloorDisplayName(floor)} · X ${cached?.x ?? (floor==="base"?c.base_x:c.dungeon_x)} Y ${cached?.y ?? (floor==="base"?c.base_y:c.dungeon_y)}`));
    identity.append(token,identityInfo);sheet.append(identity);

    const main=masterPgCreateSection(sheet,"RISORSE, RISONANZA E PROGRESSIONE");
    const currentGold=c.current_gold ?? 0;
    masterPgStats(main,[
        ["LIVELLO",c.livello||1],["RISONANZA",resonance],["MONETE D'ORO",currentGold],
        ["PF ATTUALI",c.current_hp??"-"],["PM ATTUALI",c.current_pm??"-"],
        ["PUNTI ABILITÀ",c.punti_abilita??0]
    ]);

    const attributes=masterPgCreateSection(sheet,"ATTRIBUTI");
    masterPgStats(attributes,[
        ["FORZA",c.forza],["RESISTENZA",c.resistenza],["COSTITUZIONE",c.costituzione],
        ["INTELLIGENZA",c.intelligenza],["DESTREZZA",c.destrezza],["FORTUNA",c.fortuna]
    ]);

    const equipped=masterPgInventory.filter(row=>row.equipped_slot);
    const gear=masterPgCreateSection(sheet,"EQUIPAGGIAMENTO");
    if(!equipped.length)gear.append(masterPgEl("p","master-pg-empty","Nessun oggetto equipaggiato."));
    else masterPgRenderInventoryRows(gear,equipped);
    const inventory=masterPgCreateSection(sheet,"INVENTARIO");
    if(!masterPgInventory.length)inventory.append(masterPgEl("p","master-pg-empty","Inventario vuoto."));
    else masterPgRenderInventoryRows(inventory,masterPgInventory);

    const editor=masterPgCreateSection(sheet,"MODIFICA PERSONAGGIO · SOLO MASTER");
    editor.append(masterPgEl("p","master-pg-empty","Le modifiche vengono salvate solo dopo la conferma e sono convalidate dal server."));
    const form=document.createElement("form");
    const grid=masterPgEl("div","master-pg-edit-grid",null);
    const editables=[
        ["livello","Livello",1,999],["forza","FOR",1,1000],["resistenza","RES",1,1000],
        ["costituzione","COS",1,1000],["intelligenza","INT",1,1000],
        ["destrezza","DES",1,1000],["fortuna","LCK",1,1000],
        ["current_hp","PF attuali",0,1000000],["current_pm","PM attuali",0,1000000],
        ["current_gold","Monete d'oro",0,1000000000],["punti_abilita","Punti abilità",0,1000000]
    ];
    for(const [column,label,min,max] of editables){
        const wrap=masterPgEl("label","master-pg-edit-field",null);
        wrap.append(masterPgEl("span","",label));
        const input=document.createElement("input");
        input.type="number";input.name=column;input.value=String(c[column]??0);input.min=String(min);input.max=String(max);input.step="1";input.required=true;
        wrap.append(input);grid.append(wrap);
    }
    form.append(grid);
    const actions=masterPgEl("div","master-pg-form-actions",null);
    const save=masterPgEl("button","button","SALVA MODIFICHE");
    save.type="submit";
    const feedback=masterPgEl("span","master-pg-feedback","");
    actions.append(save,feedback);form.append(actions);editor.append(form);
    form.addEventListener("submit",async(event)=>{
        event.preventDefault();
        const updates={};
        for(const [column,,min,max] of editables){
            const input=form.elements.namedItem(column);
            const v=Number(input.value);
            if(!Number.isSafeInteger(v)||v<min||v>max){feedback.textContent=`Valore non valido: ${column}`;feedback.className="master-pg-feedback error";return;}
            if(v!==Number(c[column]??0))updates[column]=v;
        }
        if(!Object.keys(updates).length){feedback.textContent="Nessuna modifica da salvare.";return;}
        if(!window.confirm(`Confermi le modifiche alle statistiche di ${c.nome}?`))return;
        save.disabled=true;feedback.textContent="Salvataggio in corso...";
        try{
            const {error}=await db.rpc("master_update_character_safe",{p_character_id:c.id,p_changes:updates});
            if(error)throw error;
            feedback.className="master-pg-feedback ok";feedback.textContent="Modifiche salvate.";
            await loadAllMasterCharacters();await masterPgLoadSheet(c.id);
        }catch(err){console.error(err);feedback.className="master-pg-feedback error";feedback.textContent=`Errore: ${err.message||err}`;}
        finally{save.disabled=false;}
    });
}

function masterPgCreateSection(parent,title){
    const section=masterPgEl("section","master-pg-section",null);
    section.append(masterPgEl("h3","",title));parent.append(section);return section;
}
function masterPgStats(parent,rows){
    const grid=masterPgEl("div","master-pg-stat-grid",null);
    for(const [label,value] of rows){
        const item=masterPgEl("div","master-pg-stat",null);
        item.append(masterPgEl("span","",label),masterPgEl("strong","",value??"-"));grid.append(item);
    }
    parent.append(grid);
}
function masterPgRenderInventoryRows(parent,rows){
    const list=masterPgEl("div","master-pg-inventory",null);
    for(const row of rows){
        const definition=masterPgItemCatalog.get(row.item_id)||{};
        const item=masterPgEl("div","master-pg-item",null);
        const main=masterPgEl("div","",null);
        main.append(masterPgEl("strong","",`${definition.name||row.item_id} ×${row.quantity}`));
        const bonuses=Object.entries(definition).filter(([key,value])=>key.endsWith("_bonus")&&Number(value)).map(([key,value])=>`${key.replace(/_bonus$/,'')}: ${value>0?'+':''}${value}`);
        main.append(masterPgEl("small","",`${row.equipped_slot?"Equipaggiato: "+row.equipped_slot+" · ":""}${definition.description||""}${bonuses.length?" · "+bonuses.join(" · "):""}`));
        const actions=masterPgEl("div","master-pg-item-actions",null);
        const quantity=document.createElement("input");quantity.type="number";quantity.min="0";quantity.max="999999";quantity.step="1";quantity.value=String(row.quantity);
        quantity.setAttribute("aria-label",`Quantità ${definition.name||row.item_id}`);
        const update=masterPgEl("button","button secondary","Modifica");update.type="button";
        update.addEventListener("click",()=>masterPgChangeItem(row,"quantity",quantity.value));
        const slot=document.createElement("select");
        slot.setAttribute("aria-label",`Equipaggiamento ${definition.name||row.item_id}`);
        const slots=["", ...(definition.equip_slot ? [definition.equip_slot] : []), row.equipped_slot || ""];
        for(const key of [...new Set([...slots,row.equipped_slot||""])]){
            const option=document.createElement("option");option.value=key;option.textContent=key||"Non equipaggiato";option.selected=key===(row.equipped_slot||"");slot.append(option);
        }
        slot.addEventListener("change",()=>masterPgChangeItem(row,"slot",slot.value));
        actions.append(quantity,update,slot);item.append(main,actions);list.append(item);
    }
    parent.append(list);
}
async function masterPgChangeItem(row,kind,value){
    const player=masterControlAllPlayers.find(p=>p.character_id===masterPgSelectedId);
    const name=player?.nome||"personaggio";
    if(!window.confirm(`Confermi la modifica all'oggetto ${row.item_id} di ${name}?`))return;
    try{
        const changes=kind==="quantity" ? {quantity:Number(value)} : {equipped_slot:value||null};
        const {error}=await db.rpc("master_update_inventory_safe",{p_character_id:masterPgSelectedId,p_inventory_id:row.id,p_changes:changes});
        if(error)throw error;
        await masterPgLoadSheet(masterPgSelectedId);
    }catch(err){window.alert(`Impossibile modificare l'oggetto: ${err.message||err}`);}
}

// ============================================================
// MASTER v17 — PANORAMICA PULITA
// Nessun riepilogo dentro il tab: solo mappa, PG e simboli.
// I tempi sono mostrati esclusivamente sotto le icone.
// Le coordinate dei servizi seguono base/services.json.
// ============================================================

const MASTER_OVERVIEW_SERVICE_COORDS_FALLBACK = [
    { id:"runografo",    name:"Runografo",    npc:{x:18,y:21} },
    { id:"locanda",      name:"Locanda",      npc:{x:4,y:15} },
    { id:"addestratore", name:"Addestratore", npc:{x:22,y:18} },
    { id:"quest_giver",  name:"Missioni",     npc:{x:13,y:21} }
];

let masterOverviewServiceLocations = MASTER_OVERVIEW_SERVICE_COORDS_FALLBACK;

async function loadMasterOverviewServiceLocations() {
    try {
        const response = await fetch("base/services.json", { cache:"no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload.services)) throw new Error("Formato services.json non valido");
        const loaded = payload.services.filter(service =>
            service?.id && Number.isInteger(Number(service?.npc?.x)) &&
            Number.isInteger(Number(service?.npc?.y))
        );
        if (loaded.length) masterOverviewServiceLocations = loaded;
    } catch (error) {
        console.warn("Master: uso coordinate note dei servizi della Base", error);
    }
    if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
        requestAnimationFrame(renderMasterOverviewMap);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    loadMasterOverviewServiceLocations();
});

function describeMasterServiceState(service) {
    const label = service?.display_name || service?.service_key || "Servizio";
    const status = String(service?.status || "").toLowerCase();
    // Questi due campi provengono realmente da base_services.
    const constructionReady = service?.construction_ready_at || null;
    const maintenanceUntil = service?.maintenance_until || null;

    if (["building", "construction", "constructing"].includes(status)) {
        return {
            label, markerClass:"state-building", iconClass:"state-building", icon:"🛠",
            timerText: formatMasterCooldown(constructionReady),
            description: constructionReady ? "In costruzione" : "In costruzione · tempo N/D"
        };
    }
    if (["active", "enabled"].includes(status)) {
        return {
            label, markerClass:"state-active", iconClass:"state-active", icon:"🛠",
            timerText: formatMasterCooldown(maintenanceUntil),
            description: "Attivo"
        };
    }
    if (["maintenance", "upgrading"].includes(status)) {
        return {
            label, markerClass:"state-building", iconClass:"state-building", icon:"🛠",
            timerText: formatMasterCooldown(maintenanceUntil),
            description:"In manutenzione"
        };
    }
    if (["unbuilt", "inactive", "disabled"].includes(status)) {
        return {
            label, markerClass:"state-disabled", iconClass:"state-disabled", icon:"🛠",
            timerText:"", description:"Non attivo"
        };
    }
    return {
        label, markerClass:"state-inactive", iconClass:"state-inactive", icon:"🛠",
        timerText:"", description:"Stato non disponibile"
    };
}

function getMasterOverviewBaseServiceMarkers() {
    const serviceByKey = new Map((masterControlServices || []).map(service =>
        [String(service.service_key || "").toLowerCase(), service]
    ));
    const markers = [];
    // Mano di Scimmia è un vendor permanente, non soggetto a base_services.
    markers.push({
        x:22, y:13, title:"Mano di Scimmia · Vendor", markerClass:"state-active", timerText:""
    });
    for (const definition of masterOverviewServiceLocations) {
        const service = serviceByKey.get(String(definition.id || "").toLowerCase());
        const details = describeMasterServiceState(service || {
            display_name:definition.name || definition.id, status:"unknown"
        });
        markers.push({
            x:Number(definition.npc.x), y:Number(definition.npc.y),
            title:`${details.label} · ${details.description}${details.timerText ? " · "+details.timerText : ""}`,
            markerClass:details.markerClass, timerText:details.timerText
        });
    }
    return markers;
}

function getMasterOverviewEventState(event, coords) {
    // Gli eventi statici del dungeon non hanno un cooldown nel database.
    // Non inventiamo un conto alla rovescia: compare soltanto se fornito.
    const isActive = event?.is_active !== false;
    const until = isActive ? event?.active_until : event?.cooldown_until;
    return {
        markerClass: isActive ? "state-active" : "state-inactive",
        timerText: until ? formatMasterCooldown(until) : "",
        title:`${event.id || "evento"} · ${isActive ? "attivo" : "non attivo"} · ${coords}`
    };
}

function renderMasterOverviewMap() {
    const image = document.getElementById("master-overview-map-image");
    const container = document.getElementById("master-overview-map");
    if (!image || !container) return;

    const config = getMasterOverviewFloorConfig();
    setText("master-overview-floor-name", config.title);
    setText("master-overview-slide-count", `${config.index} / ${config.total}`);
    image.alt = config.imageAlt;
    if (image.getAttribute("src") !== config.image) image.setAttribute("src", config.image);
    clearMasterOverviewMarkers();

    // Aspetta che l'immagine abbia completato il caricamento prima di
    // proiettare le coordinate del gioco sulla sua superficie reale.
    if (!image.complete || !image.naturalWidth) return;
    const imageRect = image.getBoundingClientRect();
    const stageRect = container.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height || !stageRect.width || !stageRect.height) return;

    const stepX = imageRect.width / config.columns;
    const stepY = imageRect.height / config.rows;
    const offsetX = imageRect.left - stageRect.left;
    const offsetY = imageRect.top - stageRect.top;
    const iconSize = Math.max(12, Math.min(stepX,stepY) * .68);
    const tokenSize = Math.max(12, Math.min(stepX,stepY) * .93);

    function place(node,x,y,size) {
        const X = Number(x), Y = Number(y);
        if (!Number.isFinite(X) || !Number.isFinite(Y) || X<0 || Y<0 || X>=config.columns || Y>=config.rows) return;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.minWidth = `${size}px`;
        node.style.left = `${offsetX + (X+.5)*stepX}px`;
        node.style.top = `${offsetY + (Y+.5)*stepY}px`;
        container.appendChild(node);
    }

    function addMarker(x,y,glyph,state,title,remaining = "",onClick=null) {
        const marker = document.createElement("div");
        marker.className = `master-overview-marker ${state}`;
        marker.title = title;
        const icon = document.createElement("span");
        icon.className="icon";
        icon.textContent=glyph;
        marker.appendChild(icon);
        // Niente ON o LIVE dentro le icone; mostriamo soltanto i tempi effettivi.
        const time = String(remaining || "").trim();
        if (time && !["ON","OFF","LIVE","WORK"].includes(time)) {
            const label = document.createElement("span");
            label.className="timer";
            label.textContent=time;
            marker.appendChild(label);
        }
        if (typeof onClick === "function") {
            marker.tabIndex = 0;
            marker.setAttribute("role", "button");
            marker.addEventListener("click",onClick);
            marker.addEventListener("keydown", e => {if(e.key==="Enter"||e.key===" "){e.preventDefault();onClick();}});
        }
        place(marker,x,y,iconSize);
    }

    if (config.key === "dungeon") {
        MASTER_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event,"dungeon");
            const live = getActiveCombatForEncounter(event.encounter_id);
            addMarker(event.x,event.y,event.type==="boss" ? "👹" : "⚔",
                state.markerClass,state.title,state.timerText,
                live ? () => openMasterCombat(live.id) : null);
        });
        Object.entries(MASTER_DUNGEON_EVENTS).forEach(([coords,event])=>{
            const [x,y]=coords.split(",").map(Number);
            const state = event.type==="trap"
                ? getMasterOverviewTrapState(event,coords)
                : getMasterOverviewEventState(event,coords);
            addMarker(x,y,event.type==="trap" ? "⚠" : "◆",state.markerClass,state.title,state.timerText);
        });
        MASTER_SPECIAL_EVENTS.filter(event=>event.type==="pvp").forEach(event=>{
            addMarker(event.x,event.y,"⚔","state-active",`${event.label || "Area PvP"} · evento PvP`);
        });
        MASTER_SPECIAL_EVENTS.filter(event=>event.type==="vendor").forEach(event=>{
            // Vendor del dungeon non legati allo stato di costruzione Base.
            addMarker(event.x,event.y,"🐒","state-active",`${event.label || "Vendor"} · disponibile`);
        });
    } else {
        MASTER_BASE_COMBAT_EVENTS.forEach(event=>{
            const state=getMasterOverviewCombatState(event,"base");
            const live=getActiveCombatForEncounter(event.encounter_id);
            addMarker(event.x,event.y,"⚔",state.markerClass,state.title,state.timerText,
                live ? () => openMasterCombat(live.id) : null);
        });
        getMasterOverviewBaseServiceMarkers().forEach(item=>{
            addMarker(item.x,item.y,"🛠",item.markerClass,item.title,item.timerText);
        });
    }

    // I token vengono aggiunti dopo gli altri simboli: rimangono leggibili.
    (masterControlAllPlayers || []).filter(player=>player.floor===config.key).forEach(player=>{
        const token=document.createElement("img");
        token.className=`master-overview-token ${player.online ? "is-online" : "is-offline"}`;
        token.src="immagini/token/"+(player.token||"token_1.png");
        token.alt=player.nome||"Giocatore";
        token.title=`${player.nome||"PG"} · ${player.online ? "online" : "offline"} · X ${player.x} Y ${player.y}`;
        token.tabIndex=0;
        token.addEventListener("click",()=>openCharacterSheet(player.character_id));
        token.addEventListener("keydown",e=>{if(e.key==="Enter"){openCharacterSheet(player.character_id);}});
        place(token,player.x,player.y,tokenSize);
    });
}

// Countdown visivi aggiornati al secondo senza interrogare Supabase.
// Il refresh dei dati rimane quello condiviso con la pagina Master.
let masterOverviewVisualTimer = null;
window.addEventListener("DOMContentLoaded", () => {
    if (masterOverviewVisualTimer) clearInterval(masterOverviewVisualTimer);
    masterOverviewVisualTimer = setInterval(() => {
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains("is-active")) {
            renderMasterOverviewMap();
        }
    }, 1000);
});
window.addEventListener("beforeunload", () => {
    if (masterOverviewVisualTimer) clearInterval(masterOverviewVisualTimer);
});


// ============================================================
// MASTER v18 — FIX PANORAMICA PIANO 1
// - rimuove scale/dead_end dalla mappa overview
// - rimuove PVP e vendor del Piano 1
// - aggiunge Puzzacinta con stato/cooldown
// - corregge i cooldown dei combat sulla mappa
// ============================================================

let masterPuzzacintaState = {
    event_id: "puzzacinta_p1",
    visible: false,
    phase: "hidden",
    x: 1,
    y: 8,
    window_end_at: null,
    next_start_at: null,
    combat_id: null,
    enabled: true,
    start_hours: [0, 4, 8, 12, 16, 20],
    duration_minutes: 15,
    timezone: "Europe/Rome",
    source: "fallback"
};

function computeMasterRareEventNextStart(startHours) {
    const hours = Array.isArray(startHours)
        ? startHours.map(Number).filter(v => Number.isFinite(v) && v >= 0 && v <= 23).sort((a,b) => a-b)
        : [];
    if (!hours.length) return null;

    const now = new Date();
    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
        for (const hour of hours) {
            const candidate = new Date(now);
            candidate.setSeconds(0, 0);
            candidate.setDate(candidate.getDate() + dayOffset);
            candidate.setHours(hour, 0, 0, 0);
            if (candidate.getTime() > now.getTime() + 1000) {
                return candidate.toISOString();
            }
        }
    }
    return null;
}

async function loadMasterPuzzacintaState() {
    const next = {
        event_id: "puzzacinta_p1",
        visible: false,
        phase: "hidden",
        x: 1,
        y: 8,
        window_end_at: null,
        next_start_at: null,
        combat_id: null,
        enabled: true,
        start_hours: [0, 4, 8, 12, 16, 20],
        duration_minutes: 15,
        timezone: "Europe/Rome",
        source: "fallback"
    };

    try {
        const { data, error } = await db
            .from('dungeon_rare_events')
            .select('event_id, x, y, enabled, timezone, start_hours, duration_minutes')
            .eq('event_id', 'puzzacinta_p1')
            .maybeSingle();
        if (!error && data) {
            next.x = Number(data.x);
            next.y = Number(data.y);
            next.enabled = data.enabled !== false;
            next.timezone = data.timezone || next.timezone;
            next.start_hours = Array.isArray(data.start_hours) ? data.start_hours : next.start_hours;
            next.duration_minutes = Number(data.duration_minutes) || next.duration_minutes;
            next.source = 'table';
        }
    } catch (error) {
        console.warn('Master: impossibile leggere dungeon_rare_events per Puzzacinta:', error);
    }

    try {
        const { data, error } = await db.rpc('get_puzzacinta_state');
        if (!error && data) {
            next.visible = data.visible === true;
            next.phase = String(data.phase || next.phase);
            if (Number.isFinite(Number(data.x))) next.x = Number(data.x);
            if (Number.isFinite(Number(data.y))) next.y = Number(data.y);
            next.window_end_at = data.window_end_at || null;
            next.combat_id = data.combat_id || null;
            next.source = 'rpc';
        }
    } catch (error) {
        console.warn('Master: get_puzzacinta_state non disponibile:', error);
    }

    if (!next.visible && next.enabled !== false) {
        next.next_start_at = computeMasterRareEventNextStart(next.start_hours);
    }

    masterPuzzacintaState = next;
    return next;
}

function getMasterOverviewPuzzacintaState() {
    const state = masterPuzzacintaState || {};
    const phase = String(state.phase || 'hidden').toLowerCase();
    const visible = state.visible === true || ['dialogue', 'berserk_ready', 'combat_active'].includes(phase);

    if (visible) {
        if (phase === 'combat_active' || phase === 'berserk_ready') {
            return {
                markerClass: 'state-live',
                timerText: formatMasterCooldown(state.window_end_at) || '',
                title: 'Puzzacinta · evento raro in corso'
            };
        }
        return {
            markerClass: 'state-active',
            timerText: formatMasterCooldown(state.window_end_at) || '',
            title: 'Puzzacinta · evento raro attivo'
        };
    }

    const nextAt = state.next_start_at || null;
    return {
        markerClass: nextAt ? 'state-cooldown' : 'state-inactive',
        timerText: formatMasterCooldown(nextAt) || '',
        title: nextAt
            ? `Puzzacinta · prossimo evento tra ${formatMasterCooldown(nextAt) || 'poco'}`
            : 'Puzzacinta · evento raro non attivo'
    };
}

function getMasterOverviewCombatState(event, floor) {
    if (floor === 'base') {
        const state = masterBaseCombatStates[event.state_key] || {};
        const active = !!getActiveCombatForEncounter(event.encounter_id);
        if (active) {
            return {
                markerClass: 'state-live',
                timerText: '',
                title: `${event.label || event.encounter_id} · combattimento in corso`
            };
        }
        if (state.available === false) {
            const until = state.cooldown_until || state.until || null;
            return {
                markerClass: 'state-cooldown',
                timerText: formatMasterCooldown(until) || '',
                title: `${event.label || event.encounter_id} · in cooldown${until ? ' fino a ' + formatMasterDateTime(until) : ''}`
            };
        }
        return {
            markerClass: 'state-active',
            timerText: '',
            title: `${event.label || event.encounter_id} · attivo`
        };
    }

    if (event.type === 'boss') {
        const active = !!getActiveCombatForEncounter(event.encounter_id);
        if (active) {
            return {
                markerClass: 'state-live',
                timerText: '',
                title: 'Goblin Boss · combattimento in corso'
            };
        }
        if (masterBossState.available === false) {
            const until = masterBossState.cooldown_until || masterBossState.until || null;
            return {
                markerClass: 'state-cooldown',
                timerText: formatMasterCooldown(until) || '',
                title: `Goblin Boss · in cooldown${until ? ' fino a ' + formatMasterDateTime(until) : ''}`
            };
        }
        return {
            markerClass: 'state-active',
            timerText: '',
            title: 'Goblin Boss · attivo'
        };
    }

    const state = masterControlRegularCombatStates.get(event.encounter_id) || {};
    const active = !!getActiveCombatForEncounter(event.encounter_id);
    if (active) {
        return {
            markerClass: 'state-live',
            timerText: '',
            title: `${event.encounter_id} · combattimento in corso`
        };
    }
    const until = state.until || state.cooldown_until || state.disabled_until || null;
    if (state.available === false || state.state === 'cooldown') {
        return {
            markerClass: 'state-cooldown',
            timerText: formatMasterCooldown(until) || '',
            title: `${event.encounter_id} · in cooldown${until ? ' fino a ' + formatMasterDateTime(until) : ''}`
        };
    }
    return {
        markerClass: 'state-active',
        timerText: '',
        title: `${event.encounter_id} · attivo`
    };
}

function renderMasterOverviewMap() {
    const image = document.getElementById('master-overview-map-image');
    const container = document.getElementById('master-overview-map');
    if (!image || !container) return;

    const config = getMasterOverviewFloorConfig();
    setText('master-overview-floor-name', config.title);
    setText('master-overview-slide-count', `${config.index} / ${config.total}`);
    image.alt = config.imageAlt;
    if (image.getAttribute('src') !== config.image) image.setAttribute('src', config.image);
    clearMasterOverviewMarkers();

    if (!image.complete || !image.naturalWidth) return;
    const imageRect = image.getBoundingClientRect();
    const stageRect = container.getBoundingClientRect();
    if (!imageRect.width || !imageRect.height || !stageRect.width || !stageRect.height) return;

    const stepX = imageRect.width / config.columns;
    const stepY = imageRect.height / config.rows;
    const offsetX = imageRect.left - stageRect.left;
    const offsetY = imageRect.top - stageRect.top;
    const iconSize = Math.max(12, Math.min(stepX, stepY) * 0.68);
    const tokenSize = Math.max(12, Math.min(stepX, stepY) * 0.93);

    function place(node, x, y, size) {
        const X = Number(x), Y = Number(y);
        if (!Number.isFinite(X) || !Number.isFinite(Y) || X < 0 || Y < 0 || X >= config.columns || Y >= config.rows) return;
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.minWidth = `${size}px`;
        node.style.left = `${offsetX + (X + 0.5) * stepX}px`;
        node.style.top = `${offsetY + (Y + 0.5) * stepY}px`;
        container.appendChild(node);
    }

    function addMarker(x, y, glyph, state, title, remaining = '', onClick = null) {
        const marker = document.createElement('div');
        marker.className = `master-overview-marker ${state}`;
        marker.title = title;
        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = glyph;
        marker.appendChild(icon);
        const time = String(remaining || '').trim();
        if (time) {
            const label = document.createElement('span');
            label.className = 'timer';
            label.textContent = time;
            marker.appendChild(label);
        }
        if (typeof onClick === 'function') {
            marker.tabIndex = 0;
            marker.setAttribute('role', 'button');
            marker.addEventListener('click', onClick);
            marker.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            });
        }
        place(marker, x, y, iconSize);
    }

    if (config.key === 'dungeon') {
        MASTER_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, 'dungeon');
            const live = getActiveCombatForEncounter(event.encounter_id);
            addMarker(
                event.x,
                event.y,
                event.type === 'boss' ? '👹' : '⚔',
                state.markerClass,
                state.title,
                state.timerText,
                live ? () => openMasterCombat(live.id) : null
            );
        });

        Object.entries(MASTER_DUNGEON_EVENTS)
            .filter(([, event]) => event.type === 'trap')
            .forEach(([coords, event]) => {
                const [x, y] = coords.split(',').map(Number);
                const state = getMasterOverviewTrapState(event, coords);
                addMarker(x, y, '⚠', state.markerClass, state.title, state.timerText);
            });

        const puzzState = getMasterOverviewPuzzacintaState();
        addMarker(
            masterPuzzacintaState.x,
            masterPuzzacintaState.y,
            '☣',
            puzzState.markerClass,
            puzzState.title,
            puzzState.timerText
        );
    } else {
        MASTER_BASE_COMBAT_EVENTS.forEach(event => {
            const state = getMasterOverviewCombatState(event, 'base');
            const live = getActiveCombatForEncounter(event.encounter_id);
            addMarker(
                event.x,
                event.y,
                '⚔',
                state.markerClass,
                state.title,
                state.timerText,
                live ? () => openMasterCombat(live.id) : null
            );
        });
        getMasterOverviewBaseServiceMarkers().forEach(item => {
            addMarker(item.x, item.y, '🛠', item.markerClass, item.title, item.timerText);
        });
    }

    (masterControlAllPlayers || [])
        .filter(player => player.floor === config.key)
        .forEach(player => {
            const token = document.createElement('img');
            token.className = `master-overview-token ${player.online ? 'is-online' : 'is-offline'}`;
            token.src = 'immagini/token/' + (player.token || 'token_1.png');
            token.alt = player.nome || 'Giocatore';
            token.title = `${player.nome || 'PG'} · ${player.online ? 'online' : 'offline'} · X ${player.x} Y ${player.y}`;
            token.tabIndex = 0;
            token.addEventListener('click', () => openCharacterSheet(player.character_id));
            token.addEventListener('keydown', e => { if (e.key === 'Enter') openCharacterSheet(player.character_id); });
            place(token, player.x, player.y, tokenSize);
        });
}

const _masterOriginalLoadMasterControlCenterV18 = loadMasterControlCenter;
loadMasterControlCenter = async function () {
    await _masterOriginalLoadMasterControlCenterV18();
    try {
        await loadMasterPuzzacintaState();
    } catch (error) {
        console.warn('Master: aggiornamento Puzzacinta non riuscito:', error);
    }
    if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) {
        renderMasterOverviewMap();
    }
};

let masterPuzzacintaRefreshTimer = null;
window.addEventListener('DOMContentLoaded', () => {
    loadMasterPuzzacintaState().finally(() => {
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) {
            renderMasterOverviewMap();
        }
    });
    if (masterPuzzacintaRefreshTimer) clearInterval(masterPuzzacintaRefreshTimer);
    masterPuzzacintaRefreshTimer = setInterval(() => {
        loadMasterPuzzacintaState().finally(() => {
            if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) {
                renderMasterOverviewMap();
            }
        });
    }, 4000);
});
window.addEventListener('beforeunload', () => {
    if (masterPuzzacintaRefreshTimer) clearInterval(masterPuzzacintaRefreshTimer);
});

// ============================================================
// MASTER V20 — VENDOR / SERVIZI
// Tutte le scritture avvengono tramite RPC controllata dal Master.
// ============================================================

let masterServicesAdminRows = [];
let masterServicesLastRenderSignature = "";
let masterServicesLoading = false;
let masterServicesActionBusy = false;
let masterServicesLastFetch = 0;

function masterServicesIsVisible() {
    return !!document.querySelector('[data-master-control-pane="services"].is-active');
}

function masterServicesNotify(message, error = false) {
    const node = document.getElementById("master-services-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-error", error);
    node.classList.toggle("is-success", !!message && !error);
}

async function loadMasterServicesAdminPanel(force = false) {
    if (masterServicesLoading || masterServicesActionBusy) return;
    if (!force && Date.now() - masterServicesLastFetch < 12000) return;
    if (!force && !masterServicesIsVisible()) return;

    masterServicesLoading = true;
    const refreshButton = document.getElementById("master-services-refresh");
    if (refreshButton) refreshButton.disabled = true;
    try {
        const {data, error} = await db.rpc("master_get_base_services_state");
        if (error) throw error;
        masterServicesAdminRows = Array.isArray(data?.services) ? data.services : [];
        masterServicesLastFetch = Date.now();
        renderMasterControlServices(force);
        masterServicesNotify("");
    } catch (error) {
        console.error("Master: caricamento servizi amministrativi:", error);
        masterServicesNotify(
            `Servizi non disponibili: ${error?.message || "errore sconosciuto"}. ` +
            "Esegui prima master_servizi_rpc.sql nel SQL Editor di Supabase.", true);
    } finally {
        masterServicesLoading = false;
        if (refreshButton) refreshButton.disabled = false;
    }
}

function masterServiceElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
}

function masterServiceTimeUntil(deadline) {
    return deadline ? (formatMasterCooldown(deadline) || "00:00") : "N/D";
}

function masterServiceProgressList(requirements, type, service, enabled, subtitle) {
    const wrapper = masterServiceElement("div", "master-service-requirements");
    const title = masterServiceElement("div", "master-service-requirements-title", subtitle);
    wrapper.appendChild(title);
    const rows = Array.isArray(requirements) ? requirements : [];
    if (!rows.length) {
        wrapper.appendChild(masterServiceElement("div", "master-service-muted", "Nessun requisito configurato."));
        return wrapper;
    }
    rows.forEach(req => {
        const required = Math.max(0, Number(req.required_quantity) || 0);
        const contributed = Math.max(0, Number(req.contributed_quantity) || 0);
        const remaining = Math.max(0, required - contributed);
        const line = masterServiceElement("div", "master-service-resource-row");
        const heading = masterServiceElement("div", "master-service-resource-heading");
        heading.appendChild(masterServiceElement("span", "master-service-resource-name", req.item_name || req.item_id));
        heading.appendChild(masterServiceElement("span", "master-service-resource-count", `${contributed.toLocaleString("it-IT")} / ${required.toLocaleString("it-IT")}`));
        line.appendChild(heading);
        const progress = masterServiceElement("progress", "master-service-resource-progress");
        progress.max = Math.max(required, 1);
        progress.value = Math.min(contributed, Math.max(required, 1));
        line.appendChild(progress);

        if (enabled) {
            const controls = masterServiceElement("div", "master-service-resource-controls");
            const field = masterServiceElement("input", "master-service-resource-amount");
            field.type = "number";
            field.inputMode = "numeric";
            field.min = "1";
            field.step = "1";
            field.max = "1000000";
            field.value = "1";
            field.setAttribute("aria-label", `Quantità ${req.item_name || req.item_id}`);
            controls.appendChild(field);
            for (const deltaSign of [-1, 1]) {
                const button = masterServiceElement("button", "button secondary master-service-quantity-button", deltaSign < 0 ? "− TOGLI" : "+ AGGIUNGI");
                button.type = "button";
                button.disabled = deltaSign > 0 ? remaining === 0 : contributed === 0;
                button.title = deltaSign > 0 ? "Aggiungi risorse al progresso" : "Rimuovi risorse dal progresso";
                button.addEventListener("click", async () => {
                    const quantity = Number(field.value);
                    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) {
                        masterServicesNotify("Inserisci una quantità intera tra 1 e 1.000.000.", true);
                        return;
                    }
                    const delta = quantity * deltaSign;
                    const result = contributed + delta;
                    if (result < 0 || result > required) {
                        masterServicesNotify(`Quantità non consentita: il progresso deve essere compreso tra 0 e ${required}.`, true);
                        return;
                    }
                    const verb = deltaSign > 0 ? "AGGIUNGERE" : "TOGLIERE";
                    if (!window.confirm(`${verb} ${quantity} × ${req.item_name || req.item_id} dai requisiti di ${service.display_name}?\n\nL'operazione modifica il progresso del servizio, NON gli inventari dei giocatori.`)) return;
                    await masterServicesSubmit({
                        p_service_key: service.service_key,
                        p_action: type === "construction" ? "adjust_construction" : "adjust_upgrade",
                        p_item_id: req.item_id,
                        p_delta: delta
                    });
                });
                controls.appendChild(button);
            }
            line.appendChild(controls);
        }
        wrapper.appendChild(line);
    });
    return wrapper;
}

function masterServiceCard(entry) {
    const service = entry.service || {};
    const status = String(service.status || "unbuilt");
    const statusLevels = ["unbuilt", "building", "active"];
    const statusIndex = Math.max(0, statusLevels.indexOf(status));
    const level = Number(service.current_level) || 1;
    const name = service.display_name || service.service_key || "Servizio";

    const card = masterServiceElement("article", `master-service-card is-${status}`);
    const top = masterServiceElement("div", "master-service-card-head");
    const identity = masterServiceElement("div", "master-service-identity");
    const headline = masterServiceElement("div", "master-service-headline");
    headline.appendChild(masterServiceElement("h3", "master-service-name", name));
    headline.appendChild(masterServiceElement("span", "master-service-level", `LV ${level}`));
    identity.appendChild(headline);
    identity.appendChild(masterServiceElement("span", `master-service-state-label is-${status}`,
        status === "building" ? "IN COSTRUZIONE" : status === "active" ? "ATTIVO" : "DA COSTRUIRE"));
    top.appendChild(identity);

    const statusControls = masterServiceElement("div", "master-service-state-controls");
    const sliderLabel = masterServiceElement("label", "master-service-slider-caption", "Stato servizio");
    const slider = masterServiceElement("input", "master-service-state-slider");
    slider.type = "range";
    slider.min = "0";
    slider.max = "2";
    slider.step = "1";
    slider.value = String(statusIndex);
    slider.id = `master-service-slider-${service.service_key}`;
    sliderLabel.htmlFor = slider.id;
    slider.setAttribute("aria-label", `Stato ${name}`);
    const labels = masterServiceElement("div", "master-service-slider-labels");
    ["UNBUILT", "BUILDING", "ACTIVE"].forEach(t => labels.appendChild(masterServiceElement("span", "", t)));
    slider.addEventListener("change", async () => {
        const newState = statusLevels[Number(slider.value)] || status;
        if (newState === status) return;
        slider.value = String(statusIndex);
        const transitionInfo = newState === "unbuilt"
            ? "I progressi di COSTRUZIONE saranno azzerati e inizierà un nuovo ciclo. Il livello già raggiunto resterà invariato."
            : newState === "building"
                ? "Forzerai l'avvio della costruzione con il timer configurato, anche se i requisiti non sono completi."
                : "Forzerai l'attivazione immediata con una nuova riserva iniziale di durata.";
        if (!window.confirm(`Cambiare ${name} da ${status.toUpperCase()} a ${newState.toUpperCase()}?\n\n${transitionInfo}`)) return;
        await masterServicesSubmit({p_service_key:service.service_key,p_action:"set_state",p_state:newState});
    });
    statusControls.append(sliderLabel, slider, labels);
    top.appendChild(statusControls);
    card.appendChild(top);

    const body = masterServiceElement("div", "master-service-card-body");
    const timeBox = masterServiceElement("div", `master-service-time-box is-${status}`);
    const caption = status === "building" ? "COSTRUZIONE TERMINA TRA" : status === "active" ? "RESTERÀ ATTIVO PER" : "STATO DEL SERVIZIO";
    timeBox.appendChild(masterServiceElement("span", "master-service-time-caption", caption));
    const timeValue = masterServiceElement("strong", "master-service-time-value");
    const deadline = status === "building" ? service.construction_ready_at : (status === "active" ? service.maintenance_until : null);
    if (deadline) {
        timeValue.dataset.masterServiceDeadline = deadline;
        timeValue.textContent = masterServiceTimeUntil(deadline);
    } else {
        timeValue.textContent = status === "unbuilt" ? "INATTIVO" : "N/D";
    }
    timeBox.appendChild(timeValue);
    body.appendChild(timeBox);

    const constructionRequirements = entry.construction_requirements || [];
    body.appendChild(masterServiceProgressList(constructionRequirements, "construction", service, status === "unbuilt", "REQUISITI DI COSTRUZIONE"));

    if (status === "active") {
        const maintenance = masterServiceElement("div", "master-service-gold-box");
        maintenance.appendChild(masterServiceElement("strong", "master-service-gold-heading", "ESTENDI LA DURATA CON MONETE"));
        const goldRequired = constructionRequirements.find(req => req.item_id === "moneta_oro");
        const goldCost = Number(goldRequired?.required_quantity) || 0;
        const goldDescription = goldCost > 0
            ? `${goldCost.toLocaleString("it-IT")} monete = ${Math.max(1,Math.round((Number(service.maintenance_seconds)||28800)/3600))} ore. Accredito Master: non scala oro ai PG.`
            : "Costo in monete non configurato: estensione non disponibile.";
        maintenance.appendChild(masterServiceElement("small", "master-service-muted", goldDescription));
        const controls = masterServiceElement("div", "master-service-gold-controls");
        const field = masterServiceElement("input", "master-service-gold-input");
        field.type = "number";
        field.min = "1";
        field.max = "1000000";
        field.step = "1";
        field.inputMode = "numeric";
        field.placeholder = "Monete";
        field.setAttribute("aria-label", `Monete per estendere ${name}`);
        const addButton = masterServiceElement("button", "button master-service-gold-add", "+ AGGIUNGI MONETE");
        addButton.type = "button";
        addButton.disabled = goldCost <= 0;
        addButton.addEventListener("click", async () => {
            const coins = Number(field.value);
            if (!Number.isSafeInteger(coins) || coins < 1 || coins > 1000000) {
                masterServicesNotify("Inserisci un numero intero di monete tra 1 e 1.000.000.", true);
                return;
            }
            const seconds = coins * Number(service.maintenance_seconds) / goldCost;
            if (!window.confirm(`Accreditare ${coins.toLocaleString("it-IT")} monete a ${name} per estendere la durata di circa ${Math.round(seconds/60)} minuti?\n\nNessuna moneta verrà sottratta ai giocatori.`)) return;
            await masterServicesSubmit({p_service_key:service.service_key,p_action:"add_gold",p_gold:coins});
        });
        controls.append(field, addButton);
        maintenance.appendChild(controls);
        body.appendChild(maintenance);
    }

    const upgrade = entry.upgrade || {};
    const targetLevel = Number(upgrade.target_level) || 0;
    if (level >= Number(upgrade.max_level || 6)) {
        body.appendChild(masterServiceElement("div", "master-service-note", "Livello massimo raggiunto."));
    } else if (upgrade.enabled && targetLevel > level) {
        body.appendChild(masterServiceProgressList(upgrade.requirements, "upgrade", service, status === "active", `REQUISITI PER IL LIVELLO ${targetLevel}`));
        if (status !== "active") body.appendChild(masterServiceElement("div", "master-service-note", "Le risorse per l'upgrade sono modificabili quando il servizio è Active."));
    } else {
        body.appendChild(masterServiceElement("div", "master-service-note", `Upgrade al livello ${level + 1} non ancora abilitato nel gioco.`));
    }

    card.appendChild(body);
    return card;
}

function renderMasterControlServices(force = false) {
    const container = document.getElementById("master-control-services");
    if (!container) return;
    if (!masterServicesAdminRows.length) {
        if (!masterServicesLoading) container.textContent = "Caricamento servizi Master...";
        return;
    }
    // Non ricostruire le righe ogni quattro secondi mentre il Master sta scrivendo.
    const signature = JSON.stringify(masterServicesAdminRows);
    if (!force && signature === masterServicesLastRenderSignature) {
        updateMasterServiceCountdowns();
        return;
    }
    if (!force && container.contains(document.activeElement)) return;
    masterServicesLastRenderSignature = signature;
    container.replaceChildren();
    masterServicesAdminRows.forEach(entry => container.appendChild(masterServiceCard(entry)));
    updateMasterServiceCountdowns();
}

function updateMasterServiceCountdowns() {
    document.querySelectorAll("[data-master-service-deadline]").forEach(node => {
        node.textContent = masterServiceTimeUntil(node.dataset.masterServiceDeadline);
    });
}

async function masterServicesSubmit(payload) {
    if (masterServicesActionBusy) return;
    masterServicesActionBusy = true;
    const container = document.getElementById("master-control-services");
    container?.classList.add("is-saving");
    masterServicesNotify("Salvataggio in corso...");
    try {
        const {data, error} = await db.rpc("master_manage_base_service", payload);
        if (error) throw error;
        if (!data?.ok) throw new Error("Operazione non confermata dal server.");
        masterServicesNotify("Modifica applicata al servizio.");
    } catch (error) {
        console.error("Modifica servizio Master:", error);
        masterServicesNotify(`Modifica non salvata: ${error?.message || "errore sconosciuto"}`, true);
        return;
    } finally {
        masterServicesActionBusy = false;
        container?.classList.remove("is-saving");
    }
    masterServicesLastFetch = 0;
    masterServicesLastRenderSignature = "";
    await loadMasterServicesAdminPanel(true);
    // Sincronizza la Panoramica della Base già presente nel Master.
    await loadMasterControlServices();
}

const masterServicesOldSetTabV20 = setMasterControlTab;
setMasterControlTab = function (tab) {
    masterServicesOldSetTabV20(tab);
    if (tab === "services") loadMasterServicesAdminPanel(true);
};

const masterServicesOldControlLoadV20 = loadMasterControlCenter;
loadMasterControlCenter = async function () {
    await masterServicesOldControlLoadV20();
    if (masterServicesIsVisible()) await loadMasterServicesAdminPanel(true);
};

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("master-services-refresh")?.addEventListener("click", async () => {
        masterServicesLastFetch = 0;
        await loadMasterServicesAdminPanel(true);
    });
    const timer = window.setInterval(() => {
        if (!masterServicesIsVisible()) return;
        updateMasterServiceCountdowns();
        if (!masterServicesActionBusy) loadMasterServicesAdminPanel();
    }, 1000);
    window.addEventListener("beforeunload", () => window.clearInterval(timer), {once:true});
});

// ============================================================
// MASTER v21 — TAB COMBATTIMENTI
// Disponibile / Cooldown con RPC protetta, osservazione delle
// sessioni in corso e lista dei partecipanti reali.
// ============================================================

let masterCombatPanelRows = [];
let masterCombatPanelByEncounter = new Map();
let masterCombatPanelBusy = false;
let masterCombatPanelActionBusy = false;
let masterCombatPanelLastFetch = 0;
let masterCombatPanelSignature = '';
const MASTER_COMBAT_PANEL_REFRESH_MS = 8000;

function masterCombatPanelVisible() {
    return !!document.querySelector('[data-master-control-pane="combats"]')?.classList.contains('is-active');
}

function masterCombatPanelNotify(message, error = false) {
    const node = document.getElementById('master-combats-feedback');
    if (node) {
        node.textContent = message || '';
        node.classList.toggle('is-error', error);
    }
}

function masterCombatPanelNode(tag, className = '', content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = String(content);
    return node;
}

function masterCombatPanelTimeLeft(until) {
    const millis = Date.parse(until || '') - Date.now();
    if (!Number.isFinite(millis) || millis <= 0) return '00:00';
    const sec = Math.ceil(millis / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
             : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function loadMasterCombatPanel(force = false) {
    if (masterCombatPanelBusy || masterCombatPanelActionBusy) return;
    if (!force && Date.now() - masterCombatPanelLastFetch < MASTER_COMBAT_PANEL_REFRESH_MS) return;
    masterCombatPanelBusy = true;
    try {
        const {data, error} = await db.rpc('master_get_combat_panel_state');
        if (error) throw error;
        if (!data?.ok || !Array.isArray(data.encounters)) {
            throw new Error('Risposta non valida dal server.');
        }
        masterCombatPanelRows = data.encounters;
        masterCombatPanelByEncounter = new Map(masterCombatPanelRows.map(row => [row.encounter_id, row]));
        masterCombatPanelLastFetch = Date.now();
        masterCombatPanelNotify('');
        renderMasterCombatPanel();
        // Aggiorna la sola lettura dello stato della mappa, evitando
        // di ricavare il cooldown dalle sessioni storiche.
        if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) {
            renderMasterOverviewMap();
        }
    } catch (error) {
        console.error('Errore pannello combattimenti Master:',error);
        masterCombatPanelNotify(
            `Impossibile caricare i combattimenti: ${error?.message || 'errore di connessione'}. ` +
            'Verifica di aver eseguito master_combattimenti_rpc.sql.', true
        );
    } finally {
        masterCombatPanelBusy = false;
    }
}

function masterCombatPanelState(row) {
    const sessions = Array.isArray(row.sessions) ? row.sessions : [];
    if (sessions.length) return 'in_progress';
    if (row.special_event) return 'special';
    if (row.cooldown_until && Date.parse(row.cooldown_until) > Date.now()) return 'cooldown';
    return 'available';
}

function masterCombatPanelCard(row) {
    const state = masterCombatPanelState(row);
    const sessions = Array.isArray(row.sessions) ? row.sessions : [];
    const title = row.name || row.encounter_id;
    const card = masterCombatPanelNode('article',`master-combat-manage-card state-${state}`);
    const header = masterCombatPanelNode('div','master-combat-card-header');
    const identity = masterCombatPanelNode('div');
    identity.append(
        masterCombatPanelNode('h4','',title),
        masterCombatPanelNode('small','master-combat-id',row.encounter_id)
    );
    const pill = masterCombatPanelNode('span',`master-combat-pill is-${state}`,
        state === 'in_progress' ? 'IN CORSO'
        : state === 'cooldown' ? 'COOLDOWN'
        : state === 'special' ? 'EVENTO RARO' : 'DISPONIBILE'
    );
    header.append(identity,pill);
    card.appendChild(header);

    const body = masterCombatPanelNode('div','master-combat-card-body');
    if (state === 'in_progress') {
        const info = masterCombatPanelNode('div','master-combat-state-line');
        info.append(masterCombatPanelNode('span','',`${sessions.length} session${sessions.length===1?'e':'i'} in corso`),
                    masterCombatPanelNode('strong','','SLIDER BLOCCATO'));
        body.appendChild(info);
        const locked = masterCombatPanelNode('div','master-combat-slider-row');
        locked.appendChild(masterCombatPanelNode('span','master-combat-slider-label','ATTIVO'));
        const lockedSlider = masterCombatPanelNode('input','master-combat-state-slider');
        lockedSlider.type = 'range'; lockedSlider.min = '0'; lockedSlider.max = '1';
        lockedSlider.value = '0'; lockedSlider.disabled = true;
        lockedSlider.setAttribute('aria-label', `Cambio stato bloccato per ${title}: sessione in corso`);
        locked.appendChild(lockedSlider);
        locked.appendChild(masterCombatPanelNode('span','master-combat-slider-label','COOLDOWN'));
        body.appendChild(locked);
        sessions.forEach(session => {
            const box = masterCombatPanelNode('div','master-combat-session');
            const top = masterCombatPanelNode('div','master-combat-session-header');
            const details = masterCombatPanelNode('strong','',
                `${session.status === 'waiting' ? 'In attesa' : 'In combattimento'} · Round ${Number(session.round)||1}`);
            const watch = masterCombatPanelNode('button','button master-combat-watch','OSSERVA');
            watch.type = 'button';
            watch.addEventListener('click', () => openMasterCombat(session.id));
            top.append(details,watch);
            box.appendChild(top);
            box.appendChild(masterCombatPanelNode('div','master-combat-players-heading','PERSONAGGI PRESENTI'));
            const players = masterCombatPanelNode('div','master-combat-players');
            const participants = Array.isArray(session.participants) ? session.participants : [];
            if (participants.length) {
                participants.forEach(person => {
                    const player = masterCombatPanelNode('span','master-combat-person',person.name || 'Giocatore');
                    player.title = `Stato: ${person.status || 'non disponibile'}`;
                    players.appendChild(player);
                });
            } else {
                players.appendChild(masterCombatPanelNode('span','master-combat-players-empty','Nessun personaggio presente.'));
            }
            box.appendChild(players);
            body.appendChild(box);
        });
    } else if (state === 'special') {
        body.appendChild(masterCombatPanelNode('div','master-combat-help',
            'Questo combattimento si attiva attraverso Puzzacinta. Lo stato non è modificabile manualmente. Quando una sessione è in corso appariranno i personaggi e il pulsante Osserva.'));
    } else {
        const stateLine = masterCombatPanelNode('div','master-combat-state-line');
        stateLine.appendChild(masterCombatPanelNode('span','',state === 'cooldown' ? 'Disponibile tra' : 'Pronto per essere avviato'));
        const remaining = masterCombatPanelNode('strong',state === 'cooldown' ? 'is-cooldown' : '',state === 'cooldown' ? masterCombatPanelTimeLeft(row.cooldown_until) : 'PRONTO');
        if (state === 'cooldown') remaining.dataset.masterCombatDeadline = row.cooldown_until;
        stateLine.appendChild(remaining);
        body.appendChild(stateLine);

        const controls = masterCombatPanelNode('div','master-combat-state-controls');
        const sliderLine = masterCombatPanelNode('div','master-combat-slider-row');
        sliderLine.appendChild(masterCombatPanelNode('span','master-combat-slider-label','ATTIVO'));
        const slider = masterCombatPanelNode('input','master-combat-state-slider');
        slider.type='range'; slider.min='0'; slider.max='1';slider.step='1';
        slider.value=state === 'cooldown' ? '1':'0';
        slider.setAttribute('aria-label',`Stato di ${title}: attivo o cooldown`);
        sliderLine.appendChild(slider);
        sliderLine.appendChild(masterCombatPanelNode('span','master-combat-slider-label','COOLDOWN'));
        controls.appendChild(sliderLine);

        const editor = masterCombatPanelNode('div','master-combat-editor');
        const minutesLabel = masterCombatPanelNode('label','master-combat-minutes-label','Durata del cooldown (minuti)');
        const minutes = masterCombatPanelNode('input','master-combat-minutes-input');
        minutes.type='number'; minutes.min='1'; minutes.max='10080';minutes.step='1';minutes.inputMode='numeric';
        minutes.value = state === 'cooldown'
            ? String(Math.max(1,Math.ceil((Date.parse(row.cooldown_until) - Date.now()) / 60000)))
            : String(Number(row.suggested_cooldown_minutes) || 5);
        minutes.setAttribute('aria-label',`Minuti di cooldown per ${title}`);
        minutesLabel.appendChild(minutes);
        const apply = masterCombatPanelNode('button','button master-combat-apply','APPLICA');
        apply.type='button';
        editor.append(minutesLabel,apply);
        controls.appendChild(editor);

        const hint = masterCombatPanelNode('div','master-combat-help',
            'Spostare lo slider e confermare per aggiornare il cooldown del gioco.');
        controls.appendChild(hint);

        const updateControls = (dirty=false) => {
            const targetCooldown = slider.value === '1';
            const changed = targetCooldown !== (state === 'cooldown');
            minutesLabel.hidden = !targetCooldown;
            editor.hidden = !targetCooldown && !dirty && !changed;
            apply.hidden = !dirty && !changed;
            apply.textContent = targetCooldown ? 'IMPOSTA COOLDOWN' : 'RENDI DISPONIBILE';
            hint.textContent = targetCooldown
                ? 'Imposta i minuti e conferma per applicare un nuovo cooldown.'
                : changed
                    ? 'Conferma per annullare il cooldown e riattivare l’incontro.'
                    : 'Sposta lo slider su Cooldown per disattivare temporaneamente l’incontro.';
        };
        slider.addEventListener('input',()=>updateControls(true));
        minutes.addEventListener('input',()=>updateControls(true));
        updateControls(false);

        apply.addEventListener('click',async()=>{
            const selectedCooldown = slider.value === '1';
            const duration = selectedCooldown ? Number(minutes.value) : 0;
            if (!Number.isSafeInteger(duration) || duration < 0 || duration > 10080 || (selectedCooldown && duration===0)) {
                masterCombatPanelNotify('Inserisci una durata intera tra 1 e 10080 minuti.',true);
                return;
            }
            const message = duration===0
                ? `Rendere subito disponibile ${title}?\n\nIl cooldown verrà annullato.`
                : `Impostare ${duration} minuti di cooldown per ${title}?\n\nLa scadenza sarà calcolata dal momento del salvataggio.`;
            if (!window.confirm(message)) return;
            await masterCombatPanelSubmit(row.encounter_id,duration);
        });
        body.appendChild(controls);
    }
    card.appendChild(body);
    return card;
}

function renderMasterCombatPanel() {
    const container = document.getElementById('master-combats-overview');
    if (!container) return;
    const signature = JSON.stringify(masterCombatPanelRows);
    if (signature === masterCombatPanelSignature) {
        masterCombatPanelUpdateCountdowns();
        return;
    }
    if (container.contains(document.activeElement)) return;
    masterCombatPanelSignature=signature;
    container.replaceChildren();
    if (!masterCombatPanelRows.length) {
        container.appendChild(masterCombatPanelNode('div','master-control-empty','Nessun incontro configurato.'));
        return;
    }
    for (const [floor,groupName] of [['dungeon','PIANO 1'],['base','LIVELLO BASE']]) {
        const matches=masterCombatPanelRows.filter(row=>row.floor===floor);
        if (!matches.length) continue;
        const group=masterCombatPanelNode('section','master-combat-group');
        group.appendChild(masterCombatPanelNode('h4','master-combat-group-title',groupName));
        const grid=masterCombatPanelNode('div','master-combat-manage-grid');
        matches.forEach(row=>grid.appendChild(masterCombatPanelCard(row)));
        group.appendChild(grid);
        container.appendChild(group);
    }
    masterCombatPanelUpdateCountdowns();
}

function masterCombatPanelUpdateCountdowns() {
    document.querySelectorAll('[data-master-combat-deadline]').forEach(node=>{
        node.textContent=masterCombatPanelTimeLeft(node.dataset.masterCombatDeadline);
    });
}

async function masterCombatPanelSubmit(encounterId,minutes) {
    if (masterCombatPanelActionBusy) return;
    masterCombatPanelActionBusy=true;
    const container=document.getElementById('master-combats-overview');
    container?.classList.add('is-saving');
    masterCombatPanelNotify('Salvataggio stato combattimento...');
    try {
        const {data,error}=await db.rpc('master_set_combat_cooldown',{
            p_encounter_id:encounterId,p_minutes:minutes
        });
        if (error) throw error;
        if (!data?.ok) throw new Error('Il server non ha confermato la modifica.');
        masterCombatPanelSignature='';
        masterCombatPanelLastFetch=0;
        masterCombatPanelNotify('Stato aggiornato correttamente.');
    } catch (error) {
        masterCombatPanelNotify(`Modifica non salvata: ${error?.message || 'errore sconosciuto'}`,true);
        console.error('Master: cambio cooldown combat:',error);
        return;
    } finally {
        masterCombatPanelActionBusy=false;
        container?.classList.remove('is-saving');
    }
    await loadMasterCombatPanel(true);
    // Ricarica anche i cooldown tradizionali che supportano la mappa.
    await loadMasterCooldownStates();
    renderMasterOverviewMap();
}

// Il pannello e la mappa consumano la stessa origine dei cooldown,
// evitando countdown stimati da combattimenti storici.
const masterCombatPanelOldOverviewState = getMasterOverviewCombatState;
getMasterOverviewCombatState = function(event,floor) {
    const row = masterCombatPanelByEncounter.get(event?.encounter_id);
    if (!row || (Date.now()-masterCombatPanelLastFetch) > 45000) {
        return masterCombatPanelOldOverviewState(event,floor);
    }
    const state = masterCombatPanelState(row);
    if (state === 'in_progress') return {
        markerClass:'state-live',timerText:'',title:`${row.name || row.encounter_id} · in corso`
    };
    if (state === 'cooldown') return {
        markerClass:'state-cooldown',
        timerText:formatMasterCooldown(row.cooldown_until) || '',
        title:`${row.name || row.encounter_id} · cooldown`
    };
    if (state === 'available') return {
        markerClass:'state-active',timerText:'',title:`${row.name || row.encounter_id} · disponibile`
    };
    return masterCombatPanelOldOverviewState(event,floor);
};

const masterCombatPanelOldSetTab = setMasterControlTab;
setMasterControlTab = function(tab) {
    masterCombatPanelOldSetTab(tab);
    if (tab==='combats') loadMasterCombatPanel(true);
};

const masterCombatPanelOldLoadCenter = loadMasterControlCenter;
loadMasterControlCenter = async function () {
    await masterCombatPanelOldLoadCenter();
    if (masterCombatPanelVisible()) await loadMasterCombatPanel(true);
};

window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('master-combats-refresh')?.addEventListener('click',()=>{
        masterCombatPanelLastFetch=0;
        loadMasterCombatPanel(true);
    });
    const timer=window.setInterval(()=>{
        if (masterCombatPanelVisible() ||
            document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) {
            masterCombatPanelUpdateCountdowns();
            if (!masterCombatPanelActionBusy) loadMasterCombatPanel();
        }
    },1000);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
});

// ============================================================
// MASTER v22 — EVENTI / SEGRETI
// Le scritture vengono verificate dalle RPC SECURITY DEFINER Master.
// La scheda Dito di Scimmia è in sola lettura.
// ============================================================

const MASTER_EVENT_DEFINITIONS = [
    { id:'blade_corridor', title:'Trappola 1', subtitle:'Corridoio delle lame · Piano 1', icon:'⚠', kind:'trap' },
    { id:'acid_vapor', title:'Trappola 2', subtitle:'Vapore acido · Piano 1', icon:'⚠', kind:'trap' },
    { id:'puzzacinta_p1', title:'Puzzacinta', subtitle:'Evento raro · Piano 1', icon:'🧙', kind:'rare' },
    { id:'dito_scimmia', title:'Dito di Scimmia', subtitle:'Oggetto unico del Palazzo', icon:'☝️', kind:'finger' }
];
let masterEventAdminState = null;
let masterEventAdminBusy = false;
let masterEventAdminLastLoad = 0;
let masterEventAdminLoading = false;

function masterEventsPaneVisible() {
    return !!document.querySelector('[data-master-control-pane="events"]')?.classList.contains('is-active');
}
function masterEventsNotice(message, error=false) {
    const node = document.getElementById('master-events-feedback');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', !!error);
}
function masterEventsDuration(deadline) {
    const ms = deadline ? new Date(deadline).getTime() - Date.now() : NaN;
    if (!Number.isFinite(ms)) return '';
    if (ms <= 0) return '00:00';
    const total = Math.ceil(ms / 1000);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours
        ? `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
        : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}
function masterEventsRow(def) {
    const state = masterEventAdminState || {};
    if (def.kind === 'trap') {
        const data = (state.traps || []).find(row => row.trap_id === def.id);
        const enabled = data?.enabled !== false;
        const cooldownActive = !!(data?.disabled_until && Date.parse(data.disabled_until) > Date.now());
        return {
            enabled,
            status: enabled ? (cooldownActive ? 'COOLDOWN' : 'ATTIVA') : 'DISATTIVATA',
            detail: enabled
                ? (cooldownActive ? 'La trappola è in cooldown automatico, poi tornerà disponibile.' : 'La trappola può attivarsi quando un giocatore la attraversa.')
                : 'Disattivata dal Master: non può colpire i giocatori.',
            countdown: enabled && cooldownActive ? data.disabled_until : null
        };
    }
    if (def.kind === 'rare') {
        const data = state.puzzacinta || {};
        const enabled = data.enabled === true;
        return {
            enabled,
            status: enabled ? 'ABILITATO' : 'DISABILITATO',
            detail: enabled
                ? 'Le apparizioni programmate restano attive (ogni 4 ore).'
                : 'Le nuove apparizioni sono bloccate dal Master.',
            countdown: null
        };
    }
    const owners = Array.isArray(state.finger_owners) ? state.finger_owners : [];
    return {
        enabled:false,
        status: owners.length ? 'IN POSSESSO' : 'DISPONIBILE',
        detail: owners.length
            ? 'In mano a: ' + owners.map(owner => String(owner.name || 'PG sconosciuto')).join(', ')
            : 'Non risulta in possesso di alcun personaggio. Può essere raccolto.',
        countdown:null,
        readOnly:true
    };
}

function masterEventsRender() {
    const list = document.getElementById('master-events-management-list');
    if (!list) return;
    list.replaceChildren();
    if (!masterEventAdminState) {
        const placeholder=document.createElement('div');
        placeholder.className='master-control-empty';
        placeholder.textContent='I dati degli eventi non sono disponibili. Installa lo SQL v22 e riprova.';
        list.appendChild(placeholder);
        return;
    }

    for (const def of MASTER_EVENT_DEFINITIONS) {
        const state = masterEventsRow(def);
        const card = document.createElement('article');
        card.className=`master-event-admin-card ${state.enabled ? 'is-active' : 'is-disabled'}`;
        card.dataset.eventId=def.id;
        const header=document.createElement('div');
        header.className='master-event-admin-header';
        const title=document.createElement('div');
        title.className='master-event-admin-title';
        const icon=document.createElement('span');icon.className='master-event-admin-icon';icon.textContent=def.icon;
        const info=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=def.title;
        const subtitle=document.createElement('small');subtitle.textContent=def.subtitle;
        info.append(strong,subtitle);title.append(icon,info);
        const status=document.createElement('span');
        status.className=`master-event-admin-state ${state.enabled ? 'is-enabled' : ''}`;
        status.textContent=state.status;
        header.append(title,status);
        const detail=document.createElement('div');
        detail.className='master-event-admin-detail';
        detail.textContent=state.detail;
        if (def.kind === 'finger') detail.classList.add('master-event-finger-owners');
        const footer=document.createElement('div');footer.className='master-event-admin-footer';
        const footLabel=document.createElement('span');
        if (state.countdown) {
            footLabel.dataset.masterEventDeadline=state.countdown;
            footLabel.textContent='Cooldown: '+masterEventsDuration(state.countdown);
        } else {
            footLabel.textContent=def.kind==='rare' ? 'Controllo apparizioni programmate' :
                def.kind==='finger' ? 'Rilevamento automatico del possesso' : 'Cooldown naturale: 15 minuti';
        }
        footer.appendChild(footLabel);
        if (!state.readOnly) {
            const toggle=document.createElement('label');toggle.className='master-event-toggle';
            const input=document.createElement('input');
            input.type='checkbox';input.checked=state.enabled;input.disabled=masterEventAdminBusy;
            input.setAttribute('role','switch');
            input.setAttribute('aria-label',`Attiva o disattiva ${def.title}`);
            const track=document.createElement('span');track.className='master-event-toggle-track';
            track.setAttribute('aria-hidden','true');
            const text=document.createElement('span');text.textContent=state.enabled ? 'ON' : 'OFF';
            input.addEventListener('change',async()=>{
                const previous=state.enabled;
                const question=previous
                    ? `Disattivare ${def.title}?`
                    : `Attivare ${def.title}?`;
                if (!confirm(question)) {input.checked=previous;return;}
                await masterEventsToggle(def.id,!previous);
            });
            toggle.append(input,track,text);
            footer.appendChild(toggle);
        }
        card.append(header,detail,footer);
        list.appendChild(card);
    }
    masterEventsUpdateTimers();
}
function masterEventsUpdateTimers() {
    document.querySelectorAll('[data-master-event-deadline]').forEach(el=>{
        el.textContent='Cooldown: '+masterEventsDuration(el.dataset.masterEventDeadline);
    });
}
async function masterEventsLoad(force=false) {
    if (masterEventAdminLoading || masterEventAdminBusy) return;
    if (!force && Date.now()-masterEventAdminLastLoad < 11000) return;
    masterEventAdminLoading=true;
    try {
        const {data,error}=await db.rpc('master_get_event_controls');
        if (error) throw error;
        if (!data || !Array.isArray(data.traps)) throw new Error('Risposta del server non valida');
        masterEventAdminState=data;
        masterEventAdminLastLoad=Date.now();
        masterEventsRender();
        // La mappa e la scheda eventi devono concordare sullo stato Puzzacinta.
        if (masterPuzzacintaState && data.puzzacinta?.event_id === 'puzzacinta_p1') {
            masterPuzzacintaState.enabled = data.puzzacinta.enabled === true;
        }
        if (masterEventsPaneVisible()) masterEventsNotice('');
    } catch(error) {
        if (masterEventsPaneVisible()) masterEventsNotice(`Caricamento non riuscito: ${error?.message || 'errore sconosciuto'}`,true);
        console.error('Master v22: lettura eventi:',error);
        if (!masterEventAdminState) masterEventsRender();
    } finally {
        masterEventAdminLoading=false;
    }
}
async function masterEventsToggle(eventId,enabled) {
    if (masterEventAdminBusy) return;
    masterEventAdminBusy=true;
    masterEventsNotice('Salvataggio in corso...');
    masterEventsRender();
    try {
        const {data,error}=await db.rpc('master_set_event_enabled',{
            p_event_id:eventId,p_enabled:enabled
        });
        if (error) throw error;
        if (data?.ok !== true) throw new Error('Modifica non confermata dal server');
        masterEventAdminLastLoad=0;
        masterEventsNotice('Stato aggiornato correttamente.');
    } catch(error) {
        masterEventsNotice(`Modifica non salvata: ${error?.message || 'errore sconosciuto'}`,true);
        console.error('Master v22: cambio stato evento:',error);
    } finally {
        masterEventAdminBusy=false;
        masterEventAdminLastLoad=0;
        await masterEventsLoad(true);
    }
    if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) renderMasterOverviewMap();
}
// Stato amministrativo applicato anche alle icone sulla mappa.
const masterEventsOldOverviewTrapState=getMasterOverviewTrapState;
getMasterOverviewTrapState=function(event,coords) {
    const control=(masterEventAdminState?.traps || []).find(row=>row.trap_id===event?.id);
    if (control?.enabled===false) return {
        markerClass:'state-inactive',timerText:'',title:`${event?.id || 'Trappola'} · disattivata dal Master · ${coords}`
    };
    return masterEventsOldOverviewTrapState(event,coords);
};
const masterEventsOldOverviewRareState=getMasterOverviewPuzzacintaState;
getMasterOverviewPuzzacintaState=function() {
    if (masterEventAdminState?.puzzacinta?.enabled===false) return {
        markerClass:'state-inactive',timerText:'',title:'Puzzacinta · disabilitato dal Master'
    };
    return masterEventsOldOverviewRareState();
};

const masterEventsOldSetTab=setMasterControlTab;
setMasterControlTab=function(tab) {
    masterEventsOldSetTab(tab);
    if (tab==='events') masterEventsLoad(true);
};
const masterEventsOldLoadCenter=loadMasterControlCenter;
loadMasterControlCenter=async function() {
    await masterEventsOldLoadCenter();
    if (masterEventsPaneVisible()) await masterEventsLoad(true);
};
window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('master-events-refresh')?.addEventListener('click',()=>masterEventsLoad(true));
    const timer=window.setInterval(()=>{
        masterEventsUpdateTimers();
        if (masterEventsPaneVisible()) masterEventsLoad();
        else if (document.querySelector('[data-master-control-pane="overview"]')?.classList.contains('is-active')) masterEventsLoad();
    },1000);
    window.addEventListener('beforeunload',()=>clearInterval(timer),{once:true});
});
