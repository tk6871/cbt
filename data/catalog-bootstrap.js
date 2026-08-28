(function () {
  var DISPLAY_KEY = "unified-cbt-display-mode";
  var QUALIFICATION_KEY = "modern-cbt-qualification-industrial";
  var allowed = ["hvac", "hvac-hansol", "safety", "energy", "maintenance", "electric-craftsman", "gas-craftsman", "hazardous-craftsman", "school-exams"];
  var displayPreference = "auto";
  var qualification = "hvac";
  try {
    displayPreference = localStorage.getItem(DISPLAY_KEY) || "auto";
    qualification = localStorage.getItem(QUALIFICATION_KEY) || "hvac";
  } catch (error) {}
  if (allowed.indexOf(qualification) < 0) qualification = "hvac";

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

  var scripts = qualification === "school-exams" ? [] : ["data/" + qualification + ".js?v=400"];
  if (qualification === "energy") scripts.push("data/energy-engineer.js?v=400");
  document.write(scripts.map(function (src) {
    return '<script src="' + src + '"><\\/script>';
  }).join(""));
})();
