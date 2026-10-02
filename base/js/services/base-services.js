// ============================================================
// PALAZZO ETERNO
// BASE SERVICES - MANAGER
//
// Coordina:
// - services.json
// - API Supabase
// - popup
// - aree sulla mappa
// - token NPC
// - stato grafico costruzione / attività
// ============================================================

(() => {
    "use strict";

    const CONFIG_URL =
        "services.json";

    const MAP_ID =
        "dungeon-map";

    const MAP_COLUMNS =
        27;

    const MAP_ROWS =
        36;

    const STATE_REFRESH_MS =
        30000;

    const RUNOGRAFO_SERVICE_ID =
        "runografo";

    const LOCANDA_SERVICE_ID =
        "locanda";

    const ADDESTRATORE_SERVICE_ID =
        "addestratore";

    let services = [];
    let initialized = false;
    let refreshTimer = null;
    let resizeBound = false;
    let activeAreaServiceId = null;
    let visualProgressTimer = null;

    const stateByService =
        new Map();

    const visualByService =
        new Map();


    function requireDependencies() {
        if (
            !window.BaseServicesApi
        ) {
            throw new Error(
                "base-services-api.js non caricato."
            );
        }

        if (
            !window.BaseServicesUi
        ) {
            throw new Error(
                "base-services-ui.js non caricato."
            );
        }
    }


    async function loadConfig() {
        const response =
            await fetch(
                CONFIG_URL,
                {
                    cache:
                        "no-store"
                }
            );

        if (
            !response.ok
        ) {
            throw new Error(
                "Impossibile caricare services.json."
            );
        }

        const data =
            await response.json();

        services =
            Array.isArray(
                data?.services
            )
                ? data.services
                : [];

        console.log(
            "[BASE SERVICES] Configurati:",
            services.map(
                service =>
                    service.id
            )
        );
    }


    function findService(
        serviceId
    ) {
        return (
            services.find(
                service =>
                    service.id ===
                    serviceId
            ) || null
        );
    }


    function findServiceAt(
        x,
        y
    ) {
        const px =
            Number(x);

        const py =
            Number(y);

        return (
            services.find(
                service => {

                    const area =
                        service.area;

                    if (
                        !area
                    ) {
                        return false;
                    }

                    return (
                        px >=
                            Number(
                                area.x
                            ) &&

                        px <
                            Number(
                                area.x
                            ) +
                            Number(
                                area.width
                            ) &&

                        py >=
                            Number(
                                area.y
                            ) &&

                        py <
                            Number(
                                area.y
                            ) +
                            Number(
                                area.height
                            )
                    );
                }
            ) || null
        );
    }


    async function fetchServiceState(
        serviceId
    ) {
        const payload =
            await window
                .BaseServicesApi
                .getServiceState(
                    serviceId
                );

        const itemIds =
            Array.isArray(
                payload
                    ?.requirements
            )
                ? payload
                    .requirements
                    .map(
                        requirement =>
                            requirement
                                .item_id
                    )
                : [];

        const inventory =
            await window
                .BaseServicesApi
                .getInventoryQuantities(
                    itemIds
                );

        payload.requirements =
            (
                payload
                    .requirements ||
                []
            ).map(
                requirement => ({
                    ...requirement,

                    inventory_quantity:
                        Number(
                            inventory[
                                requirement
                                    .item_id
                            ]
                        ) || 0
                })
            );

        stateByService.set(
            serviceId,
            payload
        );

        renderServiceVisual(
            serviceId
        );

        if (
            activeAreaServiceId ===
                serviceId &&
            window
                .BaseServicesUi
                .isOpen()
        ) {

            if (
                payload
                    ?.service
                    ?.status ===
                "active"
            ) {

                closeServicePopupIfOpen();

            } else {

                window
                    .BaseServicesUi
                    .update(
                        payload
                    );
            }
        }

        return payload;
    }


    async function refreshAllStates() {
        const results =
            await Promise.allSettled(
                services.map(
                    service =>
                        fetchServiceState(
                            service.id
                        )
                )
            );

        results.forEach(
            (
                result,
                index
            ) => {
                if (
                    result.status ===
                    "rejected"
                ) {
                    console.warn(
                        "[BASE SERVICES] Stato non aggiornato:",
                        services[index]
                            ?.id,
                        result.reason
                    );
                }
            }
        );
    }


    function getMapMetrics() {
        const map =
            document
                .getElementById(
                    MAP_ID
                );

        if (
            !map
        ) {
            return null;
        }

        const rect =
            map
                .getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return null;
        }

        return {
            map,

            cellWidth:
                rect.width /
                MAP_COLUMNS,

            cellHeight:
                rect.height /
                MAP_ROWS
        };
    }


    function ensureVisualElements(
        service
    ) {
        const metrics =
            getMapMetrics();

        if (
            !metrics
        ) {
            return null;
        }

        let visual =
            visualByService.get(
                service.id
            );

        if (
            !visual
        ) {
            const npc =
                document.createElement(
                    "img"
                );

            npc.className =
                "base-service-npc";

            npc.dataset.serviceId =
                service.id;

            npc.alt =
                service.npc?.alt ||
                service.name ||
                service.id;

            npc.draggable =
                false;

            const building =
                document.createElement(
                    "div"
                );

            building.className =
                "base-service-building-marker";

            building.dataset.serviceId =
                service.id;


            metrics.map.appendChild(
                building
            );

            metrics.map.appendChild(
                npc
            );

            visual = {
                npc,
                building
            };

            visualByService.set(
                service.id,
                visual
            );
        }

        return visual;
    }


    function positionVisual(
        service,
        visual
    ) {
        const metrics =
            getMapMetrics();

        if (
            !metrics
        ) {
            return;
        }

        const npc =
            service.npc;

        if (
            npc
        ) {
            visual.npc.style.left =
                `${
                    Number(
                        npc.x
                    ) *
                    metrics.cellWidth
                }px`;

            visual.npc.style.top =
                `${
                    Number(
                        npc.y
                    ) *
                    metrics.cellHeight
                }px`;

            visual.npc.style.width =
                `${
                    Number(
                        npc.width || 1
                    ) *
                    metrics.cellWidth
                }px`;

            visual.npc.style.height =
                `${
                    Number(
                        npc.height || 1
                    ) *
                    metrics.cellHeight
                }px`;

            visual.npc.style.zIndex =
                String(
                    npc.zIndex || 13
                );
        }

        const area =
            service.area;

        if (
            area
        ) {
            visual
                .building
                .style
                .left =
                    `${
                        Number(
                            area.x
                        ) *
                        metrics.cellWidth
                    }px`;

            visual
                .building
                .style
                .top =
                    `${
                        Number(
                            area.y
                        ) *
                        metrics.cellHeight
                    }px`;

            visual
                .building
                .style
                .width =
                    `${
                        Number(
                            area.width
                        ) *
                        metrics.cellWidth
                    }px`;

            visual
                .building
                .style
                .height =
                    `${
                        Number(
                            area.height
                        ) *
                        metrics.cellHeight
                    }px`;
        }
    }

    function getConstructionProgress(
    payload
) {
    const service =
        payload?.service;

    if (
        !service ||
        service.status !== "building"
    ) {
        return 0;
    }

    const startedAt =
        Date.parse(
            service.construction_started_at
        );

    const readyAt =
        Date.parse(
            service.construction_ready_at
        );

    if (
        !Number.isFinite(startedAt) ||
        !Number.isFinite(readyAt) ||
        readyAt <= startedAt
    ) {
        return 0;
    }

    const now =
        Date.now();

    const progress =
        (
            now - startedAt
        ) /
        (
            readyAt - startedAt
        );

    return Math.max(
        0,
        Math.min(
            1,
            progress
        )
    );
}

    function renderServiceVisual(
        serviceId
    ) {
        const service =
            findService(
                serviceId
            );

        const payload =
            stateByService.get(
                serviceId
            );

        if (
            !service ||
            !payload
        ) {
            return;
        }

        const visual =
            ensureVisualElements(
                service
            );

        if (
            !visual
        ) {
            return;
        }

        const status =
            payload
                .service
                ?.status ||
            "unbuilt";

        if (
            service.id ===
            RUNOGRAFO_SERVICE_ID
        ) {

            const carpet =
                document.querySelector(
                    '[data-decoration-id="tappeto_runografo"]'
                );

            if (carpet) {

                carpet.src =
                    status === "active"
                        ? "immagini/tappeto_blu.png"
                        : "immagini/tappetoX.png";
            }
        }


        if (
            service.id ===
            ADDESTRATORE_SERVICE_ID
        ) {

            const carpet =
                document.querySelector(
                    '[data-decoration-id="tappeto_addestratore"]'
                );

            if (carpet) {
                carpet.src =
                    status === "active"
                        ? "immagini/tappeto_rosso.png"
                        : "immagini/tappetoY.png";
            }
        }


        if (
            service.id ===
            LOCANDA_SERVICE_ID
        ) {

            const locanda =
                document.querySelector(
                    '[data-decoration-id="locanda"]'
                );

            if (locanda) {

                locanda.src =
                    status === "active"
                        ? "immagini/locanda.png"
                        : "immagini/locandaX.png";
            }
        }

        if (
            service
                .npc
                ?.image
        ) {
            const expectedSrc =
                new URL(
                    service
                        .npc
                        .image,
                    document.baseURI
                ).href;

            if (
                visual.npc.src !==
                expectedSrc
            ) {
                visual.npc.src =
                    service
                        .npc
                        .image;
            }
        }


        visual.npc.style.display =
            status ===
            "active"
                ? "block"
                : "none";

        visual.npc.style.pointerEvents =
            "none";

        visual.npc.style.cursor =
            "default";


        visual.building.className =
            "base-service-building-marker " +
            `is-${status}`;


        if (
            status ===
            "building"
        ) {

            const progress =
                getConstructionProgress(
                    payload
                );

            const degrees =
                Math.round(
                    progress * 360
                );

            const percentage =
                Math.round(
                    progress * 100
                );

            visual.building.innerHTML = `
                <div
                    class="base-service-construction-ring"
                    style="--construction-progress:${degrees}deg"
                    title="Costruzione ${percentage}%"
                >
                    <div
                        class="base-service-construction-ring-inner"
                    >
                        ⚒
                    </div>
                </div>
            `;

        } else {

            visual.building.innerHTML =
                "";
        }


        positionVisual(
            service,
            visual
        );
    }


    function positionAllVisuals() {
        services.forEach(
            service => {

                const visual =
                    visualByService.get(
                        service.id
                    );

                if (
                    visual
                ) {
                    positionVisual(
                        service,
                        visual
                    );
                }

            }
        );
    }


    function closeServicePopupIfOpen() {

        if (
            !window.BaseServicesUi ||
            !window.BaseServicesUi.isOpen?.()
        ) {
            return;
        }

        if (
            typeof window
                .BaseServicesUi
                .close ===
            "function"
        ) {

            window
                .BaseServicesUi
                .close();

            return;
        }

        /*
         * Fallback prudente:
         * se la UI non espone ancora close(), non apriamo
         * comunque nuovi popup quando il servizio è active.
         */
    }


    function isBaseServiceActive(
        serviceId
    ) {

        const payload =
            stateByService.get(
                serviceId
            );

        return (
            payload
                ?.service
                ?.status ===
            "active"
        );
    }


    async function contribute(
        serviceId,
        itemId,
        quantity
    ) {
        await window
            .BaseServicesApi
            .contribute(
                serviceId,
                itemId,
                quantity
            );

        return await fetchServiceState(
            serviceId
        );
    }


    async function openService(
        service
    ) {
        let payload =
            stateByService.get(
                service.id
            );

        try {
            payload =
                await fetchServiceState(
                    service.id
                );
        } catch (error) {
            console.error(
                "[BASE SERVICES] Apertura servizio:",
                error
            );

            if (
                typeof setMessage ===
                "function"
            ) {
                setMessage(
                    error?.message ||
                    "Impossibile caricare il servizio.",
                    true
                );
            }

            return;
        }


        if (
            payload
                ?.service
                ?.status ===
            "active"
        ) {

            closeServicePopupIfOpen();

            return;
        }


        window
            .BaseServicesUi
            .open(
                service,
                payload,
                {
                    onContribute:
                        (
                            itemId,
                            quantity
                        ) =>
                            contribute(
                                service.id,
                                itemId,
                                quantity
                            ),

                    onRefresh:
                        async () => {

                            const refreshed =
                                await fetchServiceState(
                                    service.id
                                );

                            window
                                .BaseServicesUi
                                .update(
                                    refreshed
                                );

                            return refreshed;
                        }
                }
            );
    }


    async function checkBaseServiceArea(
        x,
        y
    ) {
        if (
            !initialized
        ) {
            return;
        }

        const service =
            findServiceAt(
                x,
                y
            );

        if (
            !service
        ) {
            activeAreaServiceId =
                null;

            return;
        }

        if (
            activeAreaServiceId ===
            service.id
        ) {
            return;
        }

        activeAreaServiceId =
            service.id;

        let payload =
            stateByService.get(
                service.id
            );

        if (
            !payload
        ) {

            try {

                payload =
                    await fetchServiceState(
                        service.id
                    );

            } catch (error) {

                console.warn(
                    "[BASE SERVICES] Controllo area:",
                    error
                );

                return;
            }
        }

        if (
            payload
                ?.service
                ?.status ===
            "active"
        ) {

            closeServicePopupIfOpen();

            return;
        }

        await openService(
            service
        );
    }


    function handleRealtimeChange(
        change
    ) {
        const newRow =
            change
                ?.payload
                ?.new ||
            {};

        const oldRow =
            change
                ?.payload
                ?.old ||
            {};

        const serviceId =
            newRow.service_key ||
            oldRow.service_key;

        if (
            serviceId &&
            findService(
                serviceId
            )
        ) {
            fetchServiceState(
                serviceId
            ).catch(
                error => {
                    console.warn(
                        "[BASE SERVICES] Aggiornamento Realtime:",
                        error
                    );
                }
            );

            return;
        }

        refreshAllStates()
            .catch(
                error => {
                    console.warn(
                        "[BASE SERVICES] Refresh Realtime:",
                        error
                    );
                }
            );
    }

    function updateServiceVisualProgress() {
    services.forEach(
        service => {

            const payload =
                stateByService.get(
                    service.id
                );

            if (
                payload
                    ?.service
                    ?.status ===
                "building"
            ) {
                renderServiceVisual(
                    service.id
                );
            }

        }
    );
}

    async function initializeBaseServices() {
        if (
            initialized
        ) {
            return;
        }

        requireDependencies();

        await loadConfig();

        await refreshAllStates();

        await window
            .BaseServicesApi
            .subscribe(
                handleRealtimeChange
            );


        if (
            !resizeBound
        ) {
            window.addEventListener(
                "resize",
                positionAllVisuals
            );

            resizeBound =
                true;
        }


        refreshTimer =
            window.setInterval(
                () => {
                    refreshAllStates()
                        .catch(
                            error => {
                                console.warn(
                                    "[BASE SERVICES] Refresh periodico:",
                                    error
                                );
                            }
                        );
                },
                STATE_REFRESH_MS
            );

            visualProgressTimer =
    window.setInterval(
        updateServiceVisualProgress,
        1000
    );

        initialized =
            true;


        console.log(
            "[BASE SERVICES] Sistema inizializzato."
        );
    }


    function destroyBaseServices() {
        if (
            refreshTimer
        ) {
            clearInterval(
                refreshTimer
            );

            refreshTimer =
                null;
        }

        if (
    visualProgressTimer
) {
    clearInterval(
        visualProgressTimer
    );

    visualProgressTimer =
        null;
}

        window
            .BaseServicesApi
            ?.unsubscribe();

        initialized =
            false;
    }


    window.initializeBaseServices =
        initializeBaseServices;

    window.checkBaseServiceArea =
        checkBaseServiceArea;

    window.isBaseServiceActive =
        isBaseServiceActive;

    window.refreshBaseServices =
        refreshAllStates;

    window.destroyBaseServices =
        destroyBaseServices;

})();