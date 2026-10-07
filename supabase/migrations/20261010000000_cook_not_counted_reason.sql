-- Intégration de la phase 1 : raison d'un plat non compté (R-11) dans la réponse de
-- complete_cook_session, pour que l'écran de récompense dise précisément pourquoi le plat ne
-- rapporte pas d'XP. Contrat : docs/api-serveur.md.
--
-- Nouveau champ `not_counted_reason` du résultat (aussi au rappel idempotent) :
--   null                            plat compté
--   'daily_limit'                   2 plats déjà comptés ce jour-là (Paris) avant celui-ci
--   'recipe_already_counted_today'  sinon : la même recette a déjà été comptée ce jour-là
-- Quand les deux raisons s'appliquent, `daily_limit` l'emporte (même une autre recette
-- n'aurait pas compté). La raison est déduite des plats comptés du même jour créés avant
-- celui-ci, ce qui donne la même réponse à chaque rappel.
--
-- Seule private.dish_result change (même signature, mêmes droits) ; les fonctions publiques
-- l'appellent déjà.
--
-- Retour arrière : rejouer la définition de private.dish_result de
-- 20261009000000_cook_rules.sql (sans `not_counted_reason`) et son commentaire.

create or replace function private.dish_result(
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
    'already_completed', p_already_completed,
    -- R-11 : pourquoi le plat ne rapporte pas d'XP (null s'il est compté).
    'not_counted_reason', case
      when d.counted then null
      when (
        select count(*) from public.dishes o
        where o.user_id = d.user_id and o.day_paris = d.day_paris and o.counted
          and o.id <> d.id and o.created_at <= d.created_at
      ) >= 2 then 'daily_limit'
      else 'recipe_already_counted_today'
    end
  )
  from public.dishes d
  join public.profiles p on p.id = d.user_id
  left join public.user_weeks uw on uw.user_id = d.user_id and uw.week_start = d.week_start
  where d.id = p_dish_id;
$$;

comment on function private.dish_result(uuid, timestamptz, boolean) is
  'Forme JSON renvoyée par complete_cook_session pour un plat donné (avec not_counted_reason).';

-- Mêmes droits qu'avant : réservée au service_role, jamais au client.
revoke all on function private.dish_result(uuid, timestamptz, boolean) from public, anon, authenticated;
grant execute on function private.dish_result(uuid, timestamptz, boolean) to service_role;

comment on function public.complete_cook_session(uuid, text, text) is
  'R-08 à R-16 : valide la session (photo dans dishes/{uid}/{session}/…), crée le plat, '
  'l''XP et la semaine en une transaction. Idempotente (already_completed). Forme : {dish_id, '
  'counted, xp_awarded, week_start, week_dishes_count, goal_reached, streak, lifetime_xp, '
  'already_completed, not_counted_reason (null, daily_limit ou recipe_already_counted_today)}. '
  'Erreurs : session_not_found, session_not_running, session_expired, too_early, '
  'photo_missing, duplicate_photo, invalid_photo_path (et invalid_photo_sha256 si '
  'l''empreinte est mal formée).';
