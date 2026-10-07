-- Tâche 1.3 : règles serveur de validation, d'XP et de série (R-06, R-08 à R-18).
-- Le temps est simulé avec les variantes internes private.*_at (instant « maintenant »
-- injecté) et en posant started_at en tant que postgres. Les fonctions exposées
-- (public.*) sont testées à la fin, en tant qu'authenticated, avec le vrai now().
--
-- Utilisateurs (un par thème, pour que les cas ne se mélangent pas) :
--   A …a1 erreurs et session active        B …b1 l'autre utilisateur
--   C …c1 limites, idempotence, minuit, lundi   D …d1 changements d'heure
--   S …e1 série (semaines posées à la main)     W …f1 API exposée, droits du client
-- Recettes : r1 active 15 min (délai 6 min), r2 active 10 min (délai plancher 5 min),
--            r3 active 50 min (délai 20 min), r4 active 15 min.
begin;
create extension if not exists pgtap with schema extensions;

select plan(134);

-- ---------------------------------------------------------------------------
-- Données et aides (en tant que postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role)
select u.id::uuid, u.email, 'authenticated', 'authenticated'
from (values
  ('00000000-0000-4000-8000-0000000000a1', 'a@test.local'),
  ('00000000-0000-4000-8000-0000000000b1', 'b@test.local'),
  ('00000000-0000-4000-8000-0000000000c1', 'c@test.local'),
  ('00000000-0000-4000-8000-0000000000d1', 'd@test.local'),
  ('00000000-0000-4000-8000-0000000000e1', 'e@test.local'),
  ('00000000-0000-4000-8000-0000000000f1', 'f@test.local')
) as u (id, email);

insert into public.recipes (id, slug, title, servings_base, total_min, active_min, cost_cents_per_serving, published)
values
  ('10000000-0000-4000-8000-000000000001', 'r-un', 'Un', 2, 30, 15, 150, true),
  ('10000000-0000-4000-8000-000000000002', 'r-deux', 'Deux', 2, 20, 10, 150, true),
  ('10000000-0000-4000-8000-000000000003', 'r-trois', 'Trois', 2, 60, 50, 150, true),
  ('10000000-0000-4000-8000-000000000004', 'r-quatre', 'Quatre', 2, 30, 15, 150, true);

insert into storage.buckets (id, name, public) values ('autre', 'autre', false);

-- Sessions nommées et résultats nommés.
create temporary table s (k text primary key, id uuid not null);
create temporary table r (k text primary key, j jsonb);

-- Lance une session (comme le client : le trigger pose statut et version) puis la date.
create function pg_temp.sess(p_k text, p_user uuid, p_recipe uuid, p_started timestamptz)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.cook_sessions (user_id, recipe_id, servings)
  values (p_user, p_recipe, 2) returning id into v_id;
  update public.cook_sessions set started_at = p_started where id = v_id;
  insert into s values (p_k, v_id);
  return v_id;
end $$;

-- Dépose la photo de la session dans le bucket `dishes` (comme l'upload du client).
create function pg_temp.photo(p_user uuid, p_session uuid)
returns text language plpgsql as $$
declare v_path text := p_user || '/' || p_session || '/photo.jpg';
begin
  insert into storage.objects (bucket_id, name, owner_id) values ('dishes', v_path, p_user::text);
  return v_path;
end $$;

create function pg_temp.sha(p_n integer)
returns text language sql as $$ select encode(sha256(p_n::text::bytea), 'hex') $$;

-- Cuisine complète : session lancée 30 min avant p_at, photo envoyée, validation à p_at.
create function pg_temp.done(p_k text, p_user uuid, p_recipe uuid, p_at timestamptz, p_n integer)
returns jsonb language plpgsql as $$
declare v_s uuid; v_j jsonb;
begin
  v_s := pg_temp.sess(p_k, p_user, p_recipe, p_at - interval '30 minutes');
  v_j := private.complete_cook_session_at(p_user, v_s, pg_temp.photo(p_user, v_s), pg_temp.sha(p_n), p_at);
  insert into r values (p_k, v_j);
  return v_j;
end $$;

create function pg_temp.j(p_k text) returns jsonb language sql as $$ select j from r where k = p_k $$;
create function pg_temp.sid(p_k text) returns uuid language sql as $$ select id from s where k = p_k $$;

-- ---------------------------------------------------------------------------
-- Droits sur les fonctions
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.get_active_cook_session()', 'execute'),
  'authenticated peut appeler get_active_cook_session');
select ok(has_function_privilege('authenticated', 'public.complete_cook_session(uuid, text, text)', 'execute'),
  'authenticated peut appeler complete_cook_session');
select ok(has_function_privilege('authenticated', 'public.get_my_progress()', 'execute'),
  'authenticated peut appeler get_my_progress');
select ok(not has_function_privilege('anon', 'public.get_active_cook_session()', 'execute'),
  'anon ne peut pas appeler get_active_cook_session');
select ok(not has_function_privilege('anon', 'public.complete_cook_session(uuid, text, text)', 'execute'),
  'anon ne peut pas appeler complete_cook_session');
