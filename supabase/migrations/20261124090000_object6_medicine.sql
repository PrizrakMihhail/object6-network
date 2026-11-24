begin;

create table public.object6_diseases (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  severity smallint not null check (severity between 1 and 4),
  description text not null,
  symptoms text not null,
  lab_notes text,
  treatment text not null
);

create table public.object6_medicine (
  uuid uuid primary key,
  patient_uuid uuid not null references public.object6_users ("UUID"),
  diagnosis_slug text not null references public.object6_diseases (slug),
  severity smallint not null check (severity between 1 and 4),
  overdue_minutes integer not null check (overdue_minutes >= 0),
  complications text[] not null default '{}',
  notes text not null default '' check (char_length(notes) <= 4000),
  admitted_at timestamptz not null default now(),
  admitted_by uuid not null references public.object6_users ("UUID")
);

create index object6_medicine_patient_history
  on public.object6_medicine (patient_uuid, admitted_at desc, uuid desc);
create index object6_medicine_recent
  on public.object6_medicine (admitted_at desc, uuid desc);

-- Account registration roles are self-selected. Assign access from the SQL editor:
-- insert into object6_private.medicine_staff (user_uuid)
-- select "UUID" from public.object6_users where id_number::text = '<exact staff ID>'
-- on conflict do nothing;
create table object6_private.medicine_staff (
  user_uuid uuid primary key references public.object6_users ("UUID") on delete cascade
);

alter table public.object6_diseases enable row level security;
alter table public.object6_medicine enable row level security;
alter table object6_private.medicine_staff enable row level security;

revoke all on public.object6_diseases, public.object6_medicine, object6_private.medicine_staff
  from public, anon, authenticated;
grant select on public.object6_diseases to anon, authenticated;
create policy object6_diseases_catalog on public.object6_diseases
  for select to anon, authenticated using (true);

create view object6_private.medicine_case_details as
  select m.uuid, m.patient_uuid, patient.username as patient_name,
    patient.id_number::text as patient_id, m.diagnosis_slug, d.name as diagnosis_name,
    m.severity, m.overdue_minutes, m.complications, m.notes, m.admitted_at,
    staff.username as admitted_by_name
  from public.object6_medicine m
  join public.object6_users patient on patient."UUID" = m.patient_uuid
  join public.object6_users staff on staff."UUID" = m.admitted_by
  join public.object6_diseases d on d.slug = m.diagnosis_slug;

revoke all on object6_private.medicine_case_details from public, anon, authenticated;

create function public.object6_medicine_complications()
returns table (slug text, name text, minimum_severity integer)
language sql immutable set search_path = ''
as $$
  values
    ('monster_wound', 'Ранение существом Запретной зоны', 3),
    ('gunshot', 'Огнестрельное ранение', 3),
    ('radioactive_object', 'Контакт с радиоактивным объектом', 3),
    ('chemical_exposure', 'Контакт с химическим загрязнением', 2),
    ('severe_bleeding', 'Сильное кровотечение', 4),
    ('joint_trauma', 'Травма сустава', 2),
    ('loss_of_consciousness', 'Потеря сознания', 4);
$$;

create function public.object6_medicine_cases(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  viewer uuid := object6_private.require_user(p_token);
  can_admit boolean;
  cases jsonb;
begin
  if viewer is null then
    raise sqlstate 'PT401' using message = 'session_expired';
  end if;

  select exists (select 1 from object6_private.medicine_staff s where s.user_uuid = viewer)
  into can_admit;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.admitted_at desc, c.uuid desc), '[]'::jsonb)
  into cases
  from object6_private.medicine_case_details c
  where can_admit or c.patient_uuid = viewer;

  return jsonb_build_object('can_admit', can_admit, 'cases', cases);
end;
$$;

create function public.object6_medicine_admit(
  p_token text, p_uuid uuid, p_patient_id text, p_overdue_minutes integer,
  p_complications text[], p_notes text
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
  if not exists (select 1 from object6_private.medicine_staff s where s.user_uuid = medic) then
    raise sqlstate 'PT403' using message = 'medicine_access_denied';
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
        when p_overdue_minutes >= 15 then 4
        when p_overdue_minutes >= 10 then 3
        when p_overdue_minutes >= 5 then 2
        else 1
      end,
      complication_severity
    );

    select d.slug into diagnosis
    from public.object6_diseases d
    where d.severity = diagnosis_severity
    order by random()
    limit 1;

    if not found then
      raise sqlstate 'PT503' using message = 'medicine_catalog_unavailable';
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

  select to_jsonb(c) into strict result
  from object6_private.medicine_case_details c
  where c.uuid = p_uuid;
  return result;
end;
$$;

revoke execute on function public.object6_medicine_complications(), public.object6_medicine_cases(text),
  public.object6_medicine_admit(text, uuid, text, integer, text[], text) from public;
grant execute on function public.object6_medicine_complications(), public.object6_medicine_cases(text),
  public.object6_medicine_admit(text, uuid, text, integer, text[], text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
