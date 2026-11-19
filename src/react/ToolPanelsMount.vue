<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { ToolPanels } from './ToolPanels';
import type { PanelProps } from './studyModels';
const props = defineProps<{ model: PanelProps }>();
const host = ref<HTMLDivElement>();
let root: Root | undefined;
function render() { root?.render(createElement(ToolPanels, props.model)); }
onMounted(() => { root = createRoot(host.value!); render(); });
watch(() => props.model, render);
onBeforeUnmount(() => root?.unmount());
</script>
<template><div ref="host" data-react-view="tool-panels"></div></template>
