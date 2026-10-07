-- Création du profil à l'inscription (R-19, R-32).

-- R-19 : code ami de 8 caractères, sans 0, O, 1, I ni L (31 caractères possibles).
-- Tirage cryptographique (pgcrypto), par rejet pour éviter tout biais de modulo.
create function public.generate_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text := '';
  random_byte integer;
begin
  while char_length(code) < 8 loop
    random_byte := get_byte(extensions.gen_random_bytes(1), 0);
    -- 248 = 31 × 8 : les octets 248 à 255 sont rejetés.
    if random_byte < 248 then
      code := code || substr(alphabet, (random_byte % 31) + 1, 1);
    end if;
  end loop;
  return code;
end;
$$;

comment on function public.generate_friend_code() is
  'R-19 : code ami aléatoire de 8 caractères sans caractères ambigus (0, O, 1, I, L).';

-- Trigger sur auth.users : crée le profil avec un code ami unique.
-- Le pseudo, l'avatar et la case 18+ sont remplis à l'onboarding (tâche 0.4).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt integer := 0;
begin
  loop
    begin
      insert into public.profiles (id, friend_code)
      values (new.id, public.generate_friend_code());
      return new;
    exception when unique_violation then
      -- Collision de code ami (≈ 31^8 possibilités) : on retire un code.
      attempt := attempt + 1;
      if attempt >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.generate_friend_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
