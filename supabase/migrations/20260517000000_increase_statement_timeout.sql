-- Increase statement timeout for the PostgREST authenticator role.
-- Default is 8s which causes timeouts when upserting large vector batches.
-- 120s allows bulk embedding loads without hitting the limit.
ALTER ROLE authenticator SET statement_timeout = '120s';
