import {useEffect, useState, useSyncExternalStore} from 'react';
import type {ReadonlySignal as Ref, Signal} from '@preact/signals-core';
import {Gauge, Palette, RotateCcw, ShieldCheck, Sparkles, WandSparkles} from 'lucide-react';
import {useUiLab, type UiAccent, type UiDensity, type UiMotion, type UiSurface} from '../../cbt/uiLab';
import './theme-studio.css';

const lab = useUiLab();
const accentOptions: Array<{ value: UiAccent; label: string; color: string }> = [
  { value: 'auto', label: '테마 기본', color: 'linear-gradient(135deg,#1268d3,#e62f83,#ffd90f)' },
  { value: 'blue', label: '블루', color: '#1268d3' },
  { value: 'emerald', label: '에메랄드', color: '#0b8f6a' },
  { value: 'violet', label: '바이올렛', color: '#7655d9' },
  { value: 'pink', label: '핑크', color: '#d83d85' },
  { value: 'yellow', label: '옐로', color: '#d28a00' },
];
const densityOptions: Array<{ value: UiDensity; label: string }> = [
  { value: 'comfortable', label: '편안하게' },
  { value: 'compact', label: '고밀도' },
];
const surfaceOptions: Array<{ value: UiSurface; label: string }> = [
  { value: 'soft', label: '부드러운 카드' },
  { value: 'flat', label: '평면·가볍게' },
  { value: 'glass', label: '투명 유리' },
];
const motionOptions: Array<{ value: UiMotion; label: string }> = [
  { value: 'full', label: '전체' },
  { value: 'reduced', label: '줄이기' },
  { value: 'off', label: '끄기' },
];

function usePreference<T>(source: Ref<T>) {
  return useSyncExternalStore(callback => source.subscribe(callback), () => source.value);
}

function Segments<T extends string>({source,options}:{source:Signal<T>;options:{value:T;label:string}[]}) {
  const selected=usePreference(source);
  return <div className={options.length===3?'theme-segmented three':'theme-segmented'}>
    {options.map(item=><button type="button" key={item.value} aria-pressed={selected===item.value}
      className={selected===item.value?'selected':''} onClick={()=>{source.value=item.value;}}>{item.label}</button>)}
  </div>;
}

export default function ThemeStudio({onStartTour}:{onStartTour:()=>void}) {
  const enabled=Boolean(usePreference(lab.enabled)), active=usePreference(lab.active), accent=usePreference(lab.accent);
  const density=usePreference(lab.density),surface=usePreference(lab.surface),overlay=usePreference(lab.photoOverlay) ?? 68;
  const preference=usePreference(lab.systemPreferenceLabel);
  const [details,setDetails]=useState(false);
  const [contrast,setContrast]=useState<Awaited<ReturnType<typeof lab.contrastReport>>>();
  useEffect(()=>{
    if (!active || !details) return;
    let current=true;
    lab.contrastReport().then(report=>{if(current)setContrast(report);}).catch(()=>{if(current)setContrast(undefined);});
    return ()=>{current=false;};
  },[active,details,accent,density,surface]);
  const state=enabled?'checked':'unchecked';
  return <section className={['theme-studio',active?'active':'',lab.safeMode?'safe-mode':''].join(' ')}>
    <header><div className="theme-studio-heading"><span><Palette size={18}/></span><div><strong>UI·테마 실험실</strong><small>기존 화면을 보존한 선택형 플러그인 UI</small></div></div>
      <button type="button" role="switch" aria-checked={enabled} data-state={state} className="theme-studio-switch" disabled={lab.safeMode} aria-label="UI 테마 실험실 켜기" onClick={()=>{lab.enabled.value=!enabled;}}>
        <span className="theme-studio-switch-thumb" data-state={state}/></button></header>
    {lab.safeMode?<p className="theme-studio-safe"><ShieldCheck size={16}/>안전모드로 열려 새 UI가 임시로 꺼졌습니다. 주소의 <code>?safe=1</code>을 지우면 저장 설정이 돌아옵니다.</p>:
      <p className="theme-studio-status"><ShieldCheck size={16}/>{active?'새 UI를 비교 중입니다. 설정은 이 기기에 자동 저장됩니다.':'OFF에서는 기존 UI와 동작을 그대로 사용합니다.'}</p>}
    <div className="theme-studio-collapsible"><button type="button" className="theme-studio-open" disabled={!active} aria-expanded={active&&details} onClick={()=>setDetails(!details)}>
      <WandSparkles size={17}/>세부 설정 {details?'닫기':'열기'}</button>
      {active&&details&&<div className="theme-studio-content">
        <div className="theme-studio-section"><span><Palette size={15}/>강조 색상</span><div className="theme-accent-grid">
          {accentOptions.map(item=><button type="button" key={item.value} aria-pressed={accent===item.value} className={accent===item.value?'selected':''} onClick={()=>{lab.accent.value=item.value;}}><i style={{background:item.color}}/><small>{item.label}</small></button>)}</div></div>
        <div className="theme-studio-section"><span><Gauge size={15}/>화면 밀도</span><Segments source={lab.density} options={densityOptions}/></div>
        <div className="theme-studio-section"><span><Sparkles size={15}/>카드 표현</span><Segments source={lab.surface} options={surfaceOptions}/></div>
        <div className="theme-studio-section"><span>배경사진 위 가림막 <b>{overlay}%</b></span><input type="range" min={20} max={92} step={2} value={overlay} aria-label="테마 배경사진 가림막 강도" onChange={e=>{lab.photoOverlay.value=e.currentTarget.valueAsNumber;}}/></div>
        <div className="theme-studio-section"><span>움직임</span><Segments source={lab.motion} options={motionOptions}/><small className="theme-device-preference">기기 감지: {preference}</small></div>
        <div className="theme-studio-preview" aria-label="테마 미리보기"><article><i/><strong>문제 카드</strong><p>글자와 배경 명암을 실시간으로 확인합니다.</p><button type="button">답안 선택</button></article>
          <aside className={contrast?'is-'+contrast.grade:''}><span>가독성</span><strong>{contrast?.grade}</strong><small>{contrast&&contrast.ratio.toFixed(1)+' : 1'}</small></aside></div>
        <footer><button type="button" onClick={onStartTour}><Sparkles size={15}/>새 기능 안내 보기</button><button type="button" onClick={lab.reset}><RotateCcw size={15}/>세부 설정 초기화</button></footer>
      </div>}</div>
  </section>;
}
