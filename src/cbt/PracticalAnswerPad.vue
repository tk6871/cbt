<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { getStroke } from 'perfect-freehand';

type PadPoint = { x: number; y: number; pressure?: number };
type PadStroke = { tool: 'pen' | 'eraser'; points: PadPoint[]; pressureSensitive?: boolean };

const props = defineProps<{
  promptId: string;
  disabled?: boolean;
  answerImages?: string[];
  overlayAllowed?: boolean;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const tool = ref<'pen' | 'eraser'>('pen');
const strokes = shallowRef<PadStroke[]>([]);
const drawing = ref(false);
const penOnly = ref(localStorage.getItem('cbt-practical-pen-only') !== '0');
const emit = defineEmits<{ expanded: [value: boolean] }>();
const expanded = ref(false);
const padRoot = ref<HTMLElement | null>(null);
// y stays in original 4:3 paper coordinates. Extending paper never stretches old ink.
const paperLength = ref(1.75);
const zoom = ref(100);
const saveError = ref(false);
const scrollArea = ref<HTMLElement | null>(null);
const leftHanded = ref(localStorage.getItem('unified-cbt-practical-left-handed') === '1');
const overlayEnabled = ref(false);
const overlayOpacity = ref(24);
const replaying = ref(false);
const replayCount = ref<number | null>(null);
const photoAnswer = ref('');
const storagePrefix = 'unified-cbt-hvac-practical-pad-v1:';
let activeStroke: PadStroke | null = null;
let resizeObserver: ResizeObserver | null = null;
let penActiveUntil = 0;
let replayFrame = 0;
let overlayImage: HTMLImageElement | null = null;
let drawFrame = 0;
let activePointer: number | null = null;
let viewSaveTimer = 0;
let pan: { id: number; x: number; y: number } | null = null;
let previousFocus: HTMLElement | null = null;
let previousOverflow = '';
let inkCanvas: HTMLCanvasElement | null = null;
let frameCanvas: HTMLCanvasElement | null = null;
let cachedStrokes: PadStroke[] | null = null;
let cachedReplay: number | null | undefined;
let cachedPaperLength = 0;

function queuePersistView(): void {
  clearTimeout(viewSaveTimer);
  viewSaveTimer = window.setTimeout(persistView, 180);
}

function scheduleRender(): void {
  if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; render(); });
}

function persistView(): void {
  const area = scrollArea.value;
  try {
    if (area) localStorage.setItem(`${storageKey()}:view`, JSON.stringify({ zoom: zoom.value, paperLength: paperLength.value, x: area.scrollLeft, y: area.scrollTop }));
  } catch { saveError.value = true; }
}

async function restoreView(): Promise<void> {
  try {
    const view = JSON.parse(localStorage.getItem(`${storageKey()}:view`) || '{}');
    zoom.value = [100, 125, 150, 200].includes(view.zoom) ? view.zoom : 100;
    const inkBottom = strokes.value.reduce((bottom, stroke) => stroke.points.reduce((max, point) => Math.max(max, point.y), bottom), 0);
    paperLength.value = Math.max(1.75, Math.min(6, Number(view.paperLength) || 1.75), inkBottom + .1);
    await nextTick();
    scrollArea.value?.scrollTo(Number(view.x) || 0, Number(view.y) || 0);
  } catch { zoom.value = 100; }
}

function storageKey(): string {
  return `${storagePrefix}${props.promptId}`;
}

function load(): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]') as PadStroke[];
    strokes.value = Array.isArray(parsed)
      ? parsed.filter((stroke) => (stroke.tool === 'pen' || stroke.tool === 'eraser') && Array.isArray(stroke.points))
      : [];
  } catch {
    strokes.value = [];
  }
}

function persist(): void {
  try {
    if (strokes.value.length) localStorage.setItem(storageKey(), JSON.stringify(strokes.value));
    else localStorage.removeItem(storageKey());
    saveError.value = false;
  } catch { saveError.value = true; }
}

