// Calculator and recovery work without the React application.
(function () {
  function apply() {
    var value, theme, wallpaper;
    try { value = localStorage.getItem('cbt-glass-material'); wallpaper = localStorage.getItem('cbt-glass-wallpaper'); theme = localStorage.getItem('unified-cbt-theme'); } catch (_) {}
    document.documentElement.dataset.theme = theme === 'light' || (theme === 'system' && !matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark';
    document.documentElement.dataset.wallpaper = ['ice','copper','shell','nexus','coast'].includes(wallpaper) ? wallpaper : (location.pathname.endsWith('calculator.html') ? 'copper' : 'nexus');
    document.documentElement.dataset.glass = value === 'frost' || value === 'prism' ? value : 'clear';
  }
  apply();
  window.addEventListener('storage', apply);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
})();
