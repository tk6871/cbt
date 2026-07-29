import { createApp } from 'vue';
import App from './App.vue';
import './cbt.css';

createApp(App).mount('#next-app');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let updateAnnounced = false;
  const announceUpdate = (): void => {
    if (!hadController || updateAnnounced) return;
    updateAnnounced = true;
    window.CBT_UPDATE_AVAILABLE = true;
    window.dispatchEvent(new CustomEvent('cbt:update-available'));
  };

  navigator.serviceWorker.addEventListener('controllerchange', announceUpdate);
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js?v=232', { updateViaCache: 'none' }).then((registration) => {
      const watchInstallingWorker = (): void => {
        const worker = registration.installing;
        if (!worker || !hadController) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' || worker.state === 'activated') announceUpdate();
        });
      };

      if (registration.waiting) announceUpdate();
      registration.addEventListener('updatefound', watchInstallingWorker);
      void registration.update();

      window.setInterval(() => {
        if (document.visibilityState === 'visible') void registration.update();
      }, 15 * 60 * 1000);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    });
  });
}
