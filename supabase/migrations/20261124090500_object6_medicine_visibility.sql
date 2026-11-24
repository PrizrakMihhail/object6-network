begin;

create function object6_private.has_medicine_staff_role(p_user uuid)
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1
    from public.object6_users u
    cross join lateral unnest(string_to_array(u.role, ',')) as assigned(role_name)
    where u."UUID" = p_user and upper(btrim(assigned.role_name)) in ('ADMIN', 'MEDIC')
  );
$$;

revoke execute on function object6_private.has_medicine_staff_role(uuid) from public, anon, authenticated;

-- Public signup currently offers ADMIN. MEDIC remains assigned separately.
revoke insert, update on public.object6_users from public, anon, authenticated;
revoke insert (role), update (role) on public.object6_users from public, anon, authenticated;

alter function public.object6_register(text, text[], text, text, text) set schema object6_private;
revoke execute on function object6_private.object6_register(text, text[], text, text, text)
  from public, anon, authenticated;

create function public.object6_register(
  p_username text, p_roles text[], p_hack_word text, p_id_number text, p_password text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(p_roles) as requested(value)
    cross join lateral unnest(string_to_array(requested.value, ',')) as role(role_name)
    where upper(btrim(role.role_name)) = 'MEDIC'
  ) then
    raise sqlstate 'PT403' using message = 'restricted_roles';
  end if;
  perform object6_private.object6_register(p_username, p_roles, p_hack_word, p_id_number, p_password);
end;
$$;

revoke execute on function public.object6_register(text, text[], text, text, text) from public;
grant execute on function public.object6_register(text, text[], text, text, text) to anon, authenticated;

revoke select on public.object6_diseases from anon, authenticated;
grant select (slug, name, severity, description, symptoms, treatment)
  on public.object6_diseases to anon, authenticated;

create or replace function public.object6_medicine_cases(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  viewer uuid := object6_private.require_user(p_token);
  staff boolean;
  records jsonb;
  laboratory jsonb := '[]'::jsonb;
begin
  if viewer is null then
    raise sqlstate 'PT401' using message = 'session_expired';
  end if;
  staff := object6_private.has_medicine_staff_role(viewer);
  select coalesce(jsonb_agg(to_jsonb(c) order by c.admitted_at desc, c.uuid desc), '[]'::jsonb)
  into records
  from object6_private.medicine_case_details c
  where staff or c.patient_uuid = viewer;

  if staff then
    select coalesce(jsonb_agg(jsonb_build_object('name', d.name, 'lab_notes', d.lab_notes)
      order by d.severity, d.name), '[]'::jsonb)
    into laboratory
    from public.object6_diseases d
    where d.lab_notes is not null and d.lab_notes <> '';
  end if;

  return jsonb_build_object('staff', staff, 'can_admit', staff, 'cases', records, 'laboratory', laboratory);
end;
$$;

alter function public.object6_medicine_analyze(text, uuid, text, integer, text[], text, text)
  set schema object6_private;
revoke execute on function object6_private.object6_medicine_analyze(text, uuid, text, integer, text[], text, text)
  from public, anon, authenticated;

create function public.object6_medicine_analyze(
  p_token text, p_uuid uuid, p_patient_id text, p_overdue_minutes integer,
  p_complications text[], p_notes text, p_expected_diagnosis text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := object6_private.require_user(p_token);
begin
  if actor is null then
    raise sqlstate 'PT401' using message = 'session_expired';
  end if;
  if not object6_private.has_medicine_staff_role(actor) then
    raise sqlstate 'PT403' using message = 'medicine_access_denied';
  end if;
  return object6_private.object6_medicine_analyze(
    p_token, p_uuid, p_patient_id, p_overdue_minutes, p_complications, p_notes, p_expected_diagnosis
  );
end;
$$;

revoke execute on function public.object6_medicine_analyze(text, uuid, text, integer, text[], text, text)
  from public;
grant execute on function public.object6_medicine_analyze(text, uuid, text, integer, text[], text, text)
  to anon, authenticated;

create or replace function public.object6_medicine_admit(
  p_token text, p_uuid uuid, p_patient_id text, p_overdue_minutes integer,
  p_complications text[], p_notes text
)
returns jsonb
language sql security definer set search_path = ''
as $$
  select public.object6_medicine_analyze(
    p_token, p_uuid, p_patient_id, p_overdue_minutes, p_complications, p_notes, null
  );
$$;

create or replace function public.object6_medicine_set_status(p_token text, p_uuid uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := object6_private.require_user(p_token);
  result jsonb;
begin
  if actor is null then
    raise sqlstate 'PT401' using message = 'session_expired';
  end if;
  if p_status is null or p_status not in ('active', 'cured') then
    raise sqlstate 'PT400' using message = 'invalid_medicine_status';
  end if;

  update public.object6_medicine m
  set status = p_status
  where m.uuid = p_uuid and (m.patient_uuid = actor or object6_private.has_medicine_staff_role(actor));

  if not found then
    raise sqlstate 'PT404' using message = 'medicine_case_not_found';
  end if;

  select to_jsonb(c) into strict result
  from object6_private.medicine_case_details c
  where c.uuid = p_uuid;
  return result;
end;
$$;

notify pgrst, 'reload schema';
commit;
