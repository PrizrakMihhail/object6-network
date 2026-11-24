begin;

create or replace function public.object6_register(
  p_username text, p_roles text[], p_hack_word text, p_id_number text, p_password text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_document text := nullif(lower(btrim(p_id_number)), '');
  v_username text := nullif(btrim(p_username), '');
  v_matches uuid[];
  v_user uuid;
  v_roles text;
begin
  lock table public.object6_users in share row exclusive mode;
  select array_agg("UUID") into v_matches
  from (
    select "UUID" from public.object6_users
    where lower(btrim(id_number)) = v_document
    limit 2
  ) matched;

  if cardinality(v_matches) > 1 then
    raise sqlstate 'PT409' using message = 'document_ambiguous';
  end if;

  v_user := v_matches[1];
  if exists (select 1 from object6_private.credentials where user_uuid = v_user) then
    raise sqlstate 'PT409' using message = 'document_registered';
  end if;

  if exists (
    select 1 from unnest(p_roles) as requested(value)
    cross join lateral unnest(string_to_array(requested.value, ',')) as role(role_name)
    where upper(btrim(role.role_name)) = 'MEDIC'
  ) then
    raise sqlstate 'PT403' using message = 'restricted_roles';
  end if;

  if v_user is null then
    perform object6_private.object6_register(p_username, p_roles, p_hack_word, p_id_number, p_password);
    return;
  end if;

  -- Preserve the administrator-only assignment of MEDIC during public signup.
  if exists (
    select 1 from public.object6_users u
    cross join lateral unnest(string_to_array(u.role, ',')) as assigned(role_name)
    where u."UUID" = v_user and upper(btrim(assigned.role_name)) = 'MEDIC'
  ) then
    raise sqlstate 'PT403' using message = 'activation_requires_admin';
  end if;

  if v_username is null or char_length(v_username) > 64 or char_length(v_document) > 64
    or p_password is null or char_length(p_password) < 8 or octet_length(p_password) > 72 then
    raise sqlstate 'PT400' using message = 'invalid_registration';
  end if;

  if coalesce(cardinality(p_roles), 0) > 7 or exists (
    select from unnest(p_roles) as selected(role)
    where role is null or role not in ('ADMIN', 'CITIZEN', 'HACKER', 'SCIENTIST', 'ENGINEER', 'LAB1', 'LAB2')
  ) then
    raise sqlstate 'PT400' using message = 'invalid_roles';
  end if;

  if exists (
    select from public.object6_users
    where "UUID" <> v_user and (
      lower(btrim(username)) = lower(v_username) or lower(btrim(id_number)) = lower(v_username)
    )
  ) then
    raise sqlstate 'PT409' using message = 'identity_taken';
  end if;

  insert into object6_private.credentials (user_uuid, password_hash)
  values (v_user, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  on conflict (user_uuid) do nothing;
  if not found then
    raise sqlstate 'PT409' using message = 'document_registered';
  end if;

  select string_agg(distinct role, ',' order by role) into v_roles from unnest(p_roles) as selected(role);
  update public.object6_users
  set username = v_username, role = coalesce(v_roles, role)
  where "UUID" = v_user;
end;
$$;

commit;
