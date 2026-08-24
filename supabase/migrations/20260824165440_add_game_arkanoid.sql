-- SPEC 09 — Undecimo juego del catalogo: ARKANOID, portado desde
-- references/started-games/04-arkanoid/.
--
-- Ficha nueva, no sustituye a BLOQUE BUSTER, que se queda con su maqueta igual
-- que ROCAS y CAIDA se quedaron con las suyas cuando entraron ASTEROIDES y
-- TETRIS en las SPEC 05 y 08.
--
-- No hace falta tocar ninguna restriccion: cat y color son valores que ya
-- admiten los check del SPEC 06, y la integridad de scores.game_id la da la
-- clave foranea contra esta tabla. sort_order 110 es el siguiente multiplo de
-- diez libre.
--
-- color 'yellow' y no 'cyan' a proposito: BLOQUE BUSTER esta en la misma
-- categoria y describe lo mismo, asi que el boton JUGAR no debe ser identico.

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'arkanoid',
    'ARKANOID',
    'Rompe los cinco muros antes de quedarte sin pelotas.',
    'Una paleta, una pelota y cinco muros de bloques que no se parecen en nada entre sí: una parrilla, una pirámide, un tablero de ajedrez, filas con huecos y un marco cruzado. Cada nivel lanza la pelota un diez por ciento más rápido que el anterior. Tienes tres vidas para llegar al final.',
    'ARCADE', 'cover-arkanoid', 'yellow', 110
  );
