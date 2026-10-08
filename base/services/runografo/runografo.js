// ============================================================
// PALAZZO ETERNO
// RUNOGRAFO.JS
// Posizione: base/services/runografo/runografo.js
// ============================================================

console.log("RUNOGRAFO.JS CARICATO");


// ============================================================
// COSTANTI
// ============================================================

const db =
    supabaseClient;

const SERVICE_KEY =
    "runografo";

const RUNOGRAFO_VENDOR_ID =
    "vendor_runografo";

// Per ora utilizziamo la stessa IA di Mano di Scimmia,
// come deciso per la prima versione.
const RUNOGRAFO_AI_NPC_ID =
    "npc_occhio_di_lince";

const BASE_PAGE =
    "../../base.html";

const MIN_SCROLL_SCORE =
    300;

const PALAZZO_MUSIC_VOLUME_KEY =
    "palazzo-eterno-dungeon-volume";


// ============================================================
// STATO
// ============================================================

let currentUser =
    null;

let character =
    null;

let characterInventory =
    [];

let runografoItems =
    [];

let servicePayload =
    null;

let upgradePayload =
    null;

let serviceTimer =
    null;

let pageBackgroundMusic =
    null;

let runografoMusicVolume =
    loadMusicVolume();

let aiVisitHistory =
    [];

let aiBusy =
    false;

let leavingPage =
    false;


// ============================================================
// AVVIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        startBackgroundMusic(
            "../../../music/runografo.mp3"
        );

        setupVolumeControl();

        try {

            await loadCharacter();

            if (!character) {
                return;
            }

            await refreshServiceState(
                true
            );

            if (
                servicePayload
                    ?.service
                    ?.status !==
                "active"
            ) {

                returnToBase();

                return;
            }

            /*
             * Il Runografo è un servizio del Livello Base:
             * current_location resta "base".
             */

            await loadCharacterInventory();

            await refreshUpgradeState();

            await loadRunografoItems();

            updateInventoryHeader();

            renderRunografoItems();

            renderServiceState();

            renderUpgradeState();

            setupMaintenanceForm();

            setupUpgradeContributions();

            setupAiChat();

            setupExitButton();

            startServiceTimer();

        } catch (error) {

            console.error(
                "Errore avvio Runografo:",
                error
            );

            showDialogue(
                error?.message ||
                "Il Runografo non riesce ad aprire il proprio archivio."
            );

        }

    }
);


// ============================================================
// PERSONAGGIO
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
            "../../../login.html";

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
                "characters"
            )
            .select(`
                id,
                nome,
                score,
                current_location
            `)
            .eq(
                "user_id",
                user.id
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {

        window.location.href =
            "../../../personaggio.html";

        return;
    }

    character =
        data;
}


async function setCharacterLocation(
    location
) {

    if (
        !character ||
        !character.id
    ) {
        return;
    }

    const {
        error
    } =
        await db
            .from(
                "characters"
            )
            .update({
                current_location:
                    location
            })
            .eq(
                "id",
                character.id
            );

    if (error) {
        throw error;
    }

    character.current_location =
        location;
}


// ============================================================
// INVENTARIO PG
// ============================================================

