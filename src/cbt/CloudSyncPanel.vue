<script setup lang="ts">
import {createElement} from 'react';
import CloudSyncPanel from '../react/tools/CloudSyncPanel';
import ReactSurface from '../react/ReactSurface.vue';
const props=defineProps<{description:string}>();
</script>
<template><ReactSurface :draw="()=>createElement(CloudSyncPanel,{description:props.description})"/></template>
