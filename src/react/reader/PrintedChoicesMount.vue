<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watch} from 'vue';
import {createRoot,type Root} from 'react-dom/client';
import {createElement} from 'react';
import {PrintedChoices,type ImageChoice} from './PrintedChoices';
const props=defineProps<{choices:ImageChoice[];selected?:number}>();
const emit=defineEmits<{choose:[number]}>();
const host=ref<HTMLDivElement>();
let root:Root|undefined;
function render(){
  root?.render(createElement(PrintedChoices,{...props,buttonClass:'image-answer-hotspot',onChoose:n=>emit('choose',n)}));
}
onMounted(()=>{root=createRoot(host.value!);render();});
watch(()=>[props.choices,props.selected],render);
onBeforeUnmount(()=>root?.unmount());
</script>
<template><div ref="host" style="display: contents" data-react-view="printed-choices"></div></template>
