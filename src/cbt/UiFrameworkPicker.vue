<script setup lang="ts">
import { computed, ref } from 'vue';
import { useUiLab, type UiFrameworkPreset } from './uiLab';
import { frameworks } from '../ui-framework-lab/catalog';

withDefaults(defineProps<{ showcase?: boolean }>(), { showcase: false });

const { enabled, active, safeMode, framework } = useUiLab();
const selectedAnswer = ref(0);
const submitted = ref(false);

const options: Array<{
  value: UiFrameworkPreset;
  short: string;
  label: string;
  mood: string;
  fit: string;
}> = [
  { value: 'classic', short: 'CBT', label: '기본 CBT', mood: '현재 화면 그대로', fit: '가장 익숙하고 안전함' },
  { value: 'material', short: 'M3', label: 'Material', mood: 'Vuetify 계열', fit: '큰 터치·선명한 단계' },
  { value: 'prime', short: 'PV', label: 'Prime Aura', mood: 'PrimeVue 계열', fit: '정돈된 대시보드' },
  { value: 'naive', short: 'NU', label: 'Naive UI', mood: '가볍고 차분함', fit: '문제 내용에 집중' },
  { value: 'quasar', short: 'Q', label: 'Quasar', mood: '모바일 앱 계열', fit: '휴대폰·태블릿 친화' },
  { value: 'bootstrap', short: 'B5', label: 'Bootstrap', mood: '명확하고 익숙함', fit: '빠른 구분·단순 조작' },
];

const activeValue = computed<UiFrameworkPreset>(() => active.value ? framework.value : 'classic');
const activeOption = computed(() => options.find((item) => item.value === activeValue.value) || options[0]);

function selectFramework(value: UiFrameworkPreset): void {
  if (safeMode) return;
  framework.value = value;
  enabled.value = value !== 'classic';
  selectedAnswer.value = 0;
  submitted.value = false;
}

function chooseAnswer(answer: number): void {
  selectedAnswer.value = selectedAnswer.value === answer ? 0 : answer;
  submitted.value = false;
}
</script>

<template>
  <section class="framework-picker" :class="{ showcase }">
    <header v-if="showcase">
      <div><span>FULL UI SWITCHER</span><h2>UI 프레임워크 감성을 전체 화면에서 비교</h2></div>
      <p>아래 스타일을 누르면 이 체험 카드뿐 아니라 메뉴·홈·설정·문제풀이·결과 화면까지 즉시 바뀝니다.</p>
    </header>

    <div class="framework-options" role="radiogroup" aria-label="전체 UI 스타일 선택">
      <button
        v-for="item in options"
        :key="item.value"
        type="button"
        role="radio"
        :aria-checked="activeValue === item.value"
        :disabled="safeMode"
        :class="[`framework-option-${item.value}`, { selected: activeValue === item.value }]"
        @click="selectFramework(item.value)"
      >
        <b>{{ item.short }}</b>
        <span><strong>{{ item.label }}</strong><small>{{ item.mood }}</small></span>
        <em>{{ item.fit }}</em>
      </button>
    </div>

    <div v-if="showcase" class="framework-live-demo" aria-live="polite">
      <header>
        <div><small>선택한 전체 UI</small><strong>{{ activeOption.label }}</strong></div>
        <span>7 / 20</span>
      </header>
      <div class="framework-demo-progress"><i /></div>
      <article>
        <small>공기조화 · 연습 문제</small>
        <h3>1. 냉동사이클에서 압축기의 역할로 가장 알맞은 것은?</h3>
        <div>
          <button v-for="answer in 4" :key="answer" type="button" :class="{ selected: selectedAnswer === answer }" @click="chooseAnswer(answer)">
            <b>{{ answer }}</b><span>{{ ['냉매를 팽창시킨다', '냉매 증기를 압축한다', '냉매를 응축시킨다', '냉매를 증발시킨다'][answer - 1] }}</span>
          </button>
        </div>
        <footer>
          <span>{{ selectedAnswer ? `${selectedAnswer}번을 선택했습니다.` : '답안을 직접 눌러보세요.' }}</span>
          <button type="button" :disabled="!selectedAnswer" @click="submitted = true">{{ submitted ? '제출 완료' : '정답 제출' }}</button>
        </footer>
      </article>
    </div>

    <details v-if="showcase" class="framework-package-guide">
      <summary>실제 프레임워크 21종과 역할 보기</summary>
      <div>
        <article v-for="item in frameworks" :key="item.key">
          <span>{{ item.group }}</span><strong>{{ item.name }}</strong><small>{{ item.tone }}</small><em>{{ item.license }}</em>
        </article>
      </div>
      <p>각 패키지는 PC 전용 체험실에서 선택할 때만 불러옵니다. Kendo UI와 DevExtreme은 비교용 상용 평가판이며 정식 채택 전 개발자 라이선스가 필요합니다.</p>
    </details>

    <p v-if="safeMode" class="framework-safe-note">현재 주소가 안전모드라 전체 UI 변경이 잠겨 있습니다. 주소에서 <code>?safe=1</code>을 지우면 선택할 수 있습니다.</p>
    <p v-else class="framework-safety-note">문제·정답·학습 기록은 바뀌지 않습니다. <b>기본 CBT</b>를 누르면 즉시 원래 UI로 돌아갑니다.</p>
    <a v-if="showcase" class="framework-full-lab" href="./ui-framework-lab.html" target="_blank" rel="noopener">PC 전용 · 실제 UI 프레임워크 21종 전체 체험실 열기 →</a>
  </section>
