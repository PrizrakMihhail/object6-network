import { requestData } from '../shared/supabase-api.js';

const byId = id => document.getElementById(id);
const sections = [...document.querySelectorAll('.medicine-section')];
const navLinks = [...document.querySelectorAll('.medicine-nav a')];
const admission = byId('admissionDialog');
const admissionForm = byId('admissionForm');
const openAdmission = byId('newAdmission');
const analysisDialog = byId('analysisDialog');
const analysisStatus = byId('analysisStatus');
const analysisProgress = byId('analysisProgress');
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
  medicine_diagnosis_changed: 'Справочник изменился. Обновите страницу и запустите анализ снова.',
  medicine_catalog_unavailable: 'Справочник диагнозов недоступен.',
  invalid_medicine_status: 'Выберите допустимый статус болезни.',
  medicine_case_not_found: 'Это поступление больше недоступно.',
  service_unavailable: 'База Медблока пока недоступна.'
};

let token;
try { token = sessionStorage.getItem('object6-session'); } catch { /* The catalog stays accessible. */ }
let cases = [];
let diseases = [];
let complications = [];
let laboratory = [];
let access = 'public';
let canAdmit = false;
let caseLoadError = '';
let diseaseLoadError = '';
const admissionDrafts = new Map();
let analysis;

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
  const available = node => !node.dataset.medicineAccess || node.dataset.medicineAccess === access;
  const home = access === 'staff' ? 'overview' : 'diseases';
  const selected = sections.find(section => available(section) && `#${section.id}` === location.hash) ?? byId(home);
  byId('medicineBrand').hash = home;
  for (const section of sections) section.hidden = section !== selected;
  for (const link of navLinks) {
    link.hidden = !available(link);
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

function openDiseaseDescription(episode) {
  const disease = diseases.find(item => item.slug === episode.diagnosis_slug);
  byId('diseaseDetailsTitle').textContent = episode.diagnosis_name;
  const body = byId('diseaseDetailsBody');
  body.replaceChildren(severityBadge(episode.severity));
  if (disease) {
    body.append(element('p', disease.description));
    appendNote(body, 'Симптомы', disease.symptoms);
    appendNote(body, 'Лечение', disease.treatment);
  } else {
    body.append(element('p', 'Описание болезни сейчас недоступно.'));
  }
  byId('diseaseDetailsDialog').showModal();
}

function appendCaseControls(item, episode) {
  const badge = element('span', null, 'medicine-case-status');
  badge.setAttribute('role', 'status');
  const actions = element('div', null, 'medicine-case-actions');
  const change = element('button', null, 'medicine-button');
  change.type = 'button';
  const description = element('button', 'Описание болезни', 'medicine-button');
  description.type = 'button';
  description.setAttribute('aria-haspopup', 'dialog');
  description.addEventListener('click', () => openDiseaseDescription(episode));
  const feedback = element('p', null, 'medicine-status medicine-case-feedback');
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;

  function updateLabels() {
    const cured = episode.status === 'cured';
    badge.dataset.status = cured ? 'cured' : 'active';
    badge.textContent = cured ? 'Вылечена' : 'Активна';
    change.textContent = cured ? 'Вернуть статус «Активна»' : 'Отметить вылеченной';
  }

  change.addEventListener('click', async () => {
    if (change.disabled) return;
    change.disabled = true;
    setStatus(feedback, 'Сохранение статуса…');
    try {
      const { status } = await rpc('set_status', {
        p_token: token, p_uuid: episode.uuid, p_status: episode.status === 'cured' ? 'active' : 'cured'
      });
      episode.status = status;
      updateLabels();
      setStatus(feedback);
    } catch (error) {
      setStatus(feedback, messageFor(error), true);
    } finally {
      change.disabled = false;
    }
  });

  updateLabels();
  actions.append(change, description);
  item.append(badge, actions, feedback);
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
    appendCaseControls(item, episode);
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
  const entries = laboratory;
  labList.hidden = !entries.length;
  labStatus.hidden = !!entries.length;
  labStatus.textContent = 'Справочных данных пока нет.';
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
  openAdmission.disabled = !canAdmit || !complications.length || !diseases.length;
}

function updateCaseCounts() {
  byId('patientCount').textContent = numbers.format(patientGroups().length);
  byId('admissionCount').textContent = numbers.format(cases.length);
}

async function loadMedicine() {
  setStatus(status, 'Загрузка Медблока…');
  const [catalog, options, history] = await Promise.allSettled([
    read('object6_diseases', {
      query: { select: 'slug,name,severity,description,symptoms,treatment', order: 'severity.asc,name.asc' }
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
    const { staff } = history.value;
    if (typeof staff === 'boolean') {
      access = staff ? 'staff' : 'personal';
      canAdmit = staff && history.value.can_admit;
      cases = history.value.cases;
      laboratory = history.value.laboratory;
      byId('myRecordEmpty').hidden = cases.length > 0;
      byId('openMyRecord').hidden = !cases.length;
      updateCaseCounts();
    } else {
      caseLoadError = 'Настройки доступа к картам ещё не обновлены.';
    }
  } else {
    caseLoadError = history.status === 'rejected' ? messageFor(history.reason) : 'Войдите в Сеть, чтобы открыть карты пациентов.';
  }
  setAdmissionAccess();
  renderPatients();
  renderDiseases();
  renderLab();
  showSection();
  const error = diseaseLoadError || (history.status === 'rejected' ? caseLoadError : '')
    || (canAdmit && options.status === 'rejected' ? messageFor(options.reason) : '');
  setStatus(status, error || caseLoadError, !!error);
}

function showAdmission() {
  setStatus(admissionStatus);
  admission.showModal();
  byId('patientId').focus();
}

const analysisDuration = 10000;
const diagnosisDisplayTime = 650;

function setAnalysisPhase(run, phase) {
  run.phase = phase;
  byId('analysisScan').hidden = phase !== 'scanning';
  byId('analysisResult').hidden = phase === 'scanning';
  byId('analysisCancel').hidden = !['scanning', 'revealed'].includes(phase);
  byId('analysisBack').hidden = byId('analysisRetry').hidden = phase !== 'failed';
  for (const id of ['analysisRead', 'analysisNew', 'analysisClose']) byId(id).hidden = phase !== 'saved';
}

function updateAnalysis(run) {
  const elapsed = performance.now() - run.started;
  const progress = Math.min(100, Math.floor(elapsed / analysisDuration * 100));
  analysisProgress.value = progress;
  byId('analysisPercent').textContent = `${progress}%`;
  byId('analysisStage').textContent = progress < 35 ? 'Сверка показателей'
    : progress < 75 ? 'Сопоставление со справочником' : 'Уточнение диагноза';
  byId('analysisCandidate').textContent = run.pool[Math.floor(elapsed / 430) % run.pool.length].name;
}

function closeAnalysis(reopen = false) {
  clearInterval(analysis.interval);
  clearTimeout(analysis.timer);
  analysis = null;
  analysisDialog.close();
  if (reopen) showAdmission();
  else openAdmission.focus();
}

async function saveAnalysis(run) {
  setAnalysisPhase(run, 'saving');
  setStatus(analysisStatus, 'Сохранение поступления…');
  try {
    const record = await rpc('analyze', {
      ...run.payload, p_token: token, p_uuid: run.uuid, p_expected_diagnosis: run.diagnosis.slug
    });
    admissionDrafts.delete(run.key);
    cases = [record, ...cases.filter(item => item.uuid !== record.uuid)];
    updateCaseCounts();
    renderPatients();
    admissionForm.reset();
    run.record = record;
    setStatus(analysisStatus, 'Поступление зарегистрировано.');
    setAnalysisPhase(run, 'saved');
    byId('analysisRead').focus();
  } catch (error) {
    setAnalysisPhase(run, 'failed');
    setStatus(analysisStatus, messageFor(error), true);
    byId('analysisRetry').focus();
  }
}

openAdmission.addEventListener('click', showAdmission);
byId('admissionCancel').addEventListener('click', () => admission.close());
byId('analysisCancel').addEventListener('click', () => closeAnalysis(true));
byId('analysisBack').addEventListener('click', () => closeAnalysis(true));
byId('analysisRetry').addEventListener('click', () => saveAnalysis(analysis));
byId('analysisRead').addEventListener('click', () => {
  const { patient_uuid } = analysis.record;
  closeAnalysis();
  openPatient(patientGroups().find(group => group[0].patient_uuid === patient_uuid));
});
byId('analysisNew').addEventListener('click', () => closeAnalysis(true));
byId('analysisClose').addEventListener('click', () => closeAnalysis());
analysisDialog.addEventListener('cancel', event => {
  event.preventDefault();
  if (analysis.phase !== 'saving') closeAnalysis(analysis.phase !== 'saved');
});

admissionForm.addEventListener('submit', event => {
  event.preventDefault();
  if (analysis || !canAdmit || !token || !diseases.length) return;
  const data = new FormData(admissionForm);
  const overdue = data.get('overdue_minutes').trim();
  if (overdue !== '-' && (!/^\d+$/.test(overdue) || Number(overdue) > 2147483647)) {
    setStatus(admissionStatus, 'Введите целое число минут от 0 или «-», если просрочки не было.', true);
    byId('exposureMinutes').focus();
    return;
  }
  const payload = {
    p_patient_id: data.get('id_number').trim(),
    p_overdue_minutes: overdue === '-' ? 0 : Number(overdue),
    p_complications: data.getAll('complications'),
    p_notes: data.get('notes')
  };
  const key = JSON.stringify(payload);
  if (!admissionDrafts.has(key)) admissionDrafts.set(key, crypto.randomUUID());
  const minutes = payload.p_overdue_minutes;
  const exposure = minutes > 10 ? 4 : minutes > 5 ? 3 : minutes > 0 ? 2 : 1;
  const severity = Math.max(exposure, ...complications
    .filter(option => payload.p_complications.includes(option.slug))
    .map(option => option.minimum_severity));
  // Match the bytewise slug order and UUID index in the SQL function.
  const pool = diseases.filter(disease => disease.severity === severity);
  const slugs = pool.map(disease => disease.slug).sort();
  if (!slugs.length) {
    setStatus(admissionStatus, errors.medicine_catalog_unavailable, true);
    return;
  }
  const uuid = admissionDrafts.get(key);
  const slug = slugs[Number.parseInt(uuid.slice(0, 8), 16) % slugs.length];
  const run = { payload, key, uuid, diagnosis: pool.find(disease => disease.slug === slug), pool, started: performance.now() };
  analysis = run;
  setStatus(analysisStatus);
  setAnalysisPhase(run, 'scanning');
  updateAnalysis(run);
  admission.close();
  analysisDialog.showModal();
  run.interval = setInterval(() => updateAnalysis(run), 100);
  run.timer = setTimeout(() => {
    clearInterval(run.interval);
    byId('analysisDiagnosis').textContent = run.diagnosis.name;
    setAnalysisPhase(run, 'revealed');
    run.timer = setTimeout(() => saveAnalysis(run), diagnosisDisplayTime);
  }, analysisDuration);
});

byId('patientSearch').addEventListener('input', renderPatients);
byId('openMyRecord').addEventListener('click', () => openPatient(cases));
byId('diseaseSearch').addEventListener('input', renderDiseases);
byId('printRecord').addEventListener('click', () => window.print());
window.addEventListener('hashchange', () => showSection(true));
showSection();
loadMedicine();
