begin;

create or replace function public.object6_medicine_analyze(
  p_token text, p_uuid uuid, p_patient_id text, p_overdue_minutes integer,
  p_complications text[], p_notes text, p_expected_diagnosis text
)

returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  medic uuid := object6_private.require_user(p_token);
  patient uuid;
  requested_id text := lower(btrim(p_patient_id));
  intake_notes text := coalesce(p_notes, '');
  intake_complications text[];
  complication_severity integer;
  diagnosis_severity smallint;
  diagnosis text;
  existing public.object6_medicine%rowtype;
  result jsonb;
begin
  if medic is null then
    raise sqlstate 'PT401' using message = 'session_expired';
  end if;
  if p_uuid is null then
    raise sqlstate 'PT400' using message = 'invalid_medicine_uuid';
  end if;
  if requested_id is null or char_length(requested_id) not between 1 and 64 then
    raise sqlstate 'PT400' using message = 'invalid_patient_id';
  end if;
  if p_overdue_minutes is null or p_overdue_minutes < 0 then
    raise sqlstate 'PT400' using message = 'invalid_overdue_minutes';
  end if;
  if char_length(intake_notes) > 4000 then
    raise sqlstate 'PT400' using message = 'invalid_medicine_notes';
  end if;

  if exists (
    select 1
    from unnest(p_complications) as requested(slug)
    left join public.object6_medicine_complications() c on c.slug = requested.slug
    where c.slug is null
  ) then
    raise sqlstate 'PT400' using message = 'invalid_complications';
  end if;

  select coalesce(array_agg(c.slug order by c.slug), '{}'::text[]),
    coalesce(max(c.minimum_severity), 1)
  into intake_complications, complication_severity
  from public.object6_medicine_complications() c
  where c.slug = any(p_complications);

  begin
    select u."UUID" into strict patient
    from public.object6_users u
    where lower(btrim(u.id_number::text)) = requested_id;
  exception
    when no_data_found then
      raise sqlstate 'PT404' using message = 'patient_not_found';
    when too_many_rows then
      raise sqlstate 'PT409' using message = 'patient_id_ambiguous';
  end;

  select m.* into existing from public.object6_medicine m where m.uuid = p_uuid;
  if not found then
    diagnosis_severity := greatest(
      case
        when p_overdue_minutes > 10 then 4
        when p_overdue_minutes > 5 then 3
        when p_overdue_minutes > 0 then 2
        else 1
      end,
      complication_severity
    );

    -- Use the first UUID word as the index into the sorted matching diagnoses.
    select ranked.slug into diagnosis
    from (
      select d.slug, row_number() over (order by d.slug collate "C") as position,
        count(*) over () as total
      from public.object6_diseases d
      where d.severity = diagnosis_severity
    ) ranked
    where ranked.position = (('x' || left(p_uuid::text, 8))::bit(32)::bigint % ranked.total) + 1;

    if not found then
      raise sqlstate 'PT503' using message = 'medicine_catalog_unavailable';
    end if;
    if p_expected_diagnosis is not null and p_expected_diagnosis <> diagnosis then
      raise sqlstate 'PT409' using message = 'medicine_diagnosis_changed';
    end if;

    insert into public.object6_medicine (
      uuid, patient_uuid, diagnosis_slug, severity, overdue_minutes, complications, notes, admitted_by
    ) values (
      p_uuid, patient, diagnosis, diagnosis_severity, p_overdue_minutes, intake_complications,
      intake_notes, medic
    ) on conflict (uuid) do nothing;
    select m.* into strict existing from public.object6_medicine m where m.uuid = p_uuid;
  end if;

  if existing.patient_uuid <> patient
    or existing.admitted_by <> medic
    or existing.overdue_minutes <> p_overdue_minutes
    or existing.complications <> intake_complications
    or existing.notes <> intake_notes then
    raise sqlstate 'PT409' using message = 'medicine_conflict';
  end if;
  if p_expected_diagnosis is not null and p_expected_diagnosis <> existing.diagnosis_slug then
    raise sqlstate 'PT409' using message = 'medicine_diagnosis_changed';
  end if;

  select to_jsonb(c) into strict result
  from object6_private.medicine_case_details c
  where c.uuid = p_uuid;
  return result;
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

notify pgrst, 'reload schema';
commit;
