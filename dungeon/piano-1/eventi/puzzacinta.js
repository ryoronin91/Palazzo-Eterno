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
let transitionPending = false;
let room = null;
let joinedRunId = null;
let enteredAfterTimeout = false;
let timeoutRedirectScheduled = false;
let roomBusy = false;
let lastRoomTick = 0;

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
function setTransition(title, textMessage) {
    const overlay = $("rare-transition");
    if (!overlay) return;
    $("rare-transition-title").textContent = title;
    $("rare-transition-text").textContent = textMessage;
    overlay.hidden = false;
}
function roleLabel(status) {
    if (status === "active") return "Interrogatore";
    if (status === "waiting") return "Spettatore in coda";
    if (status === "selected") return "Prescelto per la Rare Fight";
    if (status === "timeout") return "Espulso per timeout";
    return "Spettatore";
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
    const canAsk = visible && phase === "dialogue" && remaining > 0 && !sending && room?.my_status === "active" && new Date(room.turn_deadline).getTime() > Date.now();
    $("rare-question").disabled = !canAsk;
    $("rare-send").disabled = !canAsk;
    $("rare-fight").hidden = true; // Ingresso selettivo automatico, mai libero.
    if (phase === "dialogue") {
        const overlay = $("rare-transition");
        if (overlay) overlay.hidden = true;
        transitionPending = false;
    }
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
    if (!state?.visible || !["berserk_ready", "combat_active"].includes(state.phase) || !player?.id || room?.my_status !== "selected") return;
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
        autoStartedFight = false;
        await refreshState({ silent: true });
    }
}
async function askQuestion(event) {
    event.preventDefault();
    if (sending || !state?.visible || state.phase !== "dialogue" || room?.my_status !== "active") return;
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
        if (data.transformed) await refreshRoom();
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
    $("rare-exit").addEventListener("click", async () => {
        try {
            if (joinedRunId) {
                const { error } = await db.rpc("puzzacinta_leave_room", { p_run_id: joinedRunId });
                if (error) console.warn("Uscita dalla stanza Puzzacinta:", error);
            }
        } catch (error) {
            console.warn("Impossibile notificare l'uscita da Puzzacinta:", error);
        } finally {
            window.location.href = DUNGEON_URL;
        }
    });
    $("rare-room-form").addEventListener("submit", sendRoomMessage);
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
    await refreshRoom();
    refreshTimer = setInterval(async () => {
       if (!sending && !roomBusy) { await refreshState({ silent: true }); await refreshRoom(); }
       updateRoomClock();
    }, 3000);
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

async function refreshRoom() {
  if (roomBusy || !state?.visible || !state.run_id || !player?.id) return;
  roomBusy=true;
  try {
    if (joinedRunId !== state.run_id) {
      const {data:joinData,error:joinError}=await db.rpc("puzzacinta_join_room",{p_run_id:state.run_id});
      if (joinError) throw joinError;
      joinedRunId=state.run_id;
      // Chi rientra DOPO il timeout può assistere, ma non ottiene un altro turno.
      enteredAfterTimeout = joinData?.status === "timeout";
      timeoutRedirectScheduled = false;
    }
    const {data,error}=await db.rpc("puzzacinta_room_state",{p_run_id:state.run_id});
    if(error) throw error;
    room=data;
    renderRoom();
    render();
    if (["berserk_ready","combat_active"].includes(state.phase) && !transitionPending) {
      transitionPending = true;
      if (room.my_status === "selected") {
        setTransition(
          "Puzzacinta fugge nell'ombra",
          "Dal buio alle sue spalle risuona un pesante trascinarsi di catene... Sei tra i prescelti che affronteranno Berserk."
        );
        notify("Berserk irrompe nella stanza. Preparati allo scontro.");
        setTimeout(async () => {
          if (!autoStartedFight) {
            autoStartedFight = true;
            await enterFight();
          }
        }, 2300);
      } else {
        setTransition(
          "L'ombra si spezza",
          "La creaturina svanisce e una bestia prende il suo posto. Non sei tra i cinque selezionati: verrai ricondotto al dungeon."
        );
        setTimeout(() => window.location.replace(DUNGEON_URL), 2600);
      }
    }
    if (room.my_status === "timeout") {
      if (enteredAfterTimeout) {
        // La penalità rimane: nessuna nuova domanda, nessun nuovo turno.
        notify("Hai già esaurito il turno: puoi assistere come spettatore e usare la chat.");
      } else if (!timeoutRedirectScheduled) {
        // Espulsione una sola volta, al primo timeout effettivo.
        timeoutRedirectScheduled = true;
        notify("I tuoi cinque minuti sono scaduti. Hai lasciato il posto al prossimo avventuriero.");
        setTransition("Il tuo tempo è scaduto", "Puzzacinta ti scaccia dalla stanza e il turno passa al prossimo avventuriero in coda.");
        setTimeout(() => window.location.replace(DUNGEON_URL),1800);
      }
    }
  }catch(err){console.error("Stanza Puzzacinta:",err);notify(err.message||"Impossibile entrare nella stanza.");}
  finally{roomBusy=false;}
}
function updateRoomClock() {
  const target = $("rare-room-clock");
  if (!room?.turn_deadline) {target.textContent="In attesa";return;}
  const seconds=Math.max(0,Math.ceil((new Date(room.turn_deadline).getTime()-Date.now())/1000));
  target.textContent=`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}
function renderRoom() {
  $("rare-room").hidden=false;
  const myRole=room?.my_status;
  const participants = room?.participants || [];
  const current = participants.find(p => p.status === "active");
  const waiting = participants.filter(p => p.status === "waiting");
  const myIndex = participants.findIndex(p => p.character_id === player?.id || p.id === player?.id || p.name === player?.name);
  $("rare-room-role").textContent=myRole === "timeout" ? "SPETTATORE — TURNO ESAURITO" : myRole==="active"?"IL TUO TURNO — INTERROGATORE":myRole==="waiting"?"SPETTATORE — IN CODA":myRole==="selected"?"SELEZIONATO PER LA RARE FIGHT":"STANZA DI PUZZACINTA";
  $("rare-room-count").textContent=`${participants.length} presenti`;
  $("rare-room-players").textContent=participants.map(p=>`${p.name} (${p.status==="active"?"interrogatore":p.status==="selected"?"combattente":p.status==="timeout"?"uscito":"in attesa"})`).join(" · ");
  $("rare-my-role").textContent = roleLabel(myRole);
  $("rare-current-speaker").textContent = current?.name || "Nessuno";
  $("rare-queue-position").textContent = myRole === "active" ? "È il tuo turno" : myRole === "waiting" ? `#${Math.max(1, waiting.findIndex(p => (p.character_id === player?.id || p.id === player?.id || p.name === player?.name)) + 1)}` : myRole === "selected" ? "Combattente" : "—";
  const log=$("rare-room-chat");
  const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<60;
  log.replaceChildren();
  for(const row of room?.messages||[]){
    const p=document.createElement("p");
    const strong=document.createElement("strong");strong.textContent=`${row.name}: `;
    p.append(strong,document.createTextNode(row.message)); log.appendChild(p);
  }
  if(nearBottom) log.scrollTop=log.scrollHeight;
  updateRoomClock();
}
async function sendRoomMessage(event){
  event.preventDefault();
  if(!joinedRunId)return;
  const input=$("rare-room-message");const msg=input.value.trim();
  if(!msg)return;
  const {error}=await db.rpc("puzzacinta_send_room_message",{p_run_id:joinedRunId,p_message:msg});
  if(error){notify(error.message);return;}
  input.value="";
  await refreshRoom();
}
