#!/usr/bin/env python3
"""Custode 2.0: audits and suggestions only. No write SQL or write APIs."""
from __future__ import annotations
import collections
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'custode-report'
SKIP = {'.git', '.github', 'node_modules', 'custode-report', 'dist', 'build', '__pycache__'}
EXT = {'.js', '.mjs', '.cjs', '.html', '.css', '.sql'}
MAX_READ_BYTES = 1_500_000


def issue(category, priority, target, finding, recommendation, verification):
    return dict(category=category, priority=priority, target=target,
                finding=finding, proposal=recommendation, verification=verification,
                applied=False)


def code_audit():
    counts, findings, largest = collections.Counter(), [], []
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in EXT:
            continue
        relative = path.relative_to(ROOT)
        if set(relative.parts) & SKIP:
            continue
        name = relative.as_posix()
        size = path.stat().st_size
        counts[path.suffix.lower()] += 1
        if size > MAX_READ_BYTES:
            findings.append(issue('code', 'medium', name, f'File oltre {MAX_READ_BYTES} byte',
                                  'Misurare responsabilita e valutare una divisione in moduli.',
                                  'Test delle pagine e degli import dopo il refactoring.'))
            continue
        try:
            content = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError):
            findings.append(issue('code', 'low', name, 'Lettura del file non riuscita',
                                  'Verificare codifica del file.', 'Ripetere scansione.'))
            continue
        lines = content.count('\n') + 1
        if lines >= 1200:
            largest.append({'file': name, 'lines': lines, 'bytes': size})
            if lines >= 3000:
                findings.append(issue('maintainability', 'medium', name,
                                      f'{lines} righe nello stesso file',
                                      'Proporre estrazione modulare delle funzioni correlate, senza cambiare comportamento.',
                                      'Regressione su combattimento, dungeon, NPC e salvataggio.'))
        if path.suffix.lower() in {'.js', '.mjs', '.cjs'}:
            checks = [
                (r'\bdebugger\s*;', 'debugger presente', 'Rimuovere solo dopo aver verificato che non sia necessario.'),
                (r'\bconsole\.log\s*\(', 'Possibili log di debug', 'Valutare se sostituirli con logging condizionale.'),
                (r'\.innerHTML\s*=', 'Assegnazione a innerHTML', 'Verificare sanitizzazione e considerare textContent per testo semplice.'),
                (r'\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\b', 'Riferimento a privilegi elevati', 'Verificare che nessuna chiave segreta sia nel codice frontend.'),
            ]
            for pattern, message, proposal in checks:
                occurrences = len(re.findall(pattern, content, re.I))
                if occurrences:
                    priority = 'high' if 'privilegi' in message else 'medium' if 'innerHTML' in message else 'low'
                    findings.append(issue('code', priority, name, f'{message} ({occurrences} occorrenze)', proposal,
                                          'Revisione manuale del contesto e test funzionali.'))
            if size < 200_000:
                try:
                    check = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True, timeout=10)
                    if check.returncode:
                        findings.append(issue('code', 'high', name, 'Controllo sintattico Node non superato',
                                              'Esaminare la sintassi con il contesto del modulo/browser.',
                                              'Ripetere node --check e test nel browser.'))
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    pass
    return {'files_by_extension': dict(counts), 'largest_code_files': sorted(largest, key=lambda x:-x['lines'])[:40],
            'findings': findings}


