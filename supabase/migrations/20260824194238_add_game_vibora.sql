-- SPEC 10 — Duodecimo juego del catalogo: VIBORA, un Snake de rejilla.
--
-- Es el primer juego que NO es un port: no existe
-- references/started-games/05-snake/, asi que todas sus constantes son
-- decisiones del spec y no copias de un original probado.
--
-- Ficha nueva, no sustituye a SERPENTINA, que se queda con su maqueta igual
-- que ROCAS, CAIDA y BLOQUE BUSTER se quedaron con las suyas cuando entraron
-- ASTEROIDES, TETRIS y ARKANOID en las SPEC 05, 08 y 09.
--
-- No hace falta tocar ninguna restriccion: cat y color son valores que ya
-- admiten los check del SPEC 06, y la integridad de scores.game_id la da la
-- clave foranea contra esta tabla. sort_order 120 es el siguiente multiplo de
-- diez libre.
--
-- color 'green' es el mismo que el de SERPENTINA, a diferencia de lo que se
-- hizo con ARKANOID: aqui la que separa a las dos fichas es la portada, que
-- tiene criterio de aceptacion propio. Una vibora que no sea verde seria peor
-- juego por un problema de catalogo.

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'vibora',
    'VÍBORA',
    'Crece con cada bocado hasta que ya no cabes.',
    'Una víbora de luz recorre una rejilla de cuarenta por treinta buscando comida. Cada bocado la alarga un segmento y cada cinco suben el nivel, la velocidad y lo que vale el siguiente. Las cuatro paredes matan, tu propia cola también, y tienes tres vidas.',
    'ARCADE', 'cover-vibora', 'green', 120
  );
