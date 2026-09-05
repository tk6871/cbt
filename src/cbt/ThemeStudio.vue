<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger, SwitchRoot, SwitchThumb } from 'reka-ui';
import { Gauge, Palette, RotateCcw, ShieldCheck, Sparkles, WandSparkles } from '@lucide/vue';
import { useUiLab, type UiAccent, type UiDensity, type UiMotion, type UiSurface } from './uiLab';

const emit = defineEmits<{ startTour: [] }>();
const {
  enabled,
  active,
  safeMode,
  density,
  surface,
  motion,
  accent,
  photoOverlay,
  systemPreferenceLabel,
  contrastReport,
  reset,
} = useUiLab();
const detailsOpen = ref(false);
const contrastRatio = ref(0);
const contrastGrade = ref<'좋음' | '보통' | '부족'>('좋음');

const accentOptions: Array<{ value: UiAccent; label: string; color: string }> = [
  { value: 'auto', label: '테마 기본', color: 'linear-gradient(135deg,#1268d3,#e62f83,#ffd90f)' },
  { value: 'blue', label: '블루', color: '#1268d3' },
  { value: 'emerald', label: '에메랄드', color: '#0b8f6a' },
  { value: 'violet', label: '바이올렛', color: '#7655d9' },
  { value: 'pink', label: '핑크', color: '#d83d85' },
  { value: 'yellow', label: '옐로', color: '#d28a00' },
];
const densityOptions: Array<{ value: UiDensity; label: string }> = [
  { value: 'comfortable', label: '편안하게' },
  { value: 'compact', label: '고밀도' },
];
const surfaceOptions: Array<{ value: UiSurface; label: string }> = [
  { value: 'soft', label: '부드러운 카드' },
  { value: 'flat', label: '평면·가볍게' },
  { value: 'glass', label: '투명 유리' },
];
const motionOptions: Array<{ value: UiMotion; label: string }> = [
  { value: 'full', label: '전체' },
  { value: 'reduced', label: '줄이기' },
  { value: 'off', label: '끄기' },
];

async function refreshContrast(): Promise<void> {
  const report = await contrastReport();
  contrastRatio.value = report.ratio;
  contrastGrade.value = report.grade;
}

watch([enabled, density, surface, accent], () => void refreshContrast(), { flush: 'post' });
onMounted(() => void refreshContrast());
</script>

<template>
  <section class="theme-studio" :class="{ active, 'safe-mode': safeMode }">
    <header>
      <div class="theme-studio-heading">
        <span><Palette :size="18" aria-hidden="true" /></span>
        <div><strong>UI·테마 실험실</strong><small>기존 화면을 보존한 선택형 플러그인 UI</small></div>
      </div>
      <SwitchRoot
        :model-value="enabled"
        class="theme-studio-switch"
        :disabled="safeMode"
        aria-label="UI 테마 실험실 켜기"
        @update:model-value="enabled = Boolean($event)"
      ><SwitchThumb class="theme-studio-switch-thumb" /></SwitchRoot>
    </header>

    <p v-if="safeMode" class="theme-studio-safe"><ShieldCheck :size="16" /> 안전모드로 열려 새 UI가 임시로 꺼졌습니다. 주소의 <code>?safe=1</code>을 지우면 저장 설정이 돌아옵니다.</p>
    <p v-else class="theme-studio-status"><ShieldCheck :size="16" /> {{ active ? '새 UI를 비교 중입니다. 설정은 이 기기에 자동 저장됩니다.' : 'OFF에서는 기존 UI와 동작을 그대로 사용합니다.' }}</p>

    <CollapsibleRoot v-model:open="detailsOpen" class="theme-studio-collapsible">
      <CollapsibleTrigger class="theme-studio-open" :disabled="!active">
        <WandSparkles :size="17" /> {{ detailsOpen ? '세부 설정 닫기' : '세부 설정 열기' }}
      </CollapsibleTrigger>
      <CollapsibleContent class="theme-studio-content">
        <div class="theme-studio-section">
          <span><Palette :size="15" /> 강조 색상</span>
          <div class="theme-accent-grid">
            <button v-for="item in accentOptions" :key="item.value" type="button" :class="{ selected: accent === item.value }" @click="accent = item.value">
              <i :style="{ background: item.color }"></i><small>{{ item.label }}</small>
            </button>
          </div>
        </div>

        <div class="theme-studio-section">
          <span><Gauge :size="15" /> 화면 밀도</span>
          <div class="theme-segmented">
            <button v-for="item in densityOptions" :key="item.value" type="button" :class="{ selected: density === item.value }" @click="density = item.value">{{ item.label }}</button>
          </div>
        </div>

        <div class="theme-studio-section">
          <span><Sparkles :size="15" /> 카드 표현</span>
          <div class="theme-segmented three">
            <button v-for="item in surfaceOptions" :key="item.value" type="button" :class="{ selected: surface === item.value }" @click="surface = item.value">{{ item.label }}</button>
          </div>
        </div>

        <div class="theme-studio-section">
          <span>배경사진 위 가림막 <b>{{ photoOverlay }}%</b></span>
          <input v-model.number="photoOverlay" type="range" min="20" max="92" step="2" aria-label="테마 배경사진 가림막 강도">
        </div>

        <div class="theme-studio-section">
          <span>움직임</span>
          <div class="theme-segmented three">
            <button v-for="item in motionOptions" :key="item.value" type="button" :class="{ selected: motion === item.value }" @click="motion = item.value">{{ item.label }}</button>
          </div>
          <small class="theme-device-preference">기기 감지: {{ systemPreferenceLabel }}</small>
        </div>

        <div class="theme-studio-preview" aria-label="테마 미리보기">
          <article><i></i><strong>문제 카드</strong><p>글자와 배경 명암을 실시간으로 확인합니다.</p><button type="button">답안 선택</button></article>
          <aside :class="`is-${contrastGrade}`"><span>가독성</span><strong>{{ contrastGrade }}</strong><small>{{ contrastRatio.toFixed(1) }} : 1</small></aside>
        </div>

        <footer>
          <button type="button" @click="emit('startTour')"><Sparkles :size="15" /> 새 기능 안내 보기</button>
          <button type="button" @click="reset"><RotateCcw :size="15" /> 세부 설정 초기화</button>
        </footer>
      </CollapsibleContent>
    </CollapsibleRoot>
  </section>
