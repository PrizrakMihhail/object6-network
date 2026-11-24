(() => {
  const key = 'object6.theme';
  const themeColors = { standard: null, terminal: '#100b05', shard: '#0d0b31' };
  const normalize = value => Object.hasOwn(themeColors, value) ? value : 'standard';
  let theme = 'standard';
  try {
    theme = normalize(localStorage.getItem(key));
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
      if (meta) meta.content = themeColors[theme] ?? baseColor;
    };
    for (const button of buttons) {
      button.addEventListener('click', () => {
        theme = normalize(button.dataset.themeChoice);
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
      theme = normalize(event.newValue);
      apply();
    });
    apply();
  });
})();