select ok(not has_function_privilege('anon', 'public.get_my_progress()', 'execute'),
  'anon ne peut pas appeler get_my_progress');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'),
  'schéma private inaccessible à authenticated');
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'schéma private inaccessible à anon');
select ok(not has_function_privilege('authenticated',
  'private.complete_cook_session_at(uuid, uuid, text, text, timestamptz)', 'execute'),
  'variante interne de validation non exposée (instant injectable)');
select ok(not has_function_privilege('authenticated', 'private.streak_for(uuid, timestamptz)', 'execute'),
  'streak_for non exposée');
select ok(not has_function_privilege('authenticated', 'private.get_my_progress_at(uuid, timestamptz)', 'execute'),
  'get_my_progress_at non exposée');
select ok(not has_function_privilege('authenticated', 'private.get_active_cook_session_at(uuid, timestamptz)', 'execute'),
  'get_active_cook_session_at non exposée');

select is(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.complete_cook_session(uuid, text, text)'::regprocedure),
  true, 'complete_cook_session : security definer, search_path vide'
);

-- R-08 : `terminee` n'est écrit que par la validation. Aucune autre fonction de public ou
-- private ne contient ce statut ; le client ne peut pas l'écrire (testé plus bas et dans
-- rls.test.sql) ; le trigger d'insertion force `en_cours`.
select is(
  (select array_agg(p.oid::regprocedure::text order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private') and p.prosrc like '%''terminee''%'),
  array['private.complete_cook_session_at(uuid,uuid,text,text,timestamp with time zone)'],
  'R-08 : seule complete_cook_session_at fait passer une session à terminee'
);

-- ---------------------------------------------------------------------------
-- R-06 : session active (utilisateur A)
-- ---------------------------------------------------------------------------

select is(private.get_active_cook_session_at('00000000-0000-4000-8000-0000000000a1', '2026-10-07 12:00 Europe/Paris'),
  null, 'R-06 : aucune session en cours → null');

select pg_temp.sess('act', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001',
  '2026-10-07 06:00:01 Europe/Paris');
insert into r values ('act', private.get_active_cook_session_at('00000000-0000-4000-8000-0000000000a1', '2026-10-07 12:00 Europe/Paris'));

select is((pg_temp.j('act') ->> 'id')::uuid, pg_temp.sid('act'), 'R-06 : session de 5 h 59 renvoyée');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.j('act')) as k),
  array['id', 'recipe_id', 'recipe_version', 'server_now', 'servings', 'started_at'],
  'R-06 : forme {id, recipe_id, recipe_version, servings, started_at, server_now}'
);
select is((pg_temp.j('act') ->> 'recipe_id')::uuid, '10000000-0000-4000-8000-000000000001'::uuid, 'R-06 : recipe_id');
select is((pg_temp.j('act') ->> 'recipe_version')::integer, 1, 'R-06 : recipe_version');
select is((pg_temp.j('act') ->> 'servings')::integer, 2, 'R-06 : servings');
select is((pg_temp.j('act') ->> 'started_at')::timestamptz, '2026-10-07 06:00:01 Europe/Paris'::timestamptz, 'R-06 : started_at');
select is((pg_temp.j('act') ->> 'server_now')::timestamptz, '2026-10-07 12:00 Europe/Paris'::timestamptz, 'R-06 : server_now');

select is(private.get_active_cook_session_at('00000000-0000-4000-8000-0000000000a1', '2026-10-07 12:00:01 Europe/Paris'),
  null, 'R-06 : session de 6 h exactement → null');
select is((select status::text from public.cook_sessions where id = pg_temp.sid('act')), 'abandonnee',
  'R-06 : session de 6 h passée en abandonnee');
select isnt((select finished_at from public.cook_sessions where id = pg_temp.sid('act')), null,
  'R-06 : finished_at posé à l''abandon');

-- ---------------------------------------------------------------------------
-- R-09, R-10, R-12 : erreurs (utilisateur A, mercredi 7 octobre 2026)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1',
    '20000000-0000-4000-8000-000000000999', '00000000-0000-4000-8000-0000000000a1/x/p.jpg',
    pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  'P0002', 'session_not_found', 'session inconnue → session_not_found'
);

-- Session en cours de A, lancée à 12:00, avec sa photo.
select pg_temp.sess('a1', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001',
  '2026-10-07 12:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'));

select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000b1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/photo.jpg',
    pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  'P0002', 'session_not_found', 'R-09 : B ne peut pas valider la session de A'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000b1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000b1/' || pg_temp.sid('a1') || '/photo.jpg',
    pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  'P0002', 'session_not_found', 'R-09 : ni avec un chemin dans son propre dossier'
);

-- Chemins de photo (R-09)
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000b1/' || pg_temp.sid('a1') || '/photo.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : photo dans le dossier d''un autre → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/20000000-0000-4000-8000-000000000999/photo.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : photo rangée sous une autre session → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : dossier sans nom de fichier → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/../../b/photo.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : chemin avec .. → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    'photo.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : nom nu → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    null, pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_path', 'R-09 : chemin nul → invalid_photo_path'
);
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/photo.jpg', 'pas-une-empreinte', '2026-10-07 13:00 Europe/Paris')$$,
  '22023', 'invalid_photo_sha256', 'R-12 : empreinte mal formée → invalid_photo_sha256'
);

