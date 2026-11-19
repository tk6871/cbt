<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import TextbookLibrary from '../react/reader/TextbookLibrary';
import type {ComponentProps} from 'react';
type Props=ComponentProps<typeof TextbookLibrary>;
const props=defineProps<Pick<Props,'book'|'items'|'loading'|'error'|'choosing'|'pages'>>();
const emit=defineEmits<{book:Parameters<Props['onBook']>;open:Parameters<Props['onOpen']>;round:Parameters<Props['onRound']>;study:Parameters<Props['onStudy']>;retry:[]}>();
const draw=()=>createElement(TextbookLibrary,{...props,key:props.book,onBook:key=>emit('book',key),onOpen:s=>emit('open',s),onRound:id=>emit('round',id),onStudy:(items,label)=>emit('study',items,label),onRetry:()=>emit('retry')});
</script>
<template><ReactSurface :draw="draw"/></template>
