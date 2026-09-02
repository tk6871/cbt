<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import Cropper from 'cropperjs';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Crop, Download, FileImage, Files, RotateCcw } from '@lucide/vue';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const emit = defineEmits<{ close: [] }>();
const fileInput = ref<HTMLInputElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const cropContainer = ref<HTMLElement | null>(null);
const sourceUrl = ref('');
const filename = ref('school-source.png');
const busy = ref(false);
const message = ref('사진이나 PDF를 고르면 필요한 문제 부분만 잘라 저장할 수 있습니다.');
const pdfBytes = ref<Uint8Array | null>(null);
const pdfPage = ref(1);
const pdfPageCount = ref(0);
let cropper: Cropper | null = null;

function clearObjectUrl(): void {
  if (sourceUrl.value.startsWith('blob:')) URL.revokeObjectURL(sourceUrl.value);
}

async function mountCropper(url: string): Promise<void> {
  cropper?.destroy();
  cropper = null;
  clearObjectUrl();
  sourceUrl.value = url;
  await nextTick();
  const image = imageElement.value;
  if (!image) return;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('image load failed'));
    if (image.complete && image.naturalWidth) resolve();
  });
  cropper = new Cropper(image, { container: cropContainer.value || undefined });
}

async function renderPdfPage(): Promise<void> {
  if (!pdfBytes.value) return;
  busy.value = true;
  try {
    const document = await pdfjs.getDocument({ data: pdfBytes.value.slice() }).promise;
    pdfPageCount.value = document.numPages;
    pdfPage.value = Math.max(1, Math.min(document.numPages, pdfPage.value));
    const page = await document.getPage(pdfPage.value);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas unavailable');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    filename.value = `school-pdf-page-${pdfPage.value}.png`;
    await mountCropper(canvas.toDataURL('image/png'));
    message.value = `${pdfPage.value}/${document.numPages}쪽을 불러왔습니다. 문제 부분을 드래그해 선택하세요.`;
  } catch {
    message.value = 'PDF 페이지를 읽지 못했습니다. 암호가 걸렸는지 확인해 주세요.';
  } finally {
    busy.value = false;
  }
}

async function chooseFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  busy.value = true;
  pdfBytes.value = null;
  pdfPage.value = 1;
  pdfPageCount.value = 0;
  try {
    if (file.type === 'application/pdf' || file.name.toLocaleLowerCase().endsWith('.pdf')) {
      pdfBytes.value = new Uint8Array(await file.arrayBuffer());
      await renderPdfPage();
      return;
    }
    filename.value = `${file.name.replace(/\.[^.]+$/, '')}-crop.png`;
    await mountCropper(URL.createObjectURL(file));
    message.value = '필요한 문제와 보기 전체를 드래그해 선택하세요.';
  } catch {
    message.value = '파일을 읽지 못했습니다. JPG·PNG·PDF인지 확인해 주세요.';
  } finally {
    busy.value = false;
    (event.target as HTMLInputElement).value = '';
  }
}

async function croppedCanvas(): Promise<HTMLCanvasElement | null> {
  const selection = cropper?.getCropperSelection();
  if (!selection) {
    message.value = '자를 영역을 먼저 선택해 주세요.';
    return null;
  }
  return selection.$toCanvas({ width: Math.min(2400, Math.max(600, selection.width * 2)) });
}

async function downloadCrop(): Promise<void> {
  const canvas = await croppedCanvas();
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.value;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    message.value = '잘라낸 문제 사진을 저장했습니다. 이 채팅에 첨부하면 됩니다.';
  }, 'image/png');
}

function resetSelection(): void {
  cropper?.getCropperSelection()?.$reset();
  message.value = '선택 영역을 초기화했습니다.';
}

onBeforeUnmount(() => {
  cropper?.destroy();
  clearObjectUrl();
});
</script>

