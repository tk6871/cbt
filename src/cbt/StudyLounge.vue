<script setup lang="ts">
import { computed, ref } from 'vue';
const props = defineProps<{ qualification: string; answered: number; wrong: number; motion: boolean }>();
const emit = defineEmits<{ navigate: [destination: string]; exit: [] }>();
const rooms = [
  { id: 'exam', number: '01', name: '시험장', en: 'EXAM HALL', description: '한 회차씩, 실력을 쌓는 시간.', links: [{ id: 'rounds', title: '회차별 문제', detail: '종목과 회차를 골라 시작' }, { id: 'random', title: '랜덤 문제 준비', detail: '기존 홈에서 범위·문항 수 선택' }] },
  { id: 'review', number: '02', name: '복습 데스크', en: 'REVIEW DESK', description: '지난 공부에서, 다음 한 걸음으로.', links: [{ id: 'history', title: '이어서 공부하기', detail: '학습 내역에서 중단한 풀이 계속' }, { id: 'wrong', title: '오답노트', detail: '헷갈렸던 문제 다시 풀기' }] },
  { id: 'library', number: '03', name: '자료실', en: 'STUDY ARCHIVE', description: '교재부터 필답까지, 필요한 공부를 꺼내세요.', links: [{ id: 'textbook', title: '교재 페이지별', detail: '책 목차와 페이지로 찾기' }, { id: 'guide', title: '필답·학습 자료', detail: '현재 종목의 시험 자료실' }, { id: 'calculation', title: '계산문제', detail: '계산 유형 모아서 풀기' }] },
] as const;
const active = ref<(typeof rooms)[number]['id']>('exam');
const room = computed(() => rooms.find(item => item.id === active.value)!);
const imageFailed = ref(false);
</script>

