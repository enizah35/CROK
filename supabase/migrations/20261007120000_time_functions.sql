-- Temps de référence de CROK (R-01, R-02).
-- Équivalents SQL exacts de `dayParis` et `weekStart` (packages/shared/src/time.ts),
-- testés sur les mêmes cas dans supabase/tests/time.test.sql.
-- Le fuseau de la session Postgres n'intervient jamais : tout passe par Europe/Paris.

-- Jour calendaire de Paris correspondant à un instant (colonne dishes.day_paris).
create function public.day_paris(instant timestamptz)
returns date
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select (instant at time zone 'Europe/Paris')::date;
$$;

comment on function public.day_paris(timestamptz) is
  'R-01 : jour calendaire de Paris de l''instant donné. Équivalent de dayParis (@crok/shared).';

-- Lundi (heure de Paris) de la semaine contenant l'instant (R-02).
-- date_trunc('week') sur un timestamp sans fuseau renvoie le lundi ISO : aucun changement
-- d'heure n'intervient une fois l'instant converti en heure locale de Paris.
create function public.week_start(instant timestamptz)
returns date
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select date_trunc('week', instant at time zone 'Europe/Paris')::date;
$$;

comment on function public.week_start(timestamptz) is
  'R-02 : lundi (heure de Paris) de la semaine de l''instant donné. Équivalent de weekStart (@crok/shared).';
