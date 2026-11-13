<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMUtils } from '@pixiv/three-vrm';
import { cloudSyncState, downloadCampusPrivateAsset, listCampusPrivateAssets } from './cloudSync';
import CampusPrivatePanel from './CampusPrivatePanel.vue';
import CampusNovel from './CampusNovel.vue';
import CampusFreeChat from './CampusFreeChat.vue';
import { validateCampusGlb } from './campusGlb';
import { makePreviewWalker, previewPoseLabels, type PreviewPose } from './campusPreviewWalk';
import { loadCampusCharacters, type CampusPerson, type SchoolOutfit, type TeacherStyle } from './campusCharacters';
import { advanceCampusStory, campusStoryChoices, campusStoryLine, freshStory, readCampusStory, saveCampusStory, type StoryChoice } from './campusStory';

defineProps<{ subject: string }>();
const emit = defineEmits<{ close: []; study: [] }>();
const host = ref<HTMLDivElement>();
const root = ref<HTMLElement>();
const footer = ref<HTMLElement>();
const places = ['정문', '복도', '강의실', '테라스', '운동장'] as const;
type Place = typeof places[number];
const zone = ref<Place>('정문');
const placeCopy: Record<Place, {label:string; title:string; description:string}> = {
  정문:{label:'WELCOME / 01',title:'배움이 시작되는 곳.',description:'복도 또는 오른쪽 산책로로 들어가 보세요.'},
  복도:{label:'EXPLORE / 02',title:'오늘의 강의실로.',description:'복도를 따라 101 강의실에 들어가 보세요.'},
  강의실:{label:'FOCUS / 03',title:'자리에 앉아, 시작할까요?',description:''},
  테라스:{label:'OPEN AIR / 04',title:'정원 열람 테라스',description:'바깥 공기를 쐬고, 오늘 풀 문제를 골라 보세요.'},
  운동장:{label:'WEST YARD / 05',title:'서쪽 운동장',description:'넓은 야외 공간에서 이동과 점프를 해보세요.'},
};
const error = ref('');
const moving = ref(false);
const overview = ref(false);
const mouseLook = ref(false);
let hoverPoint: { x:number; y:number } | undefined;
try { overview.value = localStorage.getItem('cbt-campus-view') === 'map'; } catch { /* optional */ }
try { mouseLook.value = localStorage.getItem('cbt-campus-mouse-look') === 'hover'; } catch { /* optional */ }
function resetHover() { hoverPoint = undefined; }
function saveMouseLook() {
  resetHover();
  try { localStorage.setItem('cbt-campus-mouse-look', mouseLook.value ? 'hover' : 'drag'); } catch { /* optional */ }
}
function toggleView() {
  resetHover();
  overview.value = !overview.value;
  try { localStorage.setItem('cbt-campus-view', overview.value ? 'map' : 'walk'); } catch { /* optional */ }
  host.value?.focus(); wake();
}
function resetHeading() {
  resetHover();
  yaw = heading(zone.value);
  pitch = 0;
  host.value?.focus(); wake();
}
function heading(place:Place) { return place === '강의실' ? -.45 : place === '테라스' ? -1 : 0; }
const quiet = ref(matchMedia('(prefers-reduced-motion: reduce)').matches);
const low = ref(matchMedia('(pointer: coarse)').matches);
const characterStatus = ref('캐릭터 불러오는 중…');
const localCampus = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  && ['http:', 'https:'].includes(location.protocol);
const manageModels = new URLSearchParams(location.search).get('campusManage') === '1';
const modelPreviewStatus = ref('');
const previewPose = ref<PreviewPose>('walk');
const previewPosable = ref(false);
const playAsShiho = ref(true);
const jumping = ref(false);
let jumpHeight = 0, jumpVelocity = 0, lastContact = 0;
function jump() {
  if (jumping.value || conversation.value || route.length || error.value || overview.value) return;
  jumpVelocity = 4; jumping.value = true; wake();
}
function toggleShihoRole() {
  if (!privateWalker) return;
  playAsShiho.value = !playAsShiho.value;
  characters?.setTerraceGuideVisible(playAsShiho.value);
  modelPreviewStatus.value = playAsShiho.value ? '플레이어 · 시노' : `시노 · 테라스 ${previewPoseLabels[previewPose.value]}`;
  wake();
}
let privateModel: T.Group | undefined;
let privateWalker: ReturnType<typeof makePreviewWalker>;
let privateRevision = 0;
let previewSource: 'local' | 'cloud' | undefined;
function clearPrivateModel() {
  privateRevision++;
  previewSource = undefined;
  if (privateModel) { scene?.remove(privateModel); VRMUtils.deepDispose(privateModel); privateModel = undefined; }
  privateWalker = undefined;
  previewPosable.value = false;
  characters?.setTerraceGuideVisible(true);
  modelPreviewStatus.value = '';
  wake();
}
async function previewPrivateModel(bytes: ArrayBuffer, source: 'local' | 'cloud') {
  clearPrivateModel(); const current = privateRevision;
  previewSource = source;
  try {
    validateCampusGlb(bytes);
    const asset = await new GLTFLoader().parseAsync(bytes, '');
    if (current !== privateRevision || !renderer) { VRMUtils.deepDispose(asset.scene); return; }
    const model = asset.scene, bounds = new T.Box3().setFromObject(model);
    const height = bounds.getSize(new T.Vector3()).y;
    if (!Number.isFinite(height) || height <= 0) { VRMUtils.deepDispose(model); throw new Error('모델 크기를 확인할 수 없어요.'); }
    model.scale.multiplyScalar(1.45 / height); model.updateMatrixWorld(true);
    const actual = new T.Box3().setFromObject(model), center = actual.getCenter(new T.Vector3());
    model.position.add(new T.Vector3(-center.x, .1 - actual.min.y, -center.z));
    privateWalker = makePreviewWalker(model);
    if (privateWalker) {
      previewPosable.value = true;
      privateModel = privateWalker.pivot;
      privateWalker.update(0, quiet.value, previewPose.value);
      characters?.setTerraceGuideVisible(playAsShiho.value);
    } else {
      VRMUtils.deepDispose(model);
      throw new Error('시노 모델의 리그를 인식하지 못했어요.');
    }
    scene.add(privateModel);
    modelPreviewStatus.value = playAsShiho.value ? '플레이어 · 시노' : `시노 · 테라스 ${previewPoseLabels[previewPose.value]}`; wake();
  } catch (e) { if (current === privateRevision) modelPreviewStatus.value = e instanceof Error ? e.message : '모델 표시 실패'; }
}
function changePreviewPose(pose: PreviewPose) {
  if (!privateWalker) return;
  previewPose.value = pose;
  modelPreviewStatus.value = `시노 · 테라스 ${previewPoseLabels[pose]}`;
  wake();
}
let loadRevision = 0;
const campusAssetAbort = new AbortController();
const localCompanionNames = ref<string[]>([]);
const localCompanions: (NonNullable<ReturnType<typeof makePreviewWalker>> & {name:string; cloud:boolean})[] = [];
const companionModels = [
  { file:'scarlett-campus.glb', name:'스칼렛', match:/^(?:스칼렛|scarlett(?: ezra)?)$/i, id:'21a631e2-341e-4fbf-9da4-bf345a1dcda7', x:6, z:-2.69, yaw:Math.PI },
  { file:'ivy-campus.glb', name:'아이비', match:/^(?:아이비|ivy)$/i, id:'549191eb-0539-4022-b5df-3dbfc0f5e5ed', x:9.3, z:-2.69, yaw:Math.PI },
  { file:'lucy-campus.glb', name:'루시', match:/^(?:루시|lucy)$/i, id:'f81d2a9e-9dbc-4195-aceb-c7ce6b4dd16c', x:6, z:-6.49, yaw:Math.PI },
] as const;
async function loadCompanions(assets?: Awaited<ReturnType<typeof listCampusPrivateAssets>>, revision = loadRevision) {
  if (!localCampus && !assets) return;
  await Promise.all(companionModels.map(async (entry) => {
    const signal = campusAssetAbort.signal;
    let model: T.Group | undefined;
    try {
      const asset = assets?.find(row => entry.match.test(row.title.trim()) || row.source.includes('/'+entry.id));
      let bytes: ArrayBuffer;
      if (asset) bytes = await downloadCampusPrivateAsset(asset.path);
      else {
        if (!localCampus) return;
        const url = new URL(`work/private-notes/campus-assets/${entry.file}`, document.baseURI);
        const response = await fetch(url, {signal});
        if (!response.ok) return;
        bytes = await response.arrayBuffer();
      }
      if (signal.aborted || (asset && revision !== loadRevision)) return;
      validateCampusGlb(bytes);
      model = (await new GLTFLoader().parseAsync(bytes, '')).scene;
      if (signal.aborted || (asset && revision !== loadRevision)) return;
      const bounds = new T.Box3().setFromObject(model);
      const height = bounds.getSize(new T.Vector3()).y;
      if (!Number.isFinite(height) || height <= 0) throw new Error('Invalid companion height');
      model.scale.multiplyScalar(1.57 / height);
      model.updateMatrixWorld(true);
      const scaled = new T.Box3().setFromObject(model), center = scaled.getCenter(new T.Vector3());
      model.position.add(new T.Vector3(-center.x,.1-scaled.min.y,-center.z));
      model.updateMatrixWorld(true);
      const actor = makePreviewWalker(model, entry);
      if (!actor) throw new Error('Companion rig not recognized');
      actor.update(0,true,'seat');
      scene.add(actor.pivot);
      localCompanions.push({...actor,name:entry.name,cloud:Boolean(asset)});
      localCompanionNames.value.push(entry.name);
      model = undefined;
      wake();
    } catch (error) {
      if (!campusAssetAbort.signal.aborted) console.warn('Campus companion unavailable:', entry.name, error);
    }
    finally { if (model) VRMUtils.deepDispose(model); }
  }));
}
async function loadCampusShiho() {
  const current = ++loadRevision;
  if (previewSource === 'cloud') clearPrivateModel();
  for(let i=localCompanions.length-1;i>=0;i--){
    const actor=localCompanions[i];
    if(!actor.cloud) continue;
    scene.remove(actor.pivot); VRMUtils.deepDispose(actor.pivot); localCompanions.splice(i,1);
  }
  localCompanionNames.value=localCompanions.map(actor=>actor.name);
  if (!renderer || previewSource === 'local') return;
  if (localCampus) {
    try {
      const response = await fetch(new URL('work/private-notes/campus-assets/shiho-campus.glb', document.baseURI), {
        signal: campusAssetAbort.signal,
      });
      if (response.ok) {
        const bytes = await response.arrayBuffer();
        if (current !== loadRevision) return;
        await previewPrivateModel(bytes, 'local');
        if (current === loadRevision && privateWalker) return;
        if (current === loadRevision) clearPrivateModel();
      }
    } catch { /* ordinary campus remains available */ }
  }
  if (current !== loadRevision || !cloudSyncState.email) return;
  try {
    const assets = await listCampusPrivateAssets();
    if (current !== loadRevision) return;
    if (!localCampus && assets) void loadCompanions(assets,current);
    const asset = assets?.find(row => /^(?:female character[\s-]*)?(?:시노|shiho)$/i.test(row.title.trim())
      || row.source.includes('/6ba204c7-3ce8-4373-9b35-cf10f8e96eac'));
    if (!asset || current !== loadRevision) return;
    const bytes = await downloadCampusPrivateAsset(asset.path);
    if (current === loadRevision) await previewPrivateModel(bytes, 'cloud');
  } catch { /* preserve the default character if the account has no accessible model */ }
}
watch(() => cloudSyncState.email, () => { if (!localCampus && renderer) void loadCampusShiho(); });
let characters: ReturnType<typeof loadCampusCharacters> | undefined;
let characterGroup: T.Group;
const nearby = ref<CampusPerson>();
const conversation = ref<CampusPerson>();
const schoolOutfit = ref<SchoolOutfit>('uniform');
const outfitBusy = ref(false);
const outfitError = ref('');
async function changeSchoolOutfit(outfit: SchoolOutfit) {
  if (!characters || outfitBusy.value || outfit === schoolOutfit.value) return;
  outfitBusy.value = true; outfitError.value = '';
  try {
    await characters.setSchoolOutfit(outfit);
    schoolOutfit.value = outfit;
    try { localStorage.setItem('cbt-campus-school-outfit', outfit); } catch { /* optional */ }
  } catch { outfitError.value = '의상을 불러오지 못했어요. 현재 옷을 유지합니다.'; }
  finally { outfitBusy.value = false; }
}
const teacherStyle = ref<TeacherStyle>('lecture');
try { if(localStorage.getItem('cbt-campus-teacher-style')==='garden')teacherStyle.value='garden'; } catch { /* optional local setting */ }
function changeTeacherStyle(style:TeacherStyle) {
  teacherStyle.value=style;
  characters?.setTeacherStyle(style);
  try { localStorage.setItem('cbt-campus-teacher-style',style); } catch { /* preview still works */ }
}
const story = ref(readCampusStory());
const storySaved = ref(true);
const relationship = computed(() => conversation.value ? story.value[conversation.value.id] || freshStory() : freshStory());
function chooseStory(choice: StoryChoice) {
  if (!conversation.value) return;
  const id = conversation.value.id;
  story.value = { ...story.value, [id]: advanceCampusStory(relationship.value, choice) };
  storySaved.value = saveCampusStory(story.value);
  characters?.greet(id,performance.now()/1000); wake();
}
let renderedAt = 0;
let renderer: T.WebGLRenderer | undefined;
let scene: T.Scene;
let camera: T.PerspectiveCamera;
const mapCamera = new T.OrthographicCamera(-10, 10, 10, -10, .1, 80);
let mapMarker: T.Mesh;
let door: T.Group;
let frame = 0;
let observer: ResizeObserver | undefined;
let yaw = 0;
let pitch = 0;
let last = 0;
let drag: { id: number; x: number; y: number; startX:number; startY:number; moved: boolean } | undefined;
let route: T.Vector3[] = [];
let destination: Place = '정문';
const keys = new Set<string>();
const touchKeys = new Map<number, string>();
const directions = [['w','↑','앞으로'],['a','←','왼쪽으로'],['s','↓','뒤로'],['d','→','오른쪽으로']] as const;
function touchMove(event: PointerEvent, direction: string) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  route = []; moving.value = false;
  touchKeys.set(event.pointerId, direction); wake();
}
function stopTouch(event: PointerEvent) { touchKeys.delete(event.pointerId); }
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
  camera.layers.enable(1);
  mapCamera.layers.enable(2); mapCamera.up.set(0, 0, -1);
  const markerGeometry = new T.ConeGeometry(.38, .8, 3);
  const markerMaterial = new T.MeshBasicMaterial({ color: '#ffd66b', depthTest: false });
  disposables.add(markerGeometry); disposables.add(markerMaterial);
  mapMarker = new T.Mesh(markerGeometry, markerMaterial);
  mapMarker.layers.set(2); mapMarker.renderOrder = 10;
  scene.add(mapMarker);
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
  box(7,.18,4,0,3.55,13.5,wood).layers.set(1);
  for(const x of [-3.2,3.2])box(.14,3.5,.14,x,1.75,15,brass);
  for(let x=-3;x<=3;x+=.4)box(.04,.08,3.8,x,3.43,13.5,paper).layers.set(1);
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
  box(6, .12, 28, 0, 4.1, -2, paper).layers.set(1);
  box(12.5, .12, 12, 9.25, 4.1, -5, paper).layers.set(1);
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
  // The east path connects the courtyard to a second walkable study area.
  const terraceStone=material('#ded0b3'), terraceEdge=material('#637a70'), gravel=material('#afba9a');
  box(9,.09,3.3,10.5,.012,20,terraceStone);
  box(13,.11,11,20,.01,20,terraceStone);
  for (let x=14; x<=26; x+=1.5) box(.015,.01,10.8,x,.071,20,line);
  for (let z=15; z<=25; z+=1.5) box(12.8,.01,.015,20,.071,z,line);
  box(6.8,.18,3.5,22.7,3.25,16.4,wood).layers.set(1);
  for (const x of [19.5,25.9]) for (const z of [14.9,17.9]) box(.15,3.2,.15,x,1.6,z,wood);
  for (const z of [15.1,15.7,16.3,16.9,17.5]) box(6.75,.12,.12,22.7,3.14,z,paper).layers.set(1);
  box(4.4,.15,1.2,22.7,.86,16.4,wood);
  for (const x of [20.8,24.6]) box(.14,.86,1,x,.43,16.4,dark);
  for (const x of [21.3,23,24.2]) {
    box(.65,.12,.52,x,.47,17.55,teal);
    box(.65,.47,.07,x,.73,17.8,teal);
    for (const dx of [-.25,.25]) box(.075,.47,.44,x+dx,.235,17.55,dark);
    box(.28,.036,.35,x,.95,16.75,paper);
  }
  for (const x of [15.1,24.8]) {
    box(2.1,.42,1.1,x,.21,24.4,terraceEdge);
    box(1.92,.03,.92,x,.43,24.4,gravel);
    for (const dx of [-.68,0,.68]) {
      const geo=new T.SphereGeometry(.42,12,8); disposables.add(geo);
      const bush=new T.Mesh(geo,grass); bush.position.set(x+dx,.69,24.4); scene.add(bush);
    }
  }
  box(1.7,.14,.58,19,.53,24.3,wood);
  for(const x of [18.36,19.64]) box(.13,.48,.49,x,.24,24.3,terraceEdge);
  for(const z of [15,20,25]) box(.14,1.05,.14,26.25,.53,z,terraceEdge);
  for(const y of [.36,.83]) box(.075,.08,10.2,26.25,y,20,wood);
  const gardenCrown=new T.SphereGeometry(1.35,16,12); disposables.add(gardenCrown);
  const gardenGreen=material('#779b78');
  for(const [x,z] of [[27.7,15.4],[29.1,20.1],[27.8,25.4]]) {
    box(.22,2.15,.22,x,1.08,z,wood);
    const tree=new T.Mesh(gardenCrown,gardenGreen); tree.scale.set(1,1.28,1);
    tree.position.set(x,2.8,z); scene.add(tree);
  }
  label('READING TERRACE',22.7,2.63,17.94,3.5);
  const court=material('#426b70');
  box(8,.08,3.2,-11.2,.005,21,terraceStone);
  box(15,.1,13,-21.5,.005,21,court);
  for(const x of [-28.5,-21.5,-14.5]) box(.05,.01,12,x,.064,21,paper);
  for(const z of [15,27]) box(14,.01,.05,-21.5,.064,z,paper);
  const circle=new T.RingGeometry(1.65,1.7,40); disposables.add(circle);
  const midcourt=new T.Mesh(circle,paper); midcourt.rotation.x=-Math.PI/2; midcourt.position.set(-21.5,.075,21); scene.add(midcourt);
  for(const x of [-28,-15]){
    box(.13,2.95,.13,x,1.48,20.9,dark);
    box(.12,.7,1.25,x,2.7,20.9,paper);
  }
  label('WEST YARD',-21.5,1.95,15,3.6);
}
function go(target: typeof destination) {
  if (!camera || error.value) return;
  conversation.value = undefined;
  jumping.value = false; jumpHeight = 0; jumpVelocity = 0; camera.position.y = 1.65;
  keys.clear(); touchKeys.clear(); destination = target;
  const start: T.Vector3[] = zone.value === '강의실' ? [v(4.8, -5), v(0, -5)] :
    camera.position.x <= -11.5 && camera.position.z > 14 ? [v(-14,21),v(0,21)] :
    camera.position.x >= 11.5 && camera.position.z > 14 ? [v(14,20),v(0,20)] : [v(0, Math.min(24, camera.position.z))];
  const paths: Record<Place,T.Vector3[]> = {
    정문:[v(0,24)], 복도:[v(0,5)], 강의실:[v(0,-5),v(4.8,-5),v(4.8,-.3)],
    테라스:[v(0,20),v(15,20),v(18,21)],
    운동장:[v(0,21),v(-15,21),v(-20,21)],
  };
  route = target === '테라스' && zone.value === '테라스' ? [v(18,21)] : [...start, ...paths[target]];
  moving.value = true;
  if (quiet.value) { camera.position.copy(route[route.length - 1]); route = []; moving.value = false; yaw = heading(target); pitch = 0; }
  wake();
}
function walkable(x: number, z: number) {
  return (z >= 12.5 && z < 32 && Math.abs(x) < 12) || (Math.abs(x) < 1.7 && z >= 11.5 && z < 14)
    || (x <= -11.5 && x > -14.5 && z > 19.4 && z < 22.6)
    || (x <= -14 && x > -29 && z > 14.5 && z < 27.5)
    || (x >= 11.5 && x < 14 && z > 18.4 && z < 21.6)
    || (x >= 13.8 && x < 26.4 && z > 14.8 && z < 25.2)
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
  camera.position.y = 1.65;
  if (route.length) {
    const delta = route[0].clone().sub(camera.position);
    if (delta.length() < .06) { camera.position.copy(route.shift()!); }
    else {
      camera.position.add(delta.normalize().multiplyScalar(Math.min(dt * 4, camera.position.distanceTo(route[0]))));
      const desired = Math.atan2(-delta.x, -delta.z);
      yaw += Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw)) * Math.min(1, dt * 5);
      pitch *= 1 - Math.min(1, dt * 5);
    }
    if (!route.length) { moving.value = false; yaw = heading(destination); }
  } else if (keys.size || touchKeys.size) {
    const held = new Set([...keys, ...touchKeys.values()]);
    const forward = Number(held.has('w') || held.has('arrowup')) - Number(held.has('s') || held.has('arrowdown'));
    const side = Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft'));
    const delta = new T.Vector3(side, 0, -forward).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), overview.value ? 0 : yaw).multiplyScalar(dt * 3);
    const p = camera.position;
    const nx=p.x+delta.x,nz=p.z+delta.z;
    const companion=localCompanions.find(a=>Math.hypot(nx-a.pivot.position.x,nz-a.pivot.position.z)<.56);
    const person=characters?.contact(nx,nz);
    if ((person||companion) && now-lastContact>420) {
      lastContact=now;
      if(person) characters?.react(person,now/1000);
      companion?.react();
    }
    if (!(playAsShiho.value && privateWalker && (companion || person) &&
      Math.hypot(delta.x,delta.z)>0 && !jumping.value)) {
      if (walkable(nx, p.z)) p.x = nx;
      if (walkable(p.x, nz)) p.z = nz;
    }
  }
  if (jumping.value) {
    jumpVelocity -= 12*dt; jumpHeight += jumpVelocity*dt;
    if(jumpHeight<=0){jumpHeight=0; jumping.value=false;}
    camera.position.y += jumpHeight;
  }
  zone.value = camera.position.z > 12 ? (camera.position.x >= 13.8 ? '테라스' : camera.position.x <= -14 ? '운동장' : '정문') : camera.position.x > 3.4 ? '강의실' : '복도';
  const doorTarget = camera.position.distanceTo(v(3, -5)) < 5 || route.length > 0 || zone.value === '강의실' ? -Math.PI / 2 : 0;
  door.rotation.y += (doorTarget - door.rotation.y) * Math.min(1, dt * 5);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const animate = characters?.update(now / 1000, camera.position, low.value, quiet.value, conversation.value?.id);
  let animatePreview = false;
  if(privateWalker){
    privateWalker.pivot.visible=!playAsShiho.value||overview.value;
    if(playAsShiho.value){
      if(overview.value) {
        animatePreview=privateWalker.update(dt,quiet.value,keys.size||touchKeys.size?'walk':'idle');
        privateWalker.pivot.position.set(camera.position.x,jumpHeight,camera.position.z);
        privateWalker.pivot.rotation.y=yaw+Math.PI;
      }
    } else animatePreview=privateWalker.update(dt,quiet.value||camera.position.distanceTo(privateWalker.pivot.position)>22,previewPose.value);
  }
  let animateCompanions = false;
  for (const companion of localCompanions) {
    animateCompanions = companion.update(dt, quiet.value || camera.position.distanceTo(companion.pivot.position)>16, 'seat') || animateCompanions;
  }
  nearby.value = characters?.nearest(camera.position);
  if (overview.value) {
    mapCamera.position.set(camera.position.x, 25, camera.position.z);
    mapCamera.lookAt(camera.position.x, 0, camera.position.z);
    mapMarker.position.set(camera.position.x, .2, camera.position.z);
    mapMarker.rotation.set(-Math.PI / 2, 0, yaw, 'YXZ');
  }
  renderer.render(scene, overview.value ? mapCamera : camera);
  if (animate || animatePreview || animateCompanions || jumping.value || route.length || keys.size || touchKeys.size || Math.abs(doorTarget - door.rotation.y) > .001) wake();
}
function wake() { if (!frame && renderer && !document.hidden) frame = requestAnimationFrame(tick); }
function resize() {
  if (!renderer || !host.value) return;
  if (root.value && footer.value) {
    const clearance = root.value.getBoundingClientRect().bottom - footer.value.getBoundingClientRect().top + 12;
    root.value.style.setProperty('--campus-footer-clearance', `${clearance}px`);
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, low.value ? 1.5 : 2));
  renderer.shadowMap.enabled = !low.value;
  renderer.setSize(host.value.clientWidth, host.value.clientHeight);
  camera.aspect = host.value.clientWidth / Math.max(1, host.value.clientHeight); camera.updateProjectionMatrix();
  mapCamera.left = -10 * camera.aspect; mapCamera.right = 10 * camera.aspect; mapCamera.updateProjectionMatrix(); wake();
}
function down(e: PointerEvent) {
  if (e.button !== 0 || !e.isPrimary || conversation.value || error.value) return;
  resetHover();
  route = []; moving.value = false;
  drag = { id:e.pointerId, x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY, moved:false };
  host.value?.setPointerCapture(e.pointerId); host.value?.focus({preventScroll:true});
}
function turnView(dx:number,dy:number,speed:number) {
  yaw -= dx*speed;
  pitch = T.MathUtils.clamp(pitch - dy*speed, -.8, .8);
  wake();
}
function move(e: PointerEvent) {
  if (!drag) {
    if (e.pointerType !== 'mouse' || e.buttons || !mouseLook.value || overview.value || conversation.value || moving.value || error.value) {
      resetHover(); return;
    }
    if (hoverPoint) {
      turnView(e.clientX-hoverPoint.x,e.clientY-hoverPoint.y,.0018);
    }
    hoverPoint = { x:e.clientX, y:e.clientY };
    return;
  }
  if (drag.id !== e.pointerId) return;
  if (!drag.moved) {
    const dx=e.clientX-drag.startX, dy=e.clientY-drag.startY;
    const distance=Math.hypot(dx,dy), threshold=e.pointerType === 'touch' ? 10 : 6;
    if(distance<=threshold) return;
    drag.x=drag.startX+dx*threshold/distance;
    drag.y=drag.startY+dy*threshold/distance;
    drag.moved=true;
  }
  if (!overview.value) turnView(e.clientX-drag.x,e.clientY-drag.y,e.pointerType === 'touch' ? .0035 : .0028);
  drag.x = e.clientX; drag.y = e.clientY;
}
function release(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  const tap=!drag.moved && Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<=(e.pointerType === 'touch' ? 10 : 6);
  drag=undefined;
  if (e.type === 'pointerup' && tap && !quiet.value && characterGroup && host.value) {
    const rect=host.value.getBoundingClientRect(), ray=new T.Raycaster();
    ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),overview.value ? mapCamera : camera);
    const privateActors=[...localCompanions,...(privateWalker && !playAsShiho.value ? [privateWalker] : [])];
    const visible = (object:T.Object3D) => {
      for(let node:T.Object3D|null=object;node;node=node.parent) if(!node.visible) return false;
      return true;
    };
    // The first visible surface wins, so clicks don't reach characters through walls or desks.
    const hit=ray.intersectObjects(scene.children,true).find(item=>visible(item.object)&&item.object!==mapMarker);
    if(!hit || Math.hypot(camera.position.x-hit.point.x,camera.position.z-hit.point.z)>5) return;
    const person=hit.object.userData.personId;
    if(person) characters?.react(person,performance.now()/1000,hit.point);
    else privateActors.find(actor=>actor.pivot.getObjectById(hit.object.id))?.react(hit.point);
    wake();
  }
}
function interact() {
  if (!nearby.value) return;
  keys.clear(); touchKeys.clear(); route=[]; moving.value=false; conversation.value=nearby.value;
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
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); jump(); }
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
    e.preventDefault(); route = []; moving.value = false; keys.add(k); wake();
  }
  if (k === 'e' && nearby.value) { e.preventDefault(); interact(); }
  if (k === 'v' && !e.repeat) { e.preventDefault(); toggleView(); }
}
function keyup(e: KeyboardEvent) { keys.delete(e.key.toLowerCase()); }
function pause() { keys.clear(); touchKeys.clear(); drag = undefined; resetHover(); if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { last = performance.now(); wake(); } }
function contextLost(e: Event) { e.preventDefault(); error.value = '3D 화면 연결이 중단됐어요. 기존 CBT로 돌아갔다가 다시 열어주세요.'; cancelAnimationFrame(frame); frame = 0; }
onMounted(async () => {
  document.body.style.overflow = 'hidden'; await nextTick(); root.value?.querySelector('button')?.focus();
  window.addEventListener('keyup', keyup); window.addEventListener('blur', pause); document.addEventListener('visibilitychange', pause);
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.shadowMap.type = T.PCFSoftShadowMap;
    build(); host.value!.appendChild(renderer.domElement);
    characterGroup = new T.Group(); scene.add(characterGroup);
    characters = loadCampusCharacters(characterGroup, () => {
      characterStatus.value = ''; wake();
      try { if (localStorage.getItem('cbt-campus-school-outfit') === 'festival') void changeSchoolOutfit('festival'); } catch { /* optional */ }
    }, () => { characterStatus.value = '일부 캐릭터를 불러오지 못했어요. 이동과 공부는 이용할 수 있습니다.'; }, wake, teacherStyle.value);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    observer = new ResizeObserver(resize); observer.observe(host.value!);
    if (footer.value) observer.observe(footer.value);
    last = performance.now(); resize();
    void loadCampusShiho();
    if (localCampus) void loadCompanions();
  } catch { error.value = '이 기기에서는 3D 화면을 열 수 없어요. 기존 CBT는 그대로 이용할 수 있습니다.'; }
});
onBeforeUnmount(() => {
  loadRevision++;
  campusAssetAbort.abort();
  for (const {pivot} of localCompanions) { scene.remove(pivot); VRMUtils.deepDispose(pivot); }
  clearPrivateModel();
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
    <div ref="host" class="campus-scene" tabindex="0" aria-label="3D 공간. 마우스 움직임 또는 드래그로 둘러보기, 방향키 또는 WASD로 이동." @pointerdown="down" @pointermove="move" @pointerleave="resetHover" @pointerup="release" @pointercancel="release" @lostpointercapture="release" />
    <header class="campus-top">
      <button type="button" class="campus-back" @click="emit('close')">← 기존 CBT</button>
      <div class="campus-brand"><strong>LEARNING CAMPUS</strong><span>3D 캠퍼스 · 체험판</span></div>
      <label class="campus-quality"><input v-model="low" type="checkbox" @change="resize"> 절전</label>
    </header>
    <div v-if="!error && !conversation" class="campus-view-controls" role="group" aria-label="카메라 설정">
      <button type="button" :aria-pressed="overview" @click="toggleView">{{ overview ? '위에서 보기' : '1인칭 보기' }} <kbd>V</kbd></button>
      <button v-if="!overview" type="button" @click="resetHeading">시선 정면</button>
      <button v-if="!overview" type="button" :aria-pressed="jumping" @click="jump">점프 <kbd>Space</kbd></button>
      <label v-if="!overview" class="campus-mouse-look"><input v-model="mouseLook" type="checkbox" @change="saveMouseLook"> 드래그 없이 시점 이동</label>
    </div>
    <div v-if="!error && !conversation" class="campus-touch-move" role="group" aria-label="화면 방향키">
      <button v-for="[keyName, arrow, label] in directions" :key="keyName" type="button" :data-direction="keyName" :aria-label="label"
        @pointerdown.prevent="touchMove($event, keyName)" @pointerup="stopTouch" @pointercancel="stopTouch" @lostpointercapture="stopTouch">{{ arrow }}</button>
    </div>
    <p v-if="characterStatus" class="character-status" role="status">{{ characterStatus }}</p>
    <div v-if="!error" class="campus-asset-tools">
      <div v-if="previewPosable" class="campus-preview-poses" role="group" aria-label="시노 자세">
        <button type="button" :aria-pressed="playAsShiho" @click="toggleShihoRole">시노로 플레이</button>
        <template v-if="!playAsShiho">
          <button v-for="(label, pose) in previewPoseLabels" :key="pose" type="button" :aria-pressed="previewPose === pose" @click="changePreviewPose(pose)">{{ label }}</button>
        </template>
      </div>
      <p v-if="modelPreviewStatus" class="campus-model-preview-status" role="status">{{ modelPreviewStatus }}</p>
      <CampusPrivatePanel v-if="manageModels" @registered="loadCampusShiho" />
    </div>
    <button v-if="nearby && !conversation && !error" class="campus-person-action" @click="interact">{{ nearby.name }} · 대화하기 <kbd>E</kbd></button>
    <section v-if="conversation && !error" class="campus-conversation" aria-label="캠퍼스 인물 대화">
      <small>{{ conversation.role }}{{ conversation.guidanceOnly ? '' : ' · 성인 캠퍼스 이야기' }}</small><h2>{{ conversation.name }} <span v-if="!conversation.guidanceOnly && conversation.id !== 'guest-lecturer' && conversation.id !== 'teacher'" class="campus-affinity" :aria-label="`친밀도 ${relationship.affinity} / 3`">{{ '♥'.repeat(relationship.affinity) }}{{ '♡'.repeat(3-relationship.affinity) }}</span></h2>
      <p v-if="conversation.guidanceOnly">{{ conversation.message }}</p>
      <CampusNovel v-else-if="conversation.id === 'guest-lecturer' || conversation.id === 'teacher'" :key="conversation.id" :person="conversation.id" />
      <template v-else>
      <p>{{ campusStoryLine(conversation.id, relationship) }}</p>
      <div class="campus-story-choices"><button v-for="choice in campusStoryChoices(relationship)" :key="choice.id" @click="chooseStory(choice.id)">{{ choice.text }}</button></div>
      <p class="campus-story-note">가상 이야기 · 이 기기에만 저장 · 학습 점수와 별개</p>
      <p v-if="!storySaved" role="status">저장 공간이 부족해 이번 진행은 창을 닫으면 사라질 수 있어요.</p>
      </template>
      <div v-if="conversation.id === 'school-guide'" class="campus-outfits" role="group" aria-label="시부 의상">
        <button type="button" :disabled="outfitBusy" :aria-pressed="schoolOutfit === 'uniform'" @click="changeSchoolOutfit('uniform')">교복</button>
        <button type="button" :disabled="outfitBusy" :aria-pressed="schoolOutfit === 'festival'" @click="changeSchoolOutfit('festival')">축제 의상</button>
        <span v-if="outfitBusy || outfitError" role="status">{{ outfitBusy ? '의상을 불러오는 중…' : outfitError }}</span>
      </div>
      <details v-if="conversation.id === 'teacher'">
        <summary>윤 강사 스타일 · 색상과 소품</summary>
        <button type="button" :aria-pressed="teacherStyle === 'lecture'" @click="changeTeacherStyle('lecture')">강의 스타일</button>
        <button type="button" :aria-pressed="teacherStyle === 'garden'" @click="changeTeacherStyle('garden')">산책 스타일</button>
      </details>
      <CampusFreeChat v-if="!conversation.guidanceOnly" :key="conversation.id" :person="conversation.name" />
      <details v-if="!conversation.guidanceOnly"><summary>강의실 안내</summary><p>{{ conversation.message }}</p></details>
      <div><button @click="dismissConversation">대화 닫기</button><button @click="go(conversation.destination)">강의실 방향 안내</button><button class="campus-primary" @click="emit('study')">공부 시작</button></div>
    </section>
    <div v-if="error" class="campus-error" role="alert"><h2>잠시 교실 밖으로</h2><p>{{ error }}</p><button @click="emit('close')">기존 CBT로 돌아가기</button></div>
    <aside v-else class="campus-guide">
      <span class="campus-eyebrow">{{ placeCopy[zone].label }}</span>
      <h1>{{ placeCopy[zone].title }}</h1>
      <p>{{ zone === '강의실' ? subject : placeCopy[zone].description }}</p>
      <p v-if="zone === '강의실' && localCompanionNames.length" aria-label="강의실에 앉은 캐릭터">{{ localCompanionNames.join(' · ') }}</p>
      <button v-if="zone === '강의실' || zone === '테라스' || zone === '운동장'" class="campus-primary" @click="emit('study')">회차 선택하고 공부하기 ↗</button>
      <button v-else class="campus-primary" :disabled="moving" @click="go(zone === '정문' ? '복도' : '강의실')">{{ moving ? '이동 중…' : zone === '정문' ? '캠퍼스 들어가기 →' : '101 강의실 입장 →' }}</button>
    </aside>
    <footer ref="footer" class="campus-bottom">
      <nav aria-label="캠퍼스 목적지">
        <button v-for="(name, i) in places" :key="name" :disabled="!!error" :aria-current="zone === name ? 'location' : undefined" @click="go(name)"><small>0{{ i + 1 }}</small>{{ name }}</button>
      </nav>
      <div class="campus-help"><span>{{ mouseLook ? '포인터로 둘러보기' : '드래그로 둘러보기' }} · 방향키 / WASD 이동 · E 대화</span><label><input v-model="quiet" type="checkbox" @change="wake"> 이동 애니메이션 줄이기</label></div>
      <button class="campus-shortcut" @click="emit('study')">걷지 않고 바로 공부 →</button>
      <span class="campus-status" role="status">{{ moving ? `${destination}로 이동 중` : `현재 위치: ${zone}` }}</span>
      <a href="assets/campus/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer" style="color:inherit;font-size:12px">캐릭터 제작자·라이선스</a>
    </footer>
  </section>
</template>

<style scoped>
.campus-view-controls{position:absolute;top:calc(82px + env(safe-area-inset-top));left:24px;display:flex;gap:6px}
.campus-view-controls kbd{margin-left:4px;font-size:11px}
.campus-mouse-look{display:flex;align-items:center;gap:4px;background:#fffaf1e8;padding:0 10px;border-radius:8px;font-size:12px}
.campus-touch-move{display:none}
.campus .campus-outfits button[aria-pressed="true"]{background:#214e49;color:#fff}
@media(pointer:coarse){
  .campus-mouse-look{display:none}
  .campus-touch-move{position:absolute;right:12px;bottom:calc(185px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,44px);gap:4px;touch-action:none;user-select:none}
  .campus .campus-touch-move button{min-width:44px;min-height:44px;padding:0;font-size:20px;touch-action:none}
  .campus-touch-move [data-direction="w"]{grid-column:2;grid-row:1}
  .campus-touch-move [data-direction="a"]{grid-column:1;grid-row:2}
  .campus-touch-move [data-direction="s"]{grid-column:2;grid-row:2}
  .campus-touch-move [data-direction="d"]{grid-column:3;grid-row:2}
  .campus-view-controls{top:calc(66px + env(safe-area-inset-top));left:12px}
}
@media(max-width:420px){
  .campus .campus-bottom nav button{gap:5px;padding-inline:7px}
  .campus .campus-bottom nav small{display:none}
}
.campus-asset-tools{position:absolute;right:12px;top:calc(124px + env(safe-area-inset-top));z-index:3;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:calc(100% - 24px);max-height:calc(100dvh - 280px);overflow:auto;pointer-events:none}
.campus-asset-tools>*{pointer-events:auto;flex-shrink:0}
.campus-asset-tools :deep(.private-models){position:static;max-width:100%}
.campus-model-preview-status{margin:0;background:#fffdf2;color:#233735;padding:8px 12px;border-radius:8px}
.campus-preview-poses{display:flex;gap:4px;flex-wrap:wrap;max-width:100%}
.campus .campus-preview-poses button{padding:7px 10px}
.campus .campus-preview-poses button[aria-pressed="true"]{background:#214e49;color:#fff}
.campus h1{word-break:keep-all}.campus input{accent-color:#214e49}
.character-status{position:absolute;top:84px;right:24px;background:#fffdf3e8;padding:10px 16px;border-radius:12px;font-size:12px;max-width:260px}
.campus .campus-person-action{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);background:#173e3bed;color:white;white-space:nowrap}.campus-person-action kbd{margin-left:12px;border:1px solid #fff7;padding:2px 6px;border-radius:5px}
.campus-conversation{position:absolute;z-index:3;left:50%;bottom:120px;transform:translateX(-50%);width:min(560px,calc(100% - 32px));box-sizing:border-box;background:#fffaf1f5;padding:24px;border:1px solid #d6c19d;border-radius:18px;box-shadow:0 12px 50px #12252b33}.campus-conversation h2{margin:6px 0}.campus-conversation p{line-height:1.7}.campus-conversation>div{display:flex;gap:8px;flex-wrap:wrap}.campus-conversation small{color:#6a745d}
.campus-affinity{font-size:16px;color:#a75568;float:right}.campus-story-choices{margin:12px 0}.campus .campus-story-choices button{width:100%;text-align:left;background:#e9eee5}.campus-story-note{font-size:11px;color:#657066}.campus-conversation details{margin:12px 0}.campus-conversation{max-height:calc(100dvh - 220px);overflow:auto}
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
.campus .campus-person-action,.campus-conversation{bottom:max(120px,var(--campus-footer-clearance,0px))}
.campus-conversation{max-height:min(60dvh,calc(100dvh - var(--campus-footer-clearance,120px) - 65px))}
@media(max-width:700px){
  .campus .campus-person-action{bottom:max(195px,calc(var(--campus-footer-clearance,0px) + 46px))}
  .campus-conversation{bottom:max(130px,var(--campus-footer-clearance,0px))}
}
@media(pointer:coarse){
  .campus-touch-move{bottom:max(calc(185px + env(safe-area-inset-bottom)),var(--campus-footer-clearance,0px))}
}
</style>
