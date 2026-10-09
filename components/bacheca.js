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
        avvisi: [
            "Segnalaci un bug o inoltra suggerimenti"
        ]
    };

    const titles = {
        novita: "COSA C'È DI NUOVO",
        upgrade: "PROSSIMI UPGRADE",
        avvisi: "BUG & SUGGERIMENTI"
    };

    let content = {
        novita: [...fallback.novita],
        upgrade: [...fallback.upgrade],
        avvisi: [...fallback.avvisi]
    };

    async function loadRemoteContent() {
        if (typeof supabaseClient === "undefined") return;

        try {
            const { data, error } = await supabaseClient
                .from("noticeboard_entries")
                .select("section, content, sort_order")
                .eq("active", true)
                .order("sort_order", { ascending: true });

            if (error) throw error;

            const next = {
                novita: [],
                upgrade: [],
                avvisi: []
            };

            (data || []).forEach(row => {
                if (next[row.section]) {
                    next[row.section].push(
                        String(row.content || "")
                    );
                }
            });

            if (next.novita.length) content.novita = next.novita;
            if (next.upgrade.length) content.upgrade = next.upgrade;
            if (next.avvisi.length) content.avvisi = next.avvisi;

        } catch (error) {
            console.warn(
                "Bacheca: uso contenuti locali di fallback.",
                error
            );
        }
    }

    function markup(mode) {
        const cls =
            mode === "base"
                ? "base-noticeboard"
                : "public-noticeboard";

        return `
            <div class="${cls}-header shared-noticeboard-header">
                <div class="${cls}-kicker shared-noticeboard-kicker">PALAZZO ETERNO</div>
                <h2 class="${cls}-title shared-noticeboard-title">${
                    mode === "base"
                        ? "BACHECA DELLA BASE"
                        : "BACHECA"
                }</h2>
            </div>

            <nav class="${cls}-tabs shared-noticeboard-tabs" aria-label="Sezioni bacheca">
                <button class="${cls}-tab shared-noticeboard-tab active" type="button" data-noticeboard-tab="novita">NOVITÀ</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="upgrade">PROSSIMI UPGRADE</button>
                <button class="${cls}-tab shared-noticeboard-tab" type="button" data-noticeboard-tab="avvisi">BUG &amp; SUGGERIMENTI</button>
            </nav>

            <div class="${cls}-content shared-noticeboard-content">
                <h3 data-noticeboard-title></h3>
                <ul class="${cls}-content-list public-noticeboard-list shared-noticeboard-list" data-noticeboard-list></ul>

                <div class="shared-noticeboard-feedback-action" data-noticeboard-feedback-action hidden>
                    <button
                        type="button"
                        class="button secondary shared-noticeboard-feedback-button"
                        data-noticeboard-feedback-open
                    >
                        SEGNALA BUG / INVIA SUGGERIMENTO
                    </button>
                </div>
            </div>
        `;
    }

    function render(host, tab) {
        const items = content[tab] || [];
        const title = host.querySelector("[data-noticeboard-title]");
        const list = host.querySelector("[data-noticeboard-list]");
        const feedbackAction = host.querySelector(
            "[data-noticeboard-feedback-action]"
        );

        if (title) {
            title.textContent = titles[tab] || "BACHECA";
        }

        if (list) {
            list.replaceChildren();

            items.forEach(text => {
                const li = document.createElement("li");
                li.textContent = text;
                list.appendChild(li);
            });
        }

        host.querySelectorAll("[data-noticeboard-tab]")
            .forEach(button => {
                button.classList.toggle(
                    "active",
                    button.dataset.noticeboardTab === tab
                );
            });

        if (feedbackAction) {
            feedbackAction.hidden = tab !== "avvisi";
        }
    }

    function ensureFeedbackModal() {
        let modal = document.getElementById("feedback-modal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "feedback-modal";
        modal.className = "feedback-modal";
        modal.hidden = true;

        modal.innerHTML = `
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
        `;

        document.body.appendChild(modal);
        return modal;
    }

    function setupFeedback() {
        if (window.__palazzoNoticeboardFeedbackBound) return;
        window.__palazzoNoticeboardFeedbackBound = true;

        const modal = ensureFeedbackModal();
        const closeButton = modal.querySelector("#feedback-close-button");
        const textarea = modal.querySelector("#feedback-text");
        const sendButton = modal.querySelector("#feedback-send-button");
        const statusElement = modal.querySelector("#feedback-status");

        function setStatus(message = "", type = "") {
            if (!statusElement) return;

            statusElement.textContent = message;
            statusElement.classList.remove("is-error", "is-success");

            if (type) {
                statusElement.classList.add(`is-${type}`);
            }
        }

        function openModal() {
            modal.hidden = false;
            document.body.classList.add("feedback-modal-open");
            setStatus();

            window.setTimeout(() => {
                textarea?.focus();
            }, 0);
        }

        function closeModal() {
            if (sendButton?.disabled) return;

            modal.hidden = true;
            document.body.classList.remove("feedback-modal-open");
            setStatus();
        }

        async function getFeedbackAuthor() {
            try {
                if (typeof supabaseClient === "undefined") {
                    return {
                        characterName: "Visitatore",
                        authenticated: false
                    };
                }

                const {
                    data: { session },
                    error: sessionError
                } = await supabaseClient.auth.getSession();

                if (sessionError || !session?.user) {
                    return {
                        characterName: "Visitatore",
                        authenticated: false
                    };
                }

                const { data, error } = await supabaseClient
                    .from("characters")
                    .select("nome")
                    .eq("user_id", session.user.id)
                    .maybeSingle();

                if (error) {
                    return {
                        characterName: "Utente autenticato",
                        authenticated: true
                    };
                }

                return {
                    characterName:
                        data?.nome || "Utente autenticato",
                    authenticated: true
                };

            } catch (error) {
                console.warn(
                    "Errore identificazione autore feedback:",
                    error
                );

                return {
                    characterName: "Visitatore",
                    authenticated: false
                };
            }
        }

        async function sendFeedback() {
            const message = textarea?.value.trim() || "";

            if (!message) {
                setStatus(
                    "Scrivi prima un bug o un suggerimento.",
                    "error"
                );
                textarea?.focus();
                return;
            }

            if (typeof supabaseClient === "undefined") {
                setStatus(
                    "Servizio di invio non disponibile.",
                    "error"
                );
                return;
            }

            sendButton.disabled = true;
            sendButton.textContent = "INVIO...";
            setStatus("Invio in corso...");

            try {
                const author = await getFeedbackAuthor();

                const { data, error } =
                    await supabaseClient.functions.invoke(
                        "todoist-feedback",
                        {
                            body: {
                                message,
                                character_name: author.characterName,
                                page: window.location.pathname || "pagina sconosciuta",
                                authenticated: author.authenticated
                            }
                        }
                    );

                if (error) throw error;

                if (!data?.success) {
                    throw new Error(
                        data?.error || "Invio non riuscito."
                    );
                }

                textarea.value = "";
                setStatus(
                    "Segnalazione inviata. Grazie!",
                    "success"
                );

            } catch (error) {
                console.error("Errore invio feedback:", error);
                setStatus(
                    error?.message || "Errore durante l'invio.",
                    "error"
                );

            } finally {
                sendButton.disabled = false;
                sendButton.textContent = "INVIA";
            }
        }

        document.addEventListener("click", event => {
            const openTrigger = event.target.closest(
                "[data-noticeboard-feedback-open], #feedback-open-button, [data-feedback-open]"
            );

            if (openTrigger) {
                event.preventDefault();
                openModal();
                return;
            }

            if (event.target?.hasAttribute?.("data-feedback-close")) {
                closeModal();
            }
        });

        closeButton?.addEventListener("click", closeModal);
        sendButton?.addEventListener("click", sendFeedback);

        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !modal.hidden) {
                closeModal();
            }
        });
    }

    async function init() {
        setupFeedback();
        await loadRemoteContent();

        document
            .querySelectorAll(".shared-noticeboard-host")
            .forEach(host => {
                const mode =
                    host.dataset.noticeboardMode || "public";

                host.innerHTML = markup(mode);

                host.querySelectorAll("[data-noticeboard-tab]")
                    .forEach(button => {
                        button.addEventListener("click", () => {
                            render(
                                host,
                                button.dataset.noticeboardTab
                            );
                        });
                    });

                render(host, "novita");
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
