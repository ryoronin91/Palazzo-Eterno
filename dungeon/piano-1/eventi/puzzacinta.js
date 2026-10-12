// Palazzo Eterno — Pagina evento raro Puzzacinta
const db = supabaseClient;
const DUNGEON_URL = "../dungeon.html";
const VOLUME_KEY = "palazzo-eterno-dungeon-volume";
const $ = (id) => document.getElementById(id);
let state = null;
let player = null;
let sending = false;
let channel = null;
let refreshTimer = null;
let music = null;
let autoStartedFight = false;

function notify(message) { $("rare-notice").textContent = message || ""; }
function appendBubble(name, message, type) {
    const row = document.createElement("div");
    row.className = `rare-bubble ${type}`;
    const nameNode = document.createElement("strong");
    nameNode.textContent = name;
    const body = document.createElement("p");
    body.textContent = message;
    row.append(nameNode, body);
    $("rare-messages").appendChild(row);
    $("rare-messages").scrollTop = $("rare-messages").scrollHeight;
}
function render() {
    const visible = state?.visible === true;
    const phase = state?.phase || "hidden";
    const remaining = visible ? Math.max(0, Number(state.questions_remaining) || 0) : 0;
    $("rare-remaining").textContent = visible ? String(remaining) : "–";
    $("rare-status").textContent = !visible ? "L'apparizione non è disponibile." :
        phase === "dialogue" ? "Le domande sono condivise tra tutti i giocatori." :
        phase === "berserk_ready" ? "Puzzacinta è fuggito. Berserk è apparso!" :
        "La Rare Fight è iniziata.";
    const canAsk = visible && phase === "dialogue" && remaining > 0 && !sending;
    $("rare-question").disabled = !canAsk;
    $("rare-send").disabled = !canAsk;
    $("rare-fight").hidden = !visible || !["berserk_ready", "combat_active"].includes(phase);
    [...$("rare-pips").children].forEach((el, i) => el.classList.toggle("remaining", i < remaining));
    const rows = Array.isArray(state?.questions) ? state.questions : [];
    const log = $("rare-messages");
    log.replaceChildren();
    if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "rare-empty";
        empty.textContent = "L'oscurità trattiene il fiato in attesa di una domanda…";
        log.appendChild(empty);
    }
    for (const q of rows) {
        appendBubble(`${q.character || "Avventuriero"} · DOMANDA ${q.number}`, q.question || "", "player");
        appendBubble("PUZZACINTA", q.answer || "", "npc");
    }
}
async function refreshState({ silent = false } = {}) {
    try {
        const { data, error } = await db.rpc("get_puzzacinta_state");
        if (error) throw error;
        state = data || { visible: false };
        render();
        if (!silent && !state.visible) notify("Puzzacinta è sparito nell'ombra. Torna durante una delle sei apparizioni.");
        return state;
    } catch (error) {
        console.error("Puzzacinta state:", error);
        if (!silent) notify("Impossibile aggiornare l'apparizione. Verifica che lo SQL sia stato installato.");
        return null;
    }
}
async function enterFight() {
    if (!state?.visible || !["berserk_ready", "combat_active"].includes(state.phase) || !player?.id) return;
    const button = $("rare-fight-enter");
    button.disabled = true;
    notify("Berserk ti ha individuato. Preparazione dello scontro...");
    try {
        const { data, error } = await db.rpc("enter_puzzacinta_combat", {
            p_character_id: player.id, p_run_id: state.run_id
        });
        if (error) throw error;
        if (!data) throw new Error("Sessione di combattimento non ricevuta");
        window.location.href = `../../../combat.html?combat_id=${encodeURIComponent(data)}`;
    } catch (error) {
        console.error("Ingresso Rare Fight:", error);
        notify(error.message || "Non è stato possibile entrare nella Rare Fight.");
        button.disabled = false;
        await refreshState({ silent: true });
    }
}
async function askQuestion(event) {
    event.preventDefault();
    if (sending || !state?.visible || state.phase !== "dialogue") return;
    const question = $("rare-question").value.trim();
    if (question.length < 2 || question.length > 500) { notify("Scrivi una domanda tra 2 e 500 caratteri."); return; }
    sending = true;
    const submittedRunId = state.run_id;
    render();
    notify("Puzzacinta riflette sulla tua domanda…");
    try {
        const { data, error } = await db.functions.invoke("puzzacinta-ai", { body: {
            run_id: submittedRunId, request_id: crypto.randomUUID(), message: question
        } });
        if (error) throw new Error(data?.error || error.message);
        if (!data?.ok) throw new Error(data?.error || "Puzzacinta non ha risposto.");
        $("rare-question").value = "";
        await refreshState({ silent: true });
        notify(data.transformed ? "Puzzacinta fugge! Berserk irrompe nella stanza!" : "Puzzacinta ha risposto.");
        if (data.transformed && !autoStartedFight) {
            autoStartedFight = true;
            // Dopo la quinta risposta, chi ha posto la domanda entra in combattimento.
            // Gli altri giocatori vedono il token Berserk e possono unirsi.
            setTimeout(enterFight, 2600);
        }
    } catch (error) {
        console.warn("Errore domanda rara", error);
        notify(error.message || "Domanda non riuscita; il tentativo non è stato consumato.");
        await refreshState({ silent: true });
    } finally {
        sending = false;
        render();
    }
}
function setupVolume() {
    let volume = .35;
    try { const saved = localStorage.getItem(VOLUME_KEY); if (saved !== null) { const stored = Number(saved); if (Number.isFinite(stored)) volume = Math.min(1, Math.max(0, stored)); } } catch (_) {}
    music = new Audio("../../../music/puzzacinta.mp3");
    music.loop = true;
    music.volume = volume;
    const button = $("rare-volume");
    const slider = $("rare-volume-slider");
    const pop = $("rare-volume-controls");
    const update = () => {
        slider.value = String(Math.round(volume * 100));
        $("rare-volume-label").textContent = `${Math.round(volume * 100)}%`;
        button.textContent = volume === 0 ? "🔇" : volume < .5 ? "🔉" : "🔊";
        music.volume = volume;
    };
    update();
    slider.addEventListener("input", () => {
        volume = Number(slider.value) / 100;
        update();
        try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch (_) {}
    });
    button.addEventListener("click", () => { pop.hidden = !pop.hidden; button.setAttribute("aria-expanded",String(!pop.hidden)); });
    const tryMusic = () => music.play().catch(() => {});
    tryMusic();
    document.addEventListener("pointerdown", tryMusic, { once: true });
}
document.addEventListener("DOMContentLoaded", async () => {
    $("rare-exit").addEventListener("click", () => { window.location.href = DUNGEON_URL; });
    $("rare-fight-enter").addEventListener("click", enterFight);
    $("rare-question-form").addEventListener("submit", askQuestion);
    setupVolume();
    const { data: auth } = await db.auth.getUser();
    if (!auth?.user) { window.location.replace("../../../login.html"); return; }
    const { data: character, error } = await db.from("characters")
        .select("id,current_location,active_combat_id")
        .eq("user_id", auth.user.id).maybeSingle();
    if (error || !character) { notify("Personaggio non trovato."); return; }
    player = character;
    if (player.active_combat_id) {
        window.location.replace(`../../../combat.html?combat_id=${encodeURIComponent(player.active_combat_id)}`);
        return;
    }
    if (player.current_location !== "dungeon") { window.location.replace(DUNGEON_URL); return; }
    await refreshState();
    refreshTimer = setInterval(() => { if (!sending) refreshState({ silent: true }); }, 30000);
    channel = db.channel("puzzacinta-dialogue")
        .on("postgres_changes", { event: "*", schema: "public", table: "dungeon_rare_event_runs" },
            () => { if (!sending) refreshState({ silent: true }); })
        .subscribe();
});
window.addEventListener("beforeunload", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    if (channel) db.removeChannel(channel);
    if (music) { music.pause(); music = null; }
});
