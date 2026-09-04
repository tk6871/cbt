import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { createApp } from 'vue';
import App from './App.vue';
import 'open-props/easings.min.css';
import 'open-props/durations.min.css';
import 'driver.js/dist/driver.css';
import './cbt.css';
import './uiFrameworkThemes.css';

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

function showRuntimeRecovery(error: unknown): void {
  if (document.getElementById('cbt-runtime-recovery')) return;
  const panel = document.createElement('aside');
  panel.id = 'cbt-runtime-recovery';
  panel.setAttribute('role', 'alert');
  panel.innerHTML = '<strong>선택 기능을 불러오는 중 문제가 생겼습니다.</strong><span>학습 기록은 그대로입니다. UI 안전모드로 다시 열어 주세요.</span><a href="?safe=1">안전모드로 열기</a>';
  document.body.append(panel);
  console.error('CBT 화면 오류를 안전하게 격리했습니다.', error);
}

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
  void import('./nativeEnhancements').then(({ initializeNativeEnhancements }) => initializeNativeEnhancements());
}

const app = createApp(App);
app.config.errorHandler = (error) => showRuntimeRecovery(error);
window.addEventListener('unhandledrejection', (event) => showRuntimeRecovery(event.reason));
app.mount('#next-app');

if (!nativeApp && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  void import('./pwa').catch((error) => {
    console.error('PWA 업데이트 모듈을 불러오지 못했습니다.', error);
    window.CBT_PWA_REGISTRATION_ERROR = true;
    window.dispatchEvent(new CustomEvent('cbt:pwa-error'));
  });
}
