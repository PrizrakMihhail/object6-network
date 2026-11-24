import { requestData } from '../shared/supabase-api.js';

const byId = id => document.getElementById(id);
const sections = [...document.querySelectorAll('.medicine-section')];
const navLinks = [...document.querySelectorAll('.medicine-nav a')];
const admission = byId('admissionDialog');
const admissionForm = byId('admissionForm');
const openAdmission = byId('newAdmission');
const submit = byId('admissionSubmit');
const cancel = byId('admissionCancel');
const patientDialog = byId('patientDialog');
const patientList = byId('patientList');
const diseaseList = byId('diseaseList');
const status = byId('medicineStatus');
const admissionStatus = byId('admissionStatus');
const dateFormat = new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeStyle: 'short' });
const numbers = new Intl.NumberFormat('ru');
const severityNames = ['Минимальная', 'Лёгкая', 'Тяжёлая', 'Угрожающая жизни'];
const errors = {
  session_expired: 'Сессия истекла. Войдите в Сеть снова.',
  medicine_access_denied: 'Для регистрации поступлений нужен доступ медика.',
  invalid_patient_id: 'Укажите корректный ID пациента.',
  patient_not_found: 'Пациент с таким ID не найден.',
  patient_id_ambiguous: 'Этому ID соответствует несколько игроков. Уточните ID.',
  invalid_overdue_minutes: 'Укажите просрочку целым числом минут.',
  invalid_complications: 'Набор осложнений устарел. Обновите страницу и повторите.',
  invalid_medicine_notes: 'Комментарий должен занимать не более 4000 символов.',
  medicine_conflict: 'Не удалось повторить поступление с изменёнными данными. Проверьте карту пациента.',
  medicine_catalog_unavailable: 'Справочник диагнозов недоступен.',
  service_unavailable: 'База Медблока пока недоступна.'
};

let token;
try { token = sessionStorage.getItem('object6-session'); } catch { /* The catalog stays accessible. */ }
let cases = [];
let diseases = [];
let complications = [];
let canAdmit = false;
let caseLoadError = '';
let diseaseLoadError = '';
const admissionDrafts = new Map();
let submitting = false;

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content != null) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function setStatus(node, message = '', error = false) {
  node.textContent = message;
  node.hidden = !message;
  node.toggleAttribute('data-error', error);
}

function messageFor(error) {
  return Object.hasOwn(errors, error.message) ? errors[error.message] : 'Ошибка связи с базой. Попробуйте ещё раз.';
}

async function read(path, options) {
  const response = await requestData(path, { ...options, timeout: 10000 });
  const data = await response.json();
  if (!response.ok) {
    const missing = ['PGRST202', 'PGRST205', '42P01'].includes(data?.code);
    throw new Error(missing || response.status === 404 && !data?.message ? 'service_unavailable' : data?.message);
  }
  return data;
}

