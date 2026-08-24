-- SPEC 08 — Decimo juego del catalogo: TETRIS, portado desde
-- references/started-games/03-tetris/.
--
-- Ficha nueva, no sustituye a CAIDA, que se queda con su maqueta igual que
-- ROCAS se quedo con la suya cuando entro ASTEROIDES en el SPEC 05.
--
-- No hace falta tocar ninguna restriccion: cat y color son valores que ya
-- admiten los check del SPEC 06, y la integridad de scores.game_id la da la
-- clave foranea contra esta tabla. sort_order 100 es el siguiente multiplo de
-- diez libre.

insert into public.games (id, title, short, long, cat, cover, color, sort_order) values
  (
    'tetris',
    'TETRIS',
    'Rota, encaja y funde líneas contra el reloj.',
    'Ocho piezas distintas caen sobre un pozo de diez columnas. Rótalas apurando los saltos de pared, apóyate en la sombra que marca dónde van a aterrizar y complétalas en líneas para hacerlas desaparecer. Cada diez líneas sube el nivel y la caída se acelera, hasta que el pozo llega arriba.',
    'PUZZLE', 'cover-tetris', 'cyan', 100
  );
