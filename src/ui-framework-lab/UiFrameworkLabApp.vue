<script setup lang="ts">
import { computed, ref } from 'vue';
import { frameworkByKey, frameworks, type FrameworkInfo, type FrameworkKey } from './catalog';

const initial = new URLSearchParams(location.search).get('framework') || localStorage.getItem('cbt-ui-framework-lab');
const selectedKey = ref<FrameworkKey>(frameworkByKey(initial).key);
const frameLoading = ref(true);
const search = ref('');

const selected = computed(() => frameworkByKey(selectedKey.value));
const filtered = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return keyword
    ? frameworks.filter((item) => `${item.name} ${item.maker} ${item.group}`.toLowerCase().includes(keyword))
    : frameworks;
});
const frameUrl = computed(() => `./ui-framework-sandbox.html?framework=${selectedKey.value}&v=481`);

function selectFramework(item: FrameworkInfo): void {
  if (selectedKey.value === item.key) return;
  frameLoading.value = true;
  selectedKey.value = item.key;
  localStorage.setItem('cbt-ui-framework-lab', item.key);
  const url = new URL(location.href);
  url.searchParams.set('framework', item.key);
  history.replaceState(null, '', url);
}
</script>

<template>
  <main class="lab-shell">
    <aside class="lab-sidebar">
      <a class="lab-back" href="./index.html">← CBT로 돌아가기</a>
      <header>
        <small>PC ONLY · ISOLATED LAB</small>
        <h1>UI 프레임워크<br>체험실</h1>
        <p>실제 패키지를 하나씩 격리해 문제풀이부터 결과 화면까지 비교합니다.</p>
      </header>
      <label class="lab-search">
        <span>프레임워크 검색</span>
        <input v-model="search" type="search" placeholder="Vuetify, 모바일…">
      </label>
      <nav aria-label="UI 프레임워크 목록">
        <button
          v-for="item in filtered"
          :key="item.key"
          type="button"
          :class="{ active: selectedKey === item.key }"
          :aria-pressed="selectedKey === item.key"
          @click="selectFramework(item)"
        >
          <i>{{ item.name.slice(0, 2).toUpperCase() }}</i>
          <span><strong>{{ item.name }}</strong><small>{{ item.group }} · {{ item.license }}</small></span>
        </button>
      </nav>
      <footer>총 <b>{{ frameworks.length }}</b>종 · 학습 데이터와 완전 분리</footer>
    </aside>

    <section class="lab-stage">
      <header class="lab-toolbar">
        <div>
          <span>{{ selected.group }}</span>
          <h2>{{ selected.name }}</h2>
          <p>{{ selected.maker }} · {{ selected.tone }}</p>
        </div>
        <div class="lab-badges">
          <b>실제 패키지</b>
          <em v-if="selected.commercial">상용 체험</em>
        </div>
      </header>
      <p v-if="selected.commercial" class="lab-license-note">
        이 화면은 비교용 평가판입니다. 공개 서비스의 정식 UI로 사용하려면 해당 개발자 라이선스가 필요합니다.
      </p>
      <div class="lab-frame-wrap">
        <div v-if="frameLoading" class="lab-loader"><i /><span>{{ selected.name }}를 따로 불러오는 중…</span></div>
        <iframe
          :key="frameUrl"
          :src="frameUrl"
          :title="`${selected.name} 전체 CBT 화면 미리보기`"
          @load="frameLoading = false"
        />
      </div>
    </section>
    <div class="lab-mobile-block">
      <strong>PC 전용 체험실입니다.</strong>
      <p>화면을 1100px 이상으로 넓혀야 메뉴와 문제풀이 전체 배치를 제대로 비교할 수 있습니다.</p>
      <a href="./index.html">CBT로 돌아가기</a>
    </div>
  </main>
</template>