<template>
  <section class="study-lounge" :class="{ 'lounge-motion': props.motion }" aria-label="학습 라운지">
    <header class="lounge-heading">
      <div><p>YOUR NEXT CHAPTER</p><h1>학습 라운지<span>오늘의 공부가 시작되는 곳</span></h1></div>
      <button class="lounge-exit" type="button" @click="emit('exit')">기존 홈으로 돌아가기 ↗</button>
    </header>
    <div class="lounge-scene">
      <img v-if="!imageFailed" class="lounge-background" :src="'assets/lounge/study-lounge.png'" alt="시험장 입구, 중앙 복습 데스크, 오른쪽 서가로 이어지는 학습 공간" decoding="async" @error="imageFailed = true">
      <div class="lounge-scene-shade" />
      <div class="lounge-scene-caption"><span>STUDY LOUNGE</span><p>{{ qualification }}</p></div>
      <nav class="lounge-rooms" aria-label="라운지 공간 선택">
        <button v-for="item in rooms" :key="item.id" type="button" :class="['lounge-room', `room-${item.id}`, { selected: active === item.id }]" :aria-pressed="active === item.id" aria-controls="lounge-destinations" @click="active = item.id">
          <span class="room-dot" aria-hidden="true" /><span><small>{{ item.number }} / {{ item.en }}</small><strong>{{ item.name }} <b aria-hidden="true">↗</b></strong></span>
        </button>
      </nav>
      <div class="lounge-scene-footer"><span>공간을 선택하고 공부를 시작하세요</span><span>학습 {{ answered.toLocaleString() }} · 오답 {{ wrong.toLocaleString() }}</span></div>
    </div>
    <div id="lounge-destinations" class="lounge-destinations">
      <div class="lounge-room-intro" aria-live="polite"><small>{{ room.number }} / {{ room.en }}</small><h2>{{ room.name }}</h2><p>{{ room.description }}</p></div>
      <div class="lounge-links">
        <button v-for="link in room.links" :key="link.id" type="button" @click="emit('navigate', link.id)"><span><strong>{{ link.title }}</strong><small>{{ link.detail }}</small></span><b aria-hidden="true">→</b></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.study-lounge{--lounge-gold:#edce98;max-width:1600px;margin:0 auto;color:#f4eee4;font-family:inherit}
.lounge-heading{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:24px;color:var(--text,#eff6ff)}
.lounge-heading p{font-size:11px;letter-spacing:.24em;color:#b18950;margin:0 0 10px}.lounge-heading h1{font-size:clamp(24px,2.5vw,38px);margin:0;font-weight:700;letter-spacing:-.04em}.lounge-heading h1 span{display:block;font-size:14px;font-weight:400;letter-spacing:0;margin-top:10px;opacity:.75}
.lounge-exit{border:1px solid #96764a;border-radius:5px;background:#1b232c;color:#f1d6ab;padding:12px 16px;font:inherit;font-size:13px;cursor:pointer;flex-shrink:0}
.lounge-scene{position:relative;isolation:isolate;aspect-ratio:16/9;min-height:350px;max-height:720px;overflow:hidden;border:1px solid #77634b;border-radius:8px;background:linear-gradient(135deg,#273140,#121923)}
.lounge-background{position:absolute;width:100%;height:100%;object-fit:cover;inset:0;z-index:-3}.lounge-scene-shade{position:absolute;inset:0;z-index:-2;background:linear-gradient(180deg,rgba(4,12,18,.65),transparent 33%,transparent 66%,rgba(4,12,18,.86))}
.lounge-scene-caption{position:absolute;top:28px;left:32px}.lounge-scene-caption span{font-size:12px;letter-spacing:.25em;color:var(--lounge-gold)}.lounge-scene-caption p{font-size:15px;color:white;margin:9px 0;max-width:65vw}
.lounge-room{position:absolute;display:flex;gap:12px;align-items:center;text-align:left;border:1px solid #a28b69;background:rgba(15,24,32,.94);color:#f4eee4;padding:16px 20px;border-radius:4px;cursor:pointer;box-shadow:0 8px 25px #0004;transform:translate(-50%,-50%);min-width:180px;font:inherit}
.lounge-room small{display:block;font-size:10px;letter-spacing:.14em;color:#d4c5af;margin-bottom:7px}.lounge-room strong{font-size:20px;font-weight:600}.lounge-room b{margin-left:12px;font-size:16px;color:var(--lounge-gold)}.room-dot{width:8px;height:8px;border:1px solid var(--lounge-gold);border-radius:50%;flex-shrink:0}.lounge-room.selected{border-color:#f9dba3;background:#283339}.lounge-room.selected .room-dot{background:var(--lounge-gold);box-shadow:0 0 0 5px #e6bb6320}.lounge-room:hover{background:#354047}
.room-exam{left:17%;top:51%}.room-review{left:50%;top:63%}.room-library{left:82%;top:48%}
.lounge-scene-footer{position:absolute;bottom:24px;left:32px;right:32px;display:flex;justify-content:space-between;gap:16px;font-size:12px;color:#e5dcca}
.lounge-destinations{display:grid;grid-template-columns:1fr 2fr;gap:30px;padding:28px 32px;background:#15202b;border:1px solid #39414a;border-top:0;border-radius:0 0 8px 8px}.lounge-room-intro small{font-size:10px;letter-spacing:.15em;color:var(--lounge-gold)}.lounge-room-intro h2{margin:10px 0;font-size:23px}.lounge-room-intro p{margin:0;font-size:13px;color:#b6c1ca;line-height:1.7}.lounge-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:stretch}.lounge-links button{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid #53606d;border-radius:4px;background:#1c2a37;color:#f4eee4;padding:18px;font:inherit;cursor:pointer}.lounge-links button:hover{border-color:var(--lounge-gold);background:#273744}.lounge-links strong{display:block;font-size:16px}.lounge-links small{display:block;color:#bac6d0;font-size:12px;margin-top:8px;line-height:1.6}.lounge-links b{color:var(--lounge-gold)}
.study-lounge button:focus-visible{outline:3px solid #ffe1a6;outline-offset:4px}
@media(prefers-reduced-motion:no-preference){.lounge-motion .lounge-background{animation:lounge-reveal 900ms ease-out both}.lounge-motion button{transition:background .2s,border-color .2s}@keyframes lounge-reveal{from{transform:scale(1.025);opacity:.4}to{transform:scale(1);opacity:1}}}
@media(max-width:1000px){.lounge-room{min-width:145px;padding:13px}.lounge-room strong{font-size:17px}.lounge-room small{font-size:9px}.lounge-destinations{padding:22px;gap:20px}}
@media(max-width:640px){.lounge-heading{align-items:flex-start;gap:12px}.lounge-heading h1 span{font-size:12px}.lounge-exit{font-size:11px;padding:10px;max-width:110px}.lounge-scene{aspect-ratio:auto;min-height:0;padding:180px 14px 16px}.lounge-background{height:240px;object-position:center}.lounge-scene-shade{background:linear-gradient(180deg,#111b2540,transparent 80px,#15202b 240px)}.lounge-scene-caption{top:22px;left:20px}.lounge-scene-caption p{font-size:13px}.lounge-rooms{display:grid;gap:8px}.lounge-room{position:relative;left:auto;top:auto;transform:none;width:100%;padding:14px;min-height:64px}.lounge-room strong{font-size:18px}.lounge-room small{margin-bottom:4px}.lounge-scene-footer{position:relative;inset:auto;flex-wrap:wrap;margin-top:18px;font-size:11px;gap:8px}.lounge-destinations{grid-template-columns:1fr;gap:18px;padding:20px 16px}.lounge-links{grid-template-columns:1fr}.lounge-links button{min-height:70px}}
</style>
