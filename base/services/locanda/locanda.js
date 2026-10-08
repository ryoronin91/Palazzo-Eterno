// ============================================================
// PALAZZO ETERNO
// LOCANDA.JS
// Posizione: base/services/locanda/locanda.js
// ============================================================

console.log("LOCANDA.JS CARICATO");


// ============================================================
// COSTANTI
// ============================================================

const db =
    supabaseClient;

const SERVICE_KEY =
    "locanda";

const LOCANDA_VENDOR_ID =
    "vendor_locanda";

const LOCANDA_AI_NPC_ID =
    "npc_fegato_d_oca";

const BASE_PAGE =
    "../../base.html";

const HOT_MEAL_PRICE =
    25;

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

let servicePayload =
    null;

let upgradePayload =
    null;

let innPayload =
    null;

let serviceTimer =
    null;

let innTimer =
    null;

let innTickBusy =
    false;

let pageBackgroundMusic =
    null;

let locandaMusicVolume =
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
            "../../../music/locanda.mp3"
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

            await loadCharacterInventory();

            await refreshUpgradeState();

            await enterInn();

            updateGoldHeader();

            renderServiceState();

            renderUpgradeState();

            renderInnState();

            setupMaintenanceForm();

            setupUpgradeContributions();

            setupHotMeal();

            setupAiChat();

            setupExitButton();

            startServiceTimer();

            startInnTimer();

        } catch (error) {

            console.error(
                "Errore avvio Locanda:",
                error
            );

            showDialogue(
                error?.message ||
                "Fegato d'Oca non riesce ad accoglierti in questo momento."
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
// INVENTARIO / ORO
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
                    item_type,
                    gold_value
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
                (
                    Number(
                        entry.quantity
                    ) || 0
                ),
            0
        );
}


function updateGoldHeader() {

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
            "La Locanda non è più attiva."
        );
    }
}


// ============================================================
// STATO UPGRADE
// ============================================================

async function refreshUpgradeState() {

    const {
        data,
        error
    } =
        await db.rpc(
            "get_base_service_upgrade_state",
            {
                p_service_key:
                    SERVICE_KEY
            }
        );

    if (error) {
        throw error;
    }

    upgradePayload =
        data || null;

    return upgradePayload;
}


function renderUpgradeState() {

    const levelElement =
        document.getElementById(
            "locanda-upgrade-level"
        );

    const statusElement =
        document.getElementById(
            "locanda-upgrade-status"
        );

    const container =
        document.getElementById(
            "locanda-upgrade-requirements"
        );

    if (!container) {
        return;
    }

    const currentLevel =
        Math.max(
            1,
            Number(
                upgradePayload
                    ?.current_level
            ) || 1
        );

    const maxLevel =
        Math.max(
            1,
            Number(
                upgradePayload
                    ?.max_level
            ) || 6
        );

    const targetLevel =
        Number(
            upgradePayload
                ?.target_level
        );

    const enabled =
        upgradePayload
            ?.enabled ===
        true;

    const requirements =
        Array.isArray(
            upgradePayload
                ?.requirements
        )
            ? upgradePayload
                .requirements
            : [];

    if (levelElement) {

        levelElement.textContent =
            currentLevel >=
                maxLevel
                ? `LV ${currentLevel} · MASSIMO`
                : `LV ${currentLevel} → LV ${targetLevel || currentLevel + 1}`;
    }

    if (statusElement) {

        statusElement.classList.remove(
            "is-complete"
        );

        if (
            currentLevel >=
            maxLevel
        ) {

            statusElement.textContent =
                "COMPLETO";

            statusElement.classList.add(
                "is-complete"
            );

        } else if (
            !enabled
        ) {

            statusElement.textContent =
                "NON DISPONIBILE";

        } else {

            statusElement.textContent =
                "IN CORSO";
        }
    }

    if (
        currentLevel >=
        maxLevel
    ) {

        container.innerHTML = `
            <div class="inventory-empty">
                La Locanda ha raggiunto il livello massimo.
            </div>
        `;

        return;
    }

    if (
        !enabled
        ||
        requirements.length ===
            0
    ) {

        container.innerHTML = `
            <div class="inventory-empty">
                I requisiti per il prossimo livello
                non sono ancora stati definiti.
            </div>
        `;

        return;
    }

    container.innerHTML =
        requirements
            .map(
                requirement => {

                    const itemId =
                        String(
                            requirement
                                .item_id ||
                            ""
                        );

                    const itemName =
                        String(
                            requirement
                                .item_name ||
                            itemId
                        );

                    const required =
                        Math.max(
                            0,
                            Number(
                                requirement
                                    .required_quantity
                            ) || 0
                        );

                    const contributed =
                        Math.max(
                            0,
                            Number(
                                requirement
                                    .contributed_quantity
                            ) || 0
                        );

                    const remaining =
                        Math.max(
                            0,
                            required -
                            contributed
                        );

                    const owned =
                        getInventoryQuantity(
                            itemId
                        );

                    const percentage =
                        required > 0
                            ? Math.min(
                                100,
                                Math.round(
                                    contributed /
                                    required *
                                    100
                                )
                            )
                            : 0;

                    const complete =
                        remaining <=
                        0;

                    return `
                        <article
                            class="locanda-upgrade-requirement${
                                complete
                                    ? " is-complete"
                                    : ""
                            }"
                        >

                            <div class="locanda-upgrade-row">

                                <strong>
                                    ${escapeHtml(
                                        itemName
                                    )}
                                </strong>

                                <span>
                                    ${contributed}
                                    /
                                    ${required}
                                </span>

                            </div>

                            <div class="locanda-upgrade-progress">
                                <span
                                    style="width:${percentage}%"
                                ></span>
                            </div>

                            <div class="locanda-upgrade-owned">
                                Possiedi:
                                <strong>${owned}</strong>
                            </div>

                            ${
                                complete
                                    ? `
                                        <div class="locanda-upgrade-complete">
                                            REQUISITO COMPLETO
                                        </div>
                                    `
                                    : `
                                        <form
                                            class="locanda-upgrade-form"
                                            data-item-id="${escapeHtml(
                                                itemId
                                            )}"
                                        >

                                            <input
                                                class="locanda-upgrade-quantity"
                                                type="number"
                                                min="1"
                                                max="${remaining}"
                                                step="1"
                                                value="1"
                                                inputmode="numeric"
                                            >

                                            <button
                                                type="submit"
                                                class="merchant-button locanda-upgrade-button"
                                                ${
                                                    owned <= 0
                                                        ? "disabled"
                                                        : ""
                                                }
                                            >
                                                CONTRIBUISCI
                                            </button>

                                        </form>
                                    `
                            }

                        </article>
                    `;
                }
            )
            .join("");
}


