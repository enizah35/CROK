-- Bucket privé des photos de plats (R-09, R-22).
-- Chemin d'un objet : '{user_id}/{cook_session_id}/<fichier>' ; dishes.photo_path contient ce nom.
-- Les photos sont servies par URL signée valable 1 h (tâche 2.2).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dishes', 'dishes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Lecture : le propriétaire (son dossier, y compris avant la validation du plat), et les amis
-- pour une photo rattachée à un plat qui leur est visible (la sous-requête applique la RLS
-- de dishes : ami et plat non masqué).
create policy dishes_photos_select_owner_or_friend on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dishes'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.dishes d where d.photo_path = objects.name)
    )
  );

-- Écriture : uniquement dans son propre dossier. Ni modification ni suppression côté client :
-- remplacer une photo après validation serait une triche ; la suppression passe par
-- delete-account (R-33).
create policy dishes_photos_insert_own_folder on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dishes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