-- Photo absente (R-09)
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/autre.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  'P0002', 'photo_missing', 'R-09 : photo jamais envoyée → photo_missing'
);
insert into storage.objects (bucket_id, name, owner_id)
values ('autre', '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/ailleurs.jpg', '00000000-0000-4000-8000-0000000000a1');
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/ailleurs.jpg', pg_temp.sha(1), '2026-10-07 13:00 Europe/Paris')$$,
  'P0002', 'photo_missing', 'R-09 : photo dans un autre bucket → photo_missing'
);

-- Délai minimal (R-09) : r1 active 15 min → max(5 min, 6 min) = 6 min.
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/photo.jpg', pg_temp.sha(1), '2026-10-07 12:05:59 Europe/Paris')$$,
  '55000', 'too_early', 'R-09 : 5 min 59 s pour r1 (délai 40 % = 6 min) → too_early'
);
select is((select status::text from public.cook_sessions where id = pg_temp.sid('a1')), 'en_cours',
  'une erreur ne change pas la session');
select is((select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-0000000000a1'), 0,
  'une erreur ne crée aucun plat');
select lives_ok(
  $$insert into r values ('a1', private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a1'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a1') || '/photo.jpg', upper(pg_temp.sha(1)), '2026-10-07 12:06 Europe/Paris'))$$,
  'R-09 : 6 min exactement pour r1 → plat validé (empreinte en majuscules acceptée)'
);
select is((select photo_sha256 from public.dishes where cook_session_id = pg_temp.sid('a1')), pg_temp.sha(1),
  'R-12 : empreinte enregistrée en minuscules');

-- Délai plancher : r2 active 10 min → 40 % = 4 min, plancher 5 min.
select pg_temp.sess('a2', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000002',
  '2026-10-08 12:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a2'));
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a2'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a2') || '/photo.jpg', pg_temp.sha(2), '2026-10-08 12:04:59 Europe/Paris')$$,
  '55000', 'too_early', 'R-09 : 4 min 59 s pour r2 (plancher 5 min) → too_early'
);

-- R-12 : même photo qu'un plat précédent de A → doublon (l'empreinte est contrôlée après
-- le délai, d'où l'instant 5 min après le lancement).
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a2'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a2') || '/photo.jpg', pg_temp.sha(1), '2026-10-08 12:05 Europe/Paris')$$,
  '23505', 'duplicate_photo', 'R-12 : empreinte déjà connue pour A → duplicate_photo'
);
select lives_ok(
  $$insert into r values ('a2', private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a2'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a2') || '/photo.jpg', pg_temp.sha(2), '2026-10-08 12:05 Europe/Paris'))$$,
  'R-09 : 5 min exactement pour r2 → plat validé'
);

-- Délai proportionnel : r3 active 50 min → 20 min.
select pg_temp.sess('a3', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000003',
  '2026-10-08 14:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a3'));
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a3'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a3') || '/photo.jpg', pg_temp.sha(3), '2026-10-08 14:19:59 Europe/Paris')$$,
  '55000', 'too_early', 'R-09 : 19 min 59 s pour r3 (40 % de 50 min) → too_early'
);
select lives_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a3'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a3') || '/photo.jpg', pg_temp.sha(3), '2026-10-08 14:20 Europe/Paris')$$,
  'R-09 : 20 min pour r3 → plat validé'
);

-- R-12 : la même photo chez un autre utilisateur n'est pas un doublon.
select is(
  (pg_temp.done('b1', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001',
    '2026-10-08 20:00 Europe/Paris', 1) ->> 'counted')::boolean,
  true, 'R-12 : empreinte de A acceptée chez B'
);

-- Session qui n'est plus en cours.
select pg_temp.sess('a4', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000004',
  '2026-10-09 12:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a4'));
update public.cook_sessions set status = 'abandonnee' where id = pg_temp.sid('a4');
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a4'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a4') || '/photo.jpg', pg_temp.sha(4), '2026-10-09 12:30 Europe/Paris')$$,
  '55000', 'session_not_running', 'session abandonnee → session_not_running'
);
select pg_temp.sess('a5', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000004',
  '2026-10-09 13:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a5'));
update public.cook_sessions set status = 'terminee_sans_photo' where id = pg_temp.sid('a5');
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a5'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a5') || '/photo.jpg', pg_temp.sha(5), '2026-10-09 13:30 Europe/Paris')$$,
  '55000', 'session_not_running', 'R-07 : session terminee_sans_photo → session_not_running'
);

