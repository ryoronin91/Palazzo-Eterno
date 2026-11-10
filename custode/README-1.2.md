# Custode 1.2 — Backup cifrato e pulizia protetta

**Non caricare mai password, chiavi private, dump in chiaro o database nel repository pubblico.**

## File da caricare

- `custode/backup.sh` (nuovo)
- `.github/workflows/custode-weekly.yml` (sostituisce quello della v1.1)
- `custode/README-1.2.md` (questo file)

Gli altri file di Custode 1.1, inclusi `custode.py`, `requirements.txt` e `permissions.sql`, **restano invariati**.

## 1. Crea una chiave di cifratura sul TUO computer

Installa [age](https://github.com/FiloSottile/age/releases) sul tuo PC Windows.
Apri PowerShell in una cartella ESTERNA a `D:\Palazzo-Eterno` e lancia:

```powershell
age-keygen -o custode-private-key.txt
```

Il comando stampa una riga `Public key: age1...`: è la sola informazione da inserire in GitHub.
Custodisci `custode-private-key.txt` fuori dal repository, in almeno due luoghi sicuri.
**Senza la chiave privata, i backup non possono essere ripristinati.**

## 2. Crea un segreto dedicato per il backup completo

GitHub > repository Palazzo-Eterno > Settings > Secrets and variables > Actions.
In `Secrets` crea `CUSTODE_BACKUP_DATABASE_URL`, usando la **Session pooler, porta 5432**, con utente PostgreSQL `postgres.<PROJECT_REF>` (non `custode_reader`), password database e `?sslmode=require`.
La password postgres NON va nel repository. Questo account più privilegiato è necessario per un backup che comprenda anche gli schemi non pubblici; controlla che `pg_dump` riesca a leggere tutti gli oggetti. Per massima sicurezza si può in seguito sostituirlo con un ruolo di backup dedicato.

La credenziale `CUSTODE_DATABASE_URL` esistente, per l'analisi, rimane invariata.

## 3. Configura la chiave pubblica

Nella scheda `Variables` crea `CUSTODE_AGE_RECIPIENT` e incolla la chiave pubblica che comincia con `age1`.
NON incollare la chiave privata in GitHub, chat, repository o variabili.

## 4. Primo test manuale

Da GitHub > Actions > Palazzo Eterno Custode > Run workflow, lascia selezionato `dry_run = true`.
Dovrebbero essere prodotti DUE artifact: `custode-backup-N` e `custode-report-N`.
Il primo contiene esclusivamente un file `.dump.age` e relativo checksum SHA-256. Il dump PostgreSQL NON viene caricato in chiaro.
Il job `audit` gira anche se il backup fallisce, ma in tal caso la cancellazione viene bloccata.

## 5. Come provare che la chiave privata apre il backup

Scarica il backup cifrato e conserva il file `custode-private-key.txt` in luogo sicuro.
In PowerShell, con age installato, puoi decifrarlo LOCALMENTE:

```powershell
age --decrypt --identity C:\PERCORSO\custode-private-key.txt --output database.dump C:\PERCORSO\palazzo-eterno-AAAA.dump.age
```

Il file `database.dump` contiene dati sensibili: proteggilo e cancellalo in modo sicuro quando non serve. Per un vero test di ripristino serve importarlo in una **istanza PostgreSQL 17 separata**, con `pg_restore` e verificare tabelle/campioni. Non eseguire `pg_restore` direttamente sul database di produzione. La verifica `pg_restore --list` del workflow è solo un controllo preliminare, non prova che il ripristino funzioni.

## 6. Sicurezza e attivazione pulizia

La pulizia è ancora disabilitata. Per attivarla in futuro occorrono TUTTE le variabili repository:

- `CUSTODE_DELETE_ENABLED=true`
- `CUSTODE_RESTORE_TESTED=true` (solo dopo un vero test di ripristino)
- `CUSTODE_OFFSITE_BACKUP_CONFIRMED=true` (solo dopo avere una seconda copia indipendente verificata)

E il job di backup della stessa esecuzione deve terminare con successo. Un avvio manuale con `dry_run=true` impedisce comunque le cancellazioni.

Finché non è pronto un vero ripristino e una copia esterna a GitHub, lascia le tre variabili disattivate/assenti.

## Limitazioni importanti

- Gli artifact in un repository GitHub **pubblico** devono essere considerati accessibili: contengono solo dati cifrati. I backup vengono eliminati automaticamente da GitHub al termine della retention (qui 90 giorni) e non sostituiscono una copia indipendente.
- Il dump PostgreSQL comprende struttura e contenuto degli oggetti leggibili dal ruolo usato. Non è una fotografia integrale di Supabase: non comprende gli oggetti binari in Supabase Storage, le impostazioni del progetto, le chiavi API e potrebbe non comprendere completamente ruoli/grant gestiti dalla piattaforma. La loro protezione deve essere pianificata separatamente.
- Il database di produzione non viene modificato da questo workflow finché non abiliti esplicitamente i tre controlli di cancellazione.
- Non presumere che `pg_dump` sia ripristinabile senza un test su un database vuoto e isolato.
- Verifica i limiti di storage e retention di GitHub Actions; i backup settimanali conservati 90 giorni sono più di quattro copie se tutte le esecuzioni riescono.
