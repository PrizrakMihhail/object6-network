import { documents } from './archive-documents.js';

const list = document.getElementById('documentList');
const dialog = document.getElementById('documentDialog');
const mark = document.getElementById('markButton');
const filters = document.querySelectorAll('#filters button');
const nodeFilters = document.querySelectorAll('.node-filter');
const navigation = document.querySelectorAll('.nav-item');
const state = { filter: 'all', node: 'all', query: '', favorites: new Set() };
const categoryByView = { archive: 'all', mail: 'mail', projects: 'research', intercepts: 'critical', overview: 'all' };
const iconByNode = { matsumoto: 'MT', maztech: 'MZ', field: 'N6' };

function render() {
  const found = documents.filter(entry =>
    (state.filter === 'all' || entry.type === state.filter) &&
    (state.node === 'all' || entry.node === state.node) &&
    `${entry.title} ${entry.sub} ${entry.code}`.toLowerCase().includes(state.query)
  );
  list.innerHTML = found.length ? found.map(entry => `
    <button class="doc-row" data-id="${entry.id}" data-node="${entry.node}">
      <span class="doc-icon">${iconByNode[entry.node] ?? 'N6'}</span>
      <span class="doc-title">
        <b>${state.favorites.has(entry.id) ? '★ ' : ''}${entry.title}</b>
        <small>${entry.code} · ${entry.sub}</small>
      </span>
      <span class="doc-date">${entry.date}</span>
      <span class="doc-level ${entry.type === 'critical' ? 'critical' : ''}">LVL ${entry.level}</span>
    </button>`).join('') : '<div class="empty-state">СОВПАДЕНИЙ В ЭТОМ КОНТУРЕ НЕ НАЙДЕНО</div>';
}

function updateMark() {
  mark.textContent = state.favorites.has(mark.dataset.id)
    ? 'УБРАТЬ ИЗ ИЗБРАННОГО'
    : 'ДОБАВИТЬ В ИЗБРАННОЕ';
}

function setFilter(filter) {
  state.filter = filter;
  filters.forEach(button => button.classList.toggle('active', button.dataset.filter === filter));
  render();
}

list.addEventListener('click', event => {
  const row = event.target.closest('.doc-row');
  if (!row) return;
  const entry = documents.find(item => item.id === row.dataset.id);
  if (!entry) return;

  document.getElementById('docTitle').textContent = entry.title;
  document.getElementById('docPath').textContent = `ARCHIVE://${entry.node}/${entry.code}`;
  document.getElementById('docMeta').innerHTML = `
    <span>КОД: <b>${entry.code}</b></span>
    <span>ДАТА: <b>${entry.date}</b></span>
    <span>ДОПУСК: <b>${entry.level}</b></span>`;
  document.getElementById('docBody').innerHTML = entry.body;
  document.getElementById('docIntegrity').textContent = `${entry.integrity}%`;
  mark.dataset.id = entry.id;
  updateMark();
  dialog.showModal();
});

filters.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
nodeFilters.forEach(button => button.addEventListener('click', () => {
  nodeFilters.forEach(item => item.classList.toggle('active', item === button));
  state.node = button.dataset.node;
  render();
}));
document.getElementById('searchInput').addEventListener('input', event => {
  state.query = event.target.value.toLowerCase();
  render();
});
navigation.forEach(button => {
  const view = button.dataset.view;
  if (!view) return;
  button.addEventListener('click', () => {
    navigation.forEach(item => item.classList.toggle('active', item === button));
    setFilter(categoryByView[view]);
    document.querySelector('.docs-head').scrollIntoView({
      behavior: 'smooth',
      block: view === 'overview' ? 'end' : 'start'
    });
  });
});
document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});
mark.addEventListener('click', () => {
  const { id } = mark.dataset;
  if (!id) return;
  if (!state.favorites.delete(id)) state.favorites.add(id);
  updateMark();
  render();
});

render();
