import { requestData } from '../shared/supabase-api.js';

const byId = id => document.getElementById(id);
const accountDialog = byId('accessDialog');
const inboxDialog = byId('inboxDialog');
const loginForm = byId('loginForm');
const registrationForm = byId('registrationForm');
const composeForm = byId('composeForm');
const accountProfile = byId('accountProfile');
const accountStatus = byId('accountStatus');
const inboxStatus = byId('inboxStatus');
const inboxList = byId('inboxList');
const messageDetail = byId('messageDetail');
const logoutButton = byId('logoutButton');
const rolePicker = registrationForm.querySelector('details');
const notifications = byId('messageNotifications');
const mailUnread = byId('mailUnread');
const mailTabs = document.querySelectorAll('[data-mail-view]');
const sessionKey = 'object6-session';
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
const encoder = new TextEncoder();

const errors = {
  invalid_credentials: 'Неверное имя пользователя или пароль.',
  login_throttled: 'Слишком много попыток входа. Попробуйте через минуту.',
  invalid_registration: 'Проверьте имя, код документа и пароль.',
  invalid_roles: 'Выберите хотя бы одну роль.',
  restricted_roles: 'Роль MEDIC назначается администратором.',
  invalid_secret_length: 'Пароль и слово для взлома могут занимать до 72 байт каждое.',
  identity_taken: 'Это имя пользователя или код документа уже заняты.',
  document_registered: 'Не удалось зарегистрироваться. Пользователь с таким ID уже существует и имеет пароль.',
  document_ambiguous: 'С этим кодом документа найдено несколько профилей. Обратитесь к администратору.',
  activation_requires_admin: 'Для профиля с ролью MEDIC пароль задаёт администратор.',
  session_expired: 'Сессия истекла. Войдите снова.',
  invalid_message: 'Заполните поля «Кому», «Тема» и «Сообщение».',
  recipient_not_found: 'Получатель с таким именем или кодом документа не найден.',
  recipient_ambiguous: 'Найдено несколько получателей. Укажите другое имя или код документа.',
  message_conflict: 'Не удалось отправить сообщение. Повторите отправку.',
  message_not_found: 'Сообщение больше недоступно.',
  service_unavailable: 'Служба аккаунтов и сообщений ещё не подключена.'
};

let sessionToken = null;
try { sessionToken = sessionStorage.getItem(sessionKey); } catch { /* Storage can be disabled. */ }

let profile = null;
let loginTarget = null;
let inboxVersion = 0;
let activeMessageButton = null;
let pendingSend = null;
let noticeTimer;
let mailTimer;
let notificationRequest;
let shownNotifications = new Set();
let readMessages = new Set();
let unreadMessages = new Set();
let inboxLoaded = false;
let mailView = 'inbox';
let openedMessage = null;
const replyButton = byId('replyMessage');
const deleteButton = byId('deleteMessage');
const recipientInput = composeForm.elements.namedItem('to');

