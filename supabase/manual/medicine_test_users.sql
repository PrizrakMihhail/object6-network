-- Run separately in the Supabase SQL editor. Save the passwords from the result
-- if you need to sign in as these test users. Existing IDs are skipped.
with test_users as materialized (
  select
    ids.id_number,
    'Medtest-' || ids.id_number || '-' || left(gen_random_uuid()::text, 8) as username,
    'Mt-' || gen_random_uuid()::text as test_password
  from (values ('0001'), ('0002'), ('0003'), ('0004'), ('0005')) as ids(id_number)
  where not exists (
    select 1
    from public.object6_users u
    where btrim(u.id_number::text) = ids.id_number
  )
)
select
  id_number,
  username,
  test_password,
  public.object6_register(
    p_username => username,
    p_roles => array['CITIZEN']::text[],
    p_hack_word => null::text,
    p_id_number => id_number,
    p_password => test_password
  ) as registration
from test_users
order by id_number;
