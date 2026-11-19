<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DialogRoot, DialogOverlay, DialogContent, DialogTitle, DialogDescription } from 'reka-ui';
import SettingsContent from './SettingsContent.vue';
import { Monitor, Palette, ListChecks, BookOpen, Wrench, Database } from '@lucide/vue';
import { settingsCategories, visibleSettings, type SettingsCategory, type SettingsValues, type SettingsContext, type SettingChange, type SettingsAction } from './settingsCatalog';
const props = withDefaults(defineProps<{ values: SettingsValues; context: SettingsContext; mode?: 'quick' | 'full' | 'page' }>(), { mode: 'quick' });
const embedded = computed(() => props.mode === 'page');
const detailed = computed(() => props.mode !== 'quick');
const emit = defineEmits<{ change: [change: SettingChange]; action: [action: SettingsAction] }>();
const query = ref('');
const body = ref<HTMLElement>();
const icons = { appearance: Palette, device: Monitor, solving: ListChecks, explanation: BookOpen, tools: Wrench, data: Database };
const sectionKey = 'cbt-settings-section';
function initialSection(): SettingsCategory {
 try {
  const saved = settingsCategories.find(item => item.id === sessionStorage.getItem(sectionKey));
  if (saved) return saved.id;
 } catch {}
 return props.context.session ? 'solving' : 'appearance';
}
const section = ref(initialSection());
const searching = computed(() => Boolean(query.value.trim()));
const visible = computed(() => visibleSettings(section.value, query.value, props.context));
const heading = computed(() => searching.value ? '검색 결과' : settingsCategories.find(item => item.id === section.value)!.label);
function selectSection(id: SettingsCategory) {
 section.value = id;
 query.value = '';
 try { sessionStorage.setItem(sectionKey, id); } catch {}
}
watch([query, section], () => { if (body.value) body.value.scrollTop = 0; }, { flush: 'post' });
</script>
<template>
 <DialogRoot :open="true" :modal="!embedded" @update:open="value => { if (!value) emit('action', 'close'); }">
  <Teleport to="body" :disabled="embedded">
   <DialogOverlay v-if="!embedded" class="study-settings-shade" />
   <component :is="embedded ? 'section' : DialogContent" class="settings-panel settings-hub" :class="{ 'settings-page': embedded, 'settings-quick': !detailed }" aria-describedby="study-settings-description">
    <header class="settings-hub-header"><div><component :is="embedded ? 'h2' : DialogTitle">{{ detailed ? '전체 설정' : '화면과 학습 데이터' }}</component><component :is="embedded ? 'p' : DialogDescription" id="study-settings-description">{{ context.session ? '답안과 진도는 유지됩니다. 시험 타이머는 계속 진행됩니다.' : '변경 즉시 적용하고 이 기기에 자동 저장합니다.' }}</component></div><button type="button" :aria-label="embedded ? '설정에서 돌아가기' : '설정 닫기'" @click="emit('action', 'close')">{{ embedded ? '←' : '×' }}</button></header>
    <div class="settings-hub-search"><label for="study-settings-search">설정 찾기</label><input id="study-settings-search" v-model="query" type="search" placeholder="글씨, 답안, 다크, 동기화…" autocomplete="off"><button v-if="searching" type="button" @click="query = ''">검색 지우기</button></div>
    <div class="settings-hub-layout">
     <nav class="settings-category-nav" aria-label="설정 목차">
      <button v-for="item in settingsCategories" :key="item.id" type="button" :aria-pressed="!searching && section === item.id" @click="selectSection(item.id)">
       <component :is="icons[item.id]" :size="18" aria-hidden="true" />{{ item.label }}
      </button>
     </nav>
     <div ref="body" class="settings-hub-body">
      <h3 class="settings-section-title" aria-live="polite">{{ heading }}</h3>
      <p v-if="searching && !visible.size" class="settings-empty">일치하는 설정이 없습니다.</p>
      <SettingsContent :values="values" :context="context" :visible="visible" @change="emit('change', $event)" @action="emit('action', $event)"><template #account><slot name="account" /></template></SettingsContent>

     </div>
    </div>
    <footer><button v-if="!detailed" class="settings-open-full" type="button" @click="emit('action', 'full')">전체 설정 열기 ↗</button><span v-else>v{{ context.version }} · 자동 저장</span><button type="button" @click="emit('action', 'close')">{{ context.session ? '풀이로 돌아가기' : '돌아가기' }}</button></footer>
   </component>
  </Teleport>
 </DialogRoot>
</template>
<style src="../react/tools/study-settings.css"></style>
