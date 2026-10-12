-- Tables and sequences created later by postgres in schema public inherited
-- TRUNCATE, REFERENCES, TRIGGER and MAINTAIN, and sequence UPDATE, for
-- anon and authenticated. The application does not use those privileges.
-- They are not Data API operations. This changes only future objects
-- created by postgres. Existing grants, service_role defaults, function
-- defaults, and supabase_admin defaults stay as they are.

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke update on sequences
  from anon, authenticated;
