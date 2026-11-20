// Calculator and recovery work without the React application.
(function () {
  function apply() {
    var value, theme;
    try { value = localStorage.getItem('cbt-glass-material'); theme = localStorage.getItem('unified-cbt-theme'); } catch (_) {}
    document.documentElement.dataset.theme = theme === 'light' || (theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark';
    document.documentElement.dataset.glass = value === 'frost' || value === 'clear' ? value : 'prism';
  }
  apply();
  window.addEventListener('storage', apply);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
})();
