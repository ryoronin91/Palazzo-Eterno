// ============================================================
// PALAZZO ETERNO - BUG & SUGGERIMENTI
// ============================================================

(() => {

    const openButton =
        document.getElementById(
            "feedback-open-button"
        );

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


    async function getCharacterName() {

        const {
            data: { session },
            error: sessionError
        } =
            await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!session?.user) {
            throw new Error(
                "Sessione non valida."
            );
        }

        const {
            data,
            error
        } =
            await supabaseClient
                .from("characters")
                .select("nome")
                .eq(
                    "user_id",
                    session.user.id
                )
                .maybeSingle();

        if (error) {
            throw error;
        }

        return (
            data?.nome ||
            "Giocatore"
        );
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

            const characterName =
                await getCharacterName();

            const {
                data,
                error
            } =
                await supabaseClient.functions.invoke(
                    "todoist-feedback",
                    {
                        body: {
                            message,
                            character_name:
                                characterName,
                            page:
                                (window.location.pathname.split("/").pop() || "pagina")
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


    // Supporta sia il pulsante statico di scheda.html sia i pulsanti
    // creati dinamicamente dalla bacheca condivisa.
    document.addEventListener(
        "click",
        (event) => {
            const trigger = event.target?.closest?.(
                "#feedback-open-button, [data-feedback-open]"
            );

            if (!trigger) {
                return;
            }

            openModal();
        }
    );

    closeButton?.addEventListener(
        "click",
        closeModal
    );

    modal.addEventListener(
        "click",
        (event) => {
            if (
                event.target?.hasAttribute?.(
                    "data-feedback-close"
                )
            ) {
                closeModal();
            }
        }
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