function setupUpgradeContributions() {

    const container =
        document.getElementById(
            "locanda-upgrade-requirements"
        );

    if (!container) {
        return;
    }

    container.addEventListener(
        "submit",
        async event => {

            const form =
                event.target.closest(
                    ".locanda-upgrade-form"
                );

            if (!form) {
                return;
            }

            event.preventDefault();

            await contributeToUpgrade(
                form
            );
        }
    );
}


async function contributeToUpgrade(
    form
) {

    const itemId =
        String(
            form?.dataset?.itemId ||
            ""
        );

    const input =
        form?.querySelector(
            ".locanda-upgrade-quantity"
        );

    const button =
        form?.querySelector(
            ".locanda-upgrade-button"
        );

    const quantity =
        Math.floor(
            Number(
                input?.value
            )
        );

    if (
        !itemId
        ||
        !Number.isFinite(
            quantity
        )
        ||
        quantity <= 0
    ) {

        setUpgradeFeedback(
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
                "contribute_to_base_service_upgrade",
                {
                    p_service_key:
                        SERVICE_KEY,

                    p_item_id:
                        itemId,

                    p_quantity:
                        quantity
                }
            );

        if (error) {
            throw error;
        }

        await loadCharacterInventory();

        await refreshUpgradeState();

        updateGoldHeader();

        renderUpgradeState();

        const contributed =
            Math.max(
                0,
                Number(
                    data
                        ?.quantity_contributed
                ) || quantity
            );

        if (
            data?.upgraded ===
            true
        ) {

            setUpgradeFeedback(
                `Upgrade completato: Locanda LV ${Number(
                    data?.current_level
                ) || "?"}.`
            );

            showDialogue(
                "Bene. Adesso questa locanda sembra quasi un posto rispettabile."
            );

        } else {

            setUpgradeFeedback(
                `${contributed} unità consegnate al potenziamento.`
            );
        }

    } catch (error) {

        console.error(
            "Errore contributo upgrade Locanda:",
            error
        );

        setUpgradeFeedback(
            error?.message ||
            "Non è stato possibile registrare il contributo.",
            true
        );

    } finally {

        if (
            button
            &&
            button.isConnected
        ) {

            button.disabled =
                false;

            button.textContent =
                "CONTRIBUISCI";
        }
    }
}


function setUpgradeFeedback(
    message,
    isError = false
) {

    const feedback =
        document.getElementById(
            "locanda-upgrade-feedback"
        );

    if (!feedback) {
        return;
    }

    feedback.textContent =
        message || "";

    feedback.classList.toggle(
        "is-error",
        Boolean(
            isError
        )
    );
}


