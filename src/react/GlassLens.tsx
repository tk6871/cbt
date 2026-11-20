import {useEffect,useRef,useSyncExternalStore} from 'react';
import {activeWallpaper,wallpapers} from './wallpaper';
import {glassMaterial} from './glassMaterial';
import type {createOptics} from './glassOptics';

const subscribe=(notify:()=>void)=>activeWallpaper.subscribe(notify);
export function GlassLens({onFailure}:{onFailure?:()=>void}){
  const art=useSyncExternalStore(subscribe,()=>activeWallpaper.value);
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const surface=canvas.current, host=surface?.parentElement;
    if(!surface||!host)return;
    let closed=false, instance:Awaited<ReturnType<typeof createOptics>>|undefined;
    let stop:(()=>void)|undefined,resize:ResizeObserver|undefined;
    let frame=0,pointer:{x:number;y:number}|undefined;
    const requestDraw=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;instance?.draw(glassMaterial.value,pointer);});};
    const follow=(event:PointerEvent)=>{if(event.pointerType==='mouse' && document.documentElement.dataset.dynamicUi!=='off' && document.documentElement.dataset.uiMotion!=='off' && !matchMedia('(prefers-reduced-motion: reduce)').matches){pointer={x:event.clientX,y:event.clientY};requestDraw();}};
    const release=()=>{pointer=undefined;requestDraw();};
    import('./glassOptics').then(async module=>{
      if(closed)return;
      const next=await module.createOptics(surface,host,wallpapers[art].image);
      if(closed){next.dispose();return;}
      instance=next;
      host.addEventListener('pointermove',follow);
      host.addEventListener('pointerleave',release);
      host.addEventListener('animationend',requestDraw);
      const draw=requestDraw;
      stop=glassMaterial.subscribe(draw);
      resize=new ResizeObserver(draw);resize.observe(host);
      host.querySelectorAll<HTMLElement>('[data-lens]').forEach(e=>resize!.observe(e));
    }).catch(()=>{if(!closed)onFailure?.();});
    return ()=>{closed=true;cancelAnimationFrame(frame);host.removeEventListener('pointermove',follow);
      host.removeEventListener('pointerleave',release);host.removeEventListener('animationend',requestDraw);stop?.();resize?.disconnect();instance?.dispose();};
  },[onFailure,art]);
  return <canvas key={art} className="glass-lens" aria-hidden="true" ref={canvas}/>;
}
