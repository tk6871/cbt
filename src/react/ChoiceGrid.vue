<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnswerChoices, type AnswerOption } from './AnswerChoices';
const props = defineProps<{ options: AnswerOption[] }>();
const emit = defineEmits<{ choose: [number] }>();
const host = ref<HTMLDivElement>();
let root: Root | undefined;
function render() { root?.render(createElement(AnswerChoices,{ options:props.options, choose:n=>emit('choose',n) })); }
onMounted(()=>{root=createRoot(host.value!);render();});
watch(()=>props.options,render);
onBeforeUnmount(()=>root?.unmount());
</script>
<template><div ref="host" data-react-view="answer-choices"></div></template>
