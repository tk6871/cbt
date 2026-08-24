<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { hotspotStyle, unifiedAnswerHotspots } from './answerHotspotGeometry';
import { isImagePrimary } from './catalog';
import { calculationGuideFor, commonCalculationNumberOrigins, isCalculationItem } from './calculationGuide';
import type { QuestionItem, StudyMode } from './types';

const props = defineProps<{
  item: QuestionItem;
  selected?: number;
  mode: StudyMode;
  subjectStart?: boolean;
  subjectNumber?: number;
  displayNumber?: number;
  bookmarked?: boolean;
  kept?: boolean;
  calculationMode?: boolean;
  imageAnswerMode?: 'buttons' | 'hotspot';
  answerLayout?: 'classic' | 'inline' | 'hotspot';
  hotspotIndicator?: 'marker' | 'area';
  restoredImageTheme?: 'auto' | 'original';
  solveLayout?: 'standard' | 'comcbt' | 'combat';
  active?: boolean;
  experimentalFeatures?: boolean;
  confidence?: 'sure' | 'unsure' | 'guess';
  mistakeReason?: 'concept' | 'formula' | 'unit' | 'careless';
  studyNote?: string;
}>();

defineEmits<{
  choose: [choice: number];
  toggleBookmark: [];
  toggleKeep: [];
  askAi: [];
  activate: [];
  setConfidence: [confidence: 'sure' | 'unsure' | 'guess'];
  setMistakeReason: [reason: 'concept' | 'formula' | 'unit' | 'careless'];
  updateStudyNote: [note: string];
}>();

