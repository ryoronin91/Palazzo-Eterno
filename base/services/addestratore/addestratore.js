console.log("ADDESTRATORE.JS CARICATO");

const db = supabaseClient;
const SERVICE_KEY = "addestratore";
const NPC_AI_ID = "npc_coda_d_orso";
const BASE_PAGE = "../../base.html";
const PALAZZO_MUSIC_VOLUME_KEY = "palazzo-eterno-dungeon-volume";

const STAT_KEYS = ["forza","resistenza","costituzione","intelligenza","destrezza","fortuna"];
const STAT_LABELS = {
    forza: "Forza",
    resistenza: "Resistenza",
    costituzione: "Costituzione",
    intelligenza: "Intelligenza",
    destrezza: "Destrezza",
    fortuna: "Fortuna"
};

let state = null;
let servicePayload = null;
let upgradePayload = null;
let characterInventory = [];
let resetValues = {};
let serviceTimer = null;
let aiBusy = false;
let aiVisitHistory = [];
let pageBackgroundMusic = null;
let leavingPage = false;
let pendingVendorAction = null;


document.addEventListener("DOMContentLoaded", async () => {
    setupExitButton();
    setupResetControls();
    setupAiChat();
    setupDialogueActions();
    setupMaintenanceForm();
    setupUpgradeContributions();
    setupVolumeControl();
    startBackgroundMusic("../../../music/vendor.mp3");

    try {
        await refreshServiceState(true);
        await Promise.all([
            refreshTrainingState(),
            refreshUpgradeState(),
            loadCharacterInventory()
        ]);

        renderTraining();
        renderServiceState();
        renderUpgradeState();
        updateGoldHeader();
        startServiceTimer();
    } catch (error) {
        console.error("Errore avvio Addestratore:", error);
        feedback(error?.message || "Errore caricamento Addestratore.", true);
    }
});


// ============================================================
// SERVIZIO / MANUTENZIONE
// ============================================================

async function refreshServiceState(redirectIfInactive = false) {
    const { data, error } = await db.rpc(
        "get_base_service_state",
        { p_service_key: SERVICE_KEY }
    );

    if (error) throw error;

    servicePayload = data || null;

    if (redirectIfInactive && servicePayload?.service?.status !== "active") {
        returnToBase();
    }

    return servicePayload;
}

async function ensureServiceActive() {
    await refreshServiceState(false);

    if (servicePayload?.service?.status !== "active") {
        returnToBase();
        throw new Error("L'Addestratore non è più attivo.");
    }
}

function getRemainingMaintenanceMs() {
    const target = Date.parse(servicePayload?.service?.maintenance_until);
    if (!Number.isFinite(target)) return 0;
    return Math.max(0, target - Date.now());
}

function getGoldRequirement() {
    return servicePayload?.requirements?.find(row => row.item_id === "moneta_oro") || null;
}

function getEquivalentReserveGold() {
    const remainingMs = getRemainingMaintenanceMs();
    const maintenanceSeconds = Math.max(0, Number(servicePayload?.service?.maintenance_seconds) || 0);
    const goldRequirement = Math.max(0, Number(getGoldRequirement()?.required_quantity) || 0);

    if (maintenanceSeconds <= 0 || goldRequirement <= 0) return 0;
    return Math.max(0, (remainingMs / 1000 / maintenanceSeconds) * goldRequirement);
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function renderServiceState() {
    setText("addestratore-service-time", formatDuration(getRemainingMaintenanceMs()));
    setText("addestratore-service-gold", String(Math.ceil(getEquivalentReserveGold())));
}

function startServiceTimer() {
    clearInterval(serviceTimer);
    serviceTimer = setInterval(async () => {
        if (leavingPage) return;
        renderServiceState();

        if (getRemainingMaintenanceMs() <= 0) {
            try {
                await refreshServiceState(false);
                if (servicePayload?.service?.status !== "active") {
                    returnToBase();
                }
            } catch (error) {
                console.warn("Errore aggiornamento servizio:", error);
            }
        }
    }, 1000);
}

function setupMaintenanceForm() {
    const form = document.getElementById("addestratore-maintenance-form");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        await addMaintenanceGold();
    });
}

