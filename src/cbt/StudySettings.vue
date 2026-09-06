<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import { DialogRoot, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from 'reka-ui';
import { settingGroups, settingsHelp, settingsCategories, type SettingsValues, type SettingsContext, type SettingChange, type SettingsAction, type SettingsCategory } from './settingsCatalog';
import OptionalFeatureBoundary from '../components/OptionalFeatureBoundary.vue';
const ThemeStudio = defineAsyncComponent(() => import('./ThemeStudio.vue'));
const props = withDefaults(defineProps<{ values: SettingsValues; context: SettingsContext; mode?: 'quick' | 'full' | 'page' }>(), { mode: 'quick' });
const embedded = computed(() => props.mode === 'page');
const detailed = computed(() => props.mode !== 'quick');
const emit = defineEmits<{ change: [change: SettingChange]; action: [action: SettingsAction] }>();
const category = ref<SettingsCategory>('quick');
const query = ref('');
const body = ref<HTMLElement>();
const needle = computed(() => query.value.trim().toLocaleLowerCase());
const groups = computed(() => settingGroups.filter(group => {
  if (group.jewelryOnly && !props.context.jewelry || group.industrialOnly && props.context.jewelry) return false;
  return needle.value
    ? [group.title, group.description, settingsHelp[group.key], ...group.options.filter(option => props.context.jewelry || option.value !== 'sunjae').map(option => option.label)].join(' ').toLocaleLowerCase().includes(needle.value)
    : !detailed.value || category.value === 'quick' ? group.quick : group.category === category.value;
}));
const showData = computed(() => needle.value ? /기록|동기화|로그인|백업|복구|계정/.test(needle.value) : category.value === 'data');
const showStudio = computed(() => needle.value ? /실험실|색상|밀도|고급/.test(needle.value) : category.value === 'tools');
function selectCategory(value: SettingsCategory) { query.value = ''; category.value = value; }
watch([category, needle], async () => { await nextTick(); body.value?.scrollTo({ top: 0 }); });
function change(key: keyof SettingsValues, value: string | number | boolean) { emit('change', { key, value } as SettingChange); }
</script>

<template>
  <DialogRoot :open="true" :modal="!embedded" @update:open="value => { if (!value) emit('action', 'close'); }">
    <Teleport to="body" :disabled="embedded">
      <DialogOverlay v-if="!embedded" class="study-settings-shade" />
      <component :is="embedded ? 'section' : DialogContent" class="settings-panel settings-hub" :class="{ 'settings-page': embedded, 'settings-quick': !detailed }" aria-describedby="study-settings-description">
        <header class="settings-hub-header"><div><component :is="embedded ? 'h2' : DialogTitle">{{ detailed ? '전체 설정' : '빠른 설정' }}</component><component :is="embedded ? 'p' : DialogDescription" id="study-settings-description">{{ context.session ? '답안과 진도는 유지됩니다. 시험 타이머는 계속 진행됩니다.' : '변경 즉시 적용하고 이 기기에 자동 저장합니다.' }}</component></div><button type="button" :aria-label="embedded ? '설정에서 돌아가기' : '설정 닫기'" @click="emit('action', 'close')">{{ embedded ? '←' : '×' }}</button></header>
        <div v-if="detailed" class="settings-hub-search"><label for="study-settings-search">설정 찾기</label><input id="study-settings-search" v-model="query" type="search" placeholder="글씨, 답안, 다크, 동기화…" autocomplete="off"></div>
        <div class="settings-hub-layout">
          <nav v-if="detailed" class="settings-category-nav" aria-label="설정 분류"><button v-for="item in settingsCategories" :key="item.id" type="button" :aria-pressed="!needle && category === item.id" @click="selectCategory(item.id)">{{ item.label }}</button></nav>
          <div ref="body" class="settings-hub-body">
            <p v-if="!groups.length && !showData && !showStudio" class="settings-empty" role="status">일치하는 설정이 없어요. 다른 단어로 찾아보세요.</p>
            <section v-for="group in groups" :key="group.key" class="settings-control" :data-setting="group.key">
              <h3>{{ group.title }}</h3><p>{{ group.description }}</p>
              <p v-if="detailed" class="settings-help">{{ settingsHelp[group.key] }}</p>
              <span v-if="detailed" class="settings-current">현재: {{ group.options.find(option => option.value === values[group.key])?.label || values[group.key] }}</span>
              <div class="settings-choice-row" role="group" :aria-label="group.title"><button v-for="option in group.options.filter(option => context.jewelry || option.value !== 'sunjae')" :key="String(option.value)" type="button" :aria-pressed="values[group.key] === option.value" @click="change(group.key, option.value)">{{ option.label }}</button></div>
              <small v-if="group.key === 'display'">현재: {{ context.displayLabel }}</small>
              <small v-if="group.key === 'fontScale'" class="settings-font-preview" :style="{ fontSize: `${16 * values.fontScale}px` }">가나다 ABC 123 · 문제 글씨 미리보기</small>
              <small v-if="group.key === 'indicator' && values.answerLayout !== 'hotspot'">답안 선택을 ‘이미지 직접 선택’으로 바꾸면 적용됩니다.</small>
            </section>
            <section v-if="!needle && category === 'solving' && context.exam" class="settings-control"><h3>OMR 답안지</h3><button type="button" class="settings-link-button" @click="emit('action', 'omr')">{{ context.omr ? 'OMR 닫기' : 'OMR 열기' }}</button></section>
            <section v-if="!needle && category === 'tools' && !context.session && values.experimental" class="settings-control"><button type="button" class="settings-link-button" @click="emit('action', 'beta')">베타 학습 도구 열기 →</button></section>
            <OptionalFeatureBoundary v-if="detailed && showStudio" label="UI·테마 실험실" compact><ThemeStudio @start-tour="emit('action', 'tour')" /></OptionalFeatureBoundary>
            <template v-if="detailed && showData">
              <slot name="account" />
              <section class="settings-control"><h3>기록 백업</h3><p>오답·진도·시험 기록을 파일로 보관합니다.</p><div class="settings-choice-row"><button type="button" @click="emit('action', 'export')">기록 내보내기</button><button type="button" @click="emit('action', 'import')">기록 불러오기</button></div></section>
              <section v-if="!context.native" class="settings-control"><h3>업데이트 복구</h3><p>화면이 이상할 때 사용하세요. 학습 기록은 보존됩니다.</p><button type="button" class="settings-link-button" @click="emit('action', 'recovery')">복구 화면 열기</button></section>
              <details class="settings-control settings-danger"><summary>기록 초기화</summary><p>저장한 학습 기록을 지우는 작업입니다. 초기화 전에 백업하세요.</p><button type="button" class="settings-link-button" @click="emit('action', 'reset')">전체 초기화</button></details>
            </template>
          </div>
        </div>
        <button v-if="!detailed" type="button" class="settings-open-full" @click="emit('action', 'full')">전체 설정 열기 <span>테마·문제 화면·학습 도구·기록 동기화 →</span></button>
        <footer><span>v{{ context.version }} · 자동 저장</span><button type="button" @click="emit('action', 'close')">{{ context.session ? '풀이로 돌아가기' : '돌아가기' }}</button></footer>
      </component>
    </Teleport>
  </DialogRoot>
</template>

<style>
.study-settings-shade{position:fixed;inset:0;z-index:140;background:#05101e9c}
.settings-panel.settings-hub{position:fixed;z-index:141;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:min(920px,calc(100vw - 40px));height:min(760px,calc(100dvh - 40px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));max-height:none;display:flex;flex-direction:column;overflow:hidden;animation:none;color:var(--text);background:var(--surface);font-size:16px}
.settings-hub>.settings-hub-header{padding:18px 22px;flex-shrink:0;align-items:center}.settings-hub-header h2{font-size:22px;margin:0}.settings-hub-header p{font-size:13px;color:var(--muted);margin:6px 0 0}.settings-hub .settings-hub-header button{width:44px;height:44px;font-size:26px;flex-shrink:0}
.settings-hub-search{padding:12px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;flex-shrink:0}.settings-hub-search label{font-size:13px;white-space:nowrap}.settings-hub-search input{min-width:0;flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:var(--surface-2);color:var(--text)}
.settings-hub-layout{display:flex;flex:1;min-height:0}.settings-category-nav{width:170px;flex-shrink:0;padding:14px 10px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:5px;overflow:auto}.settings-category-nav button{min-height:44px;padding:10px 12px;border-radius:10px;text-align:left;background:transparent;color:var(--muted);font-size:14px;white-space:nowrap}.settings-category-nav button[aria-pressed=true]{background:var(--primary-soft);color:var(--text);font-weight:850}
.settings-hub-body{flex:1;min-width:0;overflow:auto;overscroll-behavior:contain;padding:0 22px 18px;scrollbar-gutter:stable}.settings-control{padding:20px 0;border-bottom:1px solid var(--line)}.settings-control h3{font-size:16px;margin:0 0 7px}.settings-control p{font-size:13px;line-height:1.65;color:var(--muted);margin:0 0 12px}.settings-control>small{display:block;margin-top:10px;color:var(--muted);font-size:12px}.settings-control .settings-font-preview{padding:12px;border-radius:8px;background:var(--surface-2);color:var(--text)}
.settings-choice-row{display:flex;flex-wrap:wrap;gap:7px}.settings-choice-row button,.settings-link-button{min-height:44px;padding:10px 14px;border:1px solid var(--line);border-radius:9px;font-size:14px;font-weight:750;background:var(--surface-2);color:var(--text)}.settings-choice-row button[aria-pressed=true]{border-color:var(--primary);background:var(--primary-soft);box-shadow:inset 0 0 0 1px var(--primary)}.settings-hub-body .theme-studio{margin:18px 0}.settings-hub-body .cloud-sync-panel{margin:18px 0}.settings-empty{margin:30px 0;color:var(--muted);font-size:14px}
.settings-danger summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-size:14px;color:var(--red)}.settings-danger .settings-link-button{color:var(--red)}.settings-hub>footer{flex-shrink:0;border-top:1px solid var(--line);padding:12px 22px;align-items:center;font-size:12px}.settings-hub>footer>button{min-height:44px;padding:10px 18px;border-radius:10px;font-size:14px;background:var(--primary);color:var(--surface)}
.settings-hub button:focus-visible,.settings-hub input:focus-visible,.settings-hub summary:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.settings-panel.settings-quick{width:min(580px,calc(100vw - 24px));height:auto;max-height:calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}.settings-quick .settings-hub-layout{overflow:hidden}.settings-open-full{flex-shrink:0;text-align:left;padding:16px 22px;background:var(--primary-soft);color:var(--text);font-weight:800;border-top:1px solid var(--line);font-size:16px}.settings-open-full span{display:block;font-weight:500;font-size:13px;margin-top:7px;color:var(--muted)}
.settings-current{display:block;font-size:13px;color:var(--primary);margin-bottom:12px;font-weight:700}.settings-control p.settings-help{font-size:14px;line-height:1.8;color:var(--text);max-width:65ch}
.settings-panel.settings-page{position:relative;inset:auto;transform:none;width:100%;max-width:1240px;height:clamp(560px,calc(100dvh - 160px),1000px);margin:0 auto;z-index:auto;box-shadow:none}.settings-page .settings-category-nav{width:190px}.settings-page .settings-hub-body{padding-inline:28px}
@media(max-width:700px){.settings-panel.settings-hub{width:calc(100vw - 20px);height:calc(100dvh - 20px - env(safe-area-inset-top) - env(safe-area-inset-bottom));top:calc(50% + (env(safe-area-inset-top) - env(safe-area-inset-bottom))/2);border-radius:16px}.settings-hub>.settings-hub-header{padding:14px}.settings-hub-search{padding:10px 14px}.settings-hub-layout{flex-direction:column}.settings-category-nav{width:auto;flex-direction:row;flex-shrink:0;padding:8px;border-right:0;border-bottom:1px solid var(--line);gap:4px}.settings-category-nav button{font-size:13px;padding:8px 12px}.settings-hub-body{padding:0 16px 16px}.settings-control{padding:17px 0}.settings-hub>footer{padding:10px 14px}}
@media(max-width:700px){.settings-panel.settings-page{top:auto;width:100%;height:calc(100dvh - 180px);min-height:480px}.settings-page .settings-category-nav{width:auto}.settings-page .settings-hub-body{padding-inline:16px}.settings-panel.settings-quick{height:auto}}
</style>
