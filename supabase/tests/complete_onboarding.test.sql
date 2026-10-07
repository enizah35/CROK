-- Tâche 0.4 : complete_onboarding et is_pseudo_available (R-32).
-- Lancer avec `supabase db test` (harnais pgTAP de la tâche 0.2).
-- Mêmes cas de pseudo que packages/shared/src/account.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Deux utilisateurs : le trigger de la tâche 0.2 crée leur profil vierge (avec friend_code),
-- que complete_onboarding complète.
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'lea@exemple.fr'),
  ('22222222-2222-2222-2222-222222222222', 'malik@exemple.fr');

-- L'erreur de course sur le pseudo est traduite d'après le nom de l'index unique de 0.2.
select has_index('public', 'profiles', 'profiles_pseudo_key', 'index unique du pseudo (0.2) présent');
select hasnt_index('public', 'profiles', 'profiles_pseudo_lower_key', 'pas d''index en double sur le pseudo');

-- Non connecté
set local role anon;
select throws_ok(
  $$select public.complete_onboarding('lea', 1)$$,
  '42501', null, 'anon ne peut pas appeler complete_onboarding'
);
select throws_ok(
  $$select public.is_pseudo_available('lea')$$,
  '42501', null, 'anon ne peut pas tester un pseudo'
);

-- Léa
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok($$select public.complete_onboarding('ab', 1)$$, '22023', 'invalid_pseudo', 'pseudo de 2 caractères refusé');
select throws_ok($$select public.complete_onboarding(repeat('a', 21), 1)$$, '22023', 'invalid_pseudo', 'pseudo de 21 caractères refusé');
select throws_ok($$select public.complete_onboarding('léa', 1)$$, '22023', 'invalid_pseudo', 'accent refusé');
select throws_ok($$select public.complete_onboarding('lea-marie', 1)$$, '22023', 'invalid_pseudo', 'tiret refusé');
select throws_ok($$select public.complete_onboarding('lea', 0)$$, '22023', 'invalid_avatar', 'avatar 0 refusé');
select throws_ok($$select public.complete_onboarding('lea', 13)$$, '22023', 'invalid_avatar', 'avatar 13 refusé');

select lives_ok($$select public.complete_onboarding('  Lea_2006 ', 3)$$, 'onboarding de Léa accepté');
select is(
  (select pseudo from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Lea_2006', 'pseudo enregistré sans espaces'
);
select isnt(
  (select adult_confirmed_at from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null, 'adult_confirmed_at posé par le serveur'
);
select ok(
  (select friend_code from public.profiles where id = '11111111-1111-1111-1111-111111111111') ~ '^[A-HJKMNP-Z2-9]{8}$',
  'code ami du trigger conservé'
);
select ok(public.is_pseudo_available('lea_2006'), 'son propre pseudo reste disponible pour soi');

-- Le client ne peut pas écrire adult_confirmed_at directement.
select throws_ok(
  $$update public.profiles set adult_confirmed_at = null where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'adult_confirmed_at non modifiable par le client'
);

-- Malik
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select ok(not public.is_pseudo_available('LEA_2006'), 'pseudo pris, casse ignorée');
select throws_ok($$select public.complete_onboarding('LEA_2006', 1)$$, '23505', 'pseudo_taken', 'pseudo en double refusé');
select lives_ok($$select public.complete_onboarding('Malik', 12)$$, 'onboarding de Malik accepté');

select * from finish();
rollback;
