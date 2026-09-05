<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui';
import { Play, ArrowUpRight, BookOpen, Shuffle, History, SlidersHorizontal } from '@lucide/vue';
import type { Catalog } from './types';
const props = defineProps<{ catalogs: Catalog[]; selectedKey: string; comic: boolean; sunjae: boolean; photos: string[]; stats: {answered: number; accuracy: number; wrong: number; coverage: number}; range: string; resumeTitle?: string; resumeAnswered?: number; resumeTotal?: number; practical: boolean }>();
const emit = defineEmits<{ select: [key: string]; learn: []; random: []; exam: []; rounds: []; wrong: []; history: []; configure: []; resume: []; practical: [] }>();
const selected = computed(() => props.catalogs.find(item => item.key === props.selectedKey));
const photoIndex = ref(0);
const photoOpen = ref(false);
watch(() => props.photos[0], () => { photoIndex.value = 0; });
</script>

<template>
  <section class="ws-home" :class="{ 'ws-sunjae-home': sunjae }" aria-label="학습 시작">
    <div class="ws-home-heading"><div><span>{{ comic ? 'SPRINGFIELD · STUDY CLUB' : sunjae ? 'LOVELY RUNNER · STUDY WITH YOU' : 'YOUR STUDY SPACE' }}</span><h1>{{ comic ? '도넛은 잠깐, 공부는 지금!' : sunjae ? '왔어? 오늘도 같이 하자.' : '오늘도, 한 문제 앞으로.' }}</h1></div><button type="button" aria-label="학습 내역 보기" @click="emit('history')"><History :size="19" /> 내 기록</button></div>
    <div class="ws-home-grid">
      <article class="ws-start-panel">
        <span class="ws-eyebrow">{{ resumeTitle ? '이어서 달릴까요?' : '오늘의 공부' }}</span>
        <label class="ws-course-label" for="workspace-course">공부할 종목</label>
        <select id="workspace-course" :value="selectedKey" @change="emit('select', ($event.target as HTMLSelectElement).value)"><option v-for="catalog in catalogs" :key="catalog.key" :value="catalog.key">{{ catalog.name }}</option></select>
        <div v-if="resumeTitle" class="ws-resume"><strong>{{ resumeTitle }}</strong><span>{{ resumeAnswered }} / {{ resumeTotal }}문제 완료</span><progress :value="resumeAnswered" :max="resumeTotal" aria-label="저장한 학습 진행률" /></div>
        <p v-else class="ws-start-description">{{ selected?.roundCount ?? selected?.rounds.length ?? 0 }}회차의 문제와 함께 준비하세요.<br>답을 고르고 해설로 바로 확인할 수 있어요.</p>
        <button class="ws-primary" type="button" @click="resumeTitle ? emit('resume') : emit('learn')"><Play :size="19" fill="currentColor" />{{ resumeTitle ? '이어서 풀기' : '바로 학습 시작' }}<ArrowUpRight :size="21" /></button>
        <button class="ws-range" type="button" @click="emit('configure')"><SlidersHorizontal :size="16" /><span>{{ range }} · 범위·과목 설정</span><span>›</span></button>
      </article>
      <figure v-if="comic || sunjae" class="ws-photo-gallery">
        <button class="ws-photo-open" type="button" aria-label="테마 사진 크게 보기" @click="photoOpen = true"><img :src="photos[photoIndex]" :alt="sunjae ? '류선재·변우석 선택 사진' : '심슨 본편 선택 장면'"><span>크게 보기 ↗</span></button>
        <figcaption><strong>{{ sunjae ? '천천히 해도 돼. 내가 옆에 있을게.' : '오늘의 스프링필드' }}</strong><small>{{ photoIndex + 1 }} / {{ photos.length }}</small></figcaption>
        <div class="ws-photo-thumbs" role="group" aria-label="테마 사진 고르기"><button v-for="(photo, index) in photos" :key="index" type="button" :aria-label="`사진 ${index + 1} 선택`" :aria-pressed="photoIndex === index" @click="photoIndex = index"><img :src="photo" alt="" loading="lazy"></button></div>
      </figure>
      <article v-else class="ws-record-panel"><span class="ws-eyebrow">쌓이고 있는 나의 실력</span><strong>{{ stats.answered.toLocaleString() }}<small>문제 학습</small></strong><div class="ws-coverage"><span>현재 종목 학습률</span><b>{{ stats.coverage }}%</b></div><progress :value="stats.coverage" max="100" aria-label="현재 종목 학습률" /><p>오늘의 공부를 내일 이어갈 수 있어요.</p></article>
    </div>
    <nav class="ws-study-actions" aria-label="학습 방식 선택">
      <button type="button" @click="emit('rounds')"><BookOpen :size="22" /><strong>회차별 문제</strong><span>원하는 시험부터</span><ArrowUpRight :size="17" /></button>
      <button type="button" @click="emit('random')"><Shuffle :size="22" /><strong>랜덤 60문제</strong><span>여러 회차 골고루</span><ArrowUpRight :size="17" /></button>
      <button type="button" @click="emit('exam')"><span class="ws-action-symbol">CBT</span><strong>실전 시험</strong><span>시간을 재며 도전</span><ArrowUpRight :size="17" /></button>
      <button type="button" @click="emit('wrong')"><span class="ws-action-symbol">↺</span><strong>오답 복습</strong><span>{{ stats.wrong }}문제 다시 보기</span><ArrowUpRight :size="17" /></button>
    </nav>
    <div class="ws-insights"><span>학습 <b>{{ stats.answered.toLocaleString() }}</b></span><span>정답률 <b>{{ stats.accuracy }}%</b></span><button v-if="practical" type="button" @click="emit('practical')">필답형 · S펜 훈련 <span>→</span></button><button v-else type="button" @click="emit('history')">내 학습 기록 →</button></div>
    <DialogRoot v-model:open="photoOpen"><DialogPortal><DialogOverlay class="ws-menu-overlay" /><DialogContent class="ws-photo-dialog"><header><DialogTitle>테마 사진</DialogTitle><DialogClose aria-label="사진 닫기">닫기 ×</DialogClose></header><DialogDescription>선택한 사진을 원래 비율로 표시합니다.</DialogDescription><img :src="photos[photoIndex]" :alt="sunjae ? '류선재·변우석 사진' : '심슨 본편 장면'"></DialogContent></DialogPortal></DialogRoot>
  </section>
</template>
