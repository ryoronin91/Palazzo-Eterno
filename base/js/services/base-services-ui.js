// ============================================================
// PALAZZO ETERNO
// BASE SERVICES - UI
// ============================================================

(() => {
    "use strict";

    let overlay = null;
    let countdownTimer = null;
    let refreshCallback = null;
    let currentPayload = null;
    let currentConfig = null;


    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function formatDuration(milliseconds) {
        const totalSeconds = Math.max(
            0,
            Math.ceil(milliseconds / 1000)
        );

        const hours =
            Math.floor(totalSeconds / 3600);

        const minutes =
            Math.floor(
                (totalSeconds % 3600) / 60
            );

        const seconds =
            totalSeconds % 60;

        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0")
        );
    }


    function getServerOffset(payload) {
        if (!payload) {
            return 0;
        }

        if (
            Number.isFinite(
                payload._serverOffsetMs
            )
        ) {
            return payload._serverOffsetMs;
        }

        const serverNow =
            Date.parse(
                payload.server_now
            );

        if (
            !Number.isFinite(
                serverNow
            )
        ) {
            payload._serverOffsetMs = 0;
            return 0;
        }

        payload._serverOffsetMs =
            serverNow - Date.now();

        return payload._serverOffsetMs;
    }


    function getEffectiveNow(payload) {
        return (
            Date.now() +
            getServerOffset(payload)
        );
    }


    function getRemainingMs(
        payload,
        targetDate
    ) {
        const target =
            Date.parse(targetDate);

        if (
            !Number.isFinite(target)
        ) {
            return 0;
        }

        return Math.max(
            0,
            target -
            getEffectiveNow(payload)
        );
    }


    function getGoldRequirement(payload) {
        return (
            payload
                ?.requirements
                ?.find(
                    item =>
                        item.item_id ===
                        "moneta_oro"
                ) ||
            null
        );
    }


    function getMaintenanceInfo(payload) {
        const service =
            payload?.service || {};

        const goldRequirement =
            getGoldRequirement(payload);

        const totalGold =
            Number(
                goldRequirement
                    ?.required_quantity || 0
            );

        const totalSeconds =
            Number(
                service
                    .maintenance_seconds || 0
            );

        const remainingMs =
            getRemainingMs(
                payload,
                service.maintenance_until
            );

        const remainingSeconds =
            remainingMs / 1000;

        let equivalentGold = 0;

        if (
            totalGold > 0 &&
            totalSeconds > 0
        ) {
            equivalentGold =
                (
                    remainingSeconds /
                    totalSeconds
                ) *
                totalGold;
        }

        return {
            remainingMs,

            equivalentGold:
                Math.max(
                    0,
                    equivalentGold
                )
        };
    }


    function createShell() {
        if (overlay) {
            return;
        }

        overlay =
            document.createElement(
                "div"
            );

        overlay.className =
            "base-service-overlay";

        overlay.innerHTML = `
            <section
                class="base-service-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="base-service-title"
            >

                <button
                    type="button"
                    class="base-service-close"
                    aria-label="Chiudi"
                >
                    ×
                </button>

                <div
                    class="base-service-content"
                ></div>

            </section>
        `;

        overlay.addEventListener(
            "click",
            event => {
                if (
                    event.target ===
                    overlay
                ) {
                    close();
                }
            }
        );

        overlay
            .querySelector(
                ".base-service-close"
            )
            .addEventListener(
                "click",
                close
            );

        document.body.appendChild(
            overlay
        );
    }


    function renderRequirement(
        requirement
    ) {
        const required =
            Number(
                requirement
                    .required_quantity || 0
            );

        const contributed =
            Number(
                requirement
                    .contributed_quantity || 0
            );

        const inventoryQuantity =
            Number(
                requirement
                    .inventory_quantity || 0
            );

        const remaining =
            Math.max(
                0,
                required -
                contributed
            );

        const percent =
            required > 0
                ? Math.min(
                    100,
                    (
                        contributed /
                        required
                    ) *
                    100
                )
                : 0;

        const complete =
            remaining <= 0;

        const itemName =
            requirement.item_name ||
            requirement.item_id;

        const itemId =
            escapeHtml(
                requirement.item_id
            );

        return `
            <div
                class="base-service-requirement ${
                    complete
                        ? "is-complete"
                        : ""
                }"
            >

                <div
                    class="base-service-requirement-head"
                >
                    <strong>
                        ${escapeHtml(itemName)}
                    </strong>

                    <span>
                        ${contributed} / ${required}
                        ${complete ? " ✓" : ""}
                    </span>
                </div>


                <div
                    class="base-service-progress"
                >
                    <span
                        style="width:${percent}%"
                    ></span>
                </div>


                ${
                    complete
                        ? ""
                        : `
                    <input
                        class="base-service-quantity"
                        type="number"
                        min="1"
                        max="${remaining}"
                        value="1"
                        inputmode="numeric"
                        data-item-id="${itemId}"
                    >

                    <button
                        type="button"
                        class="base-service-contribute"
                        data-item-id="${itemId}"
                    >
                        CONTRIBUISCI
                    </button>
                `
                }


                <div
                    class="base-service-inventory-count"
                >
                    Zaino:
                    <strong>
                        ${inventoryQuantity}
                    </strong>
                </div>

            </div>
        `;
    }


    function renderUnbuilt(
        config,
        payload
    ) {
        const requirements =
            Array.isArray(
                payload?.requirements
            )
                ? payload.requirements
                : [];

        return `
            <div
                class="base-service-status base-service-status-unbuilt"
            >
                DA COSTRUIRE
            </div>

            <p
                class="base-service-description"
            >
                ${escapeHtml(
                    config?.description ||
                    "Questo servizio deve ancora essere costruito."
                )}
            </p>

            <h3>
                Risorse necessarie
            </h3>

            <div
                class="base-service-requirements"
            >
                ${
                    requirements
                        .map(
                            renderRequirement
                        )
                        .join("")
                }
            </div>

            <p
                class="base-service-note"
            >
                ${escapeHtml(
                    config?.construction_note_1 ||
                    "Tutti i giocatori possono contribuire alla costruzione."
                )}
            </p>

            <p
                class="base-service-note"
            >
                ${escapeHtml(
                    config?.construction_note_2 ||
                    "La costruzione richiederà il tempo previsto dal servizio."
                )}
            </p>
        `;
    }


    function renderBuilding(
        config,
        payload
    ) {
        const remaining =
            getRemainingMs(
                payload,
                payload
                    ?.service
                    ?.construction_ready_at
            );

        return `
            <div
                class="base-service-status base-service-status-building"
            >
                IN COSTRUZIONE
            </div>

            <div
                class="base-service-countdown-block"
            >
                <span>
                    Tempo restante
                </span>

                <strong
                    class="base-service-live-countdown"
                >
                    ${formatDuration(
                        remaining
                    )}
                </strong>
            </div>

            <p
                class="base-service-note"
            >
                ${escapeHtml(
                    config?.building_note ||
                    "Al termine della costruzione il servizio diventerà operativo e inizierà a consumare la propria riserva di monete."
                )}
            </p>
        `;
    }


    function renderActive(
        payload
    ) {
        const info =
            getMaintenanceInfo(
                payload
            );

        return `
            <div
                class="base-service-status base-service-status-active"
            >
                ATTIVO
            </div>

            <div
                class="base-service-countdown-block"
            >
                <span>
                    Autonomia restante
                </span>

                <strong
                    class="base-service-live-countdown"
                >
                    ${formatDuration(
                        info.remainingMs
                    )}
                </strong>
            </div>

            <div
                class="base-service-reserve"
            >
                Riserva equivalente:

                <strong
                    class="base-service-live-reserve"
                >
                    ${Math.ceil(
                        info.equivalentGold
                    )}
                </strong>

                monete
            </div>

            <div
                class="base-service-maintenance-box"
            >
                <label>
                    Aggiungi monete alla riserva
                </label>

                <input
                    class="base-service-quantity"
                    type="number"
                    min="1"
                    value="1"
                    inputmode="numeric"
                    data-item-id="moneta_oro"
                >

                <button
                    type="button"
                    class="base-service-contribute"
                    data-item-id="moneta_oro"
                >
                    VERSA MONETE
                </button>
            </div>

            <p
                class="base-service-warning"
            >
                Se la riserva arriva a zero
                il servizio viene perso e dovrà
                essere ricostruito da zero.
            </p>
        `;
    }


    function showInlineMessage(
        message,
        isError = false
    ) {
        if (!overlay) {
            return;
        }

        let element =
            overlay.querySelector(
                ".base-service-feedback"
            );

        if (!element) {
            element =
                document.createElement(
                    "div"
                );

            element.className =
                "base-service-feedback";

            overlay
                .querySelector(
                    ".base-service-modal"
                )
                .appendChild(
                    element
                );
        }

        element.textContent =
            message || "";

        element.classList.toggle(
            "is-error",
            Boolean(isError)
        );

        element.classList.toggle(
            "is-visible",
            Boolean(message)
        );
    }


    function bindContributionButtons() {
        if (!overlay) {
            return;
        }

        overlay
            .querySelectorAll(
                ".base-service-contribute"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            const itemId =
                                button.dataset
                                    .itemId;

                            const inputs =
                                overlay
                                    .querySelectorAll(
                                        ".base-service-quantity"
                                    );

                            let input = null;

                            inputs.forEach(
                                candidate => {
                                    if (
                                        candidate
                                            .dataset
                                            .itemId ===
                                        itemId
                                    ) {
                                        input =
                                            candidate;
                                    }
                                }
                            );

                            const quantity =
                                Number(
                                    input?.value
                                );

                            if (
                                !Number.isFinite(
                                    quantity
                                ) ||
                                quantity <= 0
                            ) {
                                showInlineMessage(
                                    "Inserisci una quantità valida.",
                                    true
                                );

                                return;
                            }

                            button.disabled =
                                true;

                            showInlineMessage(
                                "Contributo in corso..."
                            );

                            try {
                                if (
                                    typeof currentConfig
                                        ?.onContribute !==
                                    "function"
                                ) {
                                    throw new Error(
                                        "Gestore contributi non disponibile."
                                    );
                                }

                                const nextPayload =
                                    await currentConfig
                                        .onContribute(
                                            itemId,
                                            Math.floor(
                                                quantity
                                            )
                                        );

                                if (
                                    nextPayload
                                ) {
                                    currentPayload =
                                        nextPayload;
                                }

                                renderCurrent();

                                showInlineMessage(
                                    "Contributo registrato."
                                );

                            } catch (error) {

                                console.error(
                                    "[BASE SERVICES UI] Contributo:",
                                    error
                                );

                                showInlineMessage(
                                    error?.message ||
                                    "Impossibile registrare il contributo.",
                                    true
                                );

                                button.disabled =
                                    false;
                            }
                        }
                    );
                }
            );
    }


    function renderCurrent() {
        if (
            !overlay ||
            !currentPayload ||
            !currentConfig
        ) {
            return;
        }

        const content =
            overlay.querySelector(
                ".base-service-content"
            );

        const service =
            currentPayload
                .service || {};

        const status =
            service.status ||
            "unbuilt";

        let body = "";

        if (
            status ===
            "building"
        ) {
            body =
                renderBuilding(
                    currentConfig,
                    currentPayload
                );

        } else if (
            status ===
            "active"
        ) {
            body =
                renderActive(
                    currentPayload
                );

        } else {
            body =
                renderUnbuilt(
                    currentConfig,
                    currentPayload
                );
        }

        content.innerHTML = `
            <header
                class="base-service-header"
            >
                <div>

                    <span
                        class="base-service-eyebrow"
                    >
                        SERVIZIO DEL LIVELLO BASE
                    </span>

                    <h2
                        id="base-service-title"
                    >
                        ${escapeHtml(
                            currentConfig.name ||
                            service.display_name ||
                            currentConfig.id
                        )}
                    </h2>

                </div>
            </header>

            ${body}
        `;

        bindContributionButtons();

        restartCountdown();
    }


    async function countdownTick() {
        if (
            !overlay ||
            !currentPayload
        ) {
            return;
        }

        const service =
            currentPayload
                .service || {};

        const countdown =
            overlay.querySelector(
                ".base-service-live-countdown"
            );


        if (
            service.status ===
            "building"
        ) {
            const remaining =
                getRemainingMs(
                    currentPayload,
                    service
                        .construction_ready_at
                );

            if (
                countdown
            ) {
                countdown.textContent =
                    formatDuration(
                        remaining
                    );
            }

            if (
                remaining <= 0 &&
                typeof refreshCallback ===
                    "function"
            ) {
                await refreshCallback();
            }
        }


        if (
            service.status ===
            "active"
        ) {
            const info =
                getMaintenanceInfo(
                    currentPayload
                );

            if (
                countdown
            ) {
                countdown.textContent =
                    formatDuration(
                        info.remainingMs
                    );
            }

            const reserve =
                overlay.querySelector(
                    ".base-service-live-reserve"
                );

            if (
                reserve
            ) {
                reserve.textContent =
                    String(
                        Math.ceil(
                            info.equivalentGold
                        )
                    );
            }

            if (
                info.remainingMs <= 0 &&
                typeof refreshCallback ===
                    "function"
            ) {
                await refreshCallback();
            }
        }
    }


    function restartCountdown() {
        if (
            countdownTimer
        ) {
            clearInterval(
                countdownTimer
            );
        }

        countdownTimer =
            setInterval(
                () => {
                    countdownTick()
                        .catch(
                            error => {
                                console.warn(
                                    "[BASE SERVICES UI] Countdown:",
                                    error
                                );
                            }
                        );
                },
                1000
            );
    }


    function open(
        config,
        payload,
        options = {}
    ) {
        createShell();

        currentConfig = {
            ...config,

            onContribute:
                options.onContribute
        };

        currentPayload =
            payload;

        refreshCallback =
            options.onRefresh ||
            null;

        overlay.classList.add(
            "is-open"
        );

        document.body.classList.add(
            "base-service-modal-open"
        );

        renderCurrent();
    }


    function update(payload) {
        if (
            !payload
        ) {
            return;
        }

        currentPayload =
            payload;

        if (
            overlay
                ?.classList
                .contains(
                    "is-open"
                )
        ) {
            renderCurrent();
        }
    }


    function close() {
        if (
            !overlay
        ) {
            return;
        }

        overlay.classList.remove(
            "is-open"
        );

        document.body.classList.remove(
            "base-service-modal-open"
        );

        if (
            countdownTimer
        ) {
            clearInterval(
                countdownTimer
            );

            countdownTimer =
                null;
        }
    }


    function isOpen() {
        return Boolean(
            overlay
                ?.classList
                .contains(
                    "is-open"
                )
        );
    }


    window.BaseServicesUi = {
        open,
        update,
        close,
        isOpen,
        formatDuration
    };

})();