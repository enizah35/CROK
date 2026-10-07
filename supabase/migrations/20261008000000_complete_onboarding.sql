-- Tâche 0.4 : fin de l'onboarding (R-32).
--
-- Dépend de la table public.profiles créée par la tâche 0.2 (id = auth.uid(), pseudo,
-- avatar_id, friend_code, adult_confirmed_at, ...). Le client ne peut pas écrire
-- adult_confirmed_at : il passe par complete_onboarding, qui l'horodate côté serveur.
--
-- Règles de pseudo identiques à packages/shared/src/account.ts (validatePseudo) :
-- 3 à 20 caractères parmi [A-Za-z0-9_], espaces de bord retirés, unicité sans tenir compte
-- de la casse.
--
-- Retour arrière :
--   drop function if exists public.complete_onboarding(text, integer);
--   drop function if exists public.is_pseudo_available(text);
--   drop index if exists public.profiles_pseudo_lower_key;

-- Unicité du pseudo sans tenir compte de la casse (« Lea » = « lea »). Complète la contrainte
-- unique (sensible à la casse) posée par la tâche 0.2.
create unique index if not exists profiles_pseudo_lower_key on public.profiles (lower(pseudo));

-- Disponibilité d'un pseudo, pour l'affichage pendant la saisie. Security definer : la RLS de
-- profiles ne laisse voir que soi et ses amis (R-22), on ne renvoie donc qu'un booléen.
-- Réservée aux utilisateurs connectés pour limiter l'énumération.
create or replace function public.is_pseudo_available(p_pseudo text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  return not exists (
    select 1
    from public.profiles p
    where lower(p.pseudo) = lower(btrim(p_pseudo, E' \t\n\r'))
      and p.id <> v_uid
  );
end;
$$;

-- R-32 : enregistre pseudo et avatar, et la confirmation « J'ai 18 ans ou plus » avec sa date.
-- L'appel n'est fait par l'app que si la case est cochée ; adult_confirmed_at est posé par le
-- serveur (now()) et n'est jamais remplacé une fois posé.
--
-- Erreurs (message = code stable lu par l'app) :
--   not_authenticated (42501), invalid_pseudo (22023), invalid_avatar (22023),
--   pseudo_taken (23505).
create or replace function public.complete_onboarding(p_pseudo text, p_avatar_id integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text := btrim(coalesce(p_pseudo, ''), E' \t\n\r');
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if v_pseudo !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_pseudo' using errcode = '22023';
  end if;

  if p_avatar_id is null or p_avatar_id < 1 or p_avatar_id > 12 then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles p where lower(p.pseudo) = lower(v_pseudo) and p.id <> v_uid
  ) then
    raise exception 'pseudo_taken' using errcode = '23505';
  end if;

  -- Le profil peut déjà exister (créé à l'inscription par la tâche 0.2) ou non : upsert.
  -- friend_code et les colonnes de rappel prennent leurs valeurs par défaut à l'insertion.
  insert into public.profiles as p (id, pseudo, avatar_id, adult_confirmed_at)
  values (v_uid, v_pseudo, p_avatar_id, now())
  on conflict (id) do update
    set pseudo = excluded.pseudo,
        avatar_id = excluded.avatar_id,
        adult_confirmed_at = coalesce(p.adult_confirmed_at, excluded.adult_confirmed_at);
exception
  -- Course entre deux inscriptions sur le même pseudo : l'index unique tranche. Les autres
  -- violations d'unicité (friend_code, ...) remontent telles quelles.
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint like '%pseudo%' then
      raise exception 'pseudo_taken' using errcode = '23505';
    end if;
    raise;
end;
$$;

revoke all on function public.is_pseudo_available(text) from public, anon;
revoke all on function public.complete_onboarding(text, integer) from public, anon;
grant execute on function public.is_pseudo_available(text) to authenticated;
grant execute on function public.complete_onboarding(text, integer) to authenticated;