// ============================================================
// LOCANDA - INGRESSO / STATO / RIGENERAZIONE
// ============================================================

async function enterInn() {

    const {
        error: enterError
    } =
        await db.rpc(
            "enter_inn"
        );

    if (enterError) {
        throw enterError;
    }

    await refreshInnState();
}


async function refreshInnState() {

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

    innPayload =
        data || null;

    renderInnState();

    return innPayload;
}


function renderInnState() {

    if (!innPayload) {
        return;
    }

    setText(
        "locanda-current-pf",
        innPayload.current_pf
    );

    setText(
        "locanda-max-pf",
        innPayload.max_pf
    );

    setText(
        "locanda-current-pm",
        innPayload.current_pm
    );

    setText(
        "locanda-max-pm",
        innPayload.max_pm
    );

    const pf =
        Math.max(
            0,
            Number(
                innPayload.current_pf
            ) || 0
        );

    const maxPf =
        Math.max(
            0,
            Number(
                innPayload.max_pf
            ) || 0
        );

    const pm =
        Math.max(
            0,
            Number(
                innPayload.current_pm
            ) || 0
        );

    const maxPm =
        Math.max(
            0,
            Number(
                innPayload.max_pm
            ) || 0
        );

    setBarPercentage(
        "locanda-pf-bar",
        maxPf > 0
            ? pf / maxPf
            : 0
    );

    setBarPercentage(
        "locanda-pm-bar",
        maxPm > 0
            ? pm / maxPm
            : 0
    );

    renderInnCountdown();

    const mealButton =
        document.getElementById(
            "locanda-hot-meal-button"
        );

    if (
        mealButton
        &&
        !innTickBusy
    ) {

        mealButton.disabled =
            (
                pf >= maxPf
                &&
                pm >= maxPm
            )
            ||
            getInventoryQuantity(
                "moneta_oro"
            ) <
            HOT_MEAL_PRICE;
    }
}


function getInnSecondsRemaining() {

    const target =
        Date.parse(
            innPayload
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
            innPayload
                ?.seconds_until_next_tick
        ) || 0
    );
}


