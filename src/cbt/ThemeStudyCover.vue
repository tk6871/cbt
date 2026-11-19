<script setup lang="ts">
import {subjectPhoto} from '../react/subjectPhotos';
import {responsiveImageAttrs,restoreOriginalImage} from './responsiveImages';
defineProps<{styleName:'simpsons'|'sunjae';subject:string;subjectName:string;portrait:string;jewelry:boolean;answered:number;accuracy:number}>();
defineEmits<{rounds:[];secondary:[];settings:[]}>();
</script>
<template>
 <section class="fan-cover" :class="'cover-'+styleName" :data-subject="subject">
  <div class="fan-cover-copy">
   <p>{{styleName==='simpsons'?'스프링필드 학습 클럽':'선재와 함께하는 학습 노트'}}</p>
   <h1>{{styleName==='simpsons'?'오늘의':'오늘도,'}}<br><em>{{styleName==='simpsons'?'공부 한 컷':'같이 달릴래?'}}</em></h1>
   <div class="fan-cover-actions">
    <button @click="$emit('rounds')">회차별 기출 고르기 <span aria-hidden="true">→</span></button>
    <button @click="$emit('secondary')">{{jewelry?'오답 다시 풀기':'교재에서 풀기'}}</button>
   </div>
   <small>누적 {{answered.toLocaleString()}}문제 · 정답률 {{accuracy}}%</small>
  </div>
  <div class="fan-art">
   <img :src="$problemImage(portrait)" v-bind="responsiveImageAttrs(portrait,'(max-width:600px) 90vw, 640px')" @error="restoreOriginalImage" :alt="styleName==='simpsons'?'스프링필드의 호머 심슨':'변우석 테마 사진'">
   <figure><img :src="subjectPhoto(subject)" alt=""><figcaption>{{subjectName}}</figcaption></figure>
  </div>
  <button class="fan-cover-settings" aria-label="테마 설정" @click="$emit('settings')">⚙</button>
 </section>
</template>
<style scoped>
.fan-cover{isolation:isolate;position:relative;display:grid;grid-template-columns:minmax(235px,.93fr) minmax(0,1.3fr);overflow:hidden;margin:4px 0 22px;color:var(--cover-ink);background:var(--cover-paper);border:var(--cover-edge);border-radius:var(--cover-radius);box-shadow:var(--cover-shadow)}
.cover-simpsons{--cover-ink:#251c32;--cover-paper:#ffd634;--cover-edge:3px solid #272035;--cover-radius:12px 26px 12px 16px;--cover-shadow:5px 5px 0 #292236;background-image:radial-gradient(#efb428 1.4px,transparent 1.5px);background-size:9px 9px}
.cover-sunjae{--cover-ink:#342d45;--cover-paper:#f6edf1;--cover-edge:1px solid #cbbcc8;--cover-radius:24px 6px 24px 6px;--cover-shadow:0 12px 32px #35223620;background-image:linear-gradient(120deg,#fff8f1,#f6edf1 53%,#dce5f0)}
.fan-cover-copy{align-self:center;padding:clamp(22px,3.6vw,54px);min-width:0}
.fan-cover-copy>p{margin:0 0 12px;font-size:13px;font-weight:700;color:inherit}
.fan-cover-copy h1{font-size:clamp(32px,3.6vw,62px);letter-spacing:-.065em;line-height:1.12;margin:0;color:inherit}
.fan-cover-copy h1 em{font-style:normal;white-space:nowrap}
.cover-simpsons h1{font-weight:950;transform:rotate(-2deg);text-shadow:1px 2px 0 white}
.cover-sunjae h1{font-family:AppleMyungjo,Batang,"Noto Serif CJK KR",serif;font-weight:500}
.cover-sunjae h1 em{color:#815570}
.fan-cover-copy>small{display:block;margin-top:8px;color:inherit;font-size:12px}
.fan-cover-actions{display:flex;flex-wrap:wrap;gap:0 16px;margin-top:15px}
.fan-cover .fan-cover-actions button,.fan-cover .fan-cover-settings{min-height:44px;background:transparent;border:0;box-shadow:none;color:inherit;cursor:pointer;font:inherit;font-weight:700;padding:3px 0}
.fan-cover-actions button:first-child{text-decoration:underline;text-underline-offset:5px}
.fan-cover .fan-cover-settings{position:absolute;right:8px;top:8px;min-width:44px;border-radius:50%;background:#fffffff0;color:#272035;font-size:20px}
.fan-cover button:focus-visible{outline:3px solid currentColor;outline-offset:2px}
.fan-art{position:relative;min-height:240px}
.fan-art>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 35%}
.cover-simpsons .fan-art{border-left:4px solid #292236;transform:skew(-3deg);overflow:hidden;margin-right:-12px}
.cover-simpsons .fan-art>img{transform:skew(3deg) scale(1.05)}
.fan-art figure{position:absolute;right:6%;bottom:8%;width:clamp(126px,16vw,224px);margin:0;background:#fffefa;color:#28232e;box-shadow:0 4px 12px #0004;transform:rotate(-3deg);padding:5px}
.cover-simpsons figure{border:2px solid #252034;box-shadow:3px 3px 0 #252034;transform:rotate(2deg)}
.fan-art figure img{display:block;width:100%;height:clamp(38px,5vw,70px);object-fit:cover;object-position:77% center}
.fan-art figcaption{padding:5px 1px 1px;font-size:12px;line-height:1.3;font-weight:700;text-align:center;word-break:keep-all}
@media(hover:hover){.fan-cover-actions button:hover{text-decoration:underline;text-underline-offset:5px}}
@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){:root:not([data-dynamic-ui="off"]) .fan-cover-actions button span{display:inline-block;transition:transform .18s ease-out}:root:not([data-dynamic-ui="off"]) .fan-cover-actions button:hover span{transform:translateX(4px)}}
@media(max-width:650px){.fan-cover{grid-template-columns:1fr}.fan-art{min-height:150px;grid-row:1}.cover-simpsons .fan-art{margin:0;transform:none;border-left:0;border-bottom:3px solid #292236}.cover-simpsons .fan-art>img{transform:none}.fan-cover-copy{padding:18px 20px}.fan-cover-copy h1 br{display:none}.fan-cover-copy h1 em{margin-left:.2em}.fan-cover-actions{margin-top:6px}.fan-art figure{right:12px;bottom:9px}.fan-cover-copy>p{margin-bottom:6px}}
</style>
