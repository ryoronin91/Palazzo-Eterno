// PALAZZO ETERNO - Sblocco Stanza dell'Orologio tramite missione floor1_explorer.
// Da caricare DOPO eventi_base.js. Non modifica le scale né le ricompense esistenti.
(() => {
    "use strict";

    const DESTINATION = "../orologio/orologio.html";
    const PORTAL_CELLS = ["9,28", "10,28", "9,29", "10,29"];

    // Le 16 caselle di arrivo richieste, tutte percorribili in orologio.json.
    const CLOCK_ARRIVAL_CELLS = [
        [25,13], [25,12], [24,12], [24,13],
        [13,23], [14,23], [13,24], [14,24],
        [2,12], [3,12], [2,13], [3,13],
        [13,2], [14,2], [13,3], [14,3]
    ];

    // Garanzia per le quattro nuove caselle anche in caso di cache del precedente base.js.
    if (typeof BASE_TELEPORT_CELLS !== "undefined") {
        BASE_TELEPORT_CELLS.clear();
        PORTAL_CELLS.forEach(cell => BASE_TELEPORT_CELLS.add(cell));
    }

    async function checkClockUnlock() {
        // Fonte autorevole: missione riscossa dall'utente autenticato.
        const { data, error } = await db.rpc("can_use_clock_teleport");
        if (error) throw new Error(`Verifica missione: ${error.message}`);
        if (typeof data !== "boolean") {
            throw new Error("Risposta inattesa dal controllo dello sblocco.");
        }
        return data;
    }

    async function travelToClock(button) {
        if (button.disabled) return;
        button.disabled = true;
        button.textContent = "TELETRASPORTO...";
        try {
            // La verifica viene ripetuta prima di ogni viaggio.
            if (!await checkClockUnlock()) {
                throw new Error("Completa prima la missione «Occhio che è facile perdersi qui..».");
            }
            if (!character || !character.id) throw new Error("Personaggio non disponibile.");
            if (typeof flushBasePositionSave === "function") await flushBasePositionSave();

            // Il caricamento della Stanza dell'Orologio legge orologio_x/y
            // direttamente dal personaggio: impostarli PRIMA del cambio pagina
            // evita che l'ultima posizione salvata prevalga sul nuovo arrivo.
            const [arrivalX, arrivalY] = CLOCK_ARRIVAL_CELLS[
                Math.floor(Math.random() * CLOCK_ARRIVAL_CELLS.length)
            ];
            // Il portale registra anche l'ambiente effettivo: Cura e ingresso
            // al Piano I verificano current_location sul server.
            const { error: arrivalError } = await db
                .from("characters")
                .update({
                    orologio_x: arrivalX,
                    orologio_y: arrivalY,
                    current_location: "orologio"
                })
                .eq("id", character.id);
            if (arrivalError) throw arrivalError;
            character.orologio_x = arrivalX;
            character.orologio_y = arrivalY;
            try {
                sessionStorage.setItem("palazzo_eterno_orologio_position",
                    JSON.stringify({ x: arrivalX, y: arrivalY }));
            } catch (storageError) {
                console.warn("Salvataggio posizione Orologio nel browser:", storageError);
            }

            // La Stanza dell'Orologio gestisce coordinate indipendenti dalla Base.
            // La Moneta Spaziale supporta ora esplicitamente current_location='orologio'.
            if (typeof baseChannel !== "undefined" && baseChannel) {
                try { await baseChannel.untrack(); }
                catch (presenceError) { console.warn("Presence Base:", presenceError); }
            }
            window.location.href = DESTINATION;
        } catch (error) {
            console.error("Teletrasporto verso Orologio:", error);
            if (typeof setMessage === "function") setMessage(error.message || "Teletrasporto non riuscito.", true);
            button.disabled = false;
            button.textContent = "STANZA DELL'OROLOGIO";
        }
    }

    // Il popup del portale viene sostituito, mantenendo il pulsante del Dungeon.
    // La destinazione aggiuntiva è disponibile solo ai personaggi che hanno riscosso la missione.
    window.openBaseTeleportPrompt = function openBaseTeleportPrompt() {
        if (baseTeleportPromptOpen || document.getElementById("base-teleport-overlay")) return;
        baseTeleportPromptOpen = true;

        const overlay = document.createElement("div");
        overlay.id = "base-teleport-overlay";
        overlay.className = "combat-event-overlay";
        const modal = document.createElement("div");
        modal.className = "combat-event-modal";
        modal.innerHTML = `
            <div class="combat-event-icon">✦</div>
            <h2>TELETRASPORTO</h2>
            <p>Il portale collega il Livello Base all'Ingresso del Palazzo.</p>
            <div class="combat-event-warning" id="base-clock-unlock-message">
                Destinazione: Dungeon. Verifica delle altre destinazioni...
            </div>
            <div class="combat-event-buttons">
                <button id="base-teleport-enter" type="button"
                        class="combat-event-button combat-event-enter">ENTRA NEL DUNGEON</button>
                <button id="base-teleport-clock" type="button"
                        class="combat-event-button combat-event-enter" style="display:none" hidden>STANZA DELL'OROLOGIO</button>
                <button id="base-teleport-cancel" type="button"
                        class="combat-event-button combat-event-cancel">RIMANI NELLA BASE</button>
            </div>`;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById("base-teleport-cancel")?.addEventListener("click", () => {
            closeBaseTeleportPrompt();
            if (typeof setMessage === "function") setMessage("Decidi di rimanere nel Livello Base.");
        });
        document.getElementById("base-teleport-enter")?.addEventListener("click", () => {
            void teleportBasePlayerToDungeon();
        });
        const clockButton = document.getElementById("base-teleport-clock");
        clockButton?.addEventListener("click", () => void travelToClock(clockButton));
        const status = document.getElementById("base-clock-unlock-message");
        void checkClockUnlock().then(unlocked => {
            if (!overlay.isConnected) return;
            if (clockButton) { clockButton.hidden = !unlocked; clockButton.style.display = unlocked ? "" : "none"; }
            if (status) status.textContent = unlocked
                ? "Hai scoperto una seconda destinazione. Scegli dove andare."
                : "La missione «Occhio che è facile perdersi qui..» non risulta ancora riscossa per questo personaggio.";
        }).catch(error => {
            console.warn("Verifica sblocco Orologio:", error);
            if (overlay.isConnected && status) status.textContent =
                `Dungeon disponibile. Verifica Orologio fallita: ${error?.message || "errore sconosciuto"}.`;
        });
    };
})();
