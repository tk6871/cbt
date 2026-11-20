import {useSyncExternalStore} from 'react';
import {wallpapers,wallpaperChoice,chooseWallpaper} from './wallpaper';
const subscribe=(notify:()=>void)=>wallpaperChoice.subscribe(notify);
export function WallpaperPicker(){
  const current=useSyncExternalStore(subscribe,()=>wallpaperChoice.value);
  return <fieldset className="wall-picker"><legend>배경 작품</legend>
    <button type="button" aria-pressed={current==='auto'} onClick={()=>chooseWallpaper('auto')} className="wall-auto">화면에 맞춤</button>
    {Object.entries(wallpapers).map(([id,art])=><button key={id} type="button" aria-pressed={current===id}
      onClick={()=>chooseWallpaper(id as keyof typeof wallpapers)}><img src={art.image} alt="" loading="lazy"/>{art.label}</button>)}
  <details className="wall-credits"><summary>작품 출처</summary>
      <p>Ice Cold · Santiago Cézar / Honeywave · Ken Vermette / Shell · Lucas Andrade / Nexus · Krystian Zajdel / Volna · Nikita Babin</p>
      <a href="https://github.com/KDE/plasma-workspace-wallpapers" target="_blank" rel="noreferrer">KDE 원본</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · WebP 축소본
    </details></fieldset>;
}
