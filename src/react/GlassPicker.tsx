import {WallpaperPicker} from './WallpaperPicker';
import {useSyncExternalStore} from 'react';
import {glassMaterial, glassMaterials, setGlassMaterial} from './glassMaterial';

const subscribe = (notify:()=>void) => glassMaterial.subscribe(notify);
export function GlassPicker(){
  const current=useSyncExternalStore(subscribe,()=>glassMaterial.value);
  return <div className="glass-controls"><div className="glass-options" role="group" aria-label="리퀴드 글라스 재질">
    {glassMaterials.map(({value,label,detail})=><button type="button" key={value} data-sample={value}
      aria-pressed={value===current} onClick={()=>setGlassMaterial(value)}>
      <i className="glass-swatch" aria-hidden="true"/><span><strong>{label}</strong><small>{detail}</small></span>
      <b aria-hidden="true">{value===current?'✓':''}</b></button>)}
  </div><WallpaperPicker/></div>;
}
