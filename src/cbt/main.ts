import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createApp } from 'vue';
import App from './App.vue';
import './cbt.css';

const nativeApp = Capacitor.isNativePlatform();

function updateNativeFormFactor(): void {
  if (!nativeApp) return;
  const shortestSide = Math.min(window.innerWidth, window.innerHeight);
  document.documentElement.dataset.nativeApp = 'true';
  document.documentElement.dataset.nativeFormFactor = shortestSide >= 600 ? 'tablet' : 'phone';
  document.documentElement.dataset.nativeOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

if (nativeApp) {
  updateNativeFormFactor();
  window.addEventListener('resize', updateNativeFormFactor, { passive: true });
  void StatusBar.setOverlaysWebView({ overlay: true });
  void StatusBar.setStyle({ style: Style.Light });
}

createApp(App).mount('#next-app');

if (!nativeApp && 'serviceWorker' in navigator && location.protocol !== 'file:') {
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
    void navigator.serviceWorker.register('./sw.js?v=344', { updateViaCache: 'none' }).then((registration) => {
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
