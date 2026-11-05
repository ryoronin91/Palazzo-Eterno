// ============================================================
// PALAZZO ETERNO - PATCH PRESENZE MASTER (05/11/2026)
// Aggiungere QUESTO BLOCCO alla fine di js/master.js.
// Conserva la lista esistente, aggiornando posizione e area.
// ============================================================

(() => {
    "use strict";

    const previousUpdatePlayerList = updatePlayerList;
    const refreshIntervalMs = 30000;
    let lastPositionRequest = 0;
    let positionRequestRunning = false;

    const labels = Object.freeze({
        base: "Livello Base",
        dungeon: "Piano I - Dungeon",
        dungeon_Ia: "Piano I-A - Giungla Bassa",
        dungeon_Ib: "Piano I-B - Villaggio Scagliagrigia",
        dungeon_Ic: "Piano I-C - Giungla Alta",
        dungeon_Id: "Piano I-D - Tempio di Scintilla",
        orologio: "Stanza dell'Orologio",
        vendor: "Mercante del Dungeon",
        combat: "Combattimento"
    });

    function actualFloor(player) {
        const location = String(player?.current_location || "").trim();
        if (location !== "combat") return location || player?.floor || "dungeon";

        const combat = player?.active_combat_id
            ? activeMasterCombats.get(player.active_combat_id)
            : null;
        const source = String(combat?.floor_id || combat?.floor || "");
        if (labels[source] && source !== "combat") return source;
        if (String(combat?.encounter_id || "").startsWith("base_")) return "base";
        return "combat";
    }

    function actualLocationLabel(player) {
        const floor = actualFloor(player);
        return labels[floor] || (floor.startsWith("dungeon_I")
            ? `Piano ${floor.replace("dungeon_", "")}`
            : "Posizione non disponibile");
    }

    function actualCoordinates(player) {
        const location = actualFloor(player);
        if (["dungeon_Ia", "dungeon_Ib", "dungeon_Ic", "dungeon_Id"].includes(location)) {
            // Fonte esatta: RPC master_get_piano_i_overview, già usata
            // dalla panoramica dei quattro sottopiani.
            const saved = masterPianoIPositions.get(location)?.get(player.character_id);
            if (!saved || saved.is_active === false) return null;
            const x = Number(saved.x);
            const y = Number(saved.y);
            return Number.isFinite(x) && Number.isFinite(y) ? `X ${x} · Y ${y}` : null;
        }
        if (location === "base" && String(player.current_location) === "base") {
            if (player.base_x == null || player.base_y == null) return null;
            const x = Number(player.base_x);
            const y = Number(player.base_y);
            return Number.isFinite(x) && Number.isFinite(y) ? `X ${x} · Y ${y}` : null;
        }
        if (["dungeon", "vendor"].includes(location)) {
            if (player.dungeon_x == null || player.dungeon_y == null) return null;
            const x = Number(player.dungeon_x);
            const y = Number(player.dungeon_y);
            return Number.isFinite(x) && Number.isFinite(y) ? `X ${x} · Y ${y}` : null;
        }
        if (location === "orologio") {
            if (player.orologio_x == null || player.orologio_y == null) return null;
            const x = Number(player.orologio_x);
            const y = Number(player.orologio_y);
            return Number.isFinite(x) && Number.isFinite(y) ? `X ${x} · Y ${y}` : null;
        }
        // Durante il combattimento non mostrare coordinate di altre mappe.
        return null;
    }

    function updateLocationLabels() {
        const list = document.getElementById("master-player-list");
        if (!list) return;
        const players = [...masterControlAllPlayers].sort((a, b) =>
            Number(b.online) - Number(a.online) ||
            String(a.nome || "").localeCompare(String(b.nome || ""), "it")
        );
        const rows = list.querySelectorAll(".master-player-item");
        if (rows.length !== players.length) return;

        players.forEach((player, index) => {
            const row = rows[index];
            const label = actualLocationLabel(player);
            const coordinates = actualCoordinates(player);
            const position = row.querySelector(".master-player-position");
            if (position) {
                position.textContent = coordinates
                    ? `${label} · ${coordinates}`
                    : `${label} · Coordinate non disponibili`;
            }
            const floorBadge = row.querySelector(".master-status-badge.floor");
            if (floorBadge) floorBadge.textContent = label;
            row.setAttribute("aria-label", `Scheda ${player.nome || "Avventuriero"}, ${label}`);
        });
    }

    function refreshExactPositionsIfNeeded() {
        if (positionRequestRunning || Date.now() - lastPositionRequest < refreshIntervalMs) return;
        if (!masterControlAllPlayers.some(player =>
            ["dungeon_Ia", "dungeon_Ib", "dungeon_Ic", "dungeon_Id"].includes(actualFloor(player))
        )) return;
        lastPositionRequest = Date.now();
        positionRequestRunning = true;
        Promise.resolve()
            .then(() => loadMasterPianoIOverviewData(true))
            .then(() => updateLocationLabels())
            .catch(error => console.warn("Presenze Master: coordinate Piano I non disponibili", error))
            .finally(() => { positionRequestRunning = false; });
    }

    // Viene richiamato dal normale aggiornamento periodico del roster Master.
    updatePlayerList = function (...args) {
        const result = previousUpdatePlayerList.apply(this, args);
        updateLocationLabels();
        refreshExactPositionsIfNeeded();
        return result;
    };
})();
