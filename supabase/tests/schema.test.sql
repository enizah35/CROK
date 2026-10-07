-- Structure : tables de la §2, RLS partout, droits exacts par rôle, contraintes clés,
-- création du profil à l'inscription (R-19, R-32).
begin;
create extension if not exists pgtap with schema extensions;

select plan(84);

-- ---------------------------------------------------------------------------
-- Tables et RLS
-- ---------------------------------------------------------------------------

select tables_are(
  'public',
  array[
    'profiles', 'recipes', 'cook_sessions', 'dishes', 'xp_ledger', 'user_weeks', 'friendships',
    'blocks', 'reactions', 'challenges', 'user_badges', 'reports', 'events'
  ],
  'les 13 tables du modèle de données existent, et aucune autre'
);

select is(
  (
    select array_agg(c.relname::text order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  null,
  'RLS activée sur toutes les tables de public'
);

-- ---------------------------------------------------------------------------
-- anon : aucun droit sur aucune table (R-22 : rien de public)
-- ---------------------------------------------------------------------------

select table_privs_are('public', t, 'anon', array[]::text[], format('anon : aucun droit sur %s', t))
from unnest(array[
  'profiles', 'recipes', 'cook_sessions', 'dishes', 'xp_ledger', 'user_weeks', 'friendships',
  'blocks', 'reactions', 'challenges', 'user_badges', 'reports', 'events'
]) as t;

-- ---------------------------------------------------------------------------
-- authenticated : droits au niveau table (les droits par colonne sont testés ensuite)
-- ---------------------------------------------------------------------------

-- Lecture seule : écritures réservées aux RPC et à service_role (R-08, R-15).
select table_privs_are('public', t, 'authenticated', array['SELECT'], format('authenticated : lecture seule sur %s', t))
from unnest(array[
  'profiles', 'recipes', 'cook_sessions', 'dishes', 'xp_ledger', 'user_weeks', 'challenges',
  'user_badges', 'reports'
]) as t;

select table_privs_are('public', 'friendships', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated : friendships en lecture et suppression (R-21), pas en création');
select table_privs_are('public', 'blocks', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated : blocks en lecture et suppression (insertion par colonnes)');
select table_privs_are('public', 'reactions', 'authenticated', array['SELECT', 'DELETE'],
  'authenticated : reactions en lecture et suppression (insertion et modification par colonnes)');
select table_privs_are('public', 'events', 'authenticated', array[]::text[],
  'authenticated : events sans lecture (insertion par colonnes)');

-- ---------------------------------------------------------------------------
-- authenticated : droits par colonne
-- ---------------------------------------------------------------------------

-- profiles : seuls pseudo, avatar et rappel sont modifiables (R-32, R-28).
select column_privs_are('public', 'profiles', c, 'authenticated', array['SELECT', 'UPDATE'],
  format('profiles.%s modifiable par le client', c))
from unnest(array['pseudo', 'avatar_id', 'reminder_enabled', 'reminder_time']) as c;

select column_privs_are('public', 'profiles', c, 'authenticated', array['SELECT'],
  format('profiles.%s non modifiable par le client', c))
from unnest(array['id', 'friend_code', 'adult_confirmed_at', 'lifetime_xp', 'created_at']) as c;

-- cook_sessions : started_at, finished_at et recipe_version sont posés par le serveur (R-03).
select column_privs_are('public', 'cook_sessions', c, 'authenticated', array['SELECT'],
  format('cook_sessions.%s posé par le serveur', c))
from unnest(array['id', 'recipe_version', 'started_at', 'finished_at']) as c;

select column_privs_are('public', 'cook_sessions', 'user_id', 'authenticated', array['SELECT', 'INSERT'],
  'cook_sessions.user_id fourni à la création');
select column_privs_are('public', 'cook_sessions', 'recipe_id', 'authenticated', array['SELECT', 'INSERT'],
  'cook_sessions.recipe_id fourni à la création');
select column_privs_are('public', 'cook_sessions', 'servings', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'cook_sessions.servings modifiable (R-04)');
select column_privs_are('public', 'cook_sessions', 'status', 'authenticated', array['SELECT', 'UPDATE'],
  'cook_sessions.status modifiable (abandon, R-07), filtré par la RLS');

select column_privs_are('public', 'reactions', 'emoji', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'],
  'reactions.emoji modifiable (R-24)');
select column_privs_are('public', 'reactions', 'dish_id', 'authenticated', array['SELECT', 'INSERT'],
  'reactions.dish_id non modifiable');
select column_privs_are('public', 'reports', 'status', 'authenticated', array['SELECT'],
  'reports.status réservé à la modération');
select column_privs_are('public', 'events', 'created_at', 'authenticated', array[]::text[],
  'events.created_at posé par le serveur');

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------

select ok(
  (select prosecdef from pg_proc where oid = 'public.are_friends(uuid, uuid)'::regprocedure),
  'are_friends est security definer'
);
select function_privs_are('public', 'are_friends', array['uuid', 'uuid'], 'anon', array[]::text[],
  'anon ne peut pas appeler are_friends');
select function_privs_are('public', 'handle_new_user', array[]::text[], 'authenticated', array[]::text[],
  'authenticated ne peut pas appeler handle_new_user');
select function_privs_are('public', 'generate_friend_code', array[]::text[], 'authenticated', array[]::text[],
  'authenticated ne peut pas appeler generate_friend_code');
select ok(
  (select provolatile = 'i' from pg_proc where oid = 'public.week_start(timestamptz)'::regprocedure),
  'week_start est immutable (utilisable dans une contrainte)'
);

-- ---------------------------------------------------------------------------
-- Inscription : profil créé avec un code ami (R-19)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role)
select ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, format('u%s@test.local', i),
  'authenticated', 'authenticated'
from generate_series(1, 50) as i;

select is((select count(*)::integer from public.profiles), 50, 'un profil créé par inscription');
select is(
  (select count(*)::integer from public.profiles where friend_code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  50,
  'codes ami de 8 caractères sans 0, O, 1, I ni L'
);
select is((select count(distinct friend_code)::integer from public.profiles), 50, 'codes ami tous différents');
select is(
  (select count(*)::integer from public.profiles where pseudo is null and avatar_id is null
     and adult_confirmed_at is null and lifetime_xp = 0 and reminder_enabled
     and reminder_time = '19:00'),
  50,
  'profil vierge : pseudo, avatar et 18+ à l''onboarding, rappel à 19 h par défaut'
);

delete from auth.users where id = '00000000-0000-4000-8000-000000000050';
select is((select count(*)::integer from public.profiles), 49, 'supprimer l''utilisateur supprime le profil (R-33)');

-- ---------------------------------------------------------------------------
-- Contraintes clés
-- ---------------------------------------------------------------------------

update public.profiles set pseudo = 'Hugo' where id = '00000000-0000-4000-8000-000000000001';
select throws_ok(
  $$update public.profiles set pseudo = 'hugo' where id = '00000000-0000-4000-8000-000000000002'$$,
  '23505', null, 'pseudo unique sans tenir compte de la casse (R-32)'
);
select throws_ok(
  $$update public.profiles set pseudo = 'ab' where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'pseudo de 3 caractères minimum'
);
select throws_ok(
  $$update public.profiles set pseudo = repeat('a', 21) where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'pseudo de 20 caractères maximum'
);
select throws_ok(
  $$update public.profiles set avatar_id = 13 where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'avatar parmi 12'
);
select throws_ok(
  $$update public.profiles set friend_code = 'ABCDEFG0' where id = '00000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'code ami sans caractère ambigu'
);

insert into public.recipes (id, slug, title, servings_base, total_min, active_min, cost_cents_per_serving, published)
values ('10000000-0000-4000-8000-000000000001', 'pates-pesto', 'Pâtes au pesto', 2, 20, 15, 150, true);

select throws_ok(
  $$insert into public.recipes (slug, title, servings_base, total_min, active_min, cost_cents_per_serving)
    values ('pates-pesto', 'Doublon', 2, 20, 15, 150)$$,
  '23505', null, 'slug de recette unique'
);

-- cook_sessions : une seule en cours ; en lancer une autre abandonne la précédente (R-03).
insert into public.cook_sessions (id, user_id, recipe_id, servings, started_at, status)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 2, '2020-01-01', 'terminee');

select is(
  (select row(status, started_at = now(), recipe_version)::text from public.cook_sessions
   where id = '20000000-0000-4000-8000-000000000001'),
  row('en_cours'::public.cook_session_status, true, 1)::text,
  'statut, started_at et version de recette posés par le serveur à la création (R-03)'
);

insert into public.cook_sessions (id, user_id, recipe_id, servings)
values ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 4);

select is(
  (select status from public.cook_sessions where id = '20000000-0000-4000-8000-000000000001'),
  'abandonnee'::public.cook_session_status,
  'lancer une nouvelle session abandonne la précédente (R-03)'
);
select ok(
  (select finished_at is not null from public.cook_sessions where id = '20000000-0000-4000-8000-000000000001'),
  'la session abandonnée reçoit un finished_at'
);
select throws_ok(
  $$update public.cook_sessions set status = 'en_cours' where id = '20000000-0000-4000-8000-000000000001'$$,
  '23505', null, 'au plus une session en cours par utilisateur (index unique partiel)'
);
select throws_ok(
  $$insert into public.cook_sessions (user_id, recipe_id, servings)
    values ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 7)$$,
  '23514', null, 'portions de 1 à 6 (R-04)'
);

-- dishes
insert into public.dishes (id, user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/photo.jpg',
  repeat('a', 64), public.week_start(now()), public.day_paris(now()), true);

select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001/x/p.jpg',
      repeat('b', 64), public.week_start(now()), public.day_paris(now()), true)$$,
  '23505', null, 'une session donne au plus un plat (R-10)'
);
select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001/x/p.jpg',
      repeat('a', 64), public.week_start(now()), public.day_paris(now()), true)$$,
  '23505', null, 'photo déjà connue pour cet utilisateur refusée (R-12)'
);
select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001/x/p.jpg',
      repeat('c', 64), '2020-01-06', public.day_paris(now()), true)$$,
  '23514', null, 'week_start toujours dérivé de created_at (R-02)'
);
select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values ('00000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002/x/p.jpg',
      repeat('c', 64), public.week_start(now()), public.day_paris(now()), true)$$,
  '23514', null, 'la photo d''un plat est dans le dossier de son auteur'
);

