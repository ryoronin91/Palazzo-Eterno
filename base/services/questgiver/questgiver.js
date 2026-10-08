console.log("QUESTGIVER.JS CARICATO");

const db = supabaseClient;
const SERVICE_KEY = "quest_giver";
const NPC_AI_ID = "npc_dente_di_castoro";
const BASE_PAGE = "../../base.html";
const PALAZZO_MUSIC_VOLUME_KEY = "palazzo-eterno-dungeon-volume";


let state = null;
let servicePayload = null;
let upgradePayload = null;
let characterInventory = [];
let serviceTimer = null;
let aiBusy = false;
let aiVisitHistory = [];
let pageBackgroundMusic = null;
let leavingPage = false;
let pendingQuestKey = null;
let questClaimBusy = false;


document.addEventListener("DOMContentLoaded", async () => {
    setupExitButton();
    setupAiChat();
    setupQuestDialogueActions();
    setupMaintenanceForm();
    setupUpgradeContributions();
    setupVolumeControl();
    startBackgroundMusic("../../../music/missioni.mp3");

    try {
        await refreshServiceState(true);
        await Promise.all([
            refreshQuestState(),
            refreshUpgradeState(),
            loadCharacterInventory()
        ]);

        renderQuests();
        renderServiceState();
        renderUpgradeState();
        updateGoldHeader();
        startServiceTimer();
    } catch (error) {
        console.error("Errore avvio Missioni:", error);
        setQuestFeedback(error?.message || "Errore caricamento Missioni.", true);
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
        throw new Error("Il servizio Missioni non è più attivo.");
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
    setText("questgiver-service-time", formatDuration(getRemainingMaintenanceMs()));
    setText("questgiver-service-gold", String(Math.ceil(getEquivalentReserveGold())));
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
    const form = document.getElementById("questgiver-maintenance-form");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        await addMaintenanceGold();
    });
}

