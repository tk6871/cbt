// Unique entry basename keeps admin.css distinct from the learner main.css.
import { createApp } from 'vue';
import App from './App.vue';
import './admin.css';

createApp(App).mount('#admin-app');