async function loadCharacterInventory() {

    if (!character) {

        characterInventory =
            [];

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
                quantity,
                equipped_slot,

                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    equip_slot,
                    heal_pf,
                    heal_pm,
                    gold_value,
                    grants_ability_id
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
}


function getGoldEntry() {

    return (
        characterInventory.find(
            entry => {

                const item =
                    entry?.item || {};

                const itemType =
                    String(
                        item.item_type ||
                        ""
                    ).toLowerCase();

                const itemName =
                    String(
                        item.name ||
                        ""
                    )
                        .trim()
                        .toLowerCase();

                return (
                    itemType ===
                        "currency"
                    ||
                    item.id ===
                        "moneta_oro"
                    ||
                    itemName ===
                        "moneta d'oro"
                    ||
                    itemName ===
                        "monete d'oro"
                );

            }
        )
        ||
        null
    );
}


function updateInventoryHeader() {

    const gold =
        document.getElementById(
            "player-gold-amount"
        );

    if (gold) {
        gold.textContent =
            String(
                getInventoryQuantity(
                    "moneta_oro"
                )
            );
    }
}


function getInventoryQuantity(
    itemId
) {

    return characterInventory
        .filter(
            entry =>
                entry?.item?.id ===
                    itemId
                &&
                !entry.equipped_slot
        )
        .reduce(
            (total, entry) =>
                total +
                (Number(entry.quantity) || 0),
            0
        );
}


// ============================================================
// CATALOGO RUNOGRAFO
// ============================================================

async function loadRunografoItems() {

    if (!character) {

        runografoItems =
            [];

        return;
    }

    const score =
        Math.max(
            0,
            Number(
                character.score
            ) || 0
        );

    if (
        score <
        MIN_SCROLL_SCORE
    ) {

        runografoItems =
            [];

        return;
    }

    const {
        data,
        error
    } =
        await db
            .from(
                "vendor_items"
            )
            .select(`
                id,
                vendor_id,
                item_id,
                buy_price,
                min_score,
                unlimited,

                item:items (
                    id,
                    name,
                    description,
                    item_type,
                    grants_ability_id
                )
            `)
            .eq(
                "vendor_id",
                RUNOGRAFO_VENDOR_ID
            )
            .gte(
                "min_score",
                MIN_SCROLL_SCORE
            )
            .lte(
                "min_score",
                score
            )
            .order(
                "buy_price",
                {
                    ascending:
                        true
                }
            );

    if (error) {
        throw error;
    }

    runografoItems =
        (data || [])
            .filter(
                row =>
                    row?.item
                    &&
                    row.item
                        .grants_ability_id
            );
}


function renderRunografoItems() {

    const container =
        document.getElementById(
            "runografo-stock"
        );

    if (!container) {
        return;
    }

    const score =
        Math.max(
            0,
            Number(
                character?.score
            ) || 0
        );

    if (
        score <
        MIN_SCROLL_SCORE
    ) {

        container.innerHTML = `
            <div class="inventory-empty">
                Il Runografo ti osserva in silenzio.
                Le pergamene abilità saranno disponibili
                quando avrai raggiunto score ${MIN_SCROLL_SCORE}.
            </div>
        `;

        return;
    }

    if (!runografoItems.length) {

        container.innerHTML = `
            <div class="inventory-empty">
                Nessuna pergamena disponibile.
            </div>
        `;

        return;
    }

    container.innerHTML =
        runografoItems
            .map(
                row => {

                    const price =
                        Math.max(
                            0,
                            Number(
                                row.buy_price
                            ) || 0
                        );

                    return `
                        <article
                            class="vendor-stock-item"
                            data-item-id="${escapeHtml(
                                row.item_id
                            )}"
                        >

                            <div class="vendor-stock-name">
                                ${escapeHtml(
                                    row.item.name ||
                                    row.item_id
                                )}
                            </div>

                            <div class="vendor-stock-price">
                                ${price}
                            </div>

                            <button
                                class="merchant-button runografo-buy-button"
                                type="button"
                                data-item-id="${escapeHtml(
                                    row.item_id
                                )}"
                                data-price="${price}"
                            >
                                COMPRA
                            </button>

                        </article>
                    `;
                }
            )
            .join("");
}


// ============================================================
// ACQUISTO PERGAMENA
// ============================================================

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".runografo-buy-button"
            );

        if (!button) {
            return;
        }

        buyRunografoItem(
            button
        );

    }
);


async function buyRunografoItem(
    button
) {

    if (
        !button ||
        button.disabled
    ) {
        return;
    }

    const itemId =
        String(
            button.dataset.itemId ||
            ""
        );

    if (!itemId) {
        return;
    }

    const price =
        Math.max(
            0,
            Number(
                button.dataset.price
            ) || 0
        );

    const originalText =
        button.textContent;

    try {

        await ensureServiceActive();

        button.disabled =
            true;

        button.textContent =
            "...";

        const {
            data,
            error
        } =
            await db.rpc(
                "vendor_buy_item",
                {
                    p_vendor_id:
                        RUNOGRAFO_VENDOR_ID,

                    p_item_id:
                        itemId
                }
            );

        if (error) {
            throw error;
        }

        await loadCharacterInventory();

        updateInventoryHeader();

        renderCharacterInventory();

        const item =
            runografoItems.find(
                row =>
                    row.item_id ===
                    itemId
            );

        const itemName =
            item?.item?.name ||
            itemId;

        showDialogue(
            `${itemName}. La runa ora è tua. Prezzo: ${price} monete d'oro.`
        );

        console.log(
            "Acquisto Runografo completato:",
            data
        );

    } catch (error) {

        console.error(
            "Errore acquisto Runografo:",
            error
        );

        showDialogue(
            error?.message ||
            "La runa rifiuta di legarsi a te."
        );

    } finally {

        button.disabled =
            false;

        button.textContent =
            originalText;
    }
}


