-- Modèle de données du MVP (docs/plan-technique.md §2).
-- Les droits et la RLS sont dans la migration suivante (security).
-- Suppression de compte (R-33) : tout part de auth.users en cascade, via profiles.

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

-- R-03, R-06, R-07 : cycle de vie d'une session de cuisine.
create type public.cook_session_status as enum (
  'en_cours',
  'terminee',
  'terminee_sans_photo',
  'abandonnee'
);

-- R-13, R-14 : origine d'une ligne du registre d'XP.
create type public.xp_reason as enum ('dish', 'challenge');

-- R-24 : les 5 réactions fixes.
create type public.reaction_emoji as enum ('yum', 'fire', 'heart', 'clap', 'laugh');

-- R-25 : traitement manuel des signalements par Hugo.
create type public.report_status as enum ('open', 'actioned', 'dismissed');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- R-32 : choisi à l'onboarding, donc nul juste après l'inscription.
  pseudo text,
  avatar_id smallint,
  -- R-19 : 8 caractères, sans 0, O, 1, I ni L.
  friend_code text not null,
  adult_confirmed_at timestamptz,
  reminder_enabled boolean not null default true,
  -- R-28 : 19 h par défaut (heure de Paris).
  reminder_time time not null default '19:00',
  lifetime_xp integer not null default 0,
  created_at timestamptz not null default now(),
  constraint profiles_pseudo_format check (
    char_length(pseudo) between 3 and 20 and pseudo = btrim(pseudo)
  ),
  constraint profiles_avatar_id_range check (avatar_id between 1 and 12),
  constraint profiles_friend_code_format check (friend_code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  constraint profiles_lifetime_xp_positive check (lifetime_xp >= 0),
  constraint profiles_friend_code_key unique (friend_code)
);

-- R-32 : pseudo unique, sans tenir compte de la casse.
create unique index profiles_pseudo_key on public.profiles (lower(pseudo));

-- ---------------------------------------------------------------------------
-- recipes (écrites par recipes-push avec la clé service_role, tâche 0.3)
-- ---------------------------------------------------------------------------

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null default 1,
  title text not null,
  servings_base smallint not null,
  total_min integer not null,
  active_min integer not null,
  cost_cents_per_serving integer not null,
  equipment text[] not null default '{}',
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  cover_path text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_slug_key unique (slug),
  constraint recipes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint recipes_version_positive check (version >= 1),
  constraint recipes_title_not_blank check (btrim(title) <> ''),
  constraint recipes_servings_base_range check (servings_base between 1 and 12),
  constraint recipes_minutes check (active_min > 0 and total_min >= active_min),
  constraint recipes_cost_positive check (cost_cents_per_serving >= 0),
  constraint recipes_ingredients_array check (jsonb_typeof(ingredients) = 'array'),
  constraint recipes_steps_array check (jsonb_typeof(steps) = 'array')
);

create index recipes_published_idx on public.recipes (published) where published;

-- ---------------------------------------------------------------------------
-- cook_sessions
-- ---------------------------------------------------------------------------

create table public.cook_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id),
  recipe_version integer not null,
  -- R-04 : portions de 1 à 6.
  servings smallint not null,
  -- R-03 : posé par le serveur (trigger ci-dessous).
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.cook_session_status not null default 'en_cours',
  constraint cook_sessions_servings_range check (servings between 1 and 6),
  constraint cook_sessions_finished_iff_closed check (
    (status = 'en_cours') = (finished_at is null)
  )
);

-- R-03 : au plus une session en cours par utilisateur.
create unique index cook_sessions_one_running_idx
  on public.cook_sessions (user_id)
  where status = 'en_cours';

create index cook_sessions_user_started_idx on public.cook_sessions (user_id, started_at desc);
create index cook_sessions_recipe_idx on public.cook_sessions (recipe_id);

-- R-03 : started_at, statut et version de recette sont posés par le serveur ; lancer une
-- nouvelle session abandonne la précédente. Security definer pour clore la session
-- précédente (finished_at n'est pas modifiable par le client) ; la RLS (WITH CHECK
-- user_id = auth.uid()) s'applique après ce trigger et annule tout si user_id est usurpé.
create function public.cook_sessions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_version integer;
begin
  select r.version into current_version
  from public.recipes r
  where r.id = new.recipe_id and r.published;

  if current_version is null then
    raise exception 'Recette introuvable ou non publiée' using errcode = 'P0002';
  end if;

  new.recipe_version := current_version;
  new.started_at := now();
  new.finished_at := null;
  new.status := 'en_cours';

  update public.cook_sessions
  set status = 'abandonnee', finished_at = now()
  where user_id = new.user_id and status = 'en_cours';

  return new;
end;
$$;

create trigger cook_sessions_before_insert
  before insert on public.cook_sessions
  for each row execute function public.cook_sessions_before_insert();

-- finished_at suit le statut : posé par le serveur quand la session est close.
create function public.cook_sessions_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'en_cours' and new.status <> 'en_cours' then
    new.finished_at := now();
  elsif new.status = 'en_cours' then
    new.finished_at := null;
  else
    new.finished_at := old.finished_at;
  end if;
  return new;
end;
$$;

create trigger cook_sessions_before_update
  before update on public.cook_sessions
  for each row execute function public.cook_sessions_before_update();

