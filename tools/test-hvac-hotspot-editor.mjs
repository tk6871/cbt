import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('./hvac-hotspot-editor.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('편집기 스크립트를 찾지 못했습니다.');

const values = new Map();
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
};

const elements = new Map();
const markers = [];
const makeElement = () => ({
  style: {},
  hidden: false,
  disabled: false,
  textContent: '',
  remove() { this.removed = true; },
  click() { this.clicked = true; },
});
for (const selector of ['#progress', '#path', '#saved', '#prev', '#undo', '#reset', '#next', '#export']) {
  elements.set(selector, makeElement());
}

const image = makeElement();
image.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 });
elements.set('#image', image);

const stage = makeElement();
stage.querySelectorAll = () => markers.filter((marker) => !marker.removed);
stage.append = (marker) => markers.push(marker);
stage.addEventListener = (_name, listener) => { stage.listener = listener; };
elements.set('#stage', stage);

let downloadedBlob;
let alertMessage = '';
const document = {
  querySelector: (selector) => elements.get(selector),
  createElement: () => makeElement(),
};
const urlApi = {
  createObjectURL(blob) { downloadedBlob = blob; return 'blob:mock'; },
  revokeObjectURL() {},
};

vm.runInNewContext(script, {
  document,
  localStorage,
  Blob,
  URL: urlApi,
  alert: (message) => { alertMessage = message; },
  JSON,
  Object,
  Math,
});

const storageKey = 'cbt-hvac-manual-hotspots-v1';
const clicks = [
  { clientX: 120, clientY: 500 },
  { clientX: 120, clientY: 600 },
  { clientX: 120, clientY: 700 },
  { clientX: 120, clientY: 800 },
];
for (const [index, event] of clicks.entries()) {
  stage.listener(event);
  const stored = JSON.parse(values.get(storageKey));
  const entry = Object.values(stored)[0];
  if (entry.points.length !== index + 1) throw new Error(`${index + 1}번째 점이 저장되지 않았습니다.`);
  if (markers.filter((marker) => !marker.removed).length !== index + 1) throw new Error(`${index + 1}번째 점 표시가 유지되지 않았습니다.`);
  if (index === 0) {
    elements.get('#export').onclick();
    if (!alertMessage.includes('네 점')) throw new Error('미완료 내보내기 안내가 표시되지 않았습니다.');
  }
}

elements.get('#export').onclick();
if (!downloadedBlob) throw new Error('완료된 JSON 파일이 생성되지 않았습니다.');
const exported = JSON.parse(await downloadedBlob.text());
const hotspots = Object.values(exported)[0];
if (!Array.isArray(hotspots) || hotspots.length !== 4) throw new Error('JSON에 답안 좌표 4개가 없습니다.');

console.log('수동 편집기: 1~4번째 클릭 유지, 완료 안내, 좌표 4개 JSON 내보내기 통과');
