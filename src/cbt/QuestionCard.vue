<script setup lang="ts">
import {createElement} from 'react';
import {useAttrs} from 'vue';
import ReactSurface from '../react/ReactSurface.vue';
import QuestionCard, {type QuestionCardFields} from '../react/session/QuestionCard';
defineOptions({inheritAttrs:false});
const props=defineProps<QuestionCardFields>();
const attrs=useAttrs();
const emit=defineEmits<{
  choose: [choice: number];
  toggleBookmark: [];
  toggleKeep: [];
  askAi: [];
  activate: [];
  setConfidence: [value: 'sure' | 'unsure' | 'guess'];
  setMistakeReason: [value: 'concept' | 'formula' | 'unit' | 'careless'];
  updateStudyNote: [note: string];
}>();
const draw=()=>createElement(QuestionCard,{
  ...props,id:attrs.id as string | undefined,
  onChoose: value=>emit('choose',value),
  onToggleBookmark: ()=>emit('toggleBookmark'),
  onToggleKeep: ()=>emit('toggleKeep'),
  onAskAi: ()=>emit('askAi'),
  onActivate: ()=>emit('activate'),
  onSetConfidence: value=>emit('setConfidence',value),
  onSetMistakeReason: value=>emit('setMistakeReason',value),
  onUpdateStudyNote: value=>emit('updateStudyNote',value),
});
</script>
<template><ReactSurface :draw="draw"/></template>
