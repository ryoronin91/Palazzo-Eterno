#!/usr/bin/env python3
"""Palazzo Eterno Custode 1.0 — static audit + carefully bounded cleanup.

Cleanup is fail-closed unless DB secret AND repository variable enable it.
Only old AI turn-state rows are eligible. No dynamic deletion table names.
"""
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
OUT.mkdir(exist_ok=True)
EXT = {'.js', '.mjs', '.cjs', '.html', '.css', '.sql'}
SKIP = {'node_modules', '.git', 'custode-report', 'dist', 'build', '__pycache__'}
MAX_FILE = 1_500_000
BATCH_LIMIT = 250
RETENTION_DAYS = 30


def audit_code():
    findings = []
    totals = collections.Counter()
    candidates = []
    for p in ROOT.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in EXT or set(p.relative_to(ROOT).parts) & SKIP:
            continue
        try:
            size = p.stat().st_size
            if size > MAX_FILE:
                totals[p.suffix.lower()] += 1
                findings.append({'severity': 'info', 'file': str(p.relative_to(ROOT)), 'note': f'File codice grande ({size} bytes), scansione dettagliata saltata'})
                continue
            s = p.read_text(encoding='utf8')
        except (UnicodeError, OSError):
            continue
        path = str(p.relative_to(ROOT))
        lines = s.count('\n') + 1
        totals[p.suffix.lower()] += 1
        if lines > 1200:
            candidates.append({'file': path, 'lines': lines, 'suggestion': 'Valutare estrazione moduli, senza modifiche automatiche'})
        if p.suffix.lower() in ('.js', '.mjs', '.cjs'):
            if re.search(r'\b(console\.log|debugger)\b', s):
                findings.append({'severity':'info', 'file':path, 'note':'Possibile debug residuo: console.log o debugger'})
            if re.search(r'\binnerHTML\s*=', s):
                findings.append({'severity':'review', 'file':path, 'note':'innerHTML: verificare sanitizzazione degli input'})
            if re.search(r'\b(service_role|SUPABASE_SERVICE_ROLE_KEY)\b', s, flags=re.I):
                findings.append({'severity':'review', 'file':path, 'note':'Riferimento a privilegi service_role nel codice, verificare che nessun segreto sia esposto'})
            if size < 200_000 and p.suffix.lower() in ('.js', '.mjs', '.cjs'):
                try:
                    result = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True, timeout=8)
                    if result.returncode:
                        findings.append({'severity':'review', 'file':path, 'note': 'Sintassi JS da verificare: '+result.stderr[-350:].strip()})
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    pass
    return {'files_by_type':dict(totals), 'large_file_candidates':sorted(candidates, key=lambda x:-x['lines'])[:50], 'findings':findings[:250]}


