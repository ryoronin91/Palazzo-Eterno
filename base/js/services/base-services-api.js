// PALAZZO ETERNO — Base Services API
// Correzione 2026-11-05: somma tutti gli stack dell'inventario.
// Destinazione GitHub: base/js/services/base-services-api.js
(() => {
    "use strict";
    const CHANNEL_NAME = "palazzo-eterno-base-services";
    let realtimeChannel = null;

    function getDb() {
        if (typeof db !== "undefined" && db) return db;
        if (typeof supabaseClient !== "undefined" && supabaseClient) return supabaseClient;
        throw new Error("Client Supabase non disponibile per i servizi della Base.");
    }

    async function getServiceState(serviceKey) {
        const { data, error } = await getDb().rpc("get_base_service_state", {
            p_service_key: serviceKey
        });
        if (error) throw error;
        return data;
    }

    async function getInventoryQuantities(itemIds) {
        if (typeof character === "undefined" || !character || !character.id ||
            !Array.isArray(itemIds) || itemIds.length === 0) return {};

        // Supabase paginates results. Count all stacks, even beyond the first 1000 rows.
        const quantities = {};
        const pageSize = 1000;
        let from = 0;
        while (true) {
            const { data, error } = await getDb()
                .from("character_inventory")
                .select("item_id, quantity")
                .eq("character_id", character.id)
                .in("item_id", itemIds)
                .range(from, from + pageSize - 1);
            if (error) throw error;
            for (const row of (data || [])) {
                quantities[row.item_id] = (quantities[row.item_id] || 0) +
                    (Number(row.quantity) || 0);
            }
            if (!data || data.length < pageSize) break;
            from += pageSize;
        }
        return quantities;
    }

    async function contribute(serviceKey, itemId, quantity) {
        const parsedQuantity = Math.floor(Number(quantity));
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)
            throw new Error("Inserisci una quantità valida.");
        const { data, error } = await getDb().rpc("contribute_to_base_service", {
            p_service_key: serviceKey,
            p_item_id: itemId,
            p_quantity: parsedQuantity
        });
        if (error) throw error;
        return data;
    }

    async function subscribe(onChange) {
        unsubscribe();
        const client = getDb();
        const callback = (table) => (payload) => {
            if (typeof onChange === "function") onChange({ table, payload });
        };
        realtimeChannel = client.channel(CHANNEL_NAME)
            .on("postgres_changes", {
                event: "*", schema: "public", table: "base_services"
            }, callback("base_services"))
            .on("postgres_changes", {
                event: "*", schema: "public", table: "base_service_requirements"
            }, callback("base_service_requirements"))
            .subscribe(status => console.log("[BASE SERVICES] Realtime:", status));
        return realtimeChannel;
    }

    function unsubscribe() {
        if (!realtimeChannel) return;
        try { getDb().removeChannel(realtimeChannel); }
        catch (error) { console.warn("[BASE SERVICES] Errore chiusura Realtime:", error); }
        realtimeChannel = null;
    }

    window.BaseServicesApi = {
        getServiceState, getInventoryQuantities, contribute, subscribe, unsubscribe
    };
})();