async function addMaintenanceGold() {
    const input = document.getElementById("addestratore-maintenance-quantity");
    const button = document.getElementById("addestratore-maintenance-button");
    const quantity = Math.floor(Number(input?.value));

    if (!Number.isFinite(quantity) || quantity <= 0) {
        setMaintenanceFeedback("Inserisci una quantità valida.", true);
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "...";
    }

    try {
        await ensureServiceActive();

        const { data, error } = await db.rpc(
            "contribute_to_base_service",
            {
                p_service_key: SERVICE_KEY,
                p_item_id: "moneta_oro",
                p_quantity: quantity
            }
        );

        if (error) throw error;

        servicePayload = data || servicePayload;
        await Promise.all([loadCharacterInventory(), refreshTrainingState()]);
        updateGoldHeader();
        renderTraining();
        renderServiceState();
        setMaintenanceFeedback(`${quantity} monete aggiunte alla riserva.`);
        if (input) input.value = "1";

    } catch (error) {
        console.error("Errore alimentazione riserva:", error);
        setMaintenanceFeedback(error?.message || "Non è stato possibile alimentare la riserva.", true);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "ALIMENTA RISERVA";
        }
    }
}

function setMaintenanceFeedback(message, isError = false) {
    const el = document.getElementById("addestratore-maintenance-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
}


// ============================================================
// INVENTARIO / ORO
// ============================================================

async function loadCharacterInventory() {
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError) throw authError;
    if (!user) return;

    const { data: character, error: charError } = await db
        .from("characters")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (charError) throw charError;
    if (!character) return;

    const { data, error } = await db
        .from("character_inventory")
        .select(`quantity,item:items(id,name)`)
        .eq("character_id", character.id);

    if (error) throw error;
    characterInventory = data || [];
}

function getInventoryQuantity(itemId) {
    return characterInventory
        .filter(row => row?.item?.id === itemId)
        .reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
}

function updateGoldHeader() {
    const value = state?.gold ?? getInventoryQuantity("moneta_oro");
    setText("player-gold-amount", String(value ?? 0));
}


// ============================================================
// UPGRADE SERVIZIO
// ============================================================

async function refreshUpgradeState() {
    const { data, error } = await db.rpc(
        "get_base_service_upgrade_state",
        { p_service_key: SERVICE_KEY }
    );

    if (error) throw error;
    upgradePayload = data || null;
    return upgradePayload;
}

function renderUpgradeState() {
    const levelElement = document.getElementById("addestratore-upgrade-level");
    const statusElement = document.getElementById("addestratore-upgrade-status");
    const container = document.getElementById("addestratore-upgrade-requirements");
    if (!container) return;

    const currentLevel = Math.max(1, Number(upgradePayload?.current_level) || 1);
    const maxLevel = Math.max(1, Number(upgradePayload?.max_level) || 6);
    const targetLevel = Number(upgradePayload?.target_level);
    const enabled = upgradePayload?.enabled === true;
    const requirements = Array.isArray(upgradePayload?.requirements) ? upgradePayload.requirements : [];

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
        container.innerHTML = `<div class="inventory-empty">L'Addestratore ha raggiunto il livello massimo.</div>`;
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
        const percentage = required > 0 ? Math.min(100, Math.round(contributed / required * 100)) : 0;
        const complete = remaining <= 0;

        return `
            <article class="addestratore-upgrade-requirement${complete ? " is-complete" : ""}">
                <div class="addestratore-upgrade-row">
                    <strong>${escapeHtml(itemName)}</strong>
                    <span>${contributed} / ${required}</span>
                </div>
                <div class="addestratore-upgrade-progress"><span style="width:${percentage}%"></span></div>
                <div class="addestratore-upgrade-owned">Possiedi: <strong>${owned}</strong></div>
                ${complete
                    ? `<div class="addestratore-upgrade-complete">REQUISITO COMPLETO</div>`
                    : `<form class="addestratore-upgrade-form" data-item-id="${escapeHtml(itemId)}">
                           <input class="addestratore-upgrade-quantity" type="number" min="1" max="${remaining}" step="1" value="1" inputmode="numeric">
                           <button type="submit" class="merchant-button addestratore-upgrade-button" ${owned <= 0 ? "disabled" : ""}>CONTRIBUISCI</button>
                       </form>`}
            </article>`;
    }).join("");
}

function setupUpgradeContributions() {
    const container = document.getElementById("addestratore-upgrade-requirements");
    if (!container) return;

    container.addEventListener("submit", async event => {
        const form = event.target.closest(".addestratore-upgrade-form");
        if (!form) return;
        event.preventDefault();
        await contributeUpgrade(form);
    });
}