// ============================================================
// STATO SERVIZIO
// ============================================================

async function refreshServiceState(
    redirectIfInactive = false
) {

    const {
        data,
        error
    } =
        await db.rpc(
            "get_base_service_state",
            {
                p_service_key:
                    SERVICE_KEY
            }
        );

    if (error) {
        throw error;
    }

    servicePayload =
        data || null;

    if (
        redirectIfInactive
        &&
        servicePayload
            ?.service
            ?.status !==
        "active"
    ) {

        returnToBase();
    }

    return servicePayload;
}


async function ensureServiceActive() {

    await refreshServiceState(
        false
    );

    if (
        servicePayload
            ?.service
            ?.status !==
        "active"
    ) {

        returnToBase();

        throw new Error(
            "Il Runografo non è più attivo."
        );
    }
}


// ============================================================
// STATO UPGRADE
// ============================================================

async function refreshUpgradeState() {
    const { data, error } =
        await db.rpc(
            "get_base_service_upgrade_state",
            { p_service_key: SERVICE_KEY }
        );

    if (error) {
        throw error;
    }

    upgradePayload = data || null;
    return upgradePayload;
}


function renderUpgradeState() {
    const levelElement = document.getElementById("runografo-upgrade-level");
    const statusElement = document.getElementById("runografo-upgrade-status");
    const container = document.getElementById("runografo-upgrade-requirements");

    if (!container) return;

    const currentLevel = Math.max(1, Number(upgradePayload?.current_level) || 1);
    const maxLevel = Math.max(1, Number(upgradePayload?.max_level) || 6);
    const targetLevel = Number(upgradePayload?.target_level);
    const enabled = upgradePayload?.enabled === true;
    const requirements = Array.isArray(upgradePayload?.requirements)
        ? upgradePayload.requirements
        : [];

    if (levelElement) {
        levelElement.textContent = currentLevel >= maxLevel
            ? `LV ${currentLevel} · MASSIMO`
            : `LV ${currentLevel} → LV ${targetLevel || currentLevel + 1}`;
    }

    if (statusElement) {
        statusElement.classList.remove("is-complete");
        if (currentLevel >= maxLevel) {
            statusElement.textContent = "COMPLETO";
            statusElement.classList.add("is-complete");
        } else if (!enabled) {
            statusElement.textContent = "NON DISPONIBILE";
        } else {
            statusElement.textContent = "IN CORSO";
        }
    }

    if (currentLevel >= maxLevel) {
        container.innerHTML = `<div class="inventory-empty">Il Runografo ha raggiunto il livello massimo.</div>`;
        return;
    }

    if (!enabled || requirements.length === 0) {
        container.innerHTML = `<div class="inventory-empty">I requisiti per il prossimo livello non sono ancora stati definiti.</div>`;
        return;
    }

    container.innerHTML = requirements.map(requirement => {
        const itemId = String(requirement.item_id || "");
        const itemName = String(requirement.item_name || itemId);
        const required = Math.max(0, Number(requirement.required_quantity) || 0);
        const contributed = Math.max(0, Number(requirement.contributed_quantity) || 0);
        const remaining = Math.max(0, required - contributed);
        const owned = getInventoryQuantity(itemId);
        const percentage = required > 0
            ? Math.min(100, Math.round(contributed / required * 100))
            : 0;
        const complete = remaining <= 0;

        return `
            <article class="runografo-upgrade-requirement${complete ? " is-complete" : ""}">
                <div class="runografo-upgrade-row">
                    <strong>${escapeHtml(itemName)}</strong>
                    <span>${contributed} / ${required}</span>
                </div>

                <div class="runografo-upgrade-progress">
                    <span style="width:${percentage}%"></span>
                </div>

                <div class="runografo-upgrade-owned">
                    Possiedi: <strong>${owned}</strong>
                </div>

                ${complete
                    ? `<div class="runografo-upgrade-complete">REQUISITO COMPLETO</div>`
                    : `
                        <form class="runografo-upgrade-form" data-item-id="${escapeHtml(itemId)}">
                            <input
                                class="runografo-upgrade-quantity"
                                type="number"
                                min="1"
                                max="${remaining}"
                                step="1"
                                value="1"
                                inputmode="numeric"
                                aria-label="Quantità di ${escapeHtml(itemName)} da contribuire"
                            >
                            <button
                                type="submit"
                                class="merchant-button runografo-upgrade-button"
                                ${owned <= 0 ? "disabled" : ""}
                            >
                                CONTRIBUISCI
                            </button>
                        </form>
                    `}
            </article>
        `;
    }).join("");
}