const primaryImage = computed(() => isImagePrimary(props.item));
const hansolQuestion = computed(() => props.item.round.qualificationKey === 'hvac-hansol');
const fieldReportQuestion = computed(() => props.item.round.kind === 'field-report-practice');
const restoredQuestion = computed(() =>
  !fieldReportQuestion.value && props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const restoredImageClass = computed(() => `restored-image-${props.restoredImageTheme || 'auto'}`);
const correctSelected = computed(() => props.selected === props.item.question.answer);
const calculationGuide = computed(() => calculationGuideFor(props.item));
const calculationProblem = computed(() => isCalculationItem(props.item));
const beginnerCalculationAvailable = computed(() => (props.calculationMode || calculationProblem.value)
  && calculationGuide.value.reliable !== false);
const calculationNumberOrigins = computed(() => {
  const guideOrigins = calculationGuide.value.numberOrigins || [];
  const guideText = guideOrigins.join(' ');
  const commonOrigins = commonCalculationNumberOrigins(props.item).filter((origin) => {
    const keyNumber = origin.match(/(?:\d[\d,.]*|√3)/)?.[0];
    return !keyNumber || !guideText.includes(keyNumber);
  });
  return [...new Set([...guideOrigins, ...commonOrigins])];
});
const verifiedHotspots = computed(() => props.imageAnswerMode === 'hotspot' ? props.item.question.answerHotspots || [] : []);
const unifiedHotspots = computed(() => unifiedAnswerHotspots(verifiedHotspots.value));
const answerHighlightStyles = ref<Record<number, Record<string, string>>>({});
const selectedAreaHighlightStyles = computed(() => {
  if (!props.selected) return [];
  const hotspot = unifiedHotspots.value.find((item) => item.choice === props.selected);
  if (hotspot?.segments?.length) return [hotspotStyle(hotspot)];
  const fallback = answerHighlightStyles.value[props.selected];
  return fallback ? [fallback] : [];
});
const selectedMarkerStyle = computed(() => {
  const highlight = selectedAreaHighlightStyles.value[0];
  return highlight ? { left: highlight.left, top: highlight.top } : undefined;
});
const selectedAnswerState = computed(() => ({
  correct: props.mode === 'learn' && props.selected === props.item.question.answer,
  wrong: props.mode === 'learn' && props.selected !== props.item.question.answer,
}));
const sourceImageRef = ref<HTMLImageElement | null>(null);
const imageZoomOpen = ref(false);
const explanationOpen = ref(false);
const explanationDismissed = ref(false);
const beginnerCalculationOpen = ref(false);
const explanationAutoCloseSeconds = ref(0);
let explanationAutoCloseTimer: number | undefined;
const speechAvailable = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const speechSpeaking = ref(false);
const circles = ['①', '②', '③', '④'];

function readableText(value = ''): string {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stopExplanationAutoClose(): void {
  if (explanationAutoCloseTimer !== undefined) window.clearInterval(explanationAutoCloseTimer);
  explanationAutoCloseTimer = undefined;
  explanationAutoCloseSeconds.value = 0;
}

function closeInlineExplanation(): void {
  stopExplanationAutoClose();
  explanationDismissed.value = true;
}

function closeCompactExplanation(): void {
  stopExplanationAutoClose();
  explanationOpen.value = false;
}

function reopenExplanation(): void {
  stopExplanationAutoClose();
  explanationDismissed.value = false;
  explanationOpen.value = true;
}

function startExplanationAutoClose(): void {
  stopExplanationAutoClose();
  explanationAutoCloseSeconds.value = 20;
  explanationAutoCloseTimer = window.setInterval(() => {
    explanationAutoCloseSeconds.value -= 1;
    if (explanationAutoCloseSeconds.value > 0) return;
    if (compactSolveLayout.value && !inlineCompactExplanation.value) explanationOpen.value = false;
    else explanationDismissed.value = true;
    stopExplanationAutoClose();
  }, 1000);
}

function leadingQuestionNumberPattern(number: number): RegExp {
  return new RegExp(`^(?:\\s|&nbsp;)*${number}\\s*(?:[.)：:]|번(?:\\s*[.)：:]?)?)(?:\\s|&nbsp;)*`);
}

function leadingChoiceMarkerPattern(index: number): RegExp {
  const number = index + 1;
  return new RegExp(`^(?:\\s|&nbsp;)*(?:${circles[index]}|${number}\\s*(?:[.)：:]|번(?:\\s*[.)：:]?)?))(?:\\s|&nbsp;)*`);
}

const displayedQuestionMarkup = computed(() => {
  const source = props.item.question.html || props.item.question.text || '';
  return String(source).replace(leadingQuestionNumberPattern(props.item.question.number), '');
});
const embeddedChoiceMarkers = computed(() => props.item.question.choices.length === 4
  && props.item.question.choices.every((choice, index) => leadingChoiceMarkerPattern(index)
    .test(String(choice.html || choice.text || ''))));
const displayedChoices = computed(() => props.item.question.choices.map((choice, index) => {
  const source = String(choice.html || choice.text || `${index + 1}번`);
  return embeddedChoiceMarkers.value ? source.replace(leadingChoiceMarkerPattern(index), '') : source;
}));
const canReadQuestion = computed(() => speechAvailable
  && readableText(displayedQuestionMarkup.value).length >= 4
  && displayedChoices.value.some((choice) => readableText(choice).length >= 1));

function toggleQuestionSpeech(): void {
  if (!canReadQuestion.value) return;
  if (speechSpeaking.value) {
    window.speechSynthesis.cancel();
    speechSpeaking.value = false;
    return;
  }
  const choiceText = displayedChoices.value.map((choice, index) =>
    `${index + 1}번. ${readableText(choice)}`).join('. ');
  const utterance = new SpeechSynthesisUtterance(`${readableText(displayedQuestionMarkup.value)}. ${choiceText}`);
  utterance.lang = 'ko-KR';
  utterance.rate = .92;
  utterance.onend = () => { speechSpeaking.value = false; };
  utterance.onerror = () => { speechSpeaking.value = false; };
  speechSpeaking.value = true;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
const showQuestionIdentity = computed(() => primaryImage.value
  && Boolean(props.displayNumber)
  && props.displayNumber !== props.item.question.number);

const explanationRaw = computed(() => String(
  props.item.question.explanationHtml || props.item.question.explanation || '',
));
const primaryExplanationText = computed(() => readableText(explanationRaw.value
  .split(/\n\n\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설|정답·해설 대조 완료)\]\n/)[0]));
const legacyAdditionalExplanation = computed(() => {
  const source = explanationRaw.value;
  const matched = source.split(/\[(?:COMCBT 동일 문제 추가 해설|한솔아카데미 동일 문제 보충 해설)\]/)[1];
  if (matched) return readableText(matched
    .split(/\[정답·해설 대조 완료\]/)[0]
    .replace(/\[해설작성자[^\]]*\]/g, ' '));
  return '';
});
const additionalExplanationSections = computed(() => {
  const sections = [...(props.item.question.additionalExplanations || [])]
    .map((entry) => ({ ...entry, text: readableText(entry.text) }))
    .filter((entry) => entry.text);
  if (legacyAdditionalExplanation.value && !sections.some((entry) => entry.text === legacyAdditionalExplanation.value)) {
    sections.push({ label: '추가 해설', source: '동일 문제 원문', text: legacyAdditionalExplanation.value });
  }
  return sections;
});
function hasReadableChoice(choice: QuestionItem['question']['choices'][number], index: number): boolean {
  if (choice.images?.length) return true;
  const text = (choice.text || choice.html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Boolean(text) && !new RegExp(`^(?:[①②③④]|${index + 1}(?:번)?)$`).test(text);
}

const hasReadableChoices = computed(() => props.item.question.choices.some(hasReadableChoice));
const compactVisualChoices = computed(() => !restoredQuestion.value
  && props.item.question.choices.length === 4
  && props.item.question.choices.some((choice) => choice.images?.length));
const compactTextChoices = computed(() => {
  if (primaryImage.value || props.item.question.choices.some((choice) => choice.images?.length)) return false;
  const lengths = displayedChoices.value.map((choice) => choice
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length);
  return lengths.length === 4
    && Math.max(...lengths) <= 34
    && lengths.reduce((sum, length) => sum + length, 0) <= 96;
});
const choiceLayoutProbeRef = ref<HTMLElement | null>(null);
const forceVerticalTextChoices = ref(false);
const twoColumnTextChoices = computed(() => compactTextChoices.value && !forceVerticalTextChoices.value);
let choiceLayoutObserver: ResizeObserver | null = null;

function measureChoiceWrapping(): void {
  const probe = choiceLayoutProbeRef.value;
  if (!probe || !compactTextChoices.value) {
    forceVerticalTextChoices.value = false;
    return;
  }
  const wraps = [...probe.querySelectorAll<HTMLElement>('.choice-copy > span')].some((copy) => {
    const lineBox = copy.parentElement || copy;
    const lineHeight = Number.parseFloat(getComputedStyle(lineBox).lineHeight) || 18;
    return copy.getBoundingClientRect().height > lineHeight * 1.45 || copy.getClientRects().length > 1;
  });
  forceVerticalTextChoices.value = wraps;
}

async function reconnectChoiceLayoutProbe(): Promise<void> {
  choiceLayoutObserver?.disconnect();
  choiceLayoutObserver = null;
  await nextTick();
  const probe = choiceLayoutProbeRef.value;
  if (!probe) {
    forceVerticalTextChoices.value = false;
    return;
  }
  choiceLayoutObserver = new ResizeObserver(measureChoiceWrapping);
  choiceLayoutObserver.observe(probe);
  measureChoiceWrapping();
  void document.fonts?.ready.then(measureChoiceWrapping);
}
const compactSolveLayout = computed(() => props.solveLayout === 'comcbt');
const inlineCompactExplanation = computed(() => props.solveLayout === 'comcbt');
const combatDenseChoices = computed(() => {
  if (props.solveLayout !== 'combat'
    || primaryImage.value
    || props.item.question.choices.some((choice) => choice.images?.length)) return false;
  const lengths = props.item.question.choices.map((choice) => (choice.text || choice.html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length);
  return lengths.length === 4 && Math.max(...lengths) <= 52 && lengths.reduce((sum, length) => sum + length, 0) <= 160;
});
const combatUltraShortChoices = computed(() => combatDenseChoices.value && props.item.question.choices.every((choice) =>
  (choice.text || choice.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length <= 10));

function choiceClass(index: number): Record<string, boolean> {
  const number = index + 1;
  return {
    selected: props.selected === number,
    correct: props.mode === 'learn' && props.selected === number && number === props.item.question.answer,
    wrong: props.mode === 'learn' && props.selected === number && number !== props.item.question.answer,
  };
}

function calculateAnswerHighlights(image: HTMLImageElement): void {
  const fallbackHotspots = verifiedHotspots.value.filter((hotspot) => !hotspot.segments?.length);
  if (!image.naturalWidth || !image.naturalHeight || !fallbackHotspots.length) {
    answerHighlightStyles.value = {};
    return;
  }

  const scale = Math.min(1, 1000 / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  try {
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    const result: Record<number, Record<string, string>> = {};

    for (const hotspot of fallbackHotspots) {
      const cellLeft = Math.max(0, Math.floor(width * hotspot.x / 100));
      const cellTop = Math.max(0, Math.floor(height * hotspot.y / 100));
      const cellRight = Math.min(width, Math.ceil(width * (hotspot.x + hotspot.width) / 100));
      const cellBottom = Math.min(height, Math.ceil(height * (hotspot.y + hotspot.height) / 100));
      const inset = Math.max(2, Math.round(2 * scale));
      const columnInk = new Uint16Array(Math.max(0, cellRight - cellLeft));
      const rowInk = new Uint16Array(Math.max(0, cellBottom - cellTop));

      for (let y = cellTop + inset; y < cellBottom - inset; y += 1) {
        for (let x = cellLeft + inset; x < cellRight - inset; x += 1) {
          const offset = (y * width + x) * 4;
          if (pixels[offset + 3] < 80) continue;
          const luminance = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
          if (luminance < 188) {
            columnInk[x - cellLeft] += 1;
            rowInk[y - cellTop] += 1;
          }
        }
      }

      const inkColumns = [...columnInk.keys()].filter((index) => columnInk[index] >= 2);
      const inkRows = [...rowInk.keys()].filter((index) => rowInk[index] >= 2);
      if (!inkColumns.length || !inkRows.length) continue;

      const padding = Math.max(5, Math.round(7 * scale));
      const left = Math.max(cellLeft, cellLeft + inkColumns[0] - padding);
      const top = Math.max(cellTop, cellTop + inkRows[0] - padding);
      const right = Math.min(cellRight, cellLeft + inkColumns[inkColumns.length - 1] + padding + 1);
      const bottom = Math.min(cellBottom, cellTop + inkRows[inkRows.length - 1] + padding + 1);
      result[hotspot.choice] = {
        left: `${left / width * 100}%`,
        top: `${top / height * 100}%`,
        width: `${Math.max(1, right - left) / width * 100}%`,
        height: `${Math.max(1, bottom - top) / height * 100}%`,
      };
    }
    answerHighlightStyles.value = result;
  } catch {
    answerHighlightStyles.value = {};
  }
}

watch(verifiedHotspots, (hotspots) => {
  answerHighlightStyles.value = {};
  if (hotspots.length && sourceImageRef.value?.complete) calculateAnswerHighlights(sourceImageRef.value);
}, { flush: 'post' });
watch(
  () => ({ itemId: props.item.id, selected: props.selected, solveLayout: props.solveLayout }),
  ({ itemId, selected }, previous) => {
  stopExplanationAutoClose();
  explanationDismissed.value = false;
  // 계산문제는 정답을 맞힌 즉시 초보 계산 순서를 보여 준다. 사용자가 접을 수는 있다.
  beginnerCalculationOpen.value = Boolean(
    props.mode === 'learn'
    && correctSelected.value
    && beginnerCalculationAvailable.value,
  );
  explanationOpen.value = Boolean(
    props.mode === 'learn'
    && correctSelected.value
    && compactSolveLayout.value
    && !inlineCompactExplanation.value,
  );
  const firstCorrectOpen = props.mode === 'learn'
    && correctSelected.value
    && previous?.itemId === itemId
    && previous.selected !== selected;
  if (firstCorrectOpen) startExplanationAutoClose();
  },
);
watch(() => [props.item.id, props.solveLayout, compactTextChoices.value], () => {
  void reconnectChoiceLayoutProbe();
}, { flush: 'post' });
onMounted(() => { void reconnectChoiceLayoutProbe(); });
onBeforeUnmount(() => {
  choiceLayoutObserver?.disconnect();
  stopExplanationAutoClose();
  if (speechSpeaking.value) window.speechSynthesis.cancel();
});
</script>

<template>
  <article
    class="question-card"
    :class="{
      'image-primary': primaryImage,
      'compact-solve-card': compactSolveLayout,
      'combat-solve-card': solveLayout === 'combat',
      'keyboard-active': active,
    }"
    @pointerdown="$emit('activate')"
    @focusin="$emit('activate')"
  >
    <div v-if="subjectStart" class="subject-divider">
      <span>{{ subjectNumber || 1 }}과목</span>
      <strong>{{ item.subject }}</strong>
    </div>

    <header class="question-head">
      <div v-if="showQuestionIdentity" class="question-current-identity">
        <span>현재 문제</span>
        <strong>{{ displayNumber }}번</strong>
      </div>
      <span v-else class="question-head-spacer" aria-hidden="true"></span>
      <span v-if="displayNumber && displayNumber !== item.question.number" class="source-chip">원문 {{ item.question.number }}번</span>
      <span v-if="!subjectStart" class="source-chip subject-source-chip">{{ item.subject }}</span>
      <span v-if="item.question.answerRate" class="answer-rate">정답률 {{ item.question.answerRate }}%</span>
      <span v-if="fieldReportQuestion" class="source-chip field-report-source-chip">비공식 제보 재구성</span>
      <span v-else-if="restoredQuestion" class="source-chip">CBT 복원문제{{ primaryImage ? ' · 원문 이미지' : '' }}</span>
      <span v-else-if="hansolQuestion" class="source-chip hansol-source-chip">한솔아카데미 원문</span>
      <span v-if="item.question.targetMapping" class="source-chip target-source-chip">
        {{ item.question.targetRelevance === 'core' ? '직접 연계' : '유사 보강' }} · {{ item.question.sourceQualification }}
      </span>
      <button v-if="mode === 'learn'" type="button" class="ai-question-button" @click="$emit('askAi')">✦ AI 질문</button>
      <button
        type="button"
        class="bookmark-button"
        :class="{ active: bookmarked }"
        :aria-label="bookmarked ? '북마크 제거' : '북마크 추가'"
        @click="$emit('toggleBookmark')"
      >★</button>
      <button
        type="button"
        class="keep-button"
        :class="{ active: kept }"
        :aria-label="kept ? '현재 문제 킵 해제' : '현재 문제를 나중에 다시 보기'"
        :aria-pressed="kept"
        @click="$emit('toggleKeep')"
      >{{ kept ? 'KEEP' : '킵' }}</button>
    </header>

    <div class="question-content" :class="{ 'source-image-content': primaryImage }">
      <div
        v-if="primaryImage && item.question.sourceImage"
        class="source-image-frame"
      >
        <div class="source-image-stage">
          <img
            ref="sourceImageRef"
            class="source-question-image"
            :class="[restoredImageClass, { 'hansol-source-image': hansolQuestion }]"
            :src="item.question.sourceImage"
            :alt="`${item.question.number}번 문제 원문`"
            loading="lazy"
            decoding="async"
            @load="calculateAnswerHighlights($event.currentTarget as HTMLImageElement)"
          >
          <button
            v-for="hotspot in unifiedHotspots"
            :key="hotspot.choice"
            type="button"
            class="image-answer-hotspot"
            :class="choiceClass(hotspot.choice - 1)"
            :style="hotspotStyle(hotspot)"
            :aria-label="`이미지에서 ${hotspot.choice}번 선택`"
            @click="$emit('choose', hotspot.choice)"
          ></button>
          <span
            v-if="selected && hotspotIndicator === 'marker' && selectedMarkerStyle"
            class="image-answer-pick-marker"
            :class="selectedAnswerState"
            :style="selectedMarkerStyle"
            aria-hidden="true"
          >✓</span>
          <span
            v-for="(highlightStyle, highlightIndex) in selected && hotspotIndicator === 'area' ? selectedAreaHighlightStyles : []"
            :key="`${selected}-${highlightIndex}`"
            class="image-answer-area-highlight"
            :class="selectedAnswerState"
            :style="highlightStyle"
            aria-hidden="true"
          ></span>
        </div>
        <div class="source-image-actions">
          <small v-if="verifiedHotspots.length && selected" class="source-image-selected-answer">
            <strong>{{ circles[selected - 1] || selected }}번 선택됨</strong>
            <span>같은 답을 다시 누르면 취소</span>
          </small>
          <small v-else-if="verifiedHotspots.length"><span aria-hidden="true">☝</span> 이미지의 ①·②·③·④를 눌러 답하세요</small>
          <span v-else></span>
          <button
            type="button"
            class="source-image-zoom-hint"
            :aria-label="`${item.question.number}번 문제 원문 크게 보기`"
            @click="imageZoomOpen = true"
          >⌕ 크게 보기</button>
        </div>
      </div>
      <template v-else>
        <div class="compact-question-copy">
          <strong class="compact-question-number">{{ displayNumber || item.question.number }}.</strong>
          <div class="question-text" v-html="displayedQuestionMarkup" />
        </div>
        <img
          v-for="image in item.question.images || []"
          :key="image"
          class="question-image"
          :class="restoredImageClass"
          :src="image"
          alt="문제 참고 그림"
          loading="lazy"
          decoding="async"
        >
      </template>
    </div>

    <div v-if="!verifiedHotspots.length" class="choice-grid-shell">
      <div
        class="choice-grid"
        :class="{
          'image-choice-grid': primaryImage && (answerLayout !== 'inline' || !hasReadableChoices),
          'image-inline-choice-grid': primaryImage && answerLayout === 'inline' && hasReadableChoices,
          'compact-choice-grid': twoColumnTextChoices,
          'compact-visual-choice-grid': compactVisualChoices,
          'combat-dense-choice-grid': combatDenseChoices,
          'combat-ultra-choice-grid': combatUltraShortChoices,
        }"
      >
        <button
          v-for="(choice, index) in item.question.choices"
          :key="index"
          type="button"
          class="choice-button"
          :class="choiceClass(index)"
          :aria-pressed="selected === index + 1"
          :aria-label="primaryImage ? `${index + 1}번 ${choice.text || '답안'} 선택` : undefined"
          @click="$emit('choose', index + 1)"
        >
          <span class="choice-number">{{ circles[index] || index + 1 }}</span>
          <span v-if="!primaryImage || (answerLayout === 'inline' && hasReadableChoice(choice, index))" class="choice-copy">
            <span v-html="displayedChoices[index]" />
            <img v-for="image in choice.images || []" :key="image" :class="restoredImageClass" :src="image" alt="보기 그림" loading="lazy" decoding="async">
          </span>
          <b v-if="mode === 'learn' && selected === index + 1">{{ correctSelected ? '정답' : '다시 확인' }}</b>
        </button>
      </div>
      <div v-if="compactTextChoices" ref="choiceLayoutProbeRef" class="choice-grid compact-choice-grid choice-layout-probe" aria-hidden="true">
        <div v-for="(choice, index) in item.question.choices" :key="index" class="choice-button">
          <span class="choice-number">{{ circles[index] || index + 1 }}</span>
          <span class="choice-copy"><span v-html="displayedChoices[index]" /></span>
        </div>
      </div>
    </div>

    <div v-if="mode === 'learn' && selected && !correctSelected" class="retry-message">
      <strong>아직 정답이 아닙니다.</strong>
      <span>다른 보기를 선택해 보세요. 정답과 해설은 맞힌 뒤 표시됩니다.</span>
    </div>

    <details v-if="experimentalFeatures" class="beta-question-tools">
      <summary>
        <span><b>BETA</b><strong>내 판단·메모</strong></span>
        <small>{{ confidence === 'sure' ? '확신' : confidence === 'unsure' ? '애매' : confidence === 'guess' ? '찍음' : studyNote ? '메모 있음' : '열기' }}</small>
      </summary>
      <div class="beta-question-tools-body">
        <button v-if="canReadQuestion" type="button" class="beta-read-aloud" @click="toggleQuestionSpeech">{{ speechSpeaking ? '■ 읽기 멈춤' : '🔊 문제와 보기 읽어주기' }}</button>
        <section v-if="selected" class="beta-confidence-tools">
          <span>이 답을 고를 때</span>
          <div>
            <button type="button" :class="{ active: confidence === 'sure' }" @click="$emit('setConfidence', 'sure')">✓ 확신</button>
            <button type="button" :class="{ active: confidence === 'unsure' }" @click="$emit('setConfidence', 'unsure')">△ 애매</button>
            <button type="button" :class="{ active: confidence === 'guess' }" @click="$emit('setConfidence', 'guess')">? 찍음</button>
          </div>
        </section>
        <section v-if="selected" class="beta-mistake-tools">
          <span>다시 볼 이유</span>
          <div>
            <button type="button" :class="{ active: mistakeReason === 'concept' }" @click="$emit('setMistakeReason', 'concept')">개념</button>
            <button type="button" :class="{ active: mistakeReason === 'formula' }" @click="$emit('setMistakeReason', 'formula')">공식·계산</button>
            <button type="button" :class="{ active: mistakeReason === 'unit' }" @click="$emit('setMistakeReason', 'unit')">단위</button>
            <button type="button" :class="{ active: mistakeReason === 'careless' }" @click="$emit('setMistakeReason', 'careless')">잘못 읽음</button>
          </div>
        </section>
        <label class="beta-study-note">
          <span>내 메모 <small>기기 간 동기화 대상 · 500자</small></span>
          <textarea
            :value="studyNote || ''"
            rows="2"
            maxlength="500"
            placeholder="예: 101.325는 1기압을 kPa로 쓴 값"
            @input="$emit('updateStudyNote', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>
      </div>
    </details>

    <button
      v-if="mode === 'learn' && correctSelected && (explanationDismissed || (compactSolveLayout && !inlineCompactExplanation))"
      type="button"
      class="compact-explanation-trigger"
      @click="reopenExplanation"
    ><span>정답 {{ item.question.answer }}번</span><strong>해설 다시 보기</strong><small>열기</small></button>

    <div v-if="mode === 'learn' && correctSelected && !explanationDismissed && (!compactSolveLayout || inlineCompactExplanation)" class="explanation-box" :class="{ 'comcbt-inline-explanation': inlineCompactExplanation }">
      <div class="explanation-title">
        <span>정답 {{ item.question.answer }}번</span>
        <strong>정답 해설</strong>
        <small v-if="explanationAutoCloseSeconds" class="explanation-auto-close">{{ explanationAutoCloseSeconds }}초 후 자동 닫힘</small>
        <button type="button" class="explanation-close-button" aria-label="해설 닫기" @click="closeInlineExplanation">닫기 ×</button>
      </div>
      <p v-if="primaryExplanationText" class="explanation-copy beginner-primary-explanation"><strong>쉬운 핵심</strong>{{ primaryExplanationText }}</p>
      <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
      <div class="explanation-extra-actions">
        <button v-if="beginnerCalculationAvailable" type="button" class="explanation-extra-toggle" :aria-expanded="beginnerCalculationOpen" @click="stopExplanationAutoClose(); beginnerCalculationOpen = !beginnerCalculationOpen">
          <span>∑</span><strong>쉽게 풀어보기</strong><b>{{ beginnerCalculationOpen ? '−' : '＋' }}</b>
        </button>
      </div>
      <div v-if="beginnerCalculationOpen && beginnerCalculationAvailable" class="calculation-explanation beginner-calculation-explanation">
        <div><span>공식</span><p><strong>{{ calculationGuide.formula }}</strong></p></div>
        <div><span>왜?</span><p>{{ calculationGuide.reason }}</p></div>
        <div v-if="calculationGuide.symbols"><span>기호</span><p>{{ calculationGuide.symbols }}</p></div>
        <div v-if="calculationNumberOrigins.length"><span>숫자 출처</span><p><span v-for="origin in calculationNumberOrigins" :key="origin" class="number-origin-line">{{ origin }}</span></p></div>
        <div v-if="calculationGuide.substitution"><span>계산 순서</span><p>{{ calculationGuide.substitution }}</p></div>
        <div v-if="calculationGuide.unitTip"><span>단위 확인</span><p>{{ calculationGuide.unitTip }}</p></div>
      </div>
      <details v-for="(section, index) in additionalExplanationSections" :key="`${section.source}-${index}`" class="source-explanation-details" @toggle="stopExplanationAutoClose">
        <summary><span>추가 해설</span><strong>{{ section.label }}</strong><b>열기</b></summary>
        <small>{{ section.source }}</small>
        <p>{{ section.text }}</p>
      </details>
    </div>

    <Teleport to="body">
      <div
        v-if="explanationOpen && compactSolveLayout && !inlineCompactExplanation && mode === 'learn' && correctSelected"
        class="compact-explanation-backdrop"
        :class="{ 'combat-explanation': solveLayout === 'combat' }"
        role="dialog"
        aria-modal="true"
        :aria-label="`${item.question.number}번 해설`"
        @click.self="closeCompactExplanation"
      >
        <section class="compact-explanation-panel">
          <header>
            <div><span>{{ solveLayout === 'combat' ? 'MISSION DEBRIEF' : `${item.subject} · ${displayNumber || item.question.number}번` }}</span><strong>정답 해설</strong></div>
            <button type="button" aria-label="해설 닫기" @click="closeCompactExplanation">×</button>
          </header>
          <div class="compact-explanation-scroll">
            <div class="explanation-title">
              <span>정답 {{ item.question.answer }}번</span>
              <strong>핵심부터 차근차근 확인하세요</strong>
              <small v-if="explanationAutoCloseSeconds" class="explanation-auto-close">{{ explanationAutoCloseSeconds }}초 후 자동 닫힘</small>
            </div>
            <p v-if="primaryExplanationText" class="explanation-copy beginner-primary-explanation"><strong>쉬운 핵심</strong>{{ primaryExplanationText }}</p>
            <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
            <div class="explanation-extra-actions">
              <button v-if="beginnerCalculationAvailable" type="button" class="explanation-extra-toggle" :aria-expanded="beginnerCalculationOpen" @click="stopExplanationAutoClose(); beginnerCalculationOpen = !beginnerCalculationOpen">
                <span>∑</span><strong>쉽게 풀어보기</strong><b>{{ beginnerCalculationOpen ? '−' : '＋' }}</b>
              </button>
            </div>
            <div v-if="beginnerCalculationOpen && beginnerCalculationAvailable" class="calculation-explanation beginner-calculation-explanation">
              <div><span>공식</span><p><strong>{{ calculationGuide.formula }}</strong></p></div>
              <div><span>왜?</span><p>{{ calculationGuide.reason }}</p></div>
              <div v-if="calculationGuide.symbols"><span>기호</span><p>{{ calculationGuide.symbols }}</p></div>
              <div v-if="calculationNumberOrigins.length"><span>숫자 출처</span><p><span v-for="origin in calculationNumberOrigins" :key="origin" class="number-origin-line">{{ origin }}</span></p></div>
              <div v-if="calculationGuide.substitution"><span>계산 순서</span><p>{{ calculationGuide.substitution }}</p></div>
              <div v-if="calculationGuide.unitTip"><span>단위 확인</span><p>{{ calculationGuide.unitTip }}</p></div>
            </div>
            <details v-for="(section, index) in additionalExplanationSections" :key="`${section.source}-${index}`" class="source-explanation-details" @toggle="stopExplanationAutoClose">
              <summary><span>추가 해설</span><strong>{{ section.label }}</strong><b>열기</b></summary>
              <small>{{ section.source }}</small>
              <p>{{ section.text }}</p>
            </details>
          </div>
          <footer><span>다른 문제는 밀리지 않습니다.</span><button type="button" @click="closeCompactExplanation">문제로 돌아가기</button></footer>
        </section>
      </div>
      <div
        v-if="imageZoomOpen && item.question.sourceImage"
        class="question-image-lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="`${item.question.number}번 문제 원문 확대`"
        @click="imageZoomOpen = false"
      >
        <header @click.stop>
          <strong>{{ item.question.number }}번 원문 이미지</strong>
          <span>확대된 원본을 스크롤해서 확인하세요.</span>
          <button type="button" aria-label="확대 이미지 닫기" @click="imageZoomOpen = false">×</button>
        </header>
        <div @click.self="imageZoomOpen = false">
          <img :class="[restoredImageClass, { 'hansol-source-image': hansolQuestion }]" :src="item.question.sourceImage" :alt="`${item.question.number}번 문제 원문 확대`">
        </div>
      </div>
    </Teleport>
  </article>
</template>
