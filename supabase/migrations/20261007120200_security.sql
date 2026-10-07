-- Droits et RLS (R-08, R-15, R-22 ; docs/plan-technique.md §2 et §3 « Anti-triche »).
--
-- Principe : Supabase donne par défaut tous les droits sur public à anon et authenticated.
-- On les retire tous, puis on accorde table par table le strict nécessaire (y compris par
-- colonne). La RLS filtre ensuite les lignes. Rien n'est accessible à anon (rien de public).
-- Les écritures sur dishes, xp_ledger, user_weeks, user_badges, recipes et challenges
-- passeront par des fonctions security definer (tâche 1.3) ou la clé service_role.

-- ---------------------------------------------------------------------------
-- are_friends
-- ---------------------------------------------------------------------------

-- Security definer : utilisée par les policies, elle lit friendships sans dépendre de la RLS
-- de friendships (et sans récursion).
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.user_a = least(a, b)
      and f.user_b = greatest(a, b)
  );
$$;

comment on function public.are_friends(uuid, uuid) is
  'R-22 : vrai si a et b sont amis. Utilisée par les policies RLS.';

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated, service_role;

-- Fonctions de trigger : jamais appelables directement.
revoke execute on function public.cook_sessions_before_insert() from public, anon, authenticated;
revoke execute on function public.cook_sessions_before_update() from public, anon, authenticated;
revoke execute on function public.blocks_after_insert() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Droits : on repart de zéro pour anon et authenticated.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Les futures tables n'héritent plus de droits implicites : chaque migration les accorde.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Lecture seule
grant select on public.recipes, public.dishes, public.xp_ledger, public.user_weeks,
  public.challenges, public.user_badges to authenticated;

-- profiles : lecture ; le client ne modifie que pseudo, avatar et rappel (R-32, R-28).
-- Création par trigger à l'inscription, suppression par l'Edge Function delete-account.
grant select on public.profiles to authenticated;
grant update (pseudo, avatar_id, reminder_enabled, reminder_time) on public.profiles to authenticated;

-- cook_sessions : le client lance (R-03), change les portions, abandonne ou passe la photo (R-07).
grant select on public.cook_sessions to authenticated;
grant insert (user_id, recipe_id, servings) on public.cook_sessions to authenticated;
grant update (servings, status) on public.cook_sessions to authenticated;

-- friendships : créées par RPC (code ami, tâche 2.1) ; retirer un ami (R-21).
grant select, delete on public.friendships to authenticated;

-- blocks (R-21)
grant select, delete on public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

-- reactions (R-24)
grant select, delete on public.reactions to authenticated;
grant insert (dish_id, user_id, emoji) on public.reactions to authenticated;
grant update (emoji) on public.reactions to authenticated;

-- reports (R-25)
grant select on public.reports to authenticated;
grant insert (reporter_id, dish_id, reason) on public.reports to authenticated;

-- events : insertion seule
grant insert (user_id, name, props) on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- RLS : activée sur toutes les tables.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.cook_sessions enable row level security;
alter table public.dishes enable row level security;
alter table public.challenges enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.user_weeks enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.reactions enable row level security;
alter table public.user_badges enable row level security;
alter table public.reports enable row level security;
alter table public.events enable row level security;

-- profiles : soi et ses amis (R-22).
create policy profiles_select_self_or_friend on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.are_friends((select auth.uid()), id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- recipes : recettes publiées, pour les utilisateurs connectés.
create policy recipes_select_published on public.recipes
  for select to authenticated
  using (published);

-- challenges : défi commun à tous (R-27).
create policy challenges_select_all on public.challenges
  for select to authenticated
  using (true);

-- cook_sessions : uniquement les siennes.
create policy cook_sessions_select_own on public.cook_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- La recette doit être visible (publiée) ; le trigger pose started_at, statut et version.
create policy cook_sessions_insert_own on public.cook_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id)
  );

-- Seule une session en cours se modifie, et jamais vers « terminee » : seul
-- complete_cook_session (R-08) peut valider une session.
create policy cook_sessions_update_running on public.cook_sessions
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'en_cours')
  with check (
    user_id = (select auth.uid())
    and status in ('en_cours', 'abandonnee', 'terminee_sans_photo')
  );

-- dishes : les miens, et ceux de mes amis s'ils ne sont pas masqués (R-22, R-25).
create policy dishes_select_self_or_friend on public.dishes
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (not hidden and public.are_friends((select auth.uid()), user_id))
  );

-- xp_ledger : le détail de l'XP reste personnel.
create policy xp_ledger_select_own on public.xp_ledger
  for select to authenticated
  using (user_id = (select auth.uid()));

-- user_weeks : moi et mes amis (classement, R-26).
create policy user_weeks_select_self_or_friend on public.user_weeks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));

-- user_badges : visibles sur les profils d'amis.
create policy user_badges_select_self_or_friend on public.user_badges
  for select to authenticated
  using (user_id = (select auth.uid()) or public.are_friends((select auth.uid()), user_id));

-- friendships : uniquement celles dont je fais partie ; je peux les retirer (R-21).
create policy friendships_select_own on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy friendships_delete_own on public.friendships
  for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- blocks : uniquement ceux que j'ai posés ; la personne bloquée n'en sait rien (R-21).
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_insert_own on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy blocks_delete_own on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- reactions : visibles si le plat m'est visible (la sous-requête applique la RLS de dishes).
create policy reactions_select_visible_dish on public.reactions
  for select to authenticated
  using (exists (select 1 from public.dishes d where d.id = dish_id));

-- Réagir uniquement en son nom, sur un plat visible : le sien ou celui d'un ami (R-24).
create policy reactions_insert_own on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.dishes d where d.id = dish_id)
  );

create policy reactions_update_own on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.dishes d where d.id = dish_id)
  );

create policy reactions_delete_own on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- reports : un ami signale un plat visible qui n'est pas le sien (R-25).
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy reports_insert_friend_dish on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from public.dishes d
      where d.id = dish_id and d.user_id <> (select auth.uid())
    )
  );

-- events : insertion en son nom uniquement, aucune lecture côté client.
create policy events_insert_own on public.events
  for insert to authenticated
  with check (user_id = (select auth.uid()));
