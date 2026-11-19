<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import {ContentsTree} from '../react/reader/ContentsTree';
import type {QuestionItem} from './types';
import type {TextbookKey} from './textbookPages';
import type {ContentsRow} from './textbookContents';
const props=defineProps<{book:TextbookKey;items:QuestionItem[];selected:string}>();
const emit=defineEmits<{select:[row:ContentsRow]}>();
const draw=()=>createElement(ContentsTree,{...props,key:props.book,onSelect:(row:ContentsRow)=>emit('select',row)});
</script>
<template><ReactSurface :draw="draw"/></template>
<style src="./textbookContents.css"></style>
