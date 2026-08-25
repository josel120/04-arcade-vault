-- SPEC 16 — el trigger solo inserta perfil si el alta trae username en
-- raw_user_meta_data (alta por correo+contrasena, via options.data.username).
-- Un alta por OAuth no trae esa clave: el if no entra, no se inserta nada, y
-- la fila de auth.users se crea igual, sin abortar la transaccion. La fila de
-- profiles para esa cuenta la crea despues, en su propia transaccion, el
-- insert explicito de /login/alias.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username)
    values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  end if;
  return new;
end;
$$;