-- Session expirée (R-06, R-09) : 6 h exactement.
select pg_temp.sess('a6', '00000000-0000-4000-8000-0000000000a1', '10000000-0000-4000-8000-000000000004',
  '2026-10-09 14:00 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a6'));
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a6'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a6') || '/photo.jpg', pg_temp.sha(6), '2026-10-09 20:00 Europe/Paris')$$,
  '55000', 'session_expired', 'R-09 : session de 6 h → session_expired'
);
select is(private.get_active_cook_session_at('00000000-0000-4000-8000-0000000000a1', '2026-10-09 20:00 Europe/Paris'),
  null, 'R-06 : la session expirée n''est plus reprenable');
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a1', pg_temp.sid('a6'),
    '00000000-0000-4000-8000-0000000000a1/' || pg_temp.sid('a6') || '/photo.jpg', pg_temp.sha(6), '2026-10-09 19:59 Europe/Paris')$$,
  '55000', 'session_not_running', 'R-06 : une fois abandonnée, elle ne se valide plus'
);
select is((select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-0000000000a1'), 3,
  'A : seuls les 3 plats valides existent');

-- ---------------------------------------------------------------------------
-- R-10 à R-16, R-18 : un plat après l'autre (utilisateur C, semaine du 12 octobre 2026)
-- ---------------------------------------------------------------------------

-- 1. Mercredi 14, 12:00, r1 : compté.
select pg_temp.done('c1', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001',
  '2026-10-14 12:00 Europe/Paris', 101);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(pg_temp.j('c1')) as k),
  array['already_completed', 'counted', 'dish_id', 'goal_reached', 'lifetime_xp',
        'not_counted_reason', 'streak', 'week_dishes_count', 'week_start', 'xp_awarded'],
  'forme du résultat de complete_cook_session'
);
select is(pg_temp.j('c1') - 'dish_id',
  '{"counted": true, "xp_awarded": 100, "week_start": "2026-10-12", "week_dishes_count": 1,
    "goal_reached": false, "streak": 0, "lifetime_xp": 100, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'R-13 : premier plat compté, 100 XP');
select is((select status::text from public.cook_sessions where id = pg_temp.sid('c1')), 'terminee',
  'R-08 : session passée en terminee');
select isnt((select finished_at from public.cook_sessions where id = pg_temp.sid('c1')), null,
  'session terminee : finished_at posé');
select is(
  (select row(d.cook_session_id, d.recipe_id, d.day_paris, d.week_start, d.created_at)::text
   from public.dishes d where d.id = (pg_temp.j('c1') ->> 'dish_id')::uuid),
  row(pg_temp.sid('c1'), '10000000-0000-4000-8000-000000000001'::uuid, date '2026-10-14', date '2026-10-12',
      '2026-10-14 12:00 Europe/Paris'::timestamptz)::text,
  'plat : session, recette, jour et semaine de Paris'
);
select is(
  (select row(l.amount, l.reason, l.week_start)::text from public.xp_ledger l
   where l.dish_id = (pg_temp.j('c1') ->> 'dish_id')::uuid),
  row(100, 'dish'::public.xp_reason, date '2026-10-12')::text,
  'R-15 : 100 XP inscrits au registre'
);

-- 2. Répétition de l'appel (échec réseau) : même résultat, rien de plus.
insert into r values ('c1bis', private.complete_cook_session_at('00000000-0000-4000-8000-0000000000c1',
  pg_temp.sid('c1'), 'ignoré', 'ignorée', '2026-10-14 12:05 Europe/Paris'));
select is(pg_temp.j('c1bis'), pg_temp.j('c1') || '{"already_completed": true}',
  'R-10 : rappel idempotent, même résultat avec already_completed = true');
select is((select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-0000000000c1'), 1,
  'R-10 : pas de second plat');
select is((select count(*)::integer from public.xp_ledger where user_id = '00000000-0000-4000-8000-0000000000c1'), 1,
  'R-10 : pas de seconde XP');
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000b1', pg_temp.sid('c1'),
    'x', pg_temp.sha(1), '2026-10-14 12:05 Europe/Paris')$$,
  'P0002', 'session_not_found', 'rappel par un autre utilisateur → session_not_found'
);

-- 3. 13:00, r1 à nouveau : même recette le même jour → non compté.
select pg_temp.done('c2', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001',
  '2026-10-14 13:00 Europe/Paris', 102);
select is(pg_temp.j('c2') - 'dish_id',
  '{"counted": false, "xp_awarded": 0, "week_start": "2026-10-12", "week_dishes_count": 1,
    "goal_reached": false, "streak": 0, "lifetime_xp": 100, "already_completed": false,
    "not_counted_reason": "recipe_already_counted_today"}'::jsonb,
  'R-11 : même recette deux fois le même jour → plat publié, 0 XP (recipe_already_counted_today)');
select is((select count(*)::integer from public.xp_ledger where dish_id = (pg_temp.j('c2') ->> 'dish_id')::uuid), 0,
  'R-11 : aucune ligne d''XP pour un plat non compté');
select is(
  private.complete_cook_session_at('00000000-0000-4000-8000-0000000000c1', pg_temp.sid('c2'), 'x', 'y',
    '2026-10-14 13:10 Europe/Paris') - 'dish_id',
  (pg_temp.j('c2') - 'dish_id') || '{"already_completed": true}',
  'R-10 : rappel idempotent sur un plat non compté'
);

-- 4. 14:00, r2 : deuxième plat compté du jour.
select pg_temp.done('c3', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000002',
  '2026-10-14 14:00 Europe/Paris', 103);
select is(pg_temp.j('c3') - 'dish_id',
  '{"counted": true, "xp_awarded": 100, "week_start": "2026-10-12", "week_dishes_count": 2,
    "goal_reached": false, "streak": 0, "lifetime_xp": 200, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'R-11 : deuxième recette du jour comptée');

-- 5. 23:59:59, r4 : troisième plat du jour → non compté.
select pg_temp.done('c4', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000004',
  '2026-10-14 23:59:59 Europe/Paris', 104);
