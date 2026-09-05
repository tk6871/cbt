<script setup lang="ts">
import { ref } from 'vue';
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui';
import { Menu, X, Settings, Sun, Moon, Calculator, ArrowRight } from '@lucide/vue';
import { useWorkspaceLayout } from './workspaceLayout';
defineProps<{ title: string; spaceName: string; activeView: string; dark: boolean; comic: boolean; sunjae: boolean; photos: string[]; items: Array<{ id: string; label: string; symbol: string }> }>();
const emit = defineEmits<{ navigate: [id: string]; settings: []; calculator: []; theme: [] }>();
const { touchLayout } = useWorkspaceLayout();
const open = ref(false);
function navigate(id: string) { open.value = false; emit('navigate', id); }
</script>

<template>
  <div class="workspace-navigation">
    <header class="ws-topbar">
      <button type="button" class="ws-menu-trigger" aria-label="전체 메뉴 열기" @click="open = true"><Menu :size="22" /></button>
      <button type="button" class="ws-wordmark" @click="navigate('home')"><b>{{ comic ? 'SPRINGFIELD' : sunjae ? 'LOVELY RUNNER' : 'CBT' }}</b><span>{{ comic ? 'STUDY CLUB' : spaceName }}</span></button>
      <span class="ws-current">{{ title }}</span>
      <div class="ws-top-actions">
        <button type="button" aria-label="공학용 계산기 열기" @click="emit('calculator')"><Calculator :size="20" /></button>
        <button type="button" :aria-label="dark ? '라이트 모드로 전환' : '다크 모드로 전환'" @click="emit('theme')"><Sun v-if="dark" :size="20" /><Moon v-else :size="20" /></button>
        <button type="button" aria-label="설정 열기" @click="emit('settings')"><Settings :size="20" /><span>설정</span></button>
      </div>
    </header>
    <aside v-if="!touchLayout" class="ws-rail">
      <figure v-if="comic || sunjae"><img :src="photos[0]" :alt="sunjae ? '류선재' : '킹사이즈 호머'"><figcaption>{{ sunjae ? '오늘도 너랑 같이.' : '오늘도 한 문제씩!' }}</figcaption></figure>
      <nav aria-label="학습 메뉴">
        <button v-for="(item, index) in items" :key="item.id" type="button" :aria-current="activeView === item.id ? 'page' : undefined" @click="navigate(item.id)">
          <img v-if="comic || sunjae" :src="photos[(index + 1) % photos.length]" alt="" loading="lazy"><b v-else>{{ item.symbol }}</b><span>{{ item.label }}</span>
        </button>
      </nav>
      <button class="ws-rail-settings" type="button" @click="emit('settings')"><Settings :size="18" /> 화면 설정</button>
    </aside>
    <nav v-if="touchLayout" class="ws-bottom-nav" aria-label="빠른 학습 메뉴">
      <button v-for="item in items.slice(0, 4)" :key="item.id" type="button" :aria-current="activeView === item.id ? 'page' : undefined" @click="navigate(item.id)"><b>{{ item.symbol }}</b><span>{{ item.label }}</span></button>
      <button type="button" @click="open = true"><Menu :size="21" /><span>전체 메뉴</span></button>
    </nav>
    <DialogRoot v-model:open="open">
      <DialogPortal>
        <DialogOverlay class="ws-menu-overlay" />
        <DialogContent class="ws-menu-dialog">
          <header><div><DialogTitle>전체 메뉴</DialogTitle><DialogDescription>공부할 도구를 골라주세요.</DialogDescription></div><DialogClose aria-label="전체 메뉴 닫기"><X :size="23" /></DialogClose></header>
          <nav><button v-for="(item, index) in items" :key="item.id" type="button" @click="navigate(item.id)"><img v-if="comic || sunjae" :src="photos[(index + 1) % photos.length]" alt="" loading="lazy"><b v-else>{{ item.symbol }}</b><span>{{ item.label }}</span><ArrowRight :size="16" /></button></nav>
          <footer><button type="button" @click="open = false; emit('settings')">화면·학습 설정</button><button type="button" @click="open = false; emit('calculator')">계산기</button></footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
