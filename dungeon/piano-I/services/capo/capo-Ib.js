// La chatbox è pronta per un futuro collegamento all'IA dell'Anziano.
// Per ora non vengono inviate richieste a servizi esterni, né salvati dialoghi nel database.
(function () {
  'use strict';
  function init() {
    const form = document.getElementById('capo-chat-form');
    const input = document.getElementById('capo-chat-input');
    const log = document.getElementById('capo-chat-log');
    if (!form || !input || !log) return;

    function appendMessage(kind, author, message) {
      const item = document.createElement('p');
      item.className = 'capo-chat-msg ' + (kind === 'player' ? 'capo-chat-player' : 'capo-chat-npc');
      const heading = document.createElement('strong');
      heading.textContent = author;
      const text = document.createElement('span');
      text.textContent = message;
      item.append(heading, text);
      log.appendChild(item);
      log.scrollTop = log.scrollHeight;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const message = input.value.trim();
      if (!message) return;
      appendMessage('player', 'TU', message);
      input.value = '';
      appendMessage('npc', 'ANZIANO', 'L’Anziano ti osserva in silenzio. Il suo dialogo sarà disponibile prossimamente.');
      input.focus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
