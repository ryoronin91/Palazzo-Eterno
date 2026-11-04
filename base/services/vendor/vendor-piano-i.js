// PALAZZO ETERNO · MANO DI SCIMMIA · MERCE SBLOCCATA DALLE MISSIONI DELLA I ORA
// Caricare dopo vendor.js, prima dell'evento DOMContentLoaded.
(() => {
    'use strict';
    const missionStock = new Set([
        'spada_pietra', 'lancia_pietra', 'scudo_tartaruga', 'sciabola_mietitore',
        'piuma_allosauro', 'frutto_carnoso',
        'coscia_uccello_stigio', 'foglia_nutriente', 'funghetto'
    ]);
    const originalLoad = loadVendorItems;
    loadVendorItems = async function (...args) {
        await originalLoad.apply(this, args);
        let allowed = new Set();
        try {
            const { data, error } = await db.rpc('get_piano_i_vendor_unlocks');
            if (error) throw error;
            if (!Array.isArray(data)) throw new Error('Risposta sblocco vendor non valida');
            allowed = new Set(data);
        } catch (error) {
            // In caso di problemi di rete, non rivelare merci ancora bloccate.
            console.warn('Mano di Scimmia: verifica sblocchi I Ora non riuscita:', error);
        }
        vendorItems = vendorItems.filter(row =>
            !missionStock.has(row.item_id) || allowed.has(row.item_id)
        );
    };
})();
