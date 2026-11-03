/* Palazzo Eterno — timer del Piano I, accanto ai controlli dello zoom.
 * Orologio: fuso Europe/Rome, chiusura alle 04:00 e riapertura alle 05:00.
 * Il timer e' informativo: la fonte autorevole per il blocco resta Supabase.
 */
(() => {
    'use strict';
    const ZONE = 'Europe/Rome';
    const ID = 'pia-floor-countdown';
    const FORMAT = new Intl.DateTimeFormat('en-GB', {
        timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const PILL_CSS = `
        #${ID} {
            display: inline-flex; align-items: center; gap: 7px;
            flex: 0 0 auto; min-height: 32px; padding: 4px 10px;
            border: 1px solid rgba(192,155,84,.65); border-radius: 7px;
            background: rgba(24,24,30,.82); color: #e8cb8e;
            font: 600 12px/1.15 system-ui, sans-serif; white-space: nowrap;
            font-variant-numeric: tabular-nums; box-sizing: border-box;
            box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
        }
        #${ID} .pia-floor-countdown-symbol { font-size: 15px; line-height: 1; }
        #${ID} .pia-floor-countdown-label { opacity: .83; font-size: 10px; }
        #${ID} .pia-floor-countdown-digits { letter-spacing: .8px; font-size: 15px; }
        #${ID}.pia-floor-countdown-warning {
            color: #ffca88; border-color: #d98a3f;
        }
        #${ID}.pia-floor-countdown-closed {
            color: #ffb8a9; border-color: #b74f49;
        }
        @media (max-width: 900px) {
            #${ID} { padding: 3px 7px; gap: 5px; }
            #${ID} .pia-floor-countdown-label { display: none; }
            #${ID} .pia-floor-countdown-digits { font-size: 13px; }
        }
    `;

    function zonedParts(date) {
        const parts = Object.fromEntries(FORMAT.formatToParts(date)
            .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
        return parts;
    }

    // Converte un orario Europe/Rome in UTC, inclusi i giorni di cambio ora.
    function romeTarget(parts, hour) {
        const fakeLocalUtc = Date.UTC(parts.year, parts.month - 1, parts.day, hour, 0, 0);
        let epoch = fakeLocalUtc;
        for (let n = 0; n < 5; n++) {
            const p = zonedParts(new Date(epoch));
            const wallUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
            const next = epoch + fakeLocalUtc - wallUtc;
            if (Math.abs(next - epoch) < 1000) return next;
            epoch = next;
        }
        return epoch;
    }

    function nextStatus() {
        const now = Date.now();
        const local = zonedParts(new Date(now));
        const localSeconds = local.hour * 3600 + local.minute * 60 + local.second;
        const closed = localSeconds >= 4 * 3600 && localSeconds < 5 * 3600;
        let target;
        if (closed) {
            target = romeTarget(local, 5);
        } else if (localSeconds < 4 * 3600) {
            target = romeTarget(local, 4);
        } else {
            const nextDayUtc = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
            target = romeTarget({ year: nextDayUtc.getUTCFullYear(),
                month: nextDayUtc.getUTCMonth() + 1, day: nextDayUtc.getUTCDate() }, 4);
        }
        return { closed, ms: Math.max(0, target - now) };
    }

    function formatRemaining(ms) {
        const sec = Math.max(0, Math.ceil(ms / 1000));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
    }

    let timer = null;
    let label = null;
    let digits = null;
    let lastMode = null;
    let serverOpen = null;

    function install() {
        const toolbar = document.querySelector('.pia-map-toolbar');
        if (!toolbar) return false;
        timer = document.getElementById(ID);
        if (timer) return true;
        const style = document.createElement('style');
        style.id = 'pia-floor-countdown-style';
        style.textContent = PILL_CSS;
        document.head.appendChild(style);
        timer = document.createElement('div');
        timer.id = ID;
        timer.setAttribute('role', 'timer');
        timer.setAttribute('aria-label', 'Tempo residuo del ciclo del Piano I');
        const symbol = document.createElement('span');
        symbol.className = 'pia-floor-countdown-symbol';
        symbol.textContent = '⌛';
        symbol.setAttribute('aria-hidden', 'true');
        label = document.createElement('span');
        label.className = 'pia-floor-countdown-label';
        digits = document.createElement('span');
        digits.className = 'pia-floor-countdown-digits';
        timer.append(symbol, label, digits);
        const zoomIn = toolbar.querySelector('#pia-zoom-in');
        if (zoomIn) zoomIn.insertAdjacentElement('afterend', timer);
        else toolbar.appendChild(timer);
        return true;
    }

    function update() {
        if (!timer && !install()) return;
        const { closed, ms } = nextStatus();
        const needsMaintenance = closed || serverOpen === false;
        const mode = needsMaintenance ? 'closed' : ms <= 30 * 60 * 1000 ? 'warning' : 'open';
        timer.classList.toggle('pia-floor-countdown-warning', mode === 'warning');
        timer.classList.toggle('pia-floor-countdown-closed', mode === 'closed');
        label.textContent = needsMaintenance ? 'RIAPERTURA' : 'CHIUSURA';
        digits.textContent = needsMaintenance && !closed ? 'MANUTENZIONE' : formatRemaining(ms);
        timer.title = needsMaintenance
            ? 'Piano I chiuso per manutenzione. Riapertura alle 05:00 (ora italiana), dopo il reset.'
            : 'Tempo residuo prima della chiusura delle 04:00 (ora italiana).';
        if (lastMode !== mode) {
            timer.setAttribute('aria-label', timer.title);
            lastMode = mode;
        }
    }

    async function checkServer() {
        const api = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
        if (!api) return;
        try {
            const { data, error } = await api.rpc('piano_i_cycle_status');
            if (!error && data && typeof data.open === 'boolean') serverOpen = data.open;
        } catch (err) {
            console.warn('[Piano I countdown] Stato server non disponibile:', err);
        }
        update();
    }

    function start() {
        if (!install()) return;
        update();
        window.setInterval(update, 1000);
        void checkServer();
        window.setInterval(checkServer, 30000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) { update(); void checkServer(); }
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else start();
})();