</template>

<style scoped>
.theme-studio{margin:0 23px 17px;padding:15px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 7%,var(--surface)),var(--surface));box-shadow:0 10px 28px color-mix(in srgb,var(--primary) 8%,transparent)}
.theme-studio>header,.theme-studio-heading,.theme-studio-status,.theme-studio-safe,.theme-studio-section>span,.theme-studio-content footer button{display:flex;align-items:center}.theme-studio>header{justify-content:space-between;gap:12px}.theme-studio-heading{gap:10px}.theme-studio-heading>span{width:36px;height:36px;border-radius:11px;color:var(--primary);background:var(--primary-soft);display:grid;place-items:center}.theme-studio-heading strong,.theme-studio-heading small{display:block}.theme-studio-heading strong{font-size:.72rem}.theme-studio-heading small{margin-top:3px;color:var(--muted);font-size:.55rem}.theme-studio-switch{position:relative;width:46px;height:26px;padding:3px;border-radius:999px;background:var(--line);transition:background .2s var(--ease-3,ease)}.theme-studio-switch[data-state=checked]{background:var(--primary)}.theme-studio-switch:disabled{opacity:.45}.theme-studio-switch-thumb{width:20px;height:20px;border-radius:50%;background:#fff;display:block;box-shadow:0 2px 7px #0003;transition:transform .2s var(--ease-spring-3,ease)}.theme-studio-switch-thumb[data-state=checked]{transform:translateX(20px)}
.theme-studio-status,.theme-studio-safe{margin:12px 0 0;gap:6px;color:var(--muted);font-size:.55rem;line-height:1.5}.theme-studio-safe{padding:9px;border-radius:8px;color:#8c5b00;background:#fff5d9}.theme-studio-open{width:100%;min-height:38px;margin-top:12px;border:1px solid var(--line);border-radius:9px;color:var(--primary);background:var(--surface);display:flex;align-items:center;justify-content:center;gap:7px;font-size:.61rem;font-weight:850}.theme-studio-open:disabled{opacity:.45;cursor:not-allowed}.theme-studio-content{padding-top:13px;display:grid;gap:13px}.theme-studio-section{display:grid;gap:7px}.theme-studio-section>span{justify-content:space-between;gap:6px;color:var(--text);font-size:.59rem;font-weight:850}.theme-accent-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px}.theme-accent-grid button{min-width:0;padding:7px 3px;border:1px solid transparent;border-radius:9px;color:var(--muted);background:var(--surface-2);display:grid;justify-items:center;gap:4px}.theme-accent-grid button.selected{border-color:var(--primary);color:var(--text)}.theme-accent-grid i{width:22px;height:22px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #0002}.theme-accent-grid small{font-size:.46rem}.theme-segmented{padding:3px;border-radius:9px;background:var(--surface-2);display:grid;grid-template-columns:repeat(2,1fr);gap:3px}.theme-segmented.three{grid-template-columns:repeat(3,1fr)}.theme-segmented button{min-height:34px;border-radius:7px;color:var(--muted);background:transparent;font-size:.55rem;font-weight:800}.theme-segmented button.selected{color:var(--primary);background:var(--surface);box-shadow:0 3px 10px #00000012}.theme-studio-section input[type=range]{width:100%;accent-color:var(--primary)}.theme-device-preference{color:var(--muted);font-size:.5rem}.theme-studio-preview{padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg);display:grid;grid-template-columns:1fr 74px;gap:9px}.theme-studio-preview article{position:relative;padding:11px;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}.theme-studio-preview article>i{position:absolute;inset:0 auto 0 0;width:4px;background:var(--primary)}.theme-studio-preview strong,.theme-studio-preview p{display:block}.theme-studio-preview strong{font-size:.62rem}.theme-studio-preview p{margin:5px 0;color:var(--muted);font-size:.5rem}.theme-studio-preview article button{min-height:28px;padding:0 9px;border-radius:6px;color:#fff;background:var(--primary);font-size:.49rem;font-weight:800}.theme-studio-preview aside{border-radius:9px;color:#147557;background:#e7f8f1;display:grid;place-content:center;text-align:center}.theme-studio-preview aside.is-보통{color:#8b6500;background:#fff5d8}.theme-studio-preview aside.is-부족{color:#ad3340;background:#fff0f1}.theme-studio-preview aside span,.theme-studio-preview aside small{font-size:.44rem}.theme-studio-preview aside strong{font-size:.66rem}.theme-studio-content footer{display:flex;gap:6px}.theme-studio-content footer button{min-height:34px;padding:0 10px;gap:5px;border:1px solid var(--line);border-radius:8px;color:var(--text);background:var(--surface-2);font-size:.52rem;font-weight:800}
@media(max-width:520px){.theme-studio{margin:0 15px 15px}.theme-accent-grid{grid-template-columns:repeat(3,1fr)}.theme-segmented.three{grid-template-columns:1fr}.theme-studio-content footer{display:grid}.theme-studio-preview{grid-template-columns:1fr}.theme-studio-preview aside{min-height:54px;grid-auto-flow:column;align-items:center;gap:6px}}
</style>
