import {computed,signal} from '@preact/signals-core';
import ice from './assets/wallpapers/IceCold.webp';
import copper from './assets/wallpapers/Honeywave.webp';
import shell from './assets/wallpapers/Shell.webp';
import nexus from './assets/wallpapers/Nexus.webp';
import coast from './assets/wallpapers/Volna.webp';

export const wallpapers = {
  ice:{label:'빙하',image:ice}, copper:{label:'허니웨이브',image:copper},
  shell:{label:'자개',image:shell}, nexus:{label:'넥서스',image:nexus}, coast:{label:'해안선',image:coast},
} as const;
type Artwork = keyof typeof wallpapers;
type Preference = 'auto' | Artwork;
const key='cbt-glass-wallpaper';
function read():Preference{
  try {const value=localStorage.getItem(key);if(value && Object.hasOwn(wallpapers,value))return value as Artwork;}catch{}
  return 'auto';
}
export const wallpaperChoice=signal(read());
const context=signal<Artwork>(document.getElementById('admin-app')?'nexus':location.pathname.endsWith('jewelry.html')?'shell':'ice');
wallpaperChoice.subscribe(value=>{document.documentElement.dataset.wallpaperMode=value==='auto'?'auto':'fixed';});
export const activeWallpaper=computed(()=>wallpaperChoice.value==='auto'?context.value:wallpaperChoice.value);
activeWallpaper.subscribe(value=>{
  document.documentElement.dataset.wallpaper=value;
});
export function updateWallpaperContext(view:string,subject:string,jewelry:boolean){
  if(view==='settings'||view==='history'||view==='stats') context.value='coast';
  else if(jewelry) context.value='shell';
  else if(subject.startsWith('energy')) context.value='copper';
  else if(subject.startsWith('hvac')||subject.startsWith('cooling')) context.value='ice';
  else context.value='nexus';
}
export function chooseWallpaper(value:Preference){
  wallpaperChoice.value=value;
  try{localStorage.setItem(key,value);}catch{}
}
window.addEventListener('storage',event=>{if(event.key===key||event.key===null)wallpaperChoice.value=read()});
