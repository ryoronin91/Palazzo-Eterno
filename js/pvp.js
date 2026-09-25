
console.log("PVP.JS v1 CARICATO");

const db = supabaseClient;
const PVP_COLUMNS = 12;
const PVP_ROWS = 12;

let currentUser = null;
let currentCharacter = null;
let pvpId = null;
let session = null;
let entities = [];
let myEntity = null;
let refreshTimer = null;
let targetMode = null;
let defeatedRedirected = false;
let waitingTimeoutInProgress = false;

document.addEventListener("DOMContentLoaded", initPvp);

async function initPvp(){
    try{
        await loadUserAndCharacter();

        const params = new URLSearchParams(window.location.search);
        pvpId = params.get("pvp_id");

        if(!pvpId){
            const {data,error}=await db.rpc("get_or_create_pvp_session");
            if(error) throw error;
            pvpId=data;
            history.replaceState(null,"",`pvp.html?pvp_id=${encodeURIComponent(pvpId)}`);
        }

        const {error:joinError}=await db.rpc("join_pvp_session",{
            p_pvp_id:pvpId,
            p_character_id:currentCharacter.id
        });
        if(joinError) throw joinError;

        setupEvents();
        await refreshPvp();

        refreshTimer=setInterval(refreshPvp,1000);
    }catch(error){
        console.error("Errore PVP:",error);
        setStatus(error.message||"Errore caricamento arena.");
    }
}

async function loadUserAndCharacter(){
    const {data:{user},error}=await db.auth.getUser();
    if(error) throw error;
    if(!user){
        location.href="login.html";
        return;
    }
    currentUser=user;

    const {data:character,error:characterError}=await db
        .from("characters")
        .select("id,user_id,nome,token,current_hp,current_pm,score")
        .eq("user_id",user.id)
        .maybeSingle();

    if(characterError) throw characterError;
    if(!character){
        location.href="personaggio.html";
        return;
    }
    currentCharacter=character;
}

async function refreshPvp(){
    try{
        const [{data:s,error:sErr},{data:e,error:eErr}] = await Promise.all([
            db.from("pvp_sessions").select("*").eq("id",pvpId).single(),
            db.from("pvp_entities").select("*").eq("pvp_id",pvpId)
        ]);
        if(sErr) throw sErr;
        if(eErr) throw eErr;

        session=s;
        entities=(e||[]).sort((a,b)=>{
            const ia=Number(a.initiative??-999);
            const ib=Number(b.initiative??-999);
            if(ib!==ia) return ib-ia;
            return String(a.id).localeCompare(String(b.id));
        });

        myEntity=entities.find(x=>x.character_id===currentCharacter?.id)||null;

        // ====================================================
        // TIMEOUT LOBBY: 1 MINUTO DA SOLI
        // ====================================================

        if(
            session.status==="waiting" &&
            entities.length===1 &&
            myEntity
        ){
            const joinedAtMs=Date.parse(myEntity.joined_at||"");

            if(Number.isFinite(joinedAtMs)){
                const elapsedSeconds=Math.floor((Date.now()-joinedAtMs)/1000);
                const remainingSeconds=Math.max(0,60-elapsedSeconds);

                setStatus(
                    `In attesa di un avversario · ritorno al dungeon tra ${remainingSeconds}s`
                );

                if(
                    remainingSeconds<=0 &&
                    !waitingTimeoutInProgress
                ){
                    await handleWaitingTimeout();
                    return;
                }
            }
        }

        if(!myEntity && session.status==="active" && !defeatedRedirected){
            await redirectDefeatedPlayer();
            return;
        }

        renderPvp();
    }catch(error){
        console.error("Refresh PVP:",error);
    }
}

function renderPvp(){
    const lobby=document.getElementById("pvp-lobby");
    const combat=document.getElementById("pvp-combat");

    const waiting=session.status==="waiting";
    lobby.hidden=!waiting;
    combat.hidden=waiting;

    if(waiting){
        renderLobby();

        if(entities.length!==1){
            setStatus(`Arena in attesa · ${entities.length}/8 combattenti`);
        }

        return;
    }

    renderMap();
    renderTurns();
    renderSheet();

    if(session.status==="victory"){
        renderVictory();
    }else{
        const current=entities.find(x=>x.id===session.current_turn_entity_id);
        setStatus(`Round ${session.round_number} · Turno di ${current?.display_name||"—"}`);
    }
}