function canvasPoint(event: PointerEvent): PadPoint | null {
  const element = canvas.value;
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(paperLength.value, Math.max(0, (event.clientY - rect.top) / rect.height * paperLength.value)),
    pressure: event.pressure > 0 ? event.pressure : 0.5,
  };
}

function drawStroke(context: CanvasRenderingContext2D, stroke: PadStroke): void {
  if (!stroke.points.length) return;
  const width = context.canvas.width;
  const height = context.canvas.height;
  const outline = getStroke(stroke.points.map((point) => [
    point.x * width,
    point.y * height / paperLength.value,
    point.pressure ?? 0.5,
  ]), {
    size: stroke.tool === 'eraser' ? Math.max(24, width * 0.03) : Math.max(4.2, width * 0.006),
    thinning: stroke.tool === 'eraser' ? 0 : 0.68,
    smoothing: 0.62,
    streamline: 0.45,
    simulatePressure: !stroke.pressureSensitive,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
  });
  if (!outline.length) return;
  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.fillStyle = '#17324d';
  context.beginPath();
  outline.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
  context.restore();
}

function render(): void {
  const element = canvas.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (rect.width * rect.height)));
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (element.width !== width || element.height !== height) {
    element.width = width;
    element.height = height;
  }
  const context = element.getContext('2d');
  if (!context) return;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#dce8f2';
  context.lineWidth = Math.max(1, ratio);
  const lineGap = Math.max(42, Math.round(width * 0.052));
  for (let y = lineGap; y < height; y += lineGap) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.strokeStyle = '#f2b7b7';
  context.beginPath();
  context.moveTo(Math.round(width * 0.055), 0);
  context.lineTo(Math.round(width * 0.055), height);
  context.stroke();
  if (overlayEnabled.value && props.overlayAllowed && overlayImage?.complete) {
    context.save();
    context.globalAlpha = overlayOpacity.value / 100;
    const originalHeight = height / paperLength.value;
    const scale = Math.min(width / overlayImage.naturalWidth, originalHeight / overlayImage.naturalHeight);
    const drawWidth = overlayImage.naturalWidth * scale;
    const drawHeight = overlayImage.naturalHeight * scale;
    context.drawImage(overlayImage, (width - drawWidth) / 2, (originalHeight - drawHeight) / 2, drawWidth, drawHeight);
    context.restore();
  }
  const renderedStrokes = replayCount.value === null ? strokes.value : strokes.value.slice(0, replayCount.value);
  inkCanvas ||= document.createElement('canvas');
  frameCanvas ||= document.createElement('canvas');
  const resized = inkCanvas.width !== width || inkCanvas.height !== height;
  if (resized) { inkCanvas.width = frameCanvas.width = width; inkCanvas.height = frameCanvas.height = height; }
  const ink = inkCanvas.getContext('2d'), frame = frameCanvas.getContext('2d');
  if (!ink || !frame) return;
  if (resized || cachedStrokes !== strokes.value || cachedReplay !== replayCount.value || cachedPaperLength !== paperLength.value) {
    ink.clearRect(0, 0, width, height);
    renderedStrokes.forEach(stroke => drawStroke(ink, stroke));
    cachedStrokes = strokes.value; cachedReplay = replayCount.value; cachedPaperLength = paperLength.value;
  }
  frame.clearRect(0, 0, width, height);
  frame.drawImage(inkCanvas, 0, 0);
  if (activeStroke) drawStroke(frame, activeStroke);
  // Erasing only affects the transparent ink layer, never paper lines or answer overlays.
  context.drawImage(frameCanvas, 0, 0);
}