</template>

<style scoped>
.framework-picker{display:grid;gap:10px}.framework-picker.showcase{margin-top:18px;padding:22px;border:1px solid var(--line);border-radius:var(--ui-card-radius,18px);background:var(--surface);box-shadow:var(--ui-card-shadow,var(--shadow))}.framework-picker>header{display:flex;align-items:end;justify-content:space-between;gap:18px}.framework-picker>header span{color:var(--primary);font-size:.52rem;font-weight:900;letter-spacing:.12em}.framework-picker>header h2{margin:5px 0 0;font-size:1.05rem}.framework-picker>header p{max-width:520px;margin:0;color:var(--muted);font-size:.58rem;line-height:1.6}.framework-options{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.showcase .framework-options{margin-top:5px}.framework-options>button{min-width:0;min-height:88px;padding:9px;border:1px solid var(--line);border-radius:var(--ui-control-radius,11px);color:var(--text);background:var(--surface-2);display:grid;grid-template-columns:32px minmax(0,1fr);align-content:center;gap:3px 7px;text-align:left;transition:transform .18s ease,border-color .18s ease,background .18s ease}.framework-options>button:hover:not(:disabled){transform:translateY(-2px);border-color:var(--primary)}.framework-options>button.selected{border-color:var(--primary);background:var(--primary-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 12%,transparent)}.framework-options b{grid-row:1 / 3;width:32px;height:32px;border-radius:8px;color:#fff;background:var(--primary);display:grid;place-items:center;font-size:.52rem}.framework-options span,.framework-options strong,.framework-options small,.framework-options em{min-width:0;display:block}.framework-options strong{overflow:hidden;font-size:.57rem;text-overflow:ellipsis;white-space:nowrap}.framework-options small{margin-top:2px;color:var(--muted);font-size:.44rem}.framework-options em{grid-column:1 / -1;color:var(--muted);font-size:.44rem;font-style:normal}.framework-option-material b{background:#6750a4}.framework-option-prime b{background:#10b981}.framework-option-naive b{background:#18a058}.framework-option-quasar b{background:#1976d2}.framework-option-bootstrap b{background:#6f42c1}.framework-live-demo{padding:14px;border:1px solid var(--line);border-radius:var(--ui-card-radius,14px);background:var(--bg)}.framework-live-demo>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.framework-live-demo>header small,.framework-live-demo>header strong{display:block}.framework-live-demo>header small{color:var(--muted);font-size:.47rem}.framework-live-demo>header strong{margin-top:2px;font-size:.72rem}.framework-live-demo>header>span{padding:5px 8px;border-radius:999px;color:var(--primary);background:var(--primary-soft);font-size:.52rem;font-weight:850}.framework-demo-progress{height:5px;margin:10px 0 12px;border-radius:999px;background:var(--line);overflow:hidden}.framework-demo-progress i{display:block;width:35%;height:100%;border-radius:inherit;background:var(--primary)}.framework-live-demo article{padding:16px;border:var(--ui-border-width,1px) solid var(--line);border-radius:var(--ui-card-radius,12px);background:var(--surface);box-shadow:var(--ui-card-shadow,none)}.framework-live-demo article>small{color:var(--primary);font-size:.49rem;font-weight:850}.framework-live-demo h3{margin:7px 0 12px;font-size:.75rem;line-height:1.55}.framework-live-demo article>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}.framework-live-demo article>div button{min-height:40px;padding:7px 9px;border:1px solid var(--line);border-radius:var(--ui-control-radius,8px);color:var(--text);background:var(--surface-2);display:flex;align-items:center;gap:8px;text-align:left}.framework-live-demo article>div button.selected{border-color:var(--primary);background:var(--primary-soft);box-shadow:inset 3px 0 0 var(--primary)}.framework-live-demo article>div button b{flex:0 0 24px;width:24px;height:24px;border-radius:50%;color:#fff;background:var(--primary);display:grid;place-items:center;font-size:.52rem}.framework-live-demo article>div button span{font-size:.56rem}.framework-live-demo article>footer{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px}.framework-live-demo article>footer span{color:var(--muted);font-size:.51rem}.framework-live-demo article>footer button{min-height:36px;padding:0 13px;border-radius:var(--ui-control-radius,8px);color:#fff;background:var(--primary);font-size:.55rem;font-weight:850}.framework-live-demo article>footer button:disabled{opacity:.42}.framework-safety-note,.framework-safe-note{margin:0;color:var(--muted);font-size:.5rem;line-height:1.5}.framework-safe-note{padding:8px;border-radius:8px;color:#8c5b00;background:#fff5d9}.framework-safety-note b{color:var(--primary)}
.framework-full-lab{min-height:42px;padding:0 14px;border:1px solid color-mix(in srgb,var(--primary) 35%,var(--line));border-radius:var(--ui-control-radius,10px);color:#fff;background:linear-gradient(135deg,var(--primary),var(--primary-2));display:flex;align-items:center;justify-content:center;font-size:.57rem;font-weight:900;text-align:center}
.framework-package-guide{padding:11px;border:1px solid var(--line);border-radius:var(--ui-card-radius,11px);background:var(--surface-2)}.framework-package-guide summary{color:var(--primary);font-size:.57rem;font-weight:900;cursor:pointer}.framework-package-guide>div{margin-top:10px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.framework-package-guide article{min-width:0;padding:8px;border:1px solid var(--line);border-radius:var(--ui-control-radius,8px);background:var(--surface)}.framework-package-guide article span,.framework-package-guide article strong,.framework-package-guide article small,.framework-package-guide article em{display:block}.framework-package-guide article span{color:var(--primary);font-size:.4rem;font-weight:850}.framework-package-guide article strong{margin-top:2px;font-size:.53rem}.framework-package-guide article small{margin-top:3px;color:var(--muted);font-size:.43rem;line-height:1.45}.framework-package-guide article em{margin-top:4px;color:var(--muted);font-size:.4rem;font-style:normal}.framework-package-guide>p{margin:10px 0 0;color:var(--muted);font-size:.46rem;line-height:1.55}
@media(max-width:980px){.framework-options{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:620px){.framework-picker.showcase{padding:17px}.framework-picker>header{display:block}.framework-picker>header p{margin-top:8px}.framework-options{grid-template-columns:1fr 1fr}.framework-options>button{min-height:82px}.framework-live-demo article>div{grid-template-columns:1fr}.framework-live-demo article>footer{align-items:flex-start;flex-direction:column}.framework-live-demo article>footer button{width:100%}.framework-package-guide>div{grid-template-columns:1fr 1fr}}
</style>
