# Palazzo Eterno — Custode 2.0 (solo proposte)

Questa versione **non modifica mai il database, non esegue DELETE, non cambia codice, non crea pull request**. Anche l'avvio settimanale funziona in sola lettura. Genera `custode-report/report.md` e `report.json`, disponibili tra gli artifact della GitHub Action.

## Installazione

Sostituire nel repository:
- `custode/custode.py`
- `custode/README.md`
- `.github/workflows/custode-weekly.yml`

Conservare `custode/requirements.txt` (psycopg[binary]==3.2.12) e il segreto `CUSTODE_DATABASE_URL` dell'utente limitato `custode_reader` gia configurato. NON serve alcun altro segreto, e non serve una chiave di cifratura. Gli eventuali file vecchi `custode/backup.sh`, `custode/README-1.2.md`, `custode/permissions.sql` possono restare come documenti storici, ma non sono richiamati dal nuovo workflow. Per evitare confusione si possono rimuovere dal repository in una modifica separata.

Avviare da GitHub Actions > Palazzo Eterno Custode - Proposte > Run workflow. La pianificazione e ogni lunedi alle 04:17 UTC.

## Cosa controlla

- Dimensioni file, probabili istruzioni di debug, assegnazioni innerHTML, possibili riferimenti service_role, controllo sintattico Node e candidati a refactoring.
- Tabelle piu grandi e senza RLS, conteggi dei dati temporanei collegati a sessioni concluse e vincoli di chiave esterna.
- Classifica i risultati per priorita, spiegando intervento suggerito e verifica necessaria.

## Limiti

- Le segnalazioni sono indizi, non errori provati: richiedono una revisione umana.
- Nessun modello AI esegue analisi semantica approfondita del codice; per quella occorre una revisione separata dei file evidenziati.
- L'utente PostgreSQL ha permessi minimi; se mancano SELECT su alcune tabelle il controllo DB segnala errore senza modificare nulla.
- Il report degli artifact non contiene righe dei personaggi, password o segreti. Se si aggiungono controlli in futuro evitare dati personali e contenuti delle chat.
- Prima di qualunque modifica proposta l'utente prepara il proprio backup e approva esplicitamente l'intervento.
