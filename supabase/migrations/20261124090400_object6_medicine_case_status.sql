begin;

alter table public.object6_medicine
  add column status text not null default 'active',
  add constraint object6_medicine_status_values check (status in ('active', 'cured'));

create or replace view object6_private.medicine_case_details as
  select m.uuid, m.patient_uuid, patient.username as patient_name,
    patient.id_number::text as patient_id, m.diagnosis_slug, d.name as diagnosis_name,
    m.severity, m.overdue_minutes, m.complications, m.notes, m.admitted_at,
    staff.username as admitted_by_name, m.status
  from public.object6_medicine m
  join public.object6_users patient on patient."UUID" = m.patient_uuid
  join public.object6_users staff on staff."UUID" = m.admitted_by
  join public.object6_diseases d on d.slug = m.diagnosis_slug;

create function public.object6_medicine_set_status(p_token text, p_uuid uuid, p_status text)
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
  where m.uuid = p_uuid and (m.patient_uuid = actor or m.admitted_by = actor);

  if not found then
    raise sqlstate 'PT404' using message = 'medicine_case_not_found';
  end if;

  select to_jsonb(c) into strict result
  from object6_private.medicine_case_details c
  where c.uuid = p_uuid;
  return result;
end;
$$;

revoke execute on function public.object6_medicine_set_status(text, uuid, text) from public;
grant execute on function public.object6_medicine_set_status(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