-- xp_ledger
insert into public.xp_ledger (user_id, week_start, amount, reason, dish_id)
values ('00000000-0000-4000-8000-000000000001', public.week_start(now()), 100, 'dish',
  '30000000-0000-4000-8000-000000000001');

select throws_ok(
  $$insert into public.xp_ledger (user_id, week_start, amount, reason, dish_id)
    values ('00000000-0000-4000-8000-000000000001', public.week_start(now()), 100, 'dish',
      '30000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'un plat ne rapporte de l''XP qu''une fois'
);
select throws_ok(
  $$insert into public.xp_ledger (user_id, week_start, amount, reason)
    values ('00000000-0000-4000-8000-000000000001', public.week_start(now()), 100, 'dish')$$,
  '23514', null, 'une ligne d''XP « dish » référence un plat'
);

insert into public.challenges (id, week_start, title, badge_code)
values ('40000000-0000-4000-8000-000000000001', public.week_start(now()), 'Défi', 'badge-1');
insert into public.xp_ledger (user_id, week_start, amount, reason, challenge_id)
values ('00000000-0000-4000-8000-000000000001', public.week_start(now()), 50, 'challenge',
  '40000000-0000-4000-8000-000000000001');

select throws_ok(
  $$insert into public.xp_ledger (user_id, week_start, amount, reason, challenge_id)
    values ('00000000-0000-4000-8000-000000000001', public.week_start(now()), 50, 'challenge',
      '40000000-0000-4000-8000-000000000001')$$,
  '23505', null, 'bonus de défi une seule fois (R-14)'
);
select throws_ok(
  $$insert into public.challenges (week_start, title, badge_code) values ('2026-10-07', 'Mercredi', 'b')$$,
  '23514', null, 'un défi commence un lundi'
);

-- friendships, blocks
select throws_ok(
  $$insert into public.friendships (user_a, user_b)
    values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'amitié stockée une fois, user_a < user_b'
);
select throws_ok(
  $$insert into public.blocks (blocker_id, blocked_id)
    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'on ne se bloque pas soi-même'
);

insert into public.friendships (user_a, user_b)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002');
select ok(public.are_friends('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  'are_friends(a, b)');
select ok(public.are_friends('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001'),
  'are_friends est symétrique');
select ok(not public.are_friends('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003'),
  'are_friends faux entre inconnus');

insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001');
select ok(not public.are_friends('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  'bloquer supprime l''amitié (R-21)');

select * from finish();
rollback;
