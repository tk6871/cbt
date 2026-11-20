import {useEffect,useRef} from 'react';
import {glassMaterial} from './glassMaterial';
import type {createOptics} from './glassOptics';

export function GlassLens({onFailure}:{onFailure?:()=>void}){
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const surface=canvas.current, host=surface?.parentElement;
    if(!surface||!host)return;
    let closed=false, instance:Awaited<ReturnType<typeof createOptics>>|undefined;
    let stop:(()=>void)|undefined,resize:ResizeObserver|undefined;
    import('./glassOptics').then(async module=>{
      if(closed)return;
      const next=await module.createOptics(surface,host);
      if(closed){next.dispose();return;}
      instance=next;
      const draw=()=>next.draw(glassMaterial.value);
      stop=glassMaterial.subscribe(draw);
      resize=new ResizeObserver(draw);resize.observe(host);
      host.querySelectorAll<HTMLElement>('[data-lens]').forEach(e=>resize!.observe(e));
    }).catch(()=>{if(!closed)onFailure?.();});
    return ()=>{closed=true;stop?.();resize?.disconnect();instance?.dispose();};
  },[onFailure]);
  return <canvas className="glass-lens" aria-hidden="true" ref={canvas}/>;
}
