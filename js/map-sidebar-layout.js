// Palazzo Eterno — allinea la colonna Chat / Online / Top 5 alla mappa.
// Modulo isolato: non modifica gli script di gioco, la chat o la Risonanza.
(() => {
    "use strict";

    const mapFrame = document.querySelector(
        ".dungeon-map-column .dungeon-map-frame"
    );
    const sidebar = document.querySelector(
        ".dungeon-layout > .dungeon-chat-column"
    );

    if (!mapFrame || !sidebar) return;

    function syncPanelsHeight() {
        const mapHeight = mapFrame.getBoundingClientRect().height;
        if (mapHeight > 0 && Number.isFinite(mapHeight)) {
            sidebar.style.setProperty(
                "--palazzo-map-panel-height",
                `${Math.round(mapHeight * 100) / 100}px`
            );
        }
    }

    syncPanelsHeight();
    window.addEventListener("resize", syncPanelsHeight, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
        const mapObserver = new ResizeObserver(syncPanelsHeight);
        mapObserver.observe(mapFrame);
    }
})();
