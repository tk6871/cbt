<script setup lang="ts">
import {proxyRefs,toRefs} from "vue";
import ReactSurface from "../react/ReactSurface.vue";
import {renderSettingsContent,renderSettingsContentData} from "../react/tools/SettingsContent";
import { computed } from 'vue';
import { settingsHelp, type SettingsValues, type SettingsContext, type SettingChange, type SettingsAction } from './settingsCatalog';
const props = defineProps<{ values: SettingsValues; context: SettingsContext; visible: ReadonlySet<string> }>();
const emit = defineEmits<{ change: [change: SettingChange]; action: [action: SettingsAction] }>();
const isJewelry = computed(() => props.context.jewelry);
const isNativeApp = computed(() => props.context.native);
const theme = computed(() => props.values.theme);
const fontScale = computed(() => props.values.fontScale);
const fontFamilyPreference = computed(() => props.values.fontFamily);
const visualStyle = computed(() => props.values.visualStyle);
const displayPreference = computed(() => props.values.display);
const dynamicUiEnabled = computed(() => props.values.dynamic);
const solveLayoutMode = computed(() => props.values.solveLayout);
const answerLayout = computed(() => props.values.answerLayout);
const hotspotIndicator = computed(() => props.values.indicator);
const restoredImageTheme = computed(() => props.values.imageTheme);
const explanationDisplay = computed(() => props.values.explanationDisplay);
const experimentalFeaturesEnabled = computed(() => props.values.experimental);
const questionJudgmentEnabled = computed(() => props.values.judgment);
const sunjaeRotationSeconds = computed(() => props.values.rotation);
function change<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) { emit('change', { key, value } as SettingChange); }
const setFontScale = (value: SettingsValues['fontScale']) => change('fontScale', value);
const setFontFamilyPreference = (value: SettingsValues['fontFamily']) => change('fontFamily', value);
const setVisualStyle = (value: SettingsValues['visualStyle']) => change('visualStyle', value);
const setDisplayPreference = (value: SettingsValues['display']) => change('display', value);
const setDynamicUiEnabled = (value: SettingsValues['dynamic']) => change('dynamic', value);
const setSolveLayoutMode = (value: SettingsValues['solveLayout']) => change('solveLayout', value);
const setAnswerLayout = (value: SettingsValues['answerLayout']) => change('answerLayout', value);
const setHotspotIndicator = (value: SettingsValues['indicator']) => change('indicator', value);
const setRestoredImageTheme = (value: SettingsValues['imageTheme']) => change('imageTheme', value);
const setExperimentalFeatures = (value: SettingsValues['experimental']) => change('experimental', value);
const setQuestionJudgmentEnabled = (value: SettingsValues['judgment']) => change('judgment', value);
const setSunjaeRotationSeconds = (value: SettingsValues['rotation']) => change('rotation', value);
function matches(key: string) { return props.visible.has(key); }
function sunjaeRotationLabel(seconds: number) { return !seconds ? '끔' : seconds < 60 ? seconds + '초' : seconds / 60 + '분'; }
const model=proxyRefs({
  ...toRefs(props),
  displayPreference,
  setDisplayPreference,
  matches,
  dynamicUiEnabled,
  setDynamicUiEnabled,
  experimentalFeaturesEnabled,
  setExperimentalFeatures,
  emit,
  questionJudgmentEnabled,
  setQuestionJudgmentEnabled,
  solveLayoutMode,
  setSolveLayoutMode,
  isJewelry,
  visualStyle,
  setVisualStyle,
  sunjaeRotationLabel,
  sunjaeRotationSeconds,
  setSunjaeRotationSeconds,
  theme,
  change,
  fontScale,
  setFontScale,
  fontFamilyPreference,
  setFontFamilyPreference,
  restoredImageTheme,
  setRestoredImageTheme,
  settingsHelp,
  explanationDisplay,
  answerLayout,
  setAnswerLayout,
  hotspotIndicator,
  setHotspotIndicator,
  isNativeApp
});
export type SettingsContentModel=typeof model;
</script>
<template><div class="legacy-settings-content"><ReactSurface data-react-view="settings-controls" :draw="() => renderSettingsContent(model)"/><section v-show="matches('data')" data-setting="data"><slot name="account"/></section><ReactSurface data-react-view="settings-controls-data" :draw="() => renderSettingsContentData(model)"/></div></template>
