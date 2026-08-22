<script setup lang="ts">
import { computed, ref } from 'vue';
import { normalizeSchoolExamData, type SchoolExamData, type SchoolExamKind, type SchoolMemoryCard } from './schoolExam';
import type { Round, StudyMode } from './types';

const props = defineProps<{ data: SchoolExamData }>();
const emit = defineEmits<{
  update: [data: SchoolExamData];
  start: [payload: { round: Round; mode: StudyMode }];
}>();

const importInput = ref<HTMLInputElement | null>(null);
const selectedRoundId = ref(props.data.rounds[0]?.id || '');
const memoryOpenId = ref('');
const subject = ref('');
const year = ref(new Date().getFullYear());
const semester = ref<1 | 2>(1);
const examKind = ref<SchoolExamKind>('midterm');
const textbook = ref('');
const pages = ref('');
const note = ref('');
const questionText = ref('');
const choices = ref(['', '', '', '']);
const answer = ref(1);
const explanation = ref('');
const questionPage = ref('');
const teacherHint = ref('');
const memoryPrompt = ref('');
const memoryAnswer = ref('');
const memoryPage = ref('');
const memoryHint = ref('');

const selectedRound = computed(() => props.data.rounds.find((round) => round.id === selectedRoundId.value) || null);
const kindLabel: Record<SchoolExamKind, string> = { midterm: '중간고사', final: '기말고사', quiz: '쪽지시험', other: '기타 시험' };

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function commit(next: SchoolExamData): void {
  emit('update', normalizeSchoolExamData(next));
}

function scopeFor(round: Round) {
  return props.data.scopes.find((scope) => scope.id === round.id);
}

function addScopeAndRound(): void {
  const cleanSubject = subject.value.trim();
  if (!cleanSubject) return;
  const id = uid('school-round');
  const round: Round = {
    id,
    qualificationKey: 'school-exams',
    qualification: '학교 중간·기말고사',
    shortQualification: '학교 시험',
    year: year.value,
    semester: semester.value,
    examKind: examKind.value,
    textbook: textbook.value.trim() || undefined,
    session: `${semester.value}학기 ${kindLabel[examKind.value]}`,
    title: `${year.value}년 ${semester.value}학기 ${cleanSubject} ${kindLabel[examKind.value]}`,
    subjects: [cleanSubject],
    questions: [],
    kind: 'school-exam',
  };
  commit({
    ...props.data,
    rounds: [round, ...props.data.rounds],
    scopes: [{
      id, subject: cleanSubject, year: year.value, semester: semester.value,
      examKind: examKind.value, textbook: textbook.value.trim() || undefined,
      pages: pages.value.trim() || undefined, note: note.value.trim() || undefined,
    }, ...props.data.scopes],
  });
  selectedRoundId.value = id;
  note.value = '';
}

function addQuestion(): void {
  const round = selectedRound.value;
  const cleanChoices = choices.value.map((choice) => choice.trim());
  if (!round || !questionText.value.trim() || cleanChoices.some((choice) => !choice)) return;
  const updated: Round = {
    ...round,
    subjects: round.subjects.length ? round.subjects : [subject.value.trim() || '학교 과목'],
    questions: [...round.questions, {
      number: round.questions.length + 1,
      text: questionText.value.trim(),
      choices: cleanChoices.map((text) => ({ text })),
      answer: answer.value,
      explanation: explanation.value.trim() || undefined,
      sourcePage: questionPage.value.trim() || undefined,
      teacherHint: teacherHint.value.trim() || undefined,
      source: 'school-user',
      _subject: round.subjects[0] || subject.value.trim() || '학교 과목',
    }],
  };
  commit({ ...props.data, rounds: props.data.rounds.map((item) => item.id === round.id ? updated : item) });
  questionText.value = '';
  choices.value = ['', '', '', ''];
  explanation.value = '';
  questionPage.value = '';
  teacherHint.value = '';
  answer.value = 1;
}

