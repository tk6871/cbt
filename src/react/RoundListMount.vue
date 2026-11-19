<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { RoundList, type StudyRound } from './RoundList';
const props = defineProps<{ model: {rows: StudyRound[]} }>();
const host = ref<HTMLDivElement>();
let root: Root | undefined;
function render() { root?.render(createElement(RoundList, props.model)); }
onMounted(() => { root = createRoot(host.value!); render(); });
watch(() => props.model, render);
onBeforeUnmount(() => root?.unmount());
</script>
<template><div ref="host" data-react-view="rounds"></div></template>