async function addMaintenanceGold() {
    const input = document.getElementById("questgiver-maintenance-quantity");
    const button = document.getElementById("questgiver-maintenance-button");
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
        await Promise.all([loadCharacterInventory(), refreshQuestState()]);
        updateGoldHeader();
        renderQuests();
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
    const el = document.getElementById("questgiver-maintenance-feedback");
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
    const levelElement = document.getElementById("questgiver-upgrade-level");
    const statusElement = document.getElementById("questgiver-upgrade-status");
    const container = document.getElementById("questgiver-upgrade-requirements");
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
        container.innerHTML = `<div class="inventory-empty">L'Missioni ha raggiunto il livello massimo.</div>`;
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
            <article class="questgiver-upgrade-requirement${complete ? " is-complete" : ""}">
                <div class="questgiver-upgrade-row">
                    <strong>${escapeHtml(itemName)}</strong>
                    <span>${contributed} / ${required}</span>
                </div>
                <div class="questgiver-upgrade-progress"><span style="width:${percentage}%"></span></div>
                <div class="questgiver-upgrade-owned">Possiedi: <strong>${owned}</strong></div>
                ${complete
                    ? `<div class="questgiver-upgrade-complete">REQUISITO COMPLETO</div>`
                    : `<form class="questgiver-upgrade-form" data-item-id="${escapeHtml(itemId)}">
                           <input class="questgiver-upgrade-quantity" type="number" min="1" max="${remaining}" step="1" value="1" inputmode="numeric">
                           <button type="submit" class="merchant-button questgiver-upgrade-button" ${owned <= 0 ? "disabled" : ""}>CONTRIBUISCI</button>
                       </form>`}
            </article>`;
    }).join("");
}

function setupUpgradeContributions() {
    const container = document.getElementById("questgiver-upgrade-requirements");
    if (!container) return;

    container.addEventListener("submit", async event => {
        const form = event.target.closest(".questgiver-upgrade-form");
        if (!form) return;
        event.preventDefault();
        await contributeUpgrade(form);
    });
}

async function contributeUpgrade(form) {
    const itemId = String(form.dataset.itemId || "");
    const input = form.querySelector(".questgiver-upgrade-quantity");
    const button = form.querySelector(".questgiver-upgrade-button");
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

        await Promise.all([loadCharacterInventory(), refreshUpgradeState(), refreshQuestState()]);
        updateGoldHeader();
        renderUpgradeState();
        renderQuests();

        if (data?.upgraded === true) {
            setUpgradeFeedback(`Upgrade completato: Missioni LV ${Number(data?.current_level) || "?"}.`);
            showDialogue("Tsk. Hanno migliorato il servizio. Vediamo se almeno voi sapete usarlo.");
        } else {
            setUpgradeFeedback(`${Math.max(0, Number(data?.quantity_contributed) || quantity)} unità consegnate al potenziamento.`);
        }
    } catch (error) {
        console.error("Errore contributo upgrade Missioni:", error);
        setUpgradeFeedback(error?.message || "Non è stato possibile registrare il contributo.", true);
    } finally {
        if (button?.isConnected) {
            button.disabled = false;
            button.textContent = "CONTRIBUISCI";
        }
    }
}

function setUpgradeFeedback(message, isError = false) {
    const el = document.getElementById("questgiver-upgrade-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
}


// ============================================================
// MISSIONI
// ============================================================

async function refreshQuestState() {
    const { data, error } = await db.rpc("get_quest_giver_state");
    if (error) throw error;
    state = data || { score: 0, gold: 0, quests: [] };
    return state;
}

function renderQuests() {
    if (!state) return;

    setText("quest-score", String(state.score ?? 0));
    updateGoldHeader();

    const container = document.getElementById("quest-list");
    if (!container) return;

    const quests = Array.isArray(state.quests) ? state.quests : [];

    if (quests.length === 0) {
        container.innerHTML = `
            <div class="inventory-empty">
                Nessuna missione disponibile per il tuo score, oppure hai già ritirato tutti i premi disponibili.
            </div>`;
        return;
    }

    container.innerHTML = "";

    quests.forEach(quest => {
        const card = document.createElement("article");
        const canComplete = quest.can_complete === true;
        card.className = `quest-card${canComplete ? " is-completable" : ""}`;

        const rewardParts = [];
        if (Number(quest.reward_score) > 0) {
            rewardParts.push(`${Number(quest.reward_score)} score`);
        }
        if (Number(quest.reward_gold) > 0) {
            rewardParts.push(`${Number(quest.reward_gold)} monete`);
        }

        card.innerHTML = `
            <div class="quest-title">${escapeHtml(quest.title)}</div>
            <p class="quest-description">${escapeHtml(quest.description)}</p>
            <div class="quest-progress">
                <span>Obiettivo</span>
                <strong>${escapeHtml(quest.progress_text || quest.objective_text || "--")}</strong>
            </div>
            <div class="quest-reward">
                <span>Premio</span>
                <strong>${escapeHtml(rewardParts.join(" + ") || "--")}</strong>
            </div>
            ${canComplete ? '<div class="quest-ready-label">Requisiti soddisfatti</div>' : ''}
            <button type="button" class="merchant-button" ${canComplete ? "" : "disabled"}>
                ${canComplete ? "COMPLETA" : "NON COMPLETATA"}
            </button>
        `;

        card.querySelector("button")?.addEventListener("click", () => {
            requestQuestCompletion(String(quest.quest_key || ""));
        });

        container.appendChild(card);
    });
}

function setupQuestDialogueActions() {
    const confirmButton = document.getElementById("quest-dialogue-confirm");
    const cancelButton = document.getElementById("quest-dialogue-cancel");

    confirmButton?.addEventListener("click", async () => {
        if (!pendingQuestKey || questClaimBusy) return;
        await claimQuest(pendingQuestKey);
    });

    cancelButton?.addEventListener("click", () => {
        cancelPendingQuestCompletion();
    });
}

function requestQuestCompletion(questKey) {
    if (!questKey || questClaimBusy) return;

    const quest = (state?.quests || []).find(row => row.quest_key === questKey);
    if (!quest || quest.can_complete !== true) return;

    pendingQuestKey = questKey;
    setQuestFeedback("");
    disableQuestButtons(true);

    const actionBox = document.getElementById("quest-dialogue-actions");
    const confirmButton = document.getElementById("quest-dialogue-confirm");
    const aiForm = document.getElementById("vendor-ai-form");

    if (confirmButton) {
        confirmButton.textContent = questKey === "floor1_explorer" ? "VERIFICA" : "CONSEGNA";
        confirmButton.disabled = false;
    }

    if (actionBox) actionBox.hidden = false;
    if (aiForm) aiForm.hidden = true;

    showDialogue(getQuestConfirmationLine(quest));
}

function getQuestConfirmationLine(quest) {
    switch (String(quest?.quest_key || "")) {
        case "boss_head":
            return "Ehi tu. Quella è davvero la testa del boss? Mollala qui e ti do quello che ti spetta. La consegni?";

        case "monkey_finger":
            return "Non puntarmelo contro. È da maleducati. Lascialo qui, prenditi il premio e portami via quella roba dalla faccia.";

        case "floor1_explorer":
            return "Ehi tu. Dici di aver messo piede in ogni angolo del primo piano? Va bene. Vuoi che controlli e chiudiamo questa storia?";

        default:
            return `Ehi tu. Vuoi davvero completare “${String(quest?.title || "questa missione")}” e ritirare il premio?`;
    }
}

function getQuestSuccessLine(questKey) {
    switch (String(questKey || "")) {
        case "boss_head":
            return "Tsk. Sì, è la testa giusta. Puzzava meno quando era attaccata al resto. Prendi il premio e sparisci.";

        case "monkey_finger":
            return "Finalmente. Mettilo lì e non puntarmelo più contro. È da maleducati. Prendi il premio e levati.";

        case "floor1_explorer":
            return "Mh. Hai davvero calpestato tutto il piano. Non pensavo avessi tanta pazienza. Prendi il premio prima che cambi idea.";

        default:
            return "Tsk. Almeno questa l'hai fatta. Prendi il premio e non montarti la testa.";
    }
}

function cancelPendingQuestCompletion() {
    if (questClaimBusy) return;

    pendingQuestKey = null;
    closeQuestDialogueActions();
    renderQuests();
    showDialogue("Tsk. Allora deciditi prima di farmi perdere tempo.");
}

function closeQuestDialogueActions() {
    const actionBox = document.getElementById("quest-dialogue-actions");
    const confirmButton = document.getElementById("quest-dialogue-confirm");
    const cancelButton = document.getElementById("quest-dialogue-cancel");
    const aiForm = document.getElementById("vendor-ai-form");

    if (actionBox) actionBox.hidden = true;
    if (confirmButton) {
        confirmButton.disabled = false;
        confirmButton.textContent = "CONSEGNA";
    }
    if (cancelButton) cancelButton.disabled = false;
    if (aiForm) aiForm.hidden = false;
}

async function claimQuest(questKey) {
    if (!questKey || questClaimBusy) return;

    const quest = (state?.quests || []).find(row => row.quest_key === questKey);
    if (!quest || quest.can_complete !== true) {
        pendingQuestKey = null;
        closeQuestDialogueActions();
        renderQuests();
        return;
    }

    questClaimBusy = true;
    disableQuestButtons(true);
    setQuestFeedback("");

    const confirmButton = document.getElementById("quest-dialogue-confirm");
    const cancelButton = document.getElementById("quest-dialogue-cancel");

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = "...";
    }
    if (cancelButton) cancelButton.disabled = true;

    showDialogue("Ehi tu. Fammi controllare...");

    try {
        await ensureServiceActive();

        const { data, error } = await db.rpc(
            "claim_quest_reward",
            { p_quest_key: questKey }
        );

        if (error) throw error;

        state = data || state;
        await loadCharacterInventory();
        updateGoldHeader();

        pendingQuestKey = null;
        closeQuestDialogueActions();
        renderQuests();
        setQuestFeedback("Missione completata. Premio consegnato.");
        showDialogue(getQuestSuccessLine(questKey));

    } catch (error) {
        console.error("Errore completamento missione:", error);

        pendingQuestKey = null;
        closeQuestDialogueActions();
        renderQuests();

        const message = error?.message || "Non puoi completare questa missione.";
        setQuestFeedback(message, true);
        showDialogue(`Ehi tu. No. ${message}`);
    } finally {
        questClaimBusy = false;
        disableQuestButtons(false);
    }
}

function disableQuestButtons(disabled) {
    document.querySelectorAll(".quest-card button").forEach(button => {
        if (disabled) {
            button.disabled = true;
        }
    });

    if (!disabled) {
        renderQuests();
    }
}

function setQuestFeedback(text, isError = false) {
    const target = document.getElementById("quest-feedback");
    if (!target) return;
    target.textContent = text || "";
    target.classList.toggle("is-error", Boolean(isError));
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

    const input = document.getElementById("vendor-ai-input");
    const button = document.getElementById("vendor-ai-send");
    const message = String(input?.value || "").trim().slice(0, 500);
    if (!message || !input || !button) return;

    if (isPalaceOriginQuestion(message)) {
        input.value = "";
        const reply = "Ehi tu. Chiedilo a Mano di Scimmia. Io ho già abbastanza problemi.";
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
    showDialogue("Dente di Castoro ti squadra con evidente fastidio...");

    try {
        const { data, error } = await db.functions.invoke("vendor-ai", {
            body: { npc_id: NPC_AI_ID, message, history: aiVisitHistory }
        });
        if (error) throw error;

        const reply = String(data?.reply || "").trim();
        if (!reply) throw new Error("Dente di Castoro non risponde.");

        aiVisitHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: reply }
        );
        aiVisitHistory = aiVisitHistory.slice(-12);
        showDialogue(reply);
    } catch (error) {
        console.error("Errore IA Dente di Castoro:", error);
        showDialogue("Ehi tu. Qualcosa non funziona. Torna quando il mondo avrà deciso di collaborare.");
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
