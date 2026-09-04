<script setup lang="ts">
import { computed, ref } from 'vue';
import type {
  PracticalAssessment,
  PracticalConfidence,
  PracticalMistakeReason,
  PracticalPrompt,
} from './hvacPracticalTypes';
import {
  criterionMatchesDraft,
  maskPracticalAnswer,
  practicalAnswerTemplate,
  practicalCategoryHint,
  practicalCriteria,
  practicalExpectedNumbers,
  practicalExpectedUnits,
  practicalInitialHint,
  practicalRequirementLines,
} from './hvacPracticalTraining';

const props = defineProps<{
  prompt: PracticalPrompt;
  draft: string;
  revealed: boolean;
  assessment?: PracticalAssessment;
  similarCount: number;
}>();

const emit = defineEmits<{
  update: [assessment: PracticalAssessment];
  insertTemplate: [template: string];
  reveal: [];
}>();

const guideOpen = ref(false);
const checklistOpen = ref(false);
const blankOpen = ref(false);
const speechListening = ref(false);

const criteria = computed(() => practicalCriteria(props.prompt));
const requirements = computed(() => practicalRequirementLines(props.prompt));
const units = computed(() => practicalExpectedUnits(props.prompt));
const numbers = computed(() => practicalExpectedNumbers(props.prompt));
const checkedIds = computed(() => props.assessment?.checkedPointIds || []);
const autoMatchedIds = computed(() => criteria.value.filter((criterion) => criterionMatchesDraft(criterion, props.draft)).map((criterion) => criterion.id));
const effectiveIds = computed(() => [...new Set([...checkedIds.value, ...autoMatchedIds.value])]);
const score = computed(() => criteria.value.length
  ? Math.round((effectiveIds.value.length / criteria.value.length) * props.prompt.points * 2) / 2
  : (props.assessment?.score || 0));
const unitCheck = computed(() => units.value.map((unit) => ({ unit, found: props.draft.toLocaleLowerCase('ko').includes(unit.toLocaleLowerCase('ko')) })));
const numberCheck = computed(() => numbers.value.map((number) => ({ number, found: props.draft.includes(number) })));
const requiredAnswerCount = computed(() => Number(props.prompt.question.match(/(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/)?.[1] || 0));
const writtenAnswerCount = computed(() => props.draft.split(/\n|[.;。]/).map((line) => line.trim()).filter((line) => line.length >= 2).length);
const countWarning = computed(() => requiredAnswerCount.value > 0 && writtenAnswerCount.value < requiredAnswerCount.value);
const rangeWarning = computed(() => {
  const expected = numbers.value.map(Number).filter((value) => Number.isFinite(value) && value !== 0);
  const written = (props.draft.match(/(?<![a-z가-힣])\d+(?:\.\d+)?/gi) || []).map(Number).filter((value) => Number.isFinite(value) && value !== 0);
  if (!expected.length || !written.length) return '';
  const finalWritten = written.at(-1)!;
  const closestRatio = Math.min(...expected.map((value) => Math.max(finalWritten, value) / Math.min(finalWritten, value)));
  return closestRatio >= 10 ? '최종 숫자의 자리수가 모범답안과 크게 다릅니다. 소수점·단위 환산을 확인하세요.' : '';
});
const missingCriteria = computed(() => criteria.value.filter((criterion) => !effectiveIds.value.includes(criterion.id)));
const scoreTips = computed(() => {
  const tips: string[] = [];
  if (criteria.value.some((criterion) => criterion.kind === 'formula')) tips.push('공식을 먼저 쓰면 최종 숫자가 틀려도 계산 과정 점수를 받을 수 있습니다.');
  if (criteria.value.some((criterion) => criterion.kind === 'unit')) tips.push('마지막 숫자 뒤에 단위를 크게 써서 단위 점수를 놓치지 마세요.');
  if (criteria.value.some((criterion) => criterion.kind === 'diagram')) tips.push('도면은 기호·연결선·흐름 방향을 각각 확인하세요.');
  const count = props.prompt.question.match(/(\d+)\s*(가지|개|항목|종류|방법|원인|대책)/)?.[1];
  if (count) tips.push(`${count}개를 요구하므로 답안 번호도 ${count}개까지 먼저 적어 두세요.`);
  if (!tips.length) tips.push('완전한 문장보다 채점 핵심어를 먼저 적어 부분점수를 확보하세요.');
  return tips;
});

const mistakeOptions: Array<{ key: PracticalMistakeReason; label: string }> = [
  { key: 'formula', label: '공식' },
  { key: 'substitution', label: '대입' },
  { key: 'calculation', label: '계산' },
  { key: 'unit', label: '단위' },
  { key: 'keyword', label: '핵심어' },
  { key: 'count', label: '개수 누락' },
  { key: 'diagram', label: '도면' },
  { key: 'time', label: '시간 부족' },
];

function update(patch: Partial<PracticalAssessment>): void {
  emit('update', { ...(props.assessment || {}), ...patch });
}

function nextHint(): void {
  const next = Math.min(3, (props.assessment?.hintLevel || 0) + 1);
  update({ hintLevel: next, firstStartedAt: props.assessment?.firstStartedAt || Date.now() });
}

function hintText(): string {
  const level = props.assessment?.hintLevel || 0;
  if (level <= 1) return `${practicalCategoryHint(props.prompt)} 첫 글자: ${practicalInitialHint(props.prompt)}`;
  if (level === 2) return criteria.value.map((criterion) => criterion.label).join(' · ');
  return practicalAnswerTemplate(props.prompt);
}

function toggleCriterion(id: string): void {
  const current = checkedIds.value;
  const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  const nextEffective = new Set([...next, ...autoMatchedIds.value]);
  const nextScore = criteria.value.length ? Math.round((nextEffective.size / criteria.value.length) * props.prompt.points * 2) / 2 : 0;
  update({ checkedPointIds: next, score: nextScore, lastGradedAt: Date.now() });
}

function toggleMistake(reason: PracticalMistakeReason): void {
  const current = props.assessment?.mistakeReasons || [];
  update({ mistakeReasons: current.includes(reason) ? current.filter((value) => value !== reason) : [...current, reason] });
}

function setConfidence(confidence: PracticalConfidence): void {
  update({ confidence });
}

function insertRetrySheet(): void {
  const lines = missingCriteria.value.length
    ? missingCriteria.value.map((criterion, index) => `${index + 1}. ${criterion.label}: `)
    : ['빠진 채점 요소가 없습니다. 전체 답을 보지 않고 한 번 더 작성하세요.'];
  emit('insertTemplate', `[오답 수술 · 빠진 부분만 다시 쓰기]\n${lines.join('\n')}`);
}

function speakQuestion(): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(props.prompt.question);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.94;
  speechSynthesis.speak(utterance);
}

