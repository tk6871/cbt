<script setup lang="ts">
import { computed } from 'vue';
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
}>();

const primaryImage = computed(() => isImagePrimary(props.item));
const restoredQuestion = computed(() =>
  props.item.round.qualificationKey === 'hvac' && Number(props.item.round.year) >= 2021);
const correctSelected = computed(() => props.selected === props.item.question.answer);
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
  <article class="question-card">
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
      <button
        type="button"
        class="bookmark-button"
        :class="{ active: bookmarked }"
        :aria-label="bookmarked ? '북마크 제거' : '북마크 추가'"
        @click="$emit('toggleBookmark')"
      >★</button>
    </header>

    <div class="question-content">
      <img
        v-if="primaryImage && item.question.sourceImage"
        class="source-question-image"
        :src="item.question.sourceImage"
        :alt="`${item.question.number}번 문제 원문`"
      >
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

    <div class="choice-grid">
      <button
        v-for="(choice, index) in item.question.choices"
        :key="index"
        type="button"
        class="choice-button"
        :class="choiceClass(index)"
        :aria-pressed="selected === index + 1"
        @click="$emit('choose', index + 1)"
      >
        <span class="choice-number">{{ circles[index] || index + 1 }}</span>
        <span class="choice-copy">
          <span v-if="restoredQuestion && primaryImage">{{ index + 1 }}번 선택</span>
          <template v-else>
            <span v-html="choice.html || choice.text || `${index + 1}번`" />
            <img v-for="image in choice.images || []" :key="image" :src="image" alt="보기 그림">
          </template>
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
  </article>
</template>
