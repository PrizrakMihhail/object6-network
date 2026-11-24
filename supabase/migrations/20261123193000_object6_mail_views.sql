begin;

create or replace function public.object6_message_notifications(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  recipient uuid := object6_private.require_user(p_token);
  notifications jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'uuid', m."UUID", 'sender', coalesce(u.username, m."from"::text),
    'title', left(m.title, 120), 'preview', left(m.message, 180), 'sent', m.sent
  ) order by m.sent desc nulls last, m."UUID" desc), '[]'::jsonb)
  into notifications
  from public.object6_messages m
  left join public.object6_users u on u."UUID" = m."from"
  where m."to" = recipient and m.unread = 'Yes';
  return notifications;
end;
$$;

create or replace function public.object6_sent_messages(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  sender uuid := object6_private.require_user(p_token);
  messages jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'uuid', m."UUID", 'recipient', coalesce(u.username, m."to"::text),
    'title', m.title, 'message', m.message, 'sent', m.sent
  ) order by m.sent desc nulls last, m."UUID" desc), '[]'::jsonb)
  into messages
  from public.object6_messages m
  left join public.object6_users u on u."UUID" = m."to"
  where m."from" = sender;
  return messages;
end;
$$;

create index if not exists object6_messages_sent_order
  on public.object6_messages ("from", sent desc nulls last, "UUID" desc);

revoke execute on function public.object6_message_notifications(text), public.object6_sent_messages(text) from public;
grant execute on function public.object6_message_notifications(text), public.object6_sent_messages(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
