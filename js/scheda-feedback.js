// ============================================================
// PALAZZO ETERNO - BUG & SUGGERIMENTI
// Versione compatibile con scheda/base/index/login
// ============================================================

(() => {

    const modal =
        document.getElementById(
            "feedback-modal"
        );

    const closeButton =
        document.getElementById(
            "feedback-close-button"
        );

    const textarea =
        document.getElementById(
            "feedback-text"
        );

    const sendButton =
        document.getElementById(
            "feedback-send-button"
        );

    const statusElement =
        document.getElementById(
            "feedback-status"
        );


    if (
        !modal ||
        !textarea ||
        !sendButton
    ) {
        return;
    }


    function setStatus(
        message = "",
        type = ""
    ) {

        if (!statusElement) {
            return;
        }

        statusElement.textContent =
            message;

        statusElement.classList.remove(
            "is-error",
            "is-success"
        );

        if (type) {
            statusElement.classList.add(
                `is-${type}`
            );
        }
    }


    function openModal() {

        modal.hidden = false;

        document.body.classList.add(
            "feedback-modal-open"
        );

        setStatus();

        window.setTimeout(() => {
            textarea.focus();
        }, 0);
    }


    function closeModal() {

        if (sendButton.disabled) {
            return;
        }

        modal.hidden = true;

        document.body.classList.remove(
            "feedback-modal-open"
        );

        setStatus();
    }


    async function getFeedbackAuthor() {

        try {

            const {
                data: { session },
                error: sessionError
            } = await supabaseClient.auth.getSession();

            if (sessionError) {
                console.warn(
                    "Impossibile leggere la sessione feedback:",
                    sessionError
                );

                return {
                    characterName: "Visitatore",
                    authenticated: false
                };
            }

            if (!session?.user) {
                return {
                    characterName: "Visitatore",
                    authenticated: false
                };
            }

            const {
                data,
                error
            } = await supabaseClient
                .from("characters")
                .select("nome")
                .eq(
                    "user_id",
                    session.user.id
                )
                .maybeSingle();

            if (error) {
                console.warn(
                    "Impossibile leggere il nome del personaggio per il feedback:",
                    error
                );

                return {
                    characterName: "Utente autenticato",
                    authenticated: true
                };
            }

            return {
                characterName:
                    data?.nome ||
                    "Utente autenticato",
                authenticated: true
            };

        } catch (error) {

            console.warn(
                "Errore durante l'identificazione dell'autore del feedback:",
                error
            );

            return {
                characterName: "Visitatore",
                authenticated: false
            };
        }
    }


    function getCurrentPage() {

        const pathname =
            window.location.pathname ||
            "pagina sconosciuta";

        return pathname;
    }


    async function sendFeedback() {

        const message =
            textarea.value.trim();

        if (!message) {
            setStatus(
                "Scrivi prima un bug o un suggerimento.",
                "error"
            );
            textarea.focus();
            return;
        }

        sendButton.disabled = true;
        sendButton.textContent =
            "INVIO...";

        setStatus(
            "Invio in corso..."
        );

        try {

            const author =
                await getFeedbackAuthor();

            const {
                data,
                error
            } = await supabaseClient.functions.invoke(
                "todoist-feedback",
                {
                    body: {
                        message,
                        character_name:
                            author.characterName,
                        page:
                            getCurrentPage(),
                        authenticated:
                            author.authenticated
                    }
                }
            );

            if (error) {
                throw error;
            }

            if (!data?.success) {
                throw new Error(
                    data?.error ||
                    "Invio non riuscito."
                );
            }

            textarea.value = "";

            setStatus(
                "Segnalazione inviata. Grazie!",
                "success"
            );

            window.setTimeout(() => {
                if (!sendButton.disabled) {
                    closeModal();
                }
            }, 1200);

        } catch (error) {

            console.error(
                "Errore invio feedback:",
                error
            );

            setStatus(
                error?.message ||
                "Errore durante l'invio.",
                "error"
            );

        } finally {

            sendButton.disabled = false;
            sendButton.textContent =
                "INVIA";
        }
    }


    document.addEventListener(
        "click",
        (event) => {

            const openTrigger =
                event.target.closest(
                    "#feedback-open-button, [data-feedback-open]"
                );

            if (openTrigger) {
                event.preventDefault();
                openModal();
                return;
            }

            if (
                event.target?.hasAttribute?.(
                    "data-feedback-close"
                )
            ) {
                closeModal();
            }
        }
    );


    closeButton?.addEventListener(
        "click",
        closeModal
    );


    sendButton.addEventListener(
        "click",
        sendFeedback
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                !modal.hidden
            ) {
                closeModal();
            }
        }
    );

})();
