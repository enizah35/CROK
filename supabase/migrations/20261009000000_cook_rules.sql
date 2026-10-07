-- Tâche 1.3 : règles serveur de la boucle en solo (R-06, R-08 à R-18).
-- Contrat : docs/api-serveur.md.
--
-- Trois fonctions exposées à `authenticated` (security definer, heure de Paris) :
--   public.get_active_cook_session()                 R-06
--   public.complete_cook_session(uuid, text, text)   R-08 à R-16
--   public.get_my_progress()                         R-16 à R-18
-- Elles ne font que lire auth.uid() et now() puis déléguer à leur variante interne du schéma
-- `private`, qui reçoit l'utilisateur et l'instant « maintenant » en paramètres. Ces variantes
-- rendent les règles testables (pgTAP simule minuit, le lundi 00:00, les changements d'heure) ;
-- le schéma `private` n'est pas exposé par l'API et n'est accessible ni à anon ni à
-- authenticated.
--
-- Retour arrière :
--   drop function if exists public.get_my_progress();
--   drop function if exists public.complete_cook_session(uuid, text, text);
--   drop function if exists public.get_active_cook_session();
--   drop schema if exists private cascade;

create schema if not exists private;

comment on schema private is
  'Fonctions internes de CROK (règles métier paramétrées par l''instant). Jamais exposé au client.';

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Constantes métier
-- ---------------------------------------------------------------------------
-- R-06 : 6 h pour reprendre ou valider une session.
-- R-09 : délai minimal max(5 min, 40 % de active_min).
-- R-11 : 2 plats comptés par jour, une même recette une fois par jour.
-- R-13 : 100 XP par plat compté. R-16 : semaine réussie à 3 plats comptés.
-- Gardées en dur dans les fonctions (une seule source : ce fichier) et reprises dans
-- docs/api-serveur.md.

-- ---------------------------------------------------------------------------
-- Série hebdomadaire (R-17, R-18)
-- ---------------------------------------------------------------------------

-- Série à l'instant p_at : nombre de semaines réussies consécutives jusqu'à la semaine
-- dernière, +1 si la semaine en cours est déjà réussie. La semaine en cours ne casse donc
-- jamais la série avant dimanche 23:59:59 (Paris). Calculée à la lecture depuis user_weeks,
-- sans tâche planifiée. Réutilisable par le classement (phase 2).
create function private.streak_for(p_user uuid, p_at timestamptz default now())
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current date := public.week_start(p_at);
  v_week date := v_current - 7;
  v_streak integer := 0;
begin
  -- R-17 : semaines pleines, de la semaine dernière vers le passé, jusqu'au premier trou.
  while exists (
    select 1 from public.user_weeks uw
    where uw.user_id = p_user and uw.week_start = v_week and uw.dishes_count >= 3
  ) loop
    v_streak := v_streak + 1;
    v_week := v_week - 7;
  end loop;

  -- R-17 : +1 si la semaine en cours est déjà réussie (R-16).
  if exists (
    select 1 from public.user_weeks uw
    where uw.user_id = p_user and uw.week_start = v_current and uw.dishes_count >= 3
  ) then
    v_streak := v_streak + 1;
  end if;

  return v_streak;
end;
$$;

comment on function private.streak_for(uuid, timestamptz) is
  'R-17 : série de p_user à l''instant p_at (semaines réussies consécutives jusqu''à la semaine '
  'dernière, +1 si la semaine en cours est réussie). Interne, réutilisable par le classement.';

-- ---------------------------------------------------------------------------
-- Session active (R-06)
-- ---------------------------------------------------------------------------

create function private.get_active_cook_session_at(p_user uuid, p_now timestamptz)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.cook_sessions%rowtype;
begin
  select * into v_session
  from public.cook_sessions s
  where s.user_id = p_user and s.status = 'en_cours'
  for update;

  if not found then
    return null;
  end if;

  -- R-06 : au-delà de 6 h, la session est abandonnée et ne rapporte rien.
  if p_now - v_session.started_at >= interval '6 hours' then
    update public.cook_sessions set status = 'abandonnee' where id = v_session.id;
    return null;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'recipe_id', v_session.recipe_id,
    'recipe_version', v_session.recipe_version,
    'servings', v_session.servings,
    'started_at', v_session.started_at,
    'server_now', p_now
  );
