<script setup lang="ts">
import {getCurrentInstance, inject, onBeforeUnmount, onMounted, ref, watchEffect} from 'vue';
import {createElement, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {VueAppContext} from './VueChild';
import {pinSolutionKey,PinSolutionContext} from './workspaceTypes';

const props=defineProps<{draw:()=>ReactNode}>();
const host=ref<HTMLElement>();
const app=getCurrentInstance()!.appContext;
const pin=inject(pinSolutionKey,undefined);
const provides=Object.create(app.provides);
if(pin)provides[pinSolutionKey]=pin;
const context={...app,provides};
let root: Root|undefined;
let stop: (()=>void)|undefined;
onMounted(()=>{
  root=createRoot(host.value!);
  stop=watchEffect(()=>{
    root!.render(createElement(VueAppContext.Provider,{value:context},createElement(PinSolutionContext.Provider,{value:pin},props.draw())));
  },{flush:'post'});
});
onBeforeUnmount(()=>{stop?.();const mountedRoot=root;queueMicrotask(()=>mountedRoot?.unmount());});
</script>
<template><div ref="host" style="display:contents"></div></template>
