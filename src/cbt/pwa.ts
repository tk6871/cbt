import { registerSW } from 'virtual:pwa-register';

function announceUpdate(): void {
  window.CBT_UPDATE_AVAILABLE = true;
  window.dispatchEvent(new CustomEvent('cbt:update-available'));
}

function announceRegistrationError(error: unknown): void {
  console.error('PWA 서비스워커 등록 오류', error);
  window.CBT_PWA_REGISTRATION_ERROR = true;
  window.dispatchEvent(new CustomEvent('cbt:pwa-error'));
}

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: announceUpdate,
  onNeedReload: announceUpdate,
  onRegisteredSW: (_workerUrl, registration) => {
    if (!registration) return;
    window.CBT_PWA_REGISTRATION_ERROR = false;
    window.dispatchEvent(new CustomEvent('cbt:pwa-ready'));

    const updateWhenVisible = (): void => {
      if (document.visibilityState === 'visible') void registration.update();
    };
    window.setInterval(updateWhenVisible, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', updateWhenVisible);
    void registration.update();
  },
  onRegisterError: announceRegistrationError,
});

window.CBT_APPLY_PWA_UPDATE = async (reloadPage = true): Promise<void> => {
  await updateServiceWorker(reloadPage);
};
