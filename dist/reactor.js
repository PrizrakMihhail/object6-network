(() => {
  const node = document.getElementById('reactorNode');
  const nodeStatus = node.querySelector('.routing-status');
  const nodeDescription = node.querySelector('.routing-description');
  const criticalDescription = nodeDescription.textContent;
  const dialog = document.getElementById('reactorDialog');
  const puzzle = document.getElementById('reactorPuzzle');
  const assembly = puzzle.querySelector('.reactor-assembly');
  const outcome = document.getElementById('reactorOutcome');
  const readout = document.getElementById('reactorReadout');
  const power = document.getElementById('reactorPower');
  const countdown = document.getElementById('reactorCountdown');
  const retry = document.getElementById('reactorRetry');
  const closeButton = dialog.querySelector('button[type="submit"]');
  const rotors = [...puzzle.querySelectorAll('[data-rotor]')];
  const rotorNames = rotors.map(rotor => rotor.getAttribute('aria-label'));

  const storageKey = 'object6.reactor.stableUntil';
  const stabilityDuration = 5 * 60 * 1000;
  const linkedRotors = [[0, 1], [1, 2], [2]];
  const positions = ['справа', 'снизу', 'слева', 'сверху'];
  const powerFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let stableUntil = 0;
  let previousStart = [];
  let turns = [];
  let timer;
  let view;

  function validDeadline(value) {
    const timestamp = Number(value);
    const now = Date.now();
    return timestamp > now && timestamp <= now + stabilityDuration ? timestamp : 0;
  }

  try {
    stableUntil = validDeadline(localStorage.getItem(storageKey));
  } catch {
    // In-memory state also works when storage is unavailable.
  }

  function showView(next) {
    view = next;
    puzzle.hidden = next === 'expired';
    puzzle.dataset.mode = next;
    readout.hidden = next !== 'stable' && next !== 'complete';
    retry.hidden = next !== 'expired';
    outcome.textContent = {
      complete: 'Цепь сети восстановлена',
      expired: 'Цепь реактора снова разомкнута'
    }[next] || '';
    outcome.hidden = !outcome.textContent;
    if (next === 'stable') {
      turns = rotors.map(() => 0);
      renderAtRest();
    }
  }

  function updateTelemetry(remaining) {
    const elapsed = (stabilityDuration - remaining) / 1000;
    power.textContent = `${powerFormat.format(84 + 3 * Math.sin(elapsed / 14))} МВт`;
    const seconds = Math.ceil(remaining / 1000);
    countdown.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function refresh() {
    clearTimeout(timer);
    const remaining = stableUntil - Date.now();
    const stable = remaining > 0;
    const condition = stable ? 'ok' : 'critical';
    if (node.dataset.condition !== condition) {
      node.dataset.condition = condition;
      nodeStatus.textContent = stable ? 'Стабильный' : 'Критический';
      nodeDescription.textContent = stable ? 'Цепь замкнута. Реактор подаёт энергию в сеть.' : criticalDescription;
    }
    if (!stable) {
      stableUntil = 0;
      if (dialog.open && (view === 'stable' || view === 'complete')) {
        showView('expired');
        retry.focus();
      }
      return;
    }

    if (dialog.open && (view === 'puzzle' || view === 'expired')) {
      showView('stable');
      closeButton.focus();
    }
    if (dialog.open) updateTelemetry(remaining);
    timer = setTimeout(refresh, dialog.open ? Math.min(remaining, 1000) : remaining);
  }

  function renderRotors() {
    let conducting = true;
    rotors.forEach((rotor, index) => {
      const position = turns[index] % positions.length;
      conducting = conducting && position === 0;
      rotor.style.setProperty('--rotor-angle', `${turns[index] * 90}deg`);
      rotor.classList.toggle('reactor-conducting', conducting);
      rotor.setAttribute('aria-label', `${rotorNames[index]}, стрелка ${positions[position]}${conducting ? ', ток проходит' : ''}`);
      rotor.setAttribute('aria-disabled', String(view !== 'puzzle'));
      rotor.tabIndex = view === 'puzzle' ? 0 : -1;
    });
    assembly.classList.toggle('reactor-powered', conducting);
    return conducting;
  }

  function renderAtRest() {
    puzzle.classList.add('reactor-resetting');
    renderRotors();
    // Commit the angles before allowing transitions for player input.
    void puzzle.offsetWidth;
    puzzle.classList.remove('reactor-resetting');
  }

  function startRound() {
    turns = rotors.map(() => 1 + Math.floor(Math.random() * 3));
    if (turns.every((position, index) => position === previousStart[index])) {
      turns[2] = turns[2] % 3 + 1;
    }
    previousStart = [...turns];
    showView('puzzle');
    renderAtRest();
  }

  rotors.forEach((rotor, index) => rotor.addEventListener('click', () => {
    if (view !== 'puzzle') return;
    for (const linkedIndex of linkedRotors[index]) turns[linkedIndex]++;
    if (!renderRotors()) return;
    showView('complete');
    renderRotors();
    stableUntil = Date.now() + stabilityDuration;
    try {
      localStorage.setItem(storageKey, String(stableUntil));
    } catch {
      // Recovery still lasts five minutes in the current tab.
    }
    refresh();
  }));

  node.addEventListener('click', () => {
    if (dialog.open) return;
    if (stableUntil > Date.now()) showView('stable');
    else startRound();
    dialog.showModal();
    if (view === 'puzzle') rotors[0].focus();
    refresh();
  });
  retry.addEventListener('click', () => {
    if (view !== 'expired') return;
    startRound();
    rotors[0].focus();
  });
  dialog.addEventListener('close', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    stableUntil = validDeadline(event.newValue);
    refresh();
  });
  refresh();
})();
