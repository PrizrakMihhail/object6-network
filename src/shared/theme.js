(() => {
  const key = 'object6.theme';
  let theme = 'standard';
  try {
    if (localStorage.getItem(key) === 'terminal') theme = 'terminal';
  } catch {
    // The switch still works in the current page without storage.
  }

  const root = document.documentElement;
  root.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-theme-choice]');
    const meta = document.querySelector('meta[name="theme-color"]');
    const baseColor = meta?.content;
    const apply = () => {
      root.dataset.theme = theme;
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
      }
      if (meta) meta.content = theme === 'terminal' ? '#100b05' : baseColor;
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        theme = button.dataset.themeChoice;
        apply();
        try {
          localStorage.setItem(key, theme);
        } catch {
          // Keep the selection for this page.
        }
      });
    }
    window.addEventListener('storage', event => {
      if (event.key !== key && event.key !== null) return;
      theme = event.newValue === 'terminal' ? 'terminal' : 'standard';
      apply();
    });
    apply();
  });
})();