function startDrawing(event: PointerEvent): void {
  if (props.disabled || replaying.value || activePointer !== null) return;
  if (event.pointerType === 'touch' && penOnly.value) {
    if (Date.now() < penActiveUntil || pan) return;
    pan = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.value?.setPointerCapture(event.pointerId);
    event.preventDefault();
    return;
  }
  const penEraser = event.pointerType === 'pen' && (event.button === 2 || event.button === 5 || (event.buttons & 32) === 32);
  if (event.button > 0 && !penEraser) return;
  if (event.pointerType === 'pen') penActiveUntil = Date.now() + 1200;
  if (event.pointerType === 'touch' && Date.now() < penActiveUntil) return;
  const point = canvasPoint(event);
  if (!point) return;
  canvas.value?.setPointerCapture(event.pointerId);
  activePointer = event.pointerId;
  pan = null;
  event.preventDefault();
  drawing.value = true;
  activeStroke = { tool: penEraser ? 'eraser' : tool.value, points: [point], pressureSensitive: event.pointerType === 'pen' };
  scheduleRender();
}

function continueDrawing(event: PointerEvent): void {
  if (pan?.id === event.pointerId && event.pointerType === 'touch' && activePointer === null) {
    event.preventDefault();
    const area = scrollArea.value;
    if (area) {
      const deltaY = pan.y - event.clientY;
      const before = area.scrollTop;
      area.scrollLeft += pan.x - event.clientX;
      area.scrollTop += deltaY;
      if (!expanded.value) window.scrollBy(0, deltaY - (area.scrollTop - before));
    }
    pan.x = event.clientX; pan.y = event.clientY;
    return;
  }
  if (!drawing.value || !activeStroke || event.pointerId !== activePointer) return;
  event.preventDefault();
  if (event.pointerType === 'pen') penActiveUntil = Date.now() + 1200;
  const samples = event.getCoalescedEvents?.() || [];
  for (const sample of samples.length ? samples : [event]) {
    const point = canvasPoint(sample);
    const previous = activeStroke.points.at(-1);
    if (!point || (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0006)) continue;
    activeStroke.points.push(point);
  }
  scheduleRender();
}

function endDrawing(event?: PointerEvent): void {
  if (event && pan?.id === event.pointerId) { pan = null; queuePersistView(); return; }
  if (event && event.pointerId !== activePointer) return;
  if (!drawing.value || !activeStroke) return;
  if (event?.type === 'pointerup') continueDrawing(event);
  if (event?.pointerType === 'pen') penActiveUntil = Date.now() + 250;
  drawing.value = false;
  if (activeStroke.points.length) strokes.value = [...strokes.value, activeStroke];
  activeStroke = null;
  activePointer = null;
  persist();
  persistView();
  scheduleRender();
}

