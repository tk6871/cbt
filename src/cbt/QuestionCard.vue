<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const fieldReportQuestion = computed(() => props.item.round.kind === 'field-report-practice');
const restoredQuestion = computed(() =>
  !fieldReportQuestion.value && props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const restoredImageClass = computed(() => restoredQuestion.value
  ? `restored-image-${props.restoredImageTheme || 'auto'}`
  : undefined);
const correctSelected = computed(() => props.selected === props.item.question.answer);
const calculationGuide = computed(() => calculationGuideFor(props.item));
const calculationProblem = computed(() => isCalculationItem(props.item));
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
const memoryTipOpen = ref(false);
const circles = ['①', '②', '③', '④'];

function readableText(value = ''): string {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
const showQuestionIdentity = computed(() => primaryImage.value
  && Boolean(props.displayNumber)
  && props.displayNumber !== props.item.question.number);

const correctAnswerText = computed(() => readableText(
  props.item.question.choices[props.item.question.answer - 1]?.text
  || props.item.question.choices[props.item.question.answer - 1]?.html
  || `${props.item.question.answer}번`,
));
const explanationText = computed(() => readableText(
  props.item.question.explanationHtml || props.item.question.explanation || '',
));
const comcbtExplanationText = computed(() => {
  const source = props.item.question.explanation || props.item.question.explanationHtml || '';
  const matched = source.split('[COMCBT 동일 문제 추가 해설]')[1];
  if (matched) return readableText(matched.replace(/\[해설작성자[^\]]*\]/g, ' '));
  const provenance = props.item.question.explanationProvenance || '';
  if (props.item.question.source !== 'comcbt.com' || /local-|ai-reference|beginner-authored/i.test(provenance)) return '';
  return readableText(source.replace(/\[해설작성자[^\]]*\]/g, ' '));
});

function conciseExplanationTip(source: string): string {
  if (!source) return '';
  const pieces = source
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((part) => part.replace(/\[해설작성자[^\]]*\]/g, '').trim())
    .filter((part) => part.length >= 5 && part.length <= 120);
  return pieces.find((part) => /외우|암기|기억|연상|줄임|두문/i.test(part))
    || pieces.find((part) => /→|->|=|비례|반비례/.test(part) && part.length <= 90)
    || '';
}

