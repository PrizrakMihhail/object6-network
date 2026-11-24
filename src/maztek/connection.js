const url = new URL(location.href);

if (url.searchParams.get('connect') === '1') {
  url.searchParams.delete('connect');
  history.replaceState(history.state, '', url);

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const dialog = document.getElementById('labConnection');
    const status = document.getElementById('labConnectionStatus');
    const progress = document.getElementById('labConnectionProgress');
    const main = document.getElementById('labMain');
    const stages = [
      [550, 26, 'Маршрут найден. Установка канала…'],
      [1200, 62, 'Синхронизация с узлом MAZTECH…'],
      [1950, 100, 'Соединение установлено']
    ];

    dialog.showModal();
    const timers = stages.map(([delay, percent, message]) => setTimeout(() => {
      progress.value = percent;
      status.textContent = message;
    }, delay));
    timers.push(setTimeout(() => dialog.close(), 2400));
    dialog.addEventListener('close', () => {
      timers.forEach(timer => clearTimeout(timer));
      main.focus({ preventScroll: true });
    }, { once: true });
  }
}
