-- SPEC 06 — El catalogo de juegos deja de ser un array de TypeScript.

create table public.games (
  id           text primary key,
  title        text not null,
  short        text not null,
  long         text not null,
  cat          text not null,
  cover        text not null,
  color        text not null,
  sort_order   integer not null,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint games_id_format check (id ~ '^[a-z0-9-]{2,40}$'),
  constraint games_cat_allowed check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  constraint games_color_allowed check (color in ('cyan', 'magenta', 'yellow', 'green'))
);

comment on table public.games is
  'Catalogo de juegos. best y plays no viven aqui: se derivan de scores en la vista game_stats.';

-- Unico para que no haya empates que Postgres resuelva a su antojo. Se siembra
-- de diez en diez para poder colar un juego entre dos sin renumerar.
create unique index games_sort_order_idx on public.games (sort_order);

alter table public.games enable row level security;

-- Lectura publica y solo de lo publicado. La condicion va aqui y no en cada
-- consulta: olvidarla en uno de los cinco sitios que leen el catalogo filtraria
-- un juego retirado.
create policy "games_select_published"
  on public.games for select
  to anon, authenticated
  using (is_published);

-- Sin politicas de insert, update ni delete: con RLS habilitada eso deja las
-- tres operaciones cerradas para anon y authenticated. El catalogo se toca por
-- migracion o con la clave de servicio.

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'bloque-buster',
    'BLOQUE BUSTER',
    'Rebota la pelota y destruye muros de neón.',
    'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
    'ARCADE', 'cover-bricks', 'cyan', 10
  ),
  (
    'caida',
    'CAÍDA',
    'Encaja las piezas antes de que el techo te aplaste.',
    'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
    'PUZZLE', 'cover-tetro', 'magenta', 20
  ),
  (
    'serpentina',
    'SERPENTINA',
    'Crece sin morder tu propia cola.',
    'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
    'ARCADE', 'cover-snake', 'green', 30
  ),
  (
    'gloton',
    'GLOTÓN',
    'Devora puntos y escapa de los fantasmas.',
    'Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.',
    'ARCADE', 'cover-glot', 'yellow', 40
  ),
  (
    'invasores',
    'INVASORES',
    'Defiende el planeta de filas alienígenas.',
    'Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.',
    'SHOOTER', 'cover-invaders', 'green', 50
  ),
  (
    'rocas',
    'ROCAS',
    'Pulveriza asteroides en gravedad cero.',
    'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
    'SHOOTER', 'cover-rocas', 'yellow', 60
  ),
  (
    'ranaria',
    'RANARIA',
    'Cruza la autopista de pixeles.',
    'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.',
    'ARCADE', 'cover-rana', 'green', 70
  ),
  (
    'duelo-pixel',
    'DUELO PIXEL',
    'Dos paletas. Una pelota. Reflejos máximos.',
    'El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.',
    'VERSUS', 'cover-duelo', 'cyan', 80
  ),
  (
    'asteroides',
    'ASTEROIDES',
    'Rompe rocas a la deriva en un espacio sin bordes.',
    'Tu nave flota en un campo de asteroides donde el espacio se dobla sobre sí mismo: sal por un borde y aparecerás por el opuesto. Dispara para partir las rocas grandes en medianas y las medianas en pequeñas, y recoge el módulo de disparo triple antes de que se apague.',
    'SHOOTER', 'cover-asteroides', 'cyan', 90
  );
