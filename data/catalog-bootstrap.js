(function () {
  var DISPLAY_KEY = "unified-cbt-display-mode";
  var QUALIFICATION_KEY = "modern-cbt-qualification-industrial";
  var allowed = ["hvac", "hvac-hansol", "safety", "energy", "energy-midterm", "maintenance", "maintenance-engineer", "electric-craftsman", "gas-craftsman", "hazardous-craftsman", "information-engineer", "forklift-craftsman", "school-exams"];
  var displayPreference = "auto";
  var qualification = "hvac";
  try {
    displayPreference = localStorage.getItem(DISPLAY_KEY) || "auto";
    qualification = localStorage.getItem(QUALIFICATION_KEY) || "hvac";
  } catch (error) {}
  if (allowed.indexOf(qualification) < 0 && qualification !== "safety-engineer") qualification = "hvac";

  var nativeApp = document.documentElement.dataset.nativeApp === "true";
  var touchLayout = nativeApp
    || matchMedia("(max-width: 900px)").matches
    || (matchMedia("(pointer: coarse)").matches && matchMedia("(max-width: 1180px)").matches);
  var resolvedDisplay = displayPreference === "mobile"
    ? "mobile"
    : displayPreference === "desktop" ? "desktop" : (touchLayout ? "mobile" : "desktop");
  document.documentElement.dataset.uiMode = resolvedDisplay;
  window.CBT_DISPLAY_MODE = resolvedDisplay;
  window.CBT_DISPLAY_PREFERENCE = displayPreference;
  window.CBT_LOADED_QUALIFICATION = qualification;

  var previousView = history.state;
  var deferMobileBank = resolvedDisplay === 'mobile' && document.documentElement.dataset.bundledAssets !== 'true';
  if (deferMobileBank && previousView && previousView.cbtSpace === 'cbt-industrial' &&
      location.hash === '#/study/rounds' && previousView.view === 'rounds' && previousView.textbookCollection) return;

  // A first mobile home can display the published catalog counts. Read questions
  // when a book, a qualification or the detailed study range actually needs them.
  if (deferMobileBank && qualification === 'hvac' &&
      (!location.hash || location.hash === '#/study/home') && !history.state) {
    try {
      if (!localStorage.getItem(QUALIFICATION_KEY) && !localStorage.getItem('unified-industrial-cbt-v1') &&
          !localStorage.getItem('unified-cbt-learning-session-industrial') &&
          !sessionStorage.getItem('cbt-open-updates-after-refresh-industrial') &&
          (!localStorage.getItem('unified-cbt-visual-style') || localStorage.getItem('unified-cbt-visual-style') === 'default')) return;
    } catch (error) { /* Keep the normal bootstrap when stored preferences are inaccessible. */ }
  }

  // The school workspace loads its own saved sets independently of the selected qualification.
  if (location.hash === '#/study/school') return;

  var scripts = qualification === "school-exams" ? [] : ["data/" + qualification + ".js?v=823"];
  if (qualification === "energy-midterm") scripts.push("data/energy-textbook.js?v=823");
  if (qualification === "energy") scripts.push("data/energy-restored.js?v=823");
  document.write(scripts.map(function (src) {
    return '<script data-study-required src="' + src + '"></script>';
  }).join(""));
})();
