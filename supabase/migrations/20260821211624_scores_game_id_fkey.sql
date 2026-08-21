-- SPEC 06 — La lista de nueve identificadores escrita a mano en el check de
-- scores.game_id era el riesgo que el SPEC 05 dejo anotado. Ahora que games
-- existe, la integridad la da la clave foranea.

alter table public.scores drop constraint scores_game_id_allowed;

-- restrict: un historial no se tira sin querer desde el panel. Para retirar un
-- juego del catalogo esta is_published, que no toca ninguna fila de scores.
-- cascade en update: renombrar el id de un juego es plausible y las partidas
-- deben seguirlo.
alter table public.scores
  add constraint scores_game_id_fkey
  foreign key (game_id) references public.games (id)
  on delete restrict on update cascade;
