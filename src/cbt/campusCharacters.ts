import { Box3, BoxGeometry, Color, Group, Material, Mesh, MeshStandardMaterial, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

type Action = 'welcome' | 'talk' | 'read' | 'write' | 'teach' | 'walk';
export type CampusPerson = { id:string; name:string; role:string; message:string; destination:'복도'|'강의실' };
type Placement = CampusPerson & { file:string; x:number; z:number; angle:number; tint:string; action:Action };
const rows: [string,string,string,number,number,number,string,Action][] = [
  ['guide','서윤','victoria',1.5,21.5,0,'#b8c8eb','welcome'],
  ['reader','도현','student',-4,20,.5,'#a1bac8','read'],
  ['friend-a','하린','victoria',4,17,1.1,'#c9b7d7','talk'],
  ['friend-b','준서','student',5.2,17,-1.1,'#d0b991','talk'],
  ['walker-a','지우','student',-1.5,7,0,'#8eacc1','walk'],
  ['hall-guide','수아','lecturer',1.5,3,0,'#b8ccbf','welcome'],
  ['walker-b','민재','student',-1.5,-9,0,'#c4ac9c','walk'],
  ['teacher','윤 강사','lecturer',7,-9.2,.2,'#879bbd','teach'],
  ['writer','은채','victoria',6,-2.7,Math.PI,'#d3b4b8','write'],
  ['study-a','현우','student',9.3,-6.5,Math.PI,'#a8bea5','read'],
  ['study-b','유진','lecturer',12,-4.8,-1.2,'#c0b4d6','talk'],
  ['study-c','태오','student',13,-4.8,1.2,'#aab4cb','talk'],
];
const messages: Record<Action,string> = {
  welcome:'반가워요! 복도를 따라 들어가면 오른쪽에 101 강의실이 있어요. 안내 버튼으로 이동할 수 있어요.',
  talk:'오늘도 한 회차씩 같이 공부해 봐요. 공부 시작을 누르면 현재 선택한 종목의 문제로 연결돼요.',
  read:'오늘 풀 문제를 먼저 훑어보고 있어요. 준비되면 강의실에서 함께 시작해요.',
  write:'중요한 부분을 노트에 정리하고 있어요. 해설을 확인하고 다시 풀어보면 도움이 돼요.',
  teach:'오늘도 차근차근 시작해 볼까요? 공부 시작을 누르면 선택한 종목의 회차별 문제로 이동합니다.',
  walk:'101 강의실로 가는 길이에요. 방향키로 걷거나 목적지 버튼을 이용해 보세요.',
};
const roles:Record<Action,string>={welcome:'대학원생 · 캠퍼스 안내',talk:'대학생 · 스터디 대화',read:'대학생 · 교재 읽기',write:'대학생 · 노트 정리',teach:'성인 강사 · 수업 준비',walk:'대학생 · 이동 중'};
const cast:Placement[]=rows.map(([id,name,file,x,z,angle,tint,action])=>({id,name,file,x,z,angle,tint,action,role:roles[action],message:messages[action],destination:id==='guide'?'복도':'강의실'}));
type Actor = { info:Placement; root:Group; bones:Map<string,{node:Object3D; rest:Quaternion}>; phase:number; gestureUntil:number };

/** Shared geometry/textures, independent skeletons and clothing materials. */
export function loadCampusCharacters(parent:Group, changed:()=>void, failed:()=>void) {
  const controller=new AbortController(), timeout=window.setTimeout(()=>controller.abort(),30000);
  const templates:VRM[]=[], actors:Actor[]=[], ownedMaterials=new Set<Material>();
  const propGeometry=new BoxGeometry(1,1,1);
  let disposed=false;
  const loader=new GLTFLoader(); loader.register(parser=>new VRMLoaderPlugin(parser));
  function prop(root:Object3D,color:string,scale:[number,number,number],position:[number,number,number]) {
    const material=new MeshStandardMaterial({color,roughness:.8}); ownedMaterials.add(material);
    const mesh=new Mesh(propGeometry,material); mesh.scale.set(...scale); mesh.position.set(...position); root.add(mesh); return mesh;
  }
  void(async()=>{
    for(const file of ['victoria','student','lecturer']) {
      const response=await fetch(new URL(`assets/campus/models/${file}.vrm`,document.baseURI),{signal:controller.signal});
      if(!response.ok)throw new Error(`Avatar HTTP ${response.status}`);
      const gltf=await loader.parseAsync(await response.arrayBuffer(),'');
      const template:VRM=gltf.userData.vrm;
      if(disposed){VRMUtils.deepDispose(template.scene);return;}
      templates.push(template); VRMUtils.rotateVRM0(template);
      template.humanoid.setNormalizedPose({leftUpperArm:{rotation:[0,0,Math.sin(.65),Math.cos(.65)]},rightUpperArm:{rotation:[0,0,Math.sin(-.65),Math.cos(-.65)]}});
      template.update(0); template.scene.updateMatrixWorld(true);
      const bounds=new Box3().setFromObject(template.scene), scale=(file==='student'?1.8:1.7)/bounds.getSize(new Vector3()).y;
      for(const info of cast.filter(person=>person.file===file)) {
        const model=clone(template.scene); model.scale.multiplyScalar(scale); model.position.y-=bounds.min.y*scale;
        const root=new Group(); root.position.set(info.x,.09,info.z); root.rotation.y=info.angle; root.userData.personId=info.id; root.add(model); parent.add(root);
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
        if(['read','write'].includes(info.action)) {
          const book=prop(root,'#344c65',[.32,.035,.23],[0,1.02,.24]); prop(book,'#f5eddb',[.92,.5,.94],[0,.55,0]);
        }
        if(info.action==='teach')prop(root,'#263a55',[.23,.32,.03],[-.25,1,.08]);
        const actor={info,root,bones,phase:actors.length*.83,gestureUntil:0};
        actors.push(actor);
        if(info.action==='read'||info.action==='write') {
          rotate(actor,'head',.18); rotate(actor,'leftUpperArm',-.45); rotate(actor,'rightUpperArm',-.45);
          rotate(actor,'leftLowerArm',-1.1);rotate(actor,'rightLowerArm',-1.1);
        }
        if(info.id==='writer'||info.id==='study-a') {
          root.position.y=-.34;
          rotate(actor,'leftUpperLeg',-1.3);rotate(actor,'rightUpperLeg',-1.3);
          rotate(actor,'leftLowerLeg',1.3);rotate(actor,'rightLowerLeg',1.3);
        }
      }
    }
    changed();
  })().catch(()=>{if(!disposed)failed();}).finally(()=>window.clearTimeout(timeout));
  function rotate(actor:Actor,name:string,x=0,y=0,z=0) {
    const bone=actor.bones.get(name);if(!bone)return;
    bone.node.quaternion.copy(bone.rest);bone.node.rotateX(x);bone.node.rotateY(y);bone.node.rotateZ(z);
  }
  return {
    update(time:number,camera:Vector3,low:boolean,quiet:boolean,talking?:string) {
      const sorted=actors.map(actor=>({actor,distance:actor.root.position.distanceTo(camera)})).sort((a,b)=>a.distance-b.distance);
      let animate=false;
      sorted.forEach(({actor,distance},index)=>{
        actor.root.visible=distance<(low?18:38);
        if(!actor.root.visible||quiet||index>=(low?4:8)||distance>20)return;
        animate=true; const t=time+actor.phase,action=actor.info.action,greeting=actor.info.id===talking||time<actor.gestureUntil;
        rotate(actor,'head',Math.sin(t*1.3)*.035,Math.sin(t*.7)*.12);rotate(actor,'spine',0,0,Math.sin(t)*.015);
        rotate(actor,'leftUpperArm',0,0,Math.sin(t*1.4)*.035);rotate(actor,'rightUpperArm',0,0,Math.sin(t*1.4)*.035);
        if(action==='walk'&&!greeting) {
          actor.root.position.z=actor.info.z+Math.sin(t*.22)*2;actor.root.rotation.y=Math.cos(t*.22)>0?0:Math.PI;
          rotate(actor,'leftUpperLeg',Math.sin(t*4)*.22);rotate(actor,'rightUpperLeg',-Math.sin(t*4)*.22);
          rotate(actor,'leftUpperArm',-Math.sin(t*4)*.18);rotate(actor,'rightUpperArm',Math.sin(t*4)*.18);
        } else {
          if(actor.info.id!=='writer'&&actor.info.id!=='study-a'){rotate(actor,'leftUpperLeg');rotate(actor,'rightUpperLeg');}
          if(greeting||['talk','teach','welcome'].includes(action)){rotate(actor,'rightUpperArm',-.2,0,-.3);rotate(actor,'rightLowerArm',-.8+Math.sin(t*2)*.12);}
          if(action==='read'||action==='write'){rotate(actor,'head',.18);rotate(actor,'leftUpperArm',-.45);rotate(actor,'rightUpperArm',-.45);rotate(actor,'leftLowerArm',-1.1);rotate(actor,'rightLowerArm',-1.1+(action==='write'?Math.sin(t*5)*.08:0));}
        }
      });
      return animate;
    },
    nearest(camera:Vector3):CampusPerson|undefined {return actors.filter(a=>a.root.visible&&a.root.position.distanceTo(camera)<3.4).sort((a,b)=>a.root.position.distanceTo(camera)-b.root.position.distanceTo(camera))[0]?.info;},
    greet(id:string,time:number){const actor=actors.find(a=>a.info.id===id);if(actor)actor.gestureUntil=time+3;},
    dispose(){
      disposed=true;controller.abort();window.clearTimeout(timeout);
      for(const actor of actors)actor.root.traverse(object=>{if(object instanceof SkinnedMesh)object.skeleton.dispose();});
      ownedMaterials.forEach(material=>material.dispose());propGeometry.dispose();
      for(const template of templates)VRMUtils.deepDispose(template.scene);
      parent.clear();actors.length=0;
    },
  };
}
