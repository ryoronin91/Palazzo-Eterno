// Palazzo Eterno — chiusura giornaliera del Piano I.
// Include: Ia, Ib, Ic, Id. Solo UI; l'accesso è protetto anche da Supabase.
(() => {
  'use strict';
  const floorNames = {
    'piano-Ia.html':'dungeon_Ia',
    'piano-Ib.html':'dungeon_Ib',
    'piano-Ic.html':'dungeon_Ic',
    'piano-Id.html':'dungeon_Id'
  };
  const floor = floorNames[location.pathname.split('/').pop()];
  if (!floor) return;

  const api = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
  if (!api) return;

  const warnings = new Set();
  let checking = false;
  let overlay = null;

  function secondsUntilFourRome() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone:'Europe/Rome', hour:'2-digit', minute:'2-digit',
      second:'2-digit', hourCycle:'h23'
    }).formatToParts(new Date());
    const data = Object.fromEntries(parts.map(p=>[p.type,p.value]));
    const now = Number(data.hour)*3600+Number(data.minute)*60+Number(data.second);
    const four = 4*3600;
    return now<four ? four-now : (24*3600-now)+four;
  }
  function warn() {
    const secs=secondsUntilFourRome();
    for (const minutes of [30,10,5]) {
      if (secs<=minutes*60 && secs>0 && !warnings.has(minutes)) {
        warnings.add(minutes);
        const line=`Il Piano I chiuderà per manutenzione tra ${minutes} minuti (04:00–05:00).`;
        if (typeof setMessage === 'function') setMessage(line);
        else console.info(line);
      }
    }
  }
  function showClosed() {
    if (overlay) return;
    overlay=document.createElement('div');
    overlay.id='piano-i-maintenance-overlay';
    overlay.setAttribute('role','alertdialog');
    overlay.setAttribute('aria-modal','true');
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483646;background:rgba(10,13,20,.96);'+
      'display:flex;align-items:center;justify-content:center;padding:24px;color:#fff;text-align:center;';
    const msg=document.createElement('div');
    msg.style.cssText='max-width:560px;padding:30px;border:1px solid #bea46c;'+
      'border-radius:12px;background:#181b22;font:16px/1.6 sans-serif;';
    const title=document.createElement('h2');
    title.textContent='Il Piano I è chiuso';
    const explanation=document.createElement('p');
    explanation.textContent='Il Palazzo si sta rigenerando. Il Piano I riapre alle 05:00 (ora italiana). '+
      'I personaggi non impegnati in combattimento vengono riportati al livello Base.';
    msg.append(title,explanation);overlay.append(msg);document.body.append(overlay);
  }
  function hideClosed() {
    if (overlay) { overlay.remove();overlay=null; }
  }
  async function check() {
    if (checking || document.hidden) return;
    checking=true;
    try {
      const {data:status,error}=await api.rpc('piano_i_cycle_status');
      if (error) throw error;
      if (!status) return;
      if (!status.open) showClosed();
      else hideClosed();

      // Il server è la fonte della destinazione. Nessuna modifica diretta ai PG.
      const {data:authResponse}=await api.auth.getUser();
      const user=authResponse?.user;
      if (!user) return;
      const {data:character, error:charError}=await api.from('characters')
        .select('current_location,active_combat_id')
        .eq('user_id',user.id).maybeSingle();
      if (charError) throw charError;
      if (character && character.current_location !== floor && !character.active_combat_id) {
        window.location.replace('../../base/base.html');
      }
    } catch (err) {
      console.warn('[Piano I / ciclo]',err);
    } finally {
      checking=false;
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    warn();void check();
    setInterval(()=>{warn();void check();},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});
  });
})();
