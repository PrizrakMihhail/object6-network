(() => {
  const byId = id => document.getElementById(id);
  const slides = JSON.parse(byId('microreaderCatalog')?.textContent || '[]');
  const dialog = byId('microreaderDialog');
  const machine = dialog.querySelector('.microreader-machine');
  const image = byId('clippingImage');
  const title = byId('clippingTitle');
  const caption = byId('clippingCaption');
  const counter = byId('clippingCounter');
  const dots = byId('clippingDots');
  const lampStatus = byId('lampStatus');
  const openButton = byId('microreaderButton');
  const closeButton = byId('closeMicroreader');
  const previous = byId('previousClipping');
  const next = byId('nextClipping');
  let current = 0;
  let failureTimer;
  let restoreTimer;

  dots.innerHTML = slides.map((_, i) =>
    `<button type="button" aria-label="Открыть вырезку ${i + 1}" data-slide="${i}"></button>`
  ).join('');

  function show(index) {
    if (!slides.length) {
      title.textContent = 'АРХИВ ПУСТ';
      caption.textContent = 'НЕТ ГАЗЕТНЫХ ВЫРЕЗОК';
      counter.textContent = '00 / 00';
      previous.disabled = next.disabled = true;
      return;
    }

    current = (index + slides.length) % slides.length;
    const slide = slides[current];
    image.src = slide.src;
    image.alt = `${slide.title}. Газетная вырезка ${current + 1} из ${slides.length}`;
    image.hidden = false;
    title.textContent = slide.title;
    caption.textContent = slide.caption;
    counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    dots.querySelectorAll('button').forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', String(active));
    });
  }

  function setLamp(stable) {
    machine.classList.toggle('lamp-failure', !stable);
    machine.classList.toggle('lamp-recovery', stable && dialog.open);
    lampStatus.innerHTML = `<i></i> ЛАМПА: ${stable ? 'СТАБИЛЬНО' : 'НЕ СТАБИЛЬНО'}`;
  }

  function scheduleFailure() {
    failureTimer = setTimeout(() => {
      if (!dialog.open) return;
      setLamp(false);
      restoreTimer = setTimeout(() => {
        setLamp(true);
        scheduleFailure();
      }, 2000);
    }, 10000 + Math.random() * 10000);
  }

  openButton.addEventListener('click', () => {
    if (dialog.open) return;
    dialog.showModal();
    if (slides.length) scheduleFailure();
    closeButton.focus();
  });
  closeButton.addEventListener('click', () => dialog.close());
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  dots.addEventListener('click', event => {
    const dot = event.target.closest('[data-slide]');
    if (dot) show(Number(dot.dataset.slide));
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    clearTimeout(failureTimer);
    clearTimeout(restoreTimer);
    setLamp(true);
    openButton.focus();
  });
  image.addEventListener('animationend', () => machine.classList.remove('lamp-recovery'));
  dialog.addEventListener('keydown', event => {
    const pageByKey = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: slides.length - 1 };
    if (!Object.hasOwn(pageByKey, event.key)) return;
    event.preventDefault();
    show(pageByKey[event.key]);
  });

  show(0);
})();
