-- SPEC 05 — Tabla de puntuaciones: una fila por partida terminada.

create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  game_id    text not null,
  score      integer not null,
  created_at timestamptz not null default now(),
  constraint scores_score_range check (score >= 0 and score <= 10000000),
  constraint scores_game_id_allowed check (
    game_id in (
      'bloque-buster', 'caida', 'serpentina', 'gloton',
      'invasores', 'rocas', 'ranaria', 'duelo-pixel', 'asteroides'
    )
  )
);

comment on table public.scores is
  'Historial de partidas terminadas. Una fila por partida: el record sale con order by score desc limit 1.';

-- El marcador siempre se ordena por juego y puntuacion descendente.
create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.scores enable row level security;

-- Lectura publica: el Salon de la Fama tendra que mostrar el marcador de
-- cualquiera. Ninguna pantalla la usa todavia (eso es el SPEC 06), pero
-- habilitar RLS sin politica de select deja la tabla ciega y anadirla despues
-- obligaria a otra migracion por nada.
create policy "scores_select_public"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Cada quien firma solo lo suyo. El user_id lo pone el Server Action desde la
-- sesion del servidor; esta politica es la que impide firmar en nombre de otro.
create policy "scores_insert_own"
  on public.scores for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- No hay politica de update ni de delete: una puntuacion no se corrige ni se
-- borra, y las filas se van en cascada con la cuenta.
