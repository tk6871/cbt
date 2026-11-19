import {useCallback, useLayoutEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Box3, PerspectiveCamera, Vector3, type Group} from 'three';

// Fit projected bounds to both viewport dimensions while keeping the target at the origin.
export function EquipmentCamera({scene, turn, highlight, part}: {scene:Group; turn:number; highlight:boolean; part:string}) {
  const previousScene = useRef<Group | null>(null);
  const controls=useRef<OrbitControls | null>(null);
  const frame=useRef<number | null>(null);
  const {camera,gl,size,advance,viewport}=useThree();
  // A still GLB has no animation clock. Coalesce explicit visual changes into one draw.
  const redraw=useCallback(()=>{
    if(frame.current!==null)return;
    frame.current=requestAnimationFrame(time=>{
      frame.current=null;
      advance(time/1000,false);
    });
  },[advance]);
  useLayoutEffect(()=>{
    const orbit=new OrbitControls(camera,gl.domElement);
    orbit.enablePan=false;
    controls.current=orbit;
    orbit.addEventListener('change',redraw);
    gl.domElement.addEventListener('webglcontextrestored',redraw);
    return ()=>{
      orbit.removeEventListener('change',redraw);
      gl.domElement.removeEventListener('webglcontextrestored',redraw);
      orbit.dispose();
      controls.current=null;
      if(frame.current!==null)cancelAnimationFrame(frame.current);
      frame.current=null;
    };
  },[camera,gl,redraw]);
  useLayoutEffect(redraw,[highlight,viewport.dpr,redraw]);
  useLayoutEffect(()=>{
    if (!(camera instanceof PerspectiveCamera) || !controls.current) return;
    const box=new Box3().setFromObject(scene);
    const target = new Vector3();
    if (highlight) {
      const parts = new Box3();
      const match = new RegExp(part, 'i');
      scene.traverse(node => { if (match.test(node.name.replace(/_/g,' '))) parts.expandByObject(node); });
      if (!parts.isEmpty()) { parts.getCenter(target); box.copy(parts); }
    }
    const angle=.52+turn*Math.PI/6;
    const back=new Vector3(Math.sin(angle),.47,Math.cos(angle)).normalize();
    const right=new Vector3().crossVectors(camera.up,back).normalize();
    const up=new Vector3().crossVectors(back,right);
    const vertical=Math.tan(camera.fov*Math.PI/360);
    const horizontal=vertical*size.width/Math.max(1,size.height);
    let distance=1;
    for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
      const corner=new Vector3(x,y,z).sub(target);
      const extent=Math.max(Math.abs(corner.dot(right))/horizontal,Math.abs(corner.dot(up))/vertical);
      distance=Math.max(distance,corner.dot(back)+extent*1.2);
    }
    const destination = back.multiplyScalar(distance).add(target);
    const orbit = controls.current;
    const smooth = previousScene.current === scene && matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)').matches;
    previousScene.current = scene;
    controls.current.minDistance=distance*.45;
    controls.current.maxDistance=distance*3;
    if (!smooth) {
      camera.position.copy(destination); orbit.target.copy(target); orbit.update(); redraw();
      return;
    }
    const from = camera.position.clone(), fromTarget = orbit.target.clone();
    const start = performance.now();
    let id = 0;
    function draw(now:number) {
      const t = Math.min(1,(now-start)/240);
      const eased = 1-(1-t)**3;
      camera.position.lerpVectors(from,destination,eased);
      orbit.target.lerpVectors(fromTarget,target,eased);
      orbit.update(); redraw();
      if (t<1) id=requestAnimationFrame(draw);
    }
    const stop = ()=>cancelAnimationFrame(id);
    orbit.addEventListener('start',stop);
    id=requestAnimationFrame(draw);
    return ()=>{stop();orbit.removeEventListener('start',stop);};
  },[scene,camera,size.width,size.height,turn,highlight,part,redraw]);
  return null;
}
