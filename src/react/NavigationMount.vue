<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watchEffect} from 'vue';
import {createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import { SubjectPicker, MaterialSwitch } from './LearningNavigation';
import type { SubjectSelection, MaterialSelection } from './studyModels';
const props=defineProps<{subject?:SubjectSelection;material?:MaterialSelection}>();
const host=ref<HTMLDivElement>();let root:Root|undefined;
function render(){
  if(props.subject)root?.render(createElement(SubjectPicker,props.subject));
  else if(props.material)root?.render(createElement(MaterialSwitch,props.material));
}
onMounted(()=>{root=createRoot(host.value!);render()});
watchEffect(render);onBeforeUnmount(()=>root?.unmount());
</script>
<template><div ref="host" style="display:contents"></div></template>
