// Palazzo Eterno — Stato Braci di Scintilla nella scheda del personaggio.
(() => {
  'use strict';
  let status = null, panel = null;
  const cooldowns = [0,24,12,6,3,2,1];
  const fmt = secs => {
    if (secs <= 0) return 'PRONTE';
    const h = Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=Math.floor(secs%60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };
  function updateDisplay() {
    if (!status || !panel) return;
    const lv = Number(status.level)||0;
    if (lv<1) { panel.hidden=true; return; }
    panel.hidden=false;
    const remain = status.ready_at ? Math.max(0,Math.ceil((Date.parse(status.ready_at)-Date.now())/1000)) : 0;
    panel.textContent = `🔥 BRACI DI SCINTILLA — LV ${lv}/6 · ${remain>0?'RICARICA '+fmt(remain):'PRONTE'} · Cooldown: ${cooldowns[lv]}h`;
  }
  async function refresh() {
    try {
      const client = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
      if (!client) return;
      const {data,error}=await client.rpc('scagliagrigia_braci_status');
      if (error) return;
      status = data;
      if (!panel) {
        panel=document.createElement('div');
        panel.id='braci-scintilla-status';
        panel.setAttribute('role','status');
        panel.hidden=true;
        panel.style.cssText='margin:12px auto;padding:12px 15px;border:1px solid #b67e38;background:rgba(53,27,12,.90);color:#ffe2a6;font:bold 13px Arial,sans-serif;text-align:center;max-width:760px;letter-spacing:.02em';
        const anchor=document.getElementById('inventory-system-section');
        if (anchor?.parentNode) anchor.parentNode.insertBefore(panel,anchor);
        else document.body.appendChild(panel);
      }
      updateDisplay();
    } catch (e) { console.warn('Braci: stato indisponibile', e); }
  }
  document.addEventListener('DOMContentLoaded', () => { refresh();setInterval(updateDisplay,1000);setInterval(refresh,30000); });
})();
