# Palazzo Eterno — Custode 1.1

## Cartelle

- `custode/custode.py`, `custode/requirements.txt`, `custode/permissions.sql`, `custode/README.md`
- `.github/workflows/custode-weekly.yml` (GitHub Actions richiede questo percorso esterno)

## Protezioni

- Analisi codice e database una volta a settimana, lunedì alle 04:17 UTC.
- Sola lettura per impostazione predefinita (`CUSTODE_DELETE_ENABLED` assente o `false`).
- Simulazione forzata con il parametro manuale `dry_run=true`.
- Solo due tabelle autorizzate: `public.combat_enemy_turn_state` e `public.combat_enemy_last_seen`.
- Solo sessioni `victory` o `defeat` con `updated_at` vecchio di almeno 7 giorni, e `ended_at` non recente se valorizzato. Questo risolve il fatto che la maggioranza delle sessioni concluse ha `ended_at=NULL`.
- Massimo 250 righe eliminate per tabella e per esecuzione, transazioni separate, lock e statement timeout.
- **NON elimina** sessioni, entità, loot, oro, chat, progressi, boss, arene, missioni, achievement o personaggi.
- L'utente `custode_reader` non può cancellare nulla senza i due GRANT DELETE commentati in `permissions.sql`.

## Installazione

1. Sostituire i file nelle cartelle indicate. Il workflow resta in `.github/workflows`.
2. Su Supabase SQL Editor eseguire la **FASE A** di `custode/permissions.sql`: aggiorna le policy del solo ruolo `custode_reader`, senza cambiare le policy dei giocatori e senza cancellare dati. Le righe DELETE rimangono commentate.
3. Non cambiare il secret GitHub `CUSTODE_DATABASE_URL`, già configurato.
4. Eseguire il workflow manualmente con `dry_run=true`; scaricare l'artifact e verificare `report.md` / `report.json`.
5. Prima di abilitare qualsiasi cancellazione verificare un backup recuperabile e l'assenza di usi del gioco che richiedano stati IA di combattimenti terminati. Solo dopo approvazione: abilitare i due GRANT DELETE nel database e la repository variable `CUSTODE_DELETE_ENABLED=true`.
6. **Per interrompere subito le pulizie** impostare `CUSTODE_DELETE_ENABLED=false`, oppure revocare `DELETE` all'utente dal SQL Editor.

## Limitazioni importanti

La ricostruzione del tempo di fine usa `updated_at` perché 1.541 sessioni concluse risultano prive di `ended_at`. Se il codice del gioco riutilizza o aggiorna sessioni già concluse, mantenere le cancellazioni disattivate finché non è verificato questo comportamento.

Le segnalazioni statiche sono euristiche. Nessuna modifica automatica di sorgenti, struttura SQL, policy RLS o dati persistenti. La tabella `combat_enemy_turn_state` ha RLS disabilitata già prima di Custode: problema di sicurezza separato, che va corretto studiando le policy del gioco. La tabella con RLS attiva `combat_enemy_last_seen` usa una policy di sola lettura per Custode; la policy DELETE è predisposta, commentata, nella FASE B di permissions.sql (non disabilitare RLS). Il ruolo SQL con LOGIN è distinto dai ruoli client anon/authenticated.
