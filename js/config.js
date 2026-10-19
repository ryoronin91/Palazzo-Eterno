const SUPABASE_URL = "https://bhqinurfersdgrxbgfrf.supabase.co";

const SUPABASE_KEY = "sb_publishable_9h0J-1bqT9FoT0dB6ylLcw_pm_I0346";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Palazzo Eterno - Supabase collegato!");
console.log(supabaseClient);

// ============================================================
// PALAZZO ETERNO — PRESENZA GLOBALE
// Caricata da config.js su mappe, scheda, servizi e combattimenti.
// I canali locali restano esclusivamente per token e multiplayer.
// ============================================================
(function () {
    const CHANNEL = "palazzo-eterno-online-globale-v1";
    const GRACE_MS = 5000;
    const AREA_LABELS = {
        base: "Base",
        dungeon: "Dungeon",
        dungeon_Ia: "I - Giungla Bassa",
        orologio: "Stanza dell’Orologio"
    };
    const players = new Map();
    let channel = null;
    let myCharacter = null;
    let myArea = null;
    let refreshTimer = null;

    function rootPrefix() {
        const path = window.location.pathname;
        if (path.includes("/base/services/")) return "../../../";
        if (path.includes("/dungeon/piano-")) return "../../";
        if (path.includes("/base/")) return "../";
        if (path.includes("/orologio/")) return "../";
        return "";
    }

    function getPageArea() {
        const path = window.location.pathname;
        if (path.includes("/dungeon/piano-I/")) return "dungeon_Ia";
        if (path.includes("/dungeon/piano-1/")) return "dungeon";
        if (path.includes("/base/")) return "base";
        if (path.includes("/orologio/")) return "orologio";
        return null;
    }

    function normalizeArea(value) {
        if (value === "base" || value === "vendor" || value === "runografo" ||
            value === "locanda" || value === "addestratore" || value === "questgiver") return "base";
        if (value === "dungeon_Ia") return "dungeon_Ia";
        if (value === "dungeon") return "dungeon";
        if (value === "orologio") return "orologio";
        return null;
    }

    async function resolveArea(character) {
        const direct = getPageArea();
        if (direct) return direct;
        const location = normalizeArea(character.current_location);
        const isCombatPage = /\/(combat|pvp)\.html$/i.test(window.location.pathname);
        if (isCombatPage && character.active_combat_id) {
            try {
                const { data, error } = await supabaseClient
                    .from("combat_sessions")
                    .select("encounter_id")
                    .eq("id", character.active_combat_id)
                    .maybeSingle();
                if (!error && data?.encounter_id) {
                    const encounter = String(data.encounter_id).toLowerCase();
                    if (encounter.startsWith("p1_")) return "dungeon_Ia";
                    if (encounter.startsWith("base_")) return "base";
                    return "dungeon";
                }
            } catch (error) {
                console.warn("[PRESENCE] Piano del combattimento non disponibile:", error);
            }
        }
        if (location) return location;
        try {
            return normalizeArea(sessionStorage.getItem("palazzo_last_map_area")) || "base";
        } catch {
            return "base";
        }
    }

    function remember(presence) {
        if (!presence?.character_id) return;
        const id = presence.character_id;
        const current = players.get(id);
        if (!current || String(presence.online_at || "") >= String(current.data.online_at || "")) {
            players.set(id, { data: presence, seenAt: Date.now() });
        } else {
            current.seenAt = Date.now();
        }
    }

    function render() {
        const container = document.getElementById("dungeon-online-list");
        if (!container) return;
        const now = Date.now();
        const visible = [];
        for (const [id, item] of players.entries()) {
            if (now - item.seenAt > GRACE_MS) {
                players.delete(id);
            } else {
                visible.push(item.data);
            }
        }
        visible.sort((a, b) => {
            if ((a.character_id === myCharacter?.id) !== (b.character_id === myCharacter?.id))
                return a.character_id === myCharacter?.id ? -1 : 1;
            return String(a.name || "").localeCompare(String(b.name || ""), "it");
        });

        container.replaceChildren();
        if (!visible.length) {
            const placeholder = document.createElement("div");
            placeholder.className = "dungeon-online-empty";
            placeholder.textContent = channel ? "Nessun personaggio online." : "Connessione...";
            container.appendChild(placeholder);
            return;
        }

        const prefix = rootPrefix();
        for (const player of visible) {
            const row = document.createElement("div");
            row.className = "dungeon-online-row";
            const avatar = document.createElement("img");
            avatar.className = "dungeon-online-token";
            avatar.src = prefix + "immagini/token/" + (player.token || "token_1.png");
            avatar.alt = player.name || "Personaggio";
            const info = document.createElement("div");
            info.className = "dungeon-online-info";
            const name = document.createElement("div");
            name.className = "dungeon-online-name";
            name.textContent = (player.name || "Avventuriero") +
                (player.character_id === myCharacter?.id ? " (tu)" : "");
            const status = document.createElement("div");
            status.className = "dungeon-online-status";
            const label = AREA_LABELS[player.location] || "Posizione non disponibile";
            status.textContent = label + (player.in_combat ? " · In combattimento" : "");
            const dot = document.createElement("span");
            dot.className = "dungeon-online-dot";
            info.append(name, status);
            row.append(avatar, info, dot);
            container.appendChild(row);
        }
    }

    function sync() {
        if (!channel) return;
        const incoming = new Map();
        const state = channel.presenceState();
        for (const presences of Object.values(state)) {
            for (const item of (presences || [])) {
                if (!item?.character_id) continue;
                const old = incoming.get(item.character_id);
                if (!old || String(item.online_at || "") > String(old.online_at || ""))
                    incoming.set(item.character_id, item);
            }
        }
        for (const presence of incoming.values()) remember(presence);
        render();
    }

    async function start() {
        if (channel) return;
        try {
            const { data: auth, error: authError } = await supabaseClient.auth.getUser();
            if (authError || !auth?.user) return;
            const { data: character, error } = await supabaseClient
                .from("characters")
                .select("id, nome, token, current_location, active_combat_id")
                .eq("user_id", auth.user.id)
                .maybeSingle();
            if (error || !character) return;
            myCharacter = character;
            myArea = await resolveArea(character);
            try { sessionStorage.setItem("palazzo_last_map_area", myArea); } catch {}

            channel = supabaseClient.channel(CHANNEL, {
                config: { presence: { key: character.id } }
            });
            channel.on("presence", { event: "sync" }, sync);
            channel.on("presence", { event: "join" }, sync);
            channel.on("presence", { event: "leave" }, sync);
            channel.subscribe(async status => {
                if (status !== "SUBSCRIBED") return;
                try {
                    const inCombat = Boolean(character.active_combat_id) ||
                        /\/(combat|pvp)\.html$/i.test(window.location.pathname);
                    await channel.track({
                        character_id: character.id,
                        name: character.nome || "Avventuriero",
                        token: character.token || "token_1.png",
                        location: myArea,
                        in_combat: inCombat,
                        online_at: new Date().toISOString()
                    });
                    sync();
                } catch (error) {
                    console.warn("[PRESENCE] Registrazione non riuscita:", error);
                }
            });
            refreshTimer = window.setInterval(sync, 2500);
            render();
        } catch (error) {
            console.warn("[PRESENCE] Servizio globale non disponibile:", error);
        }
    }

    window.PalazzoPresence = { render, refresh: sync };
    document.addEventListener("DOMContentLoaded", start);
    window.addEventListener("beforeunload", () => {
        if (refreshTimer) clearInterval(refreshTimer);
        if (channel) {
            try { channel.untrack(); supabaseClient.removeChannel(channel); } catch {}
        }
    });
})();
