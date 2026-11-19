<script setup lang="ts">
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue';
import {useMediaQuery} from '@vueuse/core';
import {createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import ModelBoundary from './ModelBoundary';
import {allowMobileModel,lessons,type LessonKind} from './modelPreference';
const props=defineProps<{kind:LessonKind;active?:boolean}>();
const emit=defineEmits<{interact:[]}>();
const mobile=useMediaQuery('(max-width: 820px), (pointer: coarse)');
const allowed=computed(()=>!mobile.value||allowMobileModel.value);
const expanded=ref(false),loading=ref(false),failed=ref(false);
const host=ref<HTMLElement>();let root:Root|undefined,revision=0;
function close(){revision++;root?.unmount();root=undefined;expanded.value=false;loading.value=false;failed.value=false;}
async function toggle(){
  emit('interact');
  if(expanded.value){close();return;}
  if(!allowed.value)return;
  const request=++revision;expanded.value=true;loading.value=true;
  try{
    const kind=props.kind;
    const element=kind==='fan' ? createElement((await import('./FanLesson')).default)
      : kind==='piston' ? createElement((await import('./PistonLesson')).default)
      : createElement((await import('./EquipmentLesson')).default,{kind});
    await nextTick();
    if(revision!==request||!host.value)return;
    root=createRoot(host.value);root.render(createElement(ModelBoundary,{children:element}));
  }catch{if(request===revision)failed.value=true;}
  finally{if(request===revision)loading.value=false;}
}
watch(()=>props.kind,close);
watch(()=>props.active,active=>{if(active===false)close()});
watch(allowed,ok=>{if(!ok)close()});onBeforeUnmount(close);
</script>
<template><div class="model-slot">
  <button type="button" :disabled="!allowed" :aria-expanded="expanded" @click="toggle">{{expanded?'3D 접기':'3D로 '+lessons[kind].label+' 보기'}}</button>
  <small v-if="!allowed">설정의 모바일 3D 해설에서 켤 수 있습니다.</small>
  <small v-if="loading" role="status">모형 준비 중…</small><small v-if="failed" role="status">모형을 열지 못했습니다.</small>
  <div v-if="expanded" ref="host"></div>
</div></template>
