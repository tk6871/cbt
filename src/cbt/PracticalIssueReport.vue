<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PracticalPrompt } from './hvacPracticalTypes';
import { submitQuestionIssue, type QuestionIssueType } from './cloudSync';
import { practicalIssueSnapshot } from './practicalIssue';
const props = defineProps<{ prompt: PracticalPrompt; displayNumber: number }>();
const open = ref(false), sending = ref(false), submitted = ref(false);
const types = ref<QuestionIssueType[]>([]), details = ref(''), error = ref('');
const imageIndex = ref(0);
const images = computed(() => [...new Set([props.prompt.image, ...(props.prompt.images || []), ...(props.prompt.answerImages || [])].filter((s): s is string => !!s))]);
const options: Array<[QuestionIssueType, string]> = [['answer', '답안 오류·누락'], ['explanation', '설명 오류·부족'], ['wrong-image', '그림 잘림·잘못된 그림'], ['missing-image', '그림 없음'], ['text-ocr', '문제·수식 오류'], ['layout', '화면 배치'], ['other', '기타']];
function toggle(type: QuestionIssueType): void { types.value = types.value.includes(type) ? types.value.filter(t => t !== type) : [...types.value, type]; error.value = ''; }
async function send(): Promise<void> {
  if (sending.value) return;
  if (!types.value.length || details.value.trim().length < 3) { error.value = '문제 유형을 고르고 내용을 3자 이상 적어 주세요.'; return; }
  sending.value = true; error.value = '';
  try {
    error.value = await submitQuestionIssue({ ...practicalIssueSnapshot(props.prompt, props.displayNumber, images.value[imageIndex.value]),
      space: window.CBT_APP_SPACE === 'jewelry' ? 'jewelry' : 'industrial', issue_types: types.value, details: details.value,
      page_url: location.href, app_version: window.CBT_CHANGELOG?.currentVersion,
      device_info: `${navigator.platform || 'unknown'} · ${navigator.userAgent.slice(0, 300)}`,
    }) || '';
    if (!error.value) { submitted.value = true; open.value = false; }
  } catch { error.value = '신고를 저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 시도해 주세요.'; }
  finally { sending.value = false; }
}
</script>
<template>
  <section class="practical-issue" aria-label="필답형 문제 이상 신고">
    <button type="button" :aria-expanded="open" @click="open = !open">{{ submitted ? '✓ 신고 접수됨' : '☐ 이상 신고' }}</button>
    <form v-if="open" @submit.prevent="send">
      <header><strong>이 문제의 이상한 점을 알려주세요</strong><button type="button" aria-label="필답형 신고창 닫기" @click="open = false">닫기</button></header>
      <div class="issue-types"><button v-for="[value,label] in options" :key="value" type="button" :aria-pressed="types.includes(value)" @click="toggle(value)">{{ types.includes(value) ? '✓ ' : '' }}{{ label }}</button></div>
      <label v-if="images.length > 1">문제가 있는 이미지<select v-model.number="imageIndex"><option v-for="(image,i) in images" :key="image" :value="i">{{ i + 1 }}번째 이미지 · {{ image.split('/').at(-1) }}</option></select></label>
      <label>무엇이 문제인가요?<textarea v-model="details" rows="3" maxlength="1500" placeholder="예: 오른쪽 배관 그림이 잘렸습니다. / 특징 답안이 빠졌습니다." :disabled="sending" /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <footer><small>{{ details.length }}/1500자 · 관리자 확인용으로만 저장됩니다.</small><button type="submit" :disabled="sending">{{ sending ? '저장 중…' : '이상 문제 저장' }}</button></footer>
    </form>
  </section>
</template>
<style scoped>
.practical-issue { margin:8px 0; }
button,select,textarea { font:inherit; color:var(--text); background:var(--surface); border:1px solid var(--line); border-radius:8px; padding:8px 12px; }
button,select { min-height:44px; cursor:pointer; }
form { border:1px solid var(--line); padding:12px; margin-top:8px; border-radius:10px; background:var(--surface-2); }
header,footer,.issue-types { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
header strong,footer small { flex:1; }
label { display:grid; gap:6px; margin-top:12px; }
textarea,select { width:100%; min-width:0; box-sizing:border-box; }
textarea { resize:vertical; }
.issue-types { margin-top:12px; }
[aria-pressed="true"] { border-color:var(--primary); background:var(--primary); color:white; }
footer { margin-top:12px; } small { color:var(--muted); } p { color:var(--danger,#c13c45); }
button:disabled { opacity:.6; cursor:wait; }
</style>
