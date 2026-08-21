-- El linter de seguridad avisa de que public.handle_new_user() queda expuesta
-- como RPC en /rest/v1/rpc/handle_new_user por vivir en el esquema public y
-- ser security definer.
--
-- Postgres rechaza invocar una funcion de trigger directamente, asi que la
-- llamada fallaria de todos modos, pero una funcion security definer al
-- alcance de anon no tiene por que estar ahi: solo la llama el trigger
-- on_auth_user_created, que corre como propietario y no pasa por estos GRANT.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
