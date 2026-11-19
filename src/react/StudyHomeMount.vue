<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { StudyHome } from './StudyHome';
import type { StudyHomeProps } from './studyModels';
const props = defineProps<{ model: StudyHomeProps }>();
const host = ref<HTMLDivElement>();
let root: Root | undefined;
function render() { root?.render(createElement(StudyHome, props.model)); }
onMounted(() => { root = createRoot(host.value!); render(); });
watch(() => props.model, render);
onBeforeUnmount(() => root?.unmount());
</script>
<template><div ref="host" data-react-view="study-home"></div></template>
