<script setup lang="ts">
import { computed, ref } from 'vue';
import { isImagePrimary } from './catalog';
import type { QuestionItem, StudyMode } from './types';

const props = defineProps<{
  item: QuestionItem;
  selected?: number;
  mode: StudyMode;
  subjectStart?: boolean;
  subjectNumber?: number;
  bookmarked?: boolean;
}>();

defineEmits<{
  choose: [choice: number];
  toggleBookmark: [];
  askAi: [];
}>();

const primaryImage = computed(() => isImagePrimary(props.item));
const restoredQuestion = computed(() =>
  props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const correctSelected = computed(() => props.selected === props.item.question.answer);
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
    </header>

    <div class="question-content" :class="{ 'source-image-content': primaryImage }">
      <div
        v-if="primaryImage && item.question.sourceImage"
        class="source-image-frame"
      >
        <img
          class="source-question-image"
          :src="item.question.sourceImage"
          :alt="`${item.question.number}번 문제 원문`"
        >
        <button
          type="button"
          class="source-image-zoom-hint"
          :aria-label="`${item.question.number}번 문제 원문 크게 보기`"
          @click="imageZoomOpen = true"
        >⌕ 크게 보기</button>
      </div>
      <template v-else>
        <div class="question-text" v-html="item.question.html || item.question.text" />
        <img
          v-for="image in item.question.images || []"
          :key="image"
          class="question-image"
          :src="image"
          alt="문제 참고 그림"
        >
      </template>
    </div>

    <div class="choice-grid" :class="{ 'image-choice-grid': restoredQuestion && primaryImage }">
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
          <img v-for="image in choice.images || []" :key="image" :src="image" alt="보기 그림">
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
