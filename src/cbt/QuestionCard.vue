<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { hotspotStyle, unifiedAnswerHotspots } from './answerHotspotGeometry';
import { isImagePrimary } from './catalog';
import { calculationGuideFor, calculationSource } from './calculationGuide';
import type { QuestionItem, StudyMode } from './types';

const props = defineProps<{
  item: QuestionItem;
  selected?: number;
  mode: StudyMode;
  subjectStart?: boolean;
  subjectNumber?: number;
  bookmarked?: boolean;
  kept?: boolean;
  calculationMode?: boolean;
  imageAnswerMode?: 'buttons' | 'hotspot';
  answerLayout?: 'classic' | 'inline' | 'hotspot';
  hotspotIndicator?: 'marker' | 'area';
  restoredImageTheme?: 'auto' | 'original';
  solveLayout?: 'standard' | 'comcbt' | 'combat';
  active?: boolean;
}>();

defineEmits<{
  choose: [choice: number];
  toggleBookmark: [];
  toggleKeep: [];
  askAi: [];
  activate: [];
}>();

const primaryImage = computed(() => isImagePrimary(props.item));
const hansolQuestion = computed(() => props.item.round.qualificationKey === 'hvac-hansol');
const restoredQuestion = computed(() =>
  props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const restoredImageClass = computed(() => restoredQuestion.value
  ? `restored-image-${props.restoredImageTheme || 'auto'}`
  : undefined);
const correctSelected = computed(() => props.selected === props.item.question.answer);
const calculationGuide = computed(() => calculationGuideFor(props.item));
const calculationValues = computed(() => calculationSource(props.item).match(/-?\d+(?:\.\d+)?\s*(?:kW|W|kcal\/h|kcal|kg\/s|kg\/h|kg|m³\/s|m³\/min|m³\/h|m³|m²|m\/s|mm|cm|m|kPa|MPa|Pa|bar|℃|K|V|A|Ω|%|rpm)/gi)?.slice(0, 8) || []);
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
const circles = ['①', '②', '③', '④'];

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
  const lengths = props.item.question.choices.map((choice) => (choice.text || choice.html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length);
  return lengths.length === 4
    && Math.max(...lengths) <= 34
    && lengths.reduce((sum, length) => sum + length, 0) <= 96;
});
const compactSolveLayout = computed(() => props.solveLayout === 'comcbt');
const combatDenseChoices = computed(() => {
  if ((props.solveLayout !== 'comcbt' && props.solveLayout !== 'combat')
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
watch(() => [props.item.id, props.selected, props.solveLayout], () => {
  explanationOpen.value = Boolean(
    props.mode === 'learn'
    && correctSelected.value
    && compactSolveLayout.value,
  );
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
      <div v-if="!compactSolveLayout || primaryImage">
        <span class="question-subject">{{ item.subject }}</span>
        <strong>{{ item.question.number }}번</strong>
      </div>
      <span v-if="item.question.answerRate" class="answer-rate">정답률 {{ item.question.answerRate }}%</span>
      <span v-if="restoredQuestion" class="source-chip">CBT 복원문제{{ primaryImage ? ' · 원문 이미지' : '' }}</span>
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
        v-if="mode === 'exam'"
        type="button"
        class="keep-button"
        :class="{ active: kept }"
        :aria-label="kept ? '현재 시험 킵 해제' : '현재 시험에서 나중에 풀기'"
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
          <strong class="compact-question-number">{{ item.question.number }}.</strong>
          <div class="question-text" v-html="item.question.html || item.question.text" />
        </div>
        <img
          v-for="image in item.question.images || []"
          :key="image"
          class="question-image"
          :src="image"
          alt="문제 참고 그림"
          loading="lazy"
          decoding="async"
        >
      </template>
    </div>

    <div
      v-if="!verifiedHotspots.length"
      class="choice-grid"
      :class="{
        'image-choice-grid': primaryImage && (answerLayout !== 'inline' || !hasReadableChoices),
        'image-inline-choice-grid': primaryImage && answerLayout === 'inline' && hasReadableChoices,
        'compact-choice-grid': compactTextChoices,
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
          <span v-html="choice.html || choice.text || `${index + 1}번`" />
          <img v-for="image in choice.images || []" :key="image" :src="image" alt="보기 그림" loading="lazy" decoding="async">
        </span>
        <b v-if="mode === 'learn' && selected === index + 1">{{ correctSelected ? '정답' : '다시 확인' }}</b>
      </button>
    </div>

    <div v-if="mode === 'learn' && selected && !correctSelected" class="retry-message">
      <strong>아직 정답이 아닙니다.</strong>
      <span>다른 보기를 선택해 보세요. 정답과 해설은 맞힌 뒤 표시됩니다.</span>
    </div>

    <button
      v-if="mode === 'learn' && correctSelected && compactSolveLayout"
      type="button"
      class="compact-explanation-trigger"
      @click="explanationOpen = true"
    ><span>정답 {{ item.question.answer }}번</span><strong>해설 다시 보기</strong><small v-if="solveLayout === 'comcbt'">E 키</small><small v-else>자동 열림</small></button>

    <div v-if="mode === 'learn' && correctSelected && !compactSolveLayout" class="explanation-box">
      <div class="explanation-title">
        <span>정답 {{ item.question.answer }}번</span>
        <strong>쉽게 풀어보기</strong>
      </div>
      <div v-if="calculationMode" class="calculation-explanation">
        <div><span>1</span><p><strong>무엇을 구하나요?</strong>{{ calculationGuide.goal }}</p></div>
        <div><span>2</span><p><strong>사용할 공식</strong>{{ calculationGuide.formula }}</p></div>
        <div><span>3</span><p><strong>기호의 뜻</strong>{{ calculationGuide.symbols }}</p></div>
        <div><span>4</span><p><strong>왜 이 공식을 쓰나요?</strong>{{ calculationGuide.reason }}</p></div>
        <div><span>5</span><p><strong>숫자 넣기</strong>{{ calculationValues.length ? `문제에서 찾은 ${calculationValues.join(', ')}를 같은 단위로 맞춘 뒤 공식의 해당 자리에 넣습니다.` : '문제에서 주어진 숫자를 표시하고, 각 기호 자리에 하나씩 넣습니다.' }}</p></div>
        <div><span>6</span><p><strong>계산과 단위</strong>{{ calculationGuide.unitTip }} 계산이 끝나면 보기의 값과 단위를 함께 비교해 정답 {{ item.question.answer }}번을 확인합니다.</p></div>
      </div>
      <div
        v-if="item.question.explanationHtml"
        class="explanation-copy"
        v-html="item.question.explanationHtml"
      />
      <p v-else-if="item.question.explanation" class="explanation-copy">{{ item.question.explanation }}</p>
      <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
    </div>

    <Teleport to="body">
      <div
        v-if="explanationOpen && compactSolveLayout && mode === 'learn' && correctSelected"
        class="compact-explanation-backdrop"
        :class="{ 'combat-explanation': solveLayout === 'combat' }"
        role="dialog"
        aria-modal="true"
        :aria-label="`${item.question.number}번 해설`"
        @click.self="explanationOpen = false"
      >
        <section class="compact-explanation-panel">
          <header>
            <div><span>{{ solveLayout === 'combat' ? 'MISSION DEBRIEF' : `${item.subject} · ${item.question.number}번` }}</span><strong>쉽게 풀어보기</strong></div>
            <button type="button" aria-label="해설 닫기" @click="explanationOpen = false">×</button>
          </header>
          <div class="compact-explanation-scroll">
            <div class="explanation-title"><span>정답 {{ item.question.answer }}번</span><strong>핵심부터 차근차근 확인하세요</strong></div>
            <div v-if="calculationMode" class="calculation-explanation">
              <div><span>1</span><p><strong>무엇을 구하나요?</strong>{{ calculationGuide.goal }}</p></div>
              <div><span>2</span><p><strong>사용할 공식</strong>{{ calculationGuide.formula }}</p></div>
              <div><span>3</span><p><strong>기호의 뜻</strong>{{ calculationGuide.symbols }}</p></div>
              <div><span>4</span><p><strong>왜 이 공식을 쓰나요?</strong>{{ calculationGuide.reason }}</p></div>
              <div><span>5</span><p><strong>숫자 넣기</strong>{{ calculationValues.length ? `문제에서 찾은 ${calculationValues.join(', ')}를 같은 단위로 맞춘 뒤 공식의 해당 자리에 넣습니다.` : '문제에서 주어진 숫자를 표시하고, 각 기호 자리에 하나씩 넣습니다.' }}</p></div>
              <div><span>6</span><p><strong>계산과 단위</strong>{{ calculationGuide.unitTip }} 계산이 끝나면 보기의 값과 단위를 함께 비교해 정답 {{ item.question.answer }}번을 확인합니다.</p></div>
            </div>
            <div v-if="item.question.explanationHtml" class="explanation-copy" v-html="item.question.explanationHtml" />
            <p v-else-if="item.question.explanation" class="explanation-copy">{{ item.question.explanation }}</p>
            <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
          </div>
          <footer><span>다른 문제는 밀리지 않습니다.</span><button type="button" @click="explanationOpen = false">문제로 돌아가기</button></footer>
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
