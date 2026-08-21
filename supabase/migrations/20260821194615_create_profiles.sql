-- SPEC 04 — Supabase: autenticación real y perfiles de jugador
-- Tabla de perfiles: un alias público y único por cuenta.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Z0-9_]{3,10}$')
);

comment on table public.profiles is
  'Alias publico de cada jugador. Sin datos personales: el correo vive en auth.users.';

alter table public.profiles enable row level security;

-- Lectura publica: el Salon de la Fama tiene que poder mostrar el alias de
-- cualquiera, y la comprobacion de disponibilidad al registrarse tambien.
create policy "profiles_select_public"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Cada quien crea y edita solo el suyo.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No hay politica de delete: el perfil se va en cascada con la cuenta.

-- El alias viaja en options.data.username de signUp y aterriza en
-- raw_user_meta_data. El trigger es security definer porque corre sin sesion:
-- el usuario todavia no existe cuando se inserta su perfil.
--
-- El fallo de este trigger es una funcion, no un accidente: comparte
-- transaccion con el insert en auth.users, asi que un alias ocupado aborta
-- el alta entera y no deja usuarios sin perfil.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
