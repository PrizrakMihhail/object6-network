begin;

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
  if not object6_private.has_medicine_staff_role(actor) then
    raise sqlstate 'PT403' using message = 'medicine_status_access_denied';
  end if;
  if p_status is null or p_status not in ('active', 'cured') then
    raise sqlstate 'PT400' using message = 'invalid_medicine_status';
  end if;

  update public.object6_medicine m
  set status = p_status
  where m.uuid = p_uuid;

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
