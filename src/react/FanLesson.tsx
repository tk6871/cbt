import {useMemo,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei/core/OrbitControls';
import {Shape} from 'three';

function Rotor({scale,x}:{scale:number;x:number}) {
  const blade=useMemo(()=>{
    const shape=new Shape();
    shape.moveTo(.19,0); shape.quadraticCurveTo(.55,.03,.86,.37);
    shape.lineTo(.91,.32);shape.quadraticCurveTo(.57,-.05,.19,-.045);shape.closePath();
    return shape;
  },[]);
  return <group position={[x,0,0]} scale={scale}>
    <mesh><cylinderGeometry args={[1,1,.08,48]}/><meshStandardMaterial color="#397fa9"/></mesh>
    <mesh position={[0,.09,0]}><cylinderGeometry args={[.14,.21,.23,32]}/><meshStandardMaterial color="#c5d1d2"/></mesh>
    {Array.from({length:8},(_,i)=><group key={i} rotation={[0,i*Math.PI/4,0]}>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,.04,0]}>
        <extrudeGeometry args={[blade,{depth:.2,bevelEnabled:false}]} />
        <meshStandardMaterial color="#bed4df"/>
      </mesh>
    </group>)}
  </group>;
}
export default function FanLesson(){
  const [compare,setCompare]=useState(false);
  return <section><div style={{height:230}}>
    <Canvas frameloop="demand" dpr={[1,1.4]} camera={{position:[0,3.7,4.8],fov:36}} fallback={<p>3D 표시를 지원하지 않는 기기입니다.</p>}>
      <ambientLight intensity={1.45}/><directionalLight position={[3,6,3]} intensity={2}/>
      <Rotor x={compare?-1.12:0} scale={compare?.55:1}/>
      {compare&&<Rotor x={.85} scale={1.1}/>}
      <OrbitControls enablePan={false} enableDamping={false} minDistance={3} maxDistance={8}/>
    </Canvas></div>
    {compare && <div className="fan-comparison" aria-label="같은 회전수에서 지름 비교"><b>D</b><b>2D</b></div>}
    <button type="button" aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare?'기본 구조 보기':'지름 D와 2D 비교'}</button>
    <p>{compare?'같은 회전수와 공기 밀도에서 기하학적으로 닮은 송풍기를 비교하면, 지름이 2배일 때 풍량은 8배, 압력은 4배, 동력은 32배입니다.':'중앙 허브와 바깥쪽 날개를 보세요. 드래그하면 임펠러를 다른 각도에서 볼 수 있습니다.'}</p>
    <details><summary>모형 출처·라이선스</summary>CBT 자체 제작 교육용 개념 모형입니다. 외부 모형 파일을 사용하지 않았습니다.</details>
  </section>;
}