select is(pg_temp.j('c4') - 'dish_id',
  '{"counted": false, "xp_awarded": 0, "week_start": "2026-10-12", "week_dishes_count": 2,
    "goal_reached": false, "streak": 0, "lifetime_xp": 200, "already_completed": false,
    "not_counted_reason": "daily_limit"}'::jsonb,
  'R-11 : au-delà de 2 plats comptés par jour (23:59:59) → 0 XP (daily_limit)');
select is(
  (select day_paris from public.dishes where id = (pg_temp.j('c4') ->> 'dish_id')::uuid),
  date '2026-10-14', 'R-01 : 23:59:59 (21:59:59 UTC) appartient au mercredi');

-- 6. Jeudi 15 00:00:00, r1 : nouveau jour à minuit pile → compté ; 3e plat → semaine réussie.
select pg_temp.done('c5', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001',
  '2026-10-15 00:00 Europe/Paris', 105);
select is(pg_temp.j('c5') - 'dish_id',
  '{"counted": true, "xp_awarded": 100, "week_start": "2026-10-12", "week_dishes_count": 3,
    "goal_reached": true, "streak": 1, "lifetime_xp": 300, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'R-11, R-16, R-17 : minuit remet la limite du jour ; 3e plat → objectif atteint, série +1');
select is(
  (select goal_reached_at from public.user_weeks
   where user_id = '00000000-0000-4000-8000-0000000000c1' and week_start = '2026-10-12'),
  '2026-10-15 00:00 Europe/Paris'::timestamptz, 'R-16 : goal_reached_at posé au 3e plat compté');

-- 7. Jeudi 00:30, r2 : compté ; goal_reached_at ne bouge plus.
select pg_temp.done('c6', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000002',
  '2026-10-15 00:30 Europe/Paris', 106);
select is((pg_temp.j('c6') ->> 'week_dishes_count')::integer, 4, 'R-16 : 4e plat compté de la semaine');
select is(
  (select goal_reached_at from public.user_weeks
   where user_id = '00000000-0000-4000-8000-0000000000c1' and week_start = '2026-10-12'),
  '2026-10-15 00:00 Europe/Paris'::timestamptz, 'R-16 : goal_reached_at garde le premier instant');

-- 8. Dimanche 18 23:59:59, puis 9. lundi 19 00:00:00.
select pg_temp.done('c7', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001',
  '2026-10-18 23:59:59 Europe/Paris', 107);
select is((pg_temp.j('c7') ->> 'week_start'), '2026-10-12', 'R-02 : dimanche 23:59:59 dans la semaine du 12');
select is((pg_temp.j('c7') ->> 'week_dishes_count')::integer, 5, 'R-16 : 5 plats comptés dimanche soir');

select pg_temp.done('c8', '00000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-000000000001',
  '2026-10-19 00:00 Europe/Paris', 108);
select is(pg_temp.j('c8') - 'dish_id',
  '{"counted": true, "xp_awarded": 100, "week_start": "2026-10-19", "week_dishes_count": 1,
    "goal_reached": false, "streak": 1, "lifetime_xp": 600, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'R-18 : lundi 00:00 → nouvelle semaine, compteur à 1 ; R-17 : série 1 conservée');

-- Totaux (R-15) : 8 plats dont 6 comptés.
select is(
  (select row(dishes_count, xp)::text from public.user_weeks
   where user_id = '00000000-0000-4000-8000-0000000000c1' and week_start = '2026-10-12'),
  row(5, 500)::text, 'R-15 : user_weeks de la semaine du 12 = 5 plats, 500 XP');
select is(
  (select row(dishes_count, xp, goal_reached_at)::text from public.user_weeks
   where user_id = '00000000-0000-4000-8000-0000000000c1' and week_start = '2026-10-19'),
  row(1, 100, null::timestamptz)::text, 'R-15 : user_weeks de la semaine du 19 = 1 plat, 100 XP');
select is(
  (select lifetime_xp from public.profiles where id = '00000000-0000-4000-8000-0000000000c1'),
  (select sum(amount)::integer from public.xp_ledger where user_id = '00000000-0000-4000-8000-0000000000c1'),
  'R-15 : lifetime_xp = somme du registre');
select is(
  (select row(count(*), count(*) filter (where counted))::text from public.dishes
   where user_id = '00000000-0000-4000-8000-0000000000c1'),
  row(8, 6)::text, 'R-11 : 8 plats publiés, 6 comptés');

-- get_my_progress_at aux mêmes instants (R-16 à R-18)
select is(
  private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', '2026-10-14 20:00 Europe/Paris') - 'server_now',
  '{"lifetime_xp": 600, "week_start": "2026-10-12", "week_xp": 500, "week_dishes_count": 5, "goal": 3,
    "goal_reached": true, "streak": 1, "today_dishes_count": 4}'::jsonb,
  'progression mercredi 20:00 : 4 plats validés aujourd''hui (comptés ou non)');