function renderLobby(){
    const list=document.getElementById("pvp-lobby-list");
    list.innerHTML=entities.map(e=>
        `<div class="pvp-lobby-player">${escapeHtml(e.display_name)}</div>`
    ).join("") || `<div class="pvp-lobby-player">Nessun combattente.</div>`;

    document.getElementById("pvp-start-button").disabled=entities.length<2;
}

function renderMap(){
    const map=document.getElementById("pvp-map");
    map.innerHTML="";

    entities.forEach(entity=>{
        const token=document.createElement("div");
        token.className="pvp-token";
        if(entity.character_id===currentCharacter?.id) token.classList.add("me");
        if(entity.status!=="alive"||Number(entity.current_hp)<=0) token.classList.add("dead");

        const targetable =
            targetMode==="attack" &&
            isMyTurn() &&
            entity.id!==myEntity?.id &&
            entity.status==="alive" &&
            chebyshev(myEntity.x,myEntity.y,entity.x,entity.y)<=1;

        if(targetable) token.classList.add("targetable");

        token.style.left=`${Number(entity.x)*100/PVP_COLUMNS}%`;
        token.style.top=`${Number(entity.y)*100/PVP_ROWS}%`;

        const img=document.createElement("img");
        img.src=resolveToken(entity.token);
        img.alt=entity.display_name||"PG";
        img.draggable=false;

        const label=document.createElement("div");
        label.className="pvp-token-label";
        label.textContent=`${entity.display_name} ${entity.current_hp}/${entity.max_hp}`;

        token.append(img,label);

        token.addEventListener("click",async()=>{
            if(targetMode==="attack" && targetable){
                await attackTarget(entity.id);
            }
        });

        map.appendChild(token);
    });
}

function renderTurns(){
    const list=document.getElementById("pvp-turn-list");
    list.innerHTML=entities.map((e,index)=>{
        const current=e.id===session.current_turn_entity_id;
        const dead=e.status!=="alive"||Number(e.current_hp)<=0;
        return `<div class="pvp-turn-row${current?" current":""}${dead?" dead":""}">
            <span>${index+1}</span>
            <span>${escapeHtml(e.display_name)}</span>
            <strong>${e.initiative??"—"}</strong>
        </div>`;
    }).join("");
}

function renderSheet(){
    const name=document.getElementById("pvp-character-name");
    const hp=document.getElementById("pvp-hp");
    const pm=document.getElementById("pvp-pm");
    const move=document.getElementById("pvp-move");
    const attack=document.getElementById("pvp-attack-button");
    const pass=document.getElementById("pvp-pass-button");

    name.textContent=myEntity?.display_name||currentCharacter?.nome||"PERSONAGGIO";
    hp.textContent=myEntity?`${myEntity.current_hp}/${myEntity.max_hp}`:"—";
    pm.textContent=myEntity?`${myEntity.current_pm}/${myEntity.max_pm}`:"—";
    move.textContent=myEntity?`${myEntity.movement_remaining}/${myEntity.movement_max}`:"—";

    const mine=isMyTurn();
    attack.disabled=!mine||myEntity?.action_used===true;
    pass.disabled=!mine;
}

function renderVictory(){
    const overlay=document.getElementById("pvp-victory");
    const winner=entities.find(e=>e.character_id===session.winner_character_id)
        || entities.find(e=>e.status==="alive"&&Number(e.current_hp)>0);

    overlay.hidden=false;
    document.getElementById("pvp-victory-name").textContent =
        winner?.display_name || "Vincitore";
    setStatus("Arena conclusa");
}

function isMyTurn(){
    return !!(
        session?.status==="active" &&
        myEntity &&
        myEntity.status==="alive" &&
        myEntity.id===session.current_turn_entity_id
    );
}

function setupEvents(){
    document.getElementById("pvp-start-button").addEventListener("click",startArena);

    document.getElementById("pvp-attack-button").addEventListener("click",()=>{
        if(!isMyTurn()) return;
        targetMode=targetMode==="attack"?null:"attack";
        addLog(targetMode
            ?"Seleziona un avversario adiacente."
            :"Selezione bersaglio annullata.");
        renderMap();
    });

    document.getElementById("pvp-pass-button").addEventListener("click",passTurn);

    window.addEventListener("keydown",async event=>{
        if(!isMyTurn()) return;

        const key=event.key.toLowerCase();
        const moves={
            "w":[0,-1],
            "arrowup":[0,-1],
            "s":[0,1],
            "arrowdown":[0,1],
            "a":[-1,0],
            "arrowleft":[-1,0],
            "d":[1,0],
            "arrowright":[1,0]
        };

        if(!moves[key]) return;
        event.preventDefault();
        const [dx,dy]=moves[key];
        await movePlayer(dx,dy);
    });
}