-- ---------------------------------------------------------------------------
-- dishes (insertion par RPC uniquement, tâche 1.3)
-- ---------------------------------------------------------------------------

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cook_session_id uuid not null references public.cook_sessions (id),
  recipe_id uuid not null references public.recipes (id),
  -- Nom de l'objet dans le bucket `dishes` : '{user_id}/{cook_session_id}/...' (R-09).
  photo_path text not null,
  photo_sha256 text not null,
  week_start date not null,
  day_paris date not null,
  counted boolean not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  -- R-10 : une session donne au plus un plat.
  constraint dishes_cook_session_key unique (cook_session_id),
  -- R-12 : une photo déjà connue pour cet utilisateur est un doublon.
  constraint dishes_user_photo_sha256_key unique (user_id, photo_sha256),
  constraint dishes_photo_sha256_format check (photo_sha256 ~ '^[0-9a-f]{64}$'),
  constraint dishes_photo_path_in_own_folder check (
    split_part(photo_path, '/', 1) = user_id::text
  ),
  -- R-01, R-02 : semaine et jour toujours dérivés de created_at, en heure de Paris.
  constraint dishes_week_start_matches check (week_start = public.week_start(created_at)),
  constraint dishes_day_paris_matches check (day_paris = public.day_paris(created_at))
);

create index dishes_user_created_idx on public.dishes (user_id, created_at desc);
create index dishes_user_day_idx on public.dishes (user_id, day_paris);
create index dishes_user_week_idx on public.dishes (user_id, week_start);
create index dishes_recipe_idx on public.dishes (recipe_id);
create index dishes_photo_path_idx on public.dishes (photo_path);

-- ---------------------------------------------------------------------------
-- challenges (R-27, définis par Hugo)
-- ---------------------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  title text not null,
  description text not null default '',
  eligible_recipe_ids uuid[] not null default '{}',
  badge_code text not null,
  bonus_xp integer not null default 50,
  created_at timestamptz not null default now(),
  constraint challenges_week_start_key unique (week_start),
  constraint challenges_week_start_is_monday check (extract(isodow from week_start) = 1),
  constraint challenges_bonus_xp_positive check (bonus_xp >= 0)
);

-- ---------------------------------------------------------------------------
-- xp_ledger (R-15 : toute XP passe par ce registre)
-- ---------------------------------------------------------------------------

create table public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  amount integer not null,
  reason public.xp_reason not null,
  dish_id uuid references public.dishes (id),
  challenge_id uuid references public.challenges (id),
  created_at timestamptz not null default now(),
  constraint xp_ledger_amount_not_zero check (amount <> 0),
  constraint xp_ledger_reason_source check (
    (reason = 'dish' and dish_id is not null and challenge_id is null)
    or (reason = 'challenge' and challenge_id is not null and dish_id is null)
  ),
  constraint xp_ledger_dish_reason_key unique (dish_id, reason),
  -- R-14 : bonus de défi une seule fois.
  constraint xp_ledger_user_challenge_key unique (user_id, challenge_id)
);

create index xp_ledger_user_week_idx on public.xp_ledger (user_id, week_start);
create index xp_ledger_challenge_idx on public.xp_ledger (challenge_id);

-- ---------------------------------------------------------------------------
-- user_weeks (R-16 à R-18, R-26)
-- ---------------------------------------------------------------------------

create table public.user_weeks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  dishes_count integer not null default 0,
  xp integer not null default 0,
  goal_reached_at timestamptz,
  primary key (user_id, week_start),
  constraint user_weeks_week_start_is_monday check (extract(isodow from week_start) = 1),
  constraint user_weeks_dishes_count_positive check (dishes_count >= 0),
  constraint user_weeks_xp_positive check (xp >= 0)
);

-- Classement hebdo (R-26).
create index user_weeks_week_xp_idx on public.user_weeks (week_start, xp desc);

-- ---------------------------------------------------------------------------
-- friendships, blocks (R-19 à R-21)
-- ---------------------------------------------------------------------------

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  -- Une seule ligne par paire, dans l'ordre (R-20 : amitié dans les deux sens).
  constraint friendships_ordered check (user_a < user_b)
);

create index friendships_user_b_idx on public.friendships (user_b);

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- R-21 : bloquer supprime l'amitié. Security definer : l'amitié est supprimée quel que
-- soit le droit du client ; la RLS de blocks (blocker_id = auth.uid()) s'applique avant
-- l'exécution de ce trigger AFTER.
create function public.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where user_a = least(new.blocker_id, new.blocked_id)
    and user_b = greatest(new.blocker_id, new.blocked_id);
  return null;
end;
$$;

create trigger blocks_after_insert
  after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- ---------------------------------------------------------------------------
-- reactions (R-24)
-- ---------------------------------------------------------------------------

create table public.reactions (
  dish_id uuid not null references public.dishes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji public.reaction_emoji not null,
  created_at timestamptz not null default now(),
  primary key (dish_id, user_id)
);

create index reactions_user_idx on public.reactions (user_id);

-- ---------------------------------------------------------------------------
-- user_badges (R-27)
-- ---------------------------------------------------------------------------

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id),
  badge_code text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create index user_badges_challenge_idx on public.user_badges (challenge_id);

-- ---------------------------------------------------------------------------
-- reports (R-25)
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  reason text not null default '',
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reporter_dish_key unique (reporter_id, dish_id),
  constraint reports_reason_length check (char_length(reason) <= 500)
);

create index reports_dish_idx on public.reports (dish_id);
create index reports_open_idx on public.reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- events (North Star et rétention, insertion seule)
-- ---------------------------------------------------------------------------

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint events_name_format check (name ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint events_props_object check (jsonb_typeof(props) = 'object')
);

create index events_name_created_idx on public.events (name, created_at);
create index events_user_idx on public.events (user_id);