async function toggleExpanded(): Promise<void> {
  endDrawing();
  pan = null;
  if (!expanded.value) {
    previousFocus = document.activeElement as HTMLElement | null;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else document.body.style.overflow = previousOverflow;
  expanded.value = !expanded.value;
  emit('expanded', expanded.value);
  await nextTick();
  if (expanded.value) padRoot.value?.querySelector<HTMLButtonElement>('[data-pad-expand]')?.focus();
  else previousFocus?.focus();
  scheduleRender();
}

function handlePadKey(event: KeyboardEvent): void {
  if (!expanded.value) return;
  if (event.key === 'Escape') { event.stopPropagation(); void toggleExpanded(); }
  if (event.key === 'Tab') {
    const elements = [...(padRoot.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') || [])].filter(el => el.offsetParent !== null);
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}

function undo(): void {
  if (props.disabled || !strokes.value.length) return;
  strokes.value = strokes.value.slice(0, -1);
  persist();
  render();
}

function clearPad(): void {
  if (props.disabled || !strokes.value.length || !confirm('이 문제의 손글씨 답안을 모두 지울까요?')) return;
  strokes.value = [];
  persist();
  render();
}

function saveImage(): void {
  const element = canvas.value;
  if (!element) return;
  const link = document.createElement('a');
  link.href = element.toDataURL('image/png');
  link.download = `${props.promptId}-답안.png`;
  link.click();
}

function toggleLeftHanded(): void {
  leftHanded.value = !leftHanded.value;
  localStorage.setItem('unified-cbt-practical-left-handed', leftHanded.value ? '1' : '0');
}

function prepareOverlay(): void {
  const source = props.answerImages?.[0];
  overlayImage = null;
  overlayEnabled.value = false;
  if (!source) return;
  const image = new Image();
  image.onload = render;
  image.src = source;
  overlayImage = image;
}

function replay(): void {
  if (!strokes.value.length || replaying.value) return;
  replaying.value = true;
  replayCount.value = 0;
  const startedAt = performance.now();
  const duration = Math.min(5000, Math.max(1200, strokes.value.length * 90));
  const step = (now: number) => {
    const ratio = Math.min(1, (now - startedAt) / duration);
    replayCount.value = Math.ceil(strokes.value.length * ratio);
    render();
    if (ratio < 1) replayFrame = requestAnimationFrame(step);
    else {
      replaying.value = false;
      replayCount.value = null;
      render();
    }
  };
  replayFrame = requestAnimationFrame(step);
}

function importPhoto(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !file.type.startsWith('image/')) return;
  if (photoAnswer.value) URL.revokeObjectURL(photoAnswer.value);
  photoAnswer.value = URL.createObjectURL(file);
}

function closePhoto(): void {
  if (photoAnswer.value) URL.revokeObjectURL(photoAnswer.value);
  photoAnswer.value = '';
}

watch(() => props.promptId, async () => {
  load();
  prepareOverlay();
  closePhoto();
  await restoreView();
  await nextTick();
  render();
});
watch(penOnly, value => localStorage.setItem('cbt-practical-pen-only', value ? '1' : '0'));
watch(zoom, () => { void nextTick(() => { persistView(); scheduleRender(); }); });
watch(paperLength, () => { void nextTick(() => { persistView(); scheduleRender(); }); });
watch([overlayEnabled, overlayOpacity, () => props.overlayAllowed], render);
watch(() => props.answerImages, prepareOverlay, { deep: true });

onMounted(() => {
  load();
  prepareOverlay();
  resizeObserver = new ResizeObserver(scheduleRender);
  if (canvas.value) resizeObserver.observe(canvas.value);
  render();
  void restoreView();
});

onBeforeUnmount(() => {
  endDrawing();
  if (expanded.value) document.body.style.overflow = previousOverflow;
  emit('expanded', false);
  clearTimeout(viewSaveTimer);
  persistView();
  resizeObserver?.disconnect();
  cancelAnimationFrame(drawFrame);
  cancelAnimationFrame(replayFrame);
  if (photoAnswer.value) URL.revokeObjectURL(photoAnswer.value);
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
  <section ref="padRoot" class="practical-answer-pad" :class="{ disabled, 'left-handed': leftHanded, 'pad-expanded': expanded }" :role="expanded ? 'dialog' : undefined" :aria-modal="expanded || undefined" aria-label="실전 손글씨 답안지" @keydown="handlePadKey">
    <header>
      <div><strong>실전 손글씨 답안지</strong><small>{{ saveError ? '저장 공간 부족: PNG로 답안을 저장하세요.' : '필기는 이 기기에 저장됩니다. S펜·마우스로 작성하세요.' }}</small></div>
      <div class="practical-pad-tools">
        <button type="button" :class="{ active: tool === 'pen' }" :disabled="disabled" @click="tool = 'pen'">✎ 펜</button>
        <button type="button" :class="{ active: tool === 'eraser' }" :disabled="disabled" @click="tool = 'eraser'">지우개</button>
        <button type="button" :disabled="disabled || !strokes.length" @click="undo">되돌리기</button>
        <button type="button" :disabled="!strokes.length || replaying" @click="replay">{{ replaying ? '재생 중…' : '작성 과정 재생' }}</button>
        <button type="button" :disabled="disabled || !strokes.length" @click="clearPad">전체 지우기</button>
        <button type="button" :disabled="!strokes.length" @click="saveImage">PNG 저장</button>
        <button type="button" @click="toggleLeftHanded">{{ leftHanded ? '오른손 배치' : '왼손 배치' }}</button>
        <button type="button" data-pad-expand @click="toggleExpanded">{{ expanded ? '원래 화면으로' : '답안지 크게 쓰기' }}</button>
      </div>
    </header>
    <div v-if="answerImages?.length" class="practical-overlay-tools">
      <button type="button" :disabled="!overlayAllowed" :class="{ active: overlayEnabled }" @click="overlayEnabled = !overlayEnabled">정답 도면 겹치기</button>
      <label v-if="overlayEnabled"><span>정답 투명도</span><input v-model.number="overlayOpacity" type="range" min="8" max="65" step="1"></label>
      <small v-if="!overlayAllowed">정답·채점 기준을 연 뒤 사용할 수 있습니다.</small>
    </div>
    <div class="practical-pad-view-tools">
      <label><input v-model="penOnly" type="checkbox"> 손가락은 이동만</label>
      <label>답안지 확대 <select v-model.number="zoom"><option v-for="value in [100,125,150,200]" :key="value" :value="value">{{ value }}%</option></select></label>
      <button type="button" :disabled="paperLength >= 6 || disabled" @click="endDrawing(); paperLength = Math.min(6, paperLength + .75)">답안지 아래 늘리기</button>
    </div>
    <div ref="scrollArea" class="practical-pad-scroll" @scroll.passive="queuePersistView">
    <canvas
      ref="canvas"
      :style="{ width: zoom + '%', aspectRatio: String(4 / (3 * paperLength)), touchAction: 'none' }"
      aria-label="공조냉동 필답형 손글씨 답안지"
      @pointerdown="startDrawing"
      @pointermove="continueDrawing"
      @pointerup="endDrawing"
      @pointercancel="endDrawing"
      @lostpointercapture="endDrawing"
      @contextmenu.prevent
    />
    </div>
    <div class="practical-photo-answer">
      <label><span>📷 종이에 쓴 답안 가져오기</span><input type="file" accept="image/*" capture="environment" @change="importPhoto"></label>
      <button v-if="photoAnswer" type="button" @click="closePhoto">사진 닫기</button>
      <img v-if="photoAnswer" :src="photoAnswer" alt="촬영하거나 가져온 필답형 답안">
      <small>사진은 서버로 전송하지 않으며 현재 화면에서 비교할 때만 사용합니다.</small>
    </div>
  </section>
  </Teleport>
</template>

<style scoped>
.practical-answer-pad > header strong { font-size:16px; }
.practical-answer-pad > header small { font-size:13px; }
.practical-pad-tools button,.practical-pad-view-tools button { min-height:42px; font-size:13px; }
.practical-pad-view-tools button { padding:6px 12px; border:1px solid var(--line); border-radius:8px; color:var(--text); background:var(--surface); }
.pad-expanded { position:fixed; inset:0; z-index:100000; margin:0; padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left)); border-radius:0; display:flex; flex-direction:column; background:var(--surface,#fff); color:var(--text,#17324d); }
.pad-expanded .practical-pad-scroll { flex:1; min-height:140px; max-height:none; width:min(100%,1120px); align-self:center; }
.pad-expanded .practical-photo-answer { display:none; }
.pad-expanded > header { flex-wrap:wrap; }
.pad-expanded .practical-pad-tools { gap:6px; }
.pad-expanded .practical-pad-view-tools { margin:6px 0; }
@media(max-width:600px) { .pad-expanded .practical-pad-tools button { flex:0 1 auto; } .pad-expanded .practical-pad-tools { max-height:110px; overflow:auto; } }
</style>