select is(
  (select array_agg(k order by k)
   from jsonb_object_keys(private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', now())) as k),
  array['goal', 'goal_reached', 'lifetime_xp', 'server_now', 'streak', 'today_dishes_count',
        'week_dishes_count', 'week_start', 'week_xp'],
  'forme du résultat de get_my_progress'
);
select is(
  private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', '2026-10-18 23:59:59 Europe/Paris') - 'server_now',
  '{"lifetime_xp": 600, "week_start": "2026-10-12", "week_xp": 500, "week_dishes_count": 5, "goal": 3,
    "goal_reached": true, "streak": 1, "today_dishes_count": 1}'::jsonb,
  'progression dimanche 23:59:59');
select is(
  private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', '2026-10-19 00:00 Europe/Paris') - 'server_now',
  '{"lifetime_xp": 600, "week_start": "2026-10-19", "week_xp": 100, "week_dishes_count": 1, "goal": 3,
    "goal_reached": false, "streak": 1, "today_dishes_count": 1}'::jsonb,
  'R-18 : progression lundi 00:00, compteur de la nouvelle semaine');
select is(
  private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', '2026-10-26 00:00 Europe/Paris') - 'server_now',
  '{"lifetime_xp": 600, "week_start": "2026-10-26", "week_xp": 0, "week_dishes_count": 0, "goal": 3,
    "goal_reached": false, "streak": 0, "today_dishes_count": 0}'::jsonb,
  'R-17, R-18 : semaine du 19 non réussie → série à 0 le lundi suivant, compteur à 0');
select is(
  (private.get_my_progress_at('00000000-0000-4000-8000-0000000000c1', '2026-10-19 00:00 Europe/Paris') ->> 'server_now')::timestamptz,
  '2026-10-19 00:00 Europe/Paris'::timestamptz, 'server_now = instant du serveur');

-- ---------------------------------------------------------------------------
-- R-01, R-06 : changements d'heure (utilisateur D)
-- ---------------------------------------------------------------------------

-- Dimanche 25 octobre 2026 : 03:00 CEST → 02:00 CET. Session lancée à 00:30 (22:30 UTC la
-- veille) : à 05:29 (04:29 UTC) il s'est écoulé 5 h 59 réelles, même si l'horloge murale
-- n'indique que 4 h 59.
select pg_temp.sess('d1', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000001',
  '2026-10-25 00:30 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000d1', pg_temp.sid('d1'));
select throws_ok(
  $$select private.complete_cook_session_at('00000000-0000-4000-8000-0000000000d1', pg_temp.sid('d1'),
    '00000000-0000-4000-8000-0000000000d1/' || pg_temp.sid('d1') || '/photo.jpg', pg_temp.sha(201), '2026-10-25 05:30 Europe/Paris')$$,
  '55000', 'session_expired', 'R-06 : 6 h réelles à 05:30 le jour du passage à l''heure d''hiver → session_expired'
);
select is(
  (private.complete_cook_session_at('00000000-0000-4000-8000-0000000000d1', pg_temp.sid('d1'),
    '00000000-0000-4000-8000-0000000000d1/' || pg_temp.sid('d1') || '/photo.jpg', pg_temp.sha(201),
    '2026-10-25 05:29 Europe/Paris') ->> 'counted')::boolean,
  true, 'R-06 : 5 h 59 réelles (4 h 59 à l''horloge) → validé');

select pg_temp.done('d2', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000002',
  '2026-10-25 23:30 Europe/Paris', 202);
select is(
  (select row(day_paris, week_start)::text from public.dishes where id = (pg_temp.j('d2') ->> 'dish_id')::uuid),
  row(date '2026-10-25', date '2026-10-19')::text, 'R-01 : dimanche 23:30 CET (22:30 UTC) → dimanche, semaine du 19');
select is((pg_temp.j('d2') ->> 'counted')::boolean, true, 'deuxième plat compté du dimanche');

select pg_temp.done('d3', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000004',
  '2026-10-26 00:10 Europe/Paris', 203);
select is(
  (select row(day_paris, week_start)::text from public.dishes where id = (pg_temp.j('d3') ->> 'dish_id')::uuid),
  row(date '2026-10-26', date '2026-10-26')::text, 'R-01 : lundi 00:10 CET (dimanche 23:10 UTC) → lundi, nouvelle semaine');
select is(pg_temp.j('d3') - 'dish_id',
  '{"counted": true, "xp_awarded": 100, "week_start": "2026-10-26", "week_dishes_count": 1,
    "goal_reached": false, "streak": 0, "lifetime_xp": 300, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'R-11, R-18 : après le changement d''heure, nouveau jour et nouvelle semaine');

-- Dimanche 28 mars 2027 : 02:00 CET → 03:00 CEST. Session lancée à 00:30 (23:30 UTC la
-- veille) : à 07:00 (05:00 UTC) il ne s'est écoulé que 5 h 30, l'horloge indique 6 h 30.
select pg_temp.sess('d4', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000001',
  '2027-03-28 00:30 Europe/Paris');
select pg_temp.photo('00000000-0000-4000-8000-0000000000d1', pg_temp.sid('d4'));
select is(
  (private.complete_cook_session_at('00000000-0000-4000-8000-0000000000d1', pg_temp.sid('d4'),
    '00000000-0000-4000-8000-0000000000d1/' || pg_temp.sid('d4') || '/photo.jpg', pg_temp.sha(204),
    '2027-03-28 07:00 Europe/Paris') ->> 'week_start'),
  '2027-03-22', 'R-06 : 5 h 30 réelles (6 h 30 à l''horloge) le jour du passage à l''heure d''été → validé');
