(() => {
  const tab = document.getElementById('leisureTab');
  const panel = document.getElementById('leisure');
  const network = document.getElementById('networkContent');
  const sidebar = tab.closest('.sidebar');

  function showSelectedSection() {
    const selected = location.hash === '#leisure';
    panel.hidden = !selected;
    network.hidden = selected;
    sidebar.classList.toggle('showing-leisure', selected);
    if (selected) tab.setAttribute('aria-current', 'location');
    else tab.removeAttribute('aria-current');
  }

  tab.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (location.hash !== '#leisure') history.pushState(null, '', '#leisure');
    showSelectedSection();
    window.scrollTo(0, 0);
    document.getElementById('leisureHeading').focus({ preventScroll: true });
  });
  sidebar.addEventListener('click', event => {
    if (panel.hidden || !event.target.closest('[data-view], [data-node]')) return;
    history.pushState(null, '', location.pathname + location.search);
    showSelectedSection();
  }, { capture: true });
  window.addEventListener('hashchange', showSelectedSection);
  showSelectedSection();

  const dialog = document.getElementById('leisureDialog');
  const title = document.getElementById('leisureTitle');
  const launchers = document.querySelectorAll('[data-launch]');
  const board = document.getElementById('leisureBoard');
  const context = board.getContext('2d');
  const stage = board.parentElement;
  const message = document.getElementById('leisureMessage');
  const scoreLabel = document.getElementById('leisureScore');
  const bestLabel = document.getElementById('leisureBest');
  const start = document.getElementById('leisureStart');
  const pause = document.getElementById('leisurePause');
  const rules = document.getElementById('leisureRules');
  const up = document.getElementById('leisureUp');
  const controls = dialog.querySelectorAll('[data-action]');
  const drop = dialog.querySelector('[data-action="drop"]');
  const minesGrid = document.getElementById('minesGrid');
  const minesTools = document.getElementById('minesTools');
  const minesFlags = document.getElementById('minesFlags');
  const flagMode = document.getElementById('minesFlagMode');
  const minesWidth = 9;
  const mineCount = 10;
  const cellSize = 24;
  const randomItem = items => items[Math.floor(Math.random() * items.length)];

  function drawCell(x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
  }

  const shapes = [
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#75bfc0' }, // I
    { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#e0b05d' },
    { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: '#db8a64' }, // L
    { cells: [[1, 0], [1, 1], [0, 2], [1, 2]], color: '#899bc9' }, // J
    { cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#b299ca' }, // T
    { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#a5c879' }, // S
    { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#d97e81' } // Z
  ];

  function createBlocks() {
    const width = 12;
    const height = 18;
    const emptyRow = () => Array(width).fill(null);
    const rows = Array.from({ length: height }, emptyRow);
    let piece;
    let bag = [];
    let score = 0;
    let cleared = 0;
    let result;

    function fits(candidate) {
      return candidate.cells.every(([dx, dy]) => {
        const x = candidate.x + dx;
        const y = candidate.y + dy;
        return x >= 0 && x < width && y >= 0 && y < height && !rows[y][x];
      });
    }

    function spawn() {
      if (!bag.length) bag = [...shapes];
      const [shape] = bag.splice(Math.floor(Math.random() * bag.length), 1);
      const size = Math.max(...shape.cells.map(([x]) => x)) + 1;
      piece = { ...shape, x: Math.floor((width - size) / 2), y: 0 };
      if (!fits(piece)) {
        piece = null;
        result = 'Поле заполнено';
      }
    }

    function move(dx, dy) {
      const candidate = { ...piece, x: piece.x + dx, y: piece.y + dy };
      if (!fits(candidate)) return false;
      piece = candidate;
      return true;
    }

    function rotate() {
      const bottom = Math.max(...piece.cells.map(([, y]) => y));
      const cells = piece.cells.map(([x, y]) => [bottom - y, x]);
      for (const offset of [0, -1, 1, -2, 2]) {
        const candidate = { ...piece, x: piece.x + offset, cells };
        if (!fits(candidate)) continue;
        piece = candidate;
        return;
      }
    }

    function lock() {
      for (const [dx, dy] of piece.cells) {
        rows[piece.y + dy][piece.x + dx] = piece.color;
      }
      const remaining = rows.filter(row => row.includes(null));
      const completed = height - remaining.length;
      rows.splice(0, height, ...Array.from({ length: completed }, emptyRow), ...remaining);
      cleared += completed;
      score += completed * completed * 100;
      spawn();
    }

    function tick() {
      if (!move(0, 1)) lock();
    }

    function action(input) {
      switch (input) {
        case 'left': move(-1, 0); break;
        case 'right': move(1, 0); break;
        case 'up': rotate(); break;
        case 'down': tick(); break;
        case 'drop':
          while (move(0, 1)) score += 1;
          lock();
          break;
      }
    }

    spawn();
    return {
      width, height, tick, action,
      get score() { return score; },
      get result() { return result; },
      get delay() { return Math.max(115, 650 - Math.floor(cleared / 4) * 55); },
      draw() {
        rows.forEach((row, y) => row.forEach((color, x) => {
          if (color) drawCell(x, y, color);
        }));
        if (!piece) return;
        for (const [dx, dy] of piece.cells) drawCell(piece.x + dx, piece.y + dy, piece.color);
      }
    };
  }

  function createSnake() {
    const width = 16;
    const height = 16;
    const body = [[7, 8], [6, 8], [5, 8]];
    const directions = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    const turns = [];
    let direction = directions.right;
    let score = 0;
    let result;

    const sameCell = ([x, y], [otherX, otherY]) => x === otherX && y === otherY;

    function placeFood() {
      const openCells = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const cell = [x, y];
          if (!body.some(part => sameCell(part, cell))) openCells.push(cell);
        }
      }
      return randomItem(openCells);
    }

    let food = placeFood();

    function tick() {
      direction = turns.shift() || direction;
      const x = body[0][0] + direction[0];
      const y = body[0][1] + direction[1];
      const head = [x, y];
      const eats = sameCell(head, food);
      const occupied = eats ? body : body.slice(0, -1);
      if (x < 0 || x >= width || y < 0 || y >= height || occupied.some(part => sameCell(part, head))) {
        result = 'Столкновение';
        return;
      }
      body.unshift(head);
      if (eats) {
        score += 10;
        food = placeFood();
        if (!food) result = 'Поле пройдено';
      } else {
        body.pop();
      }
    }

    return {
      width, height, tick,
      get score() { return score; },
      get result() { return result; },
      get delay() { return Math.max(70, 180 - score / 5); },
      action(input) {
        const next = directions[input];
        const previous = turns.at(-1) || direction;
        if (next && turns.length < 2 && next[0] * previous[0] + next[1] * previous[1] === 0) {
          turns.push(next);
        }
      },
      draw() {
        if (food) drawCell(...food, '#efb24f');
        body.forEach(([x, y], index) => drawCell(x, y, index === 0 ? '#cadea4' : '#83a658'));
      }
    };
  }

  function createMines() {
    const cells = Array.from({ length: minesWidth ** 2 }, () => ({
      mine: false, adjacent: 0, open: false, flagged: false
    }));
    let remaining = cells.length - mineCount;
    let flags = 0;
    let started = false;
    let result;

    function neighbors(index) {
      const column = index % minesWidth;
      const row = Math.floor(index / minesWidth);
      const nearby = [];
      for (let y = Math.max(0, row - 1); y <= Math.min(minesWidth - 1, row + 1); y++) {
        for (let x = Math.max(0, column - 1); x <= Math.min(minesWidth - 1, column + 1); x++) {
          if (x !== column || y !== row) nearby.push(y * minesWidth + x);
        }
      }
      return nearby;
    }

    function plantMines(first) {
      const safe = new Set([first, ...neighbors(first)]);
      const candidates = cells.map((_, index) => index).filter(index => !safe.has(index));
      for (let count = 0; count < mineCount; count++) {
        const [index] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
        cells[index].mine = true;
        for (const neighbor of neighbors(index)) cells[neighbor].adjacent++;
      }
      started = true;
    }

    function reveal(index) {
      if (result || cells[index].flagged || cells[index].open) return;
      if (!started) plantMines(index);
      if (cells[index].mine) {
        cells[index].open = true;
        result = 'Мина. Партия окончена';
        return;
      }
      const pending = [index];
      while (pending.length) {
        const next = pending.pop();
        const cell = cells[next];
        if (cell.open || cell.flagged || cell.mine) continue;
        cell.open = true;
        remaining--;
        if (!cell.adjacent) pending.push(...neighbors(next));
      }
      if (!remaining) result = 'Поле разминировано';
    }

    function flag(index) {
      const cell = cells[index];
      if (result || cell.open || (!cell.flagged && flags === mineCount)) return;
      cell.flagged = !cell.flagged;
      flags += cell.flagged ? 1 : -1;
    }

    return { cells, reveal, flag, get flagsLeft() { return mineCount - flags; }, get result() { return result; } };
  }

  const mineButtons = Array.from({ length: minesWidth ** 2 }, (_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.tabIndex = index === 0 ? 0 : -1;
    button.dataset.cell = index;
    return button;
  });
  minesGrid.append(...mineButtons);

  const factories = { blocks: createBlocks, snake: createSnake, mines: createMines };
  const titles = { blocks: 'БЛОКИ', snake: 'ЗМЕЙКА', mines: 'САПЁР' };
  const descriptions = {
    blocks: 'Заполняйте ряды падающими фигурами. ← → сдвиг, ↑ поворот, ↓ опускание, пробел — сброс.',
    snake: 'Собирайте янтарные клетки. Стрелки меняют направление. Стены и собственный хвост завершают игру.',
    mines: 'Цифра показывает число мин вокруг клетки. Флажок ставится правой кнопкой мыши, клавишей F или в режиме флажков. Стрелки перемещают фокус, Enter открывает клетку.'
  };
  const keyActions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'drop' };
  const records = {};
  for (const name of ['blocks', 'snake']) {
    try {
      records[name] = Number(localStorage.getItem(`object6.leisure.${name}`)) || 0;
    } catch {
      records[name] = 0;
    }
  }

  let selected = 'blocks';
  let game;
  let state;
  let timer;

  function draw() {
    if (selected === 'mines') {
      game.cells.forEach((cell, index) => {
        const button = mineButtons[index];
        const showMine = cell.mine && game.result;
        button.dataset.state = showMine ? 'mine' : cell.open ? 'open' : cell.flagged ? 'flagged' : 'closed';
        button.textContent = showMine ? '✹' : cell.open ? cell.adjacent || '' : cell.flagged ? '⚑' : '';
        const detail = showMine ? 'мина' : cell.open ? (cell.adjacent ? `мин рядом: ${cell.adjacent}` : 'пусто')
          : cell.flagged ? 'флажок' : 'закрыто';
        button.setAttribute('aria-label', `Ряд ${Math.floor(index / minesWidth) + 1}, столбец ${index % minesWidth + 1}, ${detail}`);
      });
      minesFlags.textContent = game.flagsLeft;
      return;
    }
    context.fillStyle = '#090e0b';
    context.fillRect(0, 0, board.width, board.height);
    context.fillStyle = '#243128';
    for (let x = 1; x < game.width; x += 1) context.fillRect(x * cellSize, 0, 1, board.height);
    for (let y = 1; y < game.height; y += 1) context.fillRect(0, y * cellSize, board.width, 1);
    game.draw();
    scoreLabel.textContent = game.score;
    if (game.score > records[selected]) {
      records[selected] = game.score;
      try {
        localStorage.setItem(`object6.leisure.${selected}`, game.score);
      } catch {
        // Keep the record in memory when storage is unavailable.
      }
    }
    bestLabel.textContent = records[selected];
  }

  function setState(next) {
    state = next;
    const running = state === 'playing';
    message.textContent = { playing: '', paused: 'Пауза', ended: game.result }[state];
    start.textContent = state === 'ended' ? 'Играть снова' : 'Заново';
    pause.textContent = state === 'paused' ? 'Продолжить' : 'Пауза';
    pause.disabled = !running && state !== 'paused';
    controls.forEach(button => { button.disabled = !running; });
    flagMode.disabled = !running;
  }

  function reset() {
    clearTimeout(timer);
    game = factories[selected]();
    if (selected === 'mines') {
      flagMode.setAttribute('aria-pressed', 'false');
    } else {
      board.width = game.width * cellSize;
      board.height = game.height * cellSize;
    }
    setState('playing');
    draw();
  }

  function configureGame() {
    const blocks = selected === 'blocks';
    const mines = selected === 'mines';
    stage.dataset.game = selected;
    dialog.dataset.game = selected;
    board.hidden = mines;
    minesGrid.hidden = !mines;
    minesTools.hidden = !mines;
    title.textContent = titles[selected];
    rules.textContent = descriptions[selected] + (mines ? '' : ' P — пауза.');
    up.textContent = blocks ? '↻' : '↑';
    up.setAttribute('aria-label', blocks ? 'Повернуть фигуру' : 'Вверх');
    drop.hidden = !blocks;
  }

  function update() {
    draw();
    if (game.result) {
      clearTimeout(timer);
      setState('ended');
    }
  }

  function schedule() {
    if (selected === 'mines') return;
    timer = setTimeout(() => {
      if (!dialog.open || state !== 'playing') return;
      game.tick();
      update();
      if (state === 'playing') schedule();
    }, game.delay);
  }

  function playAction(action) {
    if (state !== 'playing') return;
    game.action(action);
    update();
  }

  function togglePause() {
    if (selected === 'mines') return;
    if (state === 'playing') {
      clearTimeout(timer);
      setState('paused');
    } else if (state === 'paused') {
      setState('playing');
      schedule();
    }
  }

  function focusGame() {
    (selected === 'mines' ? mineButtons[0] : board).focus({ preventScroll: true });
  }

  function actOnMine(event, flag) {
    const cell = event.target.closest('[data-cell]');
    if (!cell) return;
    event.preventDefault();
    if (state !== 'playing') return;
    if (flag) game.flag(Number(cell.dataset.cell));
    else game.reveal(Number(cell.dataset.cell));
    update();
  }

  flagMode.addEventListener('click', () => {
    flagMode.setAttribute('aria-pressed', flagMode.getAttribute('aria-pressed') !== 'true');
  });
  minesGrid.addEventListener('click', event => actOnMine(event, flagMode.getAttribute('aria-pressed') === 'true'));
  minesGrid.addEventListener('contextmenu', event => actOnMine(event, true));
  minesGrid.addEventListener('focusin', event => {
    for (const button of mineButtons) button.tabIndex = button === event.target ? 0 : -1;
  });
  minesGrid.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyF') {
      if (!event.repeat) actOnMine(event, true);
      return;
    }
    const index = Number(event.target.dataset.cell);
    const column = index % minesWidth;
    const offsets = {
      ArrowLeft: column > 0 ? -1 : 0,
      ArrowRight: column < minesWidth - 1 ? 1 : 0,
      ArrowUp: -minesWidth,
      ArrowDown: minesWidth
    };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    mineButtons[index + offsets[event.key]]?.focus();
  });

  launchers.forEach(button => button.addEventListener('click', () => {
    if (dialog.open) return;
    selected = button.dataset.launch;
    configureGame();
    reset();
    dialog.showModal();
    focusGame();
    schedule();
  }));
  dialog.addEventListener('close', () => {
    if (!dialog.open) clearTimeout(timer);
  });
  controls.forEach(button => button.addEventListener('click', () => playAction(button.dataset.action)));
  start.addEventListener('click', () => {
    reset();
    focusGame();
    schedule();
  });
  pause.addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dialog.open && state === 'playing') togglePause();
  });
  dialog.addEventListener('keydown', event => {
    if (selected === 'mines') return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }
    const action = keyActions[event.key];
    if (!action || state !== 'playing' || (action === 'drop' && selected !== 'blocks')) return;
    if (action === 'drop' && event.target.closest('button')) return;
    event.preventDefault();
    if (event.repeat && (action === 'drop' || (selected === 'blocks' && action === 'up'))) return;
    playAction(action);
  });

})();
