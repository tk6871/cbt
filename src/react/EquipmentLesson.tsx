import {lessons} from './modelPreference';
import {publicApiBase} from '../cbt/serviceApi';
import {useEffect,useLayoutEffect,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {EquipmentCamera} from './EquipmentCamera';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Box3,Vector3,Mesh,MeshStandardMaterial,Texture,type Group,type Material,type BufferGeometry} from 'three';

function dispose(scene:Group){
  const geometry=new Set<BufferGeometry>(),materials=new Set<Material>(),textures=new Set<Texture>();
  scene.traverse(node=>{if(node instanceof Mesh){geometry.add(node.geometry);for(const m of [node.material].flat() as Material[]){
    materials.add(m);for(const v of Object.values(m))if(v instanceof Texture)textures.add(v);
  }}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
type AssetKind = 'pump' | 'shell' | 'plate';
function Equipment({scene,highlight,part}:{scene:Group;highlight:boolean;part:string}){
  useLayoutEffect(()=>{
    const matcher=new RegExp(part,'i');
    const restore: Array<() => void> = [];
    if(highlight) scene.traverse(obj=>{
      if(!(obj instanceof Mesh) || !matcher.test(obj.name.replace(/_/g,' ')))return;
      const original=obj.material;
      const clones=[original].flat().map(material=>{
        const clone=material.clone();
        if(clone instanceof MeshStandardMaterial)clone.emissive.setHex(0x177989);
        return clone;
      });
      obj.material=Array.isArray(original)?clones:clones[0];
      restore.push(()=>{obj.material=original;clones.forEach(clone=>clone.dispose());});
    });
    return ()=>restore.forEach(reset=>reset());
  },[scene,highlight,part]);
  return <primitive object={scene}/>;
}
export default function EquipmentLesson({kind}:{kind:AssetKind}){
  const asset=lessons[kind];
  const [turn,setTurn]=useState(0);
  const [scene,setScene]=useState<Group>(),[error,setError]=useState(false),[highlight,select]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();let loaded:Group|undefined;
    async function read(){
      const local=new URL('assets/equipment/'+asset.file,document.baseURI);
      const base=publicApiBase();
      let response:Response|undefined;
      if(base) response=await fetch(base+'/models/'+kind+'/file',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(3500)])}).catch(()=>undefined);
      if(!response?.ok || !response.headers.get('content-type')?.includes('model/gltf-binary')){
        response=await fetch(local,{signal:abort.signal});
      }
      if(!response.ok)throw Error('model');
      const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'');
      loaded=gltf.scene;if(abort.signal.aborted){dispose(loaded);return}
      const bounds=new Box3().setFromObject(loaded),size=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
      const scale=3/Math.max(size.x,size.y,size.z);loaded.scale.setScalar(scale);loaded.position.copy(center.multiplyScalar(-scale));setScene(loaded);
    }
    read().catch(()=>{if(!abort.signal.aborted)setError(true)});
    return ()=>{abort.abort();if(loaded)dispose(loaded)};
  },[asset,kind]);
  return <section>{error?<p>{asset.label} 모형을 열지 못했습니다.</p>:!scene?<p role="status">{asset.label} 모형 준비 중…</p>:<>
    <div className="equipment-viewport"><Canvas frameloop="never" dpr={[1,1.4]} camera={{position:[2.8,2,3.5],fov:42}}>
      <ambientLight intensity={1.6}/><directionalLight position={[3,6,3]} intensity={2.4}/>
      <Equipment scene={scene} highlight={highlight} part={asset.part}/><EquipmentCamera scene={scene} turn={turn} highlight={highlight}/>
    </Canvas></div><div className="equipment-controls"><button type="button" onClick={()=>setTurn(t=>t-1)}>왼쪽 회전</button><button type="button" onClick={()=>setTurn(t=>t+1)}>오른쪽 회전</button><button type="button" aria-pressed={highlight} onClick={()=>select(!highlight)}>{asset.action}</button></div>
    <p>{highlight?asset.detail:asset.intro}</p></>}
    <details><summary>모형 출처·라이선스</summary>
      <a href={asset.source} target="_blank" rel="noreferrer">Innerscene · {asset.sourceTitle}</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer">CC0 1.0</a>. 화면에서 크기와 강조색을 조절했습니다.
    </details></section>;
}
