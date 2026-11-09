#!/usr/bin/env python3
"""Palazzo Eterno Custode 1.1: static checks and narrow, opt-in cleanup."""
from __future__ import annotations
import collections
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'custode-report'
EXT = {'.js', '.mjs', '.cjs', '.html', '.css', '.sql'}
SKIP = {'.git', 'node_modules', 'custode-report', 'dist', 'build', '__pycache__'}
RETENTION_DAYS = 7
BATCH_LIMIT = 250

# Explicit, immutable whitelist. No config-provided SQL identifiers.
CLEANUP = {
    'combat_enemy_turn_state': 'id',
    'combat_enemy_last_seen': 'ctid',  # no id column exists in this table
}


def audit_code():
    totals = collections.Counter()
    findings = []
    long_files = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or path.suffix.lower() not in EXT or set(path.relative_to(ROOT).parts) & SKIP:
            continue
        name = str(path.relative_to(ROOT))
        try:
            size = path.stat().st_size
            if size > 1_500_000:
                findings.append({'severity': 'info', 'file': name, 'note': f'File oltre limite lettura ({size} byte)'})
                continue
            content = path.read_text(encoding='utf-8')
        except (OSError, UnicodeError):
            findings.append({'severity': 'info', 'file': name, 'note': 'Lettura saltata'})
            continue
        totals[path.suffix.lower()] += 1
        lines = content.count('\n') + 1
        if lines > 1200:
            long_files.append({'file': name, 'lines': lines})
        if path.suffix.lower() in {'.js', '.mjs', '.cjs'}:
            for pattern, note in [
                (r'\b(?:console\.log|debugger)\b', 'Debug residuo da verificare'),
                (r'\binnerHTML\s*=', 'innerHTML: verificare sanitizzazione'),
                (r'\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\b', 'Possibile riferimento a credenziali privilegiate'),
            ]:
                if re.search(pattern, content, re.I):
                    findings.append({'severity': 'review', 'file': name, 'note': note})
            if size < 200_000:
                try:
                    check = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True, timeout=8)
                    if check.returncode:
                        findings.append({'severity': 'review', 'file': name, 'note': 'Sintassi JavaScript: ' + check.stderr[-250:]})
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    pass
    return {'files_by_type': dict(totals), 'findings': findings[:300],
            'large_file_candidates': sorted(long_files, key=lambda x: -x['lines'])[:80]}


def audit_db(url, dry_run, enabled):
    if not url:
        return {'status': 'not_configured', 'message': 'CUSTODE_DATABASE_URL non configurato'}
    import psycopg
    from psycopg.rows import dict_row
    result = {'status': 'ok', 'retention_days': RETENTION_DAYS, 'batch_limit_per_table': BATCH_LIMIT,
              'mode': 'delete' if enabled and not dry_run else 'dry-run', 'cleanup': []}
    with psycopg.connect(url, connect_timeout=10, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute('SET statement_timeout = 15000')
            cur.execute("SELECT schemaname,relname,n_live_tup,n_dead_tup,pg_total_relation_size(relid) AS bytes FROM pg_stat_user_tables WHERE schemaname IN ('public','game_private') ORDER BY pg_total_relation_size(relid) DESC LIMIT 30")
            result['largest_tables'] = cur.fetchall()
            cur.execute("SELECT n.nspname AS schema_name,c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname='public' AND NOT c.relrowsecurity ORDER BY c.relname")
            result['public_rls_disabled'] = cur.fetchall()
            for table in CLEANUP:
                cur.execute(f"""SELECT count(*) AS n FROM public.{table} t
                    JOIN public.combat_sessions s ON s.id=t.combat_id
                    WHERE s.status IN ('victory','defeat')
                      AND s.updated_at IS NOT NULL
                      AND s.updated_at < now() - make_interval(days => %s)
                      AND (s.ended_at IS NULL OR s.ended_at < now() - make_interval(days => %s))""",
                    (RETENTION_DAYS, RETENTION_DAYS))
                result['cleanup'].append({'table': 'public.' + table, 'eligible': cur.fetchone()['n'], 'deleted': 0})
        conn.rollback()
        if enabled and not dry_run:
            for item in result['cleanup']:
                table = item['table'].split('.')[-1]
                identifier = CLEANUP[table]
                # Only whitelisted names from CLEANUP ever enter these SQL fragments.
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.execute('SET LOCAL lock_timeout = 2000')
                        cur.execute('SET LOCAL statement_timeout = 15000')
                        cur.execute(f"""WITH targets AS (
                            SELECT t.{identifier} AS target_key FROM public.{table} t
                            JOIN public.combat_sessions s ON s.id=t.combat_id
                            WHERE s.status IN ('victory','defeat')
                              AND s.updated_at IS NOT NULL
                              AND s.updated_at < now() - make_interval(days => %s)
                              AND (s.ended_at IS NULL OR s.ended_at < now() - make_interval(days => %s))
                            ORDER BY s.updated_at, t.{identifier}
                            LIMIT %s FOR UPDATE OF t SKIP LOCKED
                        ) DELETE FROM public.{table} t USING targets x, public.combat_sessions s
                          WHERE t.{identifier}=x.target_key AND s.id=t.combat_id
                            AND s.status IN ('victory','defeat')
                            AND s.updated_at IS NOT NULL
                            AND s.updated_at < now() - make_interval(days => %s)
                            AND (s.ended_at IS NULL OR s.ended_at < now() - make_interval(days => %s))
                        RETURNING 1""", (RETENTION_DAYS, RETENTION_DAYS, BATCH_LIMIT, RETENTION_DAYS, RETENTION_DAYS))
                        item['deleted'] = len(cur.fetchall())
    return result


def main():
    now = datetime.now(timezone.utc).isoformat()
    enabled = os.getenv('CUSTODE_DELETE_ENABLED', 'false').lower() == 'true'
    dry_run = os.getenv('CUSTODE_DRY_RUN', 'true').lower() != 'false'
    report = {'version': '1.1', 'time_utc': now, 'code': audit_code()}
    try:
        report['database'] = audit_db(os.getenv('CUSTODE_DATABASE_URL', ''), dry_run, enabled)
    except Exception as exc:
        # Avoid logging credentials or connection strings, including in errors.
        report['database'] = {'status': 'error', 'message': type(exc).__name__,
                              'details': 'Controllare i log GitHub Actions; non pubblicare credenziali'}
    db = report['database']
    code = report['code']
    lines = [f'# Palazzo Eterno — Custode {report["version"]}', '', f'Esecuzione (UTC): {now}',
             '', '## Codice', f'File analizzati: {sum(code["files_by_type"].values())}',
             f'Segnalazioni: {len(code["findings"])}',
             f'File lunghi: {len(code["large_file_candidates"])}', '',
             '## Database', f'Stato: {db["status"]}']
    if db['status'] == 'ok':
        lines += [f'Modalità: {db["mode"]}', f'Tabelle senza RLS: {len(db["public_rls_disabled"])}']
        for item in db['cleanup']:
            lines.append(f'- {item["table"]}: {item["eligible"]} candidate, {item["deleted"]} eliminate')
        lines.append('')
        lines.extend('- ' + x['schema_name'] + '.' + x['table_name'] for x in db['public_rls_disabled'])
    else:
        lines.append(db.get('message', ''))
    lines += ['', '## Protezioni',
              'Sessioni, entità, loot, premi, missioni, chat e dati giocatori non vengono eliminati.',
              'Le dimensioni includono indici e possono non diminuire immediatamente dopo DELETE.']
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str), encoding='utf-8')
    (OUT / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('\n'.join(lines))
    if db['status'] == 'error':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
