PALAZZO ETERNO — PIANO I-A — MONETA SPAZIALE

Questo file .txt contiene il codice JS da integrare in piano-Ia.js.
NON è il file piano-Ia.js completo e NON va usato per sostituirlo.

1) All'inizio della funzione esistente updateFruitConsumable(), aggiungi:
    updateSpatialCoinPia();
2) Aggiungi il seguente codice alla fine di piano-Ia.js:

// ============================================================
// PIANO I-A — MONETA SPAZIALE
// Usa l'RPC atomica che consuma 1 moneta e teletrasporta alla Base.
// ============================================================
let spatialCoinPiaBusy = false;
function spatialCoinPiaCount() {
    return (Array.isArray(characterInventory) ? characterInventory : [])
       .filter(row => row?.item?.id === 'moneta_spaziale'
           && !row.equipped_slot && Number(row.quantity) > 0)
       .reduce((n, row) => n + Number(row.quantity || 0), 0);
}
function ensureSpatialCoinPiaButton() {
    let button = document.getElementById('dungeon-spatial-coin-button');
    if (button) return button;
    const panel = document.querySelector('.dungeon-actions-panel');
    if (!panel) return null;
    button = document.createElement('button');
    button.id = 'dungeon-spatial-coin-button';
    button.type = 'button';
    button.className = 'dungeon-action-card';
    button.style.display = 'none';
    button.innerHTML = '<span class="action-card-icon">✦</span>' +
        '<span class="action-card-content"><strong>MONETA SPAZIALE</strong>' +
        '<small id="dungeon-spatial-coin-count">x0</small></span>';
    const pagination = panel.querySelector('.dungeon-action-pagination');
    panel.insertBefore(button, pagination || null);
    button.addEventListener('click', async () => {
        if (spatialCoinPiaBusy || button.disabled || !character || !db) return;
        if (!window.confirm('Consumare una Moneta Spaziale per tornare al Livello Base?')) return;
        spatialCoinPiaBusy = true;
        updateSpatialCoinPia();
        try {
            const { error } = await db.rpc('use_spatial_coin');
            if (error) throw error;
            window.location.assign('../../base/base.html');
        } catch (error) {
            console.error('Moneta Spaziale Piano I-A:', error);
            setMessage(error?.message || 'Impossibile utilizzare la Moneta Spaziale.', true);
            spatialCoinPiaBusy = false;
            updateSpatialCoinPia();
        }
    });
    return button;
}
function updateSpatialCoinPia() {
    const button = ensureSpatialCoinPiaButton();
    if (!button) return;
    const count = spatialCoinPiaCount();
    const label = document.getElementById('dungeon-spatial-coin-count');
    if (label) label.textContent = 'x' + count;
    button.style.display = count ? '' : 'none';
    button.disabled = spatialCoinPiaBusy || !count || !character || !!character.active_combat_id;
}