function setupUpgradeContributions() {
    const container = document.getElementById("runografo-upgrade-requirements");
    if (!container) return;

    container.addEventListener("submit", async event => {
        const form = event.target.closest(".runografo-upgrade-form");
        if (!form) return;

        event.preventDefault();
        await contributeToUpgrade(form);
    });
}


async function contributeToUpgrade(form) {
    const itemId = String(form?.dataset?.itemId || "");
    const input = form?.querySelector(".runografo-upgrade-quantity");
    const button = form?.querySelector(".runografo-upgrade-button");
    const quantity = Math.floor(Number(input?.value));

    if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
        setUpgradeFeedback("Inserisci una quantità valida.", true);
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "...";
    }

    try {
        await ensureServiceActive();

        const { data, error } = await db.rpc(
            "contribute_to_base_service_upgrade",
            {
                p_service_key: SERVICE_KEY,
                p_item_id: itemId,
                p_quantity: quantity
            }
        );

        if (error) throw error;

        await loadCharacterInventory();
        await refreshUpgradeState();

        updateInventoryHeader();
        renderUpgradeState();

        const contributed = Math.max(0, Number(data?.quantity_contributed) || quantity);

        if (data?.upgraded === true) {
            setUpgradeFeedback(`Upgrade completato: Runografo LV ${Number(data?.current_level) || "?"}.`);
            showDialogue("Le rune si accendono. Il Runografo ha raggiunto un nuovo livello.");
        } else {
            setUpgradeFeedback(`${contributed} unità consegnate al potenziamento.`);
        }

    } catch (error) {
        console.error("Errore contributo upgrade Runografo:", error);
        setUpgradeFeedback(error?.message || "Non è stato possibile registrare il contributo.", true);
    } finally {
        if (button && button.isConnected) {
            button.disabled = false;
            button.textContent = "CONTRIBUISCI";
        }
    }
}


function setUpgradeFeedback(message, isError = false) {
    const feedback = document.getElementById("runografo-upgrade-feedback");
    if (!feedback) return;

    feedback.textContent = message || "";
    feedback.classList.toggle("is-error", Boolean(isError));
}


// ============================================================
// TIMER RISERVA
// ============================================================

function getServerOffset(
    payload
) {

    if (!payload) {
        return 0;
    }

    if (
        Number.isFinite(
            payload._serverOffsetMs
        )
    ) {

        return payload
            ._serverOffsetMs;
    }

    const serverNow =
        Date.parse(
            payload.server_now
        );

    if (
        !Number.isFinite(
            serverNow
        )
    ) {

        payload._serverOffsetMs =
            0;

        return 0;
    }

    payload._serverOffsetMs =
        serverNow -
        Date.now();

    return payload
        ._serverOffsetMs;
}


function getEffectiveNow() {

    return (
        Date.now()
        +
        getServerOffset(
            servicePayload
        )
    );
}


function getRemainingMaintenanceMs() {

    const target =
        Date.parse(
            servicePayload
                ?.service
                ?.maintenance_until
        );

    if (
        !Number.isFinite(
            target
        )
    ) {

        return 0;
    }

    return Math.max(
        0,
        target -
        getEffectiveNow()
    );
}


