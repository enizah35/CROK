-- R-01, R-02 : week_start et day_paris, mêmes cas que packages/shared/src/time.test.ts.
-- Rappels 2026 : heure d'été le dimanche 29 mars (02:00 CET -> 03:00 CEST),
-- heure d'hiver le dimanche 25 octobre (03:00 CEST -> 02:00 CET).
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Comme côté Vitest : la session tourne dans un fuseau différent de Paris pour piéger
-- tout usage du fuseau courant.
set local timezone = 'America/Los_Angeles';

-- Semaine ordinaire
select is(public.week_start('2026-10-05T10:00:00Z'), '2026-10-05'::date, 'lundi');
select is(public.week_start('2026-10-07T10:00:00Z'), '2026-10-05'::date, 'mercredi');
select is(public.week_start('2026-10-11T10:00:00Z'), '2026-10-05'::date, 'dimanche');

-- Bascule au lundi 00:00 heure de Paris, heure d'hiver (UTC+1)
select is(public.week_start('2026-02-01T22:59:59Z'), '2026-01-26'::date, 'hiver : dimanche 23:59:59');
select is(public.week_start('2026-02-01T23:00:00Z'), '2026-02-02'::date, 'hiver : lundi 00:00');

-- Bascule au lundi 00:00 heure de Paris, heure d'été (UTC+2)
select is(public.week_start('2026-07-05T21:59:59Z'), '2026-06-29'::date, 'été : dimanche 23:59:59');
select is(public.week_start('2026-07-05T22:00:00Z'), '2026-07-06'::date, 'été : lundi 00:00');

-- Passage à l'heure d'été (dimanche 29 mars 2026)
select is(public.week_start('2026-03-29T00:59:59Z'), '2026-03-23'::date, 'heure d''été : 01:59:59 CET');
select is(public.week_start('2026-03-29T01:00:00Z'), '2026-03-23'::date, 'heure d''été : 03:00:00 CEST');
select is(public.week_start('2026-03-29T21:59:59Z'), '2026-03-23'::date, 'heure d''été : 23:59:59 CEST');
select is(public.week_start('2026-03-29T22:00:00Z'), '2026-03-30'::date, 'heure d''été : lundi 00:00 CEST');

-- Retour à l'heure d'hiver (dimanche 25 octobre 2026)
select is(public.week_start('2026-10-25T00:30:00Z'), '2026-10-19'::date, 'heure d''hiver : 02:30 CEST');
select is(public.week_start('2026-10-25T01:30:00Z'), '2026-10-19'::date, 'heure d''hiver : 02:30 CET (heure répétée)');
select is(public.week_start('2026-10-25T22:59:59Z'), '2026-10-19'::date, 'heure d''hiver : dimanche 23:59:59 CET');
select is(public.week_start('2026-10-25T23:00:00Z'), '2026-10-26'::date, 'heure d''hiver : lundi 00:00 CET, pas une heure plus tôt');

-- Changement d'année
select is(public.week_start('2026-12-31T12:00:00Z'), '2026-12-28'::date, 'jeudi 31 décembre');
select is(public.week_start('2027-01-03T12:00:00Z'), '2026-12-28'::date, 'dimanche 3 janvier');
select is(public.week_start('2027-01-03T23:00:00Z'), '2027-01-04'::date, 'lundi 4 janvier 00:00 CET');

-- Année bissextile
select is(public.week_start('2028-02-29T12:00:00Z'), '2028-02-28'::date, 'mardi 29 février');
select is(public.week_start('2028-03-05T12:00:00Z'), '2028-02-28'::date, 'dimanche 5 mars');

-- Entrée absente : null (là où la fonction TypeScript refuse une date invalide)
select is(public.week_start(null), null::date, 'week_start(null) est null');

-- day_paris
select is(public.day_paris('2026-07-05T22:30:00Z'), '2026-07-06'::date, 'été : 00:30 à Paris, déjà le lendemain');
select is(public.day_paris('2026-01-15T23:30:00Z'), '2026-01-16'::date, 'hiver : 00:30 à Paris, déjà le lendemain');
select is(public.day_paris('2026-01-15T22:59:59Z'), '2026-01-15'::date, 'hiver : 23:59:59 à Paris');
select is(public.day_paris(null), null::date, 'day_paris(null) est null');

-- Le fuseau de session n'a aucune influence
set local timezone = 'Pacific/Kiritimati';
select is(public.week_start('2026-10-25T23:00:00Z'), '2026-10-26'::date, 'indépendant du fuseau de session (UTC+14)');

select * from finish();
rollback;