async function handleWaitingTimeout(){
    if(waitingTimeoutInProgress) return;

    waitingTimeoutInProgress=true;

    try{
        const {data,error}=await db.rpc(
            "pvp_cancel_if_alone",
            {
                p_pvp_id:pvpId,
                p_character_id:currentCharacter.id
            }
        );

        if(error) throw error;

        // Se nel frattempo è entrato un altro giocatore,
        // la RPC restituisce false e restiamo nell'arena.
        if(data===true){
            clearInterval(refreshTimer);
            setStatus("Nessun avversario è arrivato. Ritorno al dungeon...");
            window.location.href="dungeon.html";
            return;
        }

        waitingTimeoutInProgress=false;
        await refreshPvp();

    }catch(error){
        console.error("Errore timeout lobby PvP:",error);
        waitingTimeoutInProgress=false;
        addLog(cleanError(error));
    }
}


async function startArena(){
    const button=document.getElementById("pvp-start-button");
    button.disabled=true;
    try{
        const {error}=await db.rpc("start_pvp_session",{p_pvp_id:pvpId});
        if(error) throw error;
        await refreshPvp();
    }catch(error){
        addLog(cleanError(error));
        button.disabled=false;
    }
}

async function movePlayer(dx,dy){
    if(!isMyTurn()||Number(myEntity.movement_remaining)<=0) return;

    try{
        const {error}=await db.rpc("pvp_move",{
            p_pvp_id:pvpId,
            p_character_id:currentCharacter.id,
            p_dx:dx,
            p_dy:dy
        });
        if(error) throw error;
        targetMode=null;
        await refreshPvp();
    }catch(error){
        addLog(cleanError(error));
    }
}

async function attackTarget(targetEntityId){
    if(!isMyTurn()) return;
    targetMode=null;

    try{
        const {data,error}=await db.rpc("pvp_basic_attack",{
            p_pvp_id:pvpId,
            p_character_id:currentCharacter.id,
            p_target_entity_id:targetEntityId
        });
        if(error) throw error;

        let text=`${data.attacker_name} attacca ${data.target_name}: 1d10 (${data.roll}) + ATT ${data.attack} = ${data.total} contro DIF ${data.defense}. `;
        text+=data.hit?`${data.damage} danni`:"MANCATO";
        if(data.critical) text+=" · CRITICO!";
        if(data.target_dead) text+=` · ${data.target_name} è sconfitto!`;
        addLog(text);

        await refreshPvp();
    }catch(error){
        addLog(cleanError(error));
    }
}

async function passTurn(){
    if(!isMyTurn()) return;
    targetMode=null;

    try{
        const {error}=await db.rpc("pvp_pass_turn",{
            p_pvp_id:pvpId,
            p_character_id:currentCharacter.id
        });
        if(error) throw error;
        await refreshPvp();
    }catch(error){
        addLog(cleanError(error));
    }
}

async function redirectDefeatedPlayer(){
    defeatedRedirected=true;
    clearInterval(refreshTimer);

    try{
        const {data,error}=await db
            .from("dead_characters")
            .select("character_id,character_name,score")
            .eq("user_id",currentUser.id)
            .order("created_at",{ascending:false})
            .limit(1)
            .maybeSingle();

        if(!error && data){
            location.href=`morte.html?nome=${encodeURIComponent(data.character_name||"Avventuriero")}&score=${encodeURIComponent(data.score||0)}&character_id=${encodeURIComponent(data.character_id)}`;
            return;
        }
    }catch(_){}

    location.href="morte.html";
}

function setStatus(text){
    const el=document.getElementById("pvp-status");
    if(el) el.textContent=text;
}

function addLog(text){
    const log=document.getElementById("pvp-log");
    if(!log) return;
    const row=document.createElement("div");
    row.className="pvp-log-entry";
    row.textContent=text;
    log.appendChild(row);
    log.scrollTop=log.scrollHeight;
}

function resolveToken(token){
    if(!token) return "immagini/token/token_1.png";
    if(token.includes("/")) return token;
    return `immagini/token/${token}`;
}

function chebyshev(x1,y1,x2,y2){
    return Math.max(Math.abs(Number(x2)-Number(x1)),Math.abs(Number(y2)-Number(y1)));
}

function escapeHtml(value){
    return String(value??"")
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");
}

function cleanError(error){
    return error?.message?.replace(/^.*?: /,"")||"Errore PvP.";
}
