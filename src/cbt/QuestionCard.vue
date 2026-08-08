<script setup lang="ts">
import { computed, ref } from 'vue';
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
}>();

defineEmits<{
  choose: [choice: number];
  toggleBookmark: [];
  toggleKeep: [];
  askAi: [];
}>();

const primaryImage = computed(() => isImagePrimary(props.item));
const restoredQuestion = computed(() =>
  props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const correctSelected = computed(() => props.selected === props.item.question.answer);
const calculationGuide = computed(() => calculationGuideFor(props.item));
const calculationValues = computed(() => calculationSource(props.item).match(/-?\d+(?:\.\d+)?\s*(?:kW|W|kcal\/h|kcal|kg\/s|kg\/h|kg|m³\/s|m³\/min|m³\/h|m³|m²|m\/s|mm|cm|m|kPa|MPa|Pa|bar|℃|K|V|A|Ω|%|rpm)/gi)?.slice(0, 8) || []);
const verifiedHotspots = computed(() => props.imageAnswerMode === 'hotspot' ? props.item.question.answerHotspots || [] : []);
const imageZoomOpen = ref(false);
const circles = ['①', '②', '③', '④'];

function choiceClass(index: number): Record<string, boolean> {
  const number = index + 1;
  return {
    selected: props.selected === number,
    correct: props.mode === 'learn' && props.selected === number && number === props.item.question.answer,
    wrong: props.mode === 'learn' && props.selected === number && number !== props.item.question.answer,
  };
}
</script>

<template>
  <article class="question-card" :class="{ 'image-primary': primaryImage }">
    <div v-if="subjectStart" class="subject-divider">
      <span>{{ subjectNumber || 1 }}과목</span>
      <strong>{{ item.subject }}</strong>
    </div>

    <header class="question-head">
      <div>
        <span class="question-subject">{{ item.subject }}</span>
        <strong>{{ item.question.number }}번</strong>
      </div>
      <span v-if="item.question.answerRate" class="answer-rate">정답률 {{ item.question.answerRate }}%</span>
      <span v-if="restoredQuestion" class="source-chip">CBT 복원문제{{ primaryImage ? ' · 원문 이미지' : '' }}</span>
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
            class="source-question-image"
            :src="item.question.sourceImage"
            :alt="`${item.question.number}번 문제 원문`"
            loading="lazy"
            decoding="async"
          >
          <button
            v-for="hotspot in verifiedHotspots"
            :key="hotspot.choice"
            type="button"
            class="image-answer-hotspot"
            :class="{ selected: selected === hotspot.choice }"
            :style="{ left: `${hotspot.x}%`, top: `${hotspot.y}%`, width: `${hotspot.width}%`, height: `${hotspot.height}%` }"
            :aria-label="`이미지에서 ${hotspot.choice}번 선택`"
            @click="$emit('choose', hotspot.choice)"
          >{{ hotspot.choice }}</button>
        </div>
        <button
          type="button"
          class="source-image-zoom-hint"
          :aria-label="`${item.question.number}번 문제 원문 크게 보기`"
          @click="imageZoomOpen = true"
        >⌕ 크게 보기</button>
        <small v-if="imageAnswerMode === 'hotspot' && !verifiedHotspots.length" class="hotspot-fallback-note">선택 위치 미검증 · 아래 답안 버튼 사용</small>
      </div>
      <template v-else>
        <div class="question-text" v-html="item.question.html || item.question.text" />
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

    <div v-if="!verifiedHotspots.length" class="choice-grid" :class="{ 'image-choice-grid': restoredQuestion && primaryImage }">
      <button
        v-for="(choice, index) in item.question.choices"
        :key="index"
        type="button"
        class="choice-button"
        :class="choiceClass(index)"
        :aria-pressed="selected === index + 1"
        :aria-label="primaryImage ? `${index + 1}번 선택` : undefined"
        @click="$emit('choose', index + 1)"
      >
        <span class="choice-number">{{ primaryImage ? index + 1 : (circles[index] || index + 1) }}</span>
        <span v-if="!primaryImage" class="choice-copy">
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

    <div v-if="mode === 'learn' && correctSelected" class="explanation-box">
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
          <img :src="item.question.sourceImage" :alt="`${item.question.number}번 문제 원문 확대`">
        </div>
      </div>
    </Teleport>
  </article>
</template>