async function contributeUpgrade(form) {
    const itemId = String(form.dataset.itemId || "");
    const input = form.querySelector(".addestratore-upgrade-quantity");
    const button = form.querySelector(".addestratore-upgrade-button");
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

        await Promise.all([loadCharacterInventory(), refreshUpgradeState(), refreshTrainingState()]);
        updateGoldHeader();
        renderUpgradeState();
        renderTraining();

        if (data?.upgraded === true) {
            setUpgradeFeedback(`Upgrade completato: Addestratore LV ${Number(data?.current_level) || "?"}.`);
            showDialogue("PIÙ LIVELLO! PIÙ MUSCOLI! PIÙ TUTTO! ECCEZIONALE!");
        } else {
            setUpgradeFeedback(`${Math.max(0, Number(data?.quantity_contributed) || quantity)} unità consegnate al potenziamento.`);
        }
    } catch (error) {
        console.error("Errore contributo upgrade Addestratore:", error);
        setUpgradeFeedback(error?.message || "Non è stato possibile registrare il contributo.", true);
    } finally {
        if (button?.isConnected) {
            button.disabled = false;
            button.textContent = "CONTRIBUISCI";
        }
    }
}

function setUpgradeFeedback(message, isError = false) {
    const el = document.getElementById("addestratore-upgrade-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
}


// ============================================================
// ALLENAMENTO
// ============================================================

async function refreshTrainingState() {
    const { data, error } = await db.rpc("get_training_state");
    if (error) throw error;
    state = data;
    return state;
}

function renderTraining() {
    if (!state) return;

    setText("score", String(state.score ?? 0));
    setText("spent", String(state.training_points_spent ?? 0));
    updateGoldHeader();

    const nextTraining = state.next_training;
    const nextBox = document.getElementById("next-training");

    if (nextTraining) {
        nextBox.innerHTML = `
            <div class="next-box">
                <strong>Punto #${nextTraining.number}</strong><br>
                Score richiesto: <strong>${nextTraining.required_score}</strong><br>
                Costo: <strong>${nextTraining.gold_cost} oro</strong>
            </div>`;
    } else {
        nextBox.innerHTML = `<div class="next-box"><strong>ALLENAMENTO COMPLETATO</strong><br>Hai acquistato tutti i 164 punti disponibili.</div>`;
    }

    const statsBox = document.getElementById("stats");
    statsBox.innerHTML = "";

    STAT_KEYS.forEach(stat => {
        const value = Number(state.stats?.[stat] ?? 1);
        const canTrain = Boolean(nextTraining)
            && value < 30
            && Number(state.score) >= Number(nextTraining.required_score)
            && Number(state.gold) >= Number(nextTraining.gold_cost);

        const row = document.createElement("div");
        row.className = "stat-row";
        row.innerHTML = `
            <strong>${STAT_LABELS[stat]}</strong>
            <span class="stat-value">${value} / 30</span>
            <button type="button" ${canTrain ? "" : "disabled"}>ALLENA +1</button>`;
        row.querySelector("button").addEventListener("click", () => train(stat));
        statsBox.appendChild(row);
    });
}

function train(stat) {
    if (!state?.next_training || pendingVendorAction) return;

    const nextNumber = state.next_training.number;
    const goldCost = state.next_training.gold_cost;
    const label = STAT_LABELS[stat];

    pendingVendorAction = {
        type: "training",
        stat,
        label,
        nextNumber,
        goldCost
    };

    showVendorAction(
        `OOOH! PUNTO #${nextNumber}! Vuoi pompare ${label} di 1 per ${goldCost} monete? FORZA, DIMMI CHE LO FACCIAMO!`,
        "ALLENA"
    );
}

async function executeTraining(action) {
    if (!action?.stat) return;

    disableTrainingButtons(true);
    setVendorActionBusy(true);
    showDialogue(`GRANDE! FERMO LÌ! ${action.label.toUpperCase()} STA PER DIVENTARE PIÙ GROSSA!`);

    try {
        const { data, error } = await db.rpc("train_character_stat", { p_stat: action.stat });
        if (error) throw error;

        state = data;
        feedback(`${action.label} aumentata di 1. Ora è disponibile il punto successivo.`);
        clearVendorAction();
        showDialogue(`SÌÌÌ! ${action.label.toUpperCase()} +1! QUESTO È IL SUONO DELLA CRESCITA! AVANTI COL PROSSIMO!`);
        renderTraining();
        await loadCharacterInventory();
        updateGoldHeader();
    } catch (error) {
        console.error(error);
        feedback(error?.message || "Allenamento fallito.", true);
        clearVendorAction();
        showDialogue(`EH?! QUALCOSA HA CEDUTO PRIMA DEL MUSCOLO! ${error?.message || "ALLENAMENTO FALLITO!"}`);
    } finally {
        disableTrainingButtons(false);
        setVendorActionBusy(false);
    }
}

function disableTrainingButtons(disabled) {
    document.querySelectorAll(".trainer-stats-box button").forEach(button => {
        if (disabled) button.disabled = true;
    });
    if (!disabled) renderTraining();
}

function feedback(text, isError = false) {
    const target = document.getElementById("feedback");
    if (!target) return;
    target.textContent = text || "";
    target.classList.toggle("is-error", Boolean(isError));
}


// ============================================================
// RESET 10 PUNTI INIZIALI
// ============================================================

function setupResetControls() {
    document.getElementById("reset-open")?.addEventListener("click", openReset);
    document.getElementById("reset-cancel")?.addEventListener("click", () => {
        document.getElementById("reset-modal").hidden = true;
    });
    document.getElementById("reset-confirm")?.addEventListener("click", confirmReset);
}

function openReset() {
    resetValues = Object.fromEntries(STAT_KEYS.map(stat => [stat, 0]));
    setText("reset-feedback", "");
    document.getElementById("reset-modal").hidden = false;
    renderReset();
}

function renderReset() {
    const used = Object.values(resetValues).reduce((sum, value) => sum + value, 0);
    setText("reset-left", String(10 - used));

    const box = document.getElementById("reset-stats");
    box.innerHTML = "";

    STAT_KEYS.forEach(stat => {
        const row = document.createElement("div");
        row.className = "reset-line";
        row.innerHTML = `
            <strong>${STAT_LABELS[stat]}</strong>
            <button type="button">−</button>
            <span>${resetValues[stat]}</span>
            <button type="button">+</button>`;

        const [minus, plus] = row.querySelectorAll("button");
        minus.disabled = resetValues[stat] <= 0;
        plus.disabled = used >= 10;

        minus.addEventListener("click", () => {
            resetValues[stat] -= 1;
            renderReset();
        });
        plus.addEventListener("click", () => {
            resetValues[stat] += 1;
            renderReset();
        });
        box.appendChild(row);
    });

    document.getElementById("reset-confirm").disabled = used !== 10;
}

function confirmReset() {
    const total = Object.values(resetValues).reduce((sum, value) => sum + value, 0);
    if (total !== 10 || pendingVendorAction) return;

    pendingVendorAction = {
        type: "reset",
        distribution: { ...resetValues },
        goldCost: 400
    };

    document.getElementById("reset-modal").hidden = true;

    showVendorAction(
        "QUATTROCENTO MONETE E TI RIMETTO IN ORDINE QUEI DIECI PUNTI! NON È MAGIA: È DISCIPLINA! CONFERMI?",
        "RIDISTRIBUISCI"
    );
}

async function executeReset(action) {
    if (!action?.distribution) return;

    setVendorActionBusy(true);
    showDialogue("PERFETTO! VIA IL VECCHIO PROGRAMMA! ADESSO TI RIMONTO COME SI DEVE!");

    try {
        const { data, error } = await db.rpc("reset_training_base_stats", {
            p_distribution: action.distribution
        });
        if (error) throw error;

        state = data;
        feedback("I 10 punti iniziali sono stati ridistribuiti.");
        clearVendorAction();
        showDialogue("ECCOTI! DIECI PUNTI, NUOVA DISTRIBUZIONE! ADESSO VAI E FAMMI SENTIRE QUELLE STATISTICHE URLARE!");
        renderTraining();
        await loadCharacterInventory();
        updateGoldHeader();
    } catch (error) {
        console.error(error);
        feedback(error?.message || "Ridistribuzione fallita.", true);
        clearVendorAction();
        showDialogue(`NOOO! IL PROGRAMMA È SALTATO! ${error?.message || "RIDISTRIBUZIONE FALLITA!"}`);
    } finally {
        setVendorActionBusy(false);
    }
}


// ============================================================
// CONFERME IN DIALOGO
// ============================================================

function setupDialogueActions() {
    document.getElementById("vendor-action-confirm")?.addEventListener("click", async () => {
        const action = pendingVendorAction;
        if (!action) return;

        if (action.type === "training") {
            await executeTraining(action);
            return;
        }

        if (action.type === "reset") {
            await executeReset(action);
        }
    });

    document.getElementById("vendor-action-cancel")?.addEventListener("click", () => {
        if (!pendingVendorAction) return;
        clearVendorAction();
        showDialogue("EH?! VA BENE! MA I MUSCOLI NON CRESCONO CON I RIPENSAMENTI! QUANDO SEI PRONTO, IO SONO QUI!");
    });
}

function showVendorAction(message, confirmLabel = "CONFERMA") {
    const controls = document.getElementById("vendor-action-controls");
    const confirmButton = document.getElementById("vendor-action-confirm");
    const cancelButton = document.getElementById("vendor-action-cancel");

    showDialogue(message);

    if (confirmButton) {
        confirmButton.textContent = confirmLabel;
        confirmButton.disabled = false;
    }

    if (cancelButton) cancelButton.disabled = false;
    if (controls) controls.hidden = false;
}

function clearVendorAction() {
    pendingVendorAction = null;
    const controls = document.getElementById("vendor-action-controls");
    if (controls) controls.hidden = true;
}

function setVendorActionBusy(busy) {
    const confirmButton = document.getElementById("vendor-action-confirm");
    const cancelButton = document.getElementById("vendor-action-cancel");
    if (confirmButton) confirmButton.disabled = Boolean(busy);
    if (cancelButton) cancelButton.disabled = Boolean(busy);
}

// ============================================================
// IA
// ============================================================

function setupAiChat() {
    const form = document.getElementById("vendor-ai-form");
    if (!form) return;
    form.addEventListener("submit", async event => {
        event.preventDefault();
        await sendAiMessage();
    });
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
    if (aiBusy) return;

    if (pendingVendorAction) {
        showDialogue("PRIMA DECIDI! ALLENAMENTO O RIPENSAMENTO? POI PARLIAMO!");
        return;
    }

    const input = document.getElementById("vendor-ai-input");
    const button = document.getElementById("vendor-ai-send");
    const message = String(input?.value || "").trim().slice(0, 500);
    if (!message || !input || !button) return;

    if (isPalaceOriginQuestion(message)) {
        input.value = "";
        const reply = "OH! DOMANDA PROFONDA! Per questa però devi chiedere a Mano di Scimmia!";
        aiVisitHistory.push({ role: "user", content: message }, { role: "assistant", content: reply });
        aiVisitHistory = aiVisitHistory.slice(-12);
        showDialogue(reply);
        return;
    }

    aiBusy = true;
    input.disabled = true;
    button.disabled = true;
    button.textContent = "...";
    input.value = "";
    showDialogue("Coda d'Orso inspira come se stesse per sollevare anche la conversazione...");

    try {
        const { data, error } = await db.functions.invoke("vendor-ai", {
            body: { npc_id: NPC_AI_ID, message, history: aiVisitHistory }
        });
        if (error) throw error;

        const reply = String(data?.reply || "").trim();
        if (!reply) throw new Error("Coda d'Orso non risponde.");

        aiVisitHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: reply }
        );
        aiVisitHistory = aiVisitHistory.slice(-12);
        showDialogue(reply);
    } catch (error) {
        console.error("Errore IA Coda d'Orso:", error);
        showDialogue("EH?! PROBLEMA TECNICO! FAI DIECI PIEGAMENTI E RIPROVA!");
    } finally {
        aiBusy = false;
        input.disabled = false;
        button.disabled = false;
        button.textContent = "PARLA";
        input.focus();
    }
}

