<script setup lang="ts">
import { ChevronLeft, ChevronRight, Settings, Calculator, ListChecks } from '@lucide/vue';
defineProps<{ page: number; pages: number; answered: number; total: number; unanswered: number; exam: boolean; omr: boolean }>();
const emit = defineEmits<{ previous: []; next: []; settings: []; calculator: []; unanswered: []; omr: []; submit: [] }>();
</script>
<template>
  <nav class="ws-session-bar" aria-label="문제풀이 도구">
    <div class="ws-session-utility"><button type="button" aria-label="풀이 설정 열기" @click="emit('settings')"><Settings :size="19" /><span>설정</span></button><button type="button" @click="emit('calculator')"><Calculator :size="19" /><span>계산기</span></button><button v-if="exam" type="button" :aria-pressed="omr" @click="emit('omr')"><ListChecks :size="19" /><span>OMR</span></button><button type="button" :disabled="!unanswered" @click="emit('unanswered')">미응답 {{ unanswered }}</button></div>
    <div class="ws-page-actions"><button type="button" aria-label="이전 페이지" :disabled="page === 0" @click="emit('previous')"><ChevronLeft :size="23" /></button><span><b>{{ page + 1 }} / {{ pages }}</b><small>{{ answered }} / {{ total }} 완료</small></span><button type="button" aria-label="다음 페이지" :disabled="page >= pages - 1" @click="emit('next')"><ChevronRight :size="23" /></button><button class="ws-submit" type="button" @click="emit('submit')">{{ exam ? '시험 제출' : '학습 결과' }}</button></div>
  </nav>
</template>
