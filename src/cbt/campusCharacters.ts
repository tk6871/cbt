import { Box3, BoxGeometry, Color, Group, Material, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

type Action = 'welcome' | 'talk' | 'read' | 'teach' | 'walk';
export type CampusPerson = { id:string; name:string; role:string; message:string; destination:'복도'|'강의실'; guidanceOnly?:boolean };
type Placement = CampusPerson & { file:string; x:number; z:number; angle:number; tint:string; action:Action };
const rows: [string,string,string,number,number,number,string,Action][] = [
  ['guide','서윤','victoria',1.5,21.5,0,'#b8c8eb','welcome'],
  ['reader','후미리야','school-blazer',-4,20,.5,'#ffffff','read'],
  ['school-guide','시부','school-uniform',3.2,20,-.3,'#ffffff','welcome'],
  ['friend-b','준서','student',5.2,15.8,-1.1,'#d0b991','talk'],
  ['walker-a','지우','student',-1.5,7,0,'#8eacc1','walk'],
  ['hall-guide','수아','lecturer',1.5,3,0,'#b8ccbf','welcome'],
  ['walker-b','민재','student',-1.5,-9,0,'#c4ac9c','walk'],
  ['teacher','윤 강사','lecturer',7,-9.2,.2,'#879bbd','teach'],
  ['terrace-guide','비타','terrace-vita',20.2,19.5,-.85,'#ffffff','welcome'],
];
const messages: Record<Action,string> = {
  welcome:'반가워요! 복도를 따라 들어가면 오른쪽에 101 강의실이 있어요. 안내 버튼으로 이동할 수 있어요.',
  talk:'오늘도 한 회차씩 같이 공부해 봐요. 공부 시작을 누르면 현재 선택한 종목의 문제로 연결돼요.',
  read:'오늘 풀 문제를 먼저 훑어보고 있어요. 준비되면 강의실에서 함께 시작해요.',
  teach:'오늘도 차근차근 시작해 볼까요? 공부 시작을 누르면 선택한 종목의 회차별 문제로 이동합니다.',
  walk:'101 강의실로 가는 길이에요. 방향키로 걷거나 목적지 버튼을 이용해 보세요.',
};
const roles:Record<Action,string>={welcome:'대학원생 · 캠퍼스 안내',talk:'대학생 · 스터디 대화',read:'대학생 · 교재 읽기',teach:'성인 강사 · 수업 준비',walk:'대학생 · 이동 중'};
const cast:Placement[]=rows.map(([id,name,file,x,z,angle,tint,action])=>({
  id,name,file,x,z,angle,tint,action,
  guidanceOnly:file.startsWith('school-')||id==='terrace-guide',
  role:id==='school-guide'?'견학 학생 · 캠퍼스 안내':file==='school-blazer'?'견학 학생 · 교재 읽기':id==='terrace-guide'?'테라스 열람 도우미':roles[action],
  message:id==='terrace-guide'?'이곳은 정원 열람 테라스예요. 책을 읽거나 오늘 풀 기출문제를 골라 보세요.':messages[action],
  destination:id==='guide'||id==='school-guide'?'복도':'강의실',
}));
type Actor = { info:Placement; root:Group; bones:Map<string,{node:Object3D; rest:Quaternion}>; phase:number; gestureUntil:number };
export type TeacherStyle = 'lecture' | 'garden';
export type SchoolOutfit = 'uniform' | 'festival';
const uniformPlacement=cast.find(person=>person.id==='school-guide')!;
const festivalPlacement:Placement={...uniformPlacement,file:'school-festival'};

/** Shared geometry/textures, independent skeletons and clothing materials. */
export function loadCampusCharacters(parent:Group, changed:()=>void, failed:()=>void, render:()=>void, initialTeacherStyle:TeacherStyle='lecture') {
  const controller=new AbortController(), timeout=window.setTimeout(()=>controller.abort(),30000);
  const templates:VRM[]=[], staticModels:Group[]=[], actors:Actor[]=[], ownedMaterials=new Set<Material>();
  const propGeometry=new BoxGeometry(1,1,1);
  let disposed=false;
  let teacherStyle=initialTeacherStyle;
  let schoolOutfit:SchoolOutfit='uniform';
  let terraceGuideVisible=true;
  let applyTeacherStyle: (()=>void)|undefined;
  const loader=new GLTFLoader(); loader.register(parser=>new VRMLoaderPlugin(parser));
  function prop(root:Object3D,color:string,scale:[number,number,number],position:[number,number,number]) {
    const material=new MeshStandardMaterial({color,roughness:.8}); ownedMaterials.add(material);
    const mesh=new Mesh(propGeometry,material); mesh.scale.set(...scale); mesh.position.set(...position); root.add(mesh); return mesh;
  }
  async function loadAvatars(files:readonly string[], placements:readonly Placement[]=cast) {
    for(const file of files) {
      const response=await fetch(new URL(`assets/campus/models/${file}.vrm`,document.baseURI),{signal:controller.signal});
      if(!response.ok)throw new Error(`Avatar HTTP ${response.status}`);
      const gltf=await loader.parseAsync(await response.arrayBuffer(),'');
      const template:VRM=gltf.userData.vrm;
      if(!template){VRMUtils.deepDispose(gltf.scene);throw new Error('Missing avatar rig');}
      if(disposed){VRMUtils.deepDispose(template.scene);return;}
      templates.push(template); VRMUtils.rotateVRM0(template);
      template.humanoid.setNormalizedPose({leftUpperArm:{rotation:[0,0,Math.sin(.65),Math.cos(.65)]},rightUpperArm:{rotation:[0,0,Math.sin(-.65),Math.cos(-.65)]}});
      template.update(0); template.scene.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(template.scene), scale=(file==='student'||file==='school-blazer'?1.8:1.7)/bounds.getSize(new Vector3()).y;
      for(const info of placements.filter(person=>person.file===file)) {
        const model=clone(template.scene); model.scale.multiplyScalar(scale); model.position.y-=bounds.min.y*scale;
        const root=new Group(); root.position.set(info.x,.09,info.z); root.rotation.y=info.angle; root.userData.personId=info.id; root.visible=isOutfitActive(info); root.add(model); parent.add(root);
        const bones:Actor['bones']=new Map();
        for(const name of ['head','spine','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg'] as const) {
          const original=template.humanoid.getRawBoneNode(name), node=original&&model.getObjectByName(original.name);
          if(node)bones.set(name,{node,rest:node.quaternion.clone()});
        }
        const materials=new Map<Material,Material>();
        model.traverse(object=>{
          object.frustumCulled=false;
          if(!(object instanceof Mesh))return;
          object.userData.personId=info.id;
          const tint=(material:Material)=>{
            if(!/Tops|Bottoms|HAIR/.test(material.name))return material;
            if(!materials.has(material)) {
              const copy=material.clone() as Material&{color?:Color}; ownedMaterials.add(copy);
              copy.color?.multiply(new Color(/HAIR/.test(material.name)?(info.id==='teacher'?'#a3836f':'#ffffff'):info.tint)); materials.set(material,copy);
            }
            return materials.get(material)!;
          };
          object.material=Array.isArray(object.material)?object.material.map(tint):tint(object.material);
        });
        if(info.action==='read') {
          const book=prop(root,'#344c65',[.32,.035,.23],[0,1.02,.24]); prop(book,'#f5eddb',[.92,.5,.94],[0,.55,0]);
        }
        if(info.id==='teacher') {
          const clipboard=prop(root,'#263a55',[.23,.32,.03],[-.25,1,.08]);
          const fabrics=[...materials.values()].flatMap(material=>{
            const color=(material as Material&{color?:Color}).color;
            return color&&/Tops|Bottoms/i.test(material.name)?[{color,base:color.clone()}]:[];
          });
          applyTeacherStyle=()=>{
            clipboard.visible=teacherStyle==='lecture';
            for(const {color,base} of fabrics) {
              color.copy(base);
              if(teacherStyle==='garden') color.lerp(new Color('#a67366'),.6);
            }
          };
          applyTeacherStyle();
        }
        const actor={info,root,bones,phase:actors.length*.83,gestureUntil:0};
        actors.push(actor);
        if(info.action==='read') {
          rotate(actor,'head',.18); rotate(actor,'leftUpperArm',-.45); rotate(actor,'rightUpperArm',-.45);
          rotate(actor,'leftLowerArm',-1.1);rotate(actor,'rightLowerArm',-1.1);
        }
      }
      render();
    }
  }
  async function loadGuest() {
    const response = await fetch(new URL('assets/campus/models/office-lady.glb', document.baseURI), { signal: controller.signal });
    if (!response.ok) throw new Error('Guest model unavailable');
    const guest = (await loader.parseAsync(await response.arrayBuffer(), '')).scene;
    if (disposed) { VRMUtils.deepDispose(guest); return; }
    staticModels.push(guest);
    const bounds = new Box3().setFromObject(guest), scale = 1.45 / bounds.getSize(new Vector3()).y;
    guest.scale.multiplyScalar(scale); guest.updateMatrixWorld(true);
    const fitted = new Box3().setFromObject(guest), center = fitted.getCenter(new Vector3());
    guest.position.set(-center.x, -fitted.min.y, -center.z);
    const root = new Group(); root.position.set(-1.8, .1, 19); root.add(guest); parent.add(root);
    guest.traverse(object => { object.userData.personId = 'guest-lecturer'; });
    const info:Placement = { id:'guest-lecturer',name:'유나',role:'성인 초청 강사 · 휴식 중',message:'잠깐 쉬었다가 함께 공부해 볼까요? 강의실은 정문 안쪽이에요.',destination:'강의실',file:'office-lady',x:-1.8,z:19,angle:0,tint:'#ffffff',action:'talk' };
    root.userData.personId = info.id;
    prop(root, '#315957', [.5,.055,.42], [0,.53,-.2]);
    for (const x of [-.19,.19]) for (const z of [-.34,-.06])
      prop(root, '#243d3b', [.035,.5,.035], [x,.25,z]);
    actors.push({ info, root, bones:new Map(), phase:0, gestureUntil:0 });
    render();
  }
  function isOutfitActive(info:Placement) {
    if(info.id==='terrace-guide') return terraceGuideVisible;
    return info.id!=='school-guide'||info.file===(schoolOutfit==='uniform'?'school-uniform':'school-festival');
  }
  void Promise.allSettled([loadGuest(),loadAvatars(['victoria','student','lecturer']),loadAvatars(['school-uniform','school-blazer']),loadAvatars(['terrace-vita'])]).then(results=>{
    if(disposed)return;
    if(results.some(result=>result.status==='rejected'))failed();else changed();
  }).finally(()=>window.clearTimeout(timeout));
  function rotate(actor:Actor,name:string,x=0,y=0,z=0) {
    const bone=actor.bones.get(name);if(!bone)return;
    bone.node.quaternion.copy(bone.rest);bone.node.rotateX(x);bone.node.rotateY(y);bone.node.rotateZ(z);
  }
  return {
    react(id:string,time:number) {
      const actor=actors.find(a=>a.info.id===id&&isOutfitActive(a.info));
      if(actor) actor.root.userData.bumpUntil=time+.38;
    },
    contact(x:number,z:number) {
      return actors.find(a=>a.root.visible&&Math.hypot(x-a.root.position.x,z-a.root.position.z)<.56)?.info.id;
    },
    setTerraceGuideVisible(visible:boolean) {
      terraceGuideVisible=visible;
      for(const actor of actors) if(actor.info.id==='terrace-guide') actor.root.visible=visible;
      render();
    },
    setTeacherStyle(style:TeacherStyle){teacherStyle=style;applyTeacherStyle?.();render();},
    async setSchoolOutfit(outfit:SchoolOutfit){
      if(outfit==='festival'&&!actors.some(actor=>actor.info.file==='school-festival')) await loadAvatars(['school-festival'],[festivalPlacement]);
      if(disposed) return;
      schoolOutfit=outfit;
      for(const actor of actors) if(actor.info.id==='school-guide') actor.root.visible=isOutfitActive(actor.info);
      render();
    },
    update(time:number,camera:Vector3,low:boolean,quiet:boolean,talking?:string) {
      const sorted=actors.filter(actor=>isOutfitActive(actor.info)).map(actor=>({actor,distance:actor.root.position.distanceTo(camera)})).sort((a,b)=>a.distance-b.distance);
      let animate=false;
      sorted.forEach(({actor,distance},index)=>{
        actor.root.visible=distance<(low?18:38);
        const impact = Math.max(0, Number(actor.root.userData.bumpUntil || 0)-time);
        actor.root.rotation.z = quiet ? 0 : .32 * impact * Math.sin(impact * 43);
        if(!actor.root.visible||quiet||index>=(low?4:8)||distance>20)return;
        animate=true; const t=time+actor.phase,action=actor.info.action,greeting=actor.info.id===talking||time<actor.gestureUntil;
        rotate(actor,'head',Math.sin(t*1.3)*.035,Math.sin(t*.7)*.12);rotate(actor,'spine',0,0,Math.sin(t)*.015);
        rotate(actor,'leftUpperArm',0,0,Math.sin(t*1.4)*.035);rotate(actor,'rightUpperArm',0,0,Math.sin(t*1.4)*.035);
        if(action==='walk'&&!greeting) {
          actor.root.position.z=actor.info.z+Math.sin(t*.22)*2;actor.root.rotation.y=Math.cos(t*.22)>0?0:Math.PI;
          rotate(actor,'leftUpperLeg',Math.sin(t*4)*.22);rotate(actor,'rightUpperLeg',-Math.sin(t*4)*.22);
          rotate(actor,'leftUpperArm',-Math.sin(t*4)*.18);rotate(actor,'rightUpperArm',Math.sin(t*4)*.18);
        } else {
          rotate(actor,'leftUpperLeg');rotate(actor,'rightUpperLeg');
          if(greeting||['talk','teach','welcome'].includes(action)){rotate(actor,'rightUpperArm',-.2,0,-.3);rotate(actor,'rightLowerArm',-.8+Math.sin(t*2)*.12);}
          if(action==='read'){rotate(actor,'head',.18);rotate(actor,'leftUpperArm',-.45);rotate(actor,'rightUpperArm',-.45);rotate(actor,'leftLowerArm',-1.1);rotate(actor,'rightLowerArm',-1.1);}
        }
      });
      return animate;
    },
    nearest(camera:Vector3):CampusPerson|undefined {return actors.filter(a=>a.root.visible&&a.root.position.distanceTo(camera)<3.4).sort((a,b)=>a.root.position.distanceTo(camera)-b.root.position.distanceTo(camera))[0]?.info;},
    greet(id:string,time:number){const actor=actors.find(a=>a.info.id===id&&isOutfitActive(a.info));if(actor)actor.gestureUntil=time+3;},
    dispose(){
      disposed=true;controller.abort();window.clearTimeout(timeout);
      for(const actor of actors)actor.root.traverse(object=>{if(object instanceof SkinnedMesh)object.skeleton.dispose();});
      ownedMaterials.forEach(material=>material.dispose());propGeometry.dispose();
      for(const template of templates)VRMUtils.deepDispose(template.scene);
      for(const model of staticModels)VRMUtils.deepDispose(model);
      parent.clear();actors.length=0;
    },
  };
}