function showDialogue(text) {
    setText("vendor-dialogue-text", text);
}


// ============================================================
// MUSICA / VOLUME
// ============================================================

function loadMusicVolume() {
    const saved = Number(localStorage.getItem(PALAZZO_MUSIC_VOLUME_KEY));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.35;
}

function startBackgroundMusic(src) {
    pageBackgroundMusic = new Audio(src);
    pageBackgroundMusic.loop = true;
    pageBackgroundMusic.volume = loadMusicVolume();
    pageBackgroundMusic.play().catch(() => {});
}

function setupVolumeControl() {
    const button = document.getElementById("vendor-volume-button");
    const popover = document.getElementById("vendor-volume-popover");
    const slider = document.getElementById("vendor-volume-slider");
    const value = document.getElementById("vendor-volume-value");
    if (!button || !popover || !slider || !value) return;

    const initial = Math.round(loadMusicVolume() * 100);
    slider.value = String(initial);
    value.textContent = `${initial}%`;

    button.addEventListener("click", () => {
        popover.hidden = !popover.hidden;
        button.setAttribute("aria-expanded", String(!popover.hidden));
    });

    slider.addEventListener("input", () => {
        const volume = Math.min(1, Math.max(0, Number(slider.value) / 100));
        localStorage.setItem(PALAZZO_MUSIC_VOLUME_KEY, String(volume));
        if (pageBackgroundMusic) pageBackgroundMusic.volume = volume;
        value.textContent = `${Math.round(volume * 100)}%`;
        button.textContent = volume <= 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";
    });
}


// ============================================================
// USCITA / UTILITY
// ============================================================

function setupExitButton() {
    document.getElementById("vendor-exit-button")?.addEventListener("click", returnToBase);
}

function returnToBase() {
    leavingPage = true;
    window.location.href = BASE_PAGE;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
