-- SPEC (GAME JAM) FROGGER -- decimotercer juego del catalogo.
--
-- Ficha nueva, no sustituye a RANARIA, que se queda con su maqueta igual que
-- SERPENTINA, CAIDA, BLOQUE BUSTER y ROCAS se quedaron con las suyas cuando
-- ASTEROIDES, TETRIS, ARKANOID y VIBORA entraron con motor real. La decision
-- de mantener las dos fichas del mismo juego clasico esta razonada en el §6
-- de specs/game-jam/frogger/spec-diseno.md.
--
-- No hace falta tocar ninguna restriccion: cat y color ya admiten los check
-- del SPEC 06, y sort_order 130 es el siguiente multiplo de diez libre.

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'frogger',
    'FROGGER',
    'Esquiva el tráfico y no te ahogues en el río.',
    'Guía a tu rana a través de cinco carriles de tráfico y seis de río en una cuadrícula de neón. Salta sobre troncos y tortugas —cuidado, se sumergen— y ocupa las cinco bocas de meta antes de que se acabe el tiempo. Cada ronda acelera el tráfico y acorta el reloj. Tres vidas, cero margen de error.',
    'ARCADE', 'cover-frogger', 'magenta', 130
  );