end;
$$;

comment on function private.get_active_cook_session_at(uuid, timestamptz) is
  'R-06 : variante interne de get_active_cook_session, avec utilisateur et instant injectés.';

-- ---------------------------------------------------------------------------
-- Résultat d'un plat (partagé par la validation et sa répétition idempotente)
-- ---------------------------------------------------------------------------

create function private.dish_result(
  p_dish_id uuid,
  p_now timestamptz,
  p_already_completed boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'dish_id', d.id,
    'counted', d.counted,
    'xp_awarded', coalesce((
      select sum(l.amount)::integer from public.xp_ledger l
      where l.dish_id = d.id and l.reason = 'dish'
    ), 0),
    'week_start', d.week_start,
    'week_dishes_count', coalesce(uw.dishes_count, 0),
    'goal_reached', coalesce(uw.dishes_count, 0) >= 3,
    'streak', private.streak_for(d.user_id, p_now),
    'lifetime_xp', p.lifetime_xp,
    'already_completed', p_already_completed
  )
  from public.dishes d
  join public.profiles p on p.id = d.user_id
  left join public.user_weeks uw on uw.user_id = d.user_id and uw.week_start = d.week_start
  where d.id = p_dish_id;
$$;

comment on function private.dish_result(uuid, timestamptz, boolean) is
  'Forme JSON renvoyée par complete_cook_session pour un plat donné.';

-- ---------------------------------------------------------------------------
-- Validation d'un plat (R-08 à R-16)
-- ---------------------------------------------------------------------------