function getGoldRequirement() {

    return (
        servicePayload
            ?.requirements
            ?.find(
                row =>
                    row.item_id ===
                    "moneta_oro"
            )
        ||
        null
    );
}


function getEquivalentReserveGold() {

    const remainingMs =
        getRemainingMaintenanceMs();

    const maintenanceSeconds =
        Math.max(
            0,
            Number(
                servicePayload
                    ?.service
                    ?.maintenance_seconds
            ) || 0
        );

    const goldRequirement =
        Math.max(
            0,
            Number(
                getGoldRequirement()
                    ?.required_quantity
            ) || 0
        );

    if (
        maintenanceSeconds <= 0
        ||
        goldRequirement <= 0
    ) {

        return 0;
    }

    return Math.max(
        0,
        (
            remainingMs /
            1000 /
            maintenanceSeconds
        )
        *
        goldRequirement
    );
}


function formatDuration(
    milliseconds
) {

    const totalSeconds =
        Math.max(
            0,
            Math.ceil(
                milliseconds /
                1000
            )
        );

    const hours =
        Math.floor(
            totalSeconds /
            3600
        );

    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );

    const seconds =
        totalSeconds %
        60;

    return (
        String(hours)
            .padStart(2, "0")
        +
        ":"
        +
        String(minutes)
            .padStart(2, "0")
        +
        ":"
        +
        String(seconds)
            .padStart(2, "0")
    );
}


function renderServiceState() {

    const timeElement =
        document.getElementById(
            "runografo-service-time"
        );

    const goldElement =
        document.getElementById(
            "runografo-service-gold"
        );

    if (timeElement) {

        timeElement.textContent =
            formatDuration(
                getRemainingMaintenanceMs()
            );
    }

    if (goldElement) {

        goldElement.textContent =
            String(
                Math.ceil(
                    getEquivalentReserveGold()
                )
            );
    }
}


function startServiceTimer() {

    if (serviceTimer) {

        clearInterval(
            serviceTimer
        );
    }

    serviceTimer =
        setInterval(
            async () => {

                if (
                    leavingPage
                ) {
                    return;
                }

                renderServiceState();

                if (
                    getRemainingMaintenanceMs() <=
                    0
                ) {

                    try {

                        await refreshServiceState(
                            false
                        );

                        if (
                            servicePayload
                                ?.service
                                ?.status !==
                            "active"
                        ) {

                            returnToBase();
                        }

                    } catch (error) {

                        console.warn(
                            "Errore aggiornamento servizio:",
                            error
                        );
                    }
                }

            },
            1000
        );
}


// ============================================================
// ALIMENTA RISERVA
// ============================================================

function setupMaintenanceForm() {

    const form =
        document.getElementById(
            "runografo-maintenance-form"
        );

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            await addMaintenanceGold();

        }
    );
}


async function addMaintenanceGold() {

    const input =
        document.getElementById(
            "runografo-maintenance-quantity"
        );

    const button =
        document.getElementById(
            "runografo-maintenance-button"
        );

    const feedback =
        document.getElementById(
            "runografo-maintenance-feedback"
        );

    const quantity =
        Math.floor(
            Number(
                input?.value
            )
        );

    if (
        !Number.isFinite(
            quantity
        )
        ||
        quantity <= 0
    ) {

        setMaintenanceFeedback(
            "Inserisci una quantità valida.",
            true
        );

        return;
    }

    if (button) {

        button.disabled =
            true;

        button.textContent =
            "...";
    }

    try {

        await ensureServiceActive();

        const {
            data,
            error
        } =
            await db.rpc(
                "contribute_to_base_service",
                {
                    p_service_key:
                        SERVICE_KEY,

                    p_item_id:
                        "moneta_oro",

                    p_quantity:
                        quantity
                }
            );

        if (error) {
            throw error;
        }

        servicePayload =
            data || servicePayload;

        await loadCharacterInventory();

        updateInventoryHeader();

        renderServiceState();

        renderUpgradeState();

        setMaintenanceFeedback(
            `${quantity} monete aggiunte alla riserva.`
        );

        if (input) {
            input.value =
                "1";
        }

    } catch (error) {

        console.error(
            "Errore alimentazione riserva:",
            error
        );

        setMaintenanceFeedback(
            error?.message ||
            "Non è stato possibile alimentare la riserva.",
            true
        );

    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "ALIMENTA RISERVA";
        }
    }
}