def audit_db(url, dry_run, enabled):
    if not url:
        return {'status':'not_configured', 'message':'Secret CUSTODE_DATABASE_URL mancante: scansione SQL saltata; nessuna cancellazione'}
    import psycopg
    from psycopg.rows import dict_row
    info = {'status':'ok', 'cleanup':{'table':'public.combat_enemy_turn_state', 'retention_days':RETENTION_DAYS, 'max_delete':BATCH_LIMIT, 'dry_run':dry_run or not enabled, 'deleted':0}}
    # Privileged URL must be supplied ONLY as an Actions secret, never frontend or repository file.
    with psycopg.connect(url, connect_timeout=10, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute('SET statement_timeout = 15000')
            cur.execute("SELECT schemaname,relname,n_live_tup,n_dead_tup,pg_total_relation_size(relid) AS bytes FROM pg_stat_user_tables WHERE schemaname IN ('public','game_private') ORDER BY pg_total_relation_size(relid) DESC LIMIT 30")
            info['largest_tables'] = cur.fetchall()
            cur.execute("SELECT n.nspname AS schema_name,c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname='public' AND NOT c.relrowsecurity ORDER BY c.relname")
            info['public_rls_disabled'] = cur.fetchall()
            cur.execute("SELECT count(*) AS n FROM public.combat_enemy_turn_state t JOIN public.combat_sessions s ON s.id=t.combat_id WHERE s.status IN ('victory','defeat') AND s.ended_at IS NOT NULL AND s.ended_at < now()-make_interval(days=>%s)", (RETENTION_DAYS,))
            eligible = cur.fetchone()['n']
            info['cleanup']['eligible'] = eligible
        conn.rollback()  # End read transaction before write transaction.
        if enabled and not dry_run:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute('SET LOCAL lock_timeout = 2000')
                    cur.execute('SET LOCAL statement_timeout = 15000')
                    # Lock on each candidate prevents racing with other maintenance;
                    # session's state/age is re-checked within the DELETE.
                    cur.execute("""WITH target AS (
                        SELECT t.id FROM public.combat_enemy_turn_state t
                        JOIN public.combat_sessions s ON s.id=t.combat_id
                        WHERE s.status IN ('victory','defeat')
                          AND s.ended_at IS NOT NULL
                          AND s.ended_at < now()-make_interval(days=>%s)
                        ORDER BY t.created_at,t.id LIMIT %s
                        FOR UPDATE OF t SKIP LOCKED
                    ) DELETE FROM public.combat_enemy_turn_state t
                    USING target x, public.combat_sessions s
                    WHERE t.id=x.id AND s.id=t.combat_id
                      AND s.status IN ('victory','defeat')
                      AND s.ended_at < now()-make_interval(days=>%s)
                    RETURNING t.id""", (RETENTION_DAYS,BATCH_LIMIT,RETENTION_DAYS))
                    info['cleanup']['deleted'] = len(cur.fetchall())
        else:
            info['cleanup']['reason'] = 'Simulazione richiesta o variabile CUSTODE_DELETE_ENABLED non attiva'
    return info


def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    dry_run = os.getenv('CUSTODE_DRY_RUN','false').lower() == 'true'
    enabled = os.getenv('CUSTODE_DELETE_ENABLED','false').lower() == 'true'
    report = {'version':'1.0', 'time_utc':now, 'mode':'dry-run' if dry_run or not enabled else 'bounded-cleanup', 'code':audit_code()}
    try:
        report['database'] = audit_db(os.getenv('CUSTODE_DATABASE_URL',''),dry_run,enabled)
    except Exception as e:
        report['database'] = {'status':'error','error':str(e).splitlines()[0][:300], 'cleanup':'not_executed'}
    (OUT/'report.json').write_text(json.dumps(report,indent=2,default=str,ensure_ascii=False),encoding='utf8')
    db = report['database']; code = report['code']
    lines = ['# Palazzo Eterno — Custode 1.0',f'Run UTC: {now}',f'Mode: {report["mode"]}', '', '## Analisi codice',f'File esaminati: {sum(code["files_by_type"].values())}',f'Segnalazioni: {len(code["findings"])}',f'File lunghi: {len(code["large_file_candidates"])}','','## Database',f'Stato: {db["status"]}']
    if db['status']=='ok':
        c=db['cleanup']; lines.extend([f'Righe candidate: {c["eligible"]}',f'Righe eliminate: {c["deleted"]}',f'Tabelle pubbliche senza RLS: {len(db["public_rls_disabled"])}'])
        lines.extend([f'- {x["schema_name"]}.{x["table_name"]}' for x in db['public_rls_disabled']])
    else: lines.append(str(db.get('message',db.get('error',''))))
    lines.extend(['','## Limitazioni','Controlli statici euristici: richiedono revisione manuale. Nessuna modifica automatica al codice, allo schema o alle policy RLS.'])
    (OUT/'report.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    print('\n'.join(lines))
    if db['status']=='error':
        raise SystemExit(1)

if __name__=='__main__':
    main()
