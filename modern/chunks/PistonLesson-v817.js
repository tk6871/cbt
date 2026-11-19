import{r as n,j as e}from"./materials-v817.js";import{C as l}from"./react-three-fiber.esm-v817.js";import{O as c}from"./OrbitControls-v817.js";import{D as d}from"./three.module-v817.js";import"./problem-image-index-v817.js";import"./_commonjsHelpers-v817.js";const s=1.5,a=.855,m=`
  varying float sweptFraction;
  varying float sideWall;
  void main() {
    vec4 cylinderPosition = modelMatrix * vec4(position, 1.0);
    sweptFraction = (${a} - cylinderPosition.y) / ${s};
    sideWall = 1.0 - abs(normal.y);
    gl_Position = projectionMatrix * viewMatrix * cylinderPosition;
  }`,x=`
  varying float sweptFraction;
  varying float sideWall;
  void main() {
    float ticks = 4.0 * sweptFraction;
    float distanceToTick = abs(fract(ticks + 0.5) - 0.5);
    float width = clamp(fwidth(ticks), 0.008, 0.07);
    float line = sideWall * (1.0 - smoothstep(0.0, width, distanceToTick));
    gl_FragColor = vec4(mix(vec3(0.05, 0.55, 0.65), vec3(0.78, 0.97, 1.0), line), mix(0.27, 0.92, line));
    #include <colorspace_fragment>
  }`;function v(){const[i,r]=n.useState(0),t=i/100*s;return e.jsxs("section",{children:[e.jsx("div",{className:"equipment-viewport",children:e.jsxs(l,{frameloop:"demand",dpr:[1,1.4],camera:{position:[2.5,1.7,3.2],fov:40},children:[e.jsx("ambientLight",{intensity:1.5}),e.jsx("directionalLight",{position:[3,5,3],intensity:2}),e.jsxs("mesh",{children:[e.jsx("cylinderGeometry",{args:[.65,.65,2,44,1,!0,Math.PI/2,Math.PI*1.45]}),e.jsx("meshStandardMaterial",{color:"#7796a9",side:d})]}),e.jsxs("mesh",{position:[0,.77-t,0],children:[e.jsx("cylinderGeometry",{args:[.61,.61,.17,40]}),e.jsx("meshStandardMaterial",{color:"#e59445"})]}),e.jsxs("mesh",{position:[0,.22-t,0],children:[e.jsx("cylinderGeometry",{args:[.1,.1,1,18]}),e.jsx("meshStandardMaterial",{color:"#c1cbd5"})]}),i>0&&e.jsxs("mesh",{position:[0,a-t/2,0],scale:[1,t,1],children:[e.jsx("cylinderGeometry",{args:[.6,.6,1,40]}),e.jsx("shaderMaterial",{vertexShader:m,fragmentShader:x,transparent:!0,depthWrite:!1})]}),e.jsx(c,{enablePan:!1,enableDamping:!1,minDistance:2.8,maxDistance:7})]})}),e.jsxs("label",{children:["피스톤 위치 ",e.jsx("input",{type:"range",min:0,max:100,value:i,onChange:o=>r(Number(o.target.value))})," ",i,"%"]}),i>0&&e.jsx("p",{children:"눈금 한 칸은 전체 행정 체적의 25%입니다."}),e.jsx("p",{children:i===0?"상사점입니다. 슬라이더를 움직이면 피스톤이 하사점으로 이동합니다.":i===100?"하사점입니다. 색칠된 공간이 피스톤 한 개가 한 행정에서 밀어내는 체적입니다.":"현재까지 피스톤이 쓸고 지나간 공간을 색으로 표시했습니다."}),e.jsx("p",{children:"한 기통의 행정체적 = π × (실린더 지름 ÷ 2)² × 행정 길이"}),e.jsxs("details",{children:[e.jsx("summary",{children:"모형 출처"}),"CBT 자체 제작 교육용 단면 모형"]})]})}export{v as default};
