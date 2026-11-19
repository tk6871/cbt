// The question bank and changelog scripts run before the app reads their globals.
(function () {
  const panel = document.querySelector('.next-boot');
  const status = panel.querySelector('small');
  const retry = panel.querySelector('button');
  let missingBank = false;

  function showRetry(message) {
    status.textContent = message;
    retry.hidden = false;
  }
  const slow = setTimeout(() => {
    showRetry('연결이 느립니다. 조금 더 기다리거나 다시 시도해 주세요.');
  }, 12000);

  function failed() {
    clearTimeout(slow);
    showRetry('학습 화면을 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
  }
  function resourceError(event) {
    if (event.target instanceof HTMLScriptElement && event.target.hasAttribute('data-study-required')) {
      missingBank = true;
      failed();
    }
  }
  window.addEventListener('error', resourceError, true);
  document.addEventListener('DOMContentLoaded', async () => {
    window.removeEventListener('error', resourceError, true);
    if (missingBank) return;
    try {
      await import(new URL(panel.dataset.entry, document.baseURI).href);
    } catch (error) {
      console.error('CBT 시작 파일을 불러오지 못했습니다.', error);
      failed();
    } finally {
      clearTimeout(slow);
    }
  }, { once: true });
})();
