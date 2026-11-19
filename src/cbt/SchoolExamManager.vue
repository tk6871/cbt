<script setup lang="ts">
import {createElement} from 'react';
import ReactSurface from '../react/ReactSurface.vue';
import SchoolExamManager, {type SchoolExamProps} from '../react/tools/SchoolExamManager';
import type {SchoolExamData} from './schoolExam';
const props=defineProps<{data:SchoolExamData}>();
const emit=defineEmits<{update:Parameters<SchoolExamProps['onUpdate']>;start:Parameters<SchoolExamProps['onStart']>;startSet:Parameters<SchoolExamProps['onStartSet']>;search:Parameters<SchoolExamProps['onSearch']>}>();
const draw=()=>createElement(SchoolExamManager,{data:props.data,onUpdate:data=>emit('update',data),onStart:v=>emit('start',v),onStartSet:v=>emit('startSet',v),onSearch:id=>emit('search',id)});
</script>
<template><ReactSurface :draw="draw"/></template>