<template>
  <section class="school-source-prep">
    <header><div><span><Crop :size="18" /></span><strong>사진·PDF 문제 자르기</strong><small>OCR 전에 문제와 보기를 선명하게 정리</small></div><button type="button" @click="emit('close')">닫기</button></header>
    <div class="school-source-actions">
      <button type="button" :disabled="busy" @click="fileInput?.click()"><Files :size="16" /> {{ busy ? '불러오는 중…' : '사진·PDF 선택' }}</button>
      <button v-if="sourceUrl" type="button" @click="resetSelection"><RotateCcw :size="16" /> 영역 초기화</button>
      <button v-if="sourceUrl" type="button" class="primary" @click="downloadCrop"><Download :size="16" /> 선택 영역 저장</button>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" hidden @change="chooseFile">
    </div>
    <div v-if="pdfPageCount > 1" class="school-pdf-pages"><button type="button" :disabled="pdfPage <= 1 || busy" @click="pdfPage -= 1; renderPdfPage()">이전 쪽</button><label><input v-model.number="pdfPage" type="number" min="1" :max="pdfPageCount" @change="renderPdfPage"> / {{ pdfPageCount }}쪽</label><button type="button" :disabled="pdfPage >= pdfPageCount || busy" @click="pdfPage += 1; renderPdfPage()">다음 쪽</button></div>
    <div v-if="sourceUrl" ref="cropContainer" class="school-crop-stage"><img ref="imageElement" :src="sourceUrl" alt="자를 학교 시험 자료"></div>
    <div v-else class="school-source-empty"><FileImage :size="34" /><strong>원본 파일은 서버로 전송되지 않습니다</strong><small>현재 기기 안에서만 열고 자릅니다.</small></div>
    <p aria-live="polite">{{ message }}</p>
  </section>
</template>

<style scoped>
.school-source-prep{margin:0 0 18px;border:1px solid var(--line);border-radius:18px;background:var(--surface);overflow:hidden}.school-source-prep>header{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.school-source-prep>header>div{display:grid;grid-template-columns:36px 1fr;align-items:center;column-gap:9px}.school-source-prep>header div>span{grid-row:1/3;width:36px;height:36px;border-radius:10px;color:var(--primary);background:var(--primary-soft);display:grid;place-items:center}.school-source-prep>header strong,.school-source-prep>header small{display:block}.school-source-prep>header strong{font-size:.78rem}.school-source-prep>header small{color:var(--muted);font-size:.58rem}.school-source-prep button{min-height:36px;padding:0 11px;border:1px solid var(--line);border-radius:9px;color:var(--text);background:var(--surface-2);font-size:.58rem;font-weight:850}.school-source-actions{padding:11px 14px;display:flex;flex-wrap:wrap;gap:7px}.school-source-actions button{display:flex;align-items:center;gap:6px}.school-source-actions button.primary{color:#fff;border-color:var(--primary);background:var(--primary)}.school-pdf-pages{padding:0 14px 10px;display:flex;align-items:center;justify-content:center;gap:8px}.school-pdf-pages label{color:var(--muted);font-size:.58rem}.school-pdf-pages input{width:58px;height:34px;border:1px solid var(--line);border-radius:7px;color:var(--text);background:var(--surface);text-align:center}.school-crop-stage{height:min(60vh,620px);margin:0 14px;border:1px solid var(--line);border-radius:12px;background:#18202b;overflow:hidden}.school-crop-stage>img{display:block;max-width:100%}.school-source-empty{min-height:170px;margin:0 14px;border:1px dashed var(--line);border-radius:12px;color:var(--muted);display:grid;place-content:center;justify-items:center;gap:5px;text-align:center}.school-source-empty strong{color:var(--text);font-size:.68rem}.school-source-empty small{font-size:.56rem}.school-source-prep>p{margin:0;padding:11px 14px;color:var(--muted);font-size:.58rem;line-height:1.55}@media(max-width:520px){.school-source-actions{display:grid;grid-template-columns:1fr}.school-source-actions button{justify-content:center}.school-crop-stage{height:52vh}}
</style>
