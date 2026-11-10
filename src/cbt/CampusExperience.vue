<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import * as T from 'three';
import { loadCampusCharacters, type CampusPerson } from './campusCharacters';

defineProps<{ subject: string }>();
const emit = defineEmits<{ close: []; study: [] }>();
const host = ref<HTMLDivElement>();
const root = ref<HTMLElement>();
const zone = ref('정문');
const error = ref('');
const moving = ref(false);
const quiet = ref(matchMedia('(prefers-reduced-motion: reduce)').matches);
const low = ref(matchMedia('(pointer: coarse)').matches);
const characterStatus = ref('캐릭터 불러오는 중…');
let characters: ReturnType<typeof loadCampusCharacters> | undefined;
let characterGroup: T.Group;
const nearby = ref<CampusPerson>();
const conversation = ref<CampusPerson>();
let renderedAt = 0;
let renderer: T.WebGLRenderer | undefined;
let scene: T.Scene;
let camera: T.PerspectiveCamera;
let door: T.Group;
let frame = 0;
let observer: ResizeObserver | undefined;
let yaw = 0;
let pitch = 0;
let last = 0;
let drag: { id: number; x: number; y: number; moved: boolean } | undefined;
let route: T.Vector3[] = [];
let destination: '정문' | '복도' | '강의실' = '정문';
const keys = new Set<string>();
const disposables = new Set<{ dispose(): void }>();
const v = (x: number, z: number) => new T.Vector3(x, 1.65, z);
const previousOverflow = document.body.style.overflow;
const previousFocus = document.activeElement as HTMLElement | null;