def database_audit(database_url):
    if not database_url:
        return {'status':'not_configured', 'message':'CUSTODE_DATABASE_URL non configurato', 'findings':[]}
    import psycopg
    from psycopg.rows import dict_row
    result = {'status':'ok', 'findings':[]}
    # Read-only at the PostgreSQL transaction level, independent of workflow flags.
    with psycopg.connect(database_url, connect_timeout=12, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute('SET TRANSACTION READ ONLY')
            cur.execute('SET LOCAL statement_timeout = 20000')
            cur.execute('''SELECT schemaname, relname, n_live_tup, n_dead_tup,
                           pg_total_relation_size(relid) AS bytes
                           FROM pg_stat_user_tables
                           WHERE schemaname IN ('public','game_private')
                           ORDER BY pg_total_relation_size(relid) DESC LIMIT 40''')
            result['largest_tables'] = cur.fetchall()
            cur.execute('''SELECT n.nspname AS schema_name, c.relname AS table_name
                           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                           WHERE c.relkind IN ('r','p') AND n.nspname='public'
                           AND NOT c.relrowsecurity ORDER BY c.relname''')
            result['public_rls_disabled'] = cur.fetchall()
            for table in result['public_rls_disabled']:
                result['findings'].append(issue('security', 'high',
                        table['schema_name']+'.'+table['table_name'], 'RLS disabilitata in schema esposto',
                        'Esaminare GRANT e percorsi del gioco; preparare policy RLS prima di abilitarla.',
                        'Test lettura/scrittura con ruoli anon, authenticated e funzioni RPC.'))
            # Rows are merely counted. The query cannot delete records.
            result['retention_candidates'] = []
            for table in ('combat_enemy_turn_state', 'combat_enemy_last_seen'):
                cur.execute(f'''SELECT count(*) AS n FROM public.{table} t
                       JOIN public.combat_sessions s ON s.id=t.combat_id
                       WHERE s.status IN ('victory','defeat')
                         AND s.updated_at IS NOT NULL
                         AND s.updated_at < now() - interval '7 days'
                         AND (s.ended_at IS NULL OR s.ended_at < now() - interval '7 days')''')
                n = cur.fetchone()['n']
                result['retention_candidates'].append({'table':'public.'+table, 'rows':n, 'proposed_retention_days':7})
                if n:
                    result['findings'].append(issue('retention', 'medium', 'public.'+table,
                        f'{n} righe associate a sessioni concluse e non aggiornate da oltre 7 giorni',
                        'Valutare eliminazione solo dopo approvazione, controllo dipendenze e backup manuale.',
                        'Controllare premi, missioni e testare una cancellazione limitata in transazione.'))
            cur.execute('''SELECT conrelid::regclass::text AS table_name, conname,
                          pg_get_constraintdef(oid) AS definition
                          FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace
                          ORDER BY conrelid::regclass::text, conname''')
            result['foreign_keys'] = cur.fetchall()
            result['findings'].append(issue('performance','low','database',
                f"{len(result['foreign_keys'])} vincoli di chiave esterna rilevati (non necessariamente problematici)",
                'Controllare indici sulle chiavi esterne e piani EXPLAIN delle query piu usate; non creare indici indiscriminatamente.',
                'Confrontare EXPLAIN (ANALYZE, BUFFERS) in ambiente di test.'))
        conn.rollback()
    return result


def render(report):
    db, code = report['database'], report['code']
    findings = code['findings'] + db.get('findings', [])
    priority = {'high':0,'medium':1,'low':2}
    findings.sort(key=lambda f:(priority.get(f['priority'],9), f['category'], f['target']))
    report['proposals'] = findings
    lines = ['# Palazzo Eterno — Custode 2.0', '', f"Esecuzione UTC: {report['created_utc']}",
             '', '> **SOLO PROPOSTE.** Nessun file, schema, dato o permesso e stato modificato.', '',
             '## Riepilogo', f"- File scansionati: {sum(code['files_by_extension'].values())}",
             f"- Proposte: {len(findings)}", f"- Stato database: {db['status']}", '', '## Proposte (da approvare)']
    for i, f in enumerate(findings[:100], 1):
        lines += ['', f"### {i}. [{f['priority'].upper()}] {f['target']}",
                  f"- Categoria: {f['category']}", f"- Osservazione: {f['finding']}",
                  f"- Proposta: {f['proposal']}", f"- Verifica prima di applicare: {f['verification']}"]
    if len(findings) > 100:
        lines += ['', f'Ulteriori {len(findings)-100} proposte nel report.json.']
    lines += ['', '## File lunghi (candidati a refactoring)']
    for f in code['largest_code_files'][:20]:
        lines.append(f"- `{f['file']}`: {f['lines']} righe")
    lines += ['', '## Regole di conservazione proposte — NON APPLICATE']
    for item in db.get('retention_candidates',[]):
        lines.append(f"- `{item['table']}`: {item['rows']} candidate, soglia {item['proposed_retention_days']} giorni")
    if db['status'] != 'ok':
        lines.append(f"- Database: {db.get('message','consultare report.json')}")
    lines += ['', '## Processo di approvazione',
              '1. Leggere e discutere una proposta.',
              '2. Preparare un backup manuale prima di eventuali modifiche.',
              '3. Applicare le modifiche fuori da Custode solo dopo consenso esplicito.',
              '4. Ripetere i test e confrontare i risultati.', '']
    return '\n'.join(lines)


def main():
    report = {'version':'2.0', 'mode':'proposal-only', 'created_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
              'code':code_audit()}
    try:
        report['database'] = database_audit(os.getenv('CUSTODE_DATABASE_URL',''))
    except Exception as exc:
        # No credentials, connection URI or raw DB error text in public artifacts.
        report['database'] = {'status':'error', 'message':type(exc).__name__, 'findings':[]}
    text = render(report)
    OUT.mkdir(exist_ok=True)
    (OUT/'report.md').write_text(text,encoding='utf-8')
    (OUT/'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str),encoding='utf-8')
    print('\n'.join(text.splitlines()[:20]))
    if report['database']['status']=='error':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