select pg_temp.done('d5', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000002',
  '2027-03-28 23:59 Europe/Paris', 205);
select pg_temp.done('d6', '00000000-0000-4000-8000-0000000000d1', '10000000-0000-4000-8000-000000000004',
  '2027-03-29 00:00 Europe/Paris', 206);
select is(
  (select array_agg(row(day_paris, week_start, counted)::text order by created_at) from public.dishes
   where id in ((pg_temp.j('d5') ->> 'dish_id')::uuid, (pg_temp.j('d6') ->> 'dish_id')::uuid)),
  array[row(date '2027-03-28', date '2027-03-22', true)::text, row(date '2027-03-29', date '2027-03-29', true)::text],
  'R-01 : dimanche 23:59 CEST puis lundi 00:00 CEST → jours et semaines distincts, tous deux comptés'
);

-- ---------------------------------------------------------------------------
-- R-17 : série (utilisateur S, semaines posées directement)
-- ---------------------------------------------------------------------------

select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 0,
  'R-17 : aucune semaine → série 0');

insert into public.user_weeks (user_id, week_start, dishes_count, xp)
values
  ('00000000-0000-4000-8000-0000000000e1', '2026-10-12', 3, 300),
  ('00000000-0000-4000-8000-0000000000e1', '2026-10-19', 4, 400),
  ('00000000-0000-4000-8000-0000000000e1', '2026-10-26', 3, 300),
  ('00000000-0000-4000-8000-0000000000e1', '2026-11-02', 1, 100);

select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 3,
  'R-17 : semaine en cours non réussie (1/3) → la série de 3 tient');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-08 23:59:59 Europe/Paris'), 3,
  'R-17 : dimanche 23:59:59, la semaine en cours ne casse toujours pas la série');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-09 00:00 Europe/Paris'), 0,
  'R-17 : lundi 00:00, la semaine précédente non réussie remet la série à 0');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-10-28 12:00 Europe/Paris'), 3,
  'R-17 : semaine en cours déjà réussie → +1 (2 + 1)');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-10-12 00:00 Europe/Paris'), 1,
  'R-17 : première semaine réussie → 1');

update public.user_weeks set dishes_count = 3, xp = 300
where user_id = '00000000-0000-4000-8000-0000000000e1' and week_start = '2026-11-02';
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 4,
  'R-17 : la semaine en cours devient réussie → +1');

-- Un trou d'une semaine (5 octobre absente, puis à 2/3) arrête le décompte.
insert into public.user_weeks (user_id, week_start, dishes_count, xp)
values ('00000000-0000-4000-8000-0000000000e1', '2026-09-28', 3, 300);
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 4,
  'R-17 : semaine du 5 octobre absente → le 28 septembre ne compte pas');
insert into public.user_weeks (user_id, week_start, dishes_count, xp)
values ('00000000-0000-4000-8000-0000000000e1', '2026-10-05', 2, 200);
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 4,
  'R-16, R-17 : semaine à 2/3 → trou, série inchangée');
update public.user_weeks set dishes_count = 3, xp = 300
where user_id = '00000000-0000-4000-8000-0000000000e1' and week_start = '2026-10-05';
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris'), 6,
  'R-17 : trou comblé → 6 semaines consécutives');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1', '2026-11-16 09:00 Europe/Paris'), 0,
  'R-17 : deux semaines sans plat → série 0');
select is(private.streak_for('00000000-0000-4000-8000-0000000000e1'),
  private.streak_for('00000000-0000-4000-8000-0000000000e1', now()), 'R-17 : p_at vaut now() par défaut');
select is(
  (private.get_my_progress_at('00000000-0000-4000-8000-0000000000e1', '2026-11-04 12:00 Europe/Paris') ->> 'streak')::integer,
  6, 'get_my_progress utilise streak_for');

-- ---------------------------------------------------------------------------
-- API exposée, avec le vrai now() (utilisateur W)
-- ---------------------------------------------------------------------------

-- Session de W lancée il y a 1 h, photo envoyée ; session en cours de B (cible).
select pg_temp.sess('w1', '00000000-0000-4000-8000-0000000000f1', '10000000-0000-4000-8000-000000000001',
  now() - interval '1 hour');
select pg_temp.photo('00000000-0000-4000-8000-0000000000f1', pg_temp.sid('w1'));
select pg_temp.sess('bw', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000001',
  now() - interval '1 hour');
select pg_temp.photo('00000000-0000-4000-8000-0000000000b1', pg_temp.sid('bw'));
-- Les identifiants sont copiés dans un réglage local : pg_temp n'est pas lisible par authenticated.
select set_config('test.w1', pg_temp.sid('w1')::text, true);
select set_config('test.bw', pg_temp.sid('bw')::text, true);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select public.get_active_cook_session()$$, '42501', null, 'anon : get_active_cook_session refusée');
select throws_ok($$select public.complete_cook_session(gen_random_uuid(), 'x', 'y')$$, '42501', null,
  'anon : complete_cook_session refusée');
select throws_ok($$select public.get_my_progress()$$, '42501', null, 'anon : get_my_progress refusée');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);

