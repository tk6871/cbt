import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createApp } from 'vue';
import App from './App.vue';
import './cbt.css';

const nativeApp = Capacitor.isNativePlatform();

function preventAccidentalBrowserZoom(): void {
  if (navigator.maxTouchPoints < 1) return;

  const preventGesture = (event: Event): void => event.preventDefault();
  const preventMultiTouchZoom = (event: TouchEvent): void => {
    if (event.touches.length > 1) event.preventDefault();
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });
  document.addEventListener('touchstart', preventMultiTouchZoom, { passive: false });
}

preventAccidentalBrowserZoom();

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
  void import('./pwa').catch((error) => {
    console.error('PWA 업데이트 모듈을 불러오지 못했습니다.', error);
    window.CBT_PWA_REGISTRATION_ERROR = true;
    window.dispatchEvent(new CustomEvent('cbt:pwa-error'));
  });
}