async function rpc(name, params) {
  const response = await requestData(`rpc/object6_${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    timeout: 10000
  });
  if (response.status === 204) return;
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.code === 'PGRST202' ? 'service_unavailable' : result?.message);
  }
  return result;
}

function setStatus(node, message = '', isError = false) {
  node.textContent = message;
  node.toggleAttribute('data-error', isError);
}

function showError(node, error) {
  const message = Object.hasOwn(errors, error.message) ? errors[error.message] : 'Ошибка связи с сервером. Попробуйте ещё раз.';
  setStatus(node, message, true);
}

function showNotice(message) {
  const notice = byId('networkNotice');
  notice.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.textContent = ''; }, 4500);
}

function setSession(token, user = null) {
  clearInterval(mailTimer);
  notificationRequest = null;
  if (!token || token !== sessionToken) {
    notifications.replaceChildren();
    shownNotifications = new Set();
    readMessages = new Set();
    unreadMessages = new Set();
    inboxLoaded = false;
    setUnreadCount(0);
  }
  sessionToken = token;
  profile = user;
  try {
    if (token) sessionStorage.setItem(sessionKey, token);
    else sessionStorage.removeItem(sessionKey);
  } catch { /* The session still works in memory. */ }

  byId('accountButtonLabel').textContent = user?.username ?? 'Войти';
  byId('profileUsername').textContent = user?.username ?? '';
  byId('profileRoles').textContent = user?.roles?.join(', ') || '—';
  if (!token) {
    pendingSend = null;
    composeForm.reset();
    recipientInput.readOnly = false;
    clearInbox();
  } else if (user) {
    loadNotifications(token);
    mailTimer = setInterval(() => loadNotifications(token), 60_000);
  }
}

function setUnreadCount(count) {
  mailUnread.textContent = count;
  mailUnread.hidden = count === 0;
  byId('mailButton').setAttribute('aria-label', `Почта, непрочитанных: ${count}`);
}

async function loadNotifications(token) {
  if (token !== sessionToken || notificationRequest) return;
  const request = {};
  notificationRequest = request;
  const version = inboxVersion;
  try {
    const messages = await rpc('message_notifications', { p_token: token });
    if (notificationRequest !== request) return;
    const unread = messages.filter(message => !readMessages.has(message.uuid));
    const newlyArrived = unread.some(message => !unreadMessages.has(message.uuid));
    unreadMessages = new Set(unread.map(message => message.uuid));
    setUnreadCount(unreadMessages.size);
    for (const card of [...notifications.children]) {
      if (!unreadMessages.has(card.dataset.uuid)) card.remove();
    }
    for (const message of unread) {
      if (shownNotifications.has(message.uuid)) continue;
      shownNotifications.add(message.uuid);
      showMessageNotification(message);
    }
    if (newlyArrived && version === inboxVersion && inboxLoaded && inboxDialog.open
      && mailView === 'inbox' && !inboxList.hidden) {
      selectMailView('inbox');
    }
  } catch (error) {
    if (notificationRequest !== request) return;
    if (error.message === 'session_expired') setSession(null);
    else console.warn('Message notifications unavailable:', error.message);
  } finally {
    if (notificationRequest === request) notificationRequest = null;
  }
}

function showMessageNotification(message) {
  const card = document.createElement('div');
  card.className = 'message-notification';
  card.dataset.uuid = message.uuid;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'message-notification-open';
  const sender = document.createElement('small');
  sender.textContent = message.sender || 'Неизвестный отправитель';
  const title = document.createElement('strong');
  title.textContent = message.title || 'Без темы';
  const preview = document.createElement('span');
  preview.textContent = message.preview || '';
  open.append(sender, title, preview);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'message-notification-dismiss';
  dismiss.textContent = '×';
  dismiss.setAttribute('aria-label', 'Закрыть уведомление');
  dismiss.addEventListener('click', () => card.remove());
  open.addEventListener('click', () => {
    card.remove();
    openMail(message.uuid);
  });

  card.append(open, dismiss);
  notifications.append(card);
}

async function restoreSession() {
  if (!sessionToken || profile) return;
  try {
    const user = await rpc('profile', { p_token: sessionToken });
    setSession(sessionToken, user);
  } catch (error) {
    if (error.message !== 'session_expired') throw error;
    setSession(null);
  }
}

let restoration = null;
function verifySession() {
  restoration ??= restoreSession().finally(() => { restoration = null; });
  return restoration;
}

function showAccount(mode, message = '') {
  const views = {
    login: ['Вход в сеть', loginForm, loginForm.elements.namedItem('username')],
    registration: ['Регистрация пользователя', registrationForm, registrationForm.elements.namedItem('username')],
    profile: ['Аккаунт', accountProfile, logoutButton]
  };
  const [title, section, focus] = views[mode];
  for (const view of [loginForm, registrationForm, accountProfile]) view.hidden = view !== section;
  byId('accountTitle').textContent = title;
  setStatus(accountStatus, message);
  if (!accountDialog.open) accountDialog.showModal();
  focus.focus();
}

function requireLogin(target, message) {
  loginTarget = target;
  showAccount('login', message);
}

async function openNetwork(target) {
  try {
    await verifySession();
  } catch (error) {
    requireLogin(target === 'account' ? null : target);
    showError(accountStatus, error);
    return;
  }

  if (target === 'account') {
    loginTarget = null;
    showAccount(profile ? 'profile' : 'login');
  } else if (profile) {
    openMail();
  } else {
    requireLogin(target, 'Войдите, чтобы открыть почту.');
  }
}

function onSubmit(form, status, submit) {
  const button = form.querySelector('button[type="submit"]');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    setStatus(status);
    try {
      await submit(new FormData(form));
    } catch (error) {
      showError(status, error);
    } finally {
      button.disabled = false;
    }
  });
}

onSubmit(loginForm, accountStatus, async data => {
  const password = data.get('password');
  if (encoder.encode(password).length > 72) throw new Error('invalid_secret_length');
  const result = await rpc('login', { p_username: data.get('username').trim(), p_password: password });
  if (result.error) throw new Error(result.error);
  setSession(result.token, result.profile);
  loginForm.reset();
  if (!accountDialog.open) return;
  const target = loginTarget;
  accountDialog.close();
  if (target) openMail();
  else showNotice('Вы вошли в сеть.');
});

function updateRoles() {
  const roles = new FormData(registrationForm).getAll('role');
  byId('selectedRoles').textContent = roles.join(', ') || 'Для нового профиля';
}

onSubmit(registrationForm, accountStatus, async data => {
  const username = data.get('username').trim();
  const idNumber = data.get('id_number').trim();
  const roles = data.getAll('role');
  const password = data.get('password');
  const hackWord = data.get('hack_word').trim();
  if (!username || !idNumber) throw new Error('invalid_registration');
  if ([password, hackWord].some(secret => encoder.encode(secret).length > 72)) {
    throw new Error('invalid_secret_length');
  }
  await rpc('register', {
    p_username: username, p_roles: roles, p_hack_word: hackWord || null, p_id_number: idNumber, p_password: password
  });
  registrationForm.reset();
  rolePicker.open = false;
  updateRoles();
  loginForm.elements.namedItem('username').value = username;
  if (accountDialog.open) {
    showAccount('login', 'Пользователь зарегистрирован. Войдите с новым паролем.');
    loginForm.elements.namedItem('password').focus();
  } else showNotice('Пользователь зарегистрирован.');
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  setStatus(accountStatus);
  try {
    await rpc('logout', { p_token: sessionToken });
    setSession(null);
    accountDialog.close();
    showNotice('Вы вышли из сети.');
  } catch (error) {
    showError(accountStatus, error);
  } finally {
    logoutButton.disabled = false;
  }
});

function handleMailError(error, status, dialog, target) {
  if (error.message === 'session_expired') {
    setSession(null);
    if (dialog.open) {
      dialog.close();
      requireLogin(target, errors.session_expired);
    }
  } else showError(status, error);
}

onSubmit(composeForm, inboxStatus, async data => {
  const recipient = data.get('to').trim();
  const title = data.get('title').trim();
  const message = data.get('message');
  if (!recipient || !title || !message.trim()) throw new Error('invalid_message');
  if (pendingSend?.recipient !== recipient || pendingSend.title !== title || pendingSend.message !== message) {
    pendingSend = { uuid: crypto.randomUUID(), recipient, title, message };
  }

  const token = sessionToken;
  try {
    await rpc('send_message', {
      p_token: token, p_uuid: pendingSend.uuid, p_recipient: recipient, p_title: title, p_message: message
    });
    if (token !== sessionToken) return;
    pendingSend = null;
    composeForm.reset();
    recipientInput.readOnly = false;
    if (inboxDialog.open && mailView === 'compose') selectMailView('sent');
    showNotice('Сообщение отправлено.');
  } catch (error) {
    if (token !== sessionToken) return;
    if (error.message === 'message_conflict') pendingSend = null;
    if (mailView === 'compose' || error.message === 'session_expired') {
      handleMailError(error, inboxStatus, inboxDialog, 'mail');
    }
  }
});

function messageMetadata(message) {
  const time = message.sent ? new Date(message.sent) : null;
  const contact = message.recipient ? `Кому: ${message.recipient}` : message.sender || 'Неизвестный отправитель';
  return time && Number.isFinite(time.getTime()) ? `${contact} · ${dateFormat.format(time)}` : contact;
}

function inboxItem(message, sent) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  const subject = document.createElement('strong');
  const meta = document.createElement('span');
  button.type = 'button';
  button.toggleAttribute('data-unread', message.unread);
  subject.textContent = message.title || 'Без темы';
  meta.className = 'network-muted';
  meta.textContent = messageMetadata(message) + (message.unread ? ' · Не прочитано' : '');
  button.append(subject, meta);
  button.addEventListener('click', () => {
    if (sent) showMessageDetail(message, button);
    else openMessage(message, button, meta);
  });
  item.append(button);
  return item;
}

function clearInbox() {
  inboxVersion++;
  activeMessageButton = null;
  openedMessage = null;
  inboxList.replaceChildren();
  inboxList.hidden = false;
  messageDetail.hidden = true;
  for (const id of ['messageTitle', 'messageMeta', 'messageBody']) byId(id).textContent = '';
  setStatus(inboxStatus);
}

function openMail(messageUuid) {
  if (!inboxDialog.open) inboxDialog.showModal();
  selectMailView('inbox', messageUuid);
}

async function selectMailView(view, messageUuid, reply) {
  clearInbox();
  mailView = view;
  for (const tab of mailTabs) tab.setAttribute('aria-pressed', String(tab.dataset.mailView === view));
  composeForm.hidden = view !== 'compose';
  if (!composeForm.hidden) {
    inboxList.hidden = true;
    if (reply) {
      composeForm.reset();
      recipientInput.value = reply.sender;
      recipientInput.readOnly = true;
      const originalTitle = Array.from(reply.title || 'Без темы').slice(0, 116).join('');
      composeForm.elements.namedItem('title').value = `Re: ${originalTitle}`;
      composeForm.elements.namedItem('message').focus();
    } else {
      if (recipientInput.readOnly) composeForm.reset();
      recipientInput.readOnly = false;
      recipientInput.focus();
    }
    return;
  }
  const sent = view === 'sent';
  const version = inboxVersion;
  setStatus(inboxStatus, 'Загрузка сообщений…');
  try {
    const messages = await rpc(sent ? 'sent_messages' : 'inbox', { p_token: sessionToken });
    if (version !== inboxVersion || !inboxDialog.open) return;
    if (!sent) {
      inboxLoaded = true;
      unreadMessages = new Set(messages.filter(message => message.unread && !readMessages.has(message.uuid)).map(message => message.uuid));
      setUnreadCount(unreadMessages.size);
      for (const card of [...notifications.children]) {
        if (!unreadMessages.has(card.dataset.uuid)) card.remove();
      }
    }
    inboxList.replaceChildren(...messages.map(message => inboxItem(message, sent)));
    setStatus(inboxStatus, messages.length ? '' : sent ? 'Отправленных сообщений нет.' : 'Входящих сообщений нет.');
    if (messageUuid) {
      const index = messages.findIndex(message => message.uuid === messageUuid);
      if (index >= 0) inboxList.children[index].firstElementChild.click();
    }
  } catch (error) {
    if (version === inboxVersion && inboxDialog.open) handleMailError(error, inboxStatus, inboxDialog, 'mail');
  }
}

async function openMessage(message, button, meta) {
  const version = ++inboxVersion;
  const token = sessionToken;
  setStatus(inboxStatus, 'Загрузка сообщения…');
  try {
    const detail = await rpc('read_message', { p_token: token, p_uuid: message.uuid });
    if (token !== sessionToken) return;
    readMessages.add(message.uuid);
    unreadMessages.delete(message.uuid);
    setUnreadCount(unreadMessages.size);
    Array.from(notifications.children).find(card => card.dataset.uuid === message.uuid)?.remove();
    button.removeAttribute('data-unread');
    meta.textContent = messageMetadata(detail);
    if (version !== inboxVersion || !inboxDialog.open) return;
    showMessageDetail(detail, button);
  } catch (error) {
    if (version === inboxVersion && inboxDialog.open) handleMailError(error, inboxStatus, inboxDialog, 'mail');
  }
}

function showMessageDetail(detail, button) {
  activeMessageButton = button;
  openedMessage = detail;
  replyButton.hidden = mailView !== 'inbox' || !detail.sender || detail.sender_is_guest === true;
  byId('messageTitle').textContent = detail.title || 'Без темы';
  byId('messageMeta').textContent = messageMetadata(detail);
  byId('messageBody').textContent = detail.message;
  inboxList.hidden = true;
  messageDetail.hidden = false;
  setStatus(inboxStatus);
  byId('messageTitle').focus();
}

replyButton.addEventListener('click', () => {
  if (!replyButton.hidden && openedMessage?.sender) selectMailView('compose', undefined, openedMessage);
});

deleteButton.addEventListener('click', async () => {
  const message = openedMessage;
  if (!message || deleteButton.disabled) return;
  const token = sessionToken;
  const view = mailView;
  deleteButton.disabled = true;
  setStatus(inboxStatus);
  try {
    await rpc('delete_message', { p_token: token, p_uuid: message.uuid, p_folder: view });
    if (token !== sessionToken) return;
    if (view === 'inbox') {
      readMessages.add(message.uuid);
      unreadMessages.delete(message.uuid);
      setUnreadCount(unreadMessages.size);
      Array.from(notifications.children).find(card => card.dataset.uuid === message.uuid)?.remove();
    }
    if (inboxDialog.open && mailView === view) selectMailView(view);
    showNotice('Письмо удалено.');
  } catch (error) {
    if (token === sessionToken) handleMailError(error, inboxStatus, inboxDialog, 'mail');
  } finally {
    deleteButton.disabled = false;
  }
});

byId('accessButton').addEventListener('click', () => openNetwork('account'));
byId('mailButton').addEventListener('click', () => openNetwork('mail'));
for (const tab of mailTabs) tab.addEventListener('click', () => selectMailView(tab.dataset.mailView));
byId('showRegistration').addEventListener('click', () => showAccount('registration'));
byId('showLogin').addEventListener('click', () => showAccount('login'));
rolePicker.addEventListener('change', updateRoles);
byId('backToInbox').addEventListener('click', () => {
  messageDetail.hidden = true;
  inboxList.hidden = false;
  activeMessageButton?.focus();
});

document.querySelectorAll('[data-close-network]').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog').close());
});
accountDialog.addEventListener('close', () => {
  loginTarget = null;
  loginForm.elements.namedItem('password').value = '';
  registrationForm.elements.namedItem('password').value = '';
  registrationForm.elements.namedItem('hack_word').value = '';
});
inboxDialog.addEventListener('close', clearInbox);
verifySession().catch(() => { /* Opening an account action retries a temporary connection failure. */ });
