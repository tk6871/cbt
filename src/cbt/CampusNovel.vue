<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Story } from 'inkjs';
import route from './yuna-route.json';
import teacherRoute from './teacher-route.json';

const props = defineProps<{ person: 'guest-lecturer' | 'teacher' }>();
const key = props.person === 'teacher' ? 'cbt-campus-ink-teacher-v1' : 'cbt-campus-ink-yuna-v1';
const lines = ref('');
const choices = ref<{ index: number; text: string }[]>([]);
const failed = ref(false);
const saved = ref(true);
const ready = ref(false);
let story: Story | undefined;
let createStory: (() => Story) | undefined;
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

function show(text: string) {
  if (!story) return;
  lines.value = text;
  choices.value = story.currentChoices.map(({index,text}) => ({index,text}));
}
function advance(index?: number) {
  if (!story) return;
  if (index !== undefined) {
    if (!story.currentChoices.some(choice => choice.index === index)) return;
    story.ChooseChoiceIndex(index);
  }
  const text = story.ContinueMaximally().trim();
  show(text);
  try {
    localStorage.setItem(key, JSON.stringify({ state: story.state.ToJson(), text }));
    saved.value = true;
  } catch { saved.value = false; }
}
function restart() {
  if (!createStory) return;
  story = createStory();
  advance();
}
onMounted(async () => {
  try {
    const { Story } = await import('inkjs');
    if (disposed) return;
    createStory = () => new Story(props.person === 'teacher' ? teacherRoute : route);
    story = createStory();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      if (typeof stored?.state === 'string' && typeof stored?.text === 'string') {
        story.state.LoadJson(stored.state);
        show(stored.text);
      } else advance();
    } catch { restart(); }
    ready.value = true;
  } catch { failed.value = true; }
});
</script>

<template>
  <div class="campus-novel">
    <small>{{ person === 'teacher' ? '윤 강사의 이야기 · 강의가 끝나고' : '유나의 이야기 · 정문에서' }}</small>
    <p v-if="failed" role="status">이야기를 읽지 못했어요. 대화를 닫았다가 다시 열어 주세요.</p>
    <p v-else-if="!ready" role="status">이야기를 불러오는 중…</p>
    <template v-else>
      <p class="campus-novel-line" aria-live="polite">{{ lines }}</p>
      <div class="campus-story-choices">
        <button v-for="choice in choices" :key="choice.text" type="button" @click="advance(choice.index)">{{ choice.text }}</button>
      </div>
      <button v-if="!choices.length" type="button" @click="restart">다른 결말 보기 · 처음부터</button>
      <p v-if="!saved" role="status">이 기기에 진행을 저장하지 못했습니다.</p>
      <small>이 기기에만 저장 · 학습 기록과 별개</small>
    </template>
  </div>
</template>

<style scoped>
.campus-novel-line{white-space:pre-line;line-height:1.7}
.campus-novel small{display:block;margin:.5rem 0}
</style>
