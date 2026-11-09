# Palazzo Eterno — Custode 1.0

## Struttura

```text
custode/
  custode.py
  requirements.txt
  README.md
.github/
  workflows/
    custode-weekly.yml
```

GitHub Actions riconosce i workflow esclusivamente in `.github/workflows/`; non può eseguirli se sono soltanto nella cartella `custode/`. Tutta la logica del programma rimane in `custode/`.

## Cosa fa

- Ogni lunedì alle 04:17 UTC (05:17 in Italia in inverno, 06:17 in estate); avvio manuale tramite Actions.
- Scansione dei file JavaScript, HTML, CSS e SQL (controlli euristici: debug, `innerHTML`, rischi di riferimenti a service-role, file lunghi; `node --check` per JS sotto 200 KB).
- Analisi database: 30 tabelle più grandi e tabelle `public` senza RLS.
- La **sola** tabella autorizzata alla pulizia è `public.combat_enemy_turn_state`: massimo 250 righe per esecuzione, se collegate a sessioni terminate con `status IN ('victory','defeat')` ed `ended_at` antecedente a 30 giorni.
- Report Markdown e JSON scaricabili dagli artifact di GitHub Actions (90 giorni).

**Non elimina:** sessioni combattimento, loot, oggetti, personaggi, progressi, chat, audit, sonda economica o altri dati.

## Installazione

1. Caricare sul repository **mantenendo esattamente l'alberatura** illustrata sopra. Il file YAML esterno alla cartella `custode` è indispensabile per la pianificazione.
2. In GitHub → `Settings` → `Secrets and variables` → `Actions` → `Secrets`, configurare `CUSTODE_DATABASE_URL`. Deve essere una connessione PostgreSQL con TLS (`sslmode=require`), usata solo lato server, con privilegi minimi: `SELECT` sui cataloghi e sulle tabelle consultate, `DELETE` solo su `public.combat_enemy_turn_state`.
3. In GitHub → `Actions` → `Palazzo Eterno Custode` → `Run workflow`, impostare **dry_run = true**. Verificare `custode-report/report.md` nell'artifact.
4. Verificare backup/ripristino e risultati del dry run. Solo allora impostare in `Actions` → `Variables` la variabile `CUSTODE_DELETE_ENABLED` a `true`. In assenza di questa variabile, o se vale `false`, non si cancella nulla.
5. Un avvio manuale con `dry_run = true` non cancella mai righe, anche se la variabile precedente è `true`. Per sospendere la pulizia programmata mettere `CUSTODE_DELETE_ENABLED=false`.

## Protezioni e limiti

- Lo script non modifica codice, indici, schema SQL o policy RLS.
- Sono protette le sessioni non concluse e quelle concluse da meno di 30 giorni.
- La cancellazione è limitata a 250 righe con timeout e lock brevi; altre tabelle non sono autorizzate.
- `CUSTODE_DATABASE_URL` non va mai caricato nel repository, nel frontend o nei report.
- Gli artifact non sono un registro immutabile e il backup va predisposto prima di abilitare il `DELETE`.
- Le segnalazioni del codice sono controlli statici: non certificano assenza di vulnerabilità o errori.
- I permessi DB effettivi devono essere verificati prima della prima esecuzione. Il workflow senza secret esegue solo l'analisi del codice.