const memoryTip = computed(() => {
  const stem = readableText(props.item.question.text || props.item.question.html);
  const answer = correctAnswerText.value.slice(0, 90) || `${props.item.question.answer}번`;
  const source = `${stem} ${answer} ${explanationText.value}`;
  const comcbtTip = conciseExplanationTip(comcbtExplanationText.value);
  if (comcbtTip) return `COMCBT 암기말: ${comcbtTip}`;

  const rules: Array<[RegExp, string]> = [
    [/펠티어|제백|seebeck|peltier/i, '제백은 온도차 → 전압, 펠티어는 전류 → 흡열·발열(온도차). 방향을 반대로 짝지어 외우세요.'],
    [/송풍기.*(?:상사|회전수)|(?:풍량|압력|동력).*제곱/i, '풍·압·동 = 1·2·3. 회전수에 대해 풍량 1제곱, 압력 2제곱, 동력 3제곱입니다.'],
    [/송풍기.*(?:지름|직경)/i, '지름 법칙은 풍·압·동 = 3·2·5. 회전수의 1·2·3과 구분하세요.'],
    [/캐비테이션|공동현상/i, '캐비 방지는 “굵·짧·곧·천”: 흡입관은 굵고 짧고 곧게, 펌프 회전은 천천히.'],
    [/아연도금.*덕트|덕트.*아연도금/i, '일반 덕트 = 아연도금 강판. “덕트는 녹 방지 아연”으로 연결하세요.'],
    [/바이오.*클린룸|미생물.*클린룸/i, '사람·약·식품처럼 미생물까지 막으면 바이오 클린룸. “바이오=살아 있는 오염”입니다.'],
    [/활성탄.*(?:냄새|가스)|(?:냄새|가스).*활성탄/i, '활성탄 = 냄새·가스 흡착, HEPA = 미세입자 제거. “탄은 냄새, 헤파는 먼지”로 외우세요.'],
    [/팽창밸브.*(?:적게|닫|조이)/i, '팽창밸브를 조이면 냉매가 적게 들어가므로 증발압력↓·냉동능력↓·과열도↑. “조이면 압·능↓, 과열↑”.'],
    [/역지밸브|체크밸브/i, '역지(체크)밸브 = 한쪽 방향만 통과. “역류를 막는 역지”로 외우세요.'],
    [/시퀀스제어|순서.*제어/i, '미리 정한 순서대로 움직이면 시퀀스. “순서=시퀀스” 한 쌍만 기억하세요.'],
    [/냉동톤|\bUSRT\b|\bJRT\b/i, 'USRT는 3.517kW(3,024kcal/h), JRT는 3,320kcal/h. “미국 3024, 일본 3320”.'],
    [/성능계수|\bCOP\b/i, 'COP = 얻은 냉동효과 ÷ 넣은 압축일. “얻은 것 ÷ 넣은 것”입니다.'],
    [/3상.*전력|전력.*√3|역률/i, '3상 전력 = √3×전압×전류×역률. “루트3·V·I·역률” 순서로 붙여 외우세요.'],
    [/열관류|벽.*열손실/i, '벽 열량은 K·A·ΔT. “관류율×면적×온도차” 세 가지만 묶으세요.'],
    [/유량.*단면적|단면적.*유속/i, '유량 Q = 넓이 A × 속도 v. “넓게, 빠르게 흐를수록 유량이 크다”입니다.'],
  ];
  const curated = rules.find(([pattern]) => pattern.test(source));
  if (curated) return curated[1];
  if (calculationProblem.value) {
    return `공식 한 줄: ${calculationGuide.value.formula} 구할 값과 단위를 먼저 확인한 뒤 이 식에 문제의 숫자를 넣으세요.`;
  }
  const negative = /틀린|옳지 않은|아닌|거리가 먼|해당하지 않는|잘못된/.test(stem);
  return negative
    ? `반대말 문제: ‘틀린 것·아닌 것’을 먼저 찾고, 예외는 ${props.item.question.answer}번 “${answer}”로 연결하세요.`
    : `핵심 연결: “${stem.slice(0, 42)}” → ${props.item.question.answer}번 “${answer}”.`;
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
watch(() => [props.item.id, props.selected, props.solveLayout], () => {
  explanationDismissed.value = false;
  beginnerCalculationOpen.value = false;
  memoryTipOpen.value = false;
  explanationOpen.value = Boolean(
    props.mode === 'learn'
    && correctSelected.value
    && compactSolveLayout.value
    && !inlineCompactExplanation.value,
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
      <div v-if="showQuestionIdentity" class="question-current-identity">
        <span>현재 문제</span>
        <strong>{{ displayNumber }}번</strong>
      </div>
      <span v-else class="question-head-spacer" aria-hidden="true"></span>
      <span v-if="displayNumber && displayNumber !== item.question.number" class="source-chip">원문 {{ item.question.number }}번</span>
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
          <strong class="compact-question-number">{{ displayNumber || item.question.number }}.</strong>
          <div class="question-text" v-html="displayedQuestionMarkup" />
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
          <span v-html="displayedChoices[index]" />
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
      v-if="mode === 'learn' && correctSelected && (explanationDismissed || (compactSolveLayout && !inlineCompactExplanation))"
      type="button"
      class="compact-explanation-trigger"
      @click="explanationDismissed = false; explanationOpen = true"
    ><span>정답 {{ item.question.answer }}번</span><strong>해설 다시 보기</strong><small>열기</small></button>

    <div v-if="mode === 'learn' && correctSelected && !explanationDismissed && (!compactSolveLayout || inlineCompactExplanation)" class="explanation-box" :class="{ 'comcbt-inline-explanation': inlineCompactExplanation }">
      <div class="explanation-title">
        <span>정답 {{ item.question.answer }}번</span>
        <strong>정답 해설</strong>
        <button type="button" class="explanation-close-button" aria-label="해설 닫기" @click="explanationDismissed = true">닫기 ×</button>
      </div>
      <div
        v-if="item.question.explanationHtml"
        class="explanation-copy"
        v-html="item.question.explanationHtml"
      />
      <p v-else-if="item.question.explanation" class="explanation-copy">{{ item.question.explanation }}</p>
      <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
      <div class="explanation-extra-actions">
        <button v-if="calculationMode || calculationProblem" type="button" class="explanation-extra-toggle" :aria-expanded="beginnerCalculationOpen" @click="beginnerCalculationOpen = !beginnerCalculationOpen">
          <span>∑</span><strong>쉽게 풀어보기</strong><b>{{ beginnerCalculationOpen ? '−' : '＋' }}</b>
        </button>
        <button type="button" class="explanation-extra-toggle memory-tip-toggle" :aria-expanded="memoryTipOpen" @click="memoryTipOpen = !memoryTipOpen">
          <span>🧠</span><strong>쉽게 외우기</strong><b>{{ memoryTipOpen ? '−' : '＋' }}</b>
        </button>
      </div>
      <div v-if="beginnerCalculationOpen && (calculationMode || calculationProblem)" class="calculation-explanation beginner-calculation-explanation">
        <div><span>공식</span><p><strong>{{ calculationGuide.formula }}</strong>{{ calculationGuide.reason }}<small>{{ calculationGuide.symbols }}</small></p></div>
        <div v-if="calculationNumberOrigins.length"><span>숫자 출처</span><p><span v-for="origin in calculationNumberOrigins" :key="origin" class="number-origin-line">{{ origin }}</span></p></div>
        <div v-if="calculationGuide.substitution"><span>대입</span><p>{{ calculationGuide.substitution }}<small>{{ calculationGuide.unitTip }}</small></p></div>
      </div>
      <aside v-if="memoryTipOpen" class="memory-tip-content"><p>{{ memoryTip }}</p></aside>
    </div>

    <Teleport to="body">
      <div
        v-if="explanationOpen && compactSolveLayout && !inlineCompactExplanation && mode === 'learn' && correctSelected"
        class="compact-explanation-backdrop"
        :class="{ 'combat-explanation': solveLayout === 'combat' }"
        role="dialog"
        aria-modal="true"
        :aria-label="`${item.question.number}번 해설`"
        @click.self="explanationOpen = false"
      >
        <section class="compact-explanation-panel">
          <header>
            <div><span>{{ solveLayout === 'combat' ? 'MISSION DEBRIEF' : `${item.subject} · ${displayNumber || item.question.number}번` }}</span><strong>정답 해설</strong></div>
            <button type="button" aria-label="해설 닫기" @click="explanationOpen = false">×</button>
          </header>
          <div class="compact-explanation-scroll">
            <div class="explanation-title"><span>정답 {{ item.question.answer }}번</span><strong>핵심부터 차근차근 확인하세요</strong></div>
            <div v-if="item.question.explanationHtml" class="explanation-copy" v-html="item.question.explanationHtml" />
            <p v-else-if="item.question.explanation" class="explanation-copy">{{ item.question.explanation }}</p>
            <p v-else class="explanation-copy">정답과 연결되는 핵심 개념을 문제의 조건과 함께 다시 확인해 보세요.</p>
            <div class="explanation-extra-actions">
              <button v-if="calculationMode || calculationProblem" type="button" class="explanation-extra-toggle" :aria-expanded="beginnerCalculationOpen" @click="beginnerCalculationOpen = !beginnerCalculationOpen">
                <span>∑</span><strong>쉽게 풀어보기</strong><b>{{ beginnerCalculationOpen ? '−' : '＋' }}</b>
              </button>
              <button type="button" class="explanation-extra-toggle memory-tip-toggle" :aria-expanded="memoryTipOpen" @click="memoryTipOpen = !memoryTipOpen">
                <span>🧠</span><strong>쉽게 외우기</strong><b>{{ memoryTipOpen ? '−' : '＋' }}</b>
              </button>
            </div>
            <div v-if="beginnerCalculationOpen && (calculationMode || calculationProblem)" class="calculation-explanation beginner-calculation-explanation">
              <div><span>공식</span><p><strong>{{ calculationGuide.formula }}</strong>{{ calculationGuide.reason }}<small>{{ calculationGuide.symbols }}</small></p></div>
              <div v-if="calculationNumberOrigins.length"><span>숫자 출처</span><p><span v-for="origin in calculationNumberOrigins" :key="origin" class="number-origin-line">{{ origin }}</span></p></div>
              <div v-if="calculationGuide.substitution"><span>대입</span><p>{{ calculationGuide.substitution }}<small>{{ calculationGuide.unitTip }}</small></p></div>
            </div>
            <aside v-if="memoryTipOpen" class="memory-tip-content"><p>{{ memoryTip }}</p></aside>
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
