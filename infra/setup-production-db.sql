-- Production database users and database, once, on a new PostgreSQL server
-- (Railway). The same two users as infra/setup-local-db.sql, with strong
-- passwords given when it runs, so no password is ever written in this file:
--
--   psql "<Railway's postgres superuser URL>" -v owner_password='…' -v app_password='…' -f infra/setup-production-db.sql
--
-- Make each password with:  node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
-- and put them straight into Railway's variables (docs/go-live.md step 6).
--
--   khmer_micro_store      owns the tables; runs migrations and the worker (DATABASE_OWNER_URL)
--   khmer_micro_store_app  the API's everyday user; row-level security applies (DATABASE_URL)

\set ON_ERROR_STOP on

CREATE ROLE khmer_micro_store LOGIN PASSWORD :'owner_password' NOSUPERUSER NOCREATEROLE NOCREATEDB;
CREATE ROLE khmer_micro_store_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS;

-- The database belongs to the owner user, so the migrations (run as that user) create every table,
-- and the grants in the first migration reach the app user.
CREATE DATABASE kms OWNER khmer_micro_store;
REVOKE ALL ON DATABASE kms FROM PUBLIC;
GRANT CONNECT ON DATABASE kms TO khmer_micro_store_app;

\echo
\echo Done: database kms, owned by khmer_micro_store; khmer_micro_store_app may connect.
\echo Next: run the migrations as the owner (Railway runs them before each API release).
