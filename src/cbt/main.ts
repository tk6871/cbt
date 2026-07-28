import { createApp } from 'vue';
import App from './App.vue';
import './cbt.css';

createApp(App).mount('#next-app');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