function setMaintenanceFeedback(
    message,
    isError = false
) {

    const feedback =
        document.getElementById(
            "runografo-maintenance-feedback"
        );

    if (!feedback) {
        return;
    }

    feedback.textContent =
        message || "";

    feedback.classList.toggle(
        "is-error",
        Boolean(isError)
    );
}


// ============================================================
// IA TEMPORANEA
// ============================================================

function setupAiChat() {

    const form =
        document.getElementById(
            "vendor-ai-form"
        );

    const input =
        document.getElementById(
            "vendor-ai-input"
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

            await sendAiMessage();

        }
    );

    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                input.value =
                    "";

                input.blur();
            }
        }
    );
}



function isPalaceOriginQuestion(message) {
    const normalized = String(message || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const directPhrases = [
        "come sono finito qui",
        "come sono arrivato qui",
        "perche sono qui",
        "perche mi trovo qui",
        "cosa ci faccio qui",
        "chi mi ha portato qui",
        "come sono finito nel palazzo",
        "come sono arrivato nel palazzo",
        "come sono entrato nel palazzo",
        "perche sono nel palazzo",
        "perche mi trovo nel palazzo"
    ];

    if (directPhrases.some(phrase => normalized.includes(phrase))) return true;

    const asksHow = normalized.includes("come") || normalized.includes("perche") || normalized.includes("chi");
    const aboutArrival = normalized.includes("finito") || normalized.includes("arrivato") || normalized.includes("portato") || normalized.includes("entrato") || normalized.includes("trovo");
    const aboutPlace = normalized.includes("qui") || normalized.includes("palazzo");

    return asksHow && aboutArrival && aboutPlace;
}

async function sendAiMessage() {

    if (aiBusy) {
        return;
    }

    const input =
        document.getElementById(
            "vendor-ai-input"
        );

    const button =
        document.getElementById(
            "vendor-ai-send"
        );

    const message =
        String(
            input?.value ||
            ""
        )
            .trim()
            .slice(
                0,
                500
            );

    if (
        !message ||
        !input ||
        !button
    ) {
        return;
    }

    if (isPalaceOriginQuestion(message)) {
        input.value = "";
        const reply = "Non è una domanda per me. Chiedilo a Mano di Scimmia.";
        aiVisitHistory.push({ role: "user", content: message }, { role: "assistant", content: reply });
        aiVisitHistory = aiVisitHistory.slice(-12);
        showDialogue(reply);
        return;
    }

    aiBusy =
        true;

    input.disabled =
        true;

    button.disabled =
        true;

    button.textContent =
        "...";

    input.value =
        "";

    showDialogue(
        "Il Runografo ti osserva per un momento..."
    );

    try {

        const {
            data,
            error
        } =
            await db.functions.invoke(
                "vendor-ai",
                {
                    body: {
                        npc_id:
                            RUNOGRAFO_AI_NPC_ID,

                        message:
                            message,

                        history:
                            aiVisitHistory
                    }
                }
            );

        if (error) {

            let detail =
                error.message ||
                "Errore nella chiamata alla funzione.";

            if (
                error.context
                &&
                typeof error.context.json ===
                    "function"
            ) {

                try {

                    const body =
                        await error.context.json();

                    if (
                        body?.error
                    ) {

                        detail =
                            body.error;
                    }

                } catch (_) {
                    // Mantiene il messaggio precedente.
                }
            }

            throw new Error(
                detail
            );
        }

        const reply =
            String(
                data?.reply ||
                ""
            )
                .trim();

        if (!reply) {

            throw new Error(
                "Il Runografo non risponde."
            );
        }

        aiVisitHistory.push(
            {
                role:
                    "user",

                content:
                    message
            },
            {
                role:
                    "assistant",

                content:
                    reply
            }
        );

        aiVisitHistory =
            aiVisitHistory.slice(
                -10
            );

        showDialogue(
            reply
        );

    } catch (error) {

        console.error(
            "Errore IA Runografo:",
            error
        );

        showDialogue(
            `Qualcosa disturba le rune. (${error.message || "errore sconosciuto"})`
        );

    } finally {

        aiBusy =
            false;

        input.disabled =
            false;

        button.disabled =
            false;

        button.textContent =
            "PARLA";

        input.focus();
    }
}


// ============================================================
// USCITA
// ============================================================

function setupExitButton() {

    const button =
        document.getElementById(
            "vendor-exit-button"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;

            try {

                await setCharacterLocation(
                    "base"
                );

            } catch (error) {

                console.warn(
                    "Impossibile aggiornare current_location:",
                    error
                );
            }

            returnToBase();
        }
    );
}


