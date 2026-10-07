-- RLS de chaque table et du bucket `dishes` (R-22), vue par Alice :
--   - Bob est son ami (cas « ami ») ;
--   - Carol est une inconnue (cas « inconnu »), mais l'amie de Bob : l'amitié n'est pas transitive ;
--   - Dave ne sert que de cible de blocage.
-- Plus les interdictions d'écriture (R-08, R-15) et les écritures autorisées.
begin;
create extension if not exists pgtap with schema extensions;

select plan(100);

-- ---------------------------------------------------------------------------
-- Données (en tant que postgres, sans RLS)
-- ---------------------------------------------------------------------------

-- Identifiants :
--   alice  00000000-0000-4000-8000-00000000000a     bob    …-00000000000b
--   carol  00000000-0000-4000-8000-00000000000c     dave   …-00000000000d
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'alice@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'carol@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000d', 'dave@test.local', 'authenticated', 'authenticated');

update public.profiles
set pseudo = case id
  when '00000000-0000-4000-8000-00000000000a' then 'alice'
  when '00000000-0000-4000-8000-00000000000b' then 'bob'
  when '00000000-0000-4000-8000-00000000000c' then 'carol'
  else 'dave' end;

insert into public.friendships (user_a, user_b)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000c');

insert into public.blocks (blocker_id, blocked_id)
values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000d'),
  ('00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000d'),
  ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000d');

-- Recettes : r1 publiée, r2 brouillon.
insert into public.recipes (id, slug, title, servings_base, total_min, active_min, cost_cents_per_serving, published)
values
  ('10000000-0000-4000-8000-000000000001', 'publiee', 'Publiée', 2, 20, 15, 150, true),
  ('10000000-0000-4000-8000-000000000002', 'brouillon', 'Brouillon', 2, 20, 15, 150, false);

-- Sessions (la nouvelle session d'Alice, créée plus bas, est désignée par « id <> …0a » :
-- la RLS limite déjà les lignes à celles d'Alice). Le trigger abandonne la précédente de Bob : sans importance ici).
insert into public.cook_sessions (id, user_id, recipe_id, servings)
values
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 2),
  ('20000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000001', 2);
update public.cook_sessions set status = 'terminee'
where id in ('20000000-0000-4000-8000-0000000000b2', '20000000-0000-4000-8000-00000000000c');

-- Plats : un par personne, plus un plat masqué de Bob (R-25).
insert into public.dishes (id, user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted, hidden)
select d.id::uuid, d.user_id::uuid, d.session_id::uuid, '10000000-0000-4000-8000-000000000001',
  d.user_id || '/' || d.session_id || '/photo.jpg', repeat(d.sha, 64),
  public.week_start(now()), public.day_paris(now()), true, d.hidden
from (values
  ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'a', false),
  ('30000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-0000000000b1', 'b', false),
  ('30000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-0000000000b2', 'c', true),
  ('30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', '20000000-0000-4000-8000-00000000000c', 'd', false)
) as d (id, user_id, session_id, sha, hidden);

insert into public.challenges (id, week_start, title, badge_code)
values ('40000000-0000-4000-8000-000000000001', public.week_start(now()), 'Défi pâtes', 'pates');

insert into public.xp_ledger (user_id, week_start, amount, reason, dish_id)
select user_id, week_start, 100, 'dish', id from public.dishes;

insert into public.user_weeks (user_id, week_start, dishes_count, xp)
select id, public.week_start(now()), 1, 100 from public.profiles;

insert into public.user_badges (user_id, challenge_id, badge_code)
select id, '40000000-0000-4000-8000-000000000001', 'pates' from public.profiles;

insert into public.reactions (dish_id, user_id, emoji)
values
  ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', 'yum'),
  ('30000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000000c', 'fire'),
  ('30000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000b', 'heart');

insert into public.reports (reporter_id, dish_id, reason)
values
  ('00000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000a', 'bob signale alice'),
  ('00000000-0000-4000-8000-00000000000c', '30000000-0000-4000-8000-0000000000b1', 'carol signale bob');

insert into public.events (user_id, name)
values
  ('00000000-0000-4000-8000-00000000000a', 'app_open'),
  ('00000000-0000-4000-8000-00000000000b', 'app_open'),
  ('00000000-0000-4000-8000-00000000000c', 'app_open');

