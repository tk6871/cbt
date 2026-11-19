<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { Login } from './Login';
import type { LoginModel } from './adminModels';
const props = defineProps<{ model: LoginModel }>();
const host = ref<HTMLDivElement>();
let root: Root | undefined;
function render() { root?.render(createElement(Login, props.model)); }
onMounted(() => { root = createRoot(host.value!); render(); });
watch(() => props.model, render);
onBeforeUnmount(() => root?.unmount());
</script>
<template><div ref="host" data-react-view="admin-login"></div></template>
