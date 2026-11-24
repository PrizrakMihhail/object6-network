begin;

alter table public.object6_messages
  add column if not exists deleted_from_inbox boolean not null default false,
  add column if not exists deleted_from_sent boolean not null default false;

create or replace function public.object6_delete_message(p_token text, p_uuid uuid, p_folder text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  current_user_uuid uuid := object6_private.require_user(p_token);
begin
  if p_folder = 'inbox' then
    update public.object6_messages set deleted_from_inbox = true
    where "UUID" = p_uuid and "to" = current_user_uuid;
  elsif p_folder = 'sent' then
    update public.object6_messages set deleted_from_sent = true
    where "UUID" = p_uuid and "from" = current_user_uuid;
  else
    raise sqlstate 'PT400' using message = 'invalid_folder';
  end if;

  if not found then
    raise sqlstate 'PT404' using message = 'message_not_found';
  end if;
end;
$$;

create or replace function public.object6_inbox(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  recipient uuid := object6_private.require_user(p_token);
  messages jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'uuid', m."UUID", 'sender', coalesce(u.username, m."from"::text),
    'title', m.title, 'sent', m.sent, 'unread', m.unread = 'Yes'
  ) order by m.sent desc nulls last, m."UUID" desc), '[]'::jsonb)
  into messages
  from public.object6_messages m
  left join public.object6_users u on u."UUID" = m."from"
  where m."to" = recipient and not m.deleted_from_inbox;
  return messages;
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
  where m."from" = sender and not m.deleted_from_sent;
  return messages;
end;
$$;

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
  where m."to" = recipient and m.unread = 'Yes' and not m.deleted_from_inbox;
  return notifications;
end;
$$;

create or replace function public.object6_read_message(p_token text, p_uuid uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  recipient uuid := object6_private.require_user(p_token);
  message jsonb;
begin
  select jsonb_build_object(
    'uuid', m."UUID", 'sender', coalesce(u.username, m."from"::text),
    'title', m.title, 'sent', m.sent, 'message', m.message
  ) into message
  from public.object6_messages m
  left join public.object6_users u on u."UUID" = m."from"
  where m."UUID" = p_uuid and m."to" = recipient and not m.deleted_from_inbox;

  if not found then
    raise sqlstate 'PT404' using message = 'message_not_found';
  end if;

  update public.object6_messages set unread = 'No'
  where "UUID" = p_uuid and "to" = recipient and unread = 'Yes' and not deleted_from_inbox;
  return message;
end;
$$;

revoke execute on function public.object6_delete_message(text, uuid, text), public.object6_inbox(text),
  public.object6_sent_messages(text), public.object6_message_notifications(text), public.object6_read_message(text, uuid)
from public;
grant execute on function public.object6_delete_message(text, uuid, text), public.object6_inbox(text),
  public.object6_sent_messages(text), public.object6_message_notifications(text), public.object6_read_message(text, uuid)
to anon, authenticated;
notify pgrst, 'reload schema';
commit;