function material(color: string, extra: T.MeshStandardMaterialParameters = {}) {
  const m = new T.MeshStandardMaterial({ color, roughness: .85, ...extra });
  disposables.add(m); return m;
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material, parent: T.Object3D = scene) {
  const geo = new T.BoxGeometry(w, h, d); disposables.add(geo);
  const mesh = new T.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function leg(x: number, y: number, z: number, height: number, m: T.Material) {
  const geometry = new T.CylinderGeometry(.025, .025, height, 10); disposables.add(geometry);
  const mesh = new T.Mesh(geometry, m); mesh.position.set(x, y, z); scene.add(mesh);
}
function label(text: string, x: number, y: number, z: number, width: number, color = '#f8eee0', bg = '#183c39') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 62px system-ui, sans-serif'; ctx.fillText(text, 512, 128, 960);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; disposables.add(texture);
  const mat = new T.MeshBasicMaterial({ map: texture }); disposables.add(mat);
  const geo = new T.PlaneGeometry(width, width / 4); disposables.add(geo);
  const mesh = new T.Mesh(geo, mat); mesh.position.set(x, y, z); scene.add(mesh); return mesh;
}
function build() {
  scene = new T.Scene(); scene.background = new T.Color('#d9e4df'); scene.fog = new T.Fog('#d9e4df', 35, 90);
  camera = new T.PerspectiveCamera(65, 1, .08, 120); camera.position.copy(v(0, 24)); camera.rotation.order = 'YXZ';
  scene.add(new T.HemisphereLight('#fff8e5', '#687773', 2.5));
  const sun = new T.DirectionalLight('#ffe1ae', 3); sun.position.set(-8, 16, 16); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 30, bottom: -30, near: .5, far: 70 });
  sun.shadow.bias = -.001;
  sun.shadow.normalBias = .035;
  const cream = material('#e7e0cf'), teal = material('#315957'), wood = material('#af8054'), dark = material('#243d3b');
  const floor = material('#c9c7b9'), grass = material('#809784'), line = material('#b4b6aa');
  const windowMat = material('#b6dfeb', { metalness: .1, roughness: .12, transparent: true, opacity: .3, depthWrite: false });
  const brass = material('#bd955e', { metalness: .65, roughness: .35 });
  const paper = material('#fff6de');
  box(100, .2, 100, 0, -.2, 0, grass);
  box(10, .1, 22, 0, -.04, 23, floor);
  box(6, .12, 30, 0, 0, -1, floor);
  box(13, .12, 12, 9, 0, -5, floor);
  const parquet = material('#bfa98b');
  box(12.2, .025, 11.7, 9.25, .075, -5, parquet);
  for (let x = 3.2; x < 15.3; x += .35) box(.008, .004, 11.7, x, .09, -5, line);
  // A real opening connects the courtyard, corridor and classroom.
  for (const side of [-1, 1]) {
    box(12, 1.35, .45, side*8, .675, 12, cream);
    box(12, 2.6, .45, side*8, 4.7, 12, cream);
    for (const x of [2,5,9,14]) box(.24, 2.1, .5, side*x, 2.4, 12, cream);
    for (let x=2.3; x<14; x+=.45) box(.06, 1.3, .18, side*x, 4.9, 12.3, wood);
  }
  box(4, 2.5, .45, 0, 4.75, 12, cream);
  box(29, .35, 2, 0, 6.1, 12, teal);
  label('LEARNING CAMPUS', 0, 4.65, 12.4, 5.2);
  box(7,.18,4,0,3.55,13.5,wood);
  for(const x of [-3.2,3.2])box(.14,3.5,.14,x,1.75,15,brass);
  for(let x=-3;x<=3;x+=.4)box(.04,.08,3.8,x,3.43,13.5,paper);
  for (const x of [-11, -7, 7, 11]) box(2.6, 2.1, .1, x, 2.5, 12.26, windowMat);
  box(.25, 4, 28, -3, 2, -2, cream);
  box(.25, 4, 17, 3, 2, 4.5, cream); box(.25, 4, 10, 3, 2, -11, cream);
  box(.25, 1, 2, 3, 3.5, -5, cream); box(6, 4, .25, 0, 2, -16, cream);
  box(.25, 1.4, 12, 15.5, .7, -5, cream);
  box(.25, .65, 12, 15.5, 3.75, -5, cream);
  for(const z of [-11,-9.3,-6.7,-5.3,-2.7,-1.3,1])box(.25,2,.16,15.5,2.4,z,cream);
  box(12.5, 4, .25, 9.25, 2, -11, cream);
  box(12.5, 4, .25, 9.25, 2, 1, cream);
  // Coffered ceilings, timber wall panels and framed glazing add human scale.
  box(6, .12, 28, 0, 4.1, -2, paper);
  box(12.5, .12, 12, 9.25, 4.1, -5, paper);
  for (let z = -14; z < 12; z += .65) box(.06, 1, .04, -2.84, .55, z, wood);
  for (const x of [4.2, 7.5, 10.8, 14.2]) box(.1, .12, 12, x, 3.98, -5, wood);
  for (const z of [-9, -5, -1]) {
    box(11, .07, .1, 9.25, 3.99, z, wood);
    for (const x of [6, 12]) {
      box(.03, .45, .03, x, 3.7, z, brass);
      box(1.5, .08, .45, x, 3.45, z, material('#fff2d4', { emissive: '#ffe1ad', emissiveIntensity: .6 }));
    }
  }
  for (let z = -14; z < 12; z += 4) {
    box(6, .18, .28, 0, 3.8, z, wood);
    box(.8, .06, 1.6, 0, 3.65, z, material('#fff4ce', { emissive: '#fff4ce', emissiveIntensity: .8 }));
    box(.03, 1.6, 2.5, -2.85, 2.2, z, windowMat);
  }
  for (let z = -14; z < 33; z += 2) box(5.8, .008, .02, 0, .068, z, line);
  for (const x of [-1, 1]) box(.025, .008, 28, x, .07, -1, line);
  label('01   STUDY HALL  →', 0, 2.6, -15.8, 4.5);
  const plaque = label('101  /  강의실', 2.84, 2.7, -3, 2.3); plaque.rotation.y = -Math.PI / 2;
  door = new T.Group(); door.position.set(3, 0, -6); scene.add(door);
  box(.12, 2.9, 1.95, 0, 1.45, .98, wood, door);
  box(.16, .8, .7, 0, 2.1, .98, windowMat, door);
  box(.25, .06, .1, -.12, 1.1, 1.7, dark, door);
  box(8, 2.2, .16, 9.5, 2.1, -10.75, dark);
  label('오늘의 한 걸음이 실력이 됩니다.', 9.5, 2.2, -10.65, 7);
  box(3, .15, 1.3, 9.5, .9, -9, wood);
  for (const x of [8.3, 10.7]) box(.12, .85, 1, x, .45, -9, dark);
  for (const x of [6, 9.3, 12.6]) for (const z of [-7.3, -3.5, -.4]) {
    box(1.65, .12, .85, x, .8, z, wood);
    for (const dx of [-.65, .65]) for (const dz of [-.3, .3]) leg(x + dx, .42, z + dz, .75, dark);
    box(.65, .1, .6, x, .45, z + .8, teal); box(.65, .6, .08, x, .8, z + 1.05, teal);
    for (const dx of [-.25, .25]) for (const dz of [.55, 1.05]) leg(x + dx, .25, z + dz, .4, dark);
  }
  for (const z of [-8, -4, 0]) {
    box(.06, 1.8, 2.4, 15.34, 2.4, z, windowMat);
    for (const dz of [-1.23, 0, 1.23]) box(.13, 1.95, .055, 15.26, 2.4, z + dz, paper);
    for (const y of [1.44, 2.4, 3.36]) box(.13, .055, 2.5, 15.26, y, z, paper);
    box(.45, .08, 2.7, 15.1, 1.4, z, wood);
  }
  // Rounded canopies instead of the original faceted placeholders.
  for (const x of [-7, 7]) for (const z of [19, 27]) {
    box(.25, 2, .25, x, 1, z, wood);
    const geo = new T.SphereGeometry(1.7, 20, 14); disposables.add(geo);
    const crown = new T.Mesh(geo, material('#739a78')); crown.scale.set(1, 1.3, 1); crown.position.set(x, 3, z); scene.add(crown);
    box(2, .15, .65, x * .8, .5, z - 2, wood);
    for (const dx of [-.7, .7]) box(.12, .5, .5, x * .8 + dx, .25, z - 2, dark);
  }
  for(const z of [-9,-3,3]) {
    box(1.5,.6,2.4,18,.3,z,cream);
    for(const dz of [-.7,0,.7]) {
      const geometry=new T.SphereGeometry(.65,16,12);disposables.add(geometry);
      const shrub=new T.Mesh(geometry,material('#719b78'));shrub.position.set(18,1,z+dz);scene.add(shrub);
    }
  }
}
function go(target: typeof destination) {
  if (!camera || error.value) return;
  conversation.value = undefined;
  keys.clear(); destination = target;
  const start: T.Vector3[] = camera.position.x > 3 ? [v(4.8, -5), v(0, -5)] : [v(0, Math.min(24, camera.position.z))];
  route = [...start, ...(target === '정문' ? [v(0, 24)] : target === '복도' ? [v(0, 5)] : [v(0, -5), v(4.8, -5), v(4.8, -.3)])];
  moving.value = true;
  if (quiet.value) { camera.position.copy(route[route.length - 1]); route = []; moving.value = false; yaw = target === '강의실' ? -.45 : 0; pitch = 0; }
  wake();
}
function walkable(x: number, z: number) {
  return (z >= 12.5 && z < 32 && Math.abs(x) < 12) || (Math.abs(x) < 1.7 && z >= 11.5 && z < 14)
    || (Math.abs(x) < 2.65 && z < 12 && z > -15.5)
    || (x >= 2.6 && x < 4 && z > -5.7 && z < -4.3)
    || (x >= 3.4 && x < 15 && z > -10.4 && z < .5);
}
function tick(now: number) {
  frame = 0;
  if (!renderer || document.hidden || error.value) return;
  if (now - renderedAt < 1000 / 30) { wake(); return; }
  renderedAt = now;
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (route.length) {
    const delta = route[0].clone().sub(camera.position);
    if (delta.length() < .06) { camera.position.copy(route.shift()!); }
    else {
      camera.position.add(delta.normalize().multiplyScalar(Math.min(dt * 4, camera.position.distanceTo(route[0]))));
      const desired = Math.atan2(-delta.x, -delta.z);
      yaw += Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw)) * Math.min(1, dt * 5);
      pitch *= 1 - Math.min(1, dt * 5);
    }
    if (!route.length) { moving.value = false; yaw = destination === '강의실' ? -.45 : 0; }
  } else if (keys.size) {
    const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
    const side = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    const delta = new T.Vector3(side, 0, -forward).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), yaw).multiplyScalar(dt * 3);
    const p = camera.position;
    if (walkable(p.x + delta.x, p.z)) p.x += delta.x;
    if (walkable(p.x, p.z + delta.z)) p.z += delta.z;
  }
  zone.value = camera.position.x > 3.4 ? '강의실' : camera.position.z > 12 ? '정문' : '복도';
  const doorTarget = camera.position.distanceTo(v(3, -5)) < 5 || route.length > 0 || camera.position.x > 3 ? -Math.PI / 2 : 0;
  door.rotation.y += (doorTarget - door.rotation.y) * Math.min(1, dt * 5);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const animate = characters?.update(now / 1000, camera.position, low.value, quiet.value, conversation.value?.id);
  nearby.value = characters?.nearest(camera.position);
  renderer.render(scene, camera);
  if (animate || route.length || keys.size || Math.abs(doorTarget - door.rotation.y) > .001) wake();
}
function wake() { if (!frame && renderer && !document.hidden) frame = requestAnimationFrame(tick); }
function resize() {
  if (!renderer || !host.value) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, low.value ? 1.5 : 2));
  renderer.shadowMap.enabled = !low.value;
  renderer.setSize(host.value.clientWidth, host.value.clientHeight);
  camera.aspect = host.value.clientWidth / Math.max(1, host.value.clientHeight); camera.updateProjectionMatrix(); wake();
}
function down(e: PointerEvent) {
  if (e.button !== 0) return;
  route = []; moving.value = false; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  host.value?.setPointerCapture(e.pointerId); host.value?.focus();
}
function move(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  if (Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>2) drag.moved=true;
  yaw -= (e.clientX - drag.x) * .004; pitch = T.MathUtils.clamp(pitch - (e.clientY - drag.y) * .004, -.8, .8);
  drag.x = e.clientX; drag.y = e.clientY; wake();
}
function release(e: PointerEvent) {
  if (e.type === 'pointerup' && drag && !drag.moved && characterGroup && nearby.value && host.value) {
    const rect=host.value.getBoundingClientRect(), ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObject(characterGroup,true)[0];
    if(hit?.object.userData.personId===nearby.value.id)interact();
  }
  drag = undefined;
}
function interact() {
  if (!nearby.value) return;
  keys.clear(); route=[]; moving.value=false; conversation.value=nearby.value;
  characters?.greet(nearby.value.id,performance.now()/1000); wake();
  void nextTick(()=>root.value?.querySelector<HTMLButtonElement>('.campus-conversation button')?.focus());
}
function dismissConversation() { conversation.value=undefined; host.value?.focus(); wake(); }
function key(e: KeyboardEvent) {
  if (e.key === 'Escape') { if(conversation.value)dismissConversation();else emit('close'); return; }
  if (e.key === 'Tab') {
    const nodes = Array.from(root.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]') || []);
    const first = nodes[0], end = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end?.focus(); }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first?.focus(); }
    return;
  }
  if (e.target instanceof HTMLElement && e.target.closest('button,input,select')) return;
  if (conversation.value) return;
  const k = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
    e.preventDefault(); route = []; moving.value = false; keys.add(k); wake();
  }
  if (k === 'e' && nearby.value) { e.preventDefault(); interact(); }
}
function keyup(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()); }
function pause() { keys.clear(); drag = undefined; if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { last = performance.now(); wake(); } }
function contextLost(e: Event) { e.preventDefault(); error.value = '3D 화면 연결이 중단됐어요. 기존 CBT로 돌아갔다가 다시 열어주세요.'; cancelAnimationFrame(frame); frame = 0; }
onMounted(async () => {
  document.body.style.overflow = 'hidden'; await nextTick(); root.value?.querySelector('button')?.focus();
  window.addEventListener('keyup', keyup); window.addEventListener('blur', pause); document.addEventListener('visibilitychange', pause);
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.type = T.PCFSoftShadowMap;
    build(); host.value!.appendChild(renderer.domElement);
    characterGroup = new T.Group(); scene.add(characterGroup);
    characters = loadCampusCharacters(characterGroup, () => { characterStatus.value = ''; wake(); }, () => { characterStatus.value = '캐릭터를 불러오지 못했어요. 이동과 공부는 이용할 수 있습니다.'; });
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    observer = new ResizeObserver(resize); observer.observe(host.value!); last = performance.now(); resize();
  } catch { error.value = '이 기기에서는 3D 화면을 열 수 없어요. 기존 CBT는 그대로 이용할 수 있습니다.'; }
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame); observer?.disconnect(); keys.clear();
  characters?.dispose();
  window.removeEventListener('keyup', keyup); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', pause);
  renderer?.domElement.removeEventListener('webglcontextlost', contextLost);
  disposables.forEach(item => item.dispose()); renderer?.dispose(); renderer?.forceContextLoss();
  document.body.style.overflow = previousOverflow; previousFocus?.focus();
});
</script>

