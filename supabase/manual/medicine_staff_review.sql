-- Review existing assignments in the SQL editor before enabling staff access.
-- Earlier versions of public signup exposed ADMIN as a self-selected role.
select u.id_number, u.username, u.role
from public.object6_users u
where exists (
  select 1
  from unnest(string_to_array(u.role, ',')) as assigned(role_name)
  where upper(btrim(assigned.role_name)) in ('ADMIN', 'MEDIC')
)
order by u.id_number;