function addMemoryCard(): void {
  if (!memoryPrompt.value.trim() || !memoryAnswer.value.trim()) return;
  const card: SchoolMemoryCard = {
    id: uid('school-memory'),
    subject: selectedRound.value?.subjects[0] || subject.value.trim() || '학교 과목',
    prompt: memoryPrompt.value.trim(),
    answer: memoryAnswer.value.trim(),
    sourcePage: memoryPage.value.trim() || undefined,
    teacherHint: memoryHint.value.trim() || undefined,
    important: Boolean(memoryHint.value.trim()),
    reviewCount: 0,
    knownCount: 0,
  };
  commit({ ...props.data, memoryCards: [card, ...props.data.memoryCards] });
  memoryPrompt.value = '';
  memoryAnswer.value = '';
  memoryPage.value = '';
  memoryHint.value = '';
}

function reviewCard(card: SchoolMemoryCard, known: boolean): void {
  commit({
    ...props.data,
    memoryCards: props.data.memoryCards.map((item) => item.id === card.id ? {
      ...item,
      reviewCount: (item.reviewCount || 0) + 1,
      knownCount: (item.knownCount || 0) + (known ? 1 : 0),
      lastReviewedAt: Date.now(),
    } : item),
  });
  memoryOpenId.value = '';
}

function removeRound(round: Round): void {
  if (!confirm(`'${round.title}' 시험지를 삭제할까요?`)) return;
  commit({
    ...props.data,
    rounds: props.data.rounds.filter((item) => item.id !== round.id),
    scopes: props.data.scopes.filter((scope) => scope.id !== round.id),
  });
  selectedRoundId.value = props.data.rounds.find((item) => item.id !== round.id)?.id || '';
}

function removeMemoryCard(card: SchoolMemoryCard): void {
  if (!confirm('이 주관식 암기카드를 삭제할까요?')) return;
  commit({ ...props.data, memoryCards: props.data.memoryCards.filter((item) => item.id !== card.id) });
}

