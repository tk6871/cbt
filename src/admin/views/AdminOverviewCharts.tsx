import { useEffect, useRef } from 'react';
import { init, use, type EChartsType } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { seoulDayStart } from '../presentation';
import './admin-trend.css';

use([CanvasRenderer, BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent]);
type Props = {results: {score: number; completed_at: string}[]; visits: {visited_at: string}[]};
const day = 86400000;
const label = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', month:'numeric', day:'numeric'});

export default function AdminOverviewCharts({results, visits}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const start = seoulDayStart(Date.now()) - 13 * day;
  const rows = Array.from({length:14}, (_, i) => ({date:label.format(start + i * day), visits:0, score:0, exams:0}));
  const bucket = (date: string) => rows[Math.floor((Date.parse(date) - start) / day)];
  for (const visit of visits) {
    const row = bucket(visit.visited_at);
    if (row) row.visits++;
  }
  for (const result of results) {
    const row = bucket(result.completed_at);
    if (row) { row.score += result.score; row.exams++; }
  }
  const averages = rows.map(row => row.exams ? Math.round(row.score / row.exams) : null);
  useEffect(() => {
    const node = host.current!;
    const instance = init(node);
    chart.current = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(node);
    return () => { observer.disconnect(); chart.current = null; instance.dispose(); };
  }, []);
  useEffect(() => {
    const update = () => {
      const color = getComputedStyle(host.current!).color;
      chart.current?.setOption({
        animation:false, grid:{left:38,right:38,top:44,bottom:30}, tooltip:{trigger:'axis'},
        legend:{top:3,textStyle:{color}}, textStyle:{color},
        xAxis:{type:'category', data:rows.map(row => row.date), axisLabel:{color, fontSize:10}},
        yAxis:[
          {type:'value',name:'접속',minInterval:1,axisLabel:{color},
            splitLine:{lineStyle:{color,opacity:.18}}},
          {type:'value',name:'점수',min:0,max:100,axisLabel:{color},splitLine:{show:false}}
        ],
        series:[{name:'접속 기록',type:'bar',data:rows.map(row => row.visits),itemStyle:{color:'#70a9e8'}},
          {name:'평균 점수',type:'line',yAxisIndex:1,data:averages,itemStyle:{color:'#18a57f'}}]
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    return () => observer.disconnect();
  });
  return <article className="admin-panel admin-trend-panel">
    <div className="admin-panel-title"><h2>접속과 평균 점수 흐름</h2><small>최근 14일 · 한국 시간</small></div>
    <div className="admin-trend-chart" ref={host} aria-hidden="true"/>
    <details><summary>날짜별 수치 보기</summary><table><thead><tr><th>날짜</th><th>접속</th><th>평균 점수</th></tr></thead>
      <tbody>{rows.map((row,i) => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.visits}</td><td>{averages[i] ?? '—'}</td></tr>)}</tbody>
    </table></details></article>;
}
