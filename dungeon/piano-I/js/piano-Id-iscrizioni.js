/* Palazzo Eterno — Piano Id: le dodici iscrizioni del Tempio di Scintilla.
   Non modifica la mappa, il JSON, la collisione o le coordinate del giocatore. */
(() => {
  'use strict';

  const ISCRIZIONI = [
    { n: 'XI', titolo: 'L’eterna veglia', testo: '«E il custode rimase accanto al suo amore perduto, mentre i secoli divenivano polvere e la sua fiamma non trovava pace.»', x1: 6, y1: 10, x2: 7, y2: 11 },
    { n: 'VI', titolo: 'Lo scontro', testo: '«Contro colui che più amava levò i pugni ardenti, e ogni colpo ferì due cuori.»', x1: 15, y1: 26, x2: 16, y2: 27 },
    { n: 'VIII', titolo: 'Il dolore eterno', testo: '«Colui che dalla morte poteva sempre rialzarsi scoprì una ferita che nessuna rinascita avrebbe guarito.»', x1: 15, y1: 19, x2: 16, y2: 20 },
    { n: 'X', titolo: 'Il sepolcro di cristallo', testo: '«Tra mura consacrate al silenzio, il drago trovò riposo in una tomba splendente come l’alba.»', x1: 22, y1: 34, x2: 23, y2: 35 },
    { n: 'III', titolo: 'Il legame', testo: '«Il fuoco incontrò la luce, e due anime tanto diverse divennero un solo destino.»', x1: 29, y1: 33, x2: 30, y2: 34 },
    { n: 'V', titolo: 'La trasformazione', testo: '«La luce si tinse di viola, il cristallo si spezzò, e ciò che era amore divenne furia.»', x1: 36, y1: 33, x2: 37, y2: 34 },
    { n: 'I', titolo: 'La nascita del Custode', testo: '«Dalla fiamma eterna sorse un piccolo guerriero, nel cui petto ardeva la forza di mille soli.»', x1: 43, y1: 34, x2: 44, y2: 35 },
    { n: 'IX', titolo: 'La costruzione del Tempio', testo: '«Mani e artigli innalzarono pietre verso il cielo, affinché il mondo non dimenticasse il figlio del sole.»', x1: 50, y1: 26, x2: 51, y2: 27 },
    { n: 'IV', titolo: 'La corruzione', testo: '«Ma dalle tenebre giunse un sussurro, e il veleno dell’ombra penetrò nel cuore del cristallo.»', x1: 50, y1: 19, x2: 51, y2: 20 },
    { n: 'XII', titolo: 'Il Destino', testo: 'QUESTA ISCRIZIONE è TROPPO ROVINATA E NON SI RIESCE A LEGGERE', x1: 59, y1: 10, x2: 60, y2: 11 },
    { n: 'II', titolo: 'Il Drago di Cristallo', testo: '«Dalla luce del cielo nacque un drago di cristallo, le cui scaglie riflettevano l’alba del mondo.»', x1: 26, y1: 21, x2: 27, y2: 22 },
    { n: 'VII', titolo: 'L’ultimo addio', testo: '«Quando il grande drago cadde, il piccolo guerriero chinò il capo, e persino il sole tacque.»', x1: 39, y1: 21, x2: 40, y2: 22 }
  ];

  const style = document.createElement('style');
  style.textContent = `
    .id-inscription-overlay { position:fixed; inset:0; z-index:100500; display:flex; justify-content:center; align-items:center; padding:20px; box-sizing:border-box; background:rgba(4,8,18,.84); backdrop-filter:blur(4px); }
    .id-inscription-panel { width:min(560px,95vw); max-height:calc(100vh - 40px); overflow-y:auto; box-sizing:border-box; text-align:center; padding:30px 26px; border:2px solid #b7a67d; border-radius:12px; background:linear-gradient(rgba(4,8,17,.58),rgba(4,8,17,.7)),url("puzzle/immagini/12I.png") center / cover no-repeat; color:#eee7d7; box-shadow:0 15px 70px #000, inset 0 0 36px #d8c19b12; }
    .id-inscription-roman { color:#dfc078; font:700 38px Georgia,serif; margin:0 0 10px; text-shadow:0 0 15px #d0a45655; }
    .id-inscription-title { margin:0 0 22px; font:700 24px Georgia,serif; color:#f7e4b5; }
    .id-inscription-text { font:italic 19px/1.7 Georgia,serif; white-space:pre-wrap; margin:0 0 27px; }
    .id-inscription-text--ruined { font-style:normal; font-size:17px; font-weight:700; letter-spacing:.045em; }
    .id-inscription-close { cursor:pointer; padding:11px 28px; font-weight:700; letter-spacing:.06em; color:#f6e5ba; background:#263649; border:1px solid #bba169; border-radius:6px; }
    .id-inscription-close:hover,.id-inscription-close:focus-visible { background:#394f67; outline:2px solid #d9bf83; outline-offset:2px; }
    @media(max-width:500px){.id-inscription-panel{padding:23px 17px}.id-inscription-text{font-size:17px}.id-inscription-title{font-size:21px}}
  `;
  document.head.appendChild(style);

  let overlay = null;
  let previousFocus = null;
  let lastInscription = null;
  function closeInscription() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    // eventLocked e movementQueue sono definiti nello script piano-Id.js.
    if (typeof eventLocked !== 'undefined') eventLocked = false;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  function openInscription(inscription) {
    if (overlay || (typeof eventLocked !== 'undefined' && eventLocked)) return;
    if (typeof eventLocked !== 'undefined') eventLocked = true;
    if (typeof movementQueue !== 'undefined') movementQueue.length = 0;
    previousFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'id-inscription-overlay';
    overlay.setAttribute('role', 'presentation');
    const panel = document.createElement('section');
    panel.className = 'id-inscription-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'id-inscription-heading');
    const roman = document.createElement('div');
    roman.className = 'id-inscription-roman';
    roman.textContent = inscription.n;
    const heading = document.createElement('h2');
    heading.id = 'id-inscription-heading';
    heading.className = 'id-inscription-title';
    heading.textContent = inscription.titolo;
    const content = document.createElement('p');
    content.className = 'id-inscription-text' + (inscription.n === 'XII' ? ' id-inscription-text--ruined' : '');
    content.textContent = inscription.testo;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'id-inscription-close';
    close.textContent = 'CHIUDI';
    close.addEventListener('click', closeInscription);
    panel.append(roman,heading,content,close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    close.focus();
  }
  document.addEventListener('keydown', event => {
    if (!overlay) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeInscription(); }
    else if (event.key === 'Tab') { event.preventDefault(); overlay.querySelector('button').focus(); }
  }, true);
  function onPlayerPosition(x, y) {
    const current = ISCRIZIONI.find(item => x >= item.x1 && x <= item.x2 && y >= item.y1 && y <= item.y2);
    if (!current) { lastInscription = null; return; }
    if (current.n === lastInscription) return; // niente popup ripetuti all'interno dello stesso rettangolo
    lastInscription = current.n;
    openInscription(current);
  }

  // Osserva le coordinate già aggiornate dal piano-Id.js originale.
  // Nessuna modifica al codice di movimento, alla mappa o al database.
  function setupInscriptionWatcher() {
    const coordinates = document.getElementById('dungeon-player-coordinates');
    if (!coordinates) return;
    let lastPosition = '';
    let initialized = false;
    function checkPosition() {
      const match = coordinates.textContent.match(/X\s*(-?\d+)\s*[·,|\-]?\s*Y\s*(-?\d+)/i);
      if (!match) return;
      const key = match[1] + ',' + match[2];
      if (key === lastPosition) return;
      lastPosition = key;
      // All'ingresso non compare automaticamente un popup: va raggiunta la casella.
      if (!initialized) { initialized = true; return; }
      onPlayerPosition(Number(match[1]), Number(match[2]));
    }
    new MutationObserver(checkPosition).observe(coordinates, { childList:true, characterData:true, subtree:true });
    checkPosition();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupInscriptionWatcher, { once:true });
  } else { setupInscriptionWatcher(); }
})();
