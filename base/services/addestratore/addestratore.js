console.log("ADDESTRATORE.JS CARICATO");

const db = supabaseClient;

const SERVICE_KEY = "addestratore";
const NPC_AI_ID = "npc_coda_d_orso";
const BASE_PAGE = "../../base.html";

const STAT_KEYS = [
    "forza",
    "resistenza",
    "costituzione",
    "intelligenza",
    "destrezza",
    "fortuna"
];

const STAT_LABELS = {
    forza: "Forza",
    resistenza: "Resistenza",
    costituzione: "Costituzione",
    intelligenza: "Intelligenza",
    destrezza: "Destrezza",
    fortuna: "Fortuna"
};

let state = null;
let resetValues = {};
let aiBusy = false;
let aiVisitHistory = [];


document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("exit").addEventListener("click", () => {
        window.location.href = BASE_PAGE;
    });

    document.getElementById("reset-open").addEventListener("click", openReset);
    document.getElementById("reset-cancel").addEventListener("click", () => {
        document.getElementById("reset-modal").hidden = true;
    });
    document.getElementById("reset-confirm").addEventListener("click", confirmReset);

    setupAiChat();

    try {
        await ensureServiceActive();
        await refresh();
    } catch (error) {
        console.error(error);
        feedback(error.message || "Errore caricamento.", true);
    }
});


async function ensureServiceActive() {
    const { data, error } = await db.rpc(
        "get_base_service_state",
        { p_service_key: SERVICE_KEY }
    );

    if (error) {
        throw error;
    }

    if (data?.service?.status !== "active") {
        window.location.href = BASE_PAGE;
    }
}


async function refresh() {
    const { data, error } = await db.rpc("get_training_state");

    if (error) {
        throw error;
    }

    state = data;
    render();
}


function render() {
    document.getElementById("gold").textContent = state.gold ?? 0;
    document.getElementById("score").textContent = state.score ?? 0;
    document.getElementById("spent").textContent = state.training_points_spent ?? 0;

    const nextTraining = state.next_training;
    const nextBox = document.getElementById("next-training");

    if (nextTraining) {
        nextBox.innerHTML = `
            <div class="next-box">
                <strong>Punto #${nextTraining.number}</strong><br>
                Score richiesto: <strong>${nextTraining.required_score}</strong><br>
                Costo: <strong>${nextTraining.gold_cost} oro</strong>
            </div>
        `;
    } else {
        nextBox.innerHTML = `
            <div class="next-box">
                <strong>ALLENAMENTO COMPLETATO</strong><br>
                Hai acquistato tutti i 164 punti disponibili.
            </div>
        `;
    }

    const statsBox = document.getElementById("stats");
    statsBox.innerHTML = "";

    STAT_KEYS.forEach(stat => {
        const value = Number(state.stats?.[stat] ?? 1);
        const canTrain =
            Boolean(nextTraining) &&
            value < 30 &&
            Number(state.score) >= Number(nextTraining.required_score) &&
            Number(state.gold) >= Number(nextTraining.gold_cost);

        const row = document.createElement("div");
        row.className = "stat-row";
        row.innerHTML = `
            <strong>${STAT_LABELS[stat]}</strong>
            <span class="stat-value">${value} / 30</span>
            <button type="button" ${canTrain ? "" : "disabled"}>ALLENA +1</button>
        `;

        row.querySelector("button").addEventListener("click", () => train(stat));
        statsBox.appendChild(row);
    });
}


async function train(stat) {
    if (!state?.next_training) {
        return;
    }

    const nextNumber = state.next_training.number;
    const goldCost = state.next_training.gold_cost;
    const label = STAT_LABELS[stat];

    if (!window.confirm(
        `Acquistare il punto #${nextNumber} e aumentare ${label} di 1 per ${goldCost} oro?`
    )) {
        return;
    }

    disableTrainingButtons(true);

    try {
        const { data, error } = await db.rpc(
            "train_character_stat",
            { p_stat: stat }
        );

        if (error) {
            throw error;
        }

        state = data;
        feedback(`${label} aumentata di 1. Ora è disponibile il punto successivo.`);
        render();

    } catch (error) {
        console.error(error);
        feedback(error.message || "Allenamento fallito.", true);

    } finally {
        disableTrainingButtons(false);
    }
}