function returnToBase() {

    if (leavingPage) {
        return;
    }

    leavingPage =
        true;

    if (serviceTimer) {

        clearInterval(
            serviceTimer
        );

        serviceTimer =
            null;
    }

    window.location.href =
        BASE_PAGE;
}


// ============================================================
// DIALOGO
// ============================================================

function showDialogue(
    message
) {

    const element =
        document.getElementById(
            "vendor-dialogue-text"
        );

    if (element) {

        element.textContent =
            String(
                message ||
                ""
            );
    }
}


// ============================================================
// MUSICA
// ============================================================

function loadMusicVolume() {

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
            Number(saved);

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


function saveMusicVolume(
    value
) {

    try {

        localStorage.setItem(
            PALAZZO_MUSIC_VOLUME_KEY,
            String(value)
        );

    } catch (error) {
        // localStorage può essere disabilitato.
    }
}


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
        new Audio(source);

    pageBackgroundMusic.loop =
        true;

    pageBackgroundMusic.volume =
        runografoMusicVolume;

    pageBackgroundMusic.preload =
        "auto";

    const tryPlay =
        async () => {

            if (!pageBackgroundMusic) {
                return;
            }

            try {

                await pageBackgroundMusic.play();

            } catch (error) {
                // Autoplay bloccato.
            }
        };

    tryPlay();

    document.addEventListener(
        "pointerdown",
        tryPlay,
        {
            once:
                true
        }
    );

    document.addEventListener(
        "keydown",
        tryPlay,
        {
            once:
                true
        }
    );
}


function getVolumeIcon(
    volume
) {

    if (
        volume <=
        0
    ) {

        return "🔇";
    }

    if (
        volume <
        0.5
    ) {

        return "🔉";
    }

    return "🔊";
}


function updateVolumeUi() {

    const button =
        document.getElementById(
            "vendor-volume-button"
        );

    const slider =
        document.getElementById(
            "vendor-volume-slider"
        );

    const value =
        document.getElementById(
            "vendor-volume-value"
        );

    const percentage =
        Math.round(
            runografoMusicVolume *
            100
        );

    if (button) {

        button.textContent =
            getVolumeIcon(
                runografoMusicVolume
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


function setupVolumeControl() {

    const control =
        document.querySelector(
            ".vendor-volume-control"
        );

    const button =
        document.getElementById(
            "vendor-volume-button"
        );

    const popover =
        document.getElementById(
            "vendor-volume-popover"
        );

    const slider =
        document.getElementById(
            "vendor-volume-slider"
        );

    if (
        !control ||
        !button ||
        !popover ||
        !slider
    ) {
        return;
    }

    updateVolumeUi();

    button.addEventListener(
        "click",
        event => {

            event.preventDefault();

            event.stopPropagation();

            const open =
                popover.hidden ===
                true;

            popover.hidden =
                !open;

            button.setAttribute(
                "aria-expanded",
                open
                    ? "true"
                    : "false"
            );
        }
    );

    slider.addEventListener(
        "input",
        () => {

            runografoMusicVolume =
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
                pageBackgroundMusic
            ) {

                pageBackgroundMusic.volume =
                    runografoMusicVolume;
            }

            saveMusicVolume(
                runografoMusicVolume
            );

            updateVolumeUi();
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
// UTILITY
// ============================================================

function escapeHtml(
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
