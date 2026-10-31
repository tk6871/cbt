<script setup lang="ts">
import type {BookContentsNode} from './textbookContents';
defineProps<{node:BookContentsNode;counts:Record<string,{ready:number;pending:number;examples?:number}>;selected:string}>();
const emit=defineEmits<{select:[id:string]}>();
</script>
<template>
 <details v-if="node.children?.length" class="contents-branch">
  <summary><span>{{node.title}}</span><small>{{counts[node.id]?.ready||0}}문제 연결<template v-if="counts[node.id]?.examples"> · 풀이 예제 {{counts[node.id].examples}}개</template></small></summary>
  <div class="contents-branch-body">
   <p v-if="node.note" class="contents-note">{{node.note}}</p>
   <button v-if="node.from" type="button" :aria-pressed="selected===node.id" @click="emit('select',node.id)">{{node.title}} · 연결 문제 모아 보기</button>
   <BookContentsBranch v-for="child in node.children" :key="child.id" :node="child" :counts="counts" :selected="selected" @select="emit('select',$event)" />
  </div>
 </details>
 <div v-else class="contents-leaf">
  <button type="button" :disabled="!node.from" :aria-pressed="selected===node.id" @click="emit('select',node.id)">
   <span>{{node.title}} <small v-if="node.from">{{node.from}}{{node.to?`~${node.to}`:'쪽부터'}}</small></span>
   <small>{{counts[node.id]?.ready?`${counts[node.id].ready}문제 연결`:counts[node.id]?.examples?'객관식 아님':'문제 연결 준비 중'}}<template v-if="counts[node.id]?.examples"> · 풀이 예제 {{counts[node.id].examples}}개</template><template v-if="counts[node.id]?.pending"> · 대조{{counts[node.id].pending}}위치</template></small>
  </button><p v-if="node.note" class="contents-note">{{node.note}}</p>
 </div>
</template>
