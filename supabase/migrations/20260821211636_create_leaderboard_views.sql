-- SPEC 06 — Las dos vistas que alimentan el marcador y las cifras del catalogo.
--
-- security_invoker = on no es decorativo: una vista de Postgres se ejecuta por
-- omision con los permisos de quien la creo, asi que se salta la RLS de las
-- tablas que consulta. Aqui las dos tablas tienen lectura publica y el
-- resultado seria identico, pero dejarlo sin security_invoker planta una vista
-- privilegiada que el dia que scores gane una politica restrictiva la ignorara
-- en silencio. El advisor de Supabase tambien lo marca como
-- security_definer_view.

-- Mejor marca de cada jugador en cada juego, con el alias ya resuelto.
-- Es la diferencia entre un salon de la fama y un registro de actividad: con
-- una fila por partida, el primero que juegue diez veces copa el top diez.
create view public.game_leaderboards
with (security_invoker = on) as
select distinct on (s.game_id, s.user_id)
  s.game_id,
  s.user_id,
  p.username,
  s.score,
  s.created_at
from public.scores s
join public.profiles p on p.id = s.user_id
-- created_at asc como ultimo desempate: si alguien repite su record exacto,
-- gana la primera vez que lo consiguio.
order by s.game_id, s.user_id, s.score desc, s.created_at asc;

-- best y plays dejan de ser columnas escritas a mano y pasan a ser una
-- consulta. left join para que un juego sin partidas siga apareciendo con
-- ceros en vez de desaparecer de la lista.
create view public.game_stats
with (security_invoker = on) as
select
  g.id                               as game_id,
  coalesce(max(s.score), 0)::integer as best,
  count(s.id)::integer               as plays,
  count(distinct s.user_id)::integer as players
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;
