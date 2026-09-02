<script setup lang="ts">
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';

type ResultRow = { score: number; completed_at: string; unanswered_count: number };
type VisitRow = { visited_at: string };
const props = defineProps<{ results: ResultRow[]; visits: VisitRow[] }>();

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent]);

const days = computed(() => Array.from({ length: 14 }, (_, index) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (13 - index));
  return date;
}));

const option = computed(() => {
  const labels = days.value.map((date) => `${date.getMonth() + 1}/${date.getDate()}`);
  const keys = days.value.map((date) => date.toISOString().slice(0, 10));
  const visits = keys.map((key) => props.visits.filter((item) => item.visited_at.slice(0, 10) === key).length);
  const dailyResults = keys.map((key) => props.results.filter((item) => item.completed_at.slice(0, 10) === key));
  const averages = dailyResults.map((rows) => rows.length
    ? Math.round(rows.reduce((sum, item) => sum + Number(item.score || 0), 0) / rows.length)
    : 0);
  return {
    animationDuration: 360,
    grid: { left: 38, right: 38, top: 42, bottom: 28 },
    tooltip: { trigger: 'axis' },
    legend: { top: 5, textStyle: { fontSize: 11 } },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', name: '접속', minInterval: 1, nameTextStyle: { fontSize: 10 } },
      { type: 'value', name: '점수', min: 0, max: 100, nameTextStyle: { fontSize: 10 } },
    ],
    series: [
      { name: '접속 기록', type: 'bar', data: visits, itemStyle: { color: '#70a9e8', borderRadius: [4, 4, 0, 0] } },
      { name: '평균 점수', type: 'line', yAxisIndex: 1, data: averages, smooth: true, connectNulls: true, symbolSize: 6, lineStyle: { width: 3, color: '#16a07a' }, itemStyle: { color: '#16a07a' } },
    ],
  };
});
</script>

<template>
  <article class="admin-panel admin-trend-panel">
    <div class="admin-panel-title"><div><span>14 DAY TREND</span><h2>접속과 평균 점수 흐름</h2></div><small>그래프는 이 화면을 열 때만 불러옵니다.</small></div>
    <VChart class="admin-trend-chart" :option="option" autoresize />
  </article>
</template>

<style scoped>
.admin-trend-panel{margin-top:14px}.admin-panel-title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.admin-panel-title span{color:#1769d2;font-size:.55rem;font-weight:900;letter-spacing:.12em}.admin-panel-title h2{margin:4px 0 0;font-size:.83rem}.admin-panel-title>small{color:#8291a4;font-size:.53rem}.admin-trend-chart{width:100%;height:290px;margin-top:8px}@media(max-width:620px){.admin-panel-title{align-items:flex-start;flex-direction:column}.admin-trend-chart{height:250px}}
</style>
