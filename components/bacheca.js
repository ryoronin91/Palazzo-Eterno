(() => {
    const fallback = {
        novita: [
            "Il Livello Base è ora accessibile dal dungeon.",
            "Mano di Scimmia si è trasferito alla Base.",
            "Sono iniziati i lavori per i nuovi servizi della Base."
        ],
        upgrade: [
            "Sistema di costruzione e potenziamento dei servizi.",
            "Scambio tra giocatori."
        ],
        avvisi: ["Nuovi contenuti verranno aggiunti progressivamente."]
    };

    const titles = {
        novita: "COSA C'È DI NUOVO",
        upgrade: "PROSSIMI UPGRADE",
        avvisi: "BUG & SUGGERIMENTI"
    };

    let content = { ...fallback };

    function ensureFeedbackModal() {
        if (document.getElementById("feedback-modal")) return;

        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
            <div id="feedback-modal" class="feedback-modal" hidden>
                <div class="feedback-modal-backdrop" data-feedback-close></div>
                <section class="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
                    <button id="feedback-close-button" class="feedback-close-button" type="button" aria-label="Chiudi" title="Chiudi">×</button>
                    <h2 id="feedback-title" class="feedback-title">BUG &amp; SUGGERIMENTI</h2>
                    <p class="feedback-description">
                        Hai trovato un problema o hai un'idea per migliorare Palazzo Eterno?
                        Scrivila qui: verrà aggiunta direttamente alla lista delle cose da fare.
                    </p>
                    <textarea id="feedback-text" class="feedback-text" maxlength="2000" placeholder="Descrivi il bug o il suggerimento..."></textarea>
                    <div class="feedback-footer">
                        <span id="feedback-status" class="feedback-status" aria-live="polite"></span>
                        <button id="feedback-send-button" class="button" type="button">INVIA</button>
                    </div>
                </section>
            </div>`;

        const modal = wrapper.firstElementChild;
        if (modal) document.body.appendChild(modal);
    }

    async function loadRemoteContent() {
        if (typeof supabaseClient === "undefined") return;
        try {
            const { data, error } = await supabaseClient
                .from("noticeboard_entries")
                .select("section, content, sort_order")
                .eq("active", true)
                .order("sort_order", { ascending: true });
            if (error) throw error;
            const next = { novita: [], upgrade: [], avvisi: [] };
            (data || []).forEach(row => {
                if (next[row.section]) next[row.section].push(String(row.content || ""));
            });
            if (Object.values(next).some(items => items.length)) content = next;
        } catch (error) {
            console.warn("Bacheca: uso contenuti locali di fallback.", error);
        }
    }

    function markup(mode) {
        const cls = mode === "base" ? "base-noticeboard" : "public-noticeboard";
        return `
            <div class="${cls}-header shared-noticeboard-header">
                <div class="${cls}-kicker shared-noticeboard-kicker">PALAZZO ETERNO</div>
                <h2 class="${cls}-title shared-noticeboard-title">${mode === "base" ? "BACHECA DELLA BASE" : "BACHECA"}</h2>
            </div>
            <nav class="${cls}-tabs shared-noticeboard-tabs" aria-label="Sezioni bacheca">
                <button class="${cls}-tab shared-noticeboard-tab active" type="button" data-noticeboard-tab="novita">NOVITÀ</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="upgrade">PROSSIMI UPGRADE</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="avvisi">BUG & SUGGERIMENTI</button>
            </nav>
            <div class="${cls}-content shared-noticeboard-content">
                <h3 data-noticeboard-title></h3>
                <ul class="${cls}-content-list public-noticeboard-list shared-noticeboard-list" data-noticeboard-list></ul>
            </div>
            <div class="shared-noticeboard-feedback-actions">
                <button type="button" class="button secondary shared-noticeboard-feedback-button" data-feedback-open>
                    SEGNALA BUG / INVIA SUGGERIMENTO
                </button>
            </div>`;
    }

    function render(host, tab) {
        const items = content[tab] || [];
        const title = host.querySelector("[data-noticeboard-title]");
        const list = host.querySelector("[data-noticeboard-list]");
        if (title) title.textContent = titles[tab] || "BACHECA";
        if (list) {
            list.innerHTML = "";
            items.forEach(text => {
                const li = document.createElement("li"); li.textContent = text; list.appendChild(li);
            });
        }
        host.querySelectorAll("[data-noticeboard-tab]").forEach(button => button.classList.toggle("active", button.dataset.noticeboardTab === tab));
    }

    async function init() {
        ensureFeedbackModal();
        await loadRemoteContent();
        document.querySelectorAll(".shared-noticeboard-host").forEach(host => {
            const mode = host.dataset.noticeboardMode || "public";
            host.innerHTML = markup(mode);
            host.querySelectorAll("[data-noticeboard-tab]").forEach(button => button.addEventListener("click", () => render(host, button.dataset.noticeboardTab)));
            render(host, "novita");
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
