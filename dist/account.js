import config from './supabase-config.js';

const byId = id => document.getElementById(id);
const accountDialog = byId('accessDialog');
const composeDialog = byId('composeDialog');
const inboxDialog = byId('inboxDialog');
const loginForm = byId('loginForm');
const registrationForm = byId('registrationForm');
const composeForm = byId('composeForm');
const accountProfile = byId('accountProfile');
const accountStatus = byId('accountStatus');
const composeStatus = byId('composeStatus');
const inboxStatus = byId('inboxStatus');
const inboxList = byId('inboxList');
const messageDetail = byId('messageDetail');
const logoutButton = byId('logoutButton');
const rolePicker = registrationForm.querySelector('details');
const sessionKey = 'object6-session';
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
const encoder = new TextEncoder();

const errors = {
  invalid_credentials: 'Неверное имя пользователя или пароль.',
  login_throttled: 'Слишком много попыток входа. Попробуйте через минуту.',
  invalid_registration: 'Проверьте имя, код документа и пароль.',
  invalid_roles: 'Выберите хотя бы одну роль.',
  invalid_secret_length: 'Пароль и слово для взлома могут занимать до 72 байт каждое.',
  identity_taken: 'Это имя пользователя или код документа уже заняты.',
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

async function rpc(name, params) {
  if (!config) throw new Error('service_unavailable');
  const response = await fetch(new URL(`/rest/v1/rpc/object6_${name}`, config.url), {
    method: 'POST',
    headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000)
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
    clearInbox();
  }
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

function showMail(target) {
  if (target === 'inbox') openInbox();
  else {
    setStatus(composeStatus);
    composeDialog.showModal();
  }
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
    showMail(target);
  } else {
    requireLogin(target, target === 'inbox' ? 'Войдите, чтобы открыть входящие.' : 'Войдите, чтобы отправить сообщение.');
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
  if (target) showMail(target);
  else showNotice('Вы вошли в сеть.');
});

function updateRoles() {
  const roles = new FormData(registrationForm).getAll('role');
  byId('selectedRoles').textContent = roles.join(', ') || 'Выберите одну или несколько';
}

onSubmit(registrationForm, accountStatus, async data => {
  const username = data.get('username').trim();
  const idNumber = data.get('id_number').trim();
  const roles = data.getAll('role');
  const password = data.get('password');
  const hackWord = data.get('hack_word').trim();
  if (!username || !idNumber) throw new Error('invalid_registration');
  if (!roles.length) {
    rolePicker.open = true;
    rolePicker.querySelector('summary').focus();
    throw new Error('invalid_roles');
  }
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

onSubmit(composeForm, composeStatus, async data => {
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
    composeDialog.close();
    showNotice('Сообщение отправлено.');
  } catch (error) {
    if (token !== sessionToken) return;
    if (error.message === 'message_conflict') pendingSend = null;
    handleMailError(error, composeStatus, composeDialog, 'compose');
  }
});

function messageMetadata(message) {
  const time = message.sent ? new Date(message.sent) : null;
  const sender = message.sender || 'Неизвестный отправитель';
  return time && Number.isFinite(time.getTime()) ? `${sender} · ${dateFormat.format(time)}` : sender;
}

function inboxItem(message) {
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
  button.addEventListener('click', () => openMessage(message, button, meta));
  item.append(button);
  return item;
}

function clearInbox() {
  inboxVersion++;
  activeMessageButton = null;
  inboxList.replaceChildren();
  inboxList.hidden = false;
  messageDetail.hidden = true;
  for (const id of ['messageTitle', 'messageMeta', 'messageBody']) byId(id).textContent = '';
  setStatus(inboxStatus);
}

async function openInbox() {
  clearInbox();
  const version = inboxVersion;
  inboxDialog.showModal();
  setStatus(inboxStatus, 'Загрузка сообщений…');
  try {
    const messages = await rpc('inbox', { p_token: sessionToken });
    if (version !== inboxVersion || !inboxDialog.open) return;
    inboxList.replaceChildren(...messages.map(inboxItem));
    setStatus(inboxStatus, messages.length ? '' : 'Входящих сообщений нет.');
  } catch (error) {
    if (version === inboxVersion && inboxDialog.open) handleMailError(error, inboxStatus, inboxDialog, 'inbox');
  }
}

async function openMessage(message, button, meta) {
  const version = ++inboxVersion;
  setStatus(inboxStatus, 'Загрузка сообщения…');
  try {
    const detail = await rpc('read_message', { p_token: sessionToken, p_uuid: message.uuid });
    if (version !== inboxVersion || !inboxDialog.open) return;
    button.removeAttribute('data-unread');
    meta.textContent = messageMetadata(detail);
    activeMessageButton = button;
    byId('messageTitle').textContent = detail.title || 'Без темы';
    byId('messageMeta').textContent = messageMetadata(detail);
    byId('messageBody').textContent = detail.message;
    inboxList.hidden = true;
    messageDetail.hidden = false;
    setStatus(inboxStatus);
    byId('messageTitle').focus();
  } catch (error) {
    if (version === inboxVersion && inboxDialog.open) handleMailError(error, inboxStatus, inboxDialog, 'inbox');
  }
}

byId('accessButton').addEventListener('click', () => openNetwork('account'));
byId('composeButton').addEventListener('click', () => openNetwork('compose'));
byId('inboxButton').addEventListener('click', () => openNetwork('inbox'));
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