select is((public.get_active_cook_session() ->> 'id'), current_setting('test.w1'), 'get_active_cook_session : session de W');
select is(public.get_my_progress() - 'server_now' - 'week_start',
  '{"lifetime_xp": 0, "week_xp": 0, "week_dishes_count": 0, "goal": 3, "goal_reached": false,
    "streak": 0, "today_dishes_count": 0}'::jsonb, 'get_my_progress : tout à 0 au départ');
select is((public.get_my_progress() ->> 'week_start')::date, public.week_start(now()), 'get_my_progress : semaine de Paris');

select throws_ok(
  format($$select public.complete_cook_session(%L, %L, %L)$$, current_setting('test.bw'),
    '00000000-0000-4000-8000-0000000000b1/' || current_setting('test.bw') || '/photo.jpg', repeat('e', 64)),
  'P0002', 'session_not_found', 'W ne peut pas valider la session de B');
select is(
  (select status::text from public.cook_sessions where id = current_setting('test.bw')::uuid), null,
  'la session de B reste invisible pour W');

select is(
  public.complete_cook_session(current_setting('test.w1')::uuid,
    '00000000-0000-4000-8000-0000000000f1/' || current_setting('test.w1') || '/photo.jpg', repeat('f', 64))
    - 'dish_id' - 'week_start',
  '{"counted": true, "xp_awarded": 100, "week_dishes_count": 1, "goal_reached": false, "streak": 0,
    "lifetime_xp": 100, "already_completed": false,
    "not_counted_reason": null}'::jsonb,
  'complete_cook_session : plat compté pour W');
select is(
  (public.complete_cook_session(current_setting('test.w1')::uuid,
    '00000000-0000-4000-8000-0000000000f1/' || current_setting('test.w1') || '/photo.jpg', repeat('f', 64))
    ->> 'already_completed')::boolean,
  true, 'complete_cook_session : rappel idempotent');
select is(public.get_my_progress() - 'server_now' - 'week_start',
  '{"lifetime_xp": 100, "week_xp": 100, "week_dishes_count": 1, "goal": 3, "goal_reached": false,
    "streak": 0, "today_dishes_count": 1}'::jsonb, 'get_my_progress après le plat');
select is(public.get_active_cook_session(), null, 'plus de session en cours après validation');
select is(
  (select row(status, finished_at is not null)::text from public.cook_sessions where id = current_setting('test.w1')::uuid),
  row('terminee'::public.cook_session_status, true)::text, 'session de W terminee');

-- Le client ne peut toujours pas écrire les résultats lui-même (R-08, R-15).
select throws_ok($$select private.complete_cook_session_at(auth.uid(), gen_random_uuid(), 'x', 'y', now() - interval '1 day')$$,
  '42501', null, 'authenticated : variante interne (instant injectable) refusée');
select throws_ok($$select private.streak_for(auth.uid())$$, '42501', null, 'authenticated : streak_for refusée');
select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values (auth.uid(), current_setting('test.w1')::uuid, '10000000-0000-4000-8000-000000000001',
      auth.uid() || '/x/p.jpg', repeat('1', 64), public.week_start(now()), public.day_paris(now()), true)$$,
  '42501', null, 'R-08 : le client ne crée pas de plat');
select throws_ok(
  $$insert into public.xp_ledger (user_id, week_start, amount, reason, dish_id)
    select auth.uid(), week_start, 100, 'dish', id from public.dishes where user_id = auth.uid()$$,
  '42501', null, 'R-15 : le client n''écrit pas dans xp_ledger');
select throws_ok(
  $$insert into public.user_weeks (user_id, week_start, dishes_count, xp) values (auth.uid(), '2026-01-05', 3, 300)$$,
  '42501', null, 'R-16 : le client n''écrit pas dans user_weeks');
select throws_ok($$update public.user_weeks set dishes_count = 3 where user_id = auth.uid()$$,
  '42501', null, 'R-16 : le client ne modifie pas user_weeks');
select throws_ok($$update public.dishes set counted = true where user_id = auth.uid()$$,
  '42501', null, 'R-11 : le client ne modifie pas counted');
select throws_ok($$update public.profiles set lifetime_xp = 100000 where id = auth.uid()$$,
  '42501', null, 'R-15 : le client ne modifie pas lifetime_xp');

-- R-08 : le client ne peut atteindre `terminee` ni par UPDATE ni par INSERT.
select lives_ok(
  $$insert into public.cook_sessions (recipe_id, servings) values ('10000000-0000-4000-8000-000000000004', 2)$$,
  'le client lance une session par INSERT');
select throws_ok(
  $$update public.cook_sessions set status = 'terminee' where user_id = auth.uid() and status = 'en_cours'$$,
  '42501', null, 'R-08 : le client ne passe pas sa session en terminee');
select throws_ok(
  $$insert into public.cook_sessions (recipe_id, servings, status) values ('10000000-0000-4000-8000-000000000004', 2, 'terminee')$$,
  '42501', null, 'R-08 : le client n''insère pas de session terminee');
select throws_ok(
  $$update public.cook_sessions set started_at = now() - interval '1 hour' where user_id = auth.uid()$$,
  '42501', null, 'R-09 : le client ne recule pas started_at');
select is(
  (select array_agg(status::text order by started_at) from public.cook_sessions where user_id = auth.uid()),
  array['terminee', 'en_cours'], 'sessions de W inchangées');

select * from finish();
rollback;