<template>
  <section ref="root" class="campus" role="dialog" aria-modal="true" aria-label="3D 캠퍼스 체험" @keydown="key">
    <div ref="host" class="campus-scene" tabindex="0" aria-label="3D 공간. 드래그로 둘러보기, 방향키 또는 WASD로 앞뒤와 좌우 이동. 아래 목적지 버튼으로도 이동할 수 있습니다." @pointerdown="down" @pointermove="move" @pointerup="release" @pointercancel="release" @lostpointercapture="release" />
    <header class="campus-top">
      <button type="button" class="campus-back" @click="emit('close')">← 기존 CBT</button>
      <div class="campus-brand"><strong>LEARNING CAMPUS</strong><span>3D 캠퍼스 · 체험판</span></div>
      <label class="campus-quality"><input v-model="low" type="checkbox" @change="resize"> 절전</label>
    </header>
    <p v-if="characterStatus" class="character-status" role="status">{{ characterStatus }}</p>
    <button v-if="nearby && !conversation && !error" class="campus-person-action" @click="interact">{{ nearby.name }} · 대화하기 <kbd>E</kbd></button>
    <section v-if="conversation && !error" class="campus-conversation" aria-label="캠퍼스 인물 대화">
      <small>{{ conversation.role }}</small><h2>{{ conversation.name }}</h2><p>{{ conversation.message }}</p>
      <div><button @click="dismissConversation">대화 닫기</button><button @click="go(conversation.destination)">강의실 방향 안내</button><button class="campus-primary" @click="emit('study')">공부 시작</button></div>
    </section>
    <div v-if="error" class="campus-error" role="alert"><h2>잠시 교실 밖으로</h2><p>{{ error }}</p><button @click="emit('close')">기존 CBT로 돌아가기</button></div>
    <aside v-else class="campus-guide">
      <span class="campus-eyebrow">{{ zone === '정문' ? 'WELCOME / 01' : zone === '복도' ? 'EXPLORE / 02' : 'FOCUS / 03' }}</span>
      <h1>{{ zone === '정문' ? '배움이 시작되는 곳.' : zone === '복도' ? '오늘의 강의실로.' : '자리에 앉아, 시작할까요?' }}</h1>
      <p>{{ zone === '강의실' ? subject : '복도를 따라 교실로 들어가 보세요.' }}</p>
      <button v-if="zone === '강의실'" class="campus-primary" @click="emit('study')">회차 선택하고 공부하기 ↗</button>
      <button v-else class="campus-primary" :disabled="moving" @click="go(zone === '정문' ? '복도' : '강의실')">{{ moving ? '이동 중…' : zone === '정문' ? '캠퍼스 들어가기 →' : '101 강의실 입장 →' }}</button>
    </aside>
    <footer class="campus-bottom">
      <nav aria-label="캠퍼스 목적지">
        <button v-for="(name, i) in (['정문', '복도', '강의실'] as const)" :key="name" :disabled="!!error" :aria-current="zone === name ? 'location' : undefined" @click="go(name)"><small>0{{ i + 1 }}</small>{{ name }}</button>
      </nav>
      <div class="campus-help"><span>드래그로 둘러보기 · 방향키 / WASD 이동 · E 대화</span><label><input v-model="quiet" type="checkbox" @change="wake"> 이동 애니메이션 줄이기</label></div>
      <button class="campus-shortcut" @click="emit('study')">걷지 않고 바로 공부 →</button>
      <span class="campus-status" role="status">{{ moving ? `${destination}로 이동 중` : `현재 위치: ${zone}` }}</span>
    </footer>
  </section>