function rpc(name, params) {
  return read(`rpc/object6_medicine_${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
}

function showSection(focus = false) {
  const selected = sections.find(section => `#${section.id}` === location.hash) ?? sections[0];
  for (const section of sections) section.hidden = section !== selected;
  for (const link of navLinks) {
    if (link.hash === `#${selected.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  if (focus && location.hash !== '#medicineMain') {
    selected.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function listItems(list, items, emptyMessage) {
  list.replaceChildren(...(items.length ? items : [element('li', emptyMessage, 'medicine-empty')]));
  list.setAttribute('aria-busy', 'false');
}

function searchable(query, ...fields) {
  return fields.join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'));
}

function severityBadge(severity) {
  const badge = element('span', severityNames[severity - 1] ?? '—', 'medicine-severity');
  badge.dataset.severity = severity;
  return badge;
}

function patientGroups() {
  const groups = new Map();
  for (const record of cases) {
    if (!groups.has(record.patient_uuid)) groups.set(record.patient_uuid, []);
    groups.get(record.patient_uuid).push(record);
  }
  return [...groups.values()];
}

function renderPatients() {
  const groups = patientGroups();
  const query = byId('patientSearch').value;
  const rows = groups.filter(([record]) => searchable(query, record.patient_name, record.patient_id))
    .map(records => {
      const latest = records[0];
      const row = element('li');
      const button = element('button', null, 'medicine-patient-row');
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'dialog');
      const identity = element('span');
      identity.append(element('strong', latest.patient_name || 'Пациент'), element('small', `ID ${latest.patient_id ?? '—'} · Поступлений: ${numbers.format(records.length)}`));
      const diagnosis = element('span', `Последний диагноз: ${latest.diagnosis_name}`, 'medicine-patient-diagnosis');
      button.append(identity, diagnosis, severityBadge(latest.severity));
      button.addEventListener('click', () => openPatient(records));
      row.append(button);
      return row;
    });
  listItems(patientList, rows, caseLoadError || (query ? 'Пациенты по этому запросу не найдены.' : 'Поступлений пока нет.'));
}

function appendNote(parent, label, content) {
  const block = element('div', null, 'medicine-record-note');
  block.append(element('strong', label), element('p', content || '—'));
  parent.append(block);
}

function openPatient(records) {
  const latest = records[0];
  const name = latest.patient_name || 'Пациент';
  const record = byId('patientRecord');
  byId('patientDialogTitle').textContent = `Карта пациента · ${name}`;
  const identity = element('p', `ID ${latest.patient_id ?? '—'} · Всего поступлений: ${numbers.format(records.length)}`, 'medicine-record-identity');
  const history = element('ol', null, 'medicine-history');
  for (const episode of records) {
    const item = element('li', null, 'medicine-case');
    const heading = element('div', null, 'medicine-case-head');
    heading.append(element('h3', episode.diagnosis_name), severityBadge(episode.severity));
    const admitted = dateFormat.format(new Date(episode.admitted_at));
    item.append(heading, element('p', `${admitted} · Просрочка: ${episode.overdue_minutes} мин`, 'medicine-case-meta'));
    if (episode.admitted_by_name) appendNote(item, 'Медик', episode.admitted_by_name);
    const names = (episode.complications ?? []).map(slug => complications.find(option => option.slug === slug)?.name ?? slug);
    appendNote(item, 'Осложнения', names.join(', ') || 'Без осложнений');
    appendNote(item, 'Комментарий медика', episode.notes);
    history.append(item);
  }
  record.replaceChildren(identity, history);
  patientDialog.showModal();
}

function renderDiseases() {
  const query = byId('diseaseSearch').value;
  const rows = diseases.filter(disease => searchable(query, disease.name, disease.description, disease.symptoms, disease.treatment))
    .map(disease => {
      const row = element('li', null, 'medicine-disease');
      const heading = element('div', null, 'medicine-case-head');
      heading.append(element('h2', disease.name), severityBadge(disease.severity));
      row.append(heading, element('p', disease.description));
      appendNote(row, 'Симптомы', disease.symptoms);
      appendNote(row, 'Лечение', disease.treatment);
      return row;
    });
  listItems(diseaseList, rows, diseaseLoadError || (query ? 'Болезни по этому запросу не найдены.' : 'Справочник пока пуст.'));
}

function renderLab() {
  const labList = byId('laboratoryList');
  const labStatus = byId('laboratoryStatus');
  const entries = diseases.filter(disease => disease.lab_notes);
  labList.hidden = !entries.length;
  labStatus.hidden = !!entries.length;
  labStatus.textContent = diseaseLoadError || 'Справочных данных пока нет.';
  listItems(labList, entries.map(disease => {
    const row = element('li', null, 'medicine-disease');
    row.append(element('h2', disease.name), element('p', disease.lab_notes));
    return row;
  }), labStatus.textContent);
}

function renderComplications() {
  byId('complicationOptions').replaceChildren(...complications.map(option => {
    const label = element('label', null, 'medicine-option');
    const input = element('input');
    input.type = 'checkbox';
    input.name = 'complications';
    input.value = option.slug;
    label.append(input, element('span', option.name));
    return label;
  }));
}

function setAdmissionAccess() {
  openAdmission.disabled = !canAdmit || !complications.length;
}

function updateCaseCounts() {
  byId('patientCount').textContent = numbers.format(patientGroups().length);
  byId('admissionCount').textContent = numbers.format(cases.length);
}

async function loadMedicine() {
  setStatus(status, 'Загрузка Медблока…');
  const [catalog, options, history] = await Promise.allSettled([
    read('object6_diseases', {
      query: { select: 'slug,name,severity,description,symptoms,treatment,lab_notes', order: 'severity.asc,name.asc' }
    }),
    rpc('complications', {}),
    token ? rpc('cases', { p_token: token }) : null
  ]);
  if (catalog.status === 'fulfilled') {
    diseases = catalog.value;
    byId('diseaseCount').textContent = numbers.format(diseases.length);
  } else diseaseLoadError = messageFor(catalog.reason);
  if (options.status === 'fulfilled') {
    complications = options.value;
    renderComplications();
  }
  if (history.status === 'fulfilled' && history.value) {
    cases = history.value.cases;
    canAdmit = history.value.can_admit;
    updateCaseCounts();
  } else {
    caseLoadError = history.status === 'rejected' ? messageFor(history.reason) : 'Войдите в Сеть, чтобы открыть карты пациентов.';
  }
  setAdmissionAccess();
  renderPatients();
  renderDiseases();
  renderLab();
  const error = diseaseLoadError || (history.status === 'rejected' ? caseLoadError : '')
    || (canAdmit && options.status === 'rejected' ? messageFor(options.reason) : '');
  setStatus(status, error || caseLoadError || (!canAdmit ? 'Доступна ваша карта пациента. Регистрация поступлений доступна медикам.' : ''), !!error);
}

openAdmission.addEventListener('click', () => {
  setStatus(admissionStatus);
  admission.showModal();
  byId('patientId').focus();
});
cancel.addEventListener('click', () => admission.close());
admission.addEventListener('cancel', event => {
  if (submitting) event.preventDefault();
});
admissionForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !canAdmit || !token) return;
  const data = new FormData(admissionForm);
  const payload = {
    p_patient_id: data.get('id_number').trim(),
    p_overdue_minutes: Number(data.get('overdue_minutes')),
    p_complications: data.getAll('complications'),
    p_notes: data.get('notes')
  };
  const key = JSON.stringify(payload);
  if (!admissionDrafts.has(key)) admissionDrafts.set(key, crypto.randomUUID());
  submitting = true;
  submit.disabled = cancel.disabled = true;
  setStatus(admissionStatus, 'Рассчитываю критичность и сохраняю поступление…');
  try {
    const record = await rpc('admit', { ...payload, p_token: token, p_uuid: admissionDrafts.get(key) });
    admissionDrafts.delete(key);
    cases = [record, ...cases.filter(item => item.uuid !== record.uuid)];
    updateCaseCounts();
    renderPatients();
    admissionForm.reset();
    admission.close();
    setStatus(status, `Поступление зарегистрировано. Диагноз: ${record.diagnosis_name}.`);
    openPatient(patientGroups().find(group => group[0].patient_uuid === record.patient_uuid));
  } catch (error) {
    if (['session_expired', 'medicine_access_denied'].includes(error.message)) {
      canAdmit = false;
      setAdmissionAccess();
    }
    setStatus(admissionStatus, messageFor(error), true);
  } finally {
    submitting = false;
    submit.disabled = !canAdmit;
    cancel.disabled = false;
  }
});

byId('patientSearch').addEventListener('input', renderPatients);
byId('diseaseSearch').addEventListener('input', renderDiseases);
byId('printRecord').addEventListener('click', () => window.print());
window.addEventListener('hashchange', () => showSection(true));
showSection();
loadMedicine();