function openReset() {
    resetValues = {};
    STAT_KEYS.forEach(stat => {
        resetValues[stat] = 0;
    });

    document.getElementById("reset-feedback").textContent = "";
    document.getElementById("reset-modal").hidden = false;
    renderReset();
}


function renderReset() {
    const used = Object.values(resetValues).reduce((sum, value) => sum + value, 0);
    document.getElementById("reset-left").textContent = 10 - used;

    const box = document.getElementById("reset-stats");
    box.innerHTML = "";

    STAT_KEYS.forEach(stat => {
        const row = document.createElement("div");
        row.className = "reset-line";
        row.innerHTML = `
            <strong>${STAT_LABELS[stat]}</strong>
            <button type="button">−</button>
            <span>${resetValues[stat]}</span>
            <button type="button">+</button>
        `;

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


async function confirmReset() {
    const total = Object.values(resetValues).reduce((sum, value) => sum + value, 0);

    if (total !== 10) {
        return;
    }

    if (!window.confirm(
        "Confermi la ridistribuzione dei 10 punti iniziali per 400 oro?"
    )) {
        return;
    }

    const button = document.getElementById("reset-confirm");
    button.disabled = true;

    try {
        const { data, error } = await db.rpc(
            "reset_training_base_stats",
            { p_distribution: resetValues }
        );

        if (error) {
            throw error;
        }

        state = data;
        document.getElementById("reset-modal").hidden = true;
        feedback("I 10 punti iniziali sono stati ridistribuiti.");
        render();

    } catch (error) {
        console.error(error);
        document.getElementById("reset-feedback").textContent =
            error.message || "Ridistribuzione fallita.";

    } finally {
        button.disabled = false;
    }
}


function setupAiChat() {
    const form = document.getElementById("vendor-ai-form");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        await sendAiMessage();
    });
}


async function sendAiMessage() {
    if (aiBusy) {
        return;
    }

    const input = document.getElementById("vendor-ai-input");
    const button = document.getElementById("vendor-ai-send");
    const message = String(input?.value || "").trim().slice(0, 500);

    if (!message || !input || !button) {
        return;
    }

    aiBusy = true;
    input.disabled = true;
    button.disabled = true;
    button.textContent = "...";
    input.value = "";

    showDialogue("Coda d'Orso inspira come se stesse per sollevare anche la conversazione...");

    try {
        const { data, error } = await db.functions.invoke(
            "vendor-ai",
            {
                body: {
                    npc_id: NPC_AI_ID,
                    message,
                    history: aiVisitHistory
                }
            }
        );

        if (error) {
            throw error;
        }

        const reply = String(data?.reply || "").trim();

        if (!reply) {
            throw new Error("Coda d'Orso non risponde.");
        }

        aiVisitHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: reply }
        );

        aiVisitHistory = aiVisitHistory.slice(-12);
        showDialogue(reply);

    } catch (error) {
        console.error("Errore IA Coda d'Orso:", error);
        showDialogue("EH?! Problema tecnico! Fai dieci piegamenti e riprova!");

    } finally {
        aiBusy = false;
        input.disabled = false;
        button.disabled = false;
        button.textContent = "PARLA";
        input.focus();
    }
}


function showDialogue(text) {
    const target = document.getElementById("dialogue");
    if (target) {
        target.textContent = text;
    }
}


function feedback(text, isError = false) {
    const target = document.getElementById("feedback");
    target.textContent = text || "";
    target.classList.toggle("is-error", Boolean(isError));
}


function disableTrainingButtons(disabled) {
    document.querySelectorAll(".training-panel button").forEach(button => {
        button.disabled = disabled;
    });
}
