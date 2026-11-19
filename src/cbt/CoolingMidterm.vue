<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import CoolingMidterm,{type CoolingMidtermFields,type CoolingSelection} from '../react/tools/CoolingMidterm';
const props=defineProps<CoolingMidtermFields>();
const emit=defineEmits<{start:[value:CoolingSelection];search:[];retry:[];resetDraws:[];resume:[id:string];replay:[id:string]}>();
const draw=()=>createElement(CoolingMidterm,{...props,onStart:value=>emit('start',value),onSearch:()=>emit('search'),onRetry:()=>emit('retry'),onResetDraws:()=>emit('resetDraws'),onResume:id=>emit('resume',id),onReplay:id=>emit('replay',id)});
</script>
<template><ReactSurface :draw="draw"/></template>
