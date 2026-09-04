<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import type { FrameworkInfo } from './catalog';

export interface FrameworkAdapter {
  button: Component | string;
  buttonProps: (label: string, role?: 'primary' | 'quiet') => Record<string, unknown>;
  noButtonSlot?: boolean;
  loadedLabel: string;
}

const props = defineProps<{ info: FrameworkInfo; adapter: FrameworkAdapter }>();
const answers = ref<Record<number, number>>({ 1: 2, 2: 0, 3: 4, 4: 0 });
const kept = ref<number[]>([4]);
const showSettings = ref(false);
const showResult = ref(false);
const mode = ref<'study' | 'exam'>('study');

const questions = [
  { no: 1, subject: '공기조화', text: '냉동사이클에서 압축기의 역할로 가장 알맞은 것은?', options: ['냉매를 팽창시킨다', '냉매 증기를 압축한다', '냉매를 응축시킨다', '냉매를 증발시킨다'] },
  { no: 2, subject: '냉동공학', text: '표준대기압에서 물의 끓는점으로 옳은 것은?', options: ['0 ℃', '50 ℃', '100 ℃', '150 ℃'] },
  { no: 3, subject: '공조설비운영', text: '덕트 재료로 가장 널리 사용하는 것은?', options: ['목재', '합성수지', '동판', '아연도금 강판'] },
  { no: 4, subject: '공기조화', text: '나중에 다시 확인할 문제는 킵으로 표시할 수 있습니다.', options: ['확인 완료', '조금 애매함', '다시 계산', '나중에 풀기'] },
];

const answered = computed(() => Object.values(answers.value).filter(Boolean).length);

function choose(question: number, answer: number): void {
  answers.value[question] = answers.value[question] === answer ? 0 : answer;
}

function toggleKeep(question: number): void {
  kept.value = kept.value.includes(question) ? kept.value.filter((item) => item !== question) : [...kept.value, question];
}
</script>

<template>
  <div class="sandbox" :data-framework="info.key">
    <aside class="demo-nav">
      <div class="demo-brand"><i>Q</i><span><strong>통합 CBT</strong><small>{{ info.name }}</small></span></div>
      <nav>
        <button class="active"><b>⌂</b><span>홈</span></button>
        <button><b>▤</b><span>회차별 문제</span></button>
        <button><b>✓</b><span>랜덤 학습</span></button>
        <button><b>☆</b><span>오답·즐겨찾기</span></button>
        <button><b>∑</b><span>계산 문제</span></button>
      </nav>
      <div class="demo-user"><i>SH</i><span><strong>학습자</strong><small>동기화 완료</small></span></div>
    </aside>

    <main class="demo-main">
      <header class="demo-topbar">
        <div><small>공조냉동기계산업기사</small><h1>2026년 2회 학습</h1></div>
        <div class="demo-top-actions">
          <button type="button" @click="mode = mode === 'study' ? 'exam' : 'study'">{{ mode === 'study' ? '학습모드' : 'CBT모드' }}</button>
          <button type="button" @click="showSettings = true">⚙ 설정</button>
        </div>
      </header>

      <section class="demo-stats">
        <article><span>진행률</span><strong>{{ answered }} / 4</strong><i><b :style="{ width: `${answered * 25}%` }" /></i></article>
        <article><span>미응답</span><strong>{{ 4 - answered }}</strong><small>바로 이동 →</small></article>
        <article><span>킵</span><strong>{{ kept.length }}</strong><small>표시한 문제</small></article>
        <article><span>예상 점수</span><strong>{{ answered * 25 }}</strong><small>현재 기준</small></article>
      </section>

      <div class="demo-workspace">
        <section class="demo-questions">
          <article v-for="question in questions" :key="question.no" class="demo-question">
            <header><span>{{ question.subject }}</span><button type="button" :class="{ on: kept.includes(question.no) }" @click="toggleKeep(question.no)">K 킵</button></header>
            <h2><b>{{ question.no }}.</b> {{ question.text }}</h2>
            <div class="demo-answers">
              <button
                v-for="(answer, index) in question.options"
                :key="answer"
                type="button"
                :class="{ selected: answers[question.no] === index + 1 }"
                @click="choose(question.no, index + 1)"
              ><i>{{ index + 1 }}</i><span>{{ answer }}</span></button>
            </div>
            <footer v-if="mode === 'study' && answers[question.no]">
              <b>{{ answers[question.no] === (question.no === 1 ? 2 : question.no === 2 ? 3 : 4) ? '정답입니다' : '다시 생각해 보세요' }}</b>
              <span>선택한 답을 한 번 더 누르면 취소할 수 있습니다.</span>
            </footer>
          </article>
        </section>

        <aside class="demo-omr">
          <header><div><small>ANSWER SHEET</small><strong>OMR 답안표</strong></div><span>{{ answered }}/4</span></header>
          <div class="demo-omr-grid">
            <p v-for="question in questions" :key="question.no"><b>{{ question.no }}</b><button v-for="n in 4" :key="n" :class="{ selected: answers[question.no] === n }" @click="choose(question.no, n)">{{ n }}</button></p>
          </div>
          <component
            :is="adapter.button"
            v-bind="adapter.buttonProps('채점 결과 보기', 'primary')"
            class="adapter-button"
            @click="showResult = true"
          ><template v-if="!adapter.noButtonSlot">채점 결과 보기</template></component>
          <small class="adapter-proof">✓ {{ adapter.loadedLabel }}</small>
        </aside>
      </div>
    </main>

    <div v-if="showSettings" class="demo-modal" @click.self="showSettings = false">
      <section><header><div><small>SETTINGS</small><h2>문제풀이 설정</h2></div><button @click="showSettings = false">×</button></header><label><span>화면 밀도</span><select><option>편안하게</option><option>고밀도 2열</option></select></label><label><span>글꼴</span><select><option>나눔고딕</option><option>D2Coding</option></select></label><label class="demo-switch"><span>동적 UI</span><input type="checkbox" checked></label><component :is="adapter.button" v-bind="adapter.buttonProps('설정 적용', 'primary')" class="adapter-button" @click="showSettings = false"><template v-if="!adapter.noButtonSlot">설정 적용</template></component></section>
    </div>
    <div v-if="showResult" class="demo-modal result" @click.self="showResult = false">
      <section><header><div><small>LEARNING RESULT</small><h2>학습 결과</h2></div><button @click="showResult = false">×</button></header><div class="demo-score">{{ answered * 25 }}<span>점</span></div><p>{{ answered }}문제를 풀었습니다. UI 비교용 화면이므로 실제 기록은 저장하지 않습니다.</p><component :is="adapter.button" v-bind="adapter.buttonProps('계속 풀기', 'primary')" class="adapter-button" @click="showResult = false"><template v-if="!adapter.noButtonSlot">계속 풀기</template></component></section>
    </div>
  </div>
</template>