</template>

<style scoped>
.campus h1{word-break:keep-all}.campus input{accent-color:#214e49}
.character-status{position:absolute;top:84px;right:24px;background:#fffdf3e8;padding:10px 16px;border-radius:12px;font-size:12px;max-width:260px}
.campus .campus-person-action{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:#173e3bed;color:white;white-space:nowrap}.campus-person-action kbd{margin-left:12px;border:1px solid #fff7;padding:2px 6px;border-radius:5px}
.campus-conversation{position:absolute;z-index:3;left:50%;bottom:120px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));box-sizing:border-box;background:#fffaf1f5;padding:24px;border:1px solid #d6c19d;border-radius:18px;box-shadow:0 12px 50px #12252b33}.campus-conversation h2{margin:6px 0}.campus-conversation p{line-height:1.7}.campus-conversation>div{display:flex;gap:8px;flex-wrap:wrap}.campus-conversation small{color:#6a745d}
@media(max-width:700px){.campus .campus-person-action{bottom:195px;max-width:95%;font-size:13px}.campus-conversation{bottom:130px;padding:18px;max-height:60vh;overflow:auto}}
.campus{position:fixed;inset:0;z-index:10000;background:#d9e4df;color:#173e3b;font-family:system-ui,sans-serif;isolation:isolate}
.campus-scene{position:absolute;inset:0;touch-action:none;outline:none}.campus-scene:focus-visible{outline:3px solid #bc6e29;outline-offset:-4px}.campus-scene :deep(canvas){display:block}
.campus button{font:inherit;cursor:pointer;min-height:44px;border:1px solid #31595740;border-radius:8px;padding:12px 18px;background:#fffaf1;color:#173e3b}.campus button:focus-visible,.campus input:focus-visible{outline:3px solid #c5762b;outline-offset:4px}.campus button:disabled{opacity:.6;cursor:wait}
.campus-top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:24px;padding:calc(22px + env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) 22px max(24px,env(safe-area-inset-left));background:linear-gradient(#f6f5edee,#f6f5ed00);pointer-events:none}.campus-top>*{pointer-events:auto}.campus-brand{display:grid;gap:4px}.campus-brand strong{font-size:15px;letter-spacing:.16em}.campus-brand span{font-size:12px}.campus-quality{margin-left:auto;background:#fffaf1e8;padding:10px;border-radius:8px;font-size:13px}
.campus-guide{position:absolute;left:clamp(24px,5vw,80px);top:25%;max-width:380px;background:#fffaf1e8;padding:26px;border-left:3px solid #b87940;border-radius:0 14px 14px 0;box-shadow:0 15px 50px #243d3b0d}.campus-eyebrow{font-size:11px;letter-spacing:.2em;color:#855827}.campus-guide h1{font-size:clamp(24px,2.5vw,36px);line-height:1.3;letter-spacing:-.05em;margin:14px 0}.campus-guide p{font-size:14px;line-height:1.6}.campus .campus-primary{background:#214e49;color:#fffaf1;border:0;margin-top:12px}
.campus-bottom{position:absolute;bottom:0;left:0;right:0;padding:20px 24px calc(18px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:22px;flex-wrap:wrap;background:#f9f7f0ed;border-top:1px solid #173e3b20}.campus-bottom nav{display:flex;gap:5px}.campus-bottom nav button{display:flex;align-items:center;gap:12px;border:none;background:transparent}.campus-bottom nav button[aria-current]{background:#214e49;color:#fffaf1}.campus-bottom small{font-size:10px;opacity:.7}.campus-help{display:grid;gap:8px;font-size:12px}.campus-help label{display:flex;align-items:center;gap:5px}.campus-shortcut{margin-left:auto}.campus-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.campus-error{position:absolute;top:30%;left:50%;transform:translateX(-50%);width:min(90%,460px);padding:24px;background:#fffaf1;border-radius:12px}
@media(max-width:700px){.campus-top{gap:10px;padding:calc(12px + env(safe-area-inset-top)) 12px 12px}.campus-brand strong{font-size:10px;letter-spacing:.08em}.campus-brand span{font-size:10px}.campus button{padding:10px 12px}.campus-guide{left:16px;top:auto;bottom:180px;padding:15px;max-width:260px}.campus-guide h1{font-size:22px;margin:8px 0}.campus-guide p{font-size:12px;margin:6px 0}.campus-guide .campus-primary{margin-top:5px}.campus-bottom{gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}.campus-bottom nav{width:100%;justify-content:center}.campus-help{font-size:11px}.campus-help>span{display:none}.campus-shortcut{font-size:12px!important}.campus-quality{font-size:11px;padding:6px}}
@media(max-height:500px){.campus-guide{top:80px;bottom:auto;padding:12px;max-width:260px}.campus-guide h1{font-size:20px;margin:4px 0}.campus-guide p{display:none}.campus-bottom{padding-top:8px;padding-bottom:8px}.campus-help>span{display:none}}
/* Keep the room visible: guidance is a compact floating card, not a side panel. */
@media(min-width:701px) and (min-height:501px){
 .campus-guide{top:auto;bottom:112px;left:28px;max-width:300px;padding:18px 22px;background:#fffaf1e0;backdrop-filter:blur(14px);border:1px solid #fff9;border-radius:18px}
 .campus-guide h1{font-size:24px;margin:8px 0}.campus-guide p{margin:6px 0}
 .campus-bottom{left:24px;right:24px;bottom:20px;border:1px solid #fff9;border-radius:20px;padding:10px 16px;background:#fffaf1e8;backdrop-filter:blur(14px);gap:16px}
}
@media(max-width:700px){
 .campus-guide{bottom:135px;left:12px;right:12px;max-width:none;padding:0;background:none;border:0;box-shadow:none}
 .campus-guide h1,.campus-guide p,.campus-guide .campus-eyebrow{display:none}
 .campus-guide .campus-primary{width:100%;margin:0;box-shadow:0 4px 16px #142d3920}
 .character-status{top:70px;right:12px}
}
</style>
