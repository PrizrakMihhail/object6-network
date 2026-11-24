begin;

create or replace function public.object6_message_notifications(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  recipient uuid := object6_private.require_user(p_token);
  notifications jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(recent) order by sent desc nulls last, uuid desc), '[]'::jsonb)
  into notifications
  from (
    select m."UUID" as uuid, coalesce(u.username, m."from"::text) as sender,
      left(m.title, 120) as title, left(m.message, 180) as preview, m.sent
    from public.object6_messages m
    left join public.object6_users u on u."UUID" = m."from"
    where m."to" = recipient and m.unread = 'Yes'
    order by m.sent desc nulls last, m."UUID" desc
    limit 12
  ) recent;
  return notifications;
end;
$$;

revoke execute on function public.object6_message_notifications(text) from public;
grant execute on function public.object6_message_notifications(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
