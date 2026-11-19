// Unique entry basename keeps admin.css distinct from the learner main.css.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './App';
import './admin.css';
import '../react/materials.css';

createRoot(document.getElementById('admin-app')!).render(createElement(AdminApp));

function syncAppearance(){
  const mode=localStorage.getItem('unified-cbt-theme')||'dark';
  const dark=mode==='system'?matchMedia('(prefers-color-scheme:dark)').matches:mode==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
}
syncAppearance();
addEventListener('storage',syncAppearance);
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',syncAppearance);
