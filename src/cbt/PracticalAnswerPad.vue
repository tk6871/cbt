<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
const strokes = ref<PadStroke[]>([]);
const drawing = ref(false);
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

function storageKey(): string {
  return `${storagePrefix}${props.promptId}`;
}

function load(): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) || '[]') as PadStroke[];
    strokes.value = Array.isArray(parsed)
      ? parsed.filter((stroke) => (stroke.tool === 'pen' || stroke.tool === 'eraser') && Array.isArray(stroke.points)).slice(-120)
      : [];
  } catch {
    strokes.value = [];
  }
}

function persist(): void {
  if (strokes.value.length) localStorage.setItem(storageKey(), JSON.stringify(strokes.value));
  else localStorage.removeItem(storageKey());
}

function canvasPoint(event: PointerEvent): PadPoint | null {
  const element = canvas.value;
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    pressure: event.pressure > 0 ? event.pressure : 0.5,
  };
}

function drawStroke(context: CanvasRenderingContext2D, stroke: PadStroke): void {
  if (!stroke.points.length) return;
  const width = context.canvas.width;
  const height = context.canvas.height;
  const outline = getStroke(stroke.points.map((point) => [
    point.x * width,
    point.y * height,
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
  context.fillStyle = stroke.tool === 'eraser' ? '#ffffff' : '#17324d';
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
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
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
    const scale = Math.min(width / overlayImage.naturalWidth, height / overlayImage.naturalHeight);
    const drawWidth = overlayImage.naturalWidth * scale;
    const drawHeight = overlayImage.naturalHeight * scale;
    context.drawImage(overlayImage, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    context.restore();
  }
  const renderedStrokes = replayCount.value === null ? strokes.value : strokes.value.slice(0, replayCount.value);
  renderedStrokes.forEach((stroke) => drawStroke(context, stroke));
  if (activeStroke) drawStroke(context, activeStroke);
}

function startDrawing(event: PointerEvent): void {
  if (props.disabled || replaying.value) return;
  const penEraser = event.pointerType === 'pen' && (event.button === 2 || event.button === 5 || (event.buttons & 32) === 32);
  if (event.button > 0 && !penEraser) return;
  if (event.pointerType === 'pen') penActiveUntil = Date.now() + 1200;
  if (event.pointerType === 'touch' && Date.now() < penActiveUntil) return;
  const point = canvasPoint(event);
  if (!point) return;
  canvas.value?.setPointerCapture(event.pointerId);
  drawing.value = true;
  activeStroke = { tool: penEraser ? 'eraser' : tool.value, points: [point], pressureSensitive: event.pointerType === 'pen' };
  render();
}

function continueDrawing(event: PointerEvent): void {
  if (!drawing.value || !activeStroke) return;
  if (event.pointerType === 'pen') penActiveUntil = Date.now() + 1200;
  const point = canvasPoint(event);
  const previous = activeStroke.points.at(-1);
  if (!point || (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0018)) return;
  activeStroke.points.push(point);
  render();
}

function endDrawing(): void {
  if (!drawing.value || !activeStroke) return;
  drawing.value = false;
  if (activeStroke.points.length) strokes.value = [...strokes.value.slice(-119), activeStroke];
  activeStroke = null;
  persist();
  render();
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
  await nextTick();
  render();
});
watch([overlayEnabled, overlayOpacity, () => props.overlayAllowed], render);
watch(() => props.answerImages, prepareOverlay, { deep: true });

onMounted(() => {
  load();
  prepareOverlay();
  resizeObserver = new ResizeObserver(render);
  if (canvas.value) resizeObserver.observe(canvas.value);
  render();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  cancelAnimationFrame(replayFrame);
  if (photoAnswer.value) URL.revokeObjectURL(photoAnswer.value);
});
</script>

<template>
  <section class="practical-answer-pad" :class="{ disabled, 'left-handed': leftHanded }">
    <header>
      <div><strong>실전 손글씨 답안지</strong><small>S펜 압력과 팜 리젝션을 지원합니다. 펜·손가락·마우스로 실제 시험처럼 작성하세요.</small></div>
      <div class="practical-pad-tools">
        <button type="button" :class="{ active: tool === 'pen' }" :disabled="disabled" @click="tool = 'pen'">✎ 펜</button>
        <button type="button" :class="{ active: tool === 'eraser' }" :disabled="disabled" @click="tool = 'eraser'">지우개</button>
        <button type="button" :disabled="disabled || !strokes.length" @click="undo">되돌리기</button>
        <button type="button" :disabled="!strokes.length || replaying" @click="replay">{{ replaying ? '재생 중…' : '작성 과정 재생' }}</button>
        <button type="button" :disabled="disabled || !strokes.length" @click="clearPad">전체 지우기</button>
        <button type="button" :disabled="!strokes.length" @click="saveImage">PNG 저장</button>
        <button type="button" @click="toggleLeftHanded">{{ leftHanded ? '오른손 배치' : '왼손 배치' }}</button>
      </div>
    </header>
    <div v-if="answerImages?.length" class="practical-overlay-tools">
      <button type="button" :disabled="!overlayAllowed" :class="{ active: overlayEnabled }" @click="overlayEnabled = !overlayEnabled">정답 도면 겹치기</button>
      <label v-if="overlayEnabled"><span>정답 투명도</span><input v-model.number="overlayOpacity" type="range" min="8" max="65" step="1"></label>
      <small v-if="!overlayAllowed">정답·채점 기준을 연 뒤 사용할 수 있습니다.</small>
    </div>
    <canvas
      ref="canvas"
      aria-label="공조냉동 필답형 손글씨 답안지"
      @pointerdown.prevent="startDrawing"
      @pointermove.prevent="continueDrawing"
      @pointerup.prevent="endDrawing"
      @pointercancel.prevent="endDrawing"
      @pointerleave="endDrawing"
      @contextmenu.prevent
    />
    <div class="practical-photo-answer">
      <label><span>📷 종이에 쓴 답안 가져오기</span><input type="file" accept="image/*" capture="environment" @change="importPhoto"></label>
      <button v-if="photoAnswer" type="button" @click="closePhoto">사진 닫기</button>
      <img v-if="photoAnswer" :src="photoAnswer" alt="촬영하거나 가져온 필답형 답안">
      <small>사진은 서버로 전송하지 않으며 현재 화면에서 비교할 때만 사용합니다.</small>
    </div>
  </section>
</template>
