<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineProps<{ percent: number }>();
const canvas = ref<HTMLCanvasElement>();
const rendered = ref(false);
let disposed = false;
let timer = 0;
let cleanup: (() => void) | undefined;

onMounted(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (reducedMotion.matches || connection?.saveData) return;
  // Short requests do not start WebGL or fetch the optional renderer.
  timer = window.setTimeout(async () => {
    try {
      const T = await import('three');
      if (disposed || !canvas.value || reducedMotion.matches) return;
      const renderer = new T.WebGLRenderer({ canvas: canvas.value, alpha: true, antialias: true });
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(38, 1, .1, 20);
      camera.position.z = 4;
      const geometry = new T.IcosahedronGeometry(.86, 0);
      const material = new T.MeshBasicMaterial({ color: '#36a68f', wireframe: true });
      const mesh = new T.Mesh(geometry, material);
      cleanup = () => {
        renderer.setAnimationLoop(null);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };
      scene.add(mesh);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setSize(52, 52, false);
      renderer.setAnimationLoop(ms => {
        if (document.hidden || reducedMotion.matches) return;
        mesh.rotation.set(ms * .001, ms * .0015, 0);
        renderer.render(scene, camera);
        rendered.value = true;
      });
    } catch {
      cleanup?.();
      cleanup = undefined;
    }
  }, 300);
});

onBeforeUnmount(() => {
  disposed = true;
  window.clearTimeout(timer);
  cleanup?.();
});
</script>

<template>
  <section class="rounds-loading" aria-label="종목 자료 로딩">
    <span class="rounds-loading-art" aria-hidden="true">
      <span v-if="!rendered">◇</span>
      <canvas ref="canvas" v-show="rendered" />
    </span>
    <div class="rounds-loading-copy">
      <strong role="status">{{ percent === 0 ? '문제 자료를 읽는 중…' : percent < 100 ? '회차 목록을 준비하는 중…' : '준비 완료' }}</strong>
      <small>로딩 단계 {{ percent }}%</small>
      <progress :value="percent" max="100" aria-label="회차 준비 진행률" />
    </div>
  </section>
</template>

<style scoped>
.rounds-loading{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid var(--line,#8885);border-radius:10px;margin:10px 0}
.rounds-loading-art{width:52px;height:52px;display:grid;place-items:center;flex:none;color:#36a68f;font-size:38px}
.rounds-loading-art canvas{width:52px;height:52px}
.rounds-loading-copy{display:grid;grid-template-columns:1fr auto;gap:5px 12px;min-width:0;flex:1}
.rounds-loading-copy progress{grid-column:1/-1;width:100%;accent-color:#36a68f}
</style>
