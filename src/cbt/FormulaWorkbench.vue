<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import FormulaWorkbench from '../react/tools/FormulaWorkbench';
const emit=defineEmits<{close:[]}>();
</script>
<template><ReactSurface :draw="()=>createElement(FormulaWorkbench,{onClose:()=>emit('close')})"/></template>
