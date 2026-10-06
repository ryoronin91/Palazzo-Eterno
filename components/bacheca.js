(() => {
    "use strict";

    const CONTENT = {
        novita: {
            title: "COSA C'È DI NUOVO",
            items: [
                "Il Livello Base è ora accessibile dal dungeon.",
                "Mano di Scimmia si è trasferito alla Base.",
                "Sono iniziati i lavori per i nuovi servizi della Base."
            ]
        },
        upgrade: {
            title: "PROSSIMI UPGRADE",
            items: [
                "Sistema di costruzione e potenziamento dei servizi.",
                "Scambio tra giocatori."
            ]
        },
        feedback: {
            title: "BUG & SUGGERIMENTI",
            description: "Hai trovato un problema o hai un'idea per migliorare Palazzo Eterno? Segnalalo direttamente da qui."
        }
    };

    const currentScriptUrl = document.currentScript?.src || "";
    const projectRoot = currentScriptUrl
        ? new URL("../", currentScriptUrl)
        : new URL("./", window.location.href);

    const escapeHtml = value =>
        String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    function ensureFeedbackAssets() {
        if (!document.querySelector('link[data-shared-feedback-css]')) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = new URL("css/scheda-feedback.css?v=1", projectRoot).href;
            link.dataset.sharedFeedbackCss = "1";
            document.head.appendChild(link);
        }

        if (!document.getElementById("feedback-modal")) {
            document.body.insertAdjacentHTML("beforeend", `
                <div id="feedback-modal" class="feedback-modal" hidden>
                    <div class="feedback-modal-backdrop" data-feedback-close></div>

                    <section
                        class="feedback-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="feedback-title"
                    >
                        <button
                            id="feedback-close-button"
                            class="feedback-close-button"
                            type="button"
                            aria-label="Chiudi"
                            title="Chiudi"
                        >×</button>

                        <h2 id="feedback-title" class="feedback-title">
                            BUG &amp; SUGGERIMENTI
                        </h2>

                        <p class="feedback-description">
                            Hai trovato un problema o hai un'idea per migliorare Palazzo Eterno?
                            Scrivila qui: verrà aggiunta direttamente alla lista delle cose da fare.
                        </p>

                        <textarea
                            id="feedback-text"
                            class="feedback-text"
                            maxlength="2000"
                            placeholder="Descrivi il bug o il suggerimento..."
                        ></textarea>

                        <div class="feedback-footer">
                            <span
                                id="feedback-status"
                                class="feedback-status"
                                aria-live="polite"
                            ></span>

                            <button
                                id="feedback-send-button"
                                class="button"
                                type="button"
                            >INVIA</button>
                        </div>
                    </section>
                </div>
            `);
        }

        if (!document.querySelector('script[data-shared-feedback-js]')) {
            const script = document.createElement("script");
            script.src = new URL("js/scheda-feedback.js?v=1", projectRoot).href;
            script.dataset.sharedFeedbackJs = "1";
            document.body.appendChild(script);
        }
    }

    function markup(mode) {
        const isBase = mode === "base";
        return `
            <section class="shared-noticeboard" data-mode="${isBase ? "base" : "public"}" aria-label="Bacheca del Palazzo Eterno">
                <div class="shared-noticeboard-header">
                    <div class="shared-noticeboard-kicker">PALAZZO ETERNO</div>
                    <h2 class="shared-noticeboard-title"${isBase ? ' id="base-noticeboard-title"' : ""}>${isBase ? "BACHECA DELLA BASE" : "BACHECA"}</h2>
                </div>

                <nav class="shared-noticeboard-tabs" aria-label="Sezioni bacheca">
                    <button class="shared-noticeboard-tab active" type="button" data-noticeboard-tab="novita">NOVITÀ</button>
                    <button class="shared-noticeboard-tab" type="button" data-noticeboard-tab="upgrade">PROSSIMI UPGRADE</button>
                    <button class="shared-noticeboard-tab" type="button" data-noticeboard-tab="feedback">BUG&amp;SUGGERIMENTI</button>
                </nav>

                <div class="shared-noticeboard-content">
                    <h3 data-noticeboard-title>COSA C'È DI NUOVO</h3>
                    <div data-noticeboard-body></div>
                </div>
            </section>`;
    }

    function initHost(host) {
        const mode = host.dataset.noticeboardMode === "base" ? "base" : "public";
        host.innerHTML = markup(mode);

        const title = host.querySelector("[data-noticeboard-title]");
        const body = host.querySelector("[data-noticeboard-body]");
        const tabs = [...host.querySelectorAll("[data-noticeboard-tab]")];

        const openFeedbackModal = () => {
            const modal = document.getElementById("feedback-modal");
            if (!modal) return;
            modal.hidden = false;
            document.body.classList.add("feedback-modal-open");
            setTimeout(() => document.getElementById("feedback-text")?.focus(), 0);
        };

        const render = tabId => {
            const section = CONTENT[tabId];
            if (!section) return;

            title.textContent = section.title;

            if (tabId === "feedback") {
                body.innerHTML = `
                    <div class="shared-noticeboard-feedback">
                        <p>${escapeHtml(section.description)}</p>
                        <button
                            class="button secondary shared-noticeboard-feedback-button"
                            type="button"
                            data-feedback-open
                        >BUG &amp; SUGGERIMENTI</button>
                    </div>
                `;

                body.querySelector("[data-feedback-open]")?.addEventListener("click", openFeedbackModal);
            } else {
                body.innerHTML = `
                    <ul class="shared-noticeboard-list">
                        ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
                    </ul>
                `;
            }

            tabs.forEach(button => {
                button.classList.toggle("active", button.dataset.noticeboardTab === tabId);
            });
        };

        tabs.forEach(button => {
            button.addEventListener("click", () => render(button.dataset.noticeboardTab));
        });

        render("novita");
    }

    document.querySelectorAll(".shared-noticeboard-host").forEach(initHost);
    ensureFeedbackAssets();

    // Apertura/chiusura della modale gestita anche qui perché il pulsante
    // BUG & SUGGERIMENTI viene creato dinamicamente quando si apre la tab.
    document.addEventListener("click", event => {
        const modal = document.getElementById("feedback-modal");
        if (!modal) return;

        if (event.target.closest("#feedback-close-button, [data-feedback-close]")) {
            modal.hidden = true;
            document.body.classList.remove("feedback-modal-open");
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const modal = document.getElementById("feedback-modal");
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove("feedback-modal-open");
    });
})();