-- Photos : celles des plats, plus un envoi en attente de validation dans chaque dossier.
insert into storage.objects (bucket_id, name, owner_id)
select 'dishes', photo_path, user_id::text from public.dishes
union all
select 'dishes', u || '/20000000-0000-4000-8000-000000000999/en-attente.jpg', u
from unnest(array[
  '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b',
  '00000000-0000-4000-8000-00000000000c'
]) as u;

-- ---------------------------------------------------------------------------
-- anon : rien n'est public (R-22)
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.profiles', '42501', null, 'anon : profiles illisible');
select throws_ok('select * from public.dishes', '42501', null, 'anon : dishes illisible');
select throws_ok('select * from public.recipes', '42501', null, 'anon : recipes illisible');
select is((select count(*)::integer from storage.objects where bucket_id = 'dishes'), 0,
  'anon : aucune photo');

reset role;

-- ---------------------------------------------------------------------------
-- Alice se connecte
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);

-- profiles ------------------------------------------------------------------
select is((select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 1,
  'profiles : son profil');
select is((select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 1,
  'profiles : ami visible');
select is((select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-00000000000c'), 0,
  'profiles : inconnue invisible (même amie d''un ami)');

select lives_ok(
  $$update public.profiles set pseudo = 'alice2', avatar_id = 3, reminder_enabled = false, reminder_time = '20:30'
    where id = '00000000-0000-4000-8000-00000000000a'$$,
  'profiles : pseudo, avatar et rappel modifiables'
);
select is((select pseudo from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'alice2',
  'profiles : modification enregistrée');
select throws_ok($$update public.profiles set lifetime_xp = 9999 where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'profiles : lifetime_xp interdit');
select throws_ok($$update public.profiles set friend_code = 'AAAAAAAA' where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'profiles : friend_code interdit');
select throws_ok($$update public.profiles set adult_confirmed_at = now() where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'profiles : adult_confirmed_at interdit');
update public.profiles set pseudo = 'pirate' where id = '00000000-0000-4000-8000-00000000000b';
select is((select pseudo from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 'bob',
  'profiles : le profil d''un ami n''est pas modifiable');
select throws_ok($$insert into public.profiles (id, friend_code) values (gen_random_uuid(), 'AAAAAAAA')$$,
  '42501', null, 'profiles : insertion interdite');
select throws_ok($$delete from public.profiles where id = '00000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'profiles : suppression interdite');

-- recipes -------------------------------------------------------------------
select is((select count(*)::integer from public.recipes where published), 1, 'recipes : publiée visible');
select is((select count(*)::integer from public.recipes where not published), 0, 'recipes : brouillon invisible');
select throws_ok($$insert into public.recipes (slug, title, servings_base, total_min, active_min, cost_cents_per_serving)
  values ('x', 'x', 1, 1, 1, 1)$$, '42501', null, 'recipes : insertion interdite');
select throws_ok($$update public.recipes set title = 'x'$$, '42501', null, 'recipes : modification interdite');
select throws_ok($$delete from public.recipes$$, '42501', null, 'recipes : suppression interdite');

-- challenges ----------------------------------------------------------------
select is((select count(*)::integer from public.challenges), 1, 'challenges : défi commun visible');
select throws_ok($$insert into public.challenges (week_start, title, badge_code) values ('2030-01-07', 'x', 'x')$$,
  '42501', null, 'challenges : insertion interdite');
select throws_ok($$update public.challenges set bonus_xp = 1000$$, '42501', null, 'challenges : modification interdite');

-- cook_sessions -------------------------------------------------------------
select is((select count(*)::integer from public.cook_sessions where user_id = '00000000-0000-4000-8000-00000000000a'), 1,
  'cook_sessions : les siennes');
select is((select count(*)::integer from public.cook_sessions where user_id = '00000000-0000-4000-8000-00000000000b'), 0,
  'cook_sessions : celles d''un ami invisibles');
select is((select count(*)::integer from public.cook_sessions where user_id = '00000000-0000-4000-8000-00000000000c'), 0,
  'cook_sessions : celles d''une inconnue invisibles');

select lives_ok(
  $$insert into public.cook_sessions (recipe_id, servings)
    values ('10000000-0000-4000-8000-000000000001', 3)$$,
  'cook_sessions : lancer une recette publiée (R-03)'
);
select is(
  (select array_agg(status::text order by status::text) from public.cook_sessions),
  array['abandonnee', 'en_cours'],
  'cook_sessions : la session précédente est abandonnée (R-03)'
);
select throws_ok(
  $$insert into public.cook_sessions (recipe_id, servings, started_at)
    values ('10000000-0000-4000-8000-000000000001', 2, now() - interval '1 hour')$$,
  '42501', null, 'cook_sessions : started_at imposé par le client interdit (R-03, R-09)'
);
select throws_ok(
  $$insert into public.cook_sessions (user_id, recipe_id, servings)
    values ('00000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-000000000001', 2)$$,
  '42501', null, 'cook_sessions : pas de session au nom d''un autre'
);
select throws_ok(
  $$insert into public.cook_sessions (recipe_id, servings) values ('10000000-0000-4000-8000-000000000002', 2)$$,
  'P0002', null, 'cook_sessions : pas de session sur une recette non publiée'
);
select lives_ok(
  $$update public.cook_sessions set servings = 5 where id <> '20000000-0000-4000-8000-00000000000a'$$,
  'cook_sessions : portions modifiables pendant la session (R-04)'
);
select throws_ok(
  $$update public.cook_sessions set status = 'terminee' where id <> '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'cook_sessions : seule la RPC valide une session (R-08)'
);
select throws_ok(
  $$update public.cook_sessions set finished_at = now() where id <> '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'cook_sessions : finished_at posé par le serveur'
);
select lives_ok(
  $$update public.cook_sessions set status = 'terminee_sans_photo' where id <> '20000000-0000-4000-8000-00000000000a'$$,
  'cook_sessions : « Passer » la photo (R-07)'
);
select ok(
  (select finished_at is not null from public.cook_sessions where id <> '20000000-0000-4000-8000-00000000000a'),
  'cook_sessions : finished_at posé à la clôture'
);
update public.cook_sessions set status = 'en_cours' where id <> '20000000-0000-4000-8000-00000000000a';
select is(
  (select status::text from public.cook_sessions where id <> '20000000-0000-4000-8000-00000000000a'),
  'terminee_sans_photo',
  'cook_sessions : une session close ne se rouvre pas'
);
update public.cook_sessions set status = 'abandonnee' where id = '20000000-0000-4000-8000-0000000000b1';
select throws_ok(
  $$delete from public.cook_sessions where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'cook_sessions : suppression interdite'
);

-- dishes --------------------------------------------------------------------
select is((select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-00000000000a'), 1,
  'dishes : les siens');
select is((select count(*)::integer from public.dishes where id = '30000000-0000-4000-8000-0000000000b1'), 1,
  'dishes : plat d''un ami visible');
select is((select count(*)::integer from public.dishes where id = '30000000-0000-4000-8000-0000000000b2'), 0,
  'dishes : plat masqué d''un ami invisible (R-25)');
select is((select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-00000000000c'), 0,
  'dishes : plat d''une inconnue invisible');
select throws_ok(
  $$insert into public.dishes (user_id, cook_session_id, recipe_id, photo_path, photo_sha256, week_start, day_paris, counted)
    values ('00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a',
      '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a/x/p.jpg',
      repeat('e', 64), public.week_start(now()), public.day_paris(now()), true)$$,
  '42501', null, 'dishes : insertion interdite (R-08)'
);
select throws_ok($$update public.dishes set counted = true$$, '42501', null, 'dishes : modification interdite');
select throws_ok($$update public.dishes set hidden = true where id = '30000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'dishes : masquage par RPC uniquement');
select throws_ok($$delete from public.dishes$$, '42501', null, 'dishes : suppression interdite');

-- xp_ledger -----------------------------------------------------------------
select is((select count(*)::integer from public.xp_ledger where user_id = '00000000-0000-4000-8000-00000000000a'), 1,
  'xp_ledger : le sien');
select is((select count(*)::integer from public.xp_ledger where user_id = '00000000-0000-4000-8000-00000000000b'), 0,
  'xp_ledger : celui d''un ami reste privé');
select is((select count(*)::integer from public.xp_ledger where user_id = '00000000-0000-4000-8000-00000000000c'), 0,
  'xp_ledger : celui d''une inconnue invisible');
select throws_ok(
  $$insert into public.xp_ledger (user_id, week_start, amount, reason, challenge_id)
    values ('00000000-0000-4000-8000-00000000000a', public.week_start(now()), 50, 'challenge',
      '40000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'xp_ledger : insertion interdite (R-15)'
);
select throws_ok($$update public.xp_ledger set amount = 1000$$, '42501', null, 'xp_ledger : modification interdite');
select throws_ok($$delete from public.xp_ledger$$, '42501', null, 'xp_ledger : suppression interdite');

-- user_weeks ----------------------------------------------------------------
select is((select count(*)::integer from public.user_weeks where user_id = '00000000-0000-4000-8000-00000000000a'), 1,
  'user_weeks : la sienne');
select is((select count(*)::integer from public.user_weeks where user_id = '00000000-0000-4000-8000-00000000000b'), 1,
  'user_weeks : celle d''un ami visible (classement, R-26)');
select is((select count(*)::integer from public.user_weeks where user_id = '00000000-0000-4000-8000-00000000000c'), 0,
  'user_weeks : celle d''une inconnue invisible');
select throws_ok(
  $$insert into public.user_weeks (user_id, week_start, dishes_count, xp)
    values ('00000000-0000-4000-8000-00000000000a', '2030-01-07', 3, 300)$$,
  '42501', null, 'user_weeks : insertion interdite'
);
select throws_ok($$update public.user_weeks set xp = 1000$$, '42501', null, 'user_weeks : modification interdite');

-- user_badges ---------------------------------------------------------------
select is((select count(*)::integer from public.user_badges where user_id = '00000000-0000-4000-8000-00000000000a'), 1,
  'user_badges : les siens');
select is((select count(*)::integer from public.user_badges where user_id = '00000000-0000-4000-8000-00000000000b'), 1,
  'user_badges : ceux d''un ami visibles');
select is((select count(*)::integer from public.user_badges where user_id = '00000000-0000-4000-8000-00000000000c'), 0,
  'user_badges : ceux d''une inconnue invisibles');
select throws_ok(
  $$insert into public.user_badges (user_id, challenge_id, badge_code)
    values ('00000000-0000-4000-8000-00000000000d', '40000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, 'user_badges : insertion interdite'
);

-- reactions -----------------------------------------------------------------
select is((select count(*)::integer from public.reactions where dish_id = '30000000-0000-4000-8000-00000000000a'), 1,
  'reactions : sur son plat');
select is((select count(*)::integer from public.reactions where dish_id = '30000000-0000-4000-8000-0000000000b1'), 1,
  'reactions : sur le plat d''un ami');
select is((select count(*)::integer from public.reactions where dish_id = '30000000-0000-4000-8000-00000000000c'), 0,
  'reactions : sur le plat d''une inconnue invisibles');
select lives_ok(
  $$insert into public.reactions (dish_id, emoji) values ('30000000-0000-4000-8000-0000000000b1', 'clap')$$,
  'reactions : réagir au plat d''un ami (R-24)'
);
select lives_ok(
  $$update public.reactions set emoji = 'laugh' where dish_id = '30000000-0000-4000-8000-0000000000b1'
    and user_id = '00000000-0000-4000-8000-00000000000a'$$,
  'reactions : changer sa réaction'
);
select throws_ok(
  $$insert into public.reactions (dish_id, emoji) values ('30000000-0000-4000-8000-0000000000b1', 'yum')$$,
  '23505', null, 'reactions : une seule réaction par plat (R-24)'
);
select throws_ok(
  $$insert into public.reactions (dish_id, emoji) values ('30000000-0000-4000-8000-00000000000c', 'yum')$$,
  '42501', null, 'reactions : impossible sur le plat d''une inconnue'
);
select throws_ok(
  $$insert into public.reactions (dish_id, emoji) values ('30000000-0000-4000-8000-0000000000b2', 'yum')$$,
  '42501', null, 'reactions : impossible sur un plat masqué'
);
select throws_ok(
  $$insert into public.reactions (dish_id, user_id, emoji)
    values ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000c', 'yum')$$,
  '42501', null, 'reactions : pas au nom d''un autre'
);
delete from public.reactions where dish_id = '30000000-0000-4000-8000-00000000000a';
select is((select count(*)::integer from public.reactions where dish_id = '30000000-0000-4000-8000-00000000000a'), 1,
  'reactions : impossible de retirer la réaction d''un autre');

-- reports -------------------------------------------------------------------
select is((select count(*)::integer from public.reports), 0,
  'reports : ceux d''un ami (sur ses plats) et d''une inconnue invisibles');
select lives_ok(
  $$insert into public.reports (dish_id, reason) values ('30000000-0000-4000-8000-0000000000b1', 'photo hors sujet')$$,
  'reports : signaler le plat d''un ami (R-25)'
);
select is((select count(*)::integer from public.reports), 1, 'reports : son signalement visible');
select throws_ok(
  $$insert into public.reports (dish_id) values ('30000000-0000-4000-8000-00000000000c')$$,
  '42501', null, 'reports : impossible sur le plat d''une inconnue'
);
select throws_ok(
  $$insert into public.reports (dish_id) values ('30000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'reports : impossible sur son propre plat'
);
select throws_ok($$update public.reports set status = 'dismissed'$$, '42501', null,
  'reports : statut réservé à la modération');

-- events --------------------------------------------------------------------
select throws_ok('select * from public.events', '42501', null, 'events : aucune lecture, même des siens');
select lives_ok($$insert into public.events (name, props) values ('dish_validated', '{"n": 1}')$$,
  'events : insertion en son nom');
select throws_ok(
  $$insert into public.events (user_id, name) values ('00000000-0000-4000-8000-00000000000b', 'app_open')$$,
  '42501', null, 'events : pas au nom d''un ami'
);
select throws_ok(
  $$insert into public.events (user_id, name) values ('00000000-0000-4000-8000-00000000000c', 'app_open')$$,
  '42501', null, 'events : pas au nom d''une inconnue'
);

-- Bucket dishes -------------------------------------------------------------
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and name like '00000000-0000-4000-8000-00000000000a/%'),
  2,
  'photos : les siennes, y compris l''envoi en attente de validation'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and name = '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-0000000000b1/photo.jpg'),
  1,
  'photos : celle du plat d''un ami'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and name = '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-0000000000b2/photo.jpg'),
  0,
  'photos : celle du plat masqué d''un ami invisible'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and name like '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-000000000999/%'),
  0,
  'photos : l''envoi non validé d''un ami invisible'
);
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and name like '00000000-0000-4000-8000-00000000000c/%'),
  0,
  'photos : aucune photo d''une inconnue'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('dishes', '00000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-0000000000a2/photo.jpg',
      '00000000-0000-4000-8000-00000000000a')$$,
  'photos : envoi dans son dossier'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('dishes', '00000000-0000-4000-8000-00000000000b/20000000-0000-4000-8000-0000000000b1/faux.jpg',
      '00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'photos : envoi dans le dossier d''un ami interdit'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('dishes', 'photo.jpg', '00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'photos : envoi hors de son dossier interdit'
);
update storage.objects set metadata = '{"remplacee": true}'
where bucket_id = 'dishes' and name like '00000000-0000-4000-8000-00000000000a/%';
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'dishes' and metadata ? 'remplacee'),
  0,
  'photos : impossible de remplacer une photo après coup'
);

-- friendships et blocks -----------------------------------------------------
select is((select count(*)::integer from public.friendships), 1,
  'friendships : seulement les siennes (pas celle entre son ami et une inconnue)');
select throws_ok(
  $$insert into public.friendships (user_a, user_b)
    values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000c')$$,
  '42501', null, 'friendships : création directe interdite (code ami par RPC, R-20)'
);
select is((select count(*)::integer from public.blocks), 1,
  'blocks : seulement les siens (ni ceux d''un ami, ni ceux d''une inconnue)');
select throws_ok(
  $$insert into public.blocks (blocker_id, blocked_id)
    values ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000a')$$,
  '42501', null, 'blocks : pas de blocage au nom d''un autre'
);

-- Bloquer son ami supprime l'amitié : ses plats, profil et photos disparaissent (R-21, R-22).
select lives_ok(
  $$insert into public.blocks (blocked_id) values ('00000000-0000-4000-8000-00000000000b')$$,
  'blocks : bloquer un ami'
);
select is((select count(*)::integer from public.friendships), 0, 'blocks : l''amitié est supprimée (R-21)');
select is(
  (select count(*)::integer from public.dishes where user_id = '00000000-0000-4000-8000-00000000000b')
  + (select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-00000000000b')
  + (select count(*)::integer from storage.objects where name like '00000000-0000-4000-8000-00000000000b/%'),
  0,
  'blocks : plus rien de l''ancien ami n''est visible'
);

-- ---------------------------------------------------------------------------
-- Bob : retirer un ami (R-21)
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::integer from public.blocks), 1,
  'blocks : la personne bloquée ne voit pas le blocage (R-21)');
select lives_ok(
  $$delete from public.friendships where user_b = '00000000-0000-4000-8000-00000000000c'$$,
  'friendships : retirer un ami'
);
select is((select count(*)::integer from public.profiles where id = '00000000-0000-4000-8000-00000000000c'), 0,
  'friendships : l''ancien ami n''est plus visible');

reset role;

select * from finish();
rollback;