-- Tout se passe dans la transaction de l'appel : une erreur annule tout (R-15).
-- Ordre des contrôles : session_not_found, session_not_running (ou répétition idempotente),
-- session_expired, invalid_photo_path, invalid_photo_sha256, photo_missing, too_early,
-- duplicate_photo.
create function private.complete_cook_session_at(
  p_user uuid,
  p_session_id uuid,
  p_photo_path text,
  p_photo_sha256 text,
  p_now timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session public.cook_sessions%rowtype;
  v_active_min integer;
  v_min_delay interval;
  v_sha text := lower(btrim(coalesce(p_photo_sha256, '')));
  v_prefix text;
  v_day date := public.day_paris(p_now);
  v_week date := public.week_start(p_now);
  v_counted boolean;
  v_dish_id uuid;
  v_dish_constraint text;
begin
  if p_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Verrou par utilisateur : deux validations simultanées du même utilisateur passent l'une
  -- après l'autre (R-11 et totaux cohérents). Toujours dans cet ordre : profil puis session.
  perform 1 from public.profiles p where p.id = p_user for update;

  -- R-09 : uniquement une session de l'appelant ; celle d'un autre est introuvable.
  select * into v_session
  from public.cook_sessions s
  where s.id = p_session_id and s.user_id = p_user
  for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  -- R-10 : une session donne au plus un plat. Répéter l'appel (échec réseau) renvoie le
  -- même plat, sans rien créer ni rapporter de plus.
  if v_session.status = 'terminee' then
    select d.id into v_dish_id from public.dishes d where d.cook_session_id = v_session.id;
    if v_dish_id is not null then
      return private.dish_result(v_dish_id, p_now, true);
    end if;
  end if;

  if v_session.status <> 'en_cours' then
    raise exception 'session_not_running' using errcode = '55000';
  end if;

  -- R-06, R-09 : 6 h ou plus après le lancement, la session est perdue. L'exception annule
  -- toute écriture de cet appel : la session n'est donc pas mise à `abandonnee` ici, mais par
  -- get_active_cook_session (ou par le lancement d'une autre session). D'ici là, chaque appel
  -- renvoie session_expired : la session ne peut plus rien rapporter.
  if p_now - v_session.started_at >= interval '6 hours' then
    raise exception 'session_expired' using errcode = '55000';
  end if;

  -- R-09 : la photo est rangée dans dishes/{uid}/{session}/<fichier>.
  v_prefix := p_user::text || '/' || v_session.id::text || '/';
  if p_photo_path is null
    or left(p_photo_path, length(v_prefix)) <> v_prefix
    or length(p_photo_path) = length(v_prefix)
    or p_photo_path ~ '(^|/)\.\.?(/|$)'
  then
    raise exception 'invalid_photo_path' using errcode = '22023';
  end if;

  -- R-12 : empreinte SHA-256 en hexadécimal (64 caractères), calculée par l'app.
  if v_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_photo_sha256' using errcode = '22023';
  end if;

  -- R-09 : la photo doit avoir été envoyée dans le bucket privé `dishes`.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'dishes' and o.name = p_photo_path
  ) then
    raise exception 'photo_missing' using errcode = 'P0002';
  end if;

  -- R-09 : au moins max(5 min, 40 % du temps actif de la recette) depuis le lancement.
  select r.active_min into v_active_min from public.recipes r where r.id = v_session.recipe_id;
  v_min_delay := greatest(interval '5 minutes', make_interval(mins => v_active_min) * 0.4);
  if p_now - v_session.started_at < v_min_delay then
    raise exception 'too_early' using errcode = '55000';
  end if;

  -- R-12 : une photo déjà connue pour cet utilisateur est un doublon.
  if exists (
    select 1 from public.dishes d where d.user_id = p_user and d.photo_sha256 = v_sha
  ) then
    raise exception 'duplicate_photo' using errcode = '23505';
  end if;

  -- R-11 : au plus 2 plats comptés par jour (Paris), et une même recette comptée une fois
  -- par jour. Au-delà, le plat est publié avec 0 XP.
  select count(*) < 2 and count(*) filter (where d.recipe_id = v_session.recipe_id) = 0
  into v_counted
  from public.dishes d
  where d.user_id = p_user and d.day_paris = v_day and d.counted;

  begin
    insert into public.dishes (
      user_id, cook_session_id, recipe_id, photo_path, photo_sha256,
      week_start, day_paris, counted, created_at
    )
    values (
      p_user, v_session.id, v_session.recipe_id, p_photo_path, v_sha,
      v_week, v_day, v_counted, p_now
    )
    returning id into v_dish_id;
  exception
    when unique_violation then
      get stacked diagnostics v_dish_constraint = constraint_name;
      if v_dish_constraint = 'dishes_user_photo_sha256_key' then
        raise exception 'duplicate_photo' using errcode = '23505';
      end if;
      raise;
  end;

  if v_counted then
    -- R-13, R-15 : 100 XP, inscrits au registre, totaux mis à jour dans la même transaction.
    insert into public.xp_ledger (user_id, week_start, amount, reason, dish_id, created_at)
    values (p_user, v_week, 100, 'dish', v_dish_id, p_now);

    update public.profiles set lifetime_xp = lifetime_xp + 100 where id = p_user;

    -- R-16 : semaine réussie à 3 plats comptés ; goal_reached_at garde le premier instant.
    insert into public.user_weeks as uw (user_id, week_start, dishes_count, xp, goal_reached_at)
    values (p_user, v_week, 1, 100, null)
    on conflict (user_id, week_start) do update
    set dishes_count = uw.dishes_count + 1,
        xp = uw.xp + 100,
        goal_reached_at = coalesce(
          uw.goal_reached_at,
          case when uw.dishes_count + 1 >= 3 then p_now end
        );
  end if;

  -- Point d'extension R-14 (tâche 2.5) : si le plat est compté et que sa recette est éligible
  -- au défi de la semaine v_week, inscrire le bonus (xp_ledger reason = 'challenge', une fois
  -- grâce à xp_ledger_user_challenge_key), mettre à jour lifetime_xp et user_weeks.xp, et
  -- attribuer le badge (user_badges). Le résultat JSON pourra alors exposer le défi réussi.

  -- R-08 : seule cette fonction fait passer une session à `terminee`.
  update public.cook_sessions set status = 'terminee' where id = v_session.id;

  return private.dish_result(v_dish_id, p_now, false);
end;
$$;

comment on function private.complete_cook_session_at(uuid, uuid, text, text, timestamptz) is
  'R-08 à R-16 : variante interne de complete_cook_session, avec utilisateur et instant injectés.';

-- ---------------------------------------------------------------------------
-- Progression (R-16 à R-18)
-- ---------------------------------------------------------------------------

create function private.get_my_progress_at(p_user uuid, p_now timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lifetime_xp', p.lifetime_xp,
    'week_start', w.week_start,
    'week_xp', coalesce(uw.xp, 0),
    -- R-18 : le compteur x/3 repart à 0 le lundi à 00:00 (nouvelle ligne de semaine).
    'week_dishes_count', coalesce(uw.dishes_count, 0),
    'goal', 3,
    'goal_reached', coalesce(uw.dishes_count, 0) >= 3,
    'streak', private.streak_for(p.id, p_now),
    -- Plats validés aujourd'hui (Paris), comptés ou non (R-29, R-30).
    'today_dishes_count', (
      select count(*)::integer from public.dishes d
      where d.user_id = p.id and d.day_paris = public.day_paris(p_now)
    ),
    'server_now', p_now
  )
  from public.profiles p
  cross join (select public.week_start(p_now) as week_start) w
  left join public.user_weeks uw on uw.user_id = p.id and uw.week_start = w.week_start
  where p.id = p_user;
$$;

comment on function private.get_my_progress_at(uuid, timestamptz) is
  'R-16 à R-18 : variante interne de get_my_progress, avec utilisateur et instant injectés.';

-- Aucune fonction interne n'est appelable par le client.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on all functions in schema private to service_role;

-- ---------------------------------------------------------------------------
-- API exposée au client (authenticated uniquement)
-- ---------------------------------------------------------------------------

create function public.get_active_cook_session()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.get_active_cook_session_at(auth.uid(), now());
end;
$$;

comment on function public.get_active_cook_session() is
  'R-06 : session en_cours de l''appelant si elle a moins de 6 h, sinon la passe en abandonnee '
  'et renvoie null. Forme : {id, recipe_id, recipe_version, servings, started_at, server_now}.';

create function public.complete_cook_session(
  p_session_id uuid,
  p_photo_path text,
  p_photo_sha256 text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.complete_cook_session_at(
    auth.uid(), p_session_id, p_photo_path, p_photo_sha256, now()
  );
end;
$$;

comment on function public.complete_cook_session(uuid, text, text) is
  'R-08 à R-16 : valide la session (photo dans dishes/{uid}/{session}/…), crée le plat, '
  'l''XP et la semaine en une transaction. Idempotente (already_completed). Forme : {dish_id, '
  'counted, xp_awarded, week_start, week_dishes_count, goal_reached, streak, lifetime_xp, '
  'already_completed}. Erreurs : session_not_found, session_not_running, session_expired, '
  'too_early, photo_missing, duplicate_photo, invalid_photo_path (et invalid_photo_sha256 si '
  'l''empreinte est mal formée).';

create function public.get_my_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return private.get_my_progress_at(auth.uid(), now());
end;
$$;

comment on function public.get_my_progress() is
  'R-16 à R-18 : progression de l''appelant. Forme : {lifetime_xp, week_start, week_xp, '
  'week_dishes_count, goal: 3, goal_reached, streak, today_dishes_count, server_now}.';

revoke all on function public.get_active_cook_session() from public, anon, service_role;
revoke all on function public.complete_cook_session(uuid, text, text) from public, anon, service_role;
revoke all on function public.get_my_progress() from public, anon, service_role;
grant execute on function public.get_active_cook_session() to authenticated;
grant execute on function public.complete_cook_session(uuid, text, text) to authenticated;
grant execute on function public.get_my_progress() to authenticated;
