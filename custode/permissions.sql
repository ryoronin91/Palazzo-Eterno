-- Custode 1.1 — ESEGUIRE nel SQL Editor del progetto Palazzo Eterno.
-- FASE A (ora): sola lettura. Non cancella dati e non cambia policy dei giocatori.
-- La policy precedente per custode_reader limitava i combattimenti a 30 giorni:
-- questa la riallinea ai 7 giorni di Custode 1.1.

GRANT CONNECT ON DATABASE postgres TO custode_reader;
GRANT USAGE ON SCHEMA public TO custode_reader;
GRANT SELECT (id, status, updated_at, ended_at) ON public.combat_sessions TO custode_reader;
GRANT SELECT (id, combat_id, created_at) ON public.combat_enemy_turn_state TO custode_reader;
GRANT SELECT (combat_id, enemy_entity_id, updated_at) ON public.combat_enemy_last_seen TO custode_reader;

DROP POLICY IF EXISTS "Custode legge combattimenti conclusi" ON public.combat_sessions;
CREATE POLICY "Custode legge combattimenti conclusi"
ON public.combat_sessions FOR SELECT TO custode_reader
USING (status IN ('victory','defeat')
  AND updated_at IS NOT NULL AND updated_at < now() - interval '7 days'
  AND (ended_at IS NULL OR ended_at < now() - interval '7 days'));

-- combat_enemy_last_seen ha RLS: abilitiamo la sola lettura per il ruolo tecnico.
DROP POLICY IF EXISTS "Custode legge ultimi avvistamenti" ON public.combat_enemy_last_seen;
CREATE POLICY "Custode legge ultimi avvistamenti"
ON public.combat_enemy_last_seen FOR SELECT TO custode_reader
USING (EXISTS (
  SELECT 1 FROM public.combat_sessions s WHERE s.id = combat_id
));

-- FASE B: SOLO in seguito, dopo dry-run, verifica backup e approvazione.
-- I seguenti comandi rimangono COMMENTATI e non si eseguono ora.
-- GRANT DELETE ON public.combat_enemy_turn_state TO custode_reader;
-- GRANT DELETE ON public.combat_enemy_last_seen TO custode_reader;
-- CREATE POLICY "Custode elimina ultimi avvistamenti"
-- ON public.combat_enemy_last_seen FOR DELETE TO custode_reader
-- USING (EXISTS (SELECT 1 FROM public.combat_sessions s
--                WHERE s.id = combat_id));
-- Solo dopo aver eseguito questi comandi impostare la variabile GitHub
-- CUSTODE_DELETE_ENABLED=true. Un run manuale con dry_run=true resta sicuro.
