const routingModes = document.querySelectorAll('.routing-switch button');
routingModes.forEach(button => button.addEventListener('click', () => {
  for (const mode of routingModes) {
    const selected = mode === button;
    mode.classList.toggle('active', selected);
    mode.setAttribute('aria-pressed', String(selected));
    document.getElementById(mode.getAttribute('aria-controls')).hidden = !selected;
  }
}));
const routingAccess = document.getElementById('routingAccessDialog');
document.querySelectorAll('button.routing-node:not(#plazaNode, #reactorNode)').forEach(node => {
  node.addEventListener('click', () => routingAccess.showModal());
});
document.getElementById('plazaNode').addEventListener('click', () => {
  document.getElementById('plazaDialog').showModal();
});
function drawLines(graph) {
  if (!graph.clientWidth) return;
  const hub = graph.querySelector('.routing-hub');
  const svg = graph.querySelector('.routing-lines');
  const center = node => ({
    x: node.offsetLeft + node.offsetWidth / 2,
    y: node.offsetTop + node.offsetHeight / 2
  });
  const origin = center(hub);
  const lines = Array.from(graph.querySelectorAll('.routing-node:not(.routing-hub)'), node => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const destination = center(node);
    line.setAttribute('x1', origin.x);
    line.setAttribute('y1', origin.y);
    line.setAttribute('x2', destination.x);
    line.setAttribute('y2', destination.y);
    line.classList.toggle('routing-line-warning', node.dataset.condition === 'warn');
    if (node.id === 'reactorNode') line.classList.add('routing-line-reactor');
    return line;
  });
  svg.replaceChildren(...lines);
}

const routingObserver = new ResizeObserver(entries => {
  for (const { target } of entries) drawLines(target);
});
const conditionObserver = new MutationObserver(records => {
  const changedGraphs = new Set(records.map(({ target }) => target.closest('.routing-graph')));
  for (const graph of changedGraphs) drawLines(graph);
});
for (const graph of document.querySelectorAll('.routing-graph')) {
  routingObserver.observe(graph);
  conditionObserver.observe(graph, { subtree: true, attributeFilter: ['data-condition'] });
}