function exportData(): void {
  const blob = new Blob([JSON.stringify(props.data, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `학교시험-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
}

async function importData(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const normalized = normalizeSchoolExamData(JSON.parse(await file.text()));
    commit(normalized);
    selectedRoundId.value = normalized.rounds[0]?.id || '';
  } catch {
    alert('학교 시험 JSON 파일을 읽지 못했습니다.');
  }
  (event.target as HTMLInputElement).value = '';
}
</script>

<template>
  <section class="school-hero">
    <div><span>SCHOOL EXAM LAB</span><h1>학교 중간·기말고사 준비</h1><p>객관식 기출, 주관식 암기, 교재 범위와 선생님 강조사항을 한곳에 모읍니다.</p></div>
    <div><button type="button" @click="exportData">백업 저장</button><button type="button" @click="importInput?.click()">백업 불러오기</button><input ref="importInput" type="file" accept="application/json" hidden @change="importData"></div>
  </section>

  <div class="school-layout">
    <section class="school-panel">
      <header><span>01</span><div><h2>시험 범위 만들기</h2><p>교재 페이지와 출제 힌트도 함께 기록하세요.</p></div></header>
      <div class="school-form scope-form">
        <label><span>과목</span><input v-model="subject" placeholder="예: 냉동공학"></label>
        <label><span>연도</span><input v-model.number="year" type="number" min="2000" max="2100"></label>
        <label><span>학기</span><select v-model="semester"><option :value="1">1학기</option><option :value="2">2학기</option></select></label>
        <label><span>시험</span><select v-model="examKind"><option value="midterm">중간고사</option><option value="final">기말고사</option><option value="quiz">쪽지시험</option><option value="other">기타</option></select></label>
        <label><span>교재</span><input v-model="textbook" placeholder="교재 이름"></label>
        <label><span>페이지</span><input v-model="pages" placeholder="예: 32~58쪽"></label>
        <label class="wide"><span>선생님 강조·예상 범위</span><textarea v-model="note" rows="3" placeholder="예: 42쪽 표 암기, 3장 계산문제 출제"></textarea></label>
      </div>
      <button class="school-primary" type="button" :disabled="!subject.trim()" @click="addScopeAndRound">시험지 만들기</button>
    </section>

    <section class="school-panel">
      <header><span>02</span><div><h2>객관식 기출 입력</h2><p>저장한 문제는 기존 학습모드와 CBT모드로 풉니다.</p></div></header>
      <label class="school-select"><span>입력할 시험지</span><select v-model="selectedRoundId"><option value="">시험지를 먼저 만드세요</option><option v-for="round in data.rounds" :key="round.id" :value="round.id">{{ round.title }} · {{ round.questions.length }}문제</option></select></label>
      <div class="school-form question-form">
        <label class="wide"><span>문제</span><textarea v-model="questionText" rows="3" placeholder="객관식 문제를 입력하세요"></textarea></label>
        <label v-for="(_, index) in choices" :key="index"><span>보기 {{ index + 1 }}</span><input v-model="choices[index]" :placeholder="`${index + 1}번 보기`"></label>
        <label><span>정답</span><select v-model.number="answer"><option v-for="number in 4" :key="number" :value="number">{{ number }}번</option></select></label>
        <label><span>교재 쪽</span><input v-model="questionPage" placeholder="예: 43쪽"></label>
        <label class="wide"><span>해설</span><textarea v-model="explanation" rows="2" placeholder="없어도 저장할 수 있습니다"></textarea></label>
        <label class="wide"><span>선생님 강조사항</span><input v-model="teacherHint" placeholder="예: 서술형으로도 출제"></label>
      </div>
      <button class="school-primary" type="button" :disabled="!selectedRound || !questionText.trim() || choices.some((choice) => !choice.trim())" @click="addQuestion">객관식 문제 추가</button>
    </section>
  </div>

  <section class="school-panel school-rounds">
    <header><span>03</span><div><h2>내 시험지</h2><p>문제 번호는 입력 순서대로 1, 2, 3…으로 표시됩니다.</p></div></header>
    <div v-if="data.rounds.length" class="school-round-grid">
      <article v-for="round in data.rounds" :key="round.id">
        <span>{{ round.subjects.join(' · ') }}</span><h3>{{ round.title }}</h3><p>{{ round.textbook || '교재 미지정' }} · {{ round.questions.length }}문제</p>
        <p v-if="scopeFor(round)?.pages" class="school-scope-note">범위 {{ scopeFor(round)?.pages }}</p>
        <p v-if="scopeFor(round)?.note" class="school-scope-note">강조 {{ scopeFor(round)?.note }}</p>
        <div><button type="button" :disabled="!round.questions.length" @click="emit('start', { round, mode: 'learn' })">학습모드</button><button type="button" :disabled="!round.questions.length" @click="emit('start', { round, mode: 'exam' })">CBT모드</button><button class="danger" type="button" @click="removeRound(round)">삭제</button></div>
      </article>
    </div>
    <p v-else class="school-empty">아직 만든 시험지가 없습니다.</p>
  </section>

  <section class="school-panel school-memory">
    <header><span>04</span><div><h2>주관식 암기카드</h2><p>질문을 보고 답을 떠올린 뒤 펼쳐서 확인합니다.</p></div></header>
    <div class="school-form memory-form">
      <label class="wide"><span>질문</span><textarea v-model="memoryPrompt" rows="2" placeholder="예: 증발기의 역할을 쓰시오."></textarea></label>
      <label class="wide"><span>정답</span><textarea v-model="memoryAnswer" rows="2" placeholder="외워야 할 답을 입력하세요."></textarea></label>
      <label><span>교재 쪽</span><input v-model="memoryPage" placeholder="예: 51쪽"></label>
      <label><span>강조사항</span><input v-model="memoryHint" placeholder="예: 정의 그대로 암기"></label>
    </div>
    <button class="school-primary" type="button" :disabled="!memoryPrompt.trim() || !memoryAnswer.trim()" @click="addMemoryCard">암기카드 추가</button>
    <div class="memory-card-grid">
      <article v-for="card in data.memoryCards" :key="card.id" :class="{ important: card.important }">
        <span>{{ card.subject }}<small v-if="card.sourcePage">{{ card.sourcePage }}</small></span><h3>{{ card.prompt }}</h3>
        <button v-if="memoryOpenId !== card.id" type="button" @click="memoryOpenId = card.id">정답 펼치기</button>
        <div v-else class="memory-answer"><strong>{{ card.answer }}</strong><small v-if="card.teacherHint">선생님 강조: {{ card.teacherHint }}</small><div><button type="button" @click="reviewCard(card, true)">외웠어요</button><button type="button" @click="reviewCard(card, false)">다시 보기</button></div></div>
        <footer>확인 {{ card.reviewCount || 0 }}회 · 외움 {{ card.knownCount || 0 }}회 <button type="button" @click="removeMemoryCard(card)">삭제</button></footer>
      </article>
    </div>
  </section>
</template>

<style scoped>
.school-hero,.school-panel{border:1px solid var(--line);background:var(--surface);border-radius:24px}.school-hero{display:flex;justify-content:space-between;gap:24px;padding:30px;margin-bottom:18px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 15%,var(--surface)),var(--surface))}.school-hero span,.school-panel header>span{font-size:.75rem;font-weight:900;letter-spacing:.12em;color:var(--primary)}.school-hero h1,.school-panel h2,.school-round-grid h3,.memory-card-grid h3{margin:6px 0}.school-hero p,.school-panel p{margin:0;color:var(--muted)}.school-hero>div:last-child,.school-round-grid article>div{display:flex;gap:8px;align-items:center}.school-hero button,.school-panel button{border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);padding:10px 14px;font-weight:800}.school-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.school-panel{padding:24px;margin-bottom:18px}.school-panel header{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}.school-panel header>span{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:color-mix(in srgb,var(--primary) 12%,transparent)}.school-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.school-form label,.school-select{display:grid;gap:6px;font-size:.82rem;font-weight:800}.school-form .wide{grid-column:1/-1}.school-form input,.school-form select,.school-form textarea,.school-select select{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text);padding:11px 12px;font:inherit;resize:vertical}.school-select{margin-bottom:12px}.school-primary{width:100%;margin-top:14px!important;background:var(--primary)!important;color:#fff!important;border-color:transparent!important}.school-primary:disabled,.school-panel button:disabled{opacity:.45}.school-round-grid,.memory-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.school-round-grid article,.memory-card-grid article{border:1px solid var(--line);border-radius:16px;padding:16px;background:var(--surface-2)}.school-round-grid article>span,.memory-card-grid article>span{font-size:.78rem;font-weight:900;color:var(--primary)}.school-round-grid article p{margin:6px 0 14px}.school-round-grid article .school-scope-note{margin:5px 0;padding:7px 9px;border-radius:9px;background:color-mix(in srgb,var(--primary) 8%,var(--surface));font-size:.75rem;line-height:1.5}.school-round-grid article .school-scope-note:last-of-type{margin-bottom:14px}.school-round-grid .danger{color:#c83d50;margin-left:auto}.school-empty{text-align:center;padding:32px}.memory-form{max-width:760px}.memory-card-grid{margin-top:18px}.memory-card-grid article.important{border-color:color-mix(in srgb,var(--primary) 60%,var(--line))}.memory-card-grid article>span{display:flex;justify-content:space-between}.memory-answer{display:grid;gap:10px;padding:12px;margin:10px 0;border-radius:12px;background:color-mix(in srgb,var(--primary) 8%,var(--surface))}.memory-answer>small{color:var(--muted)}.memory-answer>div{display:flex;gap:8px}.memory-card-grid footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:.76rem;color:var(--muted)}.memory-card-grid footer button{padding:5px 8px;color:#c83d50}@media(max-width:900px){.school-layout{grid-template-columns:1fr}.school-hero{display:grid}.school-hero>div:last-child{flex-wrap:wrap}}@media(max-width:600px){.school-hero,.school-panel{padding:18px;border-radius:18px}.school-form{grid-template-columns:1fr}.school-form .wide{grid-column:auto}.school-round-grid,.memory-card-grid{grid-template-columns:1fr}.school-round-grid article>div{flex-wrap:wrap}.school-round-grid .danger{margin-left:0}.school-hero>div:last-child button{flex:1}}
</style>