function startSpeechAnswer(): void {
  type RecognitionCtor = new () => {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  };
  const speechWindow = window as typeof window & { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
  if (!Recognition) return;
  const recognition = new Recognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript || '';
    if (transcript) emit('insertTemplate', `${props.draft}${props.draft ? '\n' : ''}[말로 답하기] ${transcript}`);
  };
  recognition.onend = () => { speechListening.value = false; };
  recognition.onerror = () => { speechListening.value = false; };
  speechListening.value = true;
  recognition.start();
}
</script>

<template>
  <section class="practical-training-tools">
    <header>
      <div><strong>답안 작성 도우미</strong><small>힌트를 적게 쓰고 직접 작성할수록 실제 시험에 가까워집니다.</small></div>
      <div>
        <button type="button" @click="speakQuestion">🔊 문제 읽기</button>
        <button type="button" :disabled="speechListening" @click="startSpeechAnswer">{{ speechListening ? '듣는 중…' : '🎙 말로 답하기' }}</button>
      </div>
    </header>

    <div class="practical-requirements">
      <span v-for="line in requirements" :key="line">✓ {{ line }}</span>
      <span>연결된 같은 분야 {{ similarCount }}문제</span>
    </div>

    <div class="practical-helper-actions">
      <button type="button" @click="emit('insertTemplate', practicalAnswerTemplate(prompt))">답안 골격 넣기</button>
      <button type="button" @click="guideOpen = !guideOpen">{{ guideOpen ? '힌트 닫기' : '단계별 힌트' }}</button>
      <button v-if="revealed" type="button" @click="blankOpen = !blankOpen">{{ blankOpen ? '빈칸 닫기' : '빈칸 암기' }}</button>
      <button v-if="revealed" type="button" @click="checklistOpen = !checklistOpen">{{ checklistOpen ? '채점표 닫기' : '부분점수 채점' }}</button>
    </div>

    <details class="practical-score-strategy">
      <summary>시간이 부족할 때 부분점수 확보법</summary>
      <ul><li v-for="tip in scoreTips" :key="tip">{{ tip }}</li></ul>
    </details>

    <div v-if="guideOpen" class="practical-hint-panel">
      <p v-if="assessment?.hintLevel"><b>{{ assessment.hintLevel }}단계 힌트</b>{{ hintText() }}</p>
      <p v-else>아직 힌트를 사용하지 않았습니다.</p>
      <button v-if="(assessment?.hintLevel || 0) < 3" type="button" @click="nextHint">힌트 한 단계 열기</button>
      <button v-else-if="!revealed" type="button" @click="emit('reveal')">모범답안 보기</button>
    </div>

    <div v-if="revealed && blankOpen" class="practical-blank-answer">
      <strong>핵심어 빈칸 복원</strong>
      <p>{{ maskPracticalAnswer(prompt) }}</p>
    </div>

    <div v-if="revealed && checklistOpen" class="practical-rubric-panel">
      <header><div><strong>예상 부분점수 {{ score }} / {{ prompt.points }}점</strong><small>자동 인식은 보조 기능입니다. 표현이 다르면 직접 체크하세요.</small></div></header>
      <div class="practical-rubric-list">
        <button
          v-for="criterion in criteria"
          :key="criterion.id"
          type="button"
          :class="{ matched: effectiveIds.includes(criterion.id), automatic: autoMatchedIds.includes(criterion.id) }"
          @click="toggleCriterion(criterion.id)"
        >
          <span>{{ effectiveIds.includes(criterion.id) ? '✓' : '○' }}</span>
          <b>{{ criterion.label }}</b>
          <small>{{ autoMatchedIds.includes(criterion.id) ? '내 답에서 감지' : '직접 확인' }}</small>
        </button>
      </div>
      <div v-if="unitCheck.length || numberCheck.length" class="practical-value-check">
        <strong>숫자·단위 확인</strong>
        <span v-for="item in numberCheck" :key="`number-${item.number}`" :class="{ found: item.found }">{{ item.found ? '✓' : '○' }} {{ item.number }}</span>
        <span v-for="item in unitCheck" :key="`unit-${item.unit}`" :class="{ found: item.found }">{{ item.found ? '✓' : '○' }} {{ item.unit }}</span>
      </div>
      <p v-if="countWarning || rangeWarning" class="practical-check-warning"><span v-if="countWarning">요구된 {{ requiredAnswerCount }}개 중 현재 답안은 약 {{ writtenAnswerCount }}개로 보입니다.</span><span v-if="rangeWarning">{{ rangeWarning }}</span></p>
      <div class="practical-mistake-picker">
        <strong>이번에 놓친 부분</strong>
        <button v-for="option in mistakeOptions" :key="option.key" type="button" :class="{ active: assessment?.mistakeReasons?.includes(option.key) }" @click="toggleMistake(option.key)">{{ option.label }}</button>
      </div>
      <div class="practical-confidence-picker">
        <strong>답안 확신</strong>
        <button type="button" :class="{ active: assessment?.confidence === 'low' }" @click="setConfidence('low')">막힘</button>
        <button type="button" :class="{ active: assessment?.confidence === 'medium' }" @click="setConfidence('medium')">애매</button>
        <button type="button" :class="{ active: assessment?.confidence === 'high' }" @click="setConfidence('high')">확실</button>
      </div>
      <button type="button" class="practical-retry-missing" @click="insertRetrySheet">빠진 부분만 다시 작성</button>
      <details class="practical-reverse-drill">
        <summary>역문제 훈련</summary>
        <p><b>아래 답이 사용되는 문제 유형을 먼저 말해보세요.</b>{{ prompt.answer }}</p>
      </details>
      <details v-if="assessment?.answerHistory?.length" class="practical-answer-history">
        <summary>이전 답안과 성장 비교 · {{ assessment.answerHistory.length }}회</summary>
        <article v-for="(entry, index) in assessment.answerHistory" :key="entry.gradedAt">
          <header><b>{{ index + 1 }}회 답안</b><span>{{ entry.score }}점 · {{ new Date(entry.gradedAt).toLocaleDateString('ko-KR') }}</span></header>
          <p>{{ entry.draft }}</p>
        </article>
      </details>
    </div>
  </section>
</template>
