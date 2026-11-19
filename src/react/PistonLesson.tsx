import {useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei/core/OrbitControls';
import {DoubleSide} from 'three';

// Fixed positions in the cylinder's coordinate system keep each band at a quarter stroke.
const fullStroke = 1.5;
const topOfStroke = .855;
const strokeVertex = `
  varying float sweptFraction;
  varying float sideWall;
  void main() {
    vec4 cylinderPosition = modelMatrix * vec4(position, 1.0);
    sweptFraction = (${topOfStroke} - cylinderPosition.y) / ${fullStroke};
    sideWall = 1.0 - abs(normal.y);
    gl_Position = projectionMatrix * viewMatrix * cylinderPosition;
  }`;
const strokeFragment = `
  varying float sweptFraction;
  varying float sideWall;
  void main() {
    float ticks = 4.0 * sweptFraction;
    float distanceToTick = abs(fract(ticks + 0.5) - 0.5);
    float width = clamp(fwidth(ticks), 0.008, 0.07);
    float line = sideWall * (1.0 - smoothstep(0.0, width, distanceToTick));
    gl_FragColor = vec4(mix(vec3(0.05, 0.55, 0.65), vec3(0.78, 0.97, 1.0), line), mix(0.27, 0.92, line));
    #include <colorspace_fragment>
  }`;

export default function PistonLesson() {
  const [position, setPosition] = useState(0);
  const stroke = position / 100 * fullStroke;
  return <section><div className="equipment-viewport"><Canvas frameloop="demand" dpr={[1,1.4]} camera={{position:[2.5,1.7,3.2],fov:40}}>
    <ambientLight intensity={1.5}/><directionalLight position={[3,5,3]} intensity={2}/>
    <mesh><cylinderGeometry args={[.65,.65,2,44,1,true,Math.PI/2,Math.PI*1.45]}/><meshStandardMaterial color="#7796a9" side={DoubleSide}/></mesh>
    <mesh position={[0,.77-stroke,0]}><cylinderGeometry args={[.61,.61,.17,40]}/><meshStandardMaterial color="#e59445"/></mesh>
    <mesh position={[0,.22-stroke,0]}><cylinderGeometry args={[.10,.10,1,18]}/><meshStandardMaterial color="#c1cbd5"/></mesh>
    {position > 0 && <mesh position={[0,topOfStroke-stroke/2,0]} scale={[1,stroke,1]}>
      <cylinderGeometry args={[.60,.60,1,40]}/>
      <shaderMaterial vertexShader={strokeVertex} fragmentShader={strokeFragment} transparent depthWrite={false}/>
    </mesh>}
    <OrbitControls enablePan={false} enableDamping={false} minDistance={2.8} maxDistance={7}/>
  </Canvas></div><label>피스톤 위치 <input type="range" min={0} max={100} value={position} onChange={e=>setPosition(Number(e.target.value))}/> {position}%</label>
  {position > 0 && <p>눈금 한 칸은 전체 행정 체적의 25%입니다.</p>}
  <p>{position === 0 ? '상사점입니다. 슬라이더를 움직이면 피스톤이 하사점으로 이동합니다.' : position === 100 ? '하사점입니다. 색칠된 공간이 피스톤 한 개가 한 행정에서 밀어내는 체적입니다.' : '현재까지 피스톤이 쓸고 지나간 공간을 색으로 표시했습니다.'}</p>
  <p>현재까지 쓸어낸 체적 = π × (실린더 지름 ÷ 2)² × <strong>전체 행정 길이의 {position}%</strong></p><details><summary>모형 출처</summary>CBT 자체 제작 교육용 단면 모형</details></section>;
}