function renderInnCountdown() {

    const element =
        document.getElementById(
            "locanda-next-tick"
        );

    if (!element) {
        return;
    }

    const seconds =
        getInnSecondsRemaining();

    const minutes =
        Math.floor(
            seconds /
            60
        );

    const remainder =
        seconds %
        60;

    element.textContent =
        `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}


function startInnTimer() {

    if (innTimer) {

        clearInterval(
            innTimer
        );
    }

    innTimer =
        setInterval(
            async () => {

                if (
                    leavingPage
                    ||
                    innTickBusy
                ) {
                    return;
                }

                renderInnCountdown();

                if (
                    getInnSecondsRemaining() >
                    0
                ) {
                    return;
                }

                await runInnRegenerationTick();

            },
            1000
        );
}


async function runInnRegenerationTick() {

    if (innTickBusy) {
        return;
    }

    innTickBusy =
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

        innPayload =
            data || innPayload;

        renderInnState();

        const healedPf =
            Math.max(
                0,
                Number(
                    data
                        ?.healed_pf
                ) || 0
            );

        const healedPm =
            Math.max(
                0,
                Number(
                    data
                        ?.healed_pm
                ) || 0
            );

        if (
            healedPf > 0
            ||
            healedPm > 0
        ) {

            setRegenerationFeedback(
                `Recuperati +${healedPf} PF e +${healedPm} PM.`
            );

        } else {

            setRegenerationFeedback(
                "Sei già completamente ristabilito."
            );
        }

    } catch (error) {

        console.error(
            "Errore rigenerazione Locanda:",
            error
        );

        setRegenerationFeedback(
            error?.message ||
            "Il riposo è stato interrotto.",
            true
        );

    } finally {

        innTickBusy =
            false;
    }
}


function setRegenerationFeedback(
    message,
    isError = false
) {

    const element =
        document.getElementById(
            "locanda-regeneration-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.classList.toggle(
        "is-error",
        Boolean(
            isError
        )
    );
}


// ============================================================
// PASTO CALDO
// ============================================================

function setupHotMeal() {

    const button =
        document.getElementById(
            "locanda-hot-meal-button"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        buyHotMeal
    );
}


async function buyHotMeal() {

    const button =
        document.getElementById(
            "locanda-hot-meal-button"
        );

    if (
        !button
        ||
        button.disabled
    ) {
        return;
    }

    button.disabled =
        true;

    const originalText =
        button.textContent;

    button.textContent =
        "...";

    try {

        await ensureServiceActive();

        const {
            data,
            error
        } =
            await db.rpc(
                "buy_inn_hot_meal"
            );

        if (error) {
            throw error;
        }

        await loadCharacterInventory();

        updateGoldHeader();

        innPayload = {
            ...(innPayload || {}),
            active:
                true,
            current_pf:
                data.current_pf,
            max_pf:
                data.max_pf,
            current_pm:
                data.current_pm,
            max_pm:
                data.max_pm
        };

        renderInnState();

        setMealFeedback(
            `Pasto servito. PF e PM completamente ripristinati.`
        );

        showDialogue(
            "Mangia finché è caldo. Le ferite non pagano il conto, tu sì."
        );

    } catch (error) {

        console.error(
            "Errore pasto caldo:",
            error
        );

        setMealFeedback(
            error?.message ||
            "Fegato d'Oca non riesce a servirti il pasto.",
            true
        );

    } finally {

        if (
            button
            &&
            button.isConnected
        ) {

            button.textContent =
                originalText;

            renderInnState();
        }
    }
}


function setMealFeedback(
    message,
    isError = false
) {

    const element =
        document.getElementById(
            "locanda-meal-feedback"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message || "";

    element.classList.toggle(
        "is-error",
        Boolean(
            isError
        )
    );
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

    setText(
        "locanda-service-time",
        formatDuration(
            getRemainingMaintenanceMs()
        )
    );

    setText(
        "locanda-service-gold",
        String(
            Math.ceil(
                getEquivalentReserveGold()
            )
        )
    );
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

                            await leaveInnSafely();

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
            "locanda-maintenance-form"
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
            "locanda-maintenance-quantity"
        );

    const button =
        document.getElementById(
            "locanda-maintenance-button"
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

        updateGoldHeader();

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
            "locanda-maintenance-feedback"
        );

    if (!feedback) {
        return;
    }

    feedback.textContent =
        message || "";

    feedback.classList.toggle(
        "is-error",
        Boolean(
            isError
        )
    );
}


// ============================================================
// IA
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
        !message
        ||
        !input
        ||
        !button
    ) {
        return;
    }

    if (isPalaceOriginQuestion(message)) {
        input.value = "";
        const reply = "Mmh... chiedilo a Mano di Scimmia. Lui sa più cose di quante ne dica.";
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
        "Fegato d'Oca ti ascolta mentre sistema il bancone..."
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
                            LOCANDA_AI_NPC_ID,

                        message:
                            message,

                        history:
                            aiVisitHistory
                    }
                }
            );

        if (error) {
            throw error;
        }

        const reply =
            String(
                data?.reply ||
                ""
            )
                .trim();

        if (!reply) {

            throw new Error(
                "Fegato d'Oca non risponde."
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
            "Errore IA Fegato d'Oca:",
            error
        );

        showDialogue(
            `Qualcosa non va in cucina. (${error?.message || "errore sconosciuto"})`
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

                /*
                 * NON chiamiamo leave_inn():
                 * tornando alla Base il PG resta fisicamente
                 * nell'area della Locanda, quindi il riposo deve
                 * continuare senza azzerare il minuto corrente.
                 */

                await setCharacterLocation(
                    "base"
                );

            } catch (error) {

                console.warn(
                    "Errore uscita Locanda:",
                    error
                );
            }

            returnToBase();
        }
    );
}


async function leaveInnSafely() {

    try {

        await db.rpc(
            "leave_inn"
        );

    } catch (error) {

        console.warn(
            "Impossibile chiudere stato Locanda:",
            error
        );
    }
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

    if (innTimer) {

        clearInterval(
            innTimer
        );

        innTimer =
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


function saveMusicVolume(
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
        // localStorage può essere disabilitato.
    }
}


function startBackgroundMusic(
    source
) {

    if (
        pageBackgroundMusic
        ||
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
        locandaMusicVolume;

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
            locandaMusicVolume *
            100
        );

    if (button) {

        button.textContent =
            getVolumeIcon(
                locandaMusicVolume
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
        !control
        ||
        !button
        ||
        !popover
        ||
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

            locandaMusicVolume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(
                            slider.value
                        )
                        /
                        100
                    )
                );

            if (
                pageBackgroundMusic
            ) {

                pageBackgroundMusic.volume =
                    locandaMusicVolume;
            }

            saveMusicVolume(
                locandaMusicVolume
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
            String(
                value ?? ""
            );
    }
}


function setBarPercentage(
    id,
    ratio
) {

    const element =
        document.getElementById(
            id
        );

    if (!element) {
        return;
    }

    const percentage =
        Math.max(
            0,
            Math.min(
                100,
                (
                    Number(
                        ratio
                    ) || 0
                )
                *
                100
            )
        );

    element.style.width =
        `${percentage}%`;
}


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
