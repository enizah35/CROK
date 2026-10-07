-- Raison d'un plat non compté (R-11) dans la réponse de complete_cook_session
-- (migration 20261010000000_cook_not_counted_reason.sql). Les cas simples (une seule raison)
-- sont dans cook_rules.test.sql ; ici : priorité entre raisons, rappel idempotent, API exposée.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000000a9', 'nc@test.local', 'authenticated', 'authenticated');

insert into public.recipes (id, slug, title, servings_base, total_min, active_min, cost_cents_per_serving, published)
values
  ('19000000-0000-4000-8000-000000000001', 'nc-un', 'Un', 2, 30, 15, 150, true),
  ('19000000-0000-4000-8000-000000000002', 'nc-deux', 'Deux', 2, 30, 15, 150, true),
  ('19000000-0000-4000-8000-000000000003', 'nc-trois', 'Trois', 2, 30, 15, 150, true);

create temporary table r (k text primary key, sid uuid not null, j jsonb);

-- Session lancée 30 min avant p_at, photo déposée, validation à p_at (temps injecté).
create function pg_temp.done(p_k text, p_recipe uuid, p_at timestamptz, p_n integer)
returns jsonb language plpgsql as $$
declare
  v_user uuid := '00000000-0000-4000-8000-0000000000a9';
  v_s uuid;
  v_path text;
  v_j jsonb;
begin
  insert into public.cook_sessions (user_id, recipe_id, servings)
  values (v_user, p_recipe, 2) returning id into v_s;
  update public.cook_sessions set started_at = p_at - interval '30 minutes' where id = v_s;
  v_path := v_user || '/' || v_s || '/photo.jpg';
  insert into storage.objects (bucket_id, name, owner_id) values ('dishes', v_path, v_user::text);
  v_j := private.complete_cook_session_at(v_user, v_s, v_path,
    encode(sha256(('nc' || p_n)::bytea), 'hex'), p_at);
  insert into r values (p_k, v_s, v_j);
  return v_j;
end $$;

select is(pg_temp.done('n1', '19000000-0000-4000-8000-000000000001', '2026-10-14 10:00 Europe/Paris', 1)
  ->> 'not_counted_reason', null, 'plat compté → not_counted_reason null');
select is(pg_temp.done('n2', '19000000-0000-4000-8000-000000000002', '2026-10-14 11:00 Europe/Paris', 2)
  ->> 'not_counted_reason', null, 'deuxième plat compté → null');
select is(pg_temp.done('n3', '19000000-0000-4000-8000-000000000001', '2026-10-14 12:00 Europe/Paris', 3)
  ->> 'not_counted_reason', 'daily_limit',
  'R-11 : limite atteinte ET recette déjà comptée → daily_limit l''emporte');
select is(pg_temp.done('n4', '19000000-0000-4000-8000-000000000003', '2026-10-14 13:00 Europe/Paris', 4)
  ->> 'not_counted_reason', 'daily_limit', 'R-11 : 3e recette différente → daily_limit');
select is(
  private.complete_cook_session_at('00000000-0000-4000-8000-0000000000a9',
    (select sid from r where k = 'n3'), 'ignoré', 'ignorée', '2026-10-14 18:00 Europe/Paris'),
  (select j from r where k = 'n3') || '{"already_completed": true}',
  'R-10 : le rappel idempotent renvoie la même raison');
select is(pg_temp.done('n5', '19000000-0000-4000-8000-000000000001', '2026-10-15 09:00 Europe/Paris', 5)
  ->> 'not_counted_reason', null, 'lendemain : de nouveau compté');

-- API exposée, en tant qu'utilisateur : la réponse publique porte bien le champ.
select set_config('test.n2', (select sid::text from r where k = 'n2'), true);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-4000-8000-0000000000a9", "role": "authenticated"}', true);
select is(
  public.complete_cook_session(current_setting('test.n2')::uuid, 'x', 'y') -> 'not_counted_reason',
  'null'::jsonb, 'complete_cook_session (rappel) : champ présent, null pour un plat compté');

select * from finish();
rollback;
