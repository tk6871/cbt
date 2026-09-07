<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { DialogRoot, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from 'reka-ui';
import SettingsContent from './SettingsContent.vue';
import type { SettingsValues, SettingsContext, SettingChange, SettingsAction } from './settingsCatalog';
const props = withDefaults(defineProps<{ values: SettingsValues; context: SettingsContext; mode?: 'quick' | 'full' | 'page' }>(), { mode: 'quick' });
const embedded = computed(() => props.mode === 'page');
const detailed = computed(() => props.mode !== 'quick');
const emit = defineEmits<{ change: [change: SettingChange]; action: [action: SettingsAction] }>();
const query = ref('');
const body = ref<HTMLElement>();
const categories = [
 {key:'display',label:'기기·동적 UI'}, {key:'experimental',label:'학습 도구'},
 {key:'solveLayout',label:'문제풀이 화면'}, {key:'visualStyle',label:'테마·글씨'},
 {key:'answerLayout',label:'답안 선택'}, {key:'data',label:'기록·동기화'},
];
async function jump(key: string) {
 query.value = '';
 await nextTick();
 const target = body.value?.querySelector<HTMLElement>(`[data-setting="${key}"]`);
 if (target && body.value) body.value.scrollTo({top: target.getBoundingClientRect().top - body.value.getBoundingClientRect().top + body.value.scrollTop, behavior:'auto'});
}
</script>
<template>
 <DialogRoot :open="true" :modal="!embedded" @update:open="value => { if (!value) emit('action', 'close'); }">
  <Teleport to="body" :disabled="embedded">
   <DialogOverlay v-if="!embedded" class="study-settings-shade" />
   <component :is="embedded ? 'section' : DialogContent" class="settings-panel settings-hub" :class="{ 'settings-page': embedded, 'settings-quick': !detailed }" aria-describedby="study-settings-description">
    <header class="settings-hub-header"><div><span>PERSONAL SETTINGS</span><component :is="embedded ? 'h2' : DialogTitle">{{ detailed ? '전체 설정' : '화면과 학습 데이터' }}</component><component :is="embedded ? 'p' : DialogDescription" id="study-settings-description">{{ context.session ? '답안과 진도는 유지됩니다. 시험 타이머는 계속 진행됩니다.' : '변경 즉시 적용하고 이 기기에 자동 저장합니다.' }}</component></div><button type="button" :aria-label="embedded ? '설정에서 돌아가기' : '설정 닫기'" @click="emit('action', 'close')">{{ embedded ? '←' : '×' }}</button></header>
    <div v-if="detailed" class="settings-hub-search"><label for="study-settings-search">설정 찾기</label><input id="study-settings-search" v-model="query" type="search" placeholder="글씨, 답안, 다크, 동기화…" autocomplete="off"></div>
    <button v-else type="button" class="settings-open-full" @click="emit('action', 'full')">전체 설정 열기 <span>같은 항목과 설명을 넓은 화면에서 보기 →</span></button>
    <div class="settings-hub-layout">
     <nav v-if="detailed" class="settings-category-nav" aria-label="설정 목차"><p>항목 바로가기</p><button v-for="item in categories" :key="item.key" type="button" @click="jump(item.key)">{{ item.label }}</button><small>모든 설정이 아래에 이어집니다. 목차를 누르면 해당 위치로 이동합니다.</small></nav>
     <div ref="body" class="settings-hub-body">
      <SettingsContent :values="values" :context="context" :query="query" @change="emit('change', $event)" @action="emit('action', $event)"><template #account><slot name="account" /></template></SettingsContent>
      <p v-if="query.trim()" class="settings-search-note">검색어와 일치하는 항목을 표시합니다. <button type="button" @click="query = ''">검색 지우고 전체 보기</button></p>
     </div>
    </div>
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

/* Restore the explanatory option cards shared by the old popup and full page. */
.settings-panel.settings-quick{height:min(850px,calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));width:min(560px,calc(100vw - 24px))}
.settings-hub-body{padding:0 0 18px}.settings-page .settings-hub-body{padding-inline:0}
.legacy-settings-content>.setting-group{padding:22px;border-bottom:1px solid var(--line);margin:0}
.legacy-settings-content>.setting-group>span,.legacy-settings-content .hotspot-indicator-setting>span{display:block;font-size:16px;font-weight:800;margin-bottom:10px;color:var(--text)}
.legacy-settings-content .setting-description,.legacy-settings-content .data-setting>p{font-size:14px;line-height:1.7;color:var(--muted)}
.legacy-settings-content button{min-height:44px}
.legacy-settings-content button>strong{font-size:17px}
.legacy-settings-content button>span{font-size:14px;line-height:1.5}
.legacy-settings-content button>small{font-size:12px;line-height:1.5}
.legacy-settings-content .font-options button,.legacy-settings-content .data-setting button{font-size:14px}
.legacy-settings-content button[aria-pressed=true]{outline:2px solid var(--primary);outline-offset:-2px}
.settings-panel.settings-hub .legacy-settings-content button>strong{font-size:16px}
.settings-panel.settings-hub .legacy-settings-content button>small{font-size:12px;line-height:1.5}
.settings-panel.settings-hub .font-family-options{grid-template-columns:repeat(2,minmax(0,1fr))}
.settings-panel.settings-hub .theme-options button:first-child{color:var(--text);background:var(--surface-2);text-shadow:none}
.settings-hub .theme-studio{margin:18px 22px}
.settings-category-nav p{padding:0 12px;font-size:13px;color:var(--text);font-weight:800}
.settings-category-nav small{padding:12px;font-size:12px;line-height:1.7;color:var(--muted)}
.settings-search-note{padding:20px;font-size:14px}.settings-search-note button{color:var(--primary);background:transparent;text-decoration:underline}
@media(min-width:1000px){.settings-page .legacy-settings-content>.setting-group{padding:26px 32px}.settings-page .theme-studio{margin:22px 32px}}
@media(max-width:700px){.settings-category-nav p,.settings-category-nav small{display:none}.settings-panel.settings-quick{height:calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}.legacy-settings-content>.setting-group{padding:18px 16px}.settings-hub .theme-studio{margin:16px}.settings-hub-body{padding:0 0 16px}}
</style>
