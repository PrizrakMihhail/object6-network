import config from './supabase-config.js';

const nodes = new Map(
  Array.from(document.querySelectorAll('[data-structure-slug]'), node => [node.dataset.structureSlug, node])
);

async function loadStructures() {
  const url = new URL('/rest/v1/object6_structures', config.url);
  url.searchParams.set('select', 'slug,name,status,condition,description');
  const response = await fetch(url, {
    headers: { apikey: config.publishableKey },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  for (const structure of await response.json()) {
    const node = nodes.get(structure.slug);
    if (!node || !['ok', 'warn', 'critical'].includes(structure.condition)) continue;
    node.querySelector('.routing-name').textContent = structure.name;
    node.querySelector('.routing-status').textContent = structure.status;
    node.dataset.condition = structure.condition;

    let description = node.querySelector('.routing-description');
    if (structure.description && !description) {
      description = document.createElement('span');
      description.className = 'routing-description';
      node.append(description);
    }
    if (description) {
      description.textContent = structure.description || '';
      description.hidden = !structure.description;
    }
  }
}

if (config && nodes.size) {
  loadStructures().catch(error => console.warn('Supabase routing data unavailable:', error.message));
}
