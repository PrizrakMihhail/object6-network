-- Review current assignments in the SQL editor.
-- ADMIN can be selected in the registration form.
select u.id_number, u.username, u.role
from public.object6_users u
where exists (
  select 1
  from unnest(string_to_array(u.role, ',')) as assigned(role_name)
  where upper(btrim(assigned.role_name)) in ('ADMIN', 'MEDIC')
)
order by u.id_number;
